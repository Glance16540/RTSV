// Children born in captivity, on the map (src/sim/bandborn.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { BORN, bornHeld, bornSeason, kidsOf } from '../src/sim/bandborn';
import { Band, BandKind, THREATS, breakBand, captivesSeason } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign with one band of a kind holding six women and two men of the player's first town. */
const world = (kind: BandKind, seed = 5): { c: Campaign; b: Band; home: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10;
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 0, children: 2 }); delete folkOf(c, t.id).ages;
  const b: Band = { id: 900, kind, name: 'the Test Men', at: t.adj[0], strength: 5, since: c.turn, held: [{ from: t.id, owner: 0, men: [80, 90], women: [80, 90, 100, 110, 120, 130], since: c.turn }] };
  c.bands = [b];
  return { c, b, home: t.id };
};
const seasons = (c: Campaign, n: number): number => { let born = 0; for (let i = 0; i < n; i++) { c.turn++; born += bornSeason(c); } return born; };

describe('children born in captivity on the map', () => {
  it('are born to women held a while, at most one to each, and are records only', () => {
    let all = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { c, b } = world('slavers', seed);
      expect(seasons(c, BORN.after - 1)).toBe(0); // not at once
      const born = seasons(c, THREATS.holdFor - BORN.after);
      expect(born).toBe(kidsOf(b.held[0]).length);
      expect(born).toBeLessThanOrEqual(6);
      expect(b.held[0].bore ?? 0).toBe(born);
      all += born;
      expect(JSON.parse(JSON.stringify(c.bands))).toEqual(c.bands); // plain data
    }
    expect(all).toBeGreaterThan(20);
    expect(all).toBeLessThan(110);
    const men = world('slavers'); men.b.held[0].women = [];
    expect(seasons(men.c, 6)).toBe(0); // nobody to bear one
  });
  it('held by slavers, pirates, highwaymen or marauders are the mother\'s: they come home with her, at their own ages', () => {
    for (const kind of ['slavers', 'pirates', 'highwaymen', 'marauders'] as BandKind[]) {
      const { c, b, home } = world(kind, 3), f = folkOf(c, home);
      seasons(c, 3);
      const kids = kidsOf(b.held[0]).length, out: string[] = [];
      expect(kids).toBeGreaterThan(0);
      expect(bornHeld(c)).toEqual({ withMothers: kids, kept: 0 });
      breakBand(c, b, out);
      expect(f.children).toBe(2 + kids);
      expect(f.women + f.elders + f.men).toBe(12 + 8);
      expect(f.ages!.k.filter((s) => s <= 3)).toHaveLength(kids); // babes in arms, not grown
      expect(out.join(' ')).toContain(`${kids} ${kids === 1 ? 'child' : 'children'} born while they were held`);
      expect(c.bands).toHaveLength(0);
    }
  });
  it('among raiders, who take people into themselves, are the band\'s own and do not come home', () => {
    const { c, b, home } = world('raiders', 3), f = folkOf(c, home);
    const born = seasons(c, 3);
    expect(born).toBeGreaterThan(0);
    expect(kidsOf(b.held[0])).toHaveLength(0);
    expect(b.born).toBe(born);
    expect(bornHeld(c)).toEqual({ withMothers: 0, kept: born });
    breakBand(c, b, []);
    expect(f.children).toBe(2);
  });
  it('are lost with her if she is held too long, and nothing is told of them', () => {
    const { c, b, home } = world('slavers', 3), out: string[] = [];
    seasons(c, THREATS.holdFor);
    expect(kidsOf(b.held[0]).length).toBeGreaterThan(0);
    c.turn++;
    captivesSeason(c, out);
    expect(b.held).toHaveLength(0);
    expect(folkOf(c, home).children).toBe(2);
    expect(out.join(' ')).not.toMatch(/child/i);
  });
});
