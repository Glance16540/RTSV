// The hours of the day: a day of any length runs the same course, and with night switched off it never comes.
import { describe, expect, it } from 'vitest';
import { DAY_LENGTHS, DUSK, dayPhase } from '../src/sim/daylight';
import { DAY_LENGTH, Game } from '../src/sim/game';
import { setups } from './helpers';

describe('the hours of the day', () => {
  it('run as they always did when nothing is set', () => {
    const g = new Game(5, setups);
    expect(g.dayLength).toBe(DAY_LENGTH);
    for (const t of [0, 40, 150, 210, 299, 300, 725]) { g.time = t; expect(g.dayT).toBeCloseTo((t % DAY_LENGTH) / DAY_LENGTH, 10); }
    g.time = DAY_LENGTH * 0.8;
    expect(g.night).toBe(true);
  });

  it('take the length the player chose, with night still the last three tenths', () => {
    for (const len of DAY_LENGTHS) {
      const g = new Game(5, setups);
      g.dayLength = len;
      g.time = len * 0.69; expect(g.night).toBe(false);
      g.time = len * 0.71; expect(g.night).toBe(true);
      g.time = len * 1.5; expect(g.dayT).toBeCloseTo(0.5, 10);
    }
  });

  it('never reach night when it is switched off, and never jump', () => {
    const g = new Game(5, setups);
    g.nightless = true;
    let last = g.dayT, most = 0;
    for (let t = 0; t < DAY_LENGTH * 4; t += 0.5) {
      g.time = t;
      expect(g.night).toBe(false);
      expect(g.dayT).toBeLessThanOrEqual(DUSK);
      expect(Math.abs(g.dayT - last)).toBeLessThan(0.01); // no leap from dusk straight back to dawn
      most = Math.max(most, g.dayT);
      last = g.dayT;
    }
    expect(most).toBeGreaterThan(DUSK - 0.01); // it does get as far as dusk
  });

  it('pass at the same pace with night off as with it on', () => {
    expect(dayPhase(60, 300, true)).toBeCloseTo(dayPhase(60, 300, false), 10);
    expect(dayPhase(DUSK * 300 + 30, 300, true)).toBeCloseTo(DUSK - 30 / 300, 10); // turning back toward morning
  });
});
