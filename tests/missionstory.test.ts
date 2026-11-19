// The thread through the missions: three missions tied by the riders of the steppe, each with a line before and after.
import { describe, expect, it } from 'vitest';
import { THREADS, chapterOf, chapterText, nextInThread, threadTag } from '../src/sim/missionstory';
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

describe('the riders\' leader in the lines', () => {
  it('names the Mongols\' leader as the player has them, with the right words for them', () => {
    const grass = chapterOf('grass')!.chapter;
    expect(chapterText(grass.after)).toBe('Khatun Sarnai raised her hall by the Persian river. Her sons grew up in the saddle, and when she died they rode west.');
    expect(chapterText(grass.after, { name: 'Khan Temur', female: false })).toBe('Khan Temur raised his hall by the Persian river. His sons grew up in the saddle, and when he died they rode west.');
    expect(chapterText(grass.before, { name: 'Odval the Swift', female: true })).toMatch(/^Far to the east, Odval the Swift's band/);
    // Every line, filled in, has nothing left to fill.
    for (const t of THREADS) for (const c of t.chapters) for (const line of [c.before, c.after]) expect(chapterText(line, { name: 'X', female: false })).not.toMatch(/[{}]/);
  });
});
