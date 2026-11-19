// The computer and the lie of the land, the night and the weather in a battle (src/sim/aiground.ts).
import { describe, expect, it } from 'vitest';
import { AIGROUND, highGroundNear, holdBack, uphill } from '../src/sim/aiground';
import { Game } from '../src/sim/game';
import { run, setups } from './helpers';

describe('the computer in a battle', () => {
  it('gathers on higher ground near where it would, and nowhere else on a flat map', () => {
    const g = new Game(4, setups, 72, false, false, true);
    run(g, 1);
    const at = { x: 36.5, y: 36.5 };
    const best = highGroundNear(g, at.x, at.y);
    expect(g.heightAt(best.x, best.y)).toBeGreaterThanOrEqual(g.heightAt(at.x, at.y));
    expect(Math.hypot(best.x - at.x, best.y - at.y)).toBeLessThanOrEqual(AIGROUND.look + 1);
    const flat = new Game(4, setups, 72);
    expect(highGroundNear(flat, at.x, at.y)).toEqual(at);
  });

  it('holds back while the weaker in a storm or by night, not when the stronger, and not for ever', () => {
    const g = new Game(4, setups, 72);
    run(g, 1);
    const here = { x: 10, y: 10 };
    expect(holdBack(g, { ours: 5, theirs: 9, from: here, waited: 0 })).toBe('');
    g.weather = 'rain'; g.weatherAmt = 1;
    expect(holdBack(g, { ours: 5, theirs: 9, from: here, waited: 0 })).toBe('storm');
    expect(holdBack(g, { ours: 12, theirs: 9, from: here, waited: 0 })).toBe('');
    expect(holdBack(g, { ours: 5, theirs: 9, from: here, waited: AIGROUND.hold })).toBe('');
    g.weatherAmt = 0;
    g.time = g.dayLength * 0.8; // night
    if (g.night) expect(holdBack(g, { ours: 5, theirs: 9, from: here, waited: 0 })).toBe('night');
  });

  it('will not go uphill at an enemy standing clearly higher without half again its strength', () => {
    const g = new Game(4, setups, 72, false, false, true);
    run(g, 1);
    let lo = { x: 0, y: 0 }, hi = { x: 0, y: 0 }, d = 0;
    for (let y = 6; y < 66; y += 3) for (let x = 6; x < 66; x += 3) for (let y2 = 6; y2 < 66; y2 += 9) for (let x2 = 6; x2 < 66; x2 += 9) {
      const k = g.heightAt(x2, y2) - g.heightAt(x, y);
      if (k > d) { d = k; lo = { x, y }; hi = { x: x2, y: y2 }; }
    }
    expect(uphill(g, lo, hi)).toBe(true);
    expect(holdBack(g, { ours: 10, theirs: 9, from: lo, to: hi, waited: 0 })).toBe('uphill');
    expect(holdBack(g, { ours: 14, theirs: 9, from: lo, to: hi, waited: 0 })).toBe('');
    expect(holdBack(g, { ours: 10, theirs: 9, from: hi, to: lo, waited: 0 })).toBe(''); // downhill is no reason
  });
});
