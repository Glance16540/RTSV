// Free towns (src/sim/freetown.ts): a town that rises is nobody's with its people in it, and may come back by treaty; and a town a people founded is not fresh (unrest.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { FREE, backChance, canTreat, freeStruck, freeTownsSeason, isFree, riseFree, treat, treatBar, treatCost } from '../src/sim/freetown';
import { UNREST, noteHolders, ownFounded, unrestWeights } from '../src/sim/unrest';
import { TOWN_SCALE as S, folkOf, headcount } from '../src/sim/township';
import { settleStores } from '../src/sim/stores';

/** The player holds every land but its rivals' capitals; no armies, bands or wild lands. `t` is a town of theirs beside another. */
function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.armies = []; c.bands = []; c.turn = 20; c.events = [];
  for (const t of c.territories) {
    delete t.wild; delete t.horde; delete t.free; delete t.foundedBy;
    if (t.capital < 0 || t.capital === 0) t.owner = 0;
    Object.assign(folkOf(c, t.id), { men: 6 * S, women: 6 * S, elders: 0, children: 2 * S, hungry: 0 }); // a town of that size as towns now are (township.ts TOWN_SCALE)
    delete folkOf(c, t.id).ages;
  }
  const t = c.territories.find((x) => x.capital < 0 && x.owner === 0 && x.adj.some((n) => c.territories[n].owner === 0))!;
  return { c, t };
}
/** Turn seasons for the free towns until one comes back or the seasons run out. */
const until = (c: Campaign, seasons: number): number[] => { for (let i = 0; i < seasons; i++) { c.turn++; const b = freeTownsSeason(c); if (b.length) return b; } return []; };

describe('a town that rises', () => {
  it('is a free town: nobody\'s, its people still in it, a few men under arms, and it remembers whose it was', () => {
    const { c, t } = world();
    const people = headcount(folkOf(c, t.id));
    riseFree(c, t.id);
    expect(t.owner).toBe(-1);
    expect(t.militia).toBe(FREE.militia);
    expect(t.free).toEqual({ from: 0, since: c.turn });
    expect(isFree(c, t.id)).toBe(true);
    expect(headcount(folkOf(c, t.id))).toBe(people);
    riseFree(c, t.id); // nobody's already: nothing more to throw off
    expect(t.free).toEqual({ from: 0, since: c.turn });
  });

  it('will not hear of coming back at once, nor hungry, nor to a people that is gone or no longer its neighbour', () => {
    const { c, t } = world();
    riseFree(c, t.id);
    expect(backChance(c, t.id)).toBe(0); // too soon
    c.turn += FREE.cool;
    expect(backChance(c, t.id)).toBe(FREE.back);
    folkOf(c, t.id).hungry = 1;
    expect(backChance(c, t.id)).toBe(0);
    folkOf(c, t.id).hungry = 0;
    c.armies.push({ id: 801, owner: 0, at: t.adj.find((n) => c.territories[n].owner === 0)!, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    expect(backChance(c, t.id)).toBe(FREE.back * FREE.army); // their army beside it
    c.armies = [];
    const owners = t.adj.map((n) => c.territories[n].owner);
    t.adj.forEach((n) => { c.territories[n].owner = 1; });
    expect(backChance(c, t.id)).toBe(0); // no longer neighbours
    t.adj.forEach((n, i) => { c.territories[n].owner = owners[i]; });
    c.factions[0].alive = false;
    expect(backChance(c, t.id)).toBe(0);
  });

  it('comes back by treaty in time: whole, its people\'s again, free no longer, and told in the log and the chronicle', () => {
    let came = 0;
    for (let seed = 11; seed < 31; seed++) {
      const { c, t } = world(seed);
      const people = headcount(folkOf(c, t.id));
      riseFree(c, t.id);
      expect(until(c, FREE.cool - 1)).toEqual([]); // never before it has cooled
      const back = until(c, 120);
      if (!back.length) continue;
      came++;
      expect(back).toEqual([t.id]);
      expect(t.owner).toBe(0);
      expect(t.free).toBeUndefined();
      expect(t.militia).toBe(0);
      expect(t.yoke).toBeUndefined();
      expect(headcount(folkOf(c, t.id))).toBe(people);
      expect(c.log.at(-1)).toContain('come back under your rule by treaty');
      expect(c.chronicle!.at(-1)!.text).toContain('came back');
    }
    expect(came).toBeGreaterThan(15); // at 8 in 100 a season, nearly every one within thirty years
  });

  it('taken by force by anyone, it is theirs and free no longer', () => {
    const { c, t } = world();
    riseFree(c, t.id);
    t.owner = 1;
    c.turn++;
    expect(freeTownsSeason(c)).toEqual([]);
    expect(t.free).toBeUndefined();
    expect(t.owner).toBe(1);
  });
});

describe('a town its people founded', () => {
  it('is not fresh as a taken town is: it begins at UNREST.own and eases to settled; taken by another, it is fresh like any', () => {
    const { c, t } = world();
    noteHolders(c); // every land taken as long held
    const other = c.territories.find((x) => x.id !== t.id && x.capital < 0 && x.owner === 0)!;
    // Both change hands to the player this season: one by settlers, one by the sword.
    for (const x of [t, other]) { x.owner = -1; }
    noteHolders(c);
    c.turn++;
    for (const x of [t, other]) { x.owner = 0; }
    t.foundedBy = { from: other.id, turn: c.turn };
    noteHolders(c);
    expect(ownFounded(c, t.id)).toBe(true);
    expect(ownFounded(c, other.id)).toBe(false);
    expect(unrestWeights(c, t.id).held).toBeCloseTo(UNREST.own);
    expect(unrestWeights(c, other.id).held).toBeCloseTo(UNREST.fresh);
    c.turn += UNREST.settle;
    expect(unrestWeights(c, t.id).held).toBeCloseTo(UNREST.settled);
    expect(unrestWeights(c, other.id).held).toBeCloseTo(UNREST.settled);
    // Taken from its founders, it is a taken town.
    t.owner = 1;
    noteHolders(c);
    expect(ownFounded(c, t.id)).toBe(false);
    expect(unrestWeights(c, t.id).held).toBeCloseTo(UNREST.fresh);
  });
});

describe('treating with a free town', () => {
  it('asks a price by its size and how lately it rose, less with the army beside it, and never less than the least', () => {
    const { c, t } = world();
    riseFree(c, t.id);
    const size = Math.ceil(headcount(folkOf(c, t.id)) / (FREE.folk * S));
    expect(treatCost(c, t.id)).toBe(Math.round(size + FREE.fresh));
    c.turn += FREE.ease / 2;
    expect(treatCost(c, t.id)).toBe(Math.round(size + FREE.fresh / 2));
    c.turn += FREE.ease;
    expect(treatCost(c, t.id)).toBe(Math.max(FREE.least, size));
    c.armies.push({ id: 801, owner: 0, at: t.adj.find((n) => c.territories[n].owner === 0)!, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    expect(treatCost(c, t.id)).toBe(Math.max(FREE.least, Math.round(size * FREE.beside)));
    expect(treatCost(c, c.territories.find((x) => x.owner === 0)!.id)).toBe(0); // not a free town
  });

  it('refuses at first, hungry, to a people that marched on it and was thrown back, to one that is not its neighbour, and to any but the people it left', () => {
    const { c, t } = world();
    riseFree(c, t.id);
    expect(treatBar(c, 0, t.id)).toContain('only just risen');
    c.turn += FREE.soon;
    expect(treatBar(c, 0, t.id)).toBe('');
    expect(treatBar(c, 1, t.id)).toContain('did not rise against you');
    folkOf(c, t.id).hungry = 1;
    expect(treatBar(c, 0, t.id)).toContain('hungry');
    folkOf(c, t.id).hungry = 0;
    freeStruck(c, t.id, 1); // another people's quarrel is not theirs
    expect(treatBar(c, 0, t.id)).toBe('');
    freeStruck(c, t.id, 0);
    expect(treatBar(c, 0, t.id)).toContain('came with the sword');
    expect(backChance(c, t.id)).toBe(0);
    c.turn += FREE.grudge;
    expect(treatBar(c, 0, t.id)).toBe('');
    const owners = t.adj.map((n) => c.territories[n].owner);
    t.adj.forEach((n) => { c.territories[n].owner = 1; });
    expect(treatBar(c, 0, t.id)).toContain('no land beside it');
    t.adj.forEach((n, i) => { c.territories[n].owner = owners[i]; });
    expect(treatBar(c, 0, c.territories.find((x) => x.owner === 0)!.id)).toContain('not a free town');
  });

  it('paid, it comes back whole and is told by name; with too few supplies it cannot be had', () => {
    const { c, t } = world();
    riseFree(c, t.id);
    c.turn += FREE.soon;
    const price = treatCost(c, t.id), people = headcount(folkOf(c, t.id));
    c.factions[0].supplies = 0;
    expect(canTreat(c, 0, t.id)).toBe(false);
    expect(treat(c, 0, t.id)).toBe(false);
    expect(t.owner).toBe(-1);
    for (const x of c.territories) if (x.owner === 0) Object.assign(folkOf(c, x.id).stores, { food: 500, wood: 500, gold: 500, stone: 500 });
    settleStores(c); // what a people has to spend is what its towns hold (stores.ts)
    expect(canTreat(c, 0, t.id)).toBe(true);
    const before = c.factions[0].supplies!;
    expect(treat(c, 0, t.id)).toBe(true);
    expect(t.owner).toBe(0);
    expect(t.free).toBeUndefined();
    expect(headcount(folkOf(c, t.id))).toBe(people);
    expect(c.factions[0].supplies!).toBeLessThan(before);
    expect(c.log.at(-1)).toContain(`${t.name} has come back under your rule by treaty, for ${price} supplies`);
    expect(c.chronicle!.at(-1)!.text).toContain(t.name);
  });

  it('a computer people asks for a town of its own when it has supplies to spare, and not when it has not', () => {
    let asked = 0, poor = 0;
    for (let seed = 11; seed < 31; seed++) for (const rich of [true, false]) {
      const { c, t } = world(seed);
      for (const x of c.territories) if (x.owner === 0) x.owner = 1;
      c.factions[1].alive = true; c.factions[1].isAI = true;
      riseFree(c, t.id);
      for (const x of c.territories) if (x.owner === 1) Object.assign(folkOf(c, x.id).stores, rich ? { food: 900, wood: 900, gold: 900, stone: 900 } : { food: 0, wood: 0, gold: 0, stone: 0 });
      c.factions[1].supplies = rich ? 60 : 0;
      c.turn += FREE.soon;
      let back = false;
      for (let i = 0; i < FREE.cool - FREE.soon - 1 && !back; i++) { c.turn++; back = freeTownsSeason(c).includes(t.id); } // before it would come back unasked
      if (back) { if (rich) asked++; else poor++; expect(c.log.at(-1)).toContain('by treaty, for'); }
    }
    expect(poor).toBe(0);
    expect(asked).toBeGreaterThan(10);
  });
});
