// How long until something, in words (src/sim/inyears.ts).
import { expect, it } from 'vitest';
import { inTime } from '../src/sim/inyears';

it('says seasons as a person would, in years once there are a year of them', () => {
  expect(inTime(0)).toBe('now');
  expect(inTime(1)).toBe('next season');
  expect(inTime(3)).toBe('in 3 seasons');
  expect(inTime(4)).toBe('in a year');
  expect(inTime(55)).toBe('in 14 years');
});
