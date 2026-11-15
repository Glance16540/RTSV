// A town left to itself (docs/DESIGN.md; src/sim/governor.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, finishBattle, moveArmy, newCampaign, siteCost } from '../src/sim/campaign';
import { BUILDINGS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { GOVERN, cleanOrders, governTown, governTowns, keepOrders, ordersText, plotFor, wantsOf, workOf } from '../src/sim/governor';
import { housesOf } from '../src/sim/seasonfolk';
import { STORE_KINDS, Stores, folkOf, headcount } from '../src/sim/township';
import { setups } from './helpers';

const LONG = 60_000;
const units = (s: Stores) => STORE_KINDS.reduce((n, k) => n + s[k], 0);
/** A plain town of the player's: six men, six women, two children, well stocked, nothing built. */
const town = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner < 0 && !x.horde && x.capital < 0)!;
  t.owner = 0; t.buildings = []; c.places = []; delete t.town;
  const f = folkOf(c, t.id);
  Object.assign(f, { men: 6, women: 6, elders: 0, children: 2 }); delete f.ages;
  f.stores = { food: 1000, wood: 1000, gold: 500, stone: 500 };
  return { c, t, f };
};

describe('a town carries on with its last orders', () => {
  it('orders are kept as they were left, and nonsense is not', () => {
    const { c, t } = town();
    expect(t.orders).toBeUndefined();
    expect(keepOrders(c, t.id, { work: { food: 2, wood: 6, gold: 0, stone: 0 }, build: ['house', 'nosuchthing', 'house'], train: ['clubman'] })).toEqual({ work: { food: 2, wood: 6, gold: 0, stone: 0 }, build: ['house'], train: ['clubman'], turn: c.turn });
    expect(workOf(t)).toEqual({ food: 0.25, wood: 0.75, gold: 0, stone: 0 });
    expect(ordersText(t)).toContain('By your last orders its people work: 75% wood, 25% food.');
    expect(cleanOrders(null, 1)).toBeUndefined();
    expect(cleanOrders({ work: { food: 0, wood: 0, gold: 0, stone: 0 } }, 1)).toBeUndefined(); // nobody was at work: nothing to carry on with
    expect(cleanOrders({ work: { food: -5, wood: 1e9, gold: NaN, stone: 1 } as Stores }, 3)).toEqual({ work: { food: 0, wood: 200, gold: 0, stone: 1 }, turn: 3 });
    keepOrders(c, t.id, null); // a battle that sends none home leaves the old ones standing
    expect(t.orders!.train).toEqual(['clubman']);
    // A town never given any is kept by a governor, who sets most to the fields.
    const b = town(9);
    expect(workOf(b.t)).toEqual(GOVERN.work);
    expect(ordersText(b.t)).toContain('A governor keeps it');
  }, LONG);

  it('a battle counts who was at what work, what stood half built and what was being trained', () => {
    const g = new Game(7, setups);
    const mine = g.units.filter((u) => u.owner === 0 && u.type === 'villager');
    const tree = g.resources.find((r) => r.type === 'tree')!;
    g.cmdTarget(0, mine.slice(0, 3).map((u) => u.id), tree.id);
    const tc = g.buildings.find((b) => b.owner === 0)!;
    g.spawnBuilding('house', 0, tc.cx + 6, tc.cy, false);
    const o = g.orders(0);
    expect(o.work).toEqual({ food: 0, wood: 3, gold: 0, stone: 0 });
    expect(o.build).toEqual(['house']);
    expect(o.train).toEqual([]);
    expect(g.orders(1).work.wood).toBe(0);
  }, LONG);

  it('a battle defended in person leaves its orders on the town', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), home = c.territories.find((x) => x.capital === 0)!;
    c.armies.push({ id: 99, owner: 1, at: home.adj[0], units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    c.territories[home.adj[0]].owner = 1;
    expect(moveArmy(c, 99, home.id)).toBe('battle');
    c.pending!.mode = 'siege';
    finishBattle(c, true, { clubman: 2 }, { orders: { work: { food: 1, wood: 0, gold: 3, stone: 0 }, build: [], train: [] } });
    expect(home.orders).toEqual({ work: { food: 1, wood: 0, gold: 3, stone: 0 }, turn: c.turn });
  }, LONG);

  it('season by season its people work where they were set, and eat', () => {
    const { c, t, f } = town();
    keepOrders(c, t.id, { work: { food: 6, wood: 6, gold: 0, stone: 0 } });
    const was = { ...f.stores };
    const g = governTown(c, t.id)!;
    expect(g.brought).toEqual({ food: 12 * 0.5 * GOVERN.yield.food, wood: 12 * 0.5 * GOVERN.yield.wood, gold: 0, stone: 0 });
    expect(g.ate).toBe(headcount(f) * GOVERN.eat);
    expect(f.stores.food).toBe(was.food + g.brought.food - g.ate);
    expect(f.stores.wood).toBe(was.wood + g.brought.wood);
    expect(f.stores.gold).toBe(was.gold);
    // Farmland makes the fields yield half as much again.
    t.buildings = ['farm'];
    expect(governTown(c, t.id)!.brought.food).toBe(Math.round(12 * 0.5 * GOVERN.yield.food * 1.5));
    // Set to no field work at all, the town eats its stores down.
    keepOrders(c, t.id, { work: { food: 0, wood: 0, gold: 12, stone: 0 } });
    t.buildings = [];
    const food = f.stores.food;
    governTown(c, t.id);
    expect(f.stores.food).toBe(food - headcount(f) * GOVERN.eat);
  }, LONG);
});

describe('a governor fills the gaps', () => {
  it('food short: hands are sent to the fields whatever the orders, and Farmland is raised out of the town\'s own stores', () => {
    const { c, t, f } = town();
    keepOrders(c, t.id, { work: { food: 0, wood: 12, gold: 0, stone: 0 } });
    f.stores.food = 20;
    expect(wantsOf(c, t.id)).toEqual({ food: true, roof: false, wall: false });
    const goods = units(f.stores), had = c.factions[0].supplies;
    const g = governTown(c, t.id)!;
    expect(g.fields).toBe(true);
    expect(g.brought.food).toBe(Math.round(12 * GOVERN.fields * GOVERN.yield.food));
    expect(g.began).toBe('farm');
    expect(t.buildings).toEqual(['farm']);
    expect(units(f.stores)).toBe(goods + units(g.brought) - g.ate - siteCost(t, 'farm', 'hearth') * 100);
    expect(c.factions[0].supplies).toBe(had); // it is the town's own goods he spends, not an order on the nation
    expect(c.log.join('\n')).toContain(`The governor of ${t.name} has raised Farmland`);
    expect(t.orders!.work).toEqual({ food: 0, wood: 12, gold: 0, stone: 0 }); // the orders stand; he only answers the want
    expect(governTown(c, t.id)!.began).toBeUndefined(); // one farm is all there is to raise
  }, LONG);

  it('he does not spend a town below what it must keep, nor build where there is no room', () => {
    const { c, t, f } = town();
    f.stores = { food: 20, wood: 300, gold: 100, stone: 100 };
    expect(governTown(c, t.id)!.began).toBeUndefined();
    expect(t.buildings).toEqual([]);
    const b = town(9);
    b.f.stores.food = 20;
    b.t.buildings = ['barracks', 'range', 'stable'];
    expect(governTown(b.c, b.t.id)!.began).toBeUndefined();
    expect(b.t.buildings).not.toContain('farm');
  }, LONG);

  it('couples with no roof: a house is begun on the town\'s record, paid for in its own wood, and finished in three seasons', () => {
    const { c, t, f } = town();
    t.town = { at: 2, b: [['towncenter', 30, 30], ['house', 36, 30]] };
    expect(housesOf(t)).toBe(1);
    expect(wantsOf(c, t.id).roof).toBe(true); // six couples and one roof
    const wood = f.stores.wood, cost = BUILDINGS.house.cost.wood ?? 0;
    const g = governTown(c, t.id)!;
    expect(g.began).toBe('house');
    expect(f.stores.wood).toBe(wood + g.brought.wood - cost);
    const begun = t.town.b[t.town.b.length - 1];
    expect(begun[0]).toBe('house');
    expect(begun[4]).toBe(0);
    expect(housesOf(t)).toBe(1); // not a roof until it is finished
    expect(governTown(c, t.id)!.began).toBeUndefined(); // one at a time
    governTown(c, t.id);
    const done = governTown(c, t.id)!;
    expect(done.finished).toEqual(['house']);
    expect(housesOf(t)).toBe(2);
    expect(c.log.join('\n')).toContain(`The house begun at ${t.name} is finished.`);
    expect(done.began).toBe('house'); // and there are still couples without one: the next is begun the same season
    // It stands clear of everything already there.
    const s = BUILDINGS.house.size;
    for (const x of t.town.b) for (const y of t.town.b) if (x !== y) expect(Math.abs(x[1] - y[1]) >= Math.min(s, BUILDINGS[y[0]].size) || Math.abs(x[2] - y[2]) >= Math.min(s, BUILDINGS[y[0]].size)).toBe(true);
    expect(plotFor({ ...t, town: undefined }, 'house')).toBeNull(); // a town with nothing on record has nowhere to say
  }, LONG);

  it('what the player left half built is finished without being paid for twice', () => {
    const { c, t, f } = town();
    t.town = { at: 2, b: [['towncenter', 30, 30], ['barracks', 36, 30, 0.5, 0.5], ['house', 30, 36]] };
    f.men = 1; f.women = 1; // one couple and a roof for them: nobody wants for one
    const wood = f.stores.wood;
    const a = governTown(c, t.id)!;
    expect(f.stores.wood).toBe(wood + a.brought.wood);
    const b = governTown(c, t.id)!;
    expect(b.finished).toEqual(['barracks']);
    expect(t.town.b[1]).toEqual(['barracks', 36, 30, 0.5]); // finished, and as battered as it was left
  }, LONG);

  it('raided: a Fortress, when the town can pay for it', () => {
    const { c, t, f } = town();
    (c.events ??= []).push({ kind: 'raid', at: t.id, turn: c.turn, until: c.turn });
    expect(wantsOf(c, t.id).wall).toBe(true);
    const goods = units(f.stores);
    const g = governTown(c, t.id)!;
    expect(g.began).toBe('fortress');
    expect(t.buildings).toEqual(['fortress']);
    expect(units(f.stores)).toBe(goods + units(g.brought) - g.ate - siteCost(t, 'fortress', 'hearth') * 100);
    expect(wantsOf(c, t.id).wall).toBe(false);
    c.turn += GOVERN.raided;
    t.buildings = [];
    expect(wantsOf(c, t.id).wall).toBe(false); // long enough ago to be forgotten
  }, LONG);

  it('every held town is kept so, a rival\'s as the player\'s; a tribe\'s and a marauders\' camp are not', () => {
    const c = newCampaign(7, 1, 1, 'hearth') as Campaign;
    const tribe = c.territories.find((x) => x.owner < 0)!, theirs = c.territories.find((x) => x.owner === 1)!;
    const camp = c.territories.find((x) => x.owner < 0 && x !== tribe)!;
    camp.horde = true;
    const got = governTowns(c).map((g) => g.at);
    expect(got).toContain(theirs.id);
    expect(got).toContain(c.territories.find((x) => x.owner === 0)!.id);
    expect(got).not.toContain(tribe.id);
    expect(governTown(c, camp.id)).toBeNull();
    const n = c.log.length;
    folkOf(c, theirs.id).stores.food = 0; theirs.buildings = theirs.buildings.filter((b) => b !== 'farm').slice(0, 1);
    expect(governTown(c, theirs.id)!.fields).toBe(true);
    expect(c.log.length).toBe(n); // a rival's governor does not report to the player
  }, LONG);
});
