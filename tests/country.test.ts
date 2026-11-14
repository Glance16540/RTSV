import { describe, expect, it } from 'vitest';
import { BIOMES, Biome, Campaign, MAP_H, MAP_W, answerDemand, armyAt, biomeAt, biomeOf, continueAI, defence, endTurn, income, moveArmy, newCampaign, reach, resolvePending } from '../src/sim/campaign';
import { COUNTRY, WORKS, barrierBetween, canOpen, countryOf, countryYield, openBorder, rivalOpens, workFor } from '../src/sim/country';

const LONG = 60_000;
const turn = (c: Campaign) => {
  endTurn(c);
  for (let i = 0; i < 40 && c.phase === 'ai'; i++) {
    if (c.demand) answerDemand(c, true);
    else if (c.pending) resolvePending(c, 'auto');
    continueAI(c);
  }
};
/** Somewhere in this world that is country of the kind asked for. */
const somewhere = (seed: number, kind: Biome): { x: number; y: number } | null => {
  for (let y = 20; y < MAP_H; y += 20) for (let x = 20; x < MAP_W; x += 20) if (biomeAt(seed, x, y) === kind) return { x, y };
  return null;
};
/** A world with every kind of country somewhere in it. */
const varied = (): Campaign => {
  for (let seed = 1; seed < 200; seed++) if ((Object.keys(BIOMES) as Biome[]).every((k) => somewhere(seed, k))) { const c = newCampaign(seed, 1, 1, 'hearth'); c.fronts = []; c.places = []; return c; }
  throw new Error('no world has every country');
};
/** Pick the land up and set it down in country of another kind. */
const set = (c: Campaign, tid: number, kind: Biome): void => { Object.assign(c.territories[tid], somewhere(c.seed, kind)!); expect(biomeOf(c, tid)).toBe(kind); };
/** A world with a closed border the player holds one side of. */
const barred = (): { c: Campaign; from: number; to: number } => {
  for (let seed = 1; seed < 80; seed++) {
    const c = newCampaign(seed, 1, 1, 'hearth');
    const w = (c.barriers ?? [])[0];
    if (!w) continue;
    c.territories[w.a].owner = 0;
    if (c.territories[w.b].owner === 0) c.territories[w.b].owner = -1;
    return { c, from: w.a, to: w.b };
  }
  throw new Error('no world has a closed border');
};

describe('country that matters', () => {
  it('every kind of country says what it does', () => {
    for (const k of Object.keys(BIOMES) as Biome[]) expect(COUNTRY[k].rule.length, k).toBeGreaterThan(10);
  });

  it('a land yields by its country: less in desert and snow, more from a farm in green country', () => {
    const c = varied(), home = c.territories.find((t) => t.capital === 0)!, out = c.territories.find((t) => t.owner < 0)!;
    home.buildings = []; out.owner = 0; out.buildings = []; out.taken = 0;
    set(c, home.id, 'forest'); set(c, out.id, 'forest');
    const plain = income(c, 0);
    for (const k of ['desert', 'snow'] as Biome[]) {
      set(c, out.id, k); expect(income(c, 0), k).toBe(plain - 1); expect(countryYield(c, out.id)).toBe(-1);
      set(c, out.id, 'forest'); set(c, home.id, k); expect(income(c, 0), k + ' capital').toBe(plain); // a capital is fed from all its country
      set(c, home.id, 'forest');
    }
    home.buildings = ['farm'];
    set(c, home.id, 'forest');
    const farmed = income(c, 0);
    set(c, home.id, 'grass');
    expect(income(c, 0)).toBe(farmed + 1);
    expect(countryYield(c, home.id)).toBe(1);
  }, LONG);

  it('no land yields less than nothing, whatever the country', () => {
    const c = varied(), poor = c.territories.find((t) => t.owner === 0 && t.capital < 0) ?? c.territories.find((t) => t.owner < 0)!;
    poor.owner = 0; poor.buildings = []; poor.trait = ''; poor.taken = 2;
    set(c, poor.id, 'grass');
    const before = income(c, 0);
    set(c, poor.id, 'desert'); // 2 - 2 carried off - 1 for the desert: nothing, not a debt
    expect(income(c, 0)).toBe(before);
  }, LONG);

  it('forest and snow are harder to take, for a people and for a local tribe alike', () => {
    const c = varied(), home = c.territories.find((t) => t.capital === 0)!, wild = c.territories.find((t) => t.owner < 0 && !t.horde)!;
    for (const t of [home, wild]) {
      set(c, t.id, 'grass');
      const open = defence(c, t.id);
      for (const k of ['forest', 'snow'] as Biome[]) { set(c, t.id, k); expect(defence(c, t.id), k).toBeGreaterThan(open); }
      set(c, t.id, 'desert');
      expect(defence(c, t.id)).toBe(open);
    }
  }, LONG);

  it('an army marching into marsh or desert arrives weaker, and onto the steppe stronger', () => {
    const at = (kind: Biome): number => {
      const c = varied(), home = c.territories.find((t) => t.capital === 0)!, a = armyAt(c, home.id)!;
      const to = home.adj.map((n) => c.territories[n]).find((t) => t.owner !== 0)!;
      set(c, to.id, kind);
      expect(moveArmy(c, a.id, to.id)).toBe('battle');
      return c.pending!.aStr;
    };
    const plain = at('grass');
    expect(at('forest')).toBe(plain);
    expect(at('marsh')).toBeCloseTo(plain * COUNTRY.marsh.march, 0);
    expect(at('marsh')).toBeLessThan(at('desert'));
    expect(at('desert')).toBeLessThan(plain);
    expect(at('steppe')).toBeGreaterThan(plain);
  }, LONG);
});

describe('opening a closed border', () => {
  it('a bridge or a pass road is paid for once and opens the border both ways for good', () => {
    const { c, from, to } = barred(), work = workFor(c, from, to)!, me = c.factions[0];
    expect(work).toBe(WORKS[barrierBetween(c, from, to)!.kind as 'river']);
    expect(reach(c, from)).not.toContain(to);
    me.supplies = work.cost - 1;
    expect(canOpen(c, 0, from, to)).toBe(false);
    expect(openBorder(c, 0, from, to)).toBe(false);
    me.supplies = work.cost + 3;
    const told = c.chronicle?.length ?? 0;
    expect(openBorder(c, 0, from, to)).toBe(true);
    expect(me.supplies).toBe(3);
    expect(reach(c, from)).toContain(to);
    expect(reach(c, to)).toContain(from);
    expect(barrierBetween(c, from, to)).toBeUndefined();
    expect(c.works).toEqual([expect.objectContaining({ a: from, b: to })]);
    expect(c.chronicle!.length).toBe(told + 1);
    expect(openBorder(c, 0, from, to)).toBe(false); // nothing left to open
    expect(me.supplies).toBe(3);
    const kept = JSON.parse(JSON.stringify(c)) as Campaign; // and it is still open in a saved game
    expect(reach(kept, from)).toContain(to);
  }, LONG);

  it('only the people who hold the land can build from it, and only where the border is closed by land', () => {
    const { c, from, to } = barred();
    c.factions[0].supplies = 50; c.factions[1].supplies = 50;
    expect(canOpen(c, 1, from, to)).toBe(false);
    expect(canOpen(c, 0, to, from)).toBe(c.territories[to].owner === 0);
    const near = c.territories[from].adj[0];
    expect(workFor(c, from, near)).toBeUndefined(); // an open road needs no bridge
    for (const l of c.lanes ?? []) expect(workFor(c, l.a, l.b)).toBeUndefined(); // the sea is crossed from a Harbour
  }, LONG);

  it('a rival opens a border when it has stores to spare, and at once if it has no other way out', () => {
    const { c, from, to } = barred(), cost = workFor(c, from, to)!.cost, rival = c.factions[1];
    for (const t of c.territories) if (t.owner === 1) t.owner = -1;
    c.territories[from].owner = 1;
    rival.supplies = cost + 2;
    expect(rivalOpens(c, 1)).toBe(false); // it has roads enough, and nothing to spare
    rival.supplies = 60;
    expect(rivalOpens(c, 1)).toBe(true);
    expect(rival.supplies).toBeLessThan(60);
    expect((c.works ?? []).length).toBe(1);
    expect(rivalOpens(c, 1)).toBe(false); // one such work is enough for a people with roads out

    const shut = barred();
    for (const t of shut.c.territories) if (t.owner === 1) t.owner = -1;
    const land = shut.c.territories[shut.from];
    land.owner = 1;
    for (const n of land.adj) shut.c.territories[n].adj = shut.c.territories[n].adj.filter((x) => x !== land.id);
    land.adj = [];
    shut.c.factions[1].supplies = workFor(shut.c, shut.from, shut.to)!.cost;
    expect(rivalOpens(shut.c, 1)).toBe(true);
    expect(shut.c.factions[1].supplies).toBe(0);
  }, LONG);

  it('worlds stay whole through thirty turns with country and works in play', () => {
    for (const seed of [3, 11, 24]) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      for (let i = 0; i < 30 && c.phase !== 'over'; i++) turn(c);
      for (const t of c.territories) for (const n of t.adj) expect(c.territories[n].adj, `${seed}: ${t.id}-${n}`).toContain(t.id);
      for (const w of c.works ?? []) { expect(c.territories[w.a].adj).toContain(w.b); expect(barrierBetween(c, w.a, w.b)).toBeUndefined(); }
      for (const f of c.factions) expect(f.supplies).toBeGreaterThanOrEqual(0);
      expect(countryOf(c, 0).rule).toBeTruthy();
    }
  }, 120_000);
});
