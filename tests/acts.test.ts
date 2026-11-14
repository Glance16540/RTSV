// Acts of God on the map: a season of famine, plague and fire in every held land (src/sim/acts.ts).
import { describe, expect, it } from 'vitest';
import { ACTS, actsOfGod, wrathOf } from '../src/sim/acts';
import type { Struck } from '../src/sim/acts';
import { EVENTS, endTurn, continueAI, eventsAt, newCampaign, territoryIncome } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';

const HOLY = 100, PLAIN = 0, FALLEN = -100;
/** A world in which the player's people stand where we say and have stores enough to pay for anything. */
const world = (virtue: number, seed = 11) => {
  const c = newCampaign(seed, 2);
  c.factions[0].virtue = virtue;
  c.factions[0].supplies = 1e6;
  // Eight lands of the player's, so that there is enough to count.
  for (const t of c.territories.filter((x) => x.owner !== 0 && x.capital < 0).slice(0, 7)) t.owner = 0;
  c.fronts = []; // no weather unless a test brings it
  return c;
};
/** Many seasons of chance over one world, with everything put back each season. Counts what fell on the player. */
function seasons(c: Campaign, n: number, each?: (s: Struck[]) => void) {
  const mine = c.territories.filter((t) => t.owner === 0).length;
  const count = { famine: 0, plague: 0, blaze: 0, hard: 0, cost: 0, lands: mine * n };
  const works = c.territories.map((t) => [...t.buildings]);
  for (let s = 0; s < n; s++) {
    c.turn = 10 + s;
    c.events = [];
    c.territories.forEach((t, i) => { t.buildings = [...works[i]]; });
    c.factions[0].supplies = 1e6;
    const struck = actsOfGod(c).filter((x) => x.owner === 0 && x.from === undefined);
    for (const x of struck) { count[x.kind]++; if (x.hard) count.hard++; count.cost += x.cost; }
    each?.(struck);
  }
  return count;
}

describe('acts of God on the map', () => {
  it('each comes to an ordinary people\'s land about as often as ACTS says, and never before the third season', () => {
    const c = world(PLAIN);
    const n = seasons(c, 3000);
    for (const kind of ['famine', 'plague', 'blaze'] as const) {
      const want = ACTS[kind === 'blaze' ? 'fire' : kind] * n.lands;
      expect(n[kind], kind).toBeGreaterThan(want * 0.7);
      expect(n[kind], kind).toBeLessThan(want * 1.3);
    }
    const early = world(PLAIN);
    let any = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { early.seed = seed; for (const turn of [1, 2]) { early.turn = turn; early.events = []; any += actsOfGod(early).length; } }
    expect(any).toBe(0);
  });

  it('a third as often and a third as dear for the Righteous, half again for the Decadent, and nobody is spared', () => {
    const turns = 4000;
    const holy = seasons(world(HOLY), turns), plain = seasons(world(PLAIN), turns), fallen = seasons(world(FALLEN), turns);
    const all = (x: typeof holy) => x.famine + x.plague + x.blaze;
    expect(wrathOf(world(HOLY), 0)).toBeCloseTo(1 / 3, 5);
    expect(all(holy)).toBeGreaterThan(0);
    expect(all(holy) / all(plain)).toBeGreaterThan(0.25);
    expect(all(holy) / all(plain)).toBeLessThan(0.43);
    expect(all(fallen) / all(plain)).toBeGreaterThan(1.3);
    expect(all(fallen) / all(plain)).toBeLessThan(1.7);
    // What one strike costs.
    const each = (x: typeof holy) => x.cost / (x.famine + x.blaze);
    expect(each(holy) / each(plain)).toBeLessThan(0.55);
    expect(each(fallen) / each(plain)).toBeGreaterThan(1.3);
    // And the hard ones: very rare among the Righteous.
    expect(holy.hard / all(holy)).toBeLessThan(0.08);
    expect(plain.hard / all(plain)).toBeGreaterThan(0.15);
    expect(fallen.hard / all(fallen)).toBeGreaterThan(0.4);
  });

  it('a failed harvest costs what the land would have yielded; struck hard with empty stores, the army there loses a company', () => {
    const c = world(PLAIN);
    let seen = 0;
    seasons(c, 3000, (struck) => {
      for (const x of struck.filter((s) => s.kind === 'famine')) {
        expect(x.cost).toBe(territoryIncome(c.territories[x.at], c.factions[0].civ));
        expect(eventsAt(c, x.at).some((e) => e.kind === 'famine')).toBe(true);
        seen++;
      }
    });
    expect(seen).toBeGreaterThan(0);
    expect(c.log.some((l) => l.includes('The harvest has failed in'))).toBe(true);

    // The same seasons with nothing in store and an army in every land.
    const poor = world(FALLEN);
    let walked = 0, soft = 0;
    for (let s = 0; s < 3000; s++) {
      poor.turn = 10 + s; poor.events = []; poor.factions[0].supplies = 0;
      poor.armies = poor.territories.filter((t) => t.owner === 0).map((t, i) => ({ id: 900 + i, owner: 0, at: t.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false }));
      for (const x of actsOfGod(poor).filter((y) => y.owner === 0 && y.kind === 'famine')) {
        const a = poor.armies.find((y) => y.at === x.at)!;
        if (x.hard) { expect(x.company).toBe(true); expect(a.units.infantry).toBe(2); walked++; } else { expect(x.company).toBe(false); expect(a.units.infantry).toBe(3); soft++; }
      }
    }
    expect(walked).toBeGreaterThan(0);
    expect(soft).toBeGreaterThan(0);
  });

  it('fire costs supplies and leaves the land\'s town damaged; struck hard it burns down one of the land\'s works, never a fortress', () => {
    const c = world(PLAIN);
    for (const t of c.territories) if (t.owner === 0) { t.buildings = ['farm', 'fortress']; t.town = { at: 2, b: [['house', 10, 10], ['barracks', 14, 10, 0.5]] }; }
    const before = c.territories.map((t) => t.town && t.town.b.map((b) => [...b]));
    let soft = 0, hard = 0;
    seasons(c, 3000, (struck) => {
      for (const x of struck.filter((s) => s.kind === 'blaze')) {
        const t = c.territories[x.at];
        expect(x.cost).toBe(ACTS.rebuild);
        expect(t.town!.b[0][3]).toBeCloseTo(1 - ACTS.burnt, 1);
        expect(t.town!.b[1][3]).toBeCloseTo(0.5 * (1 - ACTS.burnt), 1);
        expect(t.buildings.includes('fortress')).toBe(true);
        if (x.hard) { expect(x.lost).toBe('farm'); expect(t.buildings).toEqual(['fortress']); hard++; } else { expect(t.buildings).toEqual(['farm', 'fortress']); soft++; }
      }
      c.territories.forEach((t, i) => { if (t.town) t.town.b = before[i]!.map((b) => [...b]) as never; });
    });
    expect(soft).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(0);
  });

  it('neither famine nor fire comes where it rains, and both come twice as often under dust; plague does not mind the weather', () => {
    const under = (kind: 'rain' | 'dust' | '') => {
      const c = world(PLAIN);
      if (kind) c.fronts = [{ kind, x: 650, y: 400, r: 5000, vx: 0, vy: 0 }];
      return seasons(c, 3000);
    };
    const clear = under(''), wet = under('rain'), dry = under('dust');
    expect(wet.famine + wet.blaze).toBe(0);
    expect(wet.plague).toBeGreaterThan(0);
    expect((dry.famine + dry.blaze) / (clear.famine + clear.blaze)).toBeGreaterThan(1.6);
    expect((dry.famine + dry.blaze) / (clear.famine + clear.blaze)).toBeLessThan(2.4);
    expect(dry.plague / clear.plague).toBeGreaterThan(0.7);
    expect(dry.plague / clear.plague).toBeLessThan(1.4);
  });

  it('plague stays its seasons, costs the land a supply and the army there a company each season, and may pass next door', () => {
    const c = world(PLAIN);
    // Find a season in which plague breaks out somewhere of the player's.
    let first: Struck | undefined;
    for (let turn = 10; turn < 4000 && !first; turn++) {
      c.turn = turn; c.events = []; c.factions[0].supplies = 100;
      first = actsOfGod(c).find((x) => x.owner === 0 && x.kind === 'plague' && x.from === undefined && !x.hard);
    }
    expect(first).toBeDefined();
    const t = c.territories[first!.at];
    expect(first!.seasons).toBe(ACTS.seasons);
    expect(eventsAt(c, t.id).some((e) => e.kind === 'plague')).toBe(true);
    c.armies = c.armies.filter((a) => a.at !== t.id);
    c.armies.push({ id: 950, owner: 0, at: t.id, units: { infantry: 3, archers: 1 }, hero: false, vet: 0, moved: false });
    c.factions[0].supplies = 100;
    c.turn++;
    const toll = actsOfGod(c).find((x) => x.at === t.id && x.kind === 'plague' && x.from === undefined)!;
    expect(toll.cost).toBe(ACTS.sick);
    expect(toll.company).toBe(true);
    expect(c.armies.find((a) => a.id === 950)!.units).toEqual({ infantry: 2, archers: 1 });
    // The season after its last, it is gone and takes nothing more.
    c.turn += ACTS.seasons;
    expect(eventsAt(c, t.id).some((e) => e.kind === 'plague')).toBe(false);

    // Passing next door: over many seasons of a plague held in one land, it reaches a neighbour about as often as ACTS.spread says.
    const d = world(PLAIN);
    const home = d.territories.find((x) => x.owner === 0 && x.adj.length > 0)!;
    for (const id of home.adj) d.territories[id].owner = 0;
    let passed = 0;
    const tries = 2000;
    for (let s = 0; s < tries; s++) {
      d.turn = 10 + s;
      d.events = [{ kind: 'plague', at: home.id, turn: d.turn, until: d.turn }];
      if (actsOfGod(d).some((x) => x.from === home.id)) passed++;
    }
    expect(passed / tries).toBeGreaterThan(ACTS.spread * 0.75);
    expect(passed / tries).toBeLessThan(ACTS.spread * 1.25);
    expect(d.log.some((l) => l.includes(`The plague in ${home.name} has passed to`))).toBe(true);
  });

  it('the local tribes\' lands are let be, every kind is named for the map, and a campaign played through its turns meets them', () => {
    const c = world(PLAIN);
    for (const t of c.territories) t.owner = -1;
    for (let s = 0; s < 500; s++) { c.turn = 10 + s; c.events = []; expect(actsOfGod(c)).toEqual([]); }
    for (const kind of ['famine', 'plague', 'blaze'] as const) expect(EVENTS[kind].name.length).toBeGreaterThan(0);

    let told = 0;
    for (const seed of [3, 4, 5, 6]) {
      const g = newCampaign(seed, 2);
      for (let i = 0; i < 40 && g.phase !== 'over'; i++) {
        if (g.pending) break;
        endTurn(g);
        while (g.demand) { g.demand = null; continueAI(g); }
      }
      told += g.log.filter((l) => /harvest has failed in|Plague has broken out in|Fire has gone through the town/.test(l)).length;
    }
    expect(told).toBeGreaterThan(0);
  });
});
