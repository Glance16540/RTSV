// The thread through the missions: three missions tied by the riders of the steppe, each with a line before and after.
import { describe, expect, it } from 'vitest';
import { THREADS, chapterOf, nextInThread, threadTag } from '../src/sim/missionstory';
import { missionById } from '../src/sim/scenario';

describe('The Riders from the East', () => {
  it('names only missions there are, each once, with words before and after', () => {
    const seen = new Set<string>();
    for (const t of THREADS) for (const c of t.chapters) {
      expect(missionById(c.mission), c.mission).toBeTruthy();
      expect(seen.has(c.mission)).toBe(false);
      seen.add(c.mission);
      expect(c.before.length).toBeGreaterThan(60);
      expect(c.after.length).toBeGreaterThan(60);
    }
  });

  it('goes from the Franks\' valley to the steppe and to the Roman border, and ends there', () => {
    expect(nextInThread('hearth')).toBe('grass');
    expect(nextInThread('grass')).toBe('line');
    expect(nextInThread('line')).toBe(undefined);
    expect(threadTag('grass')).toBe('The Riders from the East, 2 of 3');
    expect(chapterOf('stockade')).toBe(undefined);
    expect(threadTag('stockade')).toBe('');
  });

  it('is about the people the missions themselves set against each other', () => {
    // The riders are the steppe people in each: the far tribe of the first, the player in the second, the raiders of the third.
    expect(missionById('hearth')!.setups[1].civ).toBe('steppe');
    expect(missionById('grass')!.setups[0].civ).toBe('steppe');
    expect(missionById('line')!.setups[1].civ).toBe('steppe');
  });
});
