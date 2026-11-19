// A march uphill is slower by the grade, and downhill a little quicker (src/sim/slopes.ts).
import { describe, expect, it } from 'vitest';
import { SLOPE, slopePace } from '../src/sim/slopes';
import { Game } from '../src/sim/game';
import { run, setups } from './helpers';

const ramp = (rise: number) => ({ relief: true, heightAt: (x: number) => x * rise });

describe('slopes on the march', () => {
  it('slows a climb by its grade, quickens a descent a little, and leaves the flat alone', () => {
    expect(slopePace(ramp(0), 0, 0, 5, 0)).toBe(1);
    const up = slopePace(ramp(0.3), 0, 0, 1, 0), down = slopePace(ramp(0.3), 1, 0, 0, 0);
    expect(up).toBeCloseTo(1 / (1 + SLOPE.up * 0.3));
    expect(down).toBeCloseTo(1 + SLOPE.down * 0.3);
    expect(up).toBeLessThan(1);
    expect(down).toBeGreaterThan(1);
    expect(down - 1).toBeLessThan(1 - up); // down is the smaller help
  });

  it('is bounded both ways, and nothing on a map without relief', () => {
    expect(slopePace(ramp(5), 0, 0, 1, 0)).toBe(SLOPE.slowest);
    expect(slopePace(ramp(5), 1, 0, 0, 0)).toBe(SLOPE.fastest);
    expect(slopePace({ relief: false, heightAt: (x) => x * 9 }, 0, 0, 1, 0)).toBe(1);
  });

  it('takes a soldier longer to climb a hill than to come down it, in a battle', () => {
    const g = new Game(4, setups, 72, false, false, true);
    run(g, 1);
    // The steepest step on the map from one free tile to a free neighbour.
    let best = { a: [0, 0], b: [0, 0], d: 0 };
    for (let y = 8; y < 64; y += 2) for (let x = 8; x < 60; x += 2) {
      if (g.blocked[y * 72 + x] || g.blocked[y * 72 + x + 6]) continue;
      const d = g.heightAt(x + 6.5, y + 0.5) - g.heightAt(x + 0.5, y + 0.5);
      if (Math.abs(d) > Math.abs(best.d) && g.pf.lineClear(x + 0.5, y + 0.5, x + 6.5, y + 0.5)) best = { a: [x + 0.5, y + 0.5], b: [x + 6.5, y + 0.5], d };
    }
    expect(Math.abs(best.d)).toBeGreaterThan(0.3);
    const [lo, hi] = best.d > 0 ? [best.a, best.b] : [best.b, best.a];
    const time = (from: number[], to: number[]): number => {
      const u = g.spawnUnit('spearman', 0, from[0], from[1], 'm');
      g.cmdMove(0, [u.id], to[0], to[1]);
      let t = 0;
      for (; t < 60 && Math.hypot(u.x - to[0], u.y - to[1]) > 0.3; t += 0.05) g.step();
      (g as unknown as { kill(e: unknown): void }).kill(u);
      return t;
    };
    expect(time(lo, hi)).toBeGreaterThan(time(hi, lo));
  });
});
