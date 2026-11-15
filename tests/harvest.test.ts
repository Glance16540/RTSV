// Income credited to the land that yields it (src/sim/harvest.ts, docs/DESIGN.md "Stores").
import { describe, expect, it } from 'vitest';
import { landIncome, newCampaign, wholeIncome, income } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { MIX, harvest, putIn, spread, yieldShares } from '../src/sim/harvest';
import { SUPPLY_UNITS, settleStores } from '../src/sim/stores';
import { MAX_STORE, STORE_KINDS, folkOf } from '../src/sim/township';
import type { Stores } from '../src/sim/township';

const units = (s: Stores) => STORE_KINDS.reduce((n, k) => n + s[k], 0);
const world = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  for (const id of home.adj) if (c.territories[id].owner < 0) c.territories[id].owner = 0;
  settleStores(c);
  return { c, home, lands: c.territories.filter((t) => t.owner === 0 && t.id !== home.id) };
};
const reap = (c: Campaign) => harvest(c, (f, t) => landIncome(c, f, t), (f) => wholeIncome(c, f));

describe('income goes into the land that yields it', () => {
  it('each land\'s yield goes into its own town, and what the people earns as a whole into its chief town', () => {
    const { c, home, lands } = world();
    const before = new Map(c.territories.map((t) => [t.id, units(folkOf(c, t.id).stores)]));
    const had = c.factions[0].supplies, due = income(c, 0);
    const got = reap(c);
    for (const t of lands) expect(units(folkOf(c, t.id).stores) - before.get(t.id)!, t.name).toBe(landIncome(c, 0, t) * SUPPLY_UNITS);
    expect(units(folkOf(c, home.id).stores) - before.get(home.id)!).toBe((landIncome(c, 0, home) + wholeIncome(c, 0)) * SUPPLY_UNITS);
    expect(got[0].goods).toBe(due * SUPPLY_UNITS);
    expect(c.factions[0].supplies).toBe(had + due); // and the figure on the map is the towns' after
    // Nobody else's towns gain a thing.
    for (const t of c.territories) if (t.owner !== 0 && t.owner !== 1) expect(units(folkOf(c, t.id).stores)).toBe(before.get(t.id));
  });

  it('a land leans to what it is: farmland to food, gold hills to gold', () => {
    const { c, home, lands } = world();
    const share = (tid: number, k: keyof Stores) => { const s = yieldShares(c, tid); return s[k] / units(s); };
    expect(home.buildings).toContain('farm');
    expect(share(home.id, 'food')).toBeGreaterThan(MIX.food);
    const t = lands[0];
    t.buildings = []; t.trait = 'gold';
    expect(share(t.id, 'gold')).toBeGreaterThan(0.3);
    const g = spread(1000, yieldShares(c, t.id));
    expect(units(g)).toBe(1000);
    expect(g.gold).toBeGreaterThan(g.food);
  });

  it('a full store loses what will not fit', () => {
    const { c, home } = world();
    const s = folkOf(c, home.id).stores;
    for (const k of STORE_KINDS) s[k] = MAX_STORE - 10;
    expect(putIn(c, home.id, { food: 100, wood: 5, gold: 0, stone: 30 })).toBe(90 + 20);
    for (const k of STORE_KINDS) expect(s[k]).toBeLessThanOrEqual(MAX_STORE);
  });
});
