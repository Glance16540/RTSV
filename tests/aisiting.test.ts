// Where the computer sets its buildings down (src/sim/aisiting.ts).
import { describe, expect, it } from 'vitest';
import { bestSite, level, siteCost, SITING, wallRadius, wantsHeight } from '../src/sim/aisiting';
import { AIController } from '../src/sim/ai';
import { BUILDINGS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { T_GRASS, T_SAND } from '../src/sim/map';
import { run, setups } from './helpers';

const lay = (g: Game, cx: number, cy: number, s: number, f: (i: number) => void): void => {
  for (let y = cy; y < cy + s; y++) for (let x = cx; x < cx + s; x++) f(y * g.size + x);
};

describe('the computer\'s siting', () => {
  it('takes a spot off its roads where the ring has one, and a road spot where it has none', () => {
    const g = new Game(4, setups, 72);
    const s = BUILDINGS.house.size, a = { cx: 20, cy: 20 }, b = { cx: 30, cy: 30 };
    lay(g, a.cx, a.cy, s, (i) => { g.road[i] = 1; });
    expect(siteCost(g, 'house', s, a.cx, a.cy)).toBeGreaterThanOrEqual(SITING.road);
    expect(bestSite(g, 'house', s, [a, b])).toBe(b);
    lay(g, b.cx, b.cy, s, (i) => { g.road[i] = 1; });
    expect(bestSite(g, 'house', s, [a, b])).toBe(a); // a crowded town still builds: the first, as before
    expect(bestSite(g, 'house', s, [])).toBeNull();
  });

  it('puts a field on grass rather than sand, and other buildings anywhere free', () => {
    const g = new Game(4, setups, 72);
    const s = BUILDINGS.farm.size, sand = { cx: 20, cy: 20 }, grass = { cx: 30, cy: 30 };
    lay(g, sand.cx, sand.cy, s, (i) => { g.terrain[i] = T_SAND; });
    lay(g, grass.cx, grass.cy, s, (i) => { g.terrain[i] = T_GRASS; });
    expect(bestSite(g, 'farm', s, [sand, grass])).toBe(grass);
    expect(bestSite(g, 'house', BUILDINGS.house.size, [sand, grass])).toBe(sand);
  });

  it('puts a tower on higher ground and a field on level ground where the land rises, and nothing on a cliff', () => {
    const g = new Game(4, setups, 72, false, false, true);
    const ts = BUILDINGS.tower.size, fs = BUILDINGS.farm.size;
    expect(wantsHeight(g, 'tower')).toBe(true);
    expect(wantsHeight(g, 'house')).toBe(false);
    expect(wantsHeight(new Game(4, setups, 72), 'tower')).toBe(false);
    const low = { cx: 20, cy: 20 }, high = { cx: 30, cy: 30 };
    lay(g, low.cx, low.cy, Math.max(ts, fs), (i) => { g.spec.height[i] = 0.2; });
    lay(g, high.cx, high.cy, Math.max(ts, fs), (i) => { g.spec.height[i] = 1.4; });
    expect(bestSite(g, 'tower', ts, [low, high])).toBe(high);
    const rough = { cx: 40, cy: 40 };
    lay(g, rough.cx, rough.cy, fs, (i) => { g.spec.height[i] = 1; });
    g.spec.height[rough.cy * g.size + rough.cx] = 0.75; // uneven, but still level enough to build on
    expect(level(g, fs, rough.cx, rough.cy)).toBe(true);
    expect(bestSite(g, 'farm', fs, [rough, low])).toBe(low);
    g.spec.height[rough.cy * g.size + rough.cx] = 0; // a cliff
    expect(level(g, fs, rough.cx, rough.cy)).toBe(false);
    expect(siteCost(g, 'house', fs, rough.cx, rough.cy)).toBe(Infinity);
  });

  it('lays its palisade at the old ring on flat land, and further out only for clearly higher ground', () => {
    const flat = new Game(4, setups, 72);
    expect(wallRadius(flat, 36, 36)).toBe(SITING.rings[0]);
    const g = new Game(4, setups, 72, false, false, true);
    g.spec.height.fill(0.5);
    expect(wallRadius(g, 36, 36)).toBe(SITING.rings[0]);
    for (let i = -18; i <= 18; i++) for (const [x, y] of [[36 + i, 18], [36 + i, 54], [18, 36 + i], [54, 36 + i]]) g.spec.height[y * g.size + x] = 1.5;
    expect(wallRadius(g, 36, 36)).toBe(18);
  });

  it('raises its town off its own roads', () => {
    const g = new Game(5, [{ ...setups[0], isAI: true }, { ...setups[1], isAI: true }]);
    const ais = [0, 1].map((i) => { const c = new AIController(g, i); c.setLevel(1); return c; });
    let placed = 0, onRoad = 0;
    const place = g.cmdPlace.bind(g);
    g.cmdPlace = ((pid: number, type: string, cx: number, cy: number, ids: number[]) => {
      const s = BUILDINGS[type]?.size ?? 1;
      let road = false;
      lay(g, cx, cy, s, (i) => { if (g.road[i]) road = true; });
      const b = place(pid, type, cx, cy, ids);
      if (b && !BUILDINGS[type]?.wall && type !== 'gate') { placed++; if (road) onRoad++; }
      return b;
    }) as typeof g.cmdPlace;
    run(g, 12 * 60, () => ais.forEach((a) => a.update()));
    expect(placed).toBeGreaterThan(10);
    expect(onRoad / placed).toBeLessThan(0.1);
  }, 60000);
});
