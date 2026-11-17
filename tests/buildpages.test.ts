// The villager's build menu in screens that fit the card (src/client/buildpages.ts).
import { describe, expect, it } from 'vitest';
import { BUILD_PAGES } from '../src/sim/data';
import { PER_SCREEN, buildScreens, screenName } from '../src/client/buildpages';

const SLOTS = 'QWERTASDFGZXCVB'.length;

describe('the build menu', () => {
  it('puts no more on a screen than the card has keys for, keeping the last two for the page button and Stop', () => {
    expect(PER_SCREEN).toBe(SLOTS - 2);
    for (const s of buildScreens(BUILD_PAGES)) expect(s.types.length).toBeLessThanOrEqual(PER_SCREEN);
  });

  it('shows every building, once, in its page\'s order', () => {
    const shown = buildScreens(BUILD_PAGES).flatMap((s) => s.types);
    expect(shown).toEqual(BUILD_PAGES.flat());
  });

  it('cuts a long page into even halves and names them', () => {
    const list = Array.from({ length: 17 }, (_, i) => 'b' + i);
    const s = buildScreens([list, ['x']]);
    expect(s.map((x) => x.types.length)).toEqual([9, 8, 1]);
    expect(screenName(s[1])).toBe('Settlement buildings (2 of 2)');
    expect(screenName(s[2])).toBe('Military buildings');
  });
});
