// The Inn's rule read like for like (src/sim/convoys.ts comesOn, ConvoySide): a band in wait comes on a convoy with an
// Inn on its road half as often as it would by the same draw with no Inn there.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { CONVOYS, comesOn, convoysTurn, sendConvoy } from '../src/sim/convoys';
import { ROADS } from '../src/sim/roads';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A road of three lands of the player's, a - b - z, with nobody else about and highwaymen between b and z. */
function road() {
  const c: Campaign = JSON.parse(base);
  c.turn = 10; c.fronts = []; c.armies = [];
  for (const t of c.territories) if (t.owner === 0) { t.owner = -1; t.capital = -1; }
  let a!: Territory, b!: Territory, z!: Territory;
  for (const x of c.territories) for (const y of x.adj.map((id) => c.territories[id])) for (const w of y.adj.map((id) => c.territories[id]))
    if (!a && w.id !== x.id && !x.adj.includes(w.id) && x.capital < 0 && y.capital < 0 && w.capital < 0) { a = x; b = y; z = w; }
  for (const t of [a, b, z]) {
    t.owner = 0; t.buildings = ['farm'];
    Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 1, children: 3, stores: { food: 9e6, wood: 3000, gold: 3000, stone: 3000 } }); delete folkOf(c, t.id).ages;
  }
  a.capital = 0; c.factions[0].age = 2;
  c.bands = [{ id: 1, kind: 'highwaymen', name: 'the Night Road', at: b.id, to: z.id, strength: 4, since: 1, held: [] } as Band];
  return { c, a, b, z };
}
const inn = (c: Campaign, at: number): void => { const t = c.territories[at]; t.town ??= { at: 2, b: [['towncenter', 40, 40]] }; t.town.b.push(['inn', 46, 40]); };
/** Send `n` convoys down the road, one a season, and return the campaign's tally. */
function sent(withInn: boolean, n: number) {
  const { c, a, b, z } = road();
  if (withInn) inn(c, b.id);
  for (let i = 0; i < n; i++) {
    c.bands![0].strength = 4; // the band neither grows on what it takes nor is worn down
    sendConvoy(c, 0, a.id, z.id, { food: 500 });
    c.turn++;
    convoysTurn(c);
  }
  return c.convoyTally!;
}

describe('the Inn halves how often a band comes on a convoy', () => {
  it('with an Inn on the road a band comes on half the convoys it would have by the same draw, and never one it would not', () => {
    const t = sent(true, 1200).inn;
    expect(t.met).toBe(1200);
    expect(t.would! / t.met).toBeGreaterThan(CONVOYS.meet - 0.05); // with no Inn, the common chance
    expect(t.would! / t.met).toBeLessThan(CONVOYS.meet + 0.05);
    expect(t.stopped! / t.would!).toBeGreaterThan(ROADS.inn - 0.06); // with it, half of those
    expect(t.stopped! / t.would!).toBeLessThan(ROADS.inn + 0.06);
    expect(t.robbed).toBe(t.stopped); // nobody of the player's is on the road to see the band off: each one come on is robbed
  });
  it('with no Inn the two are the same count, and the convoys are robbed as often as the common chance', () => {
    const t = sent(false, 1200).none;
    expect(t.met).toBe(1200);
    expect(t.stopped).toBe(t.would);
    expect(t.robbed).toBe(t.stopped);
    expect(t.stopped! / t.met).toBeGreaterThan(CONVOYS.meet - 0.05);
    expect(t.stopped! / t.met).toBeLessThan(CONVOYS.meet + 0.05);
  });
  it('the same convoys are robbed half as often with the Inn as without, where nothing else differs', () => {
    const withInn = sent(true, 1200).inn, without = sent(false, 1200).none;
    const ratio = withInn.robbed / without.robbed;
    expect(ratio).toBeGreaterThan(0.44);
    expect(ratio).toBeLessThan(0.56);
  });
  it('the draw is one draw: asked again it answers the same, and the Inn only ever takes a meeting away', () => {
    const { c, a, b, z } = road();
    inn(c, b.id);
    for (let i = 0; i < 200; i++) {
      const x = sendConvoy(c, 0, a.id, z.id, { food: 500 });
      c.turn++;
      if (typeof x === 'object' && x) { expect(comesOn(c, x)).toBe(comesOn(c, x)); if (comesOn(c, x)) expect(comesOn(c, x, false)).toBe(true); }
      convoysTurn(c);
    }
  });
});
