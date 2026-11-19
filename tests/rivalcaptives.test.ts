// A rival whose people are held weighs the clock on the map (src/sim/rivalcaptives.ts, read by campaign.ts and bandfight.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { CARRY } from '../src/sim/carriedoff';
import type { Carried } from '../src/sim/carriedoff';
import { FIGHT } from '../src/sim/bandfight';
import { THREATS } from '../src/sim/threatsbase';
import type { Held } from '../src/sim/threats';
import { RIVAL_CLOCK, bandOdds, heldFirst, heldLeft } from '../src/sim/rivalcaptives';

const held = (from: number, owner: number, since: number): Held => ({ from, owner, men: [100], women: [90, 80], since });
const world = () => {
  const c = newCampaign(7, 3, 1, 'hearth');
  c.turn = 20;
  return c;
};

describe('a rival marches first on the land holding its carried-off, as their seasons run out', () => {
  it('reads the fewest seasons left of its own held in a land', () => {
    const c = world();
    const x: Carried = { id: 1, by: 2, at: 5, held: held(9, 1, c.turn - 1) };
    c.carried = [x, { id: 2, by: 2, at: 5, held: held(9, 3, c.turn - 3) }];
    expect(heldLeft(c, 1, 5)).toBe(CARRY.seasons - 1);
    expect(heldLeft(c, 1, 6)).toBe(Infinity);
    expect(heldLeft(c, 2, 5)).toBe(Infinity); // the keeper's own are not held there
  });

  it('with time left the order is as rivalaim gave it; in their last seasons that land goes first, the fewest left first', () => {
    const c = world();
    c.carried = [{ id: 1, by: 2, at: 7, held: held(9, 1, c.turn - 1) }, { id: 2, by: 3, at: 8, held: held(9, 1, c.turn - 1) }];
    expect(heldFirst(c, 1, [4, 7, 8])).toEqual([4, 7, 8]);
    c.carried[1].held.since = c.turn - (CARRY.seasons - RIVAL_CLOCK.last);
    expect(heldFirst(c, 1, [4, 7, 8])).toEqual([8, 4, 7]);
    c.carried[0].held.since = c.turn - (CARRY.seasons - 1);
    expect(heldFirst(c, 1, [4, 7, 8])).toEqual([7, 8, 4]);
    expect(heldFirst(c, 2, [4, 7, 8])).toEqual([4, 7, 8]); // another people's held are nothing to it
  });
});

describe('a rival goes after a band holding its own at shorter odds as their seasons run out', () => {
  it('FIGHT.theirs while there is time, RIVAL_CLOCK.bandLast in their last season, between in between', () => {
    const c = world();
    expect(bandOdds(c, [], FIGHT.theirs)).toBe(FIGHT.theirs);
    expect(bandOdds(c, [held(9, 1, c.turn)], FIGHT.theirs)).toBe(FIGHT.theirs);
    expect(bandOdds(c, [held(9, 1, c.turn - (THREATS.holdFor - 1))], FIGHT.theirs)).toBeCloseTo(RIVAL_CLOCK.bandLast, 9);
    const mid = bandOdds(c, [held(9, 1, c.turn - 1)], FIGHT.theirs);
    expect(mid).toBeLessThan(FIGHT.theirs);
    expect(mid).toBeGreaterThan(RIVAL_CLOCK.bandLast);
    expect(bandOdds(c, [held(9, 1, c.turn), held(9, 1, c.turn - (THREATS.holdFor - 1))], FIGHT.theirs)).toBeCloseTo(RIVAL_CLOCK.bandLast, 9); // the nearest to being lost counts
    expect(RIVAL_CLOCK.bandLast).toBeGreaterThan(1); // it never goes at worse than even odds
  });
});
