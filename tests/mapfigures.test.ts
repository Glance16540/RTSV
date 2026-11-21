// The figures and names in the map's prompts and panels are whole numbers and plain English (src/client/mapfigures.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { armyHeading, fig, foesOwn, inHundred, oddsLine, sidesLine, theFoe } from '../src/client/mapfigures';

const c = newCampaign(5, 2);

describe('a strength is told as a whole number', () => {
  it('rounds to the nearest, calls under a half "a little", and never shows a fraction or a nonsense figure', () => {
    expect(fig(5.5)).toBe('6');
    expect(fig(4)).toBe('4');
    expect(fig(4.49)).toBe('4');
    expect(fig(0.3)).toBe('a little');
    expect(fig(0)).toBe('0');
    expect(fig(-2)).toBe('0');
    expect(fig(NaN)).toBe('0');
    for (const x of [0.5, 1.25, 3.7, 12.05, 99.99]) expect(fig(x)).toMatch(/^\d+$/);
  });
  it('the odds are a whole number of times in a hundred, from 0 to 100', () => {
    expect(inHundred(0.617)).toBe(62);
    expect(inHundred(1.4)).toBe(100);
    expect(inHundred(-0.2)).toBe(0);
    expect(oddsLine(0.617)).toBe('Auto-resolving, you would win about 62 times in 100.');
  });
  it('an army\'s heading in a land\'s panel', () => {
    expect(armyHeading(7.5)).toBe('Army, strength 8');
  });
});

describe('the other side is named as English has it', () => {
  it('a tribe takes "the", and is one body', () => {
    expect(theFoe(c, -1)).toBe('the Local Tribe');
    expect(theFoe(c, -1, true)).toBe('The Local Tribe');
    expect(foesOwn(c, -1)).toBe("the Local Tribe's");
    expect(sidesLine(c, { aStr: 5.5, dStr: 4 }, -1, true)).toBe("Your strength of 6 against the Local Tribe's defence of 4.");
    expect(sidesLine(c, { aStr: 3.2, dStr: 6.6 }, -1, false)).toBe('The Local Tribe marches with a strength of 3 against your defence of 7.');
  });
  it('a people takes "the" and a plural verb, and its possessive follows its name', () => {
    c.factions[1].people = 'Greeks'; c.factions[2].people = 'Japanese';
    expect(sidesLine(c, { aStr: 5.5, dStr: 4.4 }, 1, true)).toBe("Your strength of 6 against the Greeks' defence of 4.");
    expect(sidesLine(c, { aStr: 8.5, dStr: 2.4 }, 1, false)).toBe('The Greeks march with a strength of 9 against your defence of 2.');
    expect(sidesLine(c, { aStr: 5, dStr: 4 }, 2, true)).toBe('Your strength of 5 against the Japanese defence of 4.');
    expect(theFoe(c, 2, true)).toBe('The Japanese');
  });
  it('no line shows a decimal point', () => {
    for (const foe of [-1, 1, 2]) for (const attacking of [true, false]) expect(sidesLine(c, { aStr: 5.55, dStr: 0.75 }, foe, attacking)).not.toMatch(/\d\.\d/);
  });
});
