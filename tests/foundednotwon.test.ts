// A town a people's own settlers founded is not a town won in war to its lords (src/sim/nobletemper.ts warTurn).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { warTurn } from '../src/sim/nobletemper';

const world = () => {
  const c = newCampaign(7, 2, 1);
  const free = c.territories.filter((t) => t.owner < 0 && t.capital < 0 && !t.rim && !t.horde);
  warTurn(c, 0); // the lords have looked once
  return { c, free };
};
const take = (c: Campaign, tid: number) => { c.territories[tid].owner = 0; };
const found = (c: Campaign, tid: number) => { take(c, tid); c.territories[tid].foundedBy = { from: 0, turn: c.turn }; };

describe('what the lords count as a town won', () => {
  it('a town taken is won', () => {
    const { c, free } = world();
    take(c, free[0].id);
    expect(warTurn(c, 0)).toBe(1);
    expect(warTurn(c, 0)).toBe(0); // remembered
  });
  it('a town founded by its own settlers is not', () => {
    const { c, free } = world();
    found(c, free[0].id);
    expect(warTurn(c, 0)).toBe(0);
    expect(warTurn(c, 0)).toBe(0);
  });
  it('a town taken in the season one is founded is still won', () => {
    const { c, free } = world();
    found(c, free[0].id); take(c, free[1].id);
    expect(warTurn(c, 0)).toBe(1);
  });
  it('a town lost is lost, founded or not, and whatever was founded beside it', () => {
    const { c, free } = world();
    found(c, free[0].id);
    warTurn(c, 0);
    c.territories[free[0].id].owner = 1;
    expect(warTurn(c, 0)).toBe(-1);
    const mine = c.territories.find((t) => t.owner === 0 && t.capital < 0);
    if (mine) { mine.owner = 1; found(c, free[1].id); expect(warTurn(c, 0)).toBe(0); } // one lost and one founded: the land is as it was, and nothing was won
  });
  it('a founded town taken back after it was lost is won like any other', () => {
    const { c, free } = world();
    found(c, free[0].id);
    warTurn(c, 0);
    c.territories[free[0].id].owner = 1;
    warTurn(c, 0);
    c.territories[free[0].id].owner = 0; // retaken: founded long ago, won now
    expect(warTurn(c, 0)).toBe(1);
  });
  it('a town another people founded long ago, taken now, is won', () => {
    const { c, free } = world();
    c.territories[free[0].id].owner = 1;
    c.territories[free[0].id].foundedBy = { from: 0, turn: c.turn };
    c.turn += 12;
    warTurn(c, 0);
    take(c, free[0].id);
    expect(warTurn(c, 0)).toBe(1);
  });
});
