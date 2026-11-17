// The roads: an Inn, Escorts and Paved Roads, and what they do for a convoy (src/sim/roads.ts, src/sim/inn.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { CONVOYS, convoysTurn, onTheRoad, sendConvoy, worth } from '../src/sim/convoys';
import { TECHS } from '../src/sim/data';
import { governInns } from '../src/sim/inn';
import { ROADS, escortEdge, hasInn, innRisk, paved, pavedLoad } from '../src/sim/roads';
import { teacherOf } from '../src/sim/studies';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';
import { begunAt } from '../src/sim/townworks';

const base = JSON.stringify(newCampaign(5, 2));
/** A road of three lands of the player's, a - b - z, with nothing else of theirs and nobody about; highwaymen between b and z. */
function road(seed = 5) {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10;
  c.fronts = []; c.armies = []; c.bands = [];
  for (const t of c.territories) if (t.owner === 0) { t.owner = -1; t.capital = -1; }
  let a!: Territory, b!: Territory, z!: Territory;
  for (const x of c.territories) for (const y of x.adj.map((id) => c.territories[id])) for (const w of y.adj.map((id) => c.territories[id]))
    if (!a && w.id !== x.id && !x.adj.includes(w.id) && x.capital < 0 && y.capital < 0 && w.capital < 0) { a = x; b = y; z = w; }
  for (const t of [a, b, z]) {
    t.owner = 0; t.buildings = ['farm'];
    Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 1, children: 3, stores: { food: 9000, wood: 3000, gold: 3000, stone: 3000 } }); delete folkOf(c, t.id).ages;
  }
  a.capital = 0;
  c.factions[0].age = 2;
  const band: Band = { id: 1, kind: 'highwaymen', name: 'the Night Road', at: b.id, to: z.id, strength: 4, since: 1, held: [] };
  c.bands = [band];
  return { c, a, b, z, band };
}
const stand = (c: Campaign, at: number): void => { const t = c.territories[at]; t.town ??= { at: 2, b: [['towncenter', 40, 40]] }; t.town.b.push(['inn', 46, 40]); };
/** Over many seeds: how many convoys of 1000 food from a to z are stopped, and how much is taken in all. */
function run(setup: (c: Campaign, lands: { a: Territory; b: Territory; z: Territory }) => void): { stopped: number; took: number } {
  const sum = { stopped: 0, took: 0 };
  for (let seed = 1; seed <= 80; seed++) {
    const { c, a, b, z } = road(seed);
    setup(c, { a, b, z });
    sendConvoy(c, 0, a.id, z.id, { food: 1000 });
    c.turn++;
    for (const r of convoysTurn(c)) if (r.robbed) { sum.stopped++; sum.took += worth(r.robbed.took); }
  }
  return sum;
}

describe('an Inn on the road', () => {
  it('halves the chance that highwaymen meet a convoy whose road passes through its town', () => {
    const { c, a, b, z } = road();
    expect(innRisk(c, 0, [a.id, b.id, z.id])).toBe(1);
    stand(c, b.id);
    expect(hasInn(c, b.id)).toBe(true);
    expect(innRisk(c, 0, [a.id, b.id, z.id])).toBe(ROADS.inn);
    expect(innRisk(c, 0, [a.id])).toBe(1); // not on this road
    expect(innRisk(c, 1, [a.id, b.id, z.id])).toBe(1); // nor for another people's convoy
    const open = run(() => undefined), kept = run((k, l) => stand(k, l.b.id));
    expect(open.stopped).toBeGreaterThan(80 * CONVOYS.meet * 0.75);
    expect(kept.stopped).toBeLessThan(open.stopped * 0.7);
    expect(kept.stopped).toBeGreaterThan(0);
  });
  it('is begun by a town\'s governor when highwaymen sit on its road, out of plenty and not otherwise', () => {
    const { c, a, b, z } = road();
    expect(governInns(c).sort()).toEqual([b.id, z.id].sort()); // both ends of their road; not a, which is not on it
    expect(begunAt(c, b.id, 'inn')).toBe(true);
    expect(begunAt(c, a.id, 'inn')).toBe(false);
    expect(hasInn(c, b.id)).toBe(false); // begun, not finished
    expect(c.log.filter((l) => l.includes('Inn'))).toHaveLength(2);
    expect(governInns(c)).toEqual([]); // once
    const poor = road();
    for (const t of [poor.b, poor.z]) Object.assign(folkOf(poor.c, t.id).stores, { wood: 300, gold: 200, stone: 100 });
    expect(governInns(poor.c)).toEqual([]); // it would leave too little to buy bread with
    const quiet = road(); quiet.c.bands = [];
    expect(governInns(quiet.c)).toEqual([]);
  });
});

describe('the studies of the road', () => {
  it('are taught at an Inn', () => {
    expect(teacherOf('escorts')).toBe('inn');
    expect(teacherOf('pavedroads')).toBe('inn');
    expect(TECHS.escorts.answers).toBeTruthy();
    expect(TECHS.pavedroads.answers).toBeTruthy();
  });
  it('Escorts: a band that stops a convoy takes half as much', () => {
    const { c } = road();
    expect(escortEdge(c, 0)).toBe(1);
    const open = run(() => undefined), kept = run((k) => { k.factions[0].studies = ['escorts']; });
    expect(kept.stopped).toBe(open.stopped); // they are met as often
    expect(kept.took).toBeGreaterThan(0);
    expect(kept.took).toBeLessThanOrEqual(open.took * ROADS.escorts + kept.stopped);
    expect(kept.took).toBeGreaterThan(open.took * ROADS.escorts * 0.9);
  });
  it('Paved Roads: a convoy comes in when the season turns as any does, and its food goes a quarter further', () => {
    const { c, a, z } = road();
    c.bands = [];
    const had = folkOf(c, z.id).stores.food, wood = folkOf(c, z.id).stores.wood;
    sendConvoy(c, 0, a.id, z.id, { food: 400 });
    c.turn++; convoysTurn(c);
    expect(folkOf(c, z.id).stores.food).toBe(had + 400); // unpaved: what was loaded
    c.factions[0].studies = ['pavedroads'];
    expect(paved(c, 0)).toBe(true);
    expect(pavedLoad(c, 0, 400)).toBe(400 * ROADS.load);
    expect(pavedLoad(c, 1, 400)).toBe(400);
    const left = folkOf(c, a.id).stores.food;
    sendConvoy(c, 0, a.id, z.id, { food: 400, wood: 100 });
    expect(folkOf(c, a.id).stores.food).toBe(left - 400); // the giver gives what it loaded, no more
    expect(onTheRoad(c, 0)).toHaveLength(1); // on the way until the season turns
    expect(folkOf(c, z.id).stores.food).toBe(had + 400);
    c.turn++; convoysTurn(c);
    expect(folkOf(c, z.id).stores.food).toBe(had + 400 + 400 * ROADS.load);
    expect(folkOf(c, z.id).stores.wood).toBe(wood + 100); // only the food goes further
  });
});
