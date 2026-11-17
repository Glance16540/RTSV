// Every town its own faith (docs/DESIGN.md, the owner's word, 17 November 2026: "All towns differ in faith, even those
// built alike, and together they make the nation's faith").
//
// Each land's town has a lean of its own (`leanOf`): a whole number of steps a season toward piety or toward decadence,
// from -LEAN.most to LEAN.most, fixed by the campaign's seed and the land, never 0. It is the town's, not its nation's:
// it is the same under any holder. Beside its Church, its Tavern, a holy place and its own life (townfaith.ts
// `townDrift`, townlife.ts), it moves the town each season; the pull toward the nation's standing (townfaith.ts `PULL`,
// a tenth of the way a season) holds it, so a town settles about ten times its lean from the rest. Two towns built
// alike now stand apart by what they are; the nation's standing is still the mean of its towns.
// Plain data: a number from the seed and the land. Nothing is kept.
import type { Campaign } from './campaign';

export const LEAN = {
  /** The most a town's own lean moves it a season, either way. */
  most: 1,
  /** Beyond this far from its nation's standing a town is drawn back `farTimes` as hard as the usual pull (three tenths
   *  of the way a season, not one; the faster still with Pilgrimage), so that the big, old nations' towns, each with its
   *  own lean, its Church or its Tavern, do not fly apart. Unchecked, a lean of 1 to 3 put 21 to 37% of nation-seasons
   *  over a gap of 60 at 192 campaigns. */
  far: 25, farTimes: 3,
};

/** The share of the way a town is drawn toward its nation's standing this season: `pull`, or LEAN.farTimes of it when it stands far off. */
export const pullFor = (distance: number, pull: number): number => (Math.abs(distance) > LEAN.far ? pull * LEAN.farTimes : pull);

const hash = (a: number, b: number): number => {
  let h = (Math.imul(a ^ 0x6c8e9cf5, 0x9e3779b1) ^ Math.imul(b + 0x1b873593, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** A town's own lean: whole steps a season toward piety (above 0) or decadence (below), never 0. */
export function leanOf(c: Campaign, tid: number): number {
  const most = Math.max(1, Math.round(LEAN.most));
  const k = Math.floor(hash(c.seed, tid * 7919 + 13) * 2 * most); // 0 .. 2*most-1
  return k < most ? k - most : k - most + 1; // -most .. -1, 1 .. most
}
