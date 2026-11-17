// Free towns (src/sim/freetown.ts): a town that rises is nobody's with its people in it, and may come back by treaty; and a town a people founded is not fresh (unrest.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { FREE, backChance, freeTownsSeason, isFree, riseFree } from '../src/sim/freetown';
import { UNREST, noteHolders, ownFounded, unrestWeights } from '../src/sim/unrest';
import { folkOf, headcount } from '../src/sim/township';

/** The player holds every land but its rivals' capitals; no armies, bands or wild lands. `t` is a town of theirs beside another. */
function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.armies = []; c.bands = []; c.turn = 20; c.events = [];
  for (const t of c.territories) {
    delete t.wild; delete t.horde; delete t.free; delete t.foundedBy;
    if (t.capital < 0 || t.capital === 0) t.owner = 0;
    Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 0, children: 2, hungry: 0 });
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
