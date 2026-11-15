// Convoys across a sea lane where either end has a Harbour, and pirates who may take them (src/sim/convoys.ts).
import { describe, expect, it } from 'vitest';
import { cannotSend, convoyLanes, convoysTurn, relieve, roadBetween, seaLegs, sendConvoy } from '../src/sim/convoys';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

/** Two lands of the player's that are not next to each other, joined by one sea lane, with nobody about. */
function strait(seed = 5) {
  const c = newCampaign(seed, 2);
  c.fronts = []; c.armies = []; c.bands = [];
  for (const t of c.territories) if (t.owner === 0) { t.owner = -1; t.capital = -1; }
  const a = c.territories.find((t) => t.capital < 0)!;
  const z = c.territories.find((t) => t.capital < 0 && t.id !== a.id && !a.adj.includes(t.id) && !t.adj.some((n) => a.adj.includes(n)))!;
  c.lanes = [{ a: a.id, b: z.id }];
  for (const t of [a, z]) {
    t.owner = 0; t.buildings = t.buildings.filter((b) => b !== 'harbour');
    const k = folkOf(c, t.id);
    k.men = 6; k.women = 6; k.elders = 1; k.children = 3; k.stores = { food: 500, wood: 500, gold: 500, stone: 500 }; delete k.ages;
  }
  a.capital = 0;
  return { c, a, z };
}
const pirates = (c: Campaign, at: number, strength: number): Band => {
  const b: Band = { id: 77, kind: 'pirates', name: 'the Black Sail', at, strength, since: 0, held: [] };
  (c.bands ??= []).push(b);
  return b;
};
const season = (c: Campaign) => { c.turn++; return convoysTurn(c); };

describe('convoys by sea', () => {
  it('a convoy crosses a sea lane only where either end has a Harbour', () => {
    const { c, a, z } = strait();
    expect(roadBetween(c, 0, a.id, z.id)).toBeNull();
    expect(cannotSend(c, 0, a.id, z.id, { food: 100 })).toMatch(/no road.*sea lane/);
    z.buildings.push('harbour'); // the far end's harbour is enough
    expect(convoyLanes(c, a.id)).toEqual([z.id]);
    expect(roadBetween(c, 0, a.id, z.id)).toEqual([a.id, z.id]);
    expect(roadBetween(c, 0, z.id, a.id)).toEqual([z.id, a.id]);
    expect(cannotSend(c, 0, a.id, z.id, { food: 100 })).toBe('');
    z.owner = 1; // the other end must be the people's own
    expect(roadBetween(c, 0, a.id, z.id)).toBeNull();
  });

  it('goes by land where land is as short, and its sea legs are known', () => {
    const { c, a, z } = strait();
    a.buildings.push('harbour');
    expect(seaLegs(c, [a.id, z.id])).toEqual([[a.id, z.id]]);
    expect(seaLegs(c, [a.id, a.adj[0]])).toEqual([]);
  });

  it('a season on the way, and it comes in whole when nobody waits for it', () => {
    const { c, a, z } = strait();
    a.buildings.push('harbour');
    expect(sendConvoy(c, 0, a.id, z.id, { food: 200 })).toBeTruthy();
    expect(convoysTurn(c)).toEqual([]);
    const came = season(c);
    expect(came[0].at).toBe(z.id);
    expect(came[0].robbed).toBeUndefined();
    expect(folkOf(c, z.id).stores.food).toBe(700);
  });

  it('pirates take half of every store from a convoy at sea, never the people, unless an escort is their match', () => {
    let robbed = 0, escorted = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { c, a, z } = strait(seed);
      a.buildings.push('harbour');
      const band = pirates(c, a.id, 3);
      sendConvoy(c, 0, a.id, z.id, { food: 200, gold: 100, men: 1 });
      const got = season(c)[0];
      if (got.robbed) {
        robbed++;
        expect(got.robbed.by).toBe('the Black Sail');
        expect(got.robbed.took).toEqual({ food: 100, wood: 0, gold: 50, stone: 0 });
        expect(folkOf(c, z.id).stores.food).toBe(600);
        expect(band.strength).toBe(4);
      }
      expect(folkOf(c, z.id).men).toBe(7); // the man comes in all the same
      // With an army of theirs on the road as strong as the band, the pirates let it be.
      const s = strait(seed);
      s.a.buildings.push('harbour');
      pirates(s.c, s.a.id, 1);
      s.c.armies.push({ id: 900, owner: 0, at: s.a.id, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
      sendConvoy(s.c, 0, s.a.id, s.z.id, { food: 200 });
      if (!season(s.c)[0].robbed) escorted++;
    }
    expect(robbed).toBeGreaterThan(4);
    expect(robbed).toBeLessThan(12);
    expect(escorted).toBe(12);
  });

  it('pirates do not touch a convoy that goes only by land', () => {
    const { c, a } = strait();
    const b = c.territories[a.adj[0]];
    b.owner = 0;
    pirates(c, a.id, 9);
    for (let i = 0; i < 8; i++) {
      sendConvoy(c, 0, a.id, b.id, { food: 10 });
      expect(season(c)[0].robbed).toBeUndefined();
    }
  });

  it('the computer feeds a hungry town over the sea', () => {
    const { c, a, z } = strait();
    a.buildings.push('harbour');
    for (const t of [a, z]) t.owner = 1;
    a.capital = 1;
    folkOf(c, z.id).stores.food = 0;
    folkOf(c, a.id).stores.food = 2000;
    const sent = relieve(c, 1);
    expect(sent).toHaveLength(1);
    expect(sent[0].road).toEqual([a.id, z.id]);
  });
});
