// A sack at the leader's seat is weighed by the household exactly once (src/sim/kin.ts): in the season it falls, and never again.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { KIN, kinOf, kinSeason } from '../src/sim/kin';

const world = (turn: number): { c: Campaign; home: number } => {
  const c = newCampaign(7, 1, 1, 'japan');
  c.turn = turn;
  kinOf(c, 0);
  return { c, home: c.territories.find((t) => t.capital === 0)!.id };
};
const sack = (c: Campaign, at: number) => (c.events ??= []).push({ kind: 'carried', at, turn: c.turn, until: c.turn });
const taken = (c: Campaign): boolean => c.factions[0].kin!.spouse?.lost?.how === 'taken';

describe('a sack at the seat is weighed once', () => {
  it('in the season it falls: she is carried off about as often as the rule says', () => {
    let n = 0;
    for (let i = 0; i < 60; i++) { const { c, home } = world(20 + i); sack(c, home); kinSeason(c, 0); if (taken(c)) n++; }
    expect(n).toBeGreaterThan(60 * KIN.carried * 0.6);
    expect(n).toBeLessThan(60 * KIN.carried * 1.4);
  });
  it('spared in that season, she is not asked again for the same sack in the seasons after', () => {
    let spared = 0;
    for (let i = 0; i < 60; i++) {
      const { c, home } = world(20 + i);
      sack(c, home);
      kinSeason(c, 0);
      if (taken(c)) continue;
      spared++;
      for (let later = 0; later < 4; later++) { c.turn++; kinSeason(c, 0); expect(taken(c)).toBe(false); }
    }
    expect(spared).toBeGreaterThan(0);
  });
  it('over the two seasons together a sack takes her no oftener than one asking would', () => {
    let n = 0;
    for (let i = 0; i < 60; i++) { const { c, home } = world(20 + i); sack(c, home); kinSeason(c, 0); c.turn++; kinSeason(c, 0); if (taken(c)) n++; }
    expect(n).toBeLessThan(60 * KIN.carried * 1.4);
  });
  it('a sack of another town is nothing to the household', () => {
    for (let i = 0; i < 20; i++) {
      const { c, home } = world(20 + i);
      const other = c.territories.find((t) => t.id !== home)!.id;
      sack(c, other);
      kinSeason(c, 0);
      expect(taken(c)).toBe(false);
    }
  });
});
