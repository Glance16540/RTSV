// A rival lives in an age before it takes the next (src/sim/rivalrule.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { RIVAL, mayAdvance, rivalSeason } from '../src/sim/rivalrule';

describe('a rival lives in an age before it takes the next', () => {
  it('its first age waits on nothing but its stores', () => {
    const c = newCampaign(7, 2, 1);
    expect(mayAdvance(c, 1)).toBe(true);
    c.turn = 3;
    expect(mayAdvance(c, 1)).toBe(true);
  });

  it('once it has advanced it waits RIVAL.settle seasons, however rich it is', () => {
    const c = newCampaign(7, 2, 1);
    c.turn = 12;
    expect(mayAdvance(c, 1)).toBe(true);
    c.factions[1].age = 1; // it advances
    c.factions[1].supplies = 9999;
    expect(mayAdvance(c, 1)).toBe(false);
    expect(c.aged![1]).toEqual({ age: 1, at: 12 });
    c.turn = 12 + RIVAL.settle - 1;
    expect(mayAdvance(c, 1)).toBe(false);
    c.turn = 12 + RIVAL.settle;
    expect(mayAdvance(c, 1)).toBe(true);
    // The other rival is not held by it.
    expect(mayAdvance(c, 2)).toBe(true);
  });

  it('the season notes the age a rival is in, and a campaign saved before this loads', () => {
    const c = newCampaign(7, 2, 1);
    delete c.aged;
    c.factions[1].age = 2; // an older save: already in its second age, and nobody noted when
    c.turn = 30;
    rivalSeason(c);
    expect(c.aged![1]).toEqual({ age: 2, at: 0 }); // taken as long settled
    expect(mayAdvance(c, 1)).toBe(true);
    c.factions[1].age = 3;
    rivalSeason(c);
    expect(c.aged![1]).toEqual({ age: 3, at: 30 });
    expect(mayAdvance(c, 1)).toBe(false);
  });
});
