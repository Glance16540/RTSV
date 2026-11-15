// Stores replace supplies (docs/DESIGN.md, "Stores"; src/sim/stores.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, SITES, answerDemand, armyAt, battleConfig, build, continueAI, endTurn, finishBattle, income, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import { KEEP, SUPPLY, SUPPLY_UNITS, draw, earn, nationWorth, settleStores, spend, stock, surplusOf, treasury } from '../src/sim/stores';
import { STORE_KINDS, Stores, folkOf, nationStores } from '../src/sim/township';

const LONG = 60_000;
const units = (s: Stores) => STORE_KINDS.reduce((n, k) => n + s[k], 0);
const turn = (c: Campaign) => {
  endTurn(c);
  for (let i = 0; i < 40 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
};
const world = (seed = 7) => { const c = newCampaign(seed, 1, 0, 'hearth'); c.truces = [{ with: 1, until: 999 }]; return { c, home: c.territories.find((t) => t.capital === 0)! }; };

describe('stores replace supplies', () => {
  it('a supply is a hundred of goods, and a new nation\'s supplies are goods in its chief town', () => {
    expect(units(SUPPLY)).toBe(SUPPLY_UNITS);
    const { c, home } = world(), had = c.factions[0].supplies;
    expect(had).toBeGreaterThan(0);
    expect(nationWorth(c, 0)).toBe(had);
    expect(surplusOf(c, home.id)).toBeGreaterThanOrEqual(had * SUPPLY_UNITS);
    expect(surplusOf(c, home.id)).toBeLessThan((had + 1) * SUPPLY_UNITS);
    expect(units(folkOf(c, home.id).stores)).toBe(KEEP + surplusOf(c, home.id));
    for (const f of c.factions) expect(f.supplies, f.name).toBe(nationWorth(c, f.id));
    settleStores(c); settleStores(c); // and saying so again changes nothing
    expect(c.factions[0].supplies).toBe(had);
  }, LONG);

  it('what is spent on the map comes out of the towns, and what is earned goes into them', () => {
    const { c, home } = world();
    c.factions[0].supplies = 20;
    settleStores(c);
    const before = units(nationStores(c, 0)), wood = folkOf(c, home.id).stores.wood;
    home.buildings = [];
    expect(build(c, 0, home.id, 'barracks')).toBe(true);
    expect(c.factions[0].supplies).toBe(20 - SITES.barracks.cost); // the price is what it was
    settleStores(c);
    expect(units(nationStores(c, 0))).toBe(before - SITES.barracks.cost * SUPPLY_UNITS);
    expect(folkOf(c, home.id).stores.wood).toBe(wood - SITES.barracks.cost * SUPPLY_UNITS); // a Barracks is paid in timber, in the town where it stands (prices.ts)
    expect(c.factions[0].supplies).toBe(20 - SITES.barracks.cost);
    // A season's income is goods in store.
    const then = units(nationStores(c, 0)), due = income(c, 0), had = c.factions[0].supplies;
    turn(c);
    expect(c.factions[0].supplies).toBeGreaterThanOrEqual(had + due - 4); // (a season may also bring a loss: acts of God, raiders)
    // The figure is whole supplies, and a town eats food that is not (larder.ts): the goods and the figure agree to within a supply.
    const moved = units(nationStores(c, 0)) - then, said = (c.factions[0].supplies - had) * SUPPLY_UNITS;
    expect(moved).toBeGreaterThan(said - SUPPLY_UNITS);
    expect(moved).toBeLessThan(said + SUPPLY_UNITS);
    expect(c.factions[0].supplies).toBe(nationWorth(c, 0));
  }, LONG);

  it('earnings are shared among a nation\'s towns, and spending is drawn from those with most to give', () => {
    const { c, home } = world();
    const [a, b] = c.territories.filter((t) => t.owner < 0 && !t.horde).slice(0, 2);
    a.owner = b.owner = 0;
    settleStores(c);
    const was = [home, a, b].map((t) => surplusOf(c, t.id));
    earn(c, 0, 900);
    expect([home, a, b].map((t, i) => surplusOf(c, t.id) - was[i])).toEqual([300, 300, 300]);
    stock(c, a.id, 1000); // one town is rich
    const rich = surplusOf(c, a.id), poor = surplusOf(c, b.id);
    expect(spend(c, 0, 500)).toBe(500);
    expect(rich - surplusOf(c, a.id)).toBeGreaterThan(poor - surplusOf(c, b.id));
    for (const t of [home, a, b]) for (const k of STORE_KINDS) expect(folkOf(c, t.id).stores[k]).toBeGreaterThanOrEqual(0);
  }, LONG);

  it('goods go in and come out by kind, and nothing is taken that is not there', () => {
    const { c, home } = world(), s = folkOf(c, home.id).stores;
    Object.assign(s, { food: 0, wood: 0, gold: 0, stone: 0 });
    stock(c, home.id, 200);
    expect(s).toEqual({ food: 80, wood: 60, gold: 30, stone: 30 });
    expect(draw(c, home.id, 100)).toBe(100);
    expect(units(s)).toBe(100);
    expect(s.food).toBeGreaterThan(s.gold); // each kind in the share the town has it
    expect(draw(c, home.id, 5000)).toBe(100);
    expect(s).toEqual({ food: 0, wood: 0, gold: 0, stone: 0 });
    expect(draw(c, home.id, 10)).toBe(0);
  }, LONG);

  it('a town that gathers in a battle makes its nation richer, and one run down in a siege makes it poorer', () => {
    const fought = (stores: Stores): { before: number; after: number } => {
      const { c, home } = world();
      c.truces = [];
      c.factions[0].supplies = 10;
      settleStores(c);
      c.armies.push({ id: 99, owner: 1, at: home.adj[0], units: { infantry: 1 }, hero: false, vet: 0, moved: false });
      c.territories[home.adj[0]].owner = 1;
      expect(moveArmy(c, 99, home.id)).toBe('battle');
      c.pending!.mode = 'siege';
      const before = c.factions[0].supplies;
      expect(units(battleConfig(c)!.setups[0].bonus!.stores as Stores)).toBe(units(folkOf(c, home.id).stores)); // it fights out of all it holds
      const f = folkOf(c, home.id);
      finishBattle(c, true, { clubman: 2 }, { folk: { men: f.men, women: f.women, elders: f.elders, children: f.children, stores, taken: 0, named: [] } });
      return { before, after: c.factions[0].supplies };
    };
    const rich = fought({ food: 2000, wood: 1500, gold: 500, stone: 600 }); // 4600 in store: 40 supplies' worth above its keep
    expect(rich.after).toBe(Math.floor((4600 - KEEP) / SUPPLY_UNITS));
    expect(rich.after).toBeGreaterThan(rich.before);
    const spent = fought({ food: 300, wood: 200, gold: 100, stone: 100 }); // 700: it burned through nearly all it had
    expect(spent.after).toBe(1);
    expect(spent.after).toBeLessThan(spent.before);
  }, LONG);

  it('a town run below its working stock is made good before there is anything to spend', () => {
    const { c, home } = world();
    Object.assign(folkOf(c, home.id).stores, { food: 100, wood: 50, gold: 0, stone: 0 }); // sacked nearly bare
    settleStores(c);
    expect(c.factions[0].supplies).toBe(0);
    expect(treasury(c, 0)).toMatchObject({ spare: 0, short: KEEP - 150 });
    c.factions[0].supplies += 3; // a season's income
    settleStores(c);
    expect(c.factions[0].supplies).toBe(0); // it has gone to refill the town
    expect(treasury(c, 0).short).toBe(KEEP - 150 - 300);
    c.factions[0].supplies += 5;
    settleStores(c);
    expect(c.factions[0].supplies).toBe(3);
    expect(treasury(c, 0)).toMatchObject({ short: 0 });
  }, LONG);

  it('a town lost takes what was in it, and whoever takes it has it', () => {
    const { c, home } = world();
    c.truces = [];
    const prize = c.territories.find((t) => t.owner === 1 && t.capital < 0) ?? c.territories.find((t) => t.owner === 1)!;
    stock(c, prize.id, 3000);
    settleStores(c);
    const theirs = c.factions[1].supplies, mine = c.factions[0].supplies, held = surplusOf(c, prize.id);
    const a = armyAt(c, home.id)!;
    a.units = { cavalry: 12 }; a.at = prize.adj[0]; a.moved = false;
    c.territories[prize.adj[0]].owner = 0;
    settleStores(c);
    const base = c.factions[0].supplies;
    expect(moveArmy(c, a.id, prize.id)).toBe('battle');
    finishBattle(c, true, { rider: 24 }, { folk: { ...folkOf(c, prize.id), taken: 0, named: [] } });
    expect(prize.owner).toBe(0);
    expect(c.factions[0].supplies).toBeGreaterThanOrEqual(base + Math.floor(held / SUPPLY_UNITS));
    expect(c.factions[1].supplies).toBeLessThanOrEqual(theirs - Math.floor(held / SUPPLY_UNITS) + 1);
    expect(mine).toBeGreaterThanOrEqual(0);
  }, LONG);

  it('a campaign played by the computer: every nation\'s figure is its towns\' at the start of each season, and no store runs below nothing', () => {
    const c = newCampaign(11, 2, 1, 'hearth');
    for (let i = 0; i < 25 && c.phase !== 'over'; i++) {
      turn(c);
      for (const f of c.factions) if (f.alive && c.territories.some((t) => t.owner === f.id && !t.horde)) expect(f.supplies, `turn ${c.turn} ${f.name}`).toBe(nationWorth(c, f.id));
      for (const t of c.territories) if (t.folk) for (const k of STORE_KINDS) expect(t.folk.stores[k], `${t.name} ${k}`).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
});
