// The name lists (src/sim/data.ts): long enough that a town of a hundred seldom has two of one name, and kept apart.
import { describe, expect, it } from 'vitest';
import { FAMILY_NAMES, NAMES_F, NAMES_M } from '../src/sim/data';
import { TRIBE_NAMES_F, TRIBE_NAMES_M } from '../src/sim/tribenames';

describe('the name lists', () => {
  it('sixty given names a sex and sixty family names, none said twice', () => {
    for (const list of [NAMES_M, NAMES_F, FAMILY_NAMES]) {
      expect(list.length).toBeGreaterThanOrEqual(60);
      expect(new Set(list).size).toBe(list.length);
      for (const n of list) expect(n).toMatch(/^[A-Z][a-z]+$/);
    }
  });
  it('no name is both a man\'s and a woman\'s, and none is a tribe\'s (tribenames.ts)', () => {
    expect(NAMES_M.filter((n) => NAMES_F.includes(n))).toEqual([]);
    const tribe = new Set([...TRIBE_NAMES_M, ...TRIBE_NAMES_F]);
    expect([...NAMES_M, ...NAMES_F].filter((n) => tribe.has(n))).toEqual([]);
  });
});
