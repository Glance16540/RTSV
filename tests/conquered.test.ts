// A town taken (docs/DESIGN.md; src/sim/conquered.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import { YOKE, goodRule, resentOf, resentful, revoltChance, seasonOfYoke, townTaken } from '../src/sim/conquered';
import { seat } from '../src/sim/court';
import { townMood } from '../src/sim/portrait';
import { folkOf } from '../src/sim/township';
import { worldsBeforeEmptyBeside } from './helpers';

worldsBeforeEmptyBeside(); // written before every people had an empty land beside its chief town: the worlds these tests were written with

const LONG = 60_000;
/** The player holds a town taken from the rival, with nothing built in it and no army there. */
const held = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner < 0 && !x.horde && !x.wild)!; // a tribe's, not a wild land with nobody in it (wilds.ts)
  t.buildings = []; c.places = [];
  c.armies = c.armies.filter((a) => a.at !== t.id);
  townTaken(c, t.id, 1, 0);
  t.owner = 0;
  return { c, t };
};
/** Make a rising certain, or impossible, for as long as `body` runs. */
const sure = (chance: number, body: () => void) => { const was = YOKE.revolt; YOKE.revolt = chance; try { body(); } finally { YOKE.revolt = was; } };

describe('a town taken', () => {
  it('begins resentful: more so when taken from a nation than from a tribe, and most when it was their chief town', () => {
    const c = newCampaign(7, 1, 1, 'hearth');
    const tribe = c.territories.find((x) => x.owner < 0 && !x.horde)!, theirs = c.territories.find((x) => x.capital === 1)!;
    expect(resentOf(c, tribe.id)).toBe(0);
    townTaken(c, tribe.id, -1, 0);
    expect(tribe.yoke).toEqual({ from: -1, since: c.turn, resent: YOKE.tribe });
    townTaken(c, theirs.id, 1, 0);
    expect(resentOf(c, theirs.id)).toBe(YOKE.nation + YOKE.capital);
    expect(resentful(c, theirs.id)).toBe(true);
    // Its own people take it back: it is free of the yoke.
    townTaken(c, theirs.id, 0, 1);
    expect(theirs.yoke).toBeUndefined();
  }, LONG);

  it('a battle won on the map puts the yoke on, and the faces of its people show it', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((x) => x.capital === 0)!;
    const to = home.adj.map((n) => c.territories[n]).find((x) => x.owner < 0 && !x.horde)!;
    const a = armyAt(c, home.id)!;
    a.units = { cavalry: 12 };
    expect(moveArmy(c, a.id, to.id)).toBe('battle');
    resolvePending(c, 'attacker');
    expect(to.owner).toBe(0);
    expect(to.yoke).toMatchObject({ from: -1, resent: YOKE.tribe });
    expect(townMood(c, to.id).conquered).toBe(true);
    expect(townMood(c, home.id).conquered).toBe(false);
  }, LONG);

  it('eases every season, sooner where it is ruled well and slower where it is not', () => {
    const { c, t } = held();
    expect(goodRule(c, t.id)).toBe(YOKE.ease);
    t.buildings = ['church', 'farm'];
    expect(goodRule(c, t.id)).toBe(YOKE.ease + YOKE.church + YOKE.farm);
    seat(c, 0, t.id);
    expect(goodRule(c, t.id)).toBe(YOKE.ease + YOKE.church + YOKE.farm + YOKE.leader);
    t.buildings = ['tavern'];
    expect(goodRule(c, t.id)).toBe(YOKE.ease + YOKE.leader - YOKE.tavern);
    seat(c, 0, c.territories.find((x) => x.capital === 0)!.id);
    c.factions[0].virtue = 80; // a pious people rule more gently
    expect(goodRule(c, t.id)).toBe(YOKE.ease + YOKE.pious - YOKE.tavern);
    c.factions[0].virtue = 0;
    t.buildings = [];
    (c.events ??= []).push({ kind: 'famine', at: t.id, turn: c.turn, until: c.turn }); // struck and not protected: held against the ruler
    expect(goodRule(c, t.id)).toBe(YOKE.ease - YOKE.struck);
    c.events = [];
    sure(0, () => {
      const was = resentOf(c, t.id);
      seasonOfYoke(c);
      expect(resentOf(c, t.id)).toBe(was - YOKE.ease);
    });
  }, LONG);

  it('the chance of a rising falls with time, is far less with an army in the town, nothing just after one has left, and nothing with the leader there', () => {
    const { c, t } = held();
    const at = (r: number) => Math.min(1, YOKE.revolt * ((r - YOKE.quiet) / (100 - YOKE.quiet)) ** 2);
    const fresh = revoltChance(c, t.id);
    expect(fresh).toBeGreaterThan(0);
    expect(fresh).toBeCloseTo(at(YOKE.nation), 6);
    t.yoke!.resent = 40;
    expect(revoltChance(c, t.id)).toBeLessThan(fresh);
    expect(revoltChance(c, t.id)).toBeCloseTo(at(40), 6);
    t.yoke!.resent = YOKE.quiet;
    expect(revoltChance(c, t.id)).toBe(0);
    t.yoke!.resent = 40;
    c.armies.push({ id: 90, owner: 0, at: t.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    expect(revoltChance(c, t.id)).toBeCloseTo(at(40) * YOKE.garrison, 6);
    expect(revoltChance(c, t.id, { bare: true })).toBeCloseTo(at(40), 6); // what it would be if the army left
    c.armies.pop();
    c.factions[0].virtue = 90; // the Virtuous are followed more willingly
    expect(revoltChance(c, t.id)).toBeCloseTo(at(40) * 0.5, 6);
    c.factions[0].virtue = -90;
    expect(revoltChance(c, t.id)).toBeCloseTo(Math.min(1, at(40) * 1.5), 6);
    c.factions[0].virtue = 0;
    // An army has just been there: for a few seasons after it leaves the town is cowed.
    t.yoke!.held = c.turn - 1;
    expect(revoltChance(c, t.id)).toBe(at(40) * YOKE.cowedBy);
    t.yoke!.held = c.turn - YOKE.cowed - 1;
    expect(revoltChance(c, t.id)).toBeCloseTo(at(40), 6);
    seat(c, 0, t.id);
    expect(revoltChance(c, t.id)).toBe(0);
  }, LONG);

  it('a town left to settle becomes the taker\'s own', () => {
    const { c, t } = held();
    t.buildings = ['church', 'farm'];
    let seasons = 0, settledAt = -1;
    sure(0, () => { while (t.yoke && seasons < 40) { seasonOfYoke(c); c.turn++; seasons++; if (settledAt < 0 && t.yoke?.settled) settledAt = seasons; } });
    expect(settledAt).toBe(Math.ceil(YOKE.nation / (YOKE.ease + YOKE.church + YOKE.farm)));
    expect(t.yoke).toBeUndefined();
    expect(seasons).toBe(YOKE.memory + 1); // it is remembered as taken for five years, settled or not
    expect(t.owner).toBe(0);
    expect(c.log.join('\n')).toContain(`The people of ${t.name} now count themselves yours.`);
    expect(resentful(c, t.id)).toBe(false);
  }, LONG);

  it('a rising with no army there throws the taker off: back to the people it was taken from, or to its own tribe', () => {
    const { c, t } = held();
    sure(100, () => {
      expect(seasonOfYoke(c)).toEqual([{ at: t.id, kind: 'rose', owner: 0, to: 1 }]);
    });
    expect(t.owner).toBe(1);
    expect(t.yoke).toBeUndefined();
    expect(c.log.join('\n')).toMatch(/has risen and thrown off your rule, and gone back to the/);
    expect(c.chronicle!.some((x) => x.text.includes(t.name) && x.text.includes('rose'))).toBe(true);
    expect((c.events ?? []).some((e) => e.kind === 'revolt' && e.at === t.id)).toBe(true);
    // Taken from a tribe, it is its own again.
    const b = held(9);
    b.t.yoke!.from = -1;
    sure(100, () => seasonOfYoke(b.c));
    expect(b.t.owner).toBe(-1);
    expect(b.t.militia).toBeGreaterThanOrEqual(2);
    // Taken from a computer-led people who are no more, it goes back to them, and they live again (revival.ts).
    const d = held(11);
    d.c.factions[1].alive = false;
    sure(100, () => seasonOfYoke(d.c));
    expect(d.t.owner).toBe(1);
    expect(d.c.factions[1].alive).toBe(true);
  }, LONG);

  it('a rising with an army there is put down, at a cost, and is not forgotten', () => {
    const { c, t } = held();
    c.armies.push({ id: 90, owner: 0, at: t.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    const men = folkOf(c, t.id).men, was = resentOf(c, t.id);
    sure(100, () => expect(seasonOfYoke(c)).toEqual([{ at: t.id, kind: 'put down', owner: 0 }]));
    expect(t.owner).toBe(0);
    expect(resentOf(c, t.id)).toBe(Math.min(100, was + YOKE.putDown));
    expect(folkOf(c, t.id).men).toBe(Math.max(0, men - 1));
    expect(c.armies.find((a) => a.id === 90)!.units.infantry).toBe(2);
    expect(c.log.join('\n')).toContain('the garrison put it down');
  }, LONG);

  it('a town that has passed back to the tribes or to marauders bears no yoke', () => {
    const { c, t } = held();
    t.owner = -1;
    expect(seasonOfYoke(c)).toEqual([]);
    expect(t.yoke).toBeUndefined();
  }, LONG);
});
