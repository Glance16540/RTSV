// What a season truly added to what the player has to spend, for the bar (src/sim/seasongain.ts).
import { describe, expect, it } from 'vitest';
import { endTurn, income, newCampaign } from '../src/sim/campaign';
import { lastGain } from '../src/sim/seasongain';
import { settleStores } from '../src/sim/stores';
import { setStanding } from '../src/sim/townorders';
import { mapWorks } from '../src/sim/townworks';

const play = (c: ReturnType<typeof newCampaign>, turns: number): void => {
  for (let i = 0; i < turns; i++) { endTurn(c); expect(c.phase).toBe('player'); }
};

describe('the season\'s gain', () => {
  it('is not known before a season has passed', () => {
    const c = newCampaign(11, 1, 1, 'hearth');
    expect(lastGain(c)).toBeUndefined();
  });

  it('is what there is to spend as the turn opens, less what there was as the last one ended', () => {
    const c = newCampaign(11, 1, 1, 'hearth');
    for (let i = 0; i < 6; i++) {
      settleStores(c);
      const before = c.factions[0].supplies;
      endTurn(c);
      settleStores(c);
      expect(lastGain(c)).toBe(c.factions[0].supplies - before);
    }
  }, 60_000);

  it('does not count against the season what the player spent in the turn', () => {
    const a = newCampaign(11, 1, 1, 'hearth'), b = newCampaign(11, 1, 1, 'hearth');
    play(a, 2); play(b, 2);
    // The governors may raise nothing this season in either: what one buys out of plenty the other, with less in store, may
    // not (a Mill, in winter's lean harvest, winter.ts), and that is the governor's spending, not the player's.
    for (const c of [a, b]) for (const t of c.territories) if (t.owner === 0) setStanding(c, t.id, { never: mapWorks() });
    b.factions[0].supplies -= 3; // spent in the turn, on something
    endTurn(a); endTurn(b);
    expect(lastGain(b)).toBe(lastGain(a));
  }, 60_000);

  it('is not the lands\' yield: the towns eat and keep up out of it', () => {
    const c = newCampaign(11, 1, 1, 'hearth'), gains: number[] = [];
    for (let i = 0; i < 8; i++) { endTurn(c); gains.push(lastGain(c)!); }
    expect(gains.some((g) => g !== income(c, 0))).toBe(true);
  }, 60_000);

  it('is forgotten once the turn it was measured for is past', () => {
    const c = newCampaign(11, 1, 1, 'hearth');
    endTurn(c);
    expect(lastGain(c)).toBeDefined();
    c.turn++;
    expect(lastGain(c)).toBeUndefined();
  }, 60_000);
});
