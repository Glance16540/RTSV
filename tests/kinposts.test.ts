// What the leader's household and circle do (src/sim/kin.ts): a spouse carried off is held like any captive, each
// post does a little by its holder's loyalty, and the season's report names the changes in the household.
import { describe, expect, it } from 'vitest';
import { MAX_VETERAN, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { KIN, deputyAt, kinOf, kinSeason, plotWarning, spouseOf, sway } from '../src/sim/kin';
import type { Post } from '../src/sim/kin';
import { rollOf } from '../src/sim/roll';
import { reportLines, reportSince, snapshot } from '../src/sim/seasonreport';
import { THREATS, breakBand, captivesSeason } from '../src/sim/threats';
import { needOf } from '../src/sim/larder';
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

/** The seat is sacked by a band that carries people off, until the spouse is among them. */
function carriedOff(): { c: Campaign; home: number } {
  for (let n = 0; n < 40; n++) {
    const { c, home } = world();
    c.turn = 20 + n;
    kinOf(c, 0);
    (c.bands ??= []).push({ id: 9, kind: 'slavers', name: 'the Chain', at: c.territories[home].adj[0], strength: 3, since: c.turn, held: [{ from: home, owner: 0, men: [70], women: [80], since: c.turn }] });
    (c.events ??= []).push({ kind: 'carried', at: home, turn: c.turn, until: c.turn });
    kinSeason(c, 0);
    if (c.factions[0].kin!.spouse!.lost?.how === 'taken') return { c, home };
  }
  throw new Error('never carried off');
}

const holder = (c: Campaign, post: Post) => c.factions[0].kin!.circle.find((x) => x.post === post)!;

describe('a spouse carried off', () => {
  it('is held by the band that took them, among its captives, with the clock of any captive, and shown on the roll', () => {
    const { c } = carriedOff();
    const s = c.factions[0].kin!.spouse!;
    expect(c.bands![0].held[0].names).toContain(s.name);
    expect(s.lost).toMatchObject({ how: 'taken', band: 9 });
    const r = rollOf(c);
    expect(r.captives[0].names).toContain(s.name);
    expect(r.captives[0].seasonsLeft).toBe(THREATS.holdFor);
    expect(r.spouse!.lost!.how).toBe('taken');
    expect(spouseOf(c, 0)).toBeUndefined(); // no spouse at the leader's side while held
  });

  it('comes home when the band is broken in time, and the leader is no longer alone', () => {
    const { c } = carriedOff();
    const s = c.factions[0].kin!.spouse!;
    c.turn++;
    kinSeason(c, 0);
    expect(s.lost).toBeTruthy(); // still held
    breakBand(c, c.bands![0], []);
    c.turn++;
    kinSeason(c, 0);
    expect(s.lost).toBeUndefined();
    expect(spouseOf(c, 0)).toBe(s);
    expect(c.factions[0].kin!.alone).toBeUndefined();
    expect(c.factions[0].kin!.news!.some((x) => x.text.includes('has come home') && x.tone === 'good')).toBe(true);
  });

  it('held too long, is lost for good, and the leader may marry again in time', () => {
    const { c } = carriedOff();
    const s = c.factions[0].kin!.spouse!;
    c.turn += THREATS.holdFor;
    captivesSeason(c, []);
    kinSeason(c, 0);
    expect(s.lost).toMatchObject({ how: 'taken', final: true });
    let wed = false;
    for (let n = 0; n < 80 && !wed; n++) { c.turn++; kinSeason(c, 0); wed = !!spouseOf(c, 0); }
    expect(wed).toBe(true);
    expect(spouseOf(c, 0)).not.toBe(s);
  });
});

describe('what each post does', () => {
  it('sway runs from -1 to 1 by loyalty', () => {
    const { c } = world();
    const x = kinOf(c, 0).circle[0];
    x.loyalty = 100; expect(sway(x)).toBe(1);
    x.loyalty = 50; expect(sway(x)).toBe(0);
    x.loyalty = 0; expect(sway(x)).toBe(-1);
  });

  it('a loyal steward stretches a seat running short; a disloyal one skims its eating', () => {
    const at = (loyalty: number, food: number): number => {
      const { c, home } = world();
      kinOf(c, 0);
      holder(c, 'steward').loyalty = loyalty;
      const store = folkOf(c, home).stores;
      store.food = food;
      c.turn++;
      kinSeason(c, 0);
      return store.food - food;
    };
    const { c, home } = world();
    const need = needOf(c, home);
    expect(at(100, 0)).toBe(Math.round(KIN.steward * need));
    expect(at(100, need * 3)).toBe(0); // nothing to stretch where there is plenty
    expect(at(0, need * 3)).toBeLessThan(0);
    expect(at(0, need * 3)).toBeGreaterThanOrEqual(-Math.round(KIN.steward * need)); // loyalty 0, a point up for a quiet season
    expect(at(50, 0)).toBe(0);
  });

  it('a loyal marshal seasons the army the leader rides with; a disloyal one wears it down', () => {
    const vet = (loyalty: number, start: number): number => {
      const { c, home } = world();
      kinOf(c, 0);
      const army = c.armies.find((a) => a.owner === 0)!;
      army.at = home; army.hero = true; army.vet = start;
      for (let n = 0; n < 60; n++) { holder(c, 'marshal').loyalty = loyalty; c.turn++; kinSeason(c, 0); }
      return army.vet;
    };
    expect(vet(100, 0)).toBe(MAX_VETERAN);
    expect(vet(0, MAX_VETERAN)).toBe(0);
    expect(vet(50, 1)).toBe(1);
  });

  it('a loyal priest moves the seat toward the holy; a disloyal one away', () => {
    const faith = (loyalty: number): number => {
      const { c, home } = world();
      c.territories[home].buildings.push('church');
      kinOf(c, 0);
      const before = c.territories[home].virtue ?? 0;
      for (let n = 0; n < 40; n++) { holder(c, 'priest').loyalty = loyalty; c.turn++; kinSeason(c, 0); }
      return (c.territories[home].virtue ?? 0) - before;
    };
    expect(faith(100)).toBeGreaterThan(0);
    expect(faith(0)).toBeLessThan(0);
  });

  it('a loyal right hand stands in for the leader in their own town; a disloyal one does not, and leads it astray', () => {
    const { c, home } = world();
    const other = c.territories.find((t) => t.owner < 0 && c.territories[home].adj.includes(t.id))!;
    other.owner = 0;
    folkOf(c, other.id).notables = [{ name: 'Hideo', gender: 'm', kind: 'veteran', deed: 'held the ford', turn: 1, kills: 4, unit: 'Archer' }];
    kinOf(c, 0);
    const right = holder(c, 'right');
    expect(right.name).toBe('Hideo'); // one away from the seat is preferred
    expect(deputyAt(c, 0, other.id)).toBe(right);
    expect(deputyAt(c, 0, home)).toBeUndefined();
    right.loyalty = 10;
    expect(deputyAt(c, 0, other.id)).toBeUndefined();
    const before = other.virtue ?? 0;
    c.turn++;
    kinSeason(c, 0);
    expect(other.virtue ?? 0).toBeLessThan(before);
  });

  it('the confidant\'s warning of plots is there for the intrigue to read: above nothing when loyal, below when not', () => {
    const { c } = world();
    const k = kinOf(c, 0);
    const conf = k.circle.find((x) => x.post === 'confidant');
    expect(conf).toBeTruthy(); // no church, so a confidant and not a priest
    conf!.loyalty = 90;
    expect(plotWarning(c, 0)).toBeCloseTo(0.8);
    conf!.loyalty = 20;
    expect(plotWarning(c, 0)).toBeLessThan(0);
    k.circle = k.circle.filter((x) => x !== conf);
    expect(plotWarning(c, 0)).toBe(0);
  });
});

describe('the season\'s report names the changes in the household', () => {
  it('carried off, widowed, married, and someone leaving the circle', () => {
    const { c, home } = carriedOff();
    const s0 = snapshot(c);
    s0.turn = c.turn - 1;
    let lines = reportLines(reportSince(c, s0)).map((l) => l.text);
    expect(lines.some((l) => l.includes('was carried off when'))).toBe(true);

    const s1 = snapshot(c);
    folkOf(c, home).notables[0].lost = { turn: c.turn, how: 'fell in battle' };
    c.factions[0].hero = { ...(c.factions[0].hero ?? {}), name: 'Kenji the Younger', female: false };
    c.turn++;
    kinSeason(c, 0);
    lines = reportLines(reportSince(c, s1)).map((l) => l.text);
    expect(lines.some((l) => l.includes('Ren') && l.includes('is lost'))).toBe(true);
    expect(lines.some((l) => l.includes('Kenji the Younger rules with'))).toBe(true);

    const s2 = snapshot(c);
    c.factions[0].kin!.spouse!.lost = { turn: c.turn, how: 'died' };
    c.factions[0].kin!.alone = c.turn - KIN.remarry;
    let wed = false;
    for (let n = 0; n < 80 && !wed; n++) { c.turn++; kinSeason(c, 0); wed = !!spouseOf(c, 0); }
    lines = reportLines(reportSince(c, s2)).map((l) => l.text);
    expect(lines.some((l) => l.includes('has married again'))).toBe(true);
  });
});

describe('names in the household', () => {
  it('no child of the house shares a name with the spouse or anyone in the circle, in any new world', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      for (const f of c.factions) {
        const k = kinOf(c, f.id), heirs = (f.house?.heirs ?? []).map((h) => h.name);
        const others = [...(k.spouse ? [k.spouse.name] : []), ...k.circle.map((x) => x.name)];
        for (const h of heirs) expect(others, `seed ${seed}, ${f.name}: ${h}`).not.toContain(h);
      }
    }
  });
});
