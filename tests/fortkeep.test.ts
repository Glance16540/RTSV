// A Fortress keeps a garrison of the town's own men, and is a stronghold when a band strikes (src/sim/fortkeep.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { KEEP, isStronghold, keepMen, keepOf, keepUnits } from '../src/sim/fortkeep';
import { raidClash } from '../src/sim/raidclash';
import { defenceOf, strike } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';
import { TOWN_SCALE as S, folkOf, headcount } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign with one town of the player's, not the capital, with no army in it and nothing built: `men` grown men. */
const world = (men = 12 * S, seed = 5): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10; c.bands = []; c.armies = [];
  const t = c.territories.find((x) => x.owner === 0)!;
  t.capital = -1; t.buildings = []; delete t.town;
  Object.assign(folkOf(c, t.id), { men, women: 12 * S, elders: 0, children: 4 * S }); delete folkOf(c, t.id).ages;
  return { c, at: t.id };
};
const fort = (c: Campaign, at: number): void => { c.territories[at].buildings.push('fortress'); };
const band = (c: Campaign, at: number, strength: number): Band => { const b = { id: 7, kind: 'raiders', name: 'the Grey Band', at, strength, since: 1, held: [] } as Band; c.bands = [b]; return b; };

describe('a Fortress keeps a garrison of the town\'s own men', () => {
  it('none without a Fortress; with one, as many companies as the town can spare men for, never more than the most', () => {
    const { c, at } = world();
    expect(keepOf(c, at)).toBe(0);
    expect(isStronghold(c, at)).toBe(false);
    fort(c, at);
    expect(keepOf(c, at)).toBe(KEEP.companies);
    expect(keepUnits(c, at)).toEqual({ infantry: KEEP.companies });
    expect(keepMen(c, at)).toBeGreaterThan(0);
    expect(isStronghold(c, at)).toBe(true);
  });
  it('a town with few men spares fewer, and one with none to spare has an empty Fortress that is no stronghold', () => {
    const one = world(KEEP.atHome * S + 1);
    fort(one.c, one.at);
    expect(keepOf(one.c, one.at)).toBe(1);
    const none = world(KEEP.atHome * S);
    fort(none.c, none.at);
    expect(keepOf(none.c, none.at)).toBe(0);
    expect(keepUnits(none.c, none.at)).toEqual({});
    expect(isStronghold(none.c, none.at)).toBe(false);
    expect(defenceOf(none.c, none.at).stronghold).toBeUndefined();
  });
  it('nobody is conjured and nobody leaves: the town\'s people are as they were, and the garrison\'s men are not counted twice', () => {
    const plain = world(), kept = world();
    fort(kept.c, kept.at);
    const before = headcount(folkOf(kept.c, kept.at));
    const d = defenceOf(kept.c, kept.at), was = defenceOf(plain.c, plain.at);
    expect(headcount(folkOf(kept.c, kept.at))).toBe(before);
    expect(kept.c.armies.length).toBe(0); // no army is made of them
    expect(d.army).toBe(KEEP.companies); // each company a company of foot
    expect(was.army).toBe(0);
    expect(d.men).toBeLessThan(was.men); // the townsmen's part is reckoned without them
    expect(d.stronghold).toBe(true);
  });
  it('where an army of its people stands in the town, the army is the garrison: the Fortress adds no companies of its own, and is a stronghold', () => {
    const { c, at } = world();
    fort(c, at);
    c.armies.push({ id: 900, owner: 0, at, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    const d = defenceOf(c, at);
    expect(d.army).toBeGreaterThanOrEqual(3);
    expect(d.army).toBeLessThan(3 + KEEP.companies); // not the army and the garrison both
    expect(d.stronghold).toBe(true);
    const few = world(KEEP.atHome * S); // no men to spare, but an army holds it
    fort(few.c, few.at);
    few.c.armies.push({ id: 900, owner: 0, at: few.at, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(isStronghold(few.c, few.at)).toBe(true);
  });
  it('a land of nobody\'s, or the marauders\', keeps no garrison', () => {
    const { c, at } = world();
    fort(c, at);
    c.territories[at].horde = true;
    expect(keepOf(c, at)).toBe(0);
    c.territories[at].horde = false; c.territories[at].owner = -1;
    expect(keepOf(c, at)).toBe(0);
    expect(isStronghold(c, at)).toBe(false);
  });
});

describe('a stronghold is raided and never taken', () => {
  it('the same fight that takes an open town only raids a stronghold', () => {
    const stand = { men: 0.5, works: 0, walls: 0, army: 0, guard: 0, spirit: 1, total: 0.5 };
    const open = raidClash(9, 9, stand, {}, 0, 0.5, 0.5, { bands: 1, worth: 0.5 });
    expect(open.outcome).toBe('taken');
    const held = raidClash(9, 9, { ...stand, stronghold: true }, {}, 0, 0.5, 0.5, { bands: 1, worth: 0.5 });
    expect(held.outcome).toBe('raided');
    expect(held.rounds).toBe(open.rounds); // the fight itself is the same fight
    expect(held.cost).toBe(open.cost);
  });
  it('over many strikes by strong bands, nobody is carried off from a town whose Fortress is held, and people are from one without', () => {
    const carried = (withFort: boolean): { taken: number; outcomes: Set<string> } => {
      let taken = 0; const outcomes = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) for (const strength of [8, 10]) {
        const { c, at } = world(12 * S, seed);
        if (withFort) fort(c, at);
        const r = strike(c, band(c, at, strength), at, []);
        outcomes.add(r.outcome);
        taken += r.taken.men + r.taken.women;
      }
      return { taken, outcomes };
    };
    const open = carried(false), held = carried(true);
    expect(open.outcomes.has('taken')).toBe(true);
    expect(open.taken).toBeGreaterThan(0);
    expect(held.outcomes.has('taken')).toBe(false);
    expect(held.taken).toBe(0);
  });
  it('a town with a held Fortress holds off bands that an empty one does not', () => {
    const heldOff = (men: number): number => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) { const { c, at } = world(men, seed); fort(c, at); if (strike(c, band(c, at, 5), at, []).outcome === 'held') n++; }
      return n;
    };
    expect(heldOff(12 * S)).toBeGreaterThan(heldOff(KEEP.atHome * S));
  });
});
