// Who might have met a convoy, noted as it comes in (src/sim/convoys.ts Arrival.met, Campaign.convoyTally): a band in
// wait on its road, and an Inn of its people's on it. The health report reads the tally to compare convoys with an Inn on
// the road against convoys without, among those a band lay in wait for only.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { convoysTurn, sendConvoy } from '../src/sim/convoys';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A road of three lands of the player's, a - b - z, with nobody else about; highwaymen between b and z if `band`. */
function road(seed: number, band: boolean) {
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
  if (band) c.bands = [{ id: 1, kind: 'highwaymen', name: 'the Night Road', at: b.id, to: z.id, strength: 4, since: 1, held: [] } as Band];
  return { c, a, b, z };
}
const inn = (c: Campaign, at: number): void => { const t = c.territories[at]; t.town ??= { at: 2, b: [['towncenter', 40, 40]] }; t.town.b.push(['inn', 46, 40]); };

describe('who might have met a convoy', () => {
  it('notes on its arrival a band in wait on its road and an Inn on it', () => {
    const { c, a, b, z } = road(1, true);
    inn(c, b.id);
    sendConvoy(c, 0, a.id, z.id, { food: 500 });
    c.turn++;
    const [r] = convoysTurn(c);
    expect(r.met).toEqual({ danger: true, inn: true });
    const quiet = road(1, false);
    sendConvoy(quiet.c, 0, quiet.a.id, quiet.z.id, { food: 500 });
    quiet.c.turn++;
    expect(convoysTurn(quiet.c)[0].met).toEqual({ danger: false, inn: false });
  });

  it('counts the player\'s convoys a band lay in wait for, with an Inn on the road and without, and those robbed', () => {
    const sum = { inn: { met: 0, robbed: 0 }, none: { met: 0, robbed: 0 } };
    let robbed = 0;
    for (let seed = 1; seed <= 40; seed++) for (const withInn of [true, false]) {
      const { c, a, b, z } = road(seed, true);
      if (withInn) inn(c, b.id);
      sendConvoy(c, 0, a.id, z.id, { food: 500 });
      c.turn++;
      for (const r of convoysTurn(c)) if (r.robbed) robbed++;
      for (const k of ['inn', 'none'] as const) { sum[k].met += c.convoyTally?.[k].met ?? 0; sum[k].robbed += c.convoyTally?.[k].robbed ?? 0; }
    }
    expect(sum.inn.met).toBe(40);
    expect(sum.none.met).toBe(40);
    expect(sum.inn.robbed + sum.none.robbed).toBe(robbed);
    expect(sum.none.robbed).toBeGreaterThan(sum.inn.robbed); // the Inn keeps the band off half as often
  });

  it('leaves out a convoy no band lay in wait for, and a rival\'s', () => {
    const { c, a, z } = road(2, false);
    sendConvoy(c, 0, a.id, z.id, { food: 500 });
    c.turn++;
    convoysTurn(c);
    expect(c.convoyTally).toBeUndefined();
    const r = road(2, true);
    for (const t of [r.a, r.b, r.z]) t.owner = 1;
    sendConvoy(r.c, 1, r.a.id, r.z.id, { food: 500 });
    r.c.turn++;
    convoysTurn(r.c);
    expect(r.c.convoyTally).toBeUndefined();
  });
});
