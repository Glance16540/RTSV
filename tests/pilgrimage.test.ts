// Pilgrimage (src/sim/pilgrimage.ts): towns are drawn to the nation's faith faster.
import { describe, expect, it } from 'vitest';
import { PILGRIMAGE, pilgrimPull } from '../src/sim/pilgrimage';
import { pullTogether, swayTown, faithAt } from '../src/sim/townfaith';
import { ruleWorld, knowing } from './rulestudies.helpers';

describe('Pilgrimage', () => {
  it('a town far from its nation\'s faith is drawn the faster toward it', () => {
    const gap = (pilgrims: boolean): number => {
      const { c, tid } = ruleWorld();
      const other = c.territories[tid].adj.find((n) => !c.territories[n].horde)!;
      c.territories[other].owner = 0;
      swayTown(c, tid, 60 - faithAt(c, tid)); swayTown(c, other, -60 - faithAt(c, other));
      if (pilgrims) knowing(c, 0, 'pilgrimage');
      pullTogether(c);
      return Math.abs(faithAt(c, tid) - faithAt(c, other));
    };
    expect(gap(true)).toBeLessThan(gap(false));
    const { c } = ruleWorld();
    knowing(c, 0, 'pilgrimage');
    expect(pilgrimPull(c, 0)).toBe(PILGRIMAGE.pull);
  });
});
