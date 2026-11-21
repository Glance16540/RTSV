// A rival masses two armies for one assault and waits for the second (src/sim/rivalmass.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, MAX_ARMY, armyStrength, moveArmy, newCampaign, reach } from '../src/sim/campaign';
import { HOLD, MASS, lent, massOrder, massingOf, secondFor, wayTo } from '../src/sim/rivalmass';
import { aimOf, planOf } from '../src/sim/rivalplan';

/** A rival holding its capital and the land beside it (`mid`), its heart set on the land beyond (`far`), which the capital does not touch. */
const world = () => {
  for (let seed = 1; seed <= 60; seed++) {
    const c = newCampaign(seed, 2, 1), cap = c.territories.find((t) => t.capital === 1)!;
    const beyond = (m: number) => reach(c, m).find((n) => n !== cap.id && !reach(c, cap.id).includes(n) && c.territories[n].capital < 0 && c.territories[m].adj.includes(n));
    const m = cap.adj.find((n) => c.territories[n].capital < 0 && beyond(n) !== undefined);
    if (m === undefined) continue;
    const mid = c.territories[m], far = c.territories[beyond(m)!];
    for (const t of c.territories) if (t.owner !== 1) Object.assign(t, { buildings: [], capital: t.capital === 0 || t.capital === 2 ? -1 : t.capital });
    Object.assign(mid, { owner: 1, capital: -1, horde: false, buildings: [] });
    Object.assign(far, { owner: -1, capital: -1, horde: false, militia: 9, buildings: ['farm', 'church', 'market', 'barracks', 'range', 'stable', 'fortress', 'tavern', 'harbour', 'granary'] });
    c.armies = c.armies.filter((a) => a.owner !== 1);
    c.places = []; c.bands = [];
    if (aimOf(c, 1) !== far.id) continue;
    return { c, cap, mid, far };
  }
  throw new Error('no world');
};
const army = (c: Campaign, at: number, n = 2, id = 500 + at) => { const a = { id, owner: 1, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };

describe('what a second army is worth', () => {
  it('an army beside a land lends three tenths of its strength to an assault on it, and one further off nothing', () => {
    const { c, cap, mid, far } = world();
    const a = army(c, mid.id, 4);
    expect(lent(c, 1, far.id)).toBeCloseTo(armyStrength(a) * MASS.lend);
    expect(lent(c, 1, far.id, a.id)).toBe(0); // not its own weight twice
    a.at = cap.id;
    expect(lent(c, 1, far.id)).toBe(0);
  });
  it('the way to a land is counted through its own people\'s lands', () => {
    const { c, cap, mid, far } = world();
    expect(wayTo(c, 1, cap.id, mid.id)).toEqual({ steps: 1, first: mid.id });
    expect(wayTo(c, 1, mid.id, mid.id)!.steps).toBe(0);
    expect(wayTo(c, 1, cap.id, far.id)).toBeNull(); // not theirs
  });
});

describe('an army before the way to the aim sends for a second and holds', () => {
  it('the nearest free army is sent for, and comes a land a season', () => {
    const { c, cap, mid, far } = world();
    const first = army(c, mid.id, 2), second = army(c, cap.id, 3);
    expect(secondFor(c, 1, first)).toBe(second);
    expect(massOrder(c, 1, first)).toBe(HOLD);
    expect(massingOf(c, 1)).toMatchObject({ at: mid.id, gate: far.id, by: first.id, with: second.id, since: c.turn });
    expect(massOrder(c, 1, second)).toBe(mid.id);
    expect(moveArmy(c, second.id, mid.id)).toBe('moved');
    expect(c.armies.filter((a) => a.owner === 1)).toHaveLength(1); // the two are one army
    expect(first.units.infantry).toBe(5);
    expect(massOrder(c, 1, first)).toBe(HOLD); // the season it came up
  });
  it('with nobody to send for it holds nothing', () => {
    const { c, mid } = world();
    const first = army(c, mid.id, 2);
    expect(secondFor(c, 1, first)).toBeUndefined();
    expect(massOrder(c, 1, first)).toBe(-1);
    expect(massingOf(c, 1)).toBeUndefined();
  });
  it('a people with no aim masses for nothing', () => {
    const { c, cap, mid } = world();
    const first = army(c, mid.id, 2); army(c, cap.id, 3);
    c.plans![1].aim = -1;
    expect(massOrder(c, 1, first)).toBe(-1);
    expect(massingOf(c, 1)).toBeUndefined();
  });
  it('two that would make more than one army stand side by side: the second holds beside the land to be taken', () => {
    const { c, cap, mid, far } = world();
    const other = c.territories[far.adj.find((n) => n !== mid.id && c.territories[n].adj.includes(mid.id) && n !== cap.id) ?? -1];
    if (!other) return; // this world has no second land beside it
    other.owner = 1;
    const first = army(c, mid.id, MAX_ARMY - 1), second = army(c, other.id, 3);
    expect(massOrder(c, 1, first)).toBe(HOLD);
    expect(massOrder(c, 1, second)).toBe(HOLD);
    expect(massingOf(c, 1)!.joined).toBe(c.turn);
    expect(lent(c, 1, far.id, first.id)).toBeCloseTo(armyStrength(second) * MASS.lend);
  });
});

describe('the wait ends', () => {
  it('when the second has come and the two still do not dare, the aim is given up', () => {
    const { c, cap, mid, far } = world();
    const first = army(c, mid.id, 2), second = army(c, cap.id, 3);
    massOrder(c, 1, first);
    moveArmy(c, second.id, massOrder(c, 1, second));
    c.turn += 1;
    expect(massOrder(c, 1, first)).toBe(-1);
    expect(massingOf(c, 1)).toBeUndefined();
    expect(planOf(c, 1)!.aim).not.toBe(far.id);
  });
  it('when the second never comes, after the wait', () => {
    const { c, cap, mid, far } = world();
    const first = army(c, mid.id, 2); army(c, cap.id, 3);
    massOrder(c, 1, first);
    c.turn += MASS.wait;
    expect(massOrder(c, 1, first)).toBe(HOLD);
    c.turn += 1;
    expect(massOrder(c, 1, first)).toBe(-1);
    expect(planOf(c, 1)!.aim).not.toBe(far.id);
  });
  it('when the second is lost, or the first has gone, the massing is over and the aim stands', () => {
    const { c, cap, mid, far } = world();
    const first = army(c, mid.id, 2), second = army(c, cap.id, 3);
    massOrder(c, 1, first);
    c.armies.splice(c.armies.indexOf(second), 1);
    expect(massingOf(c, 1)).toBeUndefined();
    expect(planOf(c, 1)!.aim).toBe(far.id);
    const again = army(c, cap.id, 3, 900);
    expect(massOrder(c, 1, first)).toBe(HOLD);
    expect(massingOf(c, 1)!.with).toBe(again.id);
    first.at = cap.id;
    expect(massingOf(c, 1)).toBeUndefined();
  });
});
