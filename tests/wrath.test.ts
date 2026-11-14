// Acts of God fall harder on the decadent than on the holy (src/sim/wrath.ts, docs/DESIGN.md): a Righteous town
// has them at about a third of the rate and a third of the severity, and nobody is spared.
import { describe, expect, it } from 'vitest';
import { FIRE, accident, lightning } from '../src/sim/calamity';
import { CALAMITY } from '../src/sim/data';
import { FAMINE } from '../src/sim/famine';
import { Game } from '../src/sim/game';
import { wrath } from '../src/sim/wrath';
import { run, spot, villagers } from './helpers';

const HOLY = 100, PLAIN = 0, FALLEN = -100;
const town = (virtue = PLAIN, other = PLAIN) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
  g.weatherT = 1e6;
  g.players[0].virtue = virtue; g.players[1].virtue = other;
  return g;
};
const kill = (g: Game, e: unknown) => (g as unknown as { kill(e: unknown): void }).kill(e);
const seconds = (g: Game, n: number, each: () => void) => { for (let s = 0; s < n; s++) { g.tick += 20; g.time += 1; each(); } };

describe('how hard acts of God fall', () => {
  it('a third for the Righteous, a half for the Devout, more for the Worldly and the Decadent, and 1 for what is nobody\'s', () => {
    const of = (v: number) => { const g = town(v); return [g.creed(0).id, wrath(g, 0)] as const; };
    expect(of(HOLY)).toEqual(['zealous', 1 / 3]);
    expect(of(40)).toEqual(['devout', 0.5]);
    expect(of(PLAIN)).toEqual(['temperate', 1]);
    expect(of(-40)[1]).toBe(1.25);
    expect(of(FALLEN)).toEqual(['decadent', 1.5]);
    const g = town();
    expect(wrath(g, g.wild)).toBe(1);
    expect(wrath(g, -1)).toBe(1);
  });

  it('lightning finds a Righteous town a third as often as its ordinary neighbour, and its fire is a third as long', () => {
    const g = town(HOLY, PLAIN);
    // One house each and nothing else standing, so that the two are equal marks but for their creed.
    for (const b of [...g.buildings]) kill(g, b);
    const mine = g.spawnBuilding('house', 0, 20, 20, true), theirs = g.spawnBuilding('house', 1, 60, 60, true);
    let a = 0, b = 0;
    for (let i = 0; i < 6000; i++) {
      g.tick++;
      const hit = lightning(g);
      if (hit === mine) { a++; expect(hit.burnT).toBeCloseTo(FIRE.bolt / 3, 5); }
      if (hit === theirs) { b++; expect(hit.burnT).toBeCloseTo(FIRE.bolt, 5); }
      if (hit) hit.burnT = 0;
    }
    expect(a).toBeGreaterThan(0); // nobody is spared
    expect(a / b).toBeGreaterThan(0.25);
    expect(a / b).toBeLessThan(0.42);
  });

  it('a smithy catches by accident a third as often among the Righteous and half again as often among the Decadent', () => {
    const fires = (virtue: number) => {
      const g = town(virtue);
      const at = spot(g, 'blacksmith', 0);
      const b = g.spawnBuilding('blacksmith', 0, at.cx, at.cy, true);
      b.queue.push({ kind: 'tech', id: 'weapons1', t: 0, time: 1e9 } as never);
      let n = 0, long = 0;
      seconds(g, FIRE.forge * 120, () => { g.players[0].virtue = virtue; const lit = accident(g); if (lit) { n++; long = lit.burnT; lit.burnT = 0; } });
      return { n, long };
    };
    const holy = fires(HOLY), plain = fires(PLAIN), fallen = fires(FALLEN);
    expect(holy.n).toBeGreaterThan(0);
    expect(holy.n / plain.n).toBeGreaterThan(0.2);
    expect(holy.n / plain.n).toBeLessThan(0.5);
    expect(fallen.n / plain.n).toBeGreaterThan(1.2);
    expect(holy.long).toBeCloseTo(FIRE.spark / 3, 5);
    expect(plain.long).toBeCloseTo(FIRE.spark, 5);
    expect(fallen.long).toBeCloseTo(FIRE.spark * 1.5, 5);
  });

  it('fire spreads less through a Righteous town than an ordinary one, and more through a Decadent one', () => {
    const burn = (virtue: number, seed: number) => {
      const g = new Game(seed, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
      g.weatherT = 1e6;
      const tc = g.buildings.find((b) => b.owner === 0)!;
      for (const u of villagers(g, 0)) kill(g, u);
      // A row of houses a tile apart, wherever one will stand.
      const row = [];
      for (let cy = 2; cy + 3 < g.size && row.length < 10; cy += 3) {
        const run = [];
        for (let cx = 2; cx + 3 < g.size && run.length < 10; cx += 3) { if (g.canPlace('house', cx, cy) && Math.hypot(cx - tc.x, cy - tc.y) > 8) run.push(cx); else run.length = 0; }
        if (run.length === 10) for (const cx of run) row.push(g.spawnBuilding('house', 0, cx, cy, true));
      }
      if (row.length < 10) return null;
      row[0].burnT = CALAMITY.fire; row[0].litAt = g.time; row[0].hp -= 1;
      const lit = new Set<number>();
      let longest = 0;
      for (let s = 0; s < 240; s++) {
        g.players[0].virtue = virtue;
        for (const h of row.slice(1)) if (h.burnT > 0 && !lit.has(h.id)) { lit.add(h.id); longest = Math.max(longest, h.burnT); }
        for (let i = 0; i < 20; i++) g.step();
      }
      return { caught: lit.size, longest };
    };
    const sum = (virtue: number) => { let caught = 0, longest = 0, n = 0; for (let seed = 1; seed <= 12; seed++) { const r = burn(virtue, seed); if (r) { caught += r.caught; longest = Math.max(longest, r.longest); n++; } } return { caught, longest, n }; };
    const holy = sum(HOLY), plain = sum(PLAIN), fallen = sum(FALLEN);
    expect(plain.n).toBeGreaterThan(5);
    expect(holy.caught).toBeGreaterThan(0);
    expect(holy.caught).toBeLessThan(plain.caught);
    expect(fallen.caught).toBeGreaterThanOrEqual(plain.caught);
    expect(holy.longest).toBeLessThanOrEqual(CALAMITY.caught / 3 + 0.01);
    expect(plain.longest).toBeLessThanOrEqual(CALAMITY.caught + 0.01);
    expect(fallen.longest).toBeGreaterThan(CALAMITY.caught);
  }, 120000);

  it('a famine takes the Righteous a third as fast and the Decadent half again as fast', () => {
    const lost = (virtue: number) => {
      const g = town(virtue);
      const p = g.players[0], at = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
      for (let i = 0; i < 30; i++) g.spawnUnit('villager', 0, at.x + 4 + (i % 10) * 0.5, at.y + 5 + Math.floor(i / 10) * 0.5);
      p.res.food = 0;
      run(g, FAMINE.starving + FAMINE.toll * 6 + 1, () => { p.res.food = 0; p.virtue = virtue; });
      return p.starved ?? 0;
    };
    expect(lost(PLAIN)).toBe(6);
    expect(lost(HOLY)).toBe(2);
    expect(lost(FALLEN)).toBe(9);
  });
});
