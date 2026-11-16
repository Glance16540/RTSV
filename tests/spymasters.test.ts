// Spymasters (src/sim/spymasters.ts): plots are found sooner.
import { describe, expect, it } from 'vitest';
import { SPYMASTERS, spyOdds } from '../src/sim/spymasters';
import { ruleWorld, knowing } from './rulestudies.helpers';

describe('Spymasters', () => {
  it('add to the season\'s chance of laying a plot bare', () => {
    const { c } = ruleWorld();
    expect(spyOdds(c, 0)).toBe(0);
    knowing(c, 0, 'spymasters');
    expect(spyOdds(c, 0)).toBe(SPYMASTERS.odds);
  });
});
