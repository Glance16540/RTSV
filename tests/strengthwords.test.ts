// Strengths told in whole numbers and words (src/sim/strengthwords.ts).
import { expect, it } from 'vitest';
import { inAll, strengthOf, whole } from '../src/sim/strengthwords';

it('never tells a fraction of strength', () => {
  expect(whole(0.3)).toBe('a little');
  expect(whole(0.9)).toBe('1');
  expect(strengthOf(0.9)).toBe('a strength of 1 (weak)');
  expect(strengthOf(6.4)).toBe('a strength of 6 (strong)');
  expect(inAll([0.9, 0.5, 11, 1], 13.4)).toBe('about 13 in all');
  expect(inAll([1, 2, 3], 6)).toBe('6 in all');
});
