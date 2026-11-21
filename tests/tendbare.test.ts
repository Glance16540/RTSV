// A town without a church can still tend its sick and its mourning, at half strength (src/sim/decrees.ts; the owner's word, 21 November 2026).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { TEND_BARE, TEND_EASE, TEND_GOLD, TEND_PLAGUE, decreeBar, decreesAt, givenAt, issueDecree, sensibleDecrees, strengthAt, tendedPlague } from '../src/sim/decrees';
import { driftTown } from '../src/sim/drift';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** One town of the player's, grieving, with gold and plenty of food; with a church or without. */
const world = (church: boolean): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.bands = [];
  const mine = c.territories.filter((t) => t.owner === 0);
  for (const t of mine.slice(1)) t.owner = -1;
  const t = mine[0];
  t.buildings = church ? ['church'] : [];
  t.decrees = [];
  Object.assign(folkOf(c, t.id).stores, { gold: 500, food: 100000 });
  folkOf(c, t.id).grief = 3;
  c.factions[0].supplies = 50;
  return { c, at: t.id };
};

describe('tending without a church', () => {
  it('may be given, and costs the town the same gold', () => {
    const { c, at } = world(false);
    expect(decreeBar(c, 0, at, 'tend')).toBe('');
    expect(issueDecree(c, 0, at, 'tend')).toBe('');
    expect(folkOf(c, at).stores.gold).toBe(500 - TEND_GOLD);
    folkOf(c, at).stores.gold = TEND_GOLD - 1; c.territories[at].decrees = [];
    expect(decreeBar(c, 0, at, 'tend')).toMatch(/gold/);
  });
  it('is at half the strength it is given at; with a church it is whole', () => {
    expect(TEND_BARE).toBe(0.5);
    const bare = world(false), full = world(true);
    issueDecree(bare.c, 0, bare.at, 'tend'); issueDecree(full.c, 0, full.at, 'tend');
    const sb = strengthAt(bare.c, 0, bare.at), sf = strengthAt(full.c, 0, full.at);
    expect(decreesAt(bare.c, bare.at)[0].strength).toBeCloseTo(sb * TEND_BARE, 6);
    expect(decreesAt(full.c, full.at)[0].strength).toBeCloseTo(sf, 6);
    expect(givenAt(bare.c, bare.at, 'tend', 1)).toBe(TEND_BARE);
    expect(givenAt(full.c, full.at, 'tend', 1)).toBe(1);
    expect(givenAt(bare.c, bare.at, 'guards', 1)).toBe(1); // only tending
  });
  it('lightens grief by half as much as with a church, and spares half as many of plague\'s dead', () => {
    const strainWith = (church: boolean, tend: boolean): number => { const { c, at } = world(church); if (tend) issueDecree(c, 0, at, 'tend'); driftTown(c, at); return folkOf(c, at).drift!.strain; };
    const none = strainWith(false, false), bare = strainWith(false, true), full = strainWith(true, true), noneChurch = strainWith(true, false);
    expect(none).toBeGreaterThan(0);
    const sb = strengthAt(world(false).c, 0, world(false).at), sf = strengthAt(world(true).c, 0, world(true).at);
    expect(bare).toBeCloseTo(none * (1 - TEND_EASE * sb * TEND_BARE), 5);
    expect(full).toBeCloseTo(noneChurch * (1 - TEND_EASE * sf), 5);
    expect(none - bare).toBeLessThan(noneChurch - full + 1e-9);
    const b = world(false); issueDecree(b.c, 0, b.at, 'tend');
    expect(tendedPlague(b.c, b.at)).toBeCloseTo(TEND_PLAGUE * sb * TEND_BARE, 6);
  });
  it('the sensible ruler gives it to a sick or mourning town that has no church', () => {
    const { c, at } = world(false);
    expect(sensibleDecrees(c, 0, () => ({ hungry: false, raided: false, moved: 0, standing: 0, sick: false, grieving: true }))).toBe(1);
    expect(decreesAt(c, at).map((d) => d.kind)).toEqual(['tend']);
    const sick = world(false);
    sensibleDecrees(sick.c, 0, () => ({ hungry: false, raided: false, moved: 0, standing: 0, sick: true, grieving: false }));
    expect(decreesAt(sick.c, sick.at).map((d) => d.kind)).toEqual(['tend']);
  });
  it('a call to church still needs a church', () => {
    const { c, at } = world(false);
    expect(decreeBar(c, 0, at, 'church')).toMatch(/no church/);
  });
});
