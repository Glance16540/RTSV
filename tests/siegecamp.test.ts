// A siege camp has no people from nowhere (src/sim/siegecamp.ts): a besieging army's camp starts with no villagers, nobody is
// born there, and its foot soldiers build its works and crew its engines.
import { describe, expect, it } from 'vitest';
import { battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { CAMP, campBuilds, campWorks } from '../src/sim/siegecamp';
import { run, setups, spot } from './helpers';

/** A rival's army marched on the player's capital, as a campaign siege; the rival (1) besieges. */
function siege(civ = 'stonekin'): Game {
  const c = newCampaign(4, 1, 1, 'hearth');
  c.factions[1].civ = civ; // a settled people, with a camp's hall; 'wild' is a war band
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories[home.adj[0]];
  next.owner = 1;
  c.armies.push({ id: 99, owner: 1, at: next.id, units: { infantry: 4, archers: 1 }, hero: false, vet: 0, moved: false });
  c.phase = 'ai';
  expect(moveArmy(c, 99, home.id)).toBe('battle');
  const cfg = battleConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return g;
}
const of = (g: Game, pid: number, type: string) => g.units.filter((u) => u.owner === pid && !u.dead && u.type === type);
const foot = (g: Game, pid: number) => g.units.filter((u) => u.owner === pid && !u.dead && (u.def.cls === 'infantry' || u.def.cls === 'ranged') && !u.hero);
const rich = (g: Game, pid: number) => { g.players[pid].res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 }; g.players[pid].age = 2; };

describe('siegecamp', () => {
  it('a besieging camp has its hall and its army and no villagers; the town and a skirmish have theirs', () => {
    const g = siege();
    expect(of(g, 1, 'villager')).toHaveLength(0);
    expect(g.buildings.some((b) => b.owner === 1 && b.type === 'towncenter')).toBe(true);
    expect(foot(g, 1).length).toBeGreaterThan(0);
    expect(of(g, 0, 'villager').length).toBeGreaterThan(0);
    const band = siege('wild'); // a war band besieging has no founders either
    expect(of(band, 1, 'villager')).toHaveLength(0);
    expect(foot(band, 1).length).toBeGreaterThan(0);
    const s = new Game(5, setups);
    expect(of(s, 0, 'villager').length).toBeGreaterThan(0);
    expect(of(s, 1, 'villager').length).toBeGreaterThan(0);
  });

  it('nobody is born in the camp, and it buys nobody', () => {
    const g = siege();
    run(g, 120);
    expect(of(g, 1, 'villager')).toHaveLength(0);
    expect(g.players[1].stats.born).toBe(0);
  });

  it('its foot soldiers build the camp\'s works, and only those; the town\'s soldiers build nothing', () => {
    const g = siege();
    rich(g, 1);
    const men = foot(g, 1).slice(0, 2);
    expect(campBuilds(g, men[0], 'workshop')).toBe(true);
    expect(campBuilds(g, men[0], 'barracks')).toBe(false);
    const at = spot(g, 'workshop', 1);
    const shop = g.cmdPlace(1, 'workshop', at.cx, at.cy, men.map((u) => u.id))!;
    expect(men[0].order?.t).toBe('build');
    for (let i = 0; i < 120 && !shop.complete; i++) run(g, 1);
    expect(shop.complete).toBe(true);
    const at2 = spot(g, 'barracks', 1);
    const yard = g.cmdPlace(1, 'barracks', at2.cx, at2.cy, men.map((u) => u.id))!;
    run(g, 20);
    expect(yard.progress).toBe(0); // soldiers do not raise a barracks
    const theirs = foot(g, 0)[0];
    if (theirs) expect(campBuilds(g, theirs, 'workshop')).toBe(false); // the defender's are not a camp's
  });

  it('a ram is crewed by one of its foot soldiers, who goes in and comes out a ram', () => {
    const g = siege();
    rich(g, 1);
    const at = spot(g, 'workshop', 1);
    const shop = g.spawnBuilding('workshop', 1, at.cx, at.cy, true);
    const before = foot(g, 1).length;
    expect(g.cmdTrain(1, shop.id, 'ram')).toBe(true);
    const crew = g.entities.get(shop.queue[0].who!);
    expect(crew && crew.kind === 'unit' && crew.type !== 'villager').toBe(true);
    for (let i = 0; i < 120 && !of(g, 1, 'ram').length; i++) run(g, 1);
    expect(of(g, 1, 'ram')).toHaveLength(1);
    expect(foot(g, 1).length).toBe(before - 1);
  });

  it('the computer, besieging, raises its workshop with two soldiers, then keeps rams in hand', () => {
    const g = siege();
    rich(g, 1);
    const placed: string[] = [];
    const place = (type: string, near: { x: number; y: number }, men: { id: number }[]) => { placed.push(type); const at = spot(g, type, 1); return g.cmdPlace(1, type, at.cx, at.cy, men.map((u) => u.id)); };
    expect(campWorks(g, 1, place)?.type).toBe('workshop');
    expect(placed).toEqual(['workshop']);
    const shop = g.buildings.find((b) => b.owner === 1 && b.type === 'workshop')!;
    shop.complete = true; shop.progress = 1;
    campWorks(g, 1, place);
    expect(shop.queue.filter((q) => q.id === 'ram').length).toBe(1);
    expect(CAMP.rams).toBeGreaterThan(0);
    expect(campWorks(g, 0, place)).toBeNull(); // the defender is no camp
  });
});
