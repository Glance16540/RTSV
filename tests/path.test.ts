// Grid A* with rectangle goals and line-of-sight smoothing (src/sim/path.ts), on its own: no battle, just a grid.
import { describe, expect, it } from 'vitest';
import { Pathfinder, rectDist } from '../src/sim/path';

/** An open n by n grid, with these cells (x, y) set to the value given (1: solid). */
const grid = (n: number, solid: [number, number][] = [], v = 1): Pathfinder => {
  const b = new Uint8Array(n * n);
  for (const [x, y] of solid) b[y * n + x] = v;
  return new Pathfinder(n, b);
};
const cell = (pf: Pathfinder, x: number, y: number, v: number): void => { pf.blocked[y * pf.n + x] = v; };
/** Every waypoint as [x, y] pairs. */
const pairs = (path: number[]): [number, number][] => Array.from({ length: path.length / 2 }, (_, i) => [path[i * 2], path[i * 2 + 1]]);
/** The route walked from the start through every waypoint: each leg must be clear of solid ground. */
const walkable = (pf: Pathfinder, sx: number, sy: number, path: number[]): boolean => {
  let ax = sx, ay = sy;
  for (const [x, y] of pairs(path)) { if (!pf.lineClear(ax, ay, x, y)) return false; ax = x; ay = y; }
  return true;
};
const length = (sx: number, sy: number, path: number[]): number => {
  let ax = sx, ay = sy, n = 0;
  for (const [x, y] of pairs(path)) { n += Math.hypot(x - ax, y - ay); ax = x; ay = y; }
  return n;
};

describe('rectDist', () => {
  it('is nought inside the rectangle and on its edge', () => {
    expect(rectDist(5, 5, 4, 4, 6, 6)).toBe(0);
    expect(rectDist(4, 5, 4, 4, 6, 6)).toBe(0);
    expect(rectDist(6, 6, 4, 4, 6, 6)).toBe(0);
  });
  it('is the distance straight out from a side, and to the corner off a corner', () => {
    expect(rectDist(9, 5, 4, 4, 6, 6)).toBe(3);
    expect(rectDist(5, 1, 4, 4, 6, 6)).toBe(3);
    expect(rectDist(9, 10, 4, 4, 6, 6)).toBe(5); // 3, 4 off the far corner
    expect(rectDist(0, 0, 3, 4, 3, 4)).toBe(5); // a rectangle of one point
  });
});

describe('Pathfinder.isBlocked', () => {
  it('everything off the grid is solid; a solid cell is solid; open ground is not', () => {
    const pf = grid(8, [[3, 3]]);
    expect(pf.isBlocked(-1, 0)).toBe(true);
    expect(pf.isBlocked(0, -1)).toBe(true);
    expect(pf.isBlocked(8, 0)).toBe(true);
    expect(pf.isBlocked(0, 8)).toBe(true);
    expect(pf.isBlocked(3, 3)).toBe(true);
    expect(pf.isBlocked(3, 4)).toBe(false);
    expect(pf.isBlocked(0, 0)).toBe(false);
  });
  it('a gate is open only to the side whose pass it is', () => {
    const pf = grid(8, [[2, 2]], 2 + 1); // a gate of team 1
    pf.pass = 2 + 1;
    expect(pf.isBlocked(2, 2)).toBe(false);
    pf.pass = 2 + 0;
    expect(pf.isBlocked(2, 2)).toBe(true);
    pf.pass = 0;
    expect(pf.isBlocked(2, 2)).toBe(true);
  });
});

describe('Pathfinder.nearestFree', () => {
  it('a point on open ground is its own nearest free spot, as given', () => {
    expect(grid(8).nearestFree(3.2, 4.7)).toEqual({ x: 3.2, y: 4.7 });
  });
  it('from inside solid ground, the centre of the nearest open cell', () => {
    // A 3x3 block centred on (4, 4): from (4.9, 4.5) the cell to the east, (6, 4), is nearest.
    const solid: [number, number][] = [];
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) solid.push([x, y]);
    const pf = grid(10, solid);
    expect(pf.nearestFree(5.9, 4.5)).toEqual({ x: 6.5, y: 4.5 });
    expect(pf.nearestFree(4.5, 3.1)).toEqual({ x: 4.5, y: 2.5 });
    const p = pf.nearestFree(4.5, 4.5);
    expect(pf.isBlocked(Math.floor(p.x), Math.floor(p.y))).toBe(false);
    expect(Math.hypot(p.x - 4.5, p.y - 4.5)).toBe(2);
  });
  it('with nowhere free at all, the point given back', () => {
    const all: [number, number][] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) all.push([x, y]);
    expect(grid(4, all).nearestFree(1.5, 2.5)).toEqual({ x: 1.5, y: 2.5 });
  });
});

describe('Pathfinder.lineClear', () => {
  it('is clear over open ground, and a segment of no length is always clear', () => {
    const pf = grid(10, [[5, 5]]);
    expect(pf.lineClear(1.5, 1.5, 8.5, 1.5)).toBe(true);
    expect(pf.lineClear(5.5, 5.5, 5.5, 5.5)).toBe(true); // even inside solid ground
  });
  it('is not clear through a solid cell, nor brushing past one closer than a unit\'s breadth', () => {
    const pf = grid(10, [[5, 5]]);
    expect(pf.lineClear(1.5, 5.5, 8.5, 5.5)).toBe(false); // straight through
    expect(pf.lineClear(1.5, 6.1, 8.5, 6.1)).toBe(false); // 0.1 off its edge
    expect(pf.lineClear(1.5, 6.5, 8.5, 6.5)).toBe(true); // half a cell off
  });
  it('is not clear off the edge of the grid', () => {
    expect(grid(10).lineClear(1.5, 1.5, 12, 1.5)).toBe(false);
  });
});

describe('Pathfinder.find', () => {
  it('over open ground goes straight to the goal: one waypoint, the goal cell\'s centre', () => {
    const pf = grid(20);
    const r = pf.find(0.5, 0.5, 15, 15, 16, 16, 0.5);
    expect(r.partial).toBe(false);
    expect(r.path).toEqual([15.5, 15.5]);
  });

  it('already within reach of the goal: a single step to the centre of the cell it stands in', () => {
    const r = grid(20).find(5.2, 5.7, 5, 5, 6, 6, 0);
    expect(r).toEqual({ path: [5.5, 5.5], partial: false });
  });

  it('stops within `reach` of the target rectangle rather than at it', () => {
    const pf = grid(30);
    const r = pf.find(2.5, 2.5, 20, 2, 21, 3, 4);
    expect(r.partial).toBe(false);
    const [ex, ey] = pairs(r.path).at(-1)!;
    expect(rectDist(ex, ey, 20, 2, 21, 3)).toBeLessThanOrEqual(4);
    expect(ex).toBeLessThan(20); // it did not walk on to the rectangle itself
  });

  it('a target inside solid ground is reached at the nearest open cell within reach of it', () => {
    const block: [number, number][] = [];
    for (let y = 8; y <= 11; y++) for (let x = 8; x <= 11; x++) block.push([x, y]);
    const pf = grid(20, block);
    const r = pf.find(1.5, 1.5, 8, 8, 12, 12, 1);
    expect(r.partial).toBe(false);
    const [ex, ey] = pairs(r.path).at(-1)!;
    expect(pf.isBlocked(Math.floor(ex), Math.floor(ey))).toBe(false);
    expect(rectDist(ex, ey, 8, 8, 12, 12)).toBeLessThanOrEqual(1);
    expect(walkable(pf, 1.5, 1.5, r.path)).toBe(true);
  });

  it('goes round a wall by its gap, every leg of the way clear of solid ground', () => {
    const wall: [number, number][] = [];
    for (let y = 0; y < 19; y++) wall.push([10, y]); // the gap is at the bottom, y = 19
    const pf = grid(20, wall);
    const r = pf.find(2.5, 2.5, 17, 2, 18, 3, 0.5);
    expect(r.partial).toBe(false);
    expect(pairs(r.path).some(([, y]) => y > 18)).toBe(true); // through the gap
    expect(walkable(pf, 2.5, 2.5, r.path)).toBe(true);
    expect(length(2.5, 2.5, r.path)).toBeGreaterThan(2 * 16); // down and up again
    const [ex, ey] = pairs(r.path).at(-1)!;
    expect(rectDist(ex, ey, 17, 2, 18, 3)).toBeLessThanOrEqual(0.5);
  });

  it('never cuts a corner between two solid cells on a diagonal', () => {
    // The start's only way out would be a diagonal between (1,0) and (0,1): it is shut.
    const pf = grid(10, [[1, 0], [0, 1]]);
    const r = pf.find(0.5, 0.5, 5, 5, 6, 6, 0);
    expect(r.partial).toBe(true);
    expect(r.path).toEqual([]); // nowhere nearer could be reached: it stays where it is
  });

  it('a goal shut off by walls gives a partial path to the nearest spot that can be reached', () => {
    // A ring round (15..17, 15..17); the goal is inside it.
    const ring: [number, number][] = [];
    for (let i = 14; i <= 18; i++) ring.push([i, 14], [i, 18], [14, i], [18, i]);
    const pf = grid(24, ring);
    const r = pf.find(2.5, 2.5, 16, 16, 17, 17, 0);
    expect(r.partial).toBe(true);
    expect(r.path.length).toBeGreaterThan(0);
    const [ex, ey] = pairs(r.path).at(-1)!;
    expect(pf.isBlocked(Math.floor(ex), Math.floor(ey))).toBe(false);
    // The closest a cell outside the ring comes to the goal is straight out from a side, at (13, 16) or the like.
    expect(rectDist(ex, ey, 16, 16, 17, 17)).toBe(2.5);
    expect(walkable(pf, 2.5, 2.5, r.path)).toBe(true);
  });

  it('a gate in a wall is a way through for its own side, and a wall for anyone else', () => {
    const pf = grid(20);
    for (let y = 0; y < 20; y++) cell(pf, 10, y, 1);
    cell(pf, 10, 10, 2 + 0); // a gate of team 0
    pf.pass = 2 + 0;
    const own = pf.find(3.5, 10.5, 16, 10, 17, 11, 0);
    expect(own.partial).toBe(false);
    expect(walkable(pf, 3.5, 10.5, own.path)).toBe(true);
    pf.pass = 2 + 1;
    const other = pf.find(3.5, 10.5, 16, 10, 17, 11, 0);
    expect(other.partial).toBe(true);
    for (const [x] of pairs(other.path)) expect(x).toBeLessThan(10); // it never got past the wall
  });

  it('a start off the grid or inside solid ground is drawn in, and the first step out of the solid ground is kept', () => {
    const pf = grid(20, [[2, 2]]);
    const off = pf.find(-5, -5, 10, 10, 11, 11, 0);
    expect(off.partial).toBe(false);
    expect(pairs(off.path).at(-1)).toEqual([10.5, 10.5]);
    const inside = pf.find(2.5, 2.5, 15, 2, 16, 3, 0);
    expect(inside.partial).toBe(false);
    const [fx, fy] = pairs(inside.path)[0];
    expect(Math.max(Math.abs(fx - 2.5), Math.abs(fy - 2.5))).toBe(1); // a neighbouring cell's centre, not smoothed away
    expect(pairs(inside.path).at(-1)).toEqual([15.5, 2.5]);
  });

  it('with ground of different costs, goes round a bog that a straight line would cross', () => {
    const n = 30, pf = grid(n);
    const cost = new Float32Array(n * n).fill(1);
    const bog = (x: number, y: number) => x >= 10 && x <= 20 && y <= 24;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (bog(x, y)) cost[y * n + x] = 10;
    // With no costs it goes straight across.
    const straight = pf.find(5.5, 5.5, 25, 5, 26, 6, 0);
    expect(straight.path).toEqual([25.5, 5.5]);
    pf.cost = cost;
    const r = pf.find(5.5, 5.5, 25, 5, 26, 6, 0);
    expect(r.partial).toBe(false);
    expect(pairs(r.path).at(-1)).toEqual([25.5, 5.5]);
    expect(pairs(r.path).some(([, y]) => y > 24)).toBe(true); // round the bottom of the bog
    // Walked along, it hardly sets foot in the bog (the smoothing will not cut across it either).
    let ax = 5.5, ay = 5.5, wet = 0, all = 0;
    for (const [x, y] of pairs(r.path)) {
      for (let s = 0; s < 40; s++) { const px = ax + ((x - ax) * s) / 40, py = ay + ((y - ay) * s) / 40; all++; if (bog(Math.floor(px), Math.floor(py))) wet++; }
      ax = x; ay = y;
    }
    expect(wet / all).toBeLessThan(0.05);
    expect(Pathfinder.MIN_COST).toBeLessThanOrEqual(1);
  });

  it('a road that costs less than open ground is followed even out of the straight way', () => {
    const n = 30, pf = grid(n);
    const cost = new Float32Array(n * n).fill(3);
    for (let x = 0; x < n; x++) cost[20 * n + x] = Pathfinder.MIN_COST; // a road along y = 20
    pf.cost = cost;
    const r = pf.find(2.5, 16.5, 27, 16, 28, 17, 0);
    expect(r.partial).toBe(false);
    expect(pairs(r.path).some(([, y]) => Math.floor(y) === 20)).toBe(true);
  });

  it('works out afresh what can be reached only after touch(): an opening made in a wall is used once the map is touched', () => {
    const n = 60, pf = grid(n);
    for (let y = 0; y < n; y++) cell(pf, 30, y, 1); // a wall the length of the grid
    const shut = pf.find(5.5, 0.5, 55, 0, 56, 1, 0);
    expect(shut.partial).toBe(true);
    cell(pf, 30, n - 1, 0); // a gap at the far end
    // Not yet told: it still believes the far side cannot be reached, and gives up after a short look.
    expect(pf.find(5.5, 0.5, 55, 0, 56, 1, 0).partial).toBe(true);
    pf.touch();
    const open = pf.find(5.5, 0.5, 55, 0, 56, 1, 0);
    expect(open.partial).toBe(false);
    expect(pairs(open.path).some(([, y]) => y > n - 1)).toBe(true);
    expect(walkable(pf, 5.5, 0.5, open.path)).toBe(true);
  });

  it('gives the same path for the same question every time (searches do not leak into one another)', () => {
    const wall: [number, number][] = [];
    for (let y = 0; y < 19; y++) wall.push([10, y]);
    const pf = grid(20, wall);
    const a = pf.find(2.5, 2.5, 17, 2, 18, 3, 0.5);
    pf.find(15.5, 15.5, 0, 0, 1, 1, 0); // another between
    pf.find(2.5, 2.5, 3, 3, 4, 4, 0);
    expect(pf.find(2.5, 2.5, 17, 2, 18, 3, 0.5)).toEqual(a);
  });
});
