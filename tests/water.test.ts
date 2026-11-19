// The water of a battle's ground as the land round it has it (src/sim/waterlay.ts, src/sim/townwater.ts, map.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { newCampaign, terrainOf } from '../src/sim/campaign';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { generateMap, T_WATER } from '../src/sim/map';
import { WATER_LAY, layWater } from '../src/sim/waterlay';
import { RIVER_NAME, TOWN_WATER, waterOf } from '../src/sim/townwater';

const N = 72, corners = [{ x: 17, y: 17 }, { x: N - 17, y: 17 }, { x: N - 17, y: N - 17 }, { x: 17, y: N - 17 }];
const wetAt = (t: Uint8Array, x: number, y: number): boolean => t[Math.floor(y) * N + Math.floor(x)] === T_WATER;
const dryRing = (t: Uint8Array, c: { x: number; y: number }): boolean => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) < WATER_LAY.keep && t[y * N + x] === T_WATER) return false; return true; };

describe('laying water on a ground', () => {
  it('a shore lies on the side the sea is, the more of it the more sea there is, and the home stays dry', () => {
    const a = new Uint8Array(N * N), b = new Uint8Array(N * N);
    const few = layWater(a, N, 9, { corner: 2, shore: { angle: -Math.PI / 2, share: 0.1 }, dry: [2] }, corners); // the sea to the north of the town
    const many = layWater(b, N, 9, { corner: 2, shore: { angle: -Math.PI / 2, share: 0.6 }, dry: [2] }, corners);
    expect(many).toBeGreaterThan(few);
    expect(wetAt(b, N - 17, 3)).toBe(true); // north of the town
    expect(wetAt(b, N - 17, N - 3)).toBe(false); // south of it
    expect(dryRing(a, corners[2]) && dryRing(b, corners[2])).toBe(true);
  });

  it('islands stand out in a wide sea', () => {
    const plain = new Uint8Array(N * N), isles = new Uint8Array(N * N);
    const sea = layWater(plain, N, 4, { corner: 2, shore: { angle: -Math.PI / 2, share: 0.9 }, dry: [2] }, corners);
    const less = layWater(isles, N, 4, { corner: 2, shore: { angle: -Math.PI / 2, share: 0.9 }, islands: 3, dry: [2] }, corners);
    expect(less).toBeLessThan(sea);
  });

  it('a river runs across the ground with fords: the far bank can be reached on foot', () => {
    const t = new Uint8Array(N * N);
    layWater(t, N, 6, { corner: 2, river: { angle: 0, offset: -0.4 }, dry: [2] }, corners); // east to west, north of the town
    let wet = 0; for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (t[y * N + x] === T_WATER) wet++;
    expect(wet).toBeGreaterThan(N);
    // From the town's corner to the far side, over dry ground only.
    const seen = new Uint8Array(N * N), q = [corners[2].y * N + corners[2].x]; seen[q[0]] = 1;
    while (q.length) { const i = q.pop()!, x = i % N, y = (i / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * N + nx; if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen[j] || t[j] === T_WATER) continue; seen[j] = 1; q.push(j); } }
    expect(seen[2 * N + 36]).toBe(1);
  });

  it('a ground with no water of its own is laid exactly as before', () => {
    const a = generateMap(5, N, 4, true, true, ''), b = generateMap(5, N, 4, true, true, '', {});
    expect([...a.terrain]).toEqual([...b.terrain]);
    expect(a.nodes).toEqual(b.nodes);
  });
});

describe('a town\'s water, from the campaign map', () => {
  it('a town on the coast has a shore; a town with none has no water; the same each time', () => {
    let coasts = 0, dryTowns = 0;
    for (const seed of [3, 5, 7]) {
      const c = newCampaign(seed, 2);
      for (const t of c.territories.filter((x) => !x.rim)) {
        const w = waterOf(c, t.id, terrainOf(c));
        expect(waterOf(c, t.id, terrainOf(c))).toEqual(w);
        if (t.trait === 'coast') { expect(w?.shore).toBeDefined(); coasts++; }
        if (!w) dryTowns++;
        if (w) expect(w.corner).toBe(t.town?.at ?? 2);
      }
    }
    expect(coasts).toBeGreaterThan(0);
    expect(dryTowns).toBeGreaterThan(0);
  });

  it('a visit to a coastal town has its shore: water by the town, fish in it, room for a dock, the hall on dry ground; restored the same', () => {
    for (const seed of [3, 5, 7, 11]) {
      const c = newCampaign(seed, 2), t = c.territories.find((x) => x.trait === 'coast' && !x.horde && !x.rim && x.capital < 0 && x.folk);
      if (!t) continue;
      t.owner = 0; // a coastal town of the player's, to visit
      expect(beginVisit(c, t.id)).toBe(true);
      const cfg = visitConfig(c)!;
      expect(cfg.setups[0].water?.shore).toBeDefined();
      const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
      const water = g.terrain.filter((v) => v === T_WATER).length;
      expect(water).toBeGreaterThan(cfg.size * 4);
      expect(g.resources.filter((r) => r.type === 'fish').length).toBeGreaterThan(0);
      let dock = false;
      for (let y = 2; y < g.size - 4 && !dock; y++) for (let x = 2; x < g.size - 4 && !dock; x++) dock = g.canPlace('dock', x, y);
      expect(dock).toBe(true);
      const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter');
      if (tc) expect(g.terrain[Math.floor(tc.y) * g.size + Math.floor(tc.x)]).not.toBe(T_WATER);
      const back = Game.restore(g.serialize());
      expect([...back.terrain]).toEqual([...g.terrain]);
      return;
    }
    throw new Error('no coastal town of the player\'s');
  }, 60_000);
});

describe('names and fields', () => {
  it('a town named for a river has one on its ground, wherever it lies; one not so named has the water it had', () => {
    let named = 0;
    for (const seed of [3, 5, 7, 11, 13]) {
      const c = newCampaign(seed, 2), T = terrainOf(c);
      for (const t of c.territories.filter((x) => !x.rim)) {
        const w = waterOf(c, t.id, T);
        if (RIVER_NAME.test(t.name)) { named++; expect(w?.river).toBeDefined(); expect(Math.abs(w!.river!.offset)).toBeLessThanOrEqual(TOWN_WATER.riverOff); }
      }
    }
    expect(named).toBeGreaterThan(5);
    // Riverbend, which had no river within reach, has one now.
    const c = newCampaign(4, 1, 1, 'hearth'), rb = c.territories.find((t) => t.name === 'Riverbend');
    if (rb) expect(waterOf(c, rb.id, terrainOf(c))?.river).toBeDefined();
  });

  it('a field battle\'s water is where the field lies, between the lands, and laid from the middle of the ground', () => {
    for (const seed of [3, 5, 7]) {
      const c = newCampaign(seed, 2), T = terrainOf(c);
      for (const t of c.territories.filter((x) => !x.rim)) for (const n of t.adj) {
        const u = c.territories[n], at = { x: (t.x + u.x) / 2, y: (t.y + u.y) / 2 };
        const w = waterOf(c, t.id, T, at);
        if (!w?.shore) continue;
        expect(w.corner).toBe(-1);
        const g = new Uint8Array(56 * 56), cs = [{ x: 17, y: 17 }, { x: 39, y: 39 }];
        layWater(g, 56, 1, w, cs);
        // Laid from the middle: the middle is dry, the sea lies on its side of it, and not on the other.
        const wetAt56 = (x: number, y: number) => g[Math.min(55, Math.max(0, Math.round(y))) * 56 + Math.min(55, Math.max(0, Math.round(x)))] === T_WATER;
        const dx = Math.cos(w.shore.angle), dy = Math.sin(w.shore.angle);
        expect(wetAt56(28, 28)).toBe(false);
        expect(wetAt56(28 + dx * 27, 28 + dy * 27)).toBe(true);
        expect(wetAt56(28 - dx * 20, 28 - dy * 20)).toBe(false);
        return;
      }
    }
  });
});
