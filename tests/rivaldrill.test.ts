// A town's training stop can be set, and a rival's towns train by orders as the player's do (src/sim/rivaldrill.ts,
// townorders.ts drillStop, townmuster.ts).
import { describe, expect, it } from 'vitest';
import { armyAt, armySize, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { keepOrders } from '../src/sim/governor';
import { onFrontier } from '../src/sim/reckon';
import { menaced, RIVAL_DRILL, rivalDrillOrders, rivalDrillSeason } from '../src/sim/rivaldrill';
import { DRILL, drillOf, drillTown } from '../src/sim/townmuster';
import { DRILL_STOPS, setStanding } from '../src/sim/townorders';
import { folkOf } from '../src/sim/township';

const playerTown = () => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner < 0 && !x.horde && x.capital < 0)!;
  t.owner = 0; t.buildings = ['barracks']; c.places = []; delete t.town;
  c.armies = c.armies.filter((a) => a.at !== t.id);
  const f = folkOf(c, t.id);
  Object.assign(f, { men: 40, women: 6, elders: 0, children: 2 }); delete f.ages;
  f.stores = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
  keepOrders(c, t.id, { train: ['clubman'] });
  return { c, t };
};

describe('where a town stops training', () => {
  it('is DRILL.most unless the player says otherwise, and may be set to any of the stops', () => {
    const { c, t } = playerTown();
    expect(DRILL_STOPS).toContain(DRILL.most);
    expect(setStanding(c, t.id, { drillStop: 2 })).toBe('');
    for (let i = 0; i < 8; i++) drillTown(c, t.id);
    expect(armySize(armyAt(c, t.id)!)).toBe(2);
    expect(drillOf(c, t.id).why).toBe('full');
    expect(setStanding(c, t.id, { drillStop: 6 })).toBe('');
    for (let i = 0; i < 8; i++) drillTown(c, t.id);
    expect(armySize(armyAt(c, t.id)!)).toBe(6);
    expect(setStanding(c, t.id, { drillStop: 0 })).not.toBe('');
    expect(setStanding(c, t.id, { drillStop: null })).toBe('');
    expect(t.standing?.drillStop).toBeUndefined();
  });
});

describe('a rival\'s towns train by orders', () => {
  const rival = () => {
    const c: Campaign = newCampaign(7, 2, 1, 'hearth');
    c.factions[1].isAI = true;
    const own = c.territories.filter((t) => t.owner === 1);
    for (const t of own) { t.buildings = ['barracks']; c.armies = c.armies.filter((a) => a.at !== t.id); const f = folkOf(c, t.id); Object.assign(f, { men: 30, women: 8 }); delete f.ages; f.stores = { food: 5000, wood: 5000, gold: 5000, stone: 5000 }; }
    return { c, own };
  };

  /** An army of the player's set down beside a frontier town of the rival's, in land not the rival's. */
  const enemyBeside = (c: Campaign, tid: number, id = 990) => {
    const at = c.territories[tid].adj.find((n) => c.territories[n].owner !== 1)!;
    c.armies.push({ id, owner: 0, at, units: { infantry: 4 }, hero: false, vet: 0, moved: false } as never);
    return at;
  };

  it('a frontier town with a yard and an enemy beside it is told to train what it raises, to stop at a few companies; any other is not', () => {
    const { c, own } = rival();
    c.armies = c.armies.filter((a) => a.owner === 1);
    const front = own.filter((t) => onFrontier(c, 1, t.id));
    expect(front.length).toBeGreaterThan(0);
    rivalDrillOrders(c, 1);
    for (const t of own) expect(t.orders?.train ?? []).toEqual([]); // nobody in sight: no frontier town trains
    enemyBeside(c, front[0].id);
    rivalDrillOrders(c, 1);
    for (const t of own) {
      if (onFrontier(c, 1, t.id) && menaced(c, 1, t.id)) { expect(t.orders?.train).toContain('infantry'); expect(t.standing?.drillStop).toBe(RIVAL_DRILL.stop); }
      else expect(t.orders?.train ?? []).toEqual([]);
    }
    expect(front[0].orders?.train).toContain('infantry');
  });

  it('an army of a people at peace with it is no threat; and when the enemy goes, the town stops', () => {
    const { c, own } = rival();
    c.armies = c.armies.filter((a) => a.owner === 1);
    const t = own.find((x) => onFrontier(c, 1, x.id))!;
    enemyBeside(c, t.id);
    c.truces.push({ with: 1, until: c.turn + 8 } as never);
    expect(menaced(c, 1, t.id)).toBe(false);
    c.truces = [];
    expect(menaced(c, 1, t.id)).toBe(true);
    rivalDrillOrders(c, 1);
    expect(t.orders?.train?.length).toBeGreaterThan(0);
    c.armies = c.armies.filter((a) => a.owner === 1);
    rivalDrillOrders(c, 1);
    expect(t.orders?.train ?? []).toEqual([]);
  });

  it('its towns so ordered raise a company a season, out of their own men and stores, and say nothing to the player', () => {
    const { c, own } = rival();
    c.armies = c.armies.filter((a) => a.owner === 1);
    const front = own.filter((t) => onFrontier(c, 1, t.id));
    expect(front.length).toBeGreaterThan(0);
    front.forEach((t, i) => enemyBeside(c, t.id, 990 + i));
    const log = c.log.length;
    const raised = rivalDrillSeason(c);
    expect(raised.length).toBe(front.length);
    for (const d of raised) expect(armyAt(c, d.at)!.owner).toBe(1);
    expect(c.log.length).toBe(log);
    for (let i = 0; i < 6; i++) rivalDrillSeason(c);
    for (const t of front) expect(armySize(armyAt(c, t.id)!)).toBeLessThanOrEqual(RIVAL_DRILL.stop);
  });
});
