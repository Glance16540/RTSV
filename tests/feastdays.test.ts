// Feast Days (src/sim/feastdays.ts): a yearly lift in a town's standing.
import { describe, expect, it } from 'vitest';
import { FEAST_DAYS, feastSeason } from '../src/sim/feastdays';
import { faithAt } from '../src/sim/townfaith';
import { SEASONS_A_YEAR } from '../src/sim/ageing';
import { ruleWorld, knowing } from './rulestudies.helpers';

describe('Feast Days', () => {
  it('once a year, every town of a nation that keeps them is lifted', () => {
    const { c, tid } = ruleWorld();
    c.turn = SEASONS_A_YEAR * 3;
    expect(feastSeason(c)).toBe(0);
    knowing(c, 0, 'feastdays');
    const was = faithAt(c, tid);
    expect(feastSeason(c)).toBeGreaterThan(0);
    expect(faithAt(c, tid)).toBe(Math.min(100, was + FEAST_DAYS.lift));
    c.turn++;
    expect(feastSeason(c)).toBe(0); // not in the other seasons
  });
});
