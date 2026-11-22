// A rival sets its heart on a land worth having and goes for it over several seasons (src/sim/rivalplan.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, endTurn, newCampaign, playForPlayer, reach, resolvePending } from '../src/sim/campaign';
import { PLAN, aimFirst, aimOf, aimWorth, aimsOf, balk, beforeAim, marchesTo, planOf, planStep, planText, riches, whyAim } from '../src/sim/rivalplan';
import { townTaken } from '../src/sim/conquered';
import { folkOf } from '../src/sim/township';
import { worldsBeforeEmptyBeside } from './helpers';

worldsBeforeEmptyBeside(); // written before every people had an empty land beside its chief town: the worlds these tests were written with

/**
 * A rival with its capital, a land beside it (`mid`) and one beyond that (`far`), which the capital does not
 * touch. `mid` and `far` are plain tribal towns unless a test says otherwise; no army stands in any of the three.
 */
const world = () => {
  for (let seed = 1; seed <= 60; seed++) {
    const w = tryWorld(seed);
    if (w) return w;
  }
  throw new Error('no world with a land beyond the land beside the capital');
};
const tryWorld = (seed: number) => {
  const c = newCampaign(seed, 2, 1), cap = c.territories.find((t) => t.capital === 1)!;
  const beyond = (m: number) => reach(c, m).find((n) => n !== cap.id && !reach(c, cap.id).includes(n) && c.territories[n].capital < 0);
  const m = reach(c, cap.id).find((n) => c.territories[n].capital < 0 && beyond(n) !== undefined);
  if (m === undefined) return null;
  const mid = c.territories[m], far = c.territories[beyond(m)!];
  for (const t of [mid, far]) { Object.assign(t, { owner: -1, capital: -1, horde: false, buildings: [], militia: 2 }); delete t.yoke; }
  c.armies = c.armies.filter((a) => ![cap.id, mid.id, far.id].includes(a.at));
  c.places = []; c.bands = [];
  return { c, cap, mid, far };
};
const army = (c: Campaign, at: number, n = 2, id = 500 + at) => { const a = { id, owner: 1, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };
/** Leave only these lands to be wanted: every other is put under a land nobody may march into (the rival's own, far away from its armies' business). */
const only = (c: Campaign, keep: number[]) => { for (const t of c.territories) if (!keep.includes(t.id) && t.owner !== 1) Object.assign(t, { buildings: [], capital: -1 }); };

describe('a rival counts the marches to a land', () => {
  it('through its own lands and lands it may march into', () => {
    const { c, cap, mid, far } = world();
    const d = marchesTo(c, 1, far.id);
    expect(d.get(far.id)).toBe(0);
    expect(d.get(mid.id)).toBe(1);
    expect(d.get(cap.id)).toBe(2);
  });
  it('never across a truce', () => {
    const { c, cap, mid, far } = world();
    // Every way to the far land but through the middle one is shut by making the others the player's, under truce.
    for (const t of c.territories) if (![cap.id, mid.id, far.id].includes(t.id) && t.owner !== 1) t.owner = 0;
    mid.owner = 0;
    c.truces.push({ with: 1, until: c.turn + 20 });
    expect(marchesTo(c, 1, far.id).get(cap.id)).toBeUndefined();
    c.truces = [];
    expect(marchesTo(c, 1, far.id).get(cap.id)).toBe(2);
  });
});

describe('what a rival wants', () => {
  it('a town with more people, more works and better country is the richer', () => {
    const { c, mid, far } = world();
    const before = riches(c, far.id);
    far.buildings = ['farm', 'church'];
    expect(riches(c, far.id)).toBeGreaterThanOrEqual(before + 2);
    const f = folkOf(c, mid.id), was = riches(c, mid.id);
    f.men += PLAN.people; delete f.ages;
    expect(riches(c, mid.id)).toBeCloseTo(was + 1);
  });
  it('a chief town is another people\'s capital, and a town taken from it is wanted back', () => {
    const { c, mid } = world();
    const theirs = c.territories.find((t) => t.capital === 0)!;
    expect(whyAim(c, 1, theirs.id)).toBe('chief');
    expect(whyAim(c, 1, mid.id)).toBe('rich');
    mid.owner = 1; townTaken(c, mid.id, 1, 0); mid.owner = 0;
    expect(whyAim(c, 1, mid.id)).toBe('revenge');
    expect(whyAim(c, 2, mid.id)).toBe('rich'); // only to the people it was taken from
  });
  it('each land of the way makes a town the less wanted', () => {
    const { c, far } = world();
    expect(aimWorth(c, 1, far.id, 1) - aimWorth(c, 1, far.id, 3)).toBeCloseTo(2 * PLAN.step);
    expect(aimWorth(c, 1, far.id, 0)).toBe(aimWorth(c, 1, far.id, 1)); // a land beside its own costs nothing to reach
  });
  it('it looks no further than a few marches, and never at a land under truce or its own', () => {
    const { c } = world();
    const aims = aimsOf(c, 1);
    expect(aims.length).toBeGreaterThan(0);
    expect(aims.every((a) => a.away >= 1 && a.away <= PLAN.far && c.territories[a.id].owner !== 1)).toBe(true);
    c.truces.push({ with: 1, until: c.turn + 20 });
    expect(aimsOf(c, 1).some((a) => c.territories[a.id].owner === 0)).toBe(false);
  });
});

describe('a rival sets its heart on one land', () => {
  it('the most wanted in reach, and keeps to it for seasons', () => {
    const { c, far } = world();
    only(c, [far.id]);
    far.buildings = ['farm', 'church', 'market', 'barracks', 'range', 'stable', 'fortress', 'tavern', 'harbour', 'granary'];
    expect(aimOf(c, 1)).toBe(far.id);
    expect(planOf(c, 1)).toMatchObject({ aim: far.id, since: c.turn, why: 'rich' });
    expect(planText(c, 1)).toContain(far.name);
    far.buildings = [];
    c.turn += PLAN.keep;
    expect(aimOf(c, 1)).toBe(far.id); // still its aim, though it would not choose it today
    c.turn += 1;
    aimOf(c, 1);
    expect(planOf(c, 1)!.since).toBe(c.turn); // it has thought again
  });
  it('it wants a town taken from it back before a richer one', () => {
    const { c, mid, far } = world();
    only(c, [mid.id, far.id]);
    far.buildings = ['farm', 'church', 'market'];
    mid.owner = 1; townTaken(c, mid.id, 1, 2); mid.owner = 2;
    expect(aimOf(c, 1)).toBe(mid.id);
    expect(planOf(c, 1)!.why).toBe('revenge');
  });
  it('and chooses again once the aim is its own', () => {
    const { c, far } = world();
    only(c, [far.id]);
    far.buildings = ['farm', 'church', 'market', 'barracks', 'range', 'stable', 'fortress', 'tavern'];
    expect(aimOf(c, 1)).toBe(far.id);
    far.owner = 1;
    expect(aimOf(c, 1)).not.toBe(far.id);
  });
});

describe('the aim steers the marches', () => {
  const aimed = () => {
    const w = world();
    only(w.c, [w.far.id]);
    w.far.buildings = ['farm', 'church', 'market', 'barracks', 'range', 'stable', 'fortress', 'tavern', 'harbour', 'granary'];
    expect(aimOf(w.c, 1)).toBe(w.far.id);
    return w;
  };
  it('of the lands an army might march on, one nearer the aim goes first', () => {
    const { c, cap, mid } = aimed();
    const others = reach(c, cap.id).filter((n) => n !== mid.id && c.territories[n].owner !== 1);
    const d = marchesTo(c, 1, planOf(c, 1)!.aim);
    const order = aimFirst(c, 1, cap.id, [...others, mid.id]);
    expect(d.get(order[0])!).toBeLessThan(d.get(cap.id)!);
    expect(order.slice().sort()).toEqual([...others, mid.id].sort());
    const split = order.findIndex((id) => !(d.get(id)! < d.get(cap.id)!));
    expect(order.slice(split < 0 ? order.length : split).every((id) => !(d.get(id)! < d.get(cap.id)!))).toBe(true); // nearer ones first, then the rest
  });
  it('an army with nothing to dare walks through its own lands toward it', () => {
    const { c, cap, mid } = aimed();
    mid.owner = 1;
    expect(planStep(c, 1, cap.id)).toBe(mid.id);
    expect(planStep(c, 1, mid.id)).toBe(-1); // as near as its own lands go
    expect(beforeAim(c, 1, mid.id)).toBe(true);
    expect(beforeAim(c, 1, cap.id)).toBe(false);
  });
  it('its strongest army, balking before the way, gives the aim up for a while; a lesser one gives nothing up', () => {
    const { c, cap, mid, far } = aimed();
    mid.owner = 1;
    c.armies = c.armies.filter((a) => a.owner !== 1);
    const weak = army(c, mid.id, 1), strong = army(c, cap.id, 6);
    expect(balk(c, 1, weak)).toBe(false);
    expect(planOf(c, 1)!.aim).toBe(far.id);
    expect(balk(c, 1, strong)).toBe(false); // it does not stand before the way
    strong.at = mid.id; weak.at = cap.id;
    expect(balk(c, 1, strong)).toBe(true);
    expect(planOf(c, 1)!.aim).toBe(-1);
    expect(aimOf(c, 1)).not.toBe(far.id);
    expect(aimsOf(c, 1).some((a) => a.id === far.id)).toBe(false);
    c.turn += PLAN.rest + 1;
    expect(aimsOf(c, 1).some((a) => a.id === far.id)).toBe(true);
  });
});

describe('in a campaign', () => {
  it('every rival that marches has an aim on record, and it is a land it may march into', () => {
    const c = newCampaign(11, 3, 1);
    for (let i = 0; i < 400 && c.turn < 24 && c.winner < 0; i++) {
      if (c.pending) resolvePending(c, 'auto');
      else if (c.demand) c.demand = null;
      else if (c.phase === 'player') { playForPlayer(c); if (!c.pending && !c.demand) endTurn(c); }
      else endTurn(c);
    }
    const plans = Object.entries(c.plans ?? {});
    expect(plans.length).toBeGreaterThan(0);
    for (const [f, p] of plans) if (p.aim >= 0 && c.turn - p.since === 0) expect(c.territories[p.aim].owner).not.toBe(Number(f));
  }, 60_000);
});
