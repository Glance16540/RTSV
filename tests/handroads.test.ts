// Roads laid and lifted by hand (src/sim/handroads.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { HAND_ROADS, cmdLayRoad, cmdLiftRoad, handRoadsOut, roadBar, roadLine } from '../src/sim/handroads';
import { run, setups, spot } from './helpers';

const town = () => {
  const g = new Game(5, setups, 96);
  const tc = g.buildings.find((b) => b.type === 'towncenter' && b.owner === 0)!;
  // A run of open ground beside the hall.
  for (let y = tc.cy - 8; y < tc.cy + 12; y++) for (let x = tc.cx - 8; x < tc.cx + 12; x++) {
    const tiles = roadLine(x, y, x + 5, y);
    if (tiles.every(([a, b]) => !roadBar(g, 0, a, b))) return { g, tc, tiles };
  }
  throw new Error('no open ground');
};

describe('a road laid by hand', () => {
  it('takes open ground near the town, and people go faster on it', () => {
    const { g, tiles } = town();
    const i = tiles[0][1] * g.size + tiles[0][0], cost = g.moveCost[i], v = g.roadVersion;
    expect(cmdLayRoad(g, 0, tiles)).toBe(6);
    expect(g.road[i]).toBe(1);
    expect(g.moveCost[i]).toBeCloseTo(cost * 0.6);
    expect(g.roadVersion).toBeGreaterThan(v);
    expect(handRoadsOut(g, 0)).toEqual(tiles);
    expect(handRoadsOut(g, 1)).toEqual([]);
    expect(roadBar(g, 0, tiles[0][0], tiles[0][1])).toMatch(/already/);
  });

  it('not on a building, not far from a town centre of one\'s own, and no more than so many tiles at once', () => {
    const { g, tc } = town();
    expect(roadBar(g, 0, tc.cx, tc.cy)).toMatch(/Something stands here/);
    const foe = g.buildings.find((b) => b.type === 'towncenter' && b.owner === 1)!;
    expect(roadBar(g, 0, Math.floor(foe.x) + 3, Math.floor(foe.y) + 3)).toMatch(/far|stands|seen/);
    expect(roadLine(0, 0, 100, 0)).toHaveLength(HAND_ROADS.most);
    for (const [[x0, y0], [x1, y1]] of roadLine(3, 3, 9, 7).map((p, k, a) => [p, a[k + 1] ?? p])) expect(Math.abs(x1 - x0) + Math.abs(y1 - y0)).toBeLessThanOrEqual(1); // no diagonal gaps
  });

  it('can be lifted, and so can a road worn to a building of one\'s own, but not another\'s', () => {
    const { g, tiles } = town();
    cmdLayRoad(g, 0, tiles);
    const [x, y] = tiles[2], i = y * g.size + x, cost = g.moveCost[i];
    expect(cmdLiftRoad(g, 1, x, y)).toBe(false);
    expect(cmdLiftRoad(g, 0, x, y)).toBe(true);
    expect(g.road[i]).toBe(0);
    expect(g.moveCost[i]).toBeCloseTo(cost / 0.6);
    expect(handRoadsOut(g, 0)).toHaveLength(5);
    // A house's road, worn to the hall.
    const at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true), worn = g.roadOf.get(h.id)!;
    const j = worn[worn.length - 1];
    expect(cmdLiftRoad(g, 0, j % g.size, Math.floor(j / g.size))).toBe(true);
    expect(g.roadOf.get(h.id)).not.toContain(j);
  });

  it('stays when a new town centre lays the town\'s roads afresh, and in a saved game', () => {
    const { g, tiles } = town();
    cmdLayRoad(g, 0, tiles);
    const at = spot(g, 'towncenter', 0);
    g.spawnBuilding('towncenter', 0, at.cx, at.cy, true);
    expect(handRoadsOut(g, 0)).toEqual(tiles);
    const back = Game.restore(g.serialize());
    expect(handRoadsOut(back, 0)).toEqual(tiles);
    const [x, y] = tiles[0];
    expect(back.road[y * back.size + x]).toBe(g.road[y * g.size + x]);
  });
});

describe('the town keeps them from visit to visit', () => {
  it('a visit\'s roads are kept on the town\'s record, and laid again the next time, once', () => {
    const c = newCampaign(3), at = c.territories.find((t) => t.owner === 0)!.id;
    expect(beginVisit(c, at)).toBe(true);
    let cfg = visitConfig(c)!;
    let g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    run(g, 1);
    const tc = g.buildings.find((b) => b.type === 'towncenter' && b.owner === 0)!;
    let tiles: [number, number][] = [];
    for (let y = tc.cy - 10; y < tc.cy + 12 && !tiles.length; y++) for (let x = tc.cx - 10; x < tc.cx + 12; x++) { const t = roadLine(x, y, x + 4, y); if (t.every(([a, b]) => !roadBar(g, 0, a, b))) { tiles = t; break; } }
    expect(cmdLayRoad(g, 0, tiles)).toBe(5);
    finishVisit(c, { town: g.standing(0), roads: handRoadsOut(g, 0) });
    expect(c.territories[at].town!.roads).toEqual(tiles);
    c.turn++;
    expect(beginVisit(c, at)).toBe(true);
    cfg = visitConfig(c)!;
    expect(cfg.setups[0].bonus!.roads).toEqual(tiles);
    g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    run(g, 3);
    expect(handRoadsOut(g, 0)).toEqual(tiles);
    // A saved game of the visit restores them once, not twice over.
    const back = Game.restore(g.serialize());
    run(back, 2);
    expect(handRoadsOut(back, 0)).toEqual(tiles);
  }, 60_000);
});
