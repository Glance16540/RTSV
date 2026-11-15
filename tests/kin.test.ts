// The leader's household and inner circle (src/sim/kin.ts, docs/DESIGN.md "Relationships").
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { HEIR_EVERY, houseOf, tickHouses } from '../src/sim/dynasty';
import { KIN, canBear, kinOf, kinSeason, kinSeasons, parentFor, spouseOf } from '../src/sim/kin';
import { rollOf } from '../src/sim/roll';
import { folkOf } from '../src/sim/township';

/** A nation whose capital knows a veteran and a matron by name. */
function world(): { c: Campaign; home: number } {
  const c = newCampaign(7, 1, 1, 'japan');
  const home = c.territories.find((t) => t.capital === 0)!;
  folkOf(c, home.id).notables = [
    { name: 'Ren', gender: 'm', kind: 'veteran', deed: 'felled 9 in battle as a spearman', turn: 1, kills: 9, unit: 'Spearman' },
    { name: 'Aiko', gender: 'f', kind: 'mother', deed: 'raised four children', turn: 1, kids: 4 },
  ];
  return { c, home: home.id };
}

describe('the leader\'s household', () => {
  it('a leader has a husband or wife, of the other sex, named, and their children are theirs too', () => {
    const { c } = world();
    const k = kinOf(c, 0), s = spouseOf(c, 0)!;
    expect(s.female).toBe(!c.factions[0].hero?.female);
    expect(s.name.length).toBeGreaterThan(0);
    expect((c.turn - s.born) / 4).toBeGreaterThanOrEqual(30); // old enough to have a child in their teens
    expect((c.turn - s.born) / 4).toBeLessThan(46);
    expect(s.of).toBe(k.leader);
    expect(parentFor(c, 0)).toBe(s.name);
    const house = houseOf(c, 0);
    expect(house.heirs[0].parent).toBe(s.name);
    c.turn = house.due;
    tickHouses(c);
    expect(house.heirs.at(-1)!.parent).toBe(s.name);
  });

  it('a spouse who dies leaves the leader alone: no child is born to the house until they marry again', () => {
    const { c } = world();
    const k = kinOf(c, 0);
    k.spouse!.lost = { turn: c.turn, how: 'died' };
    k.alone = c.turn;
    expect(canBear(c, 0)).toBe(false);
    const house = houseOf(c, 0), had = house.heirs.length;
    c.turn = house.due + HEIR_EVERY;
    tickHouses(c);
    expect(house.heirs.length).toBe(had);
    // In time, and not before KIN.remarry seasons, they marry again.
    const since = k.alone!;
    let wed = false;
    for (let s = 0; s < 80 && !wed; s++) { c.turn++; kinSeason(c, 0); wed = !!spouseOf(c, 0); }
    expect(wed).toBe(true);
    expect(c.turn - since).toBeGreaterThanOrEqual(KIN.remarry);
    expect(c.chronicle!.some((x) => x.text.includes('has married again'))).toBe(true);
  });

  it('a spouse may be carried off when the leader\'s seat is sacked', () => {
    let taken = 0;
    for (let n = 0; n < 40; n++) {
      const { c, home } = world();
      c.turn = 20 + n;
      kinOf(c, 0);
      (c.events ??= []).push({ kind: 'carried', at: home, turn: c.turn, until: c.turn });
      kinSeason(c, 0);
      if (c.factions[0].kin!.spouse!.lost?.how === 'taken') taken++;
    }
    expect(taken).toBeGreaterThan(40 * KIN.carried * 0.5);
    expect(taken).toBeLessThan(40 * KIN.carried * 1.5);
  });

  it('a new leader comes with a household of their own, and the old leader\'s spouse is widowed', () => {
    const { c } = world();
    const old = kinOf(c, 0).spouse!;
    c.factions[0].hero = { ...(c.factions[0].hero ?? {}), name: 'Kenji the Younger', female: false };
    kinSeason(c, 0);
    expect(old.lost?.how).toBe('widowed');
    const now = spouseOf(c, 0)!;
    expect(now).not.toBe(old);
    expect(now.of).toBe('Kenji the Younger');
    expect(now.female).toBe(true);
    expect(c.chronicle!.some((x) => x.text.includes('is widowed'))).toBe(true);
  });
});

describe('the inner circle', () => {
  it('up to four close to the leader, drawn from the nation\'s notable people where it can be', () => {
    const { c, home } = world();
    const k = kinOf(c, 0);
    expect(k.circle.length).toBe(KIN.most);
    expect(new Set(k.circle.map((x) => x.post)).size).toBe(k.circle.length);
    const marshalOrRight = k.circle.filter((x) => x.post === 'marshal' || x.post === 'right').map((x) => x.name);
    expect(marshalOrRight).toContain('Ren');
    expect(k.circle.find((x) => x.post === 'steward')!.name).toBe('Aiko');
    for (const x of k.circle) { expect(x.loyalty).toBe(KIN.start); expect(x.town).toBe(home); }
    expect(new Set(k.circle.map((x) => x.name)).size).toBe(k.circle.length);
  });

  it('loyalty falls when their town is raided or goes hungry, and one under KIN.angry is angry', () => {
    const { c, home } = world();
    const k = kinOf(c, 0);
    for (let s = 0; s < 12; s++) {
      c.turn++;
      (c.events ??= []).push({ kind: 'raid', at: home, turn: c.turn, until: c.turn });
      folkOf(c, home).hungry = 2;
      kinSeason(c, 0);
    }
    for (const x of k.circle) { expect(x.loyalty).toBeLessThan(KIN.angry); expect(x.feeling).toBe('angry'); }
  });

  it('someone lost leaves the circle and the place is filled', () => {
    const { c, home } = world();
    const k = kinOf(c, 0);
    folkOf(c, home).notables[0].lost = { turn: c.turn, how: 'fell in battle' };
    c.turn++;
    kinSeason(c, 0);
    expect(k.circle.some((x) => x.name === 'Ren')).toBe(false);
    expect(k.circle.length).toBe(KIN.most);
    expect(c.log.some((l) => l.includes('Ren') && l.includes('is lost'))).toBe(true);
  });

  it('rivals have a household and circle too, and all of it is kept in a saved game and shown on the roll', () => {
    const { c } = world();
    c.turn++;
    kinSeasons(c);
    expect(c.factions[1].kin!.circle.length).toBeGreaterThan(0);
    expect(spouseOf(c, 1)).toBeTruthy();
    const kept = JSON.parse(JSON.stringify(c)) as Campaign;
    expect(kept.factions[0].kin).toEqual(c.factions[0].kin);
    const r = rollOf(c);
    expect(r.spouse!.name).toBe(spouseOf(c, 0)!.name);
    expect(r.circle.map((x) => x.name)).toEqual(c.factions[0].kin!.circle.map((x) => x.name));
    expect(r.circle[0].postName.length).toBeGreaterThan(0);
  });
});
