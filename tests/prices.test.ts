// Prices by kind (src/sim/prices.ts, docs/DESIGN.md "Stores").
import { describe, expect, it } from 'vitest';
import { COMPANIES, SITES, advanceAge, ageCost, build, companyCost, hireOff, newCampaign, raise } from '../src/sim/campaign';
import { CARRY, MADE_OF, SHORT_RATE, canPayFor, fundFor, payBar, payFor, priceOf, priceText } from '../src/sim/prices';
import { SUPPLY_UNITS, settleStores } from '../src/sim/stores';
import { STORE_KINDS, folkOf, nationStores } from '../src/sim/township';
import type { Stores } from '../src/sim/township';

const units = (s: Stores) => STORE_KINDS.reduce((n, k) => n + s[k], 0);
const world = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const land = c.territories.find((t) => t.owner < 0 && home.adj.includes(t.id))!;
  land.owner = 0;
  settleStores(c);
  return { c, home, land };
};

describe('prices by kind', () => {
  it('a price is the old number of supplies, a hundred of goods each, in what the thing is made of', () => {
    for (const [what, n] of [['barracks', 5], ['fortress', 9], ['company', 2], ['church', 5], ['age', 10], ['dealing', 3]] as const) {
      const p = priceOf(what, n);
      expect(units(p), what).toBe(n * SUPPLY_UNITS);
      for (const k of STORE_KINDS) if (!MADE_OF[what][k]) expect(p[k], `${what} ${k}`).toBe(0);
    }
    expect(priceOf('barracks', 5)).toEqual({ food: 0, wood: 500, gold: 0, stone: 0 });
    expect(priceOf('fortress', 9)).toEqual({ food: 0, wood: 0, gold: 0, stone: 900 });
    expect(priceOf('company', 2)).toEqual({ food: 60, wood: 40, gold: 100, stone: 0 });
    expect(priceText(priceOf('church', 5))).toBe('200 gold, 300 stone');
  });

  it('a Barracks is paid in timber from the town where it is raised, and what it lacks is sent by road from another, at a cost', () => {
    const { c, home, land } = world();
    fundFor(c, 0, 'dealing', 10); // ten supplies, all in gold
    land.buildings = [];
    expect(c.factions[0].supplies).toBe(10);
    folkOf(c, land.id).stores.wood += 300;
    folkOf(c, home.id).stores.wood += 400;
    settleStores(c);
    const homeWood = folkOf(c, home.id).stores.wood, gold = nationStores(c, 0).gold;
    const lack = SITES.barracks.cost * SUPPLY_UNITS - (150 + 300);
    expect(build(c, 0, land.id, 'barracks')).toBe(true);
    expect(folkOf(c, land.id).stores.wood).toBe(0); // all the land's own timber first
    expect(folkOf(c, home.id).stores.wood).toBe(homeWood - Math.ceil(lack * (1 + CARRY.cost))); // the rest by road, and the road's cost
    expect(nationStores(c, 0).gold).toBe(gold); // and nothing else
  });

  it('what a town lacks of a kind is made up in its other goods, traded at a loss', () => {
    const { c, land } = world();
    fundFor(c, 0, 'dealing', 10, { at: land.id }); // ten supplies above the working stocks, all in gold, in the land
    for (const t of c.territories) if (t.owner === 0) folkOf(c, t.id).stores.wood = 0; // and no timber anywhere
    settleStores(c);
    land.buildings = [];
    const all = units(nationStores(c, 0));
    expect(build(c, 0, land.id, 'barracks')).toBe(true);
    expect(units(nationStores(c, 0))).toBe(all - Math.ceil(SITES.barracks.cost * SUPPLY_UNITS * SHORT_RATE)); // dearer than at par
    expect(SHORT_RATE).toBeGreaterThan(1);
  });

  it('what the paying town and the towns with a road to it cannot find or make up must wait, and nothing is taken', () => {
    const { c, home, land } = world();
    land.buildings = [];
    for (const t of c.territories) if (t.owner === 0) folkOf(c, t.id).stores = { food: 100, wood: 0, gold: 0, stone: 0 };
    // The nation's wealth is in a town with no road to the land.
    const far = c.territories.find((t) => t.owner < 0 && !t.adj.some((n) => c.territories[n].owner === 0))!;
    far.owner = 0;
    folkOf(c, far.id).stores = { food: 2000, wood: 3000, gold: 2000, stone: 2000 };
    settleStores(c);
    const all = units(nationStores(c, 0));
    expect(c.factions[0].supplies).toBeGreaterThanOrEqual(SITES.barracks.cost);
    expect(payBar(c, 0, 'barracks', SITES.barracks.cost, { at: land.id })).toMatch(/lacks \d+ wood.*must wait/);
    expect(build(c, 0, land.id, 'barracks')).toBe(false);
    expect(units(nationStores(c, 0))).toBe(all);
    // A town with a road to it sends timber, keeping a floor of its own.
    folkOf(c, home.id).stores = { food: 2000, wood: 2000, gold: 500, stone: 500 };
    settleStores(c);
    expect(canPayFor(c, 0, 'barracks', SITES.barracks.cost, { at: land.id })).toBe(true);
  });

  it('a company is paid in food and gold; a new age in all four; a fortress in stone', () => {
    const { c, home } = world();
    fundFor(c, 0, 'company', 4);
    const food = nationStores(c, 0).food, gold = nationStores(c, 0).gold, cost = companyCost(home, 'infantry', 'hearth', hireOff(c, 0, home.id));
    expect(raise(c, 0, home.id, 'infantry')).toBe(true);
    expect(nationStores(c, 0).food).toBe(food - priceOf('company', cost).food);
    expect(nationStores(c, 0).gold).toBe(gold - priceOf('company', cost).gold);
    expect(COMPANIES.infantry.cost).toBe(cost + hireOff(c, 0, home.id));

    const a = world();
    fundFor(a.c, 0, 'age', ageCost(a.c, 0));
    const before = nationStores(a.c, 0);
    expect(advanceAge(a.c, 0)).toBe(true);
    const after = nationStores(a.c, 0);
    for (const k of STORE_KINDS) expect(before[k] - after[k], k).toBeGreaterThan(0); // something of every store

    const f = world();
    f.home.buildings = ['barracks', 'farm'];
    fundFor(f.c, 0, 'fortress', 9);
    const stone = nationStores(f.c, 0).stone, fed = nationStores(f.c, 0).food;
    expect(build(f.c, 0, f.home.id, 'fortress')).toBe(true);
    expect(nationStores(f.c, 0).stone).toBe(stone - 900);
    expect(nationStores(f.c, 0).food).toBe(fed);
    expect(f.c.factions[0].supplies).toBe(0);
  });

  it('nothing is taken unless all of it can be paid, and the figure is the towns\' after', () => {
    const { c } = world();
    fundFor(c, 0, 'dealing', 3);
    const had = units(nationStores(c, 0));
    expect(payFor(c, 0, 'dealing', 4)).toBe(false);
    expect(units(nationStores(c, 0))).toBe(had);
    expect(payFor(c, 0, 'dealing', 3)).toBe(true);
    expect(units(nationStores(c, 0))).toBe(had - 300);
    expect(c.factions[0].supplies).toBe(0);
  });
});
