// The stories as the land's panel draws them (src/client/intriguepanel.ts): each kind shows its own people.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { beginPlot } from '../src/sim/courtstory';
import { beginThief } from '../src/sim/intrigue';
import { noblesOf } from '../src/sim/nobles';
import { intrigueHtml } from '../src/client/intriguepanel';

describe('the stories in the land panel', () => {
  it('a plot at court names the nobles spoken of, and a thief the houses robbed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      if (noblesOf(c, 0).length < 3) continue;
      const plot = beginPlot(c, noblesOf(c, 0)[0].key);
      if (!plot) continue;
      const html = intrigueHtml(c, plot.at);
      for (const n of plot.nobles!) expect(html).toContain(n.title.replace(/&/g, '&amp;'));
      expect(html).toContain('is spoken of');
      const thief = beginThief(c, plot.at);
      expect(intrigueHtml(c, plot.at)).toContain(thief.people[0].name);
      return;
    }
    throw new Error('no world with nobles enough for a plot');
  });
});
