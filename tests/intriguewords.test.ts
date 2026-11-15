// How a story is summed up in the land's panel (src/sim/intrigue.ts `standing`): counted in words a person would use.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { beginThief, standing } from '../src/sim/intrigue';

describe('the thief, summed up', () => {
  it('a house robbed once is said once, not "1 times"; twice, twice', () => {
    const c = newCampaign(7, 1, 1, 'hearth');
    const seat = c.territories.find((t) => t.capital === 0)!;
    const it = beginThief(c, seat.id);
    it.robbed = it.robbed.map((_, i) => (i === 0 ? 1 : 0));
    expect(standing(c, it)).toContain(' once;');
    expect(standing(c, it)).not.toContain('1 times');
    it.robbed = it.robbed.map((_, i) => (i === 0 ? 2 : 0));
    expect(standing(c, it)).toContain(' twice;');
    it.robbed = it.robbed.map((_, i) => (i === 0 ? 3 : 0));
    expect(standing(c, it)).toContain(' 3 times;');
  });
});
