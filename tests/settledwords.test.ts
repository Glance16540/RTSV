// "now count themselves the Kushites's" (docs/PLAYTEST.md, 5): a town that settles under a rival is said in plain words.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { seasonOfYoke } from '../src/sim/conquered';

describe('a town that settles under another people', () => {
  it('counts itself among them, with no possessive hung on a name that ends in s', () => {
    const c = newCampaign(7, 1, 1, 'hearth');
    const t = c.territories.find((x) => x.owner < 0 && !x.horde)!;
    t.owner = 1;
    t.yoke = { from: -1, since: c.turn, resent: 1 };
    seasonOfYoke(c);
    const said = c.log.find((l) => l.includes('now count themselves'))!;
    expect(said).toBe(`The people of ${t.name} now count themselves among the ${c.factions[1].name}.`);
    expect(c.log.join('\n')).not.toMatch(/s's/);
  });
});
