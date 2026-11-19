// Why a building cannot be placed on a spot (src/sim/placebar.ts): the same tests as Game.canPlace, with their reasons.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { BUILDINGS } from '../src/sim/data';
import { T_WATER } from '../src/sim/map';
import { placeBar } from '../src/sim/placebar';
import { setups, spot } from './helpers';

describe('why a spot is refused', () => {
  it('gives a reason exactly where canPlace refuses, over a whole map and every kind of building, flat and hilly', () => {
    for (const relief of [false, true]) {
      const g = new Game(13, setups, 96, false, true, relief);
      let refused = 0;
      for (const type of ['house', 'barracks', 'dock', 'towncenter', 'palisade']) for (let cy = -1; cy < 98; cy += 3) for (let cx = -1; cx < 98; cx += 3) {
        const ok = g.canPlace(type, cx, cy, true), why = placeBar(g, type, cx, cy, true);
        expect(why === '').toBe(ok);
        if (!ok) refused++;
      }
      expect(refused).toBeGreaterThan(100);
    }
  });

  it('names the edge, water, a building standing there, and steep ground', () => {
    const g = new Game(13, setups, 96, false, true, true);
    expect(placeBar(g, 'house', 0, 0)).toMatch(/edge/);
    const w = g.terrain.findIndex((t, i) => t === T_WATER && i % 96 > 2 && i % 96 < 90 && i / 96 > 2 && i / 96 < 90);
    expect(placeBar(g, 'house', w % 96, Math.floor(w / 96))).toMatch(/Water/);
    const tc = g.buildings.find((b) => b.type === 'towncenter' && b.owner === 0)!;
    expect(placeBar(g, 'house', tc.cx, tc.cy)).toMatch(/Your town center stands there/i);
    let steep = 0;
    for (let cy = 2; cy < 90 && !steep; cy++) for (let cx = 2; cx < 90; cx++) if (/steep/.test(placeBar(g, 'barracks', cx, cy))) { steep++; break; }
    expect(steep).toBe(1);
    const at = spot(g, 'house', 0);
    expect(placeBar(g, 'house', at.cx, at.cy)).toBe('');
  });

  it('an order refused says why, not only that it cannot be built', () => {
    const g = new Game(13, setups, 96, false, true, true);
    const tc = g.buildings.find((b) => b.type === 'towncenter' && b.owner === 0)!;
    g.players[0].res.wood = 9999;
    expect(g.cmdPlace(0, 'house', tc.cx, tc.cy, [])).toBeNull();
    expect(g.events.some((e) => e.t === 'msg' && /stands there/.test(e.text))).toBe(true);
    expect(BUILDINGS.house).toBeDefined();
  });
});
