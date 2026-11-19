// Roads laid and lifted by hand (the board's "Town and economy": the player could not lay or remove a road in a town).
//
// A town's roads wear themselves: every building is joined to its town centre by the cheapest way, and units go faster
// on a road (game.ts layRoad). Now the player may also:
//   - lay one: a straight run of tiles, from one point to another, of open ground (no building, tree, rock or water on
//     it), ground they have seen, within HAND_ROADS.reach tiles of a town centre of their own, at most HAND_ROADS.most tiles
//     at once. It costs nothing, as the town's own roads cost nothing: a road is ground walked hard, not a work.
//   - lift one: any road of theirs under a tile, laid by hand or worn to one of their buildings. A road worn to a building
//     is worn again only when a town centre rises or falls (and every road is laid afresh then), so a lifted one stays lifted.
// A road laid by hand is kept with the others (Game.roadOf, under a key below zero, its first cell the owner), so a saved
// battle keeps it and a new town centre does not wipe it (game.ts relayRoads keeps them). After a visit the town keeps
// them on its record (`Town.roads`, visit.ts), and they are laid again the next time the town is entered (`roadsIn`).
// The computer player never lays or lifts one. It reads and changes only the roads.
import type { Game } from './game';
import type { Campaign } from './campaign';

declare module './campaign' {
  interface Town {
    /** Roads laid by hand in the town, by their tiles, kept from visit to visit (handroads.ts). */
    roads?: [number, number][];
  }
}
declare module './game' {
  interface Player {
    /** Roads laid by hand in this town before, to lay again when the field is first looked at (handroads.ts). */
    roadsIn?: [number, number][];
  }
}

export const HAND_ROADS = {
  /** How far from a town centre of one's own a road may be laid, in tiles (as far as the town's own roads reach). */
  reach: 40,
  /** The most tiles laid at once. */
  most: 40,
};

const moveOf = (g: Game, i: number, was: number): void => {
  // The town's own rule (game.ts setRoad): ground under a road costs 0.6 of itself to cross.
  if (!was && g.road[i]) g.moveCost[i] *= 0.6;
  else if (was && !g.road[i]) g.moveCost[i] /= 0.6;
};

/** Why a road cannot be laid on this tile by this side, or '' where it can. */
export function roadBar(g: Game, owner: number, x: number, y: number): string {
  const N = g.size;
  if (x < 0 || y < 0 || x >= N || y >= N) return 'Off the land.';
  const i = y * N + x;
  if (g.road[i]) return 'There is a road here already.';
  if (g.occupied[i]) return 'Something stands here: a road needs open ground.';
  if (owner === g.humanId && g.vis[i] === 0) return 'You have not seen this ground.';
  const near = g.buildings.some((b) => b.owner === owner && !b.dead && b.type === 'towncenter' && Math.hypot(b.x - (x + 0.5), b.y - (y + 0.5)) <= HAND_ROADS.reach);
  if (!near) return 'Too far from a town centre of yours.';
  return '';
}

/** The tiles of a straight run from one tile to another, corner to corner without a gap, at most HAND_ROADS.most. */
export function roadLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const out: [number, number][] = [], n = Math.min(HAND_ROADS.most - 1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  for (let k = 0; k <= n; k++) {
    const t = n ? k / Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) : 0;
    const p: [number, number] = [Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)];
    const last = out[out.length - 1];
    // A diagonal step is filled at its corner, so the road is one a cart could follow.
    if (last && last[0] !== p[0] && last[1] !== p[1]) out.push([p[0], last[1]]);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

/** Lay a road on these tiles, where each may take one. Returns how many tiles were laid. */
export function cmdLayRoad(g: Game, owner: number, tiles: [number, number][]): number {
  const ok = tiles.slice(0, HAND_ROADS.most).filter(([x, y]) => !roadBar(g, owner, x, y)).map(([x, y]) => y * g.size + x);
  const cells = [...new Set(ok)];
  if (!cells.length) return 0;
  let key = -1; for (const k of g.roadOf.keys()) if (k <= key) key = k - 1; // below every key in use, saved ones too
  g.roadOf.set(key, [owner, ...cells]);
  for (const i of cells) { const was = g.road[i]; g.road[i]++; moveOf(g, i, was); }
  g.roadVersion++;
  return cells.length;
}

/** Whose a road is: a hand road's owner is its first cell; a worn one is its building's. */
const ownerOf = (g: Game, key: number, cells: number[]): number => (key < 0 ? cells[0] : (g.entities.get(key)?.owner ?? -1));

/** Lift every road of this side's on this tile. Returns whether there was one. */
export function cmdLiftRoad(g: Game, owner: number, x: number, y: number): boolean {
  const i = y * g.size + x;
  if (x < 0 || y < 0 || x >= g.size || y >= g.size || !g.road[i]) return false;
  let any = false;
  for (const [key, cells] of [...g.roadOf]) {
    const k = cells.indexOf(i, 1);
    if (k < 1 || ownerOf(g, key, cells) !== owner) continue;
    cells.splice(k, 1);
    const was = g.road[i]; g.road[i]--; moveOf(g, i, was);
    if (key < 0 && cells.length < 2) g.roadOf.delete(key);
    any = true;
  }
  if (any) g.roadVersion++;
  return any;
}

/** The tiles of the roads this side laid by hand, as the town keeps them on its record. */
export function handRoadsOut(g: Game, owner: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [key, cells] of g.roadOf) if (key < 0 && cells[0] === owner) for (const i of cells.slice(1)) out.push([i % g.size, Math.floor(i / g.size)]);
  return out;
}

/** Lay again the roads a town kept on its record, once, as the field is first looked at (called each second, game.ts step). */
export function handRoadsTick(g: Game): void {
  for (const p of g.players) {
    if (!p.roadsIn) continue;
    const tiles = p.roadsIn;
    delete p.roadsIn;
    for (let k = 0; k < tiles.length; k += HAND_ROADS.most) cmdLayRoad(g, p.id, tiles.slice(k, k + HAND_ROADS.most));
  }
}

/** What comes back from the field is not believed blindly: whole tiles on the land, at most a town's worth. */
export function cleanRoads(v: unknown, size = 160): [number, number][] {
  if (!Array.isArray(v)) return [];
  return v.filter((p): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isInteger(n) && n >= 0 && n < size)).slice(0, 2000);
}

/** The town keeps the roads laid by hand on its record, as the player left it (visit.ts finishVisit). */
export function keepRoads(c: Campaign, tid: number, v: unknown): void {
  const t = c.territories[tid];
  if (!t?.town || t.town.coarse) return;
  const roads = cleanRoads(v);
  if (roads.length) t.town.roads = roads; else delete t.town.roads;
}

/** The roads laid by hand in a town before, for a visit's bonus, or undefined. */
export const roadsFor = (c: Campaign, tid: number): [number, number][] | undefined => { const r = c.territories[tid]?.town?.roads; return r?.length ? r.map(([x, y]) => [x, y] as [number, number]) : undefined; };
