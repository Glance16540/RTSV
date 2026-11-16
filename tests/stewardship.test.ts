// Stewardship (src/sim/stewardship.ts): a better governor finishes what he has begun the faster.
import { describe, expect, it } from 'vitest';
import { STEWARDSHIP, stewardPace } from '../src/sim/stewardship';
import { governTown } from '../src/sim/governor';
import { ruleWorld, knowing } from './rulestudies.helpers';

describe('Stewardship', () => {
  it('what the governor has begun goes up half again as fast', () => {
    const begun = (steward: boolean): number => {
      const { c, tid } = ruleWorld();
      if (steward) knowing(c, 0, 'stewardship');
      c.territories[tid].town!.b.push(['house', 40, 40, 0.01, 0]);
      governTown(c, tid);
      return c.territories[tid].town!.b.find((x) => x[0] === 'house' && x[1] === 40)![4] ?? 1;
    };
    expect(begun(true)).toBeGreaterThan(begun(false));
    const { c, tid } = ruleWorld();
    expect(stewardPace(c, tid)).toBe(1);
    knowing(c, 0, 'stewardship');
    expect(stewardPace(c, tid)).toBe(STEWARDSHIP.build);
  });
});
