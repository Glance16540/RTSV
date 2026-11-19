// Where the computer opponent sets its buildings down (docs/systems-board, "Country and ground": it kept out of bogs,
// but built across its own roads and did not otherwise plan around ground).
//
// The computer still looks for room ring by ring outward from where it wants a building, as it always has, so its
// town stays as close as before (keeping off its roads by looking further out pushed it so far apart that a Hard
// opponent stopped beating an Easy one). What changes is which free spot on a ring it takes:
//   - one that does not cover its roads, where the ring has one or the next ring out does;
//   - a field on grass or bare earth (not sand or snow) and on level ground;
//   - a tower or fortress on the highest ground among the rings a little further out, where the land rises;
//   - nothing on ground too steep to build on.
// Its palisade ring is laid at the radius whose line runs highest, where the land rises (otherwise as before).
// A crowded town still builds: a spot that is only second best is still taken, and the thirty tries before it looks
// further out (ai.ts CROWDED_TRIES) are as they were. The player's own placing is untouched.
import { T_DIRT, T_GRASS } from './map';
import type { Game } from './game';

export const SITING = {
  /** What a tile of road under a building costs a spot, against one tile of poor ground under a field. */
  road: 8, poor: 1,
  /** What uneven ground under a field costs, for each unit of height between its lowest and highest tile. */
  uneven: 6,
  /** What a unit of height is worth to a tower or fortress. */
  rise: 4,
  /** How many tiles further out than the first ring with room a tower or fortress looks for higher ground, and anything else for a spot off its roads. */
  reach: 3, aside: 3,
  /** The radii a palisade ring may be laid at, the first being the old one. */
  rings: [16, 15, 17, 14, 18],
};

const DEFENCES = new Set(['tower', 'fortress']);

/** Does this kind of building want high ground? */
export const wantsHeight = (g: Game, type: string): boolean => g.relief && DEFENCES.has(type);

/** The lowest and highest ground under a footprint. */
function spread(g: Game, cx: number, cy: number, s: number): { lo: number; hi: number; mean: number } {
  let lo = Infinity, hi = -Infinity, sum = 0;
  for (let y = cy; y < cy + s; y++) for (let x = cx; x < cx + s; x++) { const h = g.spec.height[y * g.size + x] ?? 0; lo = Math.min(lo, h); hi = Math.max(hi, h); sum += h; }
  return { lo, hi, mean: sum / (s * s) };
}

/** Level enough to build on, by the rule the placing itself keeps (game.ts tooSteep). */
export const level = (g: Game, s: number, cx: number, cy: number): boolean => {
  if (!g.relief) return true;
  const { lo, hi } = spread(g, cx, cy, s);
  return hi - lo <= (s > 1 ? 0.4 : 0.6);
};

/** What a spot costs this kind of building: lower is better; Infinity where it cannot stand. */
export function siteCost(g: Game, type: string, s: number, cx: number, cy: number): number {
  if (!level(g, s, cx, cy)) return Infinity;
  let cost = 0;
  for (let y = cy; y < cy + s; y++) for (let x = cx; x < cx + s; x++) {
    const i = y * g.size + x;
    if (g.road[i]) cost += SITING.road;
    if (type === 'farm' && g.terrain[i] !== T_GRASS && g.terrain[i] !== T_DIRT) cost += SITING.poor;
  }
  if (g.relief && type === 'farm') { const { lo, hi } = spread(g, cx, cy, s); cost += (hi - lo) * SITING.uneven; }
  if (wantsHeight(g, type)) cost -= spread(g, cx, cy, s).mean * SITING.rise;
  return cost;
}

/** Does a footprint cover a road? */
const onRoad = (g: Game, s: number, cx: number, cy: number): boolean => {
  for (let y = cy; y < cy + s; y++) for (let x = cx; x < cx + s; x++) if (g.road[y * g.size + x]) return true;
  return false;
};

/**
 * How much further out than the first ring with room to go on looking, given the free spots found so far: a tower or
 * fortress where the land rises a little way for height; anything else one ring for a spot off its roads, if every
 * spot so far is on one; otherwise not at all.
 */
export function lookOn(g: Game, type: string, s: number, free: readonly { cx: number; cy: number }[]): number {
  if (wantsHeight(g, type)) return SITING.reach;
  return free.every((p) => onRoad(g, s, p.cx, p.cy)) ? SITING.aside : 0;
}

/** The best of the free spots found, the first of them on a tie (so a flat, roadless place is chosen as before). */
export function bestSite<T extends { cx: number; cy: number }>(g: Game, type: string, s: number, spots: readonly T[]): T | null {
  let best: T | null = null, low = Infinity;
  for (const p of spots) { const k = siteCost(g, type, s, p.cx, p.cy); if (k < low) { low = k; best = p; } }
  return best;
}

/** The radius for a palisade ring around a hall: where the land rises, the one whose line runs highest; otherwise the old one. */
export function wallRadius(g: Game, x0: number, y0: number): number {
  const [first] = SITING.rings;
  if (!g.relief) return first;
  let best = first, top = -Infinity;
  for (const R of SITING.rings) {
    let sum = 0, n = 0;
    for (let i = -R; i < R; i++) for (const [x, y] of [[x0 + i, y0 - R], [x0 + R, y0 + i], [x0 - i, y0 + R], [x0 - R, y0 - i]]) {
      if (x < 1 || y < 1 || x >= g.size - 1 || y >= g.size - 1) continue;
      sum += g.spec.height[y * g.size + x] ?? 0; n++;
    }
    const mean = n ? sum / n : -Infinity;
    if (mean > top + 0.05) { top = mean; best = R; } // a ring further out only for clearly higher ground
  }
  return best;
}
