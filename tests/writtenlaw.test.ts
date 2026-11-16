// Written Law (src/sim/writtenlaw.ts): unrest is less likely, and resentment eases the faster.
import { describe, expect, it } from 'vitest';
import { WRITTEN_LAW, lawEase, lawUnrest } from '../src/sim/writtenlaw';
import { goodRule } from '../src/sim/conquered';
import { ruleWorld, knowing } from './rulestudies.helpers';

describe('Written Law', () => {
  it('a taken town\'s resentment eases the faster, and unrest is the less likely', () => {
    const { c, tid } = ruleWorld();
    const before = goodRule(c, tid);
    expect(lawUnrest(c, tid)).toBe(1);
    knowing(c, 0, 'writtenlaw');
    expect(lawEase(c, tid)).toBe(WRITTEN_LAW.yoke);
    expect(goodRule(c, tid)).toBe(before + WRITTEN_LAW.yoke);
    expect(lawUnrest(c, tid)).toBe(WRITTEN_LAW.unrest);
  });
});
