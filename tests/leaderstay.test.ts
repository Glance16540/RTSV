// The leader's stay in a town (src/sim/leaderstay.ts): its faith drawn toward the nation's, its work, its grief and drift.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { courtOf } from '../src/sim/court';
import { driftSeason } from '../src/sim/drift';
import { harvest } from '../src/sim/harvest';
import { LEADER_STAY, leaderEase, leaderGrief, leaderPull, leaderStays, leaderWork } from '../src/sim/leaderstay';
import { pullTogether } from '../src/sim/townfaith';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** The player with two towns and no armies: the leader in `here` (a town of theirs) or in the other one. */
function two(leaderInTown: boolean) {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = [];
  const mine = c.territories.filter((t) => t.owner === 0);
  const seat = mine.find((t) => t.capital === 0)!;
  const here = mine.find((t) => t !== seat) ?? c.territories.find((t) => t.owner < 0 && seat.adj.includes(t.id))!;
  here.owner = 0;
  for (const t of [seat, here]) Object.assign(folkOf(c, t.id), { men: 8, women: 8, elders: 1, children: 3, stores: { food: 0, wood: 0, gold: 0, stone: 0 } });
  c.factions[0].heroAlive = true;
  c.factions[0].court = { at: leaderInTown ? here.id : seat.id };
  courtOf(c, 0);
  return { c, seat, here };
}

describe('the leader\'s stay in a town', () => {
  it('is felt only in a town of the leader\'s own people that the leader is in, not their chief town', () => {
    const { c, seat, here } = two(true);
    expect(leaderStays(c, here.id)).toBe(true);
    expect(leaderStays(c, seat.id)).toBe(false);
    expect([leaderPull(c, here.id), leaderWork(c, here.id), leaderGrief(c, here.id), leaderEase(c, here.id)]).toEqual([LEADER_STAY.pull, LEADER_STAY.work, LEADER_STAY.grief, LEADER_STAY.strain]);
    expect([leaderPull(c, seat.id), leaderWork(c, seat.id), leaderGrief(c, seat.id), leaderEase(c, seat.id)]).toEqual([1, 1, 1, 1]);
    here.owner = 1; // the land is another people's: the player's leader standing there does nothing for it
    expect(leaderStays(c, here.id)).toBe(false);
    here.owner = 0;
    c.factions[0].court = { at: seat.id }; // nor in their chief town, where the court is counted already
    expect(leaderStays(c, seat.id)).toBe(false);
  });

  it('the town works harder: its land yields LEADER_STAY.work as much', () => {
    const got = (inTown: boolean) => {
      const { c, here } = two(inTown);
      harvest(c, () => 10, () => 0);
      const s = folkOf(c, here.id).stores;
      return s.food + s.wood + s.gold + s.stone;
    };
    const without = got(false), withLeader = got(true);
    expect(without).toBeGreaterThan(0);
    expect(withLeader / without).toBeCloseTo(LEADER_STAY.work, 1);
  });

  it('draws the town toward its nation\'s standing harder', () => {
    const moved = (inTown: boolean) => {
      const { c, seat, here } = two(inTown);
      seat.virtue = 60; here.virtue = -40;
      pullTogether(c);
      return here.virtue! - -40;
    };
    expect(moved(false)).toBeGreaterThan(0);
    expect(moved(true)).toBeGreaterThan(moved(false));
  });

  it('eases the town\'s grief and its strain', () => {
    const after = (inTown: boolean) => {
      const { c, here } = two(inTown);
      const f = folkOf(c, here.id);
      f.grief = 4; f.stores.food = 400;
      driftSeason(c);
      return { grief: f.grief ?? 0, strain: f.drift?.strain ?? 0 };
    };
    const without = after(false), withLeader = after(true);
    expect(withLeader.grief).toBeLessThan(without.grief);
    expect(without.strain).toBeGreaterThan(0);
    expect(withLeader.strain).toBeCloseTo(without.strain * LEADER_STAY.strain, 5);
  });
});
