// Income credited to the land that yields it (src/sim/harvest.ts, docs/DESIGN.md "Stores").
import { describe, expect, it } from 'vitest';
import { landIncome, newCampaign, wholeIncome, income } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { HANDS_FULL, handsShare, harvest, putIn, spread, yieldShares } from '../src/sim/harvest';
import { GOVERN, keepOrders, shareOf } from '../src/sim/governor';
import { KEEP_SEASONS, needOf } from '../src/sim/larder';
import { SUPPLY_UNITS, settleStores } from '../src/sim/stores';
import { MAX_STORE, STORE_KINDS, folkOf } from '../src/sim/township';
import type { Stores } from '../src/sim/township';
import { worldsBeforeEmptyBeside } from './helpers';

worldsBeforeEmptyBeside(); // written before every people had an empty land beside its chief town: the worlds these tests were written with

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
    // Every town with the hands to work its land in full, so that it yields all the land gives.
    for (const t of [home, ...lands]) { const f = folkOf(c, t.id); f.men = Math.max(f.men, HANDS_FULL); delete f.ages; }
    const had = c.factions[0].supplies, due = income(c, 0);
    const got = reap(c);
    for (const t of lands) expect(units(folkOf(c, t.id).stores) - before.get(t.id)!, t.name).toBe(landIncome(c, 0, t) * SUPPLY_UNITS);
    expect(units(folkOf(c, home.id).stores) - before.get(home.id)!).toBe((landIncome(c, 0, home) + wholeIncome(c, 0)) * SUPPLY_UNITS);
    expect(got[0].goods).toBe(due * SUPPLY_UNITS);
    expect(c.factions[0].supplies).toBe(had + due); // and the figure on the map is the towns' after
    // Nobody else's towns gain a thing.
    for (const t of c.territories) if (t.owner !== 0 && t.owner !== 1) expect(units(folkOf(c, t.id).stores)).toBe(before.get(t.id));
  });

  it('a town with fewer hands than its land wants brings in that much less, and one with none brings in nothing', () => {
    const { c, lands } = world();
    const t = lands[0], f = folkOf(c, t.id);
    f.men = 1; f.women = 2; delete f.ages;
    expect(handsShare(c, t.id)).toBeCloseTo(3 / HANDS_FULL, 5);
    const was = units(f.stores);
    reap(c);
    expect(units(f.stores) - was).toBe(Math.round(landIncome(c, 0, t) * SUPPLY_UNITS * 3 / HANDS_FULL));
    f.men = 0; f.women = 0;
    const now = units(f.stores);
    reap(c);
    expect(units(f.stores)).toBe(now);
  });

  it('a land leans to what it is and to where its people work: farmland to food, gold hills to gold', () => {
    const { c, home, lands } = world();
    const share = (tid: number, k: keyof Stores) => { const s = yieldShares(c, tid); return s[k] / units(s); };
    const t = lands[0];
    t.buildings = []; t.trait = '';
    const plain = { food: share(t.id, 'food'), gold: share(t.id, 'gold') };
    expect(home.buildings).toContain('farm');
    t.buildings = ['farm'];
    expect(share(t.id, 'food')).toBeGreaterThan(plain.food);
    t.buildings = []; t.trait = 'gold';
    expect(share(t.id, 'gold')).toBeGreaterThan(plain.gold * 2.5);
    // Set to dig, its people bring in gold above all.
    keepOrders(c, t.id, { work: { food: 0, wood: 0, gold: 10, stone: 0 } });
    expect(share(t.id, 'gold')).toBe(1);
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

  it('with a full granary and no orders, the governor sends half his field hands to work that keeps', () => {
    const { c, lands } = world();
    const t = lands[0], f = folkOf(c, t.id);
    f.men = 6; f.women = 6; f.elders = 0; f.children = 0; delete f.ages; delete t.orders;
    f.stores.food = 0;
    const lean = shareOf(c, t.id).share.food; // short of food: to the fields
    f.stores.food = KEEP_SEASONS * needOf(c, t.id) + 1;
    const full = shareOf(c, t.id).share;
    expect(full.food).toBeCloseTo(GOVERN.work.food * GOVERN.full, 5);
    expect(full.food).toBeLessThan(lean);
    expect(full.food + full.wood + full.gold + full.stone).toBeCloseTo(1, 5);
    // The player's own orders are never overridden.
    keepOrders(c, t.id, { work: { food: 9, wood: 1, gold: 0, stone: 0 } });
    expect(shareOf(c, t.id).share.food).toBeCloseTo(0.9, 5);
  });
});
