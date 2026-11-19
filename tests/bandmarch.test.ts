// Bands on the march (src/sim/bandmarch.ts): farther along a road, drawn by riches, daring a tired or lonely army, and seen by armies they pass.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Army, Campaign, Territory } from '../src/sim/campaign';
import { MARCH, alone, exposure, onRoad, richLure, richness, watchers, warnBound } from '../src/sim/bandmarch';
import { ROAM, roamSeason, wayTo, waysFrom } from '../src/sim/bandroam';
import { AMBUSH, fightByMeans, prey } from '../src/sim/bandfight';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';
import { warned } from '../src/sim/heralds';

/** A world of plain towns of six men with no armies; `owner` holds every land but the capitals of others. */
function world(seed = 11, owner = 0) {
  const c = newCampaign(seed, 2);
  c.fronts = []; c.armies = []; c.turn = 20;
  for (const t of c.territories) {
    if (t.capital !== 0) t.capital = -1;
    t.owner = owner; t.buildings = []; t.trait = ''; delete t.town; delete t.horde;
    Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 0, children: 2 });
    delete folkOf(c, t.id).ages;
  }
  const t = c.territories.find((x) => x.capital < 0 && x.adj.filter((n) => c.territories[n].capital < 0).length >= 2)!;
  return { c, t };
}
const band = (c: Campaign, t: Territory, strength: number): Band => {
  const b: Band = { id: 900 + (c.bands?.length ?? 0), kind: 'raiders', name: 'the Test Men', at: t.id, strength, since: c.turn, held: [] };
  (c.bands ??= []).push(b);
  return b;
};
const army = (c: Campaign, at: number, n: number, owner = 0): Army => { const a: Army = { id: 800 + c.armies.length, owner, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };
/** The world with every town walled but one, three lands or so off, so that a camp sets out for it. */
function setOut(owner = 0) {
  const { c, t } = world(11, owner);
  const b = band(c, t, 4);
  const ways = waysFrom(c, b);
  const farthest = ways.filter((w) => w.steps >= 2).sort((x, y) => y.steps - x.steps || x.to - y.to)[0];
  const near = new Set([t.id, ...t.adj, ...ways.filter((w) => w.steps < farthest.steps).flatMap((w) => [w.to, ...c.territories[w.to].adj])]);
  const soft = c.territories[farthest.to].adj.map((id) => c.territories[id]).find((x) => !near.has(x.id) && x.capital < 0) ?? c.territories[farthest.to];
  for (const x of c.territories) if (x.id !== soft.id) x.buildings = ['fortress'];
  Object.assign(folkOf(c, soft.id), { men: 0 });
  c.turn += ROAM.restless;
  return { c, t, b, soft, plan: wayTo(c, b)! };
}

describe('a band on the march', () => {
  it('a road runs between two lands next to each other that peoples hold, and nowhere else', () => {
    const { c, t } = world();
    const n = t.adj[0];
    expect(onRoad(c, t.id, n)).toBe(true);
    c.territories[n].owner = 1;
    expect(onRoad(c, t.id, n)).toBe(true); // roads join towns, whoever holds them
    c.territories[n].owner = -1;
    expect(onRoad(c, t.id, n)).toBe(false); // none into a land nobody holds
    c.territories[t.id].owner = -1;
    expect(onRoad(c, t.id, n)).toBe(false);
    const far = c.territories.find((x) => x.id !== t.id && !t.adj.includes(x.id))!;
    far.owner = 0; c.territories[t.id].owner = 0;
    expect(onRoad(c, t.id, far.id)).toBe(false);
  });

  it('goes up to MARCH.pace lands a season along roads, and a land a season over wild country', () => {
    const held = setOut(0);
    expect(held.plan.steps).toBeGreaterThan(1);
    const before = waysFrom(held.c, held.b);
    roamSeason(held.c, []);
    const gone = before.find((w) => w.to === held.b.at)!.steps;
    expect(gone).toBe(Math.min(MARCH.pace, held.plan.steps)); // every land is the one people's: roads all the way
    // The same country with the first land on the way held by nobody: no road runs on from it, so one land this season.
    const cut = setOut(0);
    cut.c.territories[cut.plan.next].owner = -1;
    const plan = wayTo(cut.c, cut.b)!;
    expect(plan.steps).toBeGreaterThan(1);
    roamSeason(cut.c, []);
    expect(cut.b.at).toBe(plan.next);
  });

  it('is drawn by full stores when it chooses where to go, by up to MARCH.rich', () => {
    const { c, t } = world();
    const s = folkOf(c, t.id).stores;
    Object.assign(s, { food: 0, wood: 0, gold: 0, stone: 0 });
    expect(richness(c, t.id)).toBe(0);
    expect(richLure(c, t.id)).toBe(1);
    s.gold = MARCH.richAt / 2;
    expect(richness(c, t.id)).toBeCloseTo(0.5);
    s.food = MARCH.richAt * 3;
    expect(richness(c, t.id)).toBe(1);
    expect(richLure(c, t.id)).toBeCloseTo(1 + MARCH.rich);
    c.territories[t.id].owner = -1;
    expect(richness(c, t.id)).toBe(0);
  });

  it('is seen by an army in or beside a land it passes: its people are told, and a town of theirs it is bound for gets word', () => {
    const { c, b, t, soft } = setOut(0);
    const a = army(c, t.adj.find((n) => n !== wayTo(c, b)!.next && c.territories[n].capital < 0) ?? t.adj[0], 1);
    // (an army beside where it starts; it must not stand on the way itself, or there is no way)
    const out: string[] = [];
    const plan = wayTo(c, b);
    if (!plan || plan.steps < 2) return; // the army closed the only way: nothing to see
    roamSeason(c, out);
    expect(watchers(c, [t.id]).map((x) => x.id)).toContain(a.id);
    const seen = (c.bandNews ?? []).filter((n) => n.kind === 'seen');
    expect(seen).toHaveLength(1);
    expect(seen[0].owners).toEqual([0]);
    expect(seen[0].text).toContain('Your army');
    expect(seen[0].text).toContain('on the march');
    expect(warned(c, soft.id)).toBe(true);
    expect(seen[0].text).toContain(`Word is sent to ${soft.name}`);
    // Another people's town is not theirs to warn.
    expect(warnBound(c, 1, soft.id)).toBe(false);
    expect(warnBound(c, 0, undefined)).toBe(false);
    // One telling for each people, however many armies of theirs saw it.
    army(c, a.at, 1);
    expect(watchers(c, [t.id]).filter((x) => x.owner === 0)).toHaveLength(1);
  });
});

describe('an army that is not what it looks', () => {
  it('resting after a storming it counts for MARCH.tired of its strength, alone in a strange land for MARCH.alone', () => {
    const { c, t } = world();
    const a = army(c, t.id, 4);
    expect(exposure(c, a)).toBe(1);
    a.rest = c.turn + 1;
    expect(exposure(c, a)).toBe(MARCH.tired);
    delete a.rest;
    c.territories[t.id].owner = 1;
    expect(alone(c, a)).toBe(true);
    expect(exposure(c, a)).toBe(MARCH.alone);
    army(c, t.adj[0], 1); // a friend beside it
    expect(alone(c, a)).toBe(false);
    expect(exposure(c, a)).toBe(1);
  });

  it('a band that would leave a fresh army be falls on the same army tired, and it fights at what it counts for', () => {
    const { c, t } = world();
    const b = band(c, t, 4);
    const a = army(c, t.id, 4);
    expect(b.strength).toBeLessThan(4 * AMBUSH.odds);
    expect(prey(c, b)).toHaveLength(0); // a fresh army of four is no prey for a band of four
    a.rest = c.turn + 1;
    expect(b.strength).toBeGreaterThanOrEqual(4 * MARCH.tired * AMBUSH.odds);
    expect(prey(c, b).map((x) => x.id)).toEqual([a.id]);
    // Fallen on tired, an army that would have won on any day can lose.
    let lostTired = 0, lostFresh = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const tired of [true, false]) {
        const w = world(seed);
        const bb = band(w.c, w.t, 4), aa = army(w.c, w.t.id, 5);
        if (tired) aa.rest = w.c.turn + 1;
        if (!fightByMeans(w.c, aa, bb, [], true)) { if (tired) lostTired++; else lostFresh++; }
      }
    }
    expect(lostFresh).toBeLessThanOrEqual(4); // five fresh against four seldom lose, now that it is fought out and not summed (roadclash.ts)
    expect(lostTired).toBeGreaterThan(lostFresh * 4);
    expect(lostTired).toBeGreaterThan(15); // five tired men count for three
  });
});
