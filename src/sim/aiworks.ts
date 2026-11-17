/**
 * What the computer builds for its town, inside a battle or a visit, besides its works of war.
 *
 * The newer buildings each answer something in a town (data.ts: Granary, Mill, Well, Infirmary, Hall of Judgement,
 * Noble's Manor, Monastery, Watch House, Fortress, Inn). The computer never built one: its build order (ai.ts) is
 * barracks, storehouse, range and so on. Here is the sense it lacked. Each building has a reason, read off the town
 * as it stands, and is raised once:
 *
 *   in need (before the build order, when it can be paid for with a little wood over; and not held back by saving
 *   for the next age, the Fortress aside):
 *     Granary      the food store is bare or all but, or has been and people starved of it
 *     Infirmary    plague is among its people
 *     Well         plague has broken out in the town before, or the town is crowded (`WORKS.crowded` villagers)
 *     Watch House  a building of its own is burning
 *     Fortress     it has been attacked at home, and has not chosen peace
 *   out of plenty (when the build order has nothing left to raise and nothing is being saved for, at `WORKS.plenty`
 *   times the cost in hand):
 *     Mill         it has fields enough to grind for (`WORKS.fields`)
 *     Hall         a grown town (`WORKS.grown` villagers)
 *     Monastery    a town that keeps the faith
 *     Manor        a town of the size the building itself asks (`townAt`)
 *     Inn          it has a market: there is a road worth keeping
 *
 * The building's own rules are the game's: its age, its creed (`needs`), its size of town (`townAt`). This only asks
 * whether the town has a use for it. A war band with no town of its own (a raider) builds none of them.
 *
 * And the studies taught at them: `queuesBehind` says which studies the computer queues at a building that is busy
 * (a nation's study kept on the map, data.ts `answers`), as it does its own people's (ownstudies.ts).
 */
import { BUILDINGS, TECHS } from './data';
import type { Game } from './game';

export const WORKS = {
  /** Villagers at which a town is crowded enough to want a Well, and grown enough to seat a Hall. */
  crowded: 20, grown: 16,
  /** Farms at which a Mill is worth its timber. */
  fields: 3,
  /** A food store under this is as good as bare: the town has a use for a Granary. */
  bare: 50,
  /** A work the town needs is raised when it has the cost and this much wood over (its bread is not asked for: a hungry town has none);
   *  one raised out of plenty, at this many times the cost with this much over. */
  need: { food: 0, wood: 100 }, over: { food: 150, wood: 100 }, plenty: 2,
  /** Seconds after it was last attacked at home that a town still counts itself threatened. */
  threat: 240,
  /** Studies queued at one building at a time, at the most. */
  queue: 2,
};
/** The buildings this decides on, in the order they are thought of: those a town needs, then those it raises out of plenty. */
export const NEEDED = ['granary', 'infirmary', 'well', 'watchhouse', 'fortress'];
export const OF_PLENTY = ['mill', 'hall', 'monastery', 'manor', 'inn'];

/** What the computer knows of its town when it asks (ai.ts has counted these already). */
export interface TownState { villagers: number; peace: boolean; home: { x: number; y: number } }

/** Has the town a use for this building as it stands now? */
export function hasUseFor(g: Game, pid: number, type: string, s: TownState): boolean {
  const p = g.players[pid];
  const mine = (t: string): number => g.buildings.filter((b) => b.owner === pid && b.type === t && !b.dead).length;
  switch (type) {
    case 'granary': return (p.hunger ?? 0) > 0 || (p.starved ?? 0) > 0 || p.res.food < WORKS.bare;
    case 'infirmary': return g.units.some((u) => u.owner === pid && !u.dead && u.plagueT > 0);
    case 'well': return p.plagueAt > 0 || s.villagers >= WORKS.crowded;
    case 'watchhouse': return g.buildings.some((b) => b.owner === pid && !b.dead && !b.def.wall && b.burnT > 0);
    case 'fortress': return !s.peace && !!p.lastAttacked && g.time - p.lastAttacked.t < WORKS.threat && Math.hypot(p.lastAttacked.x - s.home.x, p.lastAttacked.y - s.home.y) < 28;
    case 'mill': return mine('farm') >= WORKS.fields;
    case 'hall': return s.villagers >= WORKS.grown;
    case 'monastery': return true; // its creed is the building's own rule, asked below
    case 'manor': return true; // and so is the size of its town
    case 'inn': return mine('market') > 0;
    default: return false;
  }
}
/** May it be raised at all: not standing or begun already, of the town's age, within its creed and its size (the game's own rules). */
export function mayRaise(g: Game, pid: number, type: string): boolean {
  const p = g.players[pid], def = BUILDINGS[type];
  if (!def || g.raider(pid) || g.ageFor(pid, def) > p.age || g.creedBar(pid, def)) return false;
  if (g.buildings.some((b) => b.owner === pid && b.type === type && !b.dead)) return false;
  return !def.townAt || g.units.filter((u) => u.owner === pid && u.type === 'villager' && !u.dead && u.growT <= 0).length >= def.townAt;
}
const has = (g: Game, pid: number, type: string, times: number, over: { food: number; wood: number }): boolean => {
  const c = BUILDINGS[type].cost;
  return g.canAfford(g.players[pid], { food: (c.food ?? 0) * times + over.food, wood: (c.wood ?? 0) * times + over.wood, gold: (c.gold ?? 0) * times, stone: (c.stone ?? 0) * times });
};

/** The work the town needs now and can pay for, or null: asked before the build order. */
export function workNeeded(g: Game, pid: number, s: TownState): string | null {
  return NEEDED.find((t) => mayRaise(g, pid, t) && hasUseFor(g, pid, t, s) && has(g, pid, t, 1, WORKS.need)) ?? null;
}
/** The work the town would raise out of plenty, or null: asked when the build order has nothing left to raise. */
export function workOfPlenty(g: Game, pid: number, s: TownState): string | null {
  return OF_PLENTY.find((t) => mayRaise(g, pid, t) && hasUseFor(g, pid, t, s) && has(g, pid, t, WORKS.plenty, WORKS.over)) ?? null;
}

/** Is this a study the computer queues behind a busy building: one of the nation's kept on the map, and room in the queue for it? */
export const queuesBehind = (id: string, queued: number): boolean => !!TECHS[id]?.answers && queued < WORKS.queue;
