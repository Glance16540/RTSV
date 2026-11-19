// The leader's stay in a town (src/sim/leaderstay.ts): every leader draws it toward the nation's standing, and the rest
// follows their calling: a Steward's work and building, a Warlord's steadying and the town's men, a Strategist's roads
// and watch. Each calling spends the same weight.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { courtOf } from '../src/sim/court';
import { driftSeason } from '../src/sim/drift';
import { governTown } from '../src/sim/governor';
import { harvest } from '../src/sim/harvest';
import type { Calling } from '../src/sim/hero';
import { LEADER_STAY, LEAN_WEIGHT, leaderRoads, leaderSteady, leaderStays, leanWeight, stayAt } from '../src/sim/leaderstay';
import { MILITIA, militiaOf } from '../src/sim/militia';
import { bandMen } from '../src/sim/tribes';
import { defenceOf } from '../src/sim/threats';
import { pullTogether } from '../src/sim/townfaith';
import { folkOf } from '../src/sim/township';
import { UNREST, unrestChance } from '../src/sim/unrest';

const base = JSON.stringify(newCampaign(5, 2));
const CALLINGS: Calling[] = ['warlord', 'strategist', 'steward'];
/** The player with their seat, a town `here` beside it and a town `next` beside that, no armies; the leader in `here` or in the seat. */
function lands(calling: Calling, leaderInTown: boolean) {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = [];
  const seat = c.territories.find((t) => t.capital === 0)!;
  const here = c.territories.find((t) => seat.adj.includes(t.id) && t.capital < 0)!;
  const next = c.territories.find((t) => here.adj.includes(t.id) && t.id !== seat.id && t.capital < 0)!;
  for (const t of c.territories) if (t.owner === 0 && t !== seat) t.owner = -1;
  for (const t of [here, next]) { t.owner = 0; t.capital = -1; }
  for (const t of [seat, here, next]) Object.assign(folkOf(c, t.id), { men: 8, women: 8, elders: 1, children: 3, stores: { food: 0, wood: 0, gold: 0, stone: 0 } });
  c.factions[0].hero = { name: 'Aldith', calling } as never;
  c.factions[0].heroAlive = true;
  c.factions[0].court = { at: leaderInTown ? here.id : seat.id };
  courtOf(c, 0);
  return { c, seat, here, next };
}

describe('the leader\'s stay in a town', () => {
  it('is felt only in a town of the leader\'s own people that the leader is in, not their chief town, and as their calling has it', () => {
    for (const calling of CALLINGS) {
      const { c, seat, here, next } = lands(calling, true);
      expect(leaderStays(c, here.id)).toBe(true);
      expect(stayAt(c, here.id)).toEqual(LEADER_STAY[calling]);
      expect(leaderStays(c, next.id)).toBe(false);
      c.factions[0].court = { at: seat.id };
      expect(leaderStays(c, seat.id)).toBe(false); // the chief town: the court is counted there already
      c.factions[0].court = { at: here.id };
      here.owner = 1;
      expect(leaderStays(c, here.id)).toBe(false); // another people's land
    }
  });

  it('every calling draws the town toward the nation as hard, and spends the same weight on the rest', () => {
    for (const calling of CALLINGS) {
      expect(LEADER_STAY[calling].pull).toBe(LEADER_STAY.warlord.pull);
      expect(leanWeight(LEADER_STAY[calling])).toBeCloseTo(LEAN_WEIGHT, 9);
    }
    const moved = (inTown: boolean) => {
      const { c, seat, here } = lands('warlord', inTown);
      seat.virtue = 60; here.virtue = -40; folkOf(c, here.id).stores.food = 400;
      pullTogether(c);
      return here.virtue! + 40;
    };
    expect(moved(true)).toBeGreaterThan(moved(false));
  });

  it('a Steward\'s town works harder and builds faster; a Warlord\'s and a Strategist\'s do not', () => {
    const got = (calling: Calling, inTown: boolean) => {
      const { c, here } = lands(calling, inTown);
      harvest(c, () => 10, () => 0);
      const s = folkOf(c, here.id).stores;
      return s.food + s.wood + s.gold + s.stone;
    };
    const plain = got('steward', false);
    expect(plain).toBeGreaterThan(0);
    expect(got('steward', true) / plain).toBeCloseTo(LEADER_STAY.steward.work, 1);
    expect(got('warlord', true)).toBe(plain);
    expect(got('strategist', true)).toBe(plain);
    const built = (calling: Calling, inTown: boolean) => {
      const { c, here } = lands(calling, inTown);
      here.town = { at: 2, b: [['towncenter', 40, 40], ['granary', 46, 40, 0.01, 0.2]] } as typeof here.town;
      governTown(c, here.id);
      return here.town!.b.find((b) => b[0] === 'granary')![4] ?? 1;
    };
    expect(built('steward', true)).toBeGreaterThan(built('steward', false));
    expect(built('warlord', true)).toBe(built('warlord', false));
  });

  it('a Steward eases grief most, a Warlord strain most', () => {
    const after = (calling: Calling, inTown: boolean) => {
      const { c, here } = lands(calling, inTown);
      const f = folkOf(c, here.id);
      f.grief = 4; f.stores.food = 400;
      driftSeason(c);
      return { grief: f.grief ?? 0, strain: f.drift?.strain ?? 0 };
    };
    const plain = after('warlord', false);
    expect(plain.strain).toBeGreaterThan(0);
    expect(after('steward', true).grief).toBeLessThan(after('warlord', true).grief);
    expect(after('warlord', true).strain).toBeCloseTo(plain.strain * LEADER_STAY.warlord.strain, 5);
    expect(after('warlord', true).strain).toBeLessThan(after('steward', true).strain);
  });

  it('a Warlord steadies the people\'s towns beside theirs, and the town\'s men count for more in its defence', () => {
    const { c, here, next } = lands('warlord', true);
    c.turn = UNREST.from + 10;
    expect(leaderSteady(c, next.id)).toBe(LEADER_STAY.warlord.steady);
    const withLeader = unrestChance(c, next.id);
    c.factions[0].court = { at: c.territories.find((t) => t.capital === 0)!.id };
    const without = unrestChance(c, next.id);
    expect(without).toBeGreaterThan(0);
    expect(withLeader / without).toBeCloseTo(LEADER_STAY.warlord.steady, 5);
    // Men enough for the bands to lie between the least and the most a town's men add.
    folkOf(c, here.id).men = Math.round(bandMen() * 2.5);
    c.factions[0].court = { at: here.id };
    const a = militiaOf(c, here.id);
    c.factions[0].court = { at: next.id };
    const b = militiaOf(c, here.id);
    expect(b).toBeLessThan(MILITIA.most);
    expect(a / b).toBeCloseTo(LEADER_STAY.warlord.militia, 1);
  });

  it('a Strategist keeps the roads through the town, and the town readier against a band', () => {
    const { c, seat, here, next } = lands('strategist', true);
    expect(leaderRoads(c, 0, [seat.id, here.id, next.id])).toBe(LEADER_STAY.strategist.roads);
    expect(leaderRoads(c, 0, [seat.id])).toBe(1);
    const withLeader = defenceOf(c, here.id).total;
    c.factions[0].court = { at: seat.id };
    const without = defenceOf(c, here.id).total;
    expect(withLeader / without).toBeCloseTo(LEADER_STAY.strategist.watch, 1);
    const w = lands('warlord', true);
    expect(leaderRoads(w.c, 0, [w.seat.id, w.here.id])).toBe(1);
  });
});
