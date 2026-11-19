// A Church near a Tavern tempers it (docs/systems-board, "Church": a Church near a Tavern had no effect on it).
//
// On the map, a town with both a Church and a Tavern (on its land, so within reach of each other):
//   - the Tavern draws its standing down TEMPER.pull a season the less (townfaith.ts townDrift);
//   - fewer of its women drift to the Tavern: the most who may is a TEMPER.drift share smaller (drift.ts).
// In a town (a battle or a visit), where a finished Church stands within TEMPER.reach tiles of a Tavern of its people:
//   - the maids' pull toward decadence is a TEMPER.maids share weaker (game.ts);
//   - a woman about to drift to the Tavern stays at her work one time in TEMPER.drift (driftintown.ts), decided
//     without the battle's run of chances.
// Small on purpose: a church does not shut a tavern; decrees do (decrees.ts closeTavern).
import type { Campaign } from './campaign';
import type { Game } from './game';
import { TAVERN_VIRTUE } from './campaignbase';

export const TEMPER = {
  /** On the map: standing a season the Tavern draws down the less. */
  pull: 1,
  /** The share fewer who drift to the Tavern, on the map and in a town. */
  drift: 0.25,
  /** In a town: how near, in tiles, the Church must stand to the Tavern; and the share the maids' pull is weakened. */
  reach: 12, maids: 0.25,
};

/** On the map: does a Church stand beside this town's Tavern? */
export const churchTempers = (c: Campaign, tid: number): boolean => {
  const b = c.territories[tid]?.buildings ?? [];
  return b.includes('church') && b.includes('tavern');
};
/** On the map: how far this town's Tavern draws its standing down a season (townfaith.ts). */
export const tavernPull = (c: Campaign, tid: number): number => (c.territories[tid]?.buildings.includes('tavern') ? TAVERN_VIRTUE - (churchTempers(c, tid) ? TEMPER.pull : 0) : 0);
/** On the map: the share of the women who may drift to this town's Tavern, against the usual (drift.ts). */
export const tavernShare = (c: Campaign, tid: number): number => (churchTempers(c, tid) ? 1 - TEMPER.drift : 1);

/** In a town: does a finished Church of this people stand within reach of one of its Taverns? Worked out once a tick. */
const seen = new WeakMap<Game, { tick: number; near: Set<number> }>();
export function churchNear(g: Game, owner: number): boolean {
  let s = seen.get(g);
  if (!s || s.tick !== g.tick) {
    const near = new Set<number>(), live = g.buildings.filter((b) => !b.dead && b.complete);
    for (const t of live) if (t.type === 'tavern' && live.some((b) => b.owner === t.owner && b.type === 'temple' && Math.hypot(b.x - t.x, b.y - t.y) <= TEMPER.reach)) near.add(t.owner);
    s = { tick: g.tick, near };
    seen.set(g, s);
  }
  return s.near.has(owner);
}
/** In a town: the share of the maids' pull toward decadence that still tells (game.ts). */
export const maidPull = (g: Game, owner: number): number => (churchNear(g, owner) ? 1 - TEMPER.maids : 1);
/** In a town: does the Church keep this woman from the Tavern this time? Without the battle's dice: by the tick and the people. */
export function keptFromTavern(g: Game, owner: number): boolean {
  if (!churchNear(g, owner)) return false;
  let h = (Math.imul(g.tick + 1, 0x9e3779b1) ^ Math.imul(owner + 7, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296 < TEMPER.drift;
}
