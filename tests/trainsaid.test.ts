// The governor's "Train up to" order is said with the others (src/sim/townorders.ts standingText): a town whose only
// order it is said nothing after the colon (playthrough of 21 November).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { setStanding, standingText } from '../src/sim/townorders';

describe('the order to train up to', () => {
  it('is said, alone or with others', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), t = c.territories.find((x) => x.capital === 0)!;
    setStanding(c, t.id, { drillStop: 2 });
    expect(standingText(t, (x) => x)).toBe("The governor's standing orders: to train until the army in the town is 2 companies strong.");
    setStanding(c, t.id, { learn: true });
    expect(standingText(t, (x) => x)).toMatch(/learn the studies .*; to train until the army in the town is 2 companies strong\.$/);
  });
});
