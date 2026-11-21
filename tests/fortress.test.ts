// The Fortress as a stronghold: a real building in the town, and shelter for its people against a band (src/sim/fortress.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { BUILDINGS } from '../src/sim/data';
import { FORT, fortShelter, hasFortress } from '../src/sim/fortress';
import { Game } from '../src/sim/game';
import { walled } from '../src/sim/sieges';
import { Band, defenceOf, strike } from '../src/sim/threats';
import { THREATS } from '../src/sim/threatsbase';
import { folkOf } from '../src/sim/township';
import { beginVisit, visitConfig } from '../src/sim/visit';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign with one town of the player's, far from any army, with plenty of people and no works. */
const world = (seed = 5): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0)!;
  c.armies = c.armies.filter((a) => a.at !== t.id);
  t.buildings = []; t.capital = -1; delete t.town;
  Object.assign(folkOf(c, t.id), { men: 20, women: 20, elders: 0, children: 6 }); delete folkOf(c, t.id).ages;
  return { c, at: t.id };
};
const band = (kind: Band['kind'], at: number, strength: number): Band => ({ id: 900, kind, name: 'the Test Men', at, strength, since: 1, held: [] });

describe('a Fortress', () => {
  it('is the land\'s own work, or one standing finished in the town', () => {
    const { c, at } = world(), t = c.territories[at];
    expect(hasFortress(c, at)).toBe(false);
    expect(fortShelter(c, at)).toBe(1);
    const bare = defenceOf(c, at).works;
    t.buildings = ['fortress'];
    expect(hasFortress(c, at)).toBe(true);
    expect(defenceOf(c, at).works).toBe(bare + THREATS.fortress);
    t.buildings = [];
    t.town = { at: 2, b: [['towncenter', 40, 40], ['fortress', 46, 40]] }; // built in the town by its people
    expect(hasFortress(c, at)).toBe(true);
    expect(defenceOf(c, at).works).toBe(bare + THREATS.fortress);
    expect(walled(c, at)).toBe(true);
    t.town = { at: 2, b: [['towncenter', 40, 40], ['fortress', 46, 40, 0.01, 0.5]] }; // begun, never finished
    expect(hasFortress(c, at)).toBe(false);
  });
  it('shelters its people when a band strikes: half as many die, half as many are carried off', () => {
    const toll = (fort: boolean, kind: Band['kind']): { killed: number; taken: number; outcome: string } => {
      const sum = { killed: 0, taken: 0, outcome: '' };
      for (let seed = 1; seed <= 12; seed++) {
        const { c, at } = world(seed);
        // The town is given the same defence either way (a Fortress would add three companies), so that only the shelter differs.
        // An EMPTY Fortress: the town has no men to spare for its garrison (fortkeep.ts KEEP.atHome), so it is walls and a refuge and no stronghold.
        // (With men to spare it keeps a garrison and is never taken at all: tests/fortkeep.test.ts.)
        if (fort) { c.territories[at].town = { at: 2, b: [['towncenter', 40, 40], ['fortress', 46, 40]] }; Object.assign(folkOf(c, at), { men: 8 }); }
        const d = defenceOf(c, at).total, b = band(kind, at, Math.ceil(d * 4));
        c.bands = [b];
        const r = strike(c, b, at, []);
        sum.killed += r.killed; sum.taken += r.taken.men + r.taken.women; sum.outcome = r.outcome;
      }
      return sum;
    };
    const open = toll(false, 'slavers'), kept = toll(true, 'slavers');
    expect(open.outcome).toBe('taken');
    expect(kept.outcome).toBe('taken');
    expect(open.killed).toBeGreaterThan(0);
    expect(kept.killed).toBeLessThanOrEqual(Math.ceil(open.killed * FORT.shelter) + 12);
    expect(kept.killed).toBeLessThan(open.killed);
    expect(kept.taken).toBeLessThan(open.taken * 0.7);
    expect(kept.taken).toBeGreaterThan(0);
  });
  it('stands in the town, beside its towers, where the land has one; and takes people in', () => {
    const d = BUILDINGS.fortress;
    expect(d.shelter).toBe(12);
    expect(d.atk).toBeUndefined(); // the towers do the shooting
    const c: Campaign = JSON.parse(base);
    c.turn = 10; c.phase = 'player';
    const t = c.territories.find((x) => x.owner === 0 && x.capital === 0)!;
    t.buildings = [...new Set([...t.buildings, 'fortress'])];
    expect(beginVisit(c, t.id)).toBe(true);
    const cfg = visitConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const mine = g.buildings.filter((b) => b.owner === 0 && b.complete);
    expect(mine.filter((b) => b.type === 'fortress')).toHaveLength(1);
    expect(mine.filter((b) => b.type === 'tower').length).toBeGreaterThanOrEqual(2);
    const fort = mine.find((b) => b.type === 'fortress')!;
    const people = g.units.filter((u) => u.owner === 0 && u.type === 'villager').slice(0, 5);
    expect(g.cmdShelter(0, people.map((u) => u.id), fort.id)).toBe(people.length);
  });
});
