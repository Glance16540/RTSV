// A house is not forgotten when its men come home (src/sim/housekeep.ts, read by warhouse.ts).
import { describe, expect, it } from 'vitest';
import { homesFor, keepIdle } from '../src/sim/housekeep';
import type { WarHouse } from '../src/sim/warhouse';
import type { Folk } from '../src/sim/township';

const folk = (women: number) => ({ men: 10, women, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] }) as Folk;
const house = (family: string, seen?: number, away = 0): WarHouse => ({ family, away: Array.from({ length: away }, (_, i) => ({ name: `M${i}`, as: 'son' as const, since: 1 })), ...(seen !== undefined ? { seen } : {}) });

describe('houses kept by name', () => {
  it('a town has a home for one house to each of its women, and at least one', () => {
    expect(homesFor(folk(6))).toBe(6);
    expect(homesFor(folk(0))).toBe(1);
  });

  it('idle houses are kept while there are homes over the busy ones, the most lately at war first', () => {
    const busy = [house('Away', undefined, 1)];
    const idle = [house('Old', 3), house('New', 30), house('Mid', 12), house('Never')];
    expect(keepIdle(folk(3), busy, idle, 40).map((h) => h.family)).toEqual(['New', 'Mid']);
    expect(busy[0].seen).toBe(40); // a house with a man away is marked as at war now
    expect(keepIdle(folk(1), busy, idle, 41)).toEqual([]); // no home to spare
    expect(keepIdle(folk(10), [], idle, 41).map((h) => h.family)).toEqual(['New', 'Mid', 'Old', 'Never']);
  });
});
