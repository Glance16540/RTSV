// What the map's systems share, below all of them (src/sim/campaignbase.ts). That it imports no system is
// scripts/porting-check.mjs's to say: it fails if this module joins an import cycle.
import { describe, expect, it } from 'vitest';
import * as hub from '../src/sim/campaign';
import type { Army, Campaign, Territory } from '../src/sim/campaign';
import * as base from '../src/sim/campaignbase';
import { headcount } from '../src/sim/township';
import { worldsBeforeEmptyBeside } from './helpers';

worldsBeforeEmptyBeside(); // written before every people had an empty land beside its chief town: the worlds these tests were written with

describe('the campaign\'s base', () => {
  it('everything in it is still found in the hub, the same thing and not a copy', () => {
    const names = Object.keys(base);
    expect(names.length).toBeGreaterThan(40);
    for (const n of names) expect((hub as Record<string, unknown>)[n], n).toBe((base as Record<string, unknown>)[n]);
  });

  it('the helpers are what they were', () => {
    const c = hub.newCampaign(7, 2, 1);
    const a = c.armies[0];
    expect(base.armySize(a)).toBe(Object.values(a.units).reduce((n, v) => n + v, 0));
    expect(base.armyAt(c, a.at)).toBe(a);
    expect(base.landOf(c, 0)).toBe(c.territories.filter((t) => t.owner === 0).length);
    // A share of the lands with somebody on them: a wild land nobody has settled is not counted (wilds.ts).
    expect(base.dominionNeed(c)).toBe(Math.ceil(c.territories.filter((t) => !(t.owner < 0 && t.wild && headcount(t.folk!) === 0)).length * base.DOMINION_SHARE));
    expect(base.biomeOf(c, 0)).toBe(base.biomeAt(c.seed, c.territories[0].x, c.territories[0].y));
    expect(base.companyCost(c.territories[0], 'infantry')).toBe(base.COMPANIES.infantry.cost);
  });

  it('what only the hub can do is lent to the systems: the hub\'s own functions, once it has loaded', () => {
    expect(base.HUB.moveArmy).toBe(hub.moveArmy);
    expect(base.HUB.defence).toBe(hub.defence);
    expect(base.HUB.canRaise).toBe(hub.canRaise);
  });
});

// The rules the base carries, one by one: what the hub and every system below it reckon by.
const fresh = (seed = 7): Campaign => hub.newCampaign(seed, 2, 1);
const land = (c: Campaign, over: Partial<Territory> = {}): Territory => ({ ...c.territories[0], trait: '', buildings: [], capital: -1, ...over });
const army = (units: Record<string, number>, over: Partial<Army> = {}): Army => ({ id: 99, owner: 0, at: 0, units, hero: false, vet: 0, moved: false, ...over }) as Army;
const uniqueOf = (kind: string): string | undefined => Object.keys(base.COMPANIES).find((k) => base.COMPANIES[k].base === kind);

describe('companies and what beats what', () => {
  it('the three plain kinds are themselves, and a people\'s own soldiers fight as the plain kind they are of', () => {
    for (const k of ['infantry', 'archers', 'cavalry']) {
      expect(base.familyOf(k)).toBe(k);
      expect(base.COMPANIES[k].civ).toBeUndefined();
    }
    expect(base.familyOf('no such kind')).toBe('no such kind');
    const uniques = Object.keys(base.COMPANIES).filter((k) => base.COMPANIES[k].civ);
    expect(uniques.length).toBeGreaterThan(0);
    for (const k of uniques) {
      const d = base.COMPANIES[k];
      expect(['infantry', 'archers', 'cavalry']).toContain(d.base);
      expect(base.familyOf(k)).toBe(d.base);
      // Never cheaper than the plain kind it is of, and raised where that kind is raised.
      expect(d.cost).toBeGreaterThanOrEqual(base.COMPANIES[d.base!].cost);
      expect(d.needs).toBe(base.COMPANIES[d.base!].needs);
    }
  });

  it('each plain kind beats one other, round in a ring, and beatenIn counts the foe\'s companies of that family', () => {
    expect(base.BEATS).toEqual({ cavalry: 'archers', archers: 'infantry', infantry: 'cavalry' });
    const beaten = new Set(Object.values(base.BEATS));
    expect(beaten.size).toBe(3);
    const foe = { archers: 2, infantry: 3, cavalry: 5 };
    expect(base.beatenIn('cavalry', foe)).toBe(2);
    expect(base.beatenIn('archers', foe)).toBe(3);
    expect(base.beatenIn('infantry', foe)).toBe(5);
    expect(base.beatenIn('cavalry', {})).toBe(0);
    // A people's own archers count as archers on either side.
    const ua = uniqueOf('archers');
    if (ua) {
      expect(base.beatenIn('cavalry', { [ua]: 4 })).toBe(4);
      expect(base.beatenIn(ua, { infantry: 1 })).toBe(1);
    }
  });

  it('soldierWord names a rider, an archer, a soldier, or a people\'s own by its name', () => {
    expect(base.soldierWord('cavalry')).toBe('Rider');
    expect(base.soldierWord('archers')).toBe('Archer');
    expect(base.soldierWord('infantry')).toBe('Soldier');
    expect(base.soldierWord('anything else')).toBe('Soldier');
    const u = Object.keys(base.COMPANIES).find((k) => base.COMPANIES[k].civ)!;
    expect(base.soldierWord(u)).toBe(base.COMPANIES[u].name);
  });
});

describe('prices of buildings and companies', () => {
  it('siteCost: the list price, less for horses and the forge people, a cheap fortress for the stonekin and farm for Egypt, never under 2', () => {
    const c = fresh();
    const t = land(c);
    for (const s of Object.keys(base.SITES)) expect(base.siteCost(t, s)).toBe(Math.max(2, base.SITES[s].cost));
    expect(base.siteCost(land(c, { trait: 'horses' }), 'stable')).toBe(base.SITES.stable.cost - 2);
    expect(base.siteCost(land(c, { trait: 'horses' }), 'barracks')).toBe(base.SITES.barracks.cost);
    expect(base.siteCost(t, 'barracks', 'forge')).toBe(base.SITES.barracks.cost - 1);
    expect(base.siteCost(land(c, { trait: 'horses' }), 'stable', 'forge')).toBe(base.SITES.stable.cost - 3);
    expect(base.siteCost(t, 'fortress', 'stonekin')).toBe(5);
    expect(base.siteCost(t, 'fortress', 'forge')).toBe(base.SITES.fortress.cost - 1);
    expect(base.siteCost(t, 'farm', 'egypt')).toBe(2);
    expect(base.siteCost(t, 'farm', 'forge')).toBe(Math.max(2, base.SITES.farm.cost - 1));
  });

  it('companyCost: less on horse land and for the steppe (cavalry), Greece (infantry), England (archers), less what is hired, never under 1', () => {
    const c = fresh();
    const t = land(c), horses = land(c, { trait: 'horses' });
    expect(base.companyCost(t, 'cavalry')).toBe(base.COMPANIES.cavalry.cost);
    expect(base.companyCost(horses, 'cavalry')).toBe(base.COMPANIES.cavalry.cost - 1);
    expect(base.companyCost(horses, 'cavalry', 'steppe')).toBe(base.COMPANIES.cavalry.cost - 2);
    expect(base.companyCost(horses, 'infantry')).toBe(base.COMPANIES.infantry.cost);
    expect(base.companyCost(t, 'infantry', 'greece')).toBe(base.COMPANIES.infantry.cost - 1);
    expect(base.companyCost(t, 'archers', 'greece')).toBe(base.COMPANIES.archers.cost);
    expect(base.companyCost(t, 'archers', 'england')).toBe(base.COMPANIES.archers.cost - 1);
    expect(base.companyCost(t, 'infantry', '', 1)).toBe(base.COMPANIES.infantry.cost - 1);
    expect(base.companyCost(t, 'infantry', 'greece', 5)).toBe(1); // never under one
    expect(base.companyCost(horses, 'cavalry', 'steppe', 9)).toBe(1);
  });

  it('slots: a capital has room for four buildings, any other land three; homeCorner is the town\'s corner or the third', () => {
    const c = fresh();
    expect(base.slots(land(c, { capital: 0 }))).toBe(4);
    expect(base.slots(land(c, { capital: 1 }))).toBe(4);
    expect(base.slots(land(c, { capital: -1 }))).toBe(3);
    expect(base.homeCorner(land(c, { town: undefined }))).toBe(2);
    expect(base.homeCorner(land(c, { town: { at: 0, b: [] } }))).toBe(0);
    expect(base.homeCorner(land(c, { town: { at: 3, b: [] } }))).toBe(3);
    // Every site the map can build that has a battlefield building names one.
    for (const s of Object.keys(base.SITE_BUILDING)) expect(base.SITES[s]).toBeDefined();
  });
});

describe('piety and decadence', () => {
  it('virtueOf: nobody (-1) and a missing people stand at 0; a people at its own standing', () => {
    const c = fresh();
    c.factions[1].virtue = 42;
    expect(base.virtueOf(c, -1)).toBe(0);
    expect(base.virtueOf(c, 99)).toBe(0);
    expect(base.virtueOf(c, 1)).toBe(42);
    delete c.factions[1].virtue;
    expect(base.virtueOf(c, 1)).toBe(0);
  });

  it('faithOf follows the creed at its boundaries: 70 zealous, 30 devout, above -30 temperate, above -70 worldly, else decadent', () => {
    const c = fresh();
    const at = (v: number): base.FaithDef => { c.factions[1].virtue = v; return base.faithOf(c, 1); };
    expect(at(100)).toBe(base.FAITH.zealous);
    expect(at(70)).toBe(base.FAITH.zealous);
    expect(at(69)).toBe(base.FAITH.devout);
    expect(at(30)).toBe(base.FAITH.devout);
    expect(at(29)).toBe(base.FAITH.temperate);
    expect(at(0)).toBe(base.FAITH.temperate);
    expect(at(-29)).toBe(base.FAITH.temperate);
    expect(at(-30)).toBe(base.FAITH.worldly);
    expect(at(-69)).toBe(base.FAITH.worldly);
    expect(at(-70)).toBe(base.FAITH.decadent);
    expect(at(-100)).toBe(base.FAITH.decadent);
    expect(base.faithOf(c, -1)).toBe(base.FAITH.temperate);
  });

  it('the faiths run in order: the more pious the harder their land is to take and the less a tavern pays', () => {
    const order = ['zealous', 'devout', 'temperate', 'worldly', 'decadent'].map((k) => base.FAITH[k]);
    for (let i = 1; i < order.length; i++) {
      expect(order[i].defence).toBeLessThan(order[i - 1].defence);
      expect(order[i].tavern).toBeGreaterThanOrEqual(order[i - 1].tavern);
      expect(order[i].age).toBeLessThanOrEqual(order[i - 1].age);
    }
    expect(base.FAITH.temperate).toMatchObject({ defence: 1, tavern: 1, raise: 0, age: 0 });
    expect(base.FAITH.zealous.steadfast).toBe(true);
    expect(base.FAITH.decadent.restless).toBe(true);
    expect(base.FAITH.decadent.raise).toBe(1);
  });

  it('tell writes a line of the story at the turn it happened, starting the chronicle if there is none', () => {
    const c = fresh();
    delete c.chronicle;
    c.turn = 5;
    base.tell(c, 'one');
    c.turn = 6;
    base.tell(c, 'two');
    expect(c.chronicle).toEqual([{ turn: 5, text: 'one' }, { turn: 6, text: 'two' }]);
  });
});

describe('armies: size, strength and losses', () => {
  it('strengthVs: companies by their strength, a leader and his rank, veterancy, and up to 30% more against what each kind beats', () => {
    const plain = army({ infantry: 2, cavalry: 1 });
    expect(base.strengthVs(plain)).toBe(2 * base.COMPANIES.infantry.str + base.COMPANIES.cavalry.str);
    expect(base.strengthVs(army({ infantry: 2 }, { vet: 3 }))).toBe(2 + 3);
    expect(base.strengthVs(army({ infantry: 2 }, { hero: true }))).toBe(2 + base.HERO_STRENGTH);
    expect(base.strengthVs(army({ infantry: 2 }, { hero: true }), {}, 2)).toBe(2 + base.HERO_STRENGTH + 2 * base.HERO_RANK_STRENGTH);
    // A rank counts only with a leader there.
    expect(base.strengthVs(army({ infantry: 2 }), {}, 3)).toBe(2);
    // All the foe of the kind infantry beats: the full 30%. Half: 15%. None: nothing more.
    expect(base.strengthVs(army({ infantry: 10 }), { cavalry: 4 })).toBe(13);
    expect(base.strengthVs(army({ infantry: 10 }), { cavalry: 2, archers: 2 })).toBe(11.5);
    expect(base.strengthVs(army({ infantry: 10 }), { archers: 4 })).toBe(10);
    // Rounded to a tenth.
    expect(base.strengthVs(army({ infantry: 1 }), { cavalry: 1, archers: 2 })).toBe(1.1);
  });

  it('armyStrength is the plain strength, with the leader\'s rank only when given the campaign; rankWith is 0 without a leader', () => {
    const c = fresh();
    c.factions[0].heroRank = 2;
    const led = army({ infantry: 3 }, { hero: true, owner: 0 }), unled = army({ infantry: 3 }, { owner: 0 });
    expect(base.rankWith(c, led)).toBe(2);
    expect(base.rankWith(c, unled)).toBe(0);
    expect(base.armyStrength(led)).toBe(3 + base.HERO_STRENGTH);
    expect(base.armyStrength(led, c)).toBe(3 + base.HERO_STRENGTH + 2 * base.HERO_RANK_STRENGTH);
    expect(base.armyStrength(unled, c)).toBe(3);
    expect(base.rankWith(c, army({ infantry: 1 }, { hero: true, owner: 77 }))).toBe(0);
  });

  it('casualties take from the most numerous kind first and always leave one company', () => {
    const a = army({ infantry: 3, archers: 1, cavalry: 2 });
    base.casualties(a, 2);
    expect(a.units).toEqual({ infantry: 1, archers: 1, cavalry: 2 });
    base.casualties(a, 1);
    expect(a.units).toEqual({ infantry: 1, archers: 1, cavalry: 1 });
    base.casualties(a, 50);
    expect(base.armySize(a)).toBe(1);
    expect(Object.values(a.units).every((v) => v > 0)).toBe(true); // a kind run out is struck off, not left at 0
    base.casualties(a, 3);
    expect(base.armySize(a)).toBe(1);
    const b = army({ infantry: 4 });
    base.casualties(b, 0);
    expect(b.units).toEqual({ infantry: 4 });
  });

  it('armyAt finds the army in a land or nothing; landOf counts a people\'s lands; ageOf is 0 for nobody', () => {
    const c = fresh();
    const empty = c.territories.find((t) => !c.armies.some((a) => a.at === t.id))!;
    expect(base.armyAt(c, empty.id)).toBeUndefined();
    expect(base.landOf(c, 0)).toBeGreaterThan(0);
    expect(base.landOf(c, 55)).toBe(0);
    expect(base.landOf(c, 0) + base.landOf(c, 1) + base.landOf(c, 2) + base.landOf(c, -1)).toBe(c.territories.length);
    c.factions[1].age = 2;
    expect(base.ageOf(c, 1)).toBe(2);
    expect(base.ageOf(c, -1)).toBe(0);
    delete c.factions[1].age;
    expect(base.ageOf(c, 1)).toBe(0);
  });

  it('heroFor gives the leader as made with the veterancy the campaign has given them', () => {
    const c = fresh();
    c.factions[1].heroRank = 2;
    expect(base.heroFor(c, 1).rank).toBe(2);
    delete c.factions[1].heroRank;
    expect(base.heroFor(c, 1).rank).toBe(0);
  });
});

describe('peace and dominion', () => {
  it('atTruce: the player and an ally, or a rival under a truce until it runs out; never two rivals unless wed', () => {
    const c = fresh();
    c.turn = 10;
    c.truces = [];
    c.ally = -1;
    expect(base.atTruce(c, 0, 1)).toBe(false);
    c.ally = 1;
    expect(base.atTruce(c, 0, 1)).toBe(true);
    expect(base.atTruce(c, 1, 0)).toBe(true);
    expect(base.atTruce(c, 0, 2)).toBe(false);
    expect(base.atTruce(c, 1, 2)).toBe(false); // the player's ally is not at peace with the other rival
    c.ally = -1;
    c.truces = [{ with: 2, until: 10 }];
    expect(base.atTruce(c, 0, 2)).toBe(true); // to the last turn of it
    expect(base.atTruce(c, 2, 0)).toBe(true);
    c.turn = 11;
    expect(base.atTruce(c, 0, 2)).toBe(false); // run out
    expect(base.atTruce(c, 0, 0)).toBe(false);
    expect(base.atTruce(c, -1, 0)).toBe(false);
    // A royal marriage keeps the peace between two rivals, for as long as it holds.
    c.pacts = [{ kind: 'marriage', a: 1, b: 2, since: 5, until: 12 }];
    expect(base.atTruce(c, 1, 2)).toBe(true);
    expect(base.atTruce(c, 2, 1)).toBe(true);
    c.turn = 13;
    expect(base.atTruce(c, 1, 2)).toBe(false);
  });

  it('dominionNeed: the share of the lands with somebody on them, rounded up; a land nobody holds or lives on is not counted', () => {
    const c = fresh();
    const n = c.territories.length;
    for (const t of c.territories) { t.horde = false; if (t.folk) Object.assign(t.folk, { men: 1 }); }
    expect(base.dominionNeed(c)).toBe(Math.ceil(n * base.DOMINION_SHARE));
    const wild = c.territories.find((t) => t.owner < 0 && t.folk)!;
    if (wild) {
      wild.militia = 0;
      Object.assign(wild.folk!, { men: 0, women: 0, elders: 0, children: 0 });
      expect(base.dominionNeed(c)).toBe(Math.ceil((n - 1) * base.DOMINION_SHARE));
      wild.militia = 2; // somebody holds it after all
      expect(base.dominionNeed(c)).toBe(Math.ceil(n * base.DOMINION_SHARE));
      wild.militia = 0; wild.horde = true; // marauders hold it
      expect(base.dominionNeed(c)).toBe(Math.ceil(n * base.DOMINION_SHARE));
    }
    expect(base.DOMINION_SHARE).toBeGreaterThan(0.5);
    expect(base.DOMINION_TURNS).toBeGreaterThan(0);
  });
});

describe('the world: chance, noise, climate', () => {
  it('luck is the same for the same seed, turn and key, in [0, 1), and differs when any of them does', () => {
    const c = fresh(3);
    const a = base.luck(c, 5);
    expect(base.luck(c, 5)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    expect(base.luck(c, 6)).not.toBe(a);
    c.turn++;
    expect(base.luck(c, 5)).not.toBe(a);
    const xs = Array.from({ length: 400 }, (_, k) => base.luck(c, k));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });

  it('landNoise is whole-number hashing: the same everywhere, in [0, 1], smooth between the grid points', () => {
    expect(base.landNoise(3.25, 7.5, 11)).toBe(base.landNoise(3.25, 7.5, 11));
    expect(base.landNoise(3.25, 7.5, 11)).not.toBe(base.landNoise(3.25, 7.5, 12));
    for (let i = 0; i < 200; i++) {
      const v = base.landNoise(i * 0.37, i * 0.61, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    // Smooth: a small step moves it a little.
    expect(Math.abs(base.landNoise(4.5, 2.5, 9) - base.landNoise(4.501, 2.5, 9))).toBeLessThan(0.01);
    // Continuous across a grid line.
    expect(base.landNoise(5 - 1e-9, 2.3, 9)).toBeCloseTo(base.landNoise(5, 2.3, 9), 6);
  });

  it('worldOf is made once per seed and is one of the five makes, with its temper', () => {
    const w = base.worldOf(1234);
    expect(base.worldOf(1234)).toBe(w);
    const shapes = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      const x = base.worldOf(s);
      expect(['continent', 'continents', 'twin', 'innersea', 'archipelago']).toContain(x.shape);
      expect(Math.abs(x.warm)).toBeLessThanOrEqual(0.15);
      expect(Math.abs(x.wet)).toBeLessThanOrEqual(0.15);
      expect(x.band).toBeGreaterThanOrEqual(0.6);
      expect(x.band).toBeLessThanOrEqual(1.05);
      if (x.warm < -0.08) expect(x.temper).toBe('a cold world');
      shapes.add(x.shape);
    }
    expect(shapes.size).toBeGreaterThan(2);
  });

  it('biomeAt reads the climate by its thresholds, and wasteAt is always snow or sand, the place\'s own where it is either', () => {
    let seen = new Set<string>();
    for (let s = 1; s <= 6; s++) for (let x = 0; x <= base.MAP_W; x += 100) for (let y = 0; y <= base.MAP_H; y += 80) {
      const { warm, wet } = base.climateAt(s, x, y), b = base.biomeAt(s, x, y);
      seen.add(b);
      const want = warm < 0.3 ? 'snow' : warm > 0.68 && wet < 0.55 ? 'desert' : wet < 0.44 ? 'steppe' : wet > 0.8 && warm > 0.42 ? 'marsh' : wet > 0.62 ? 'forest' : 'grass';
      expect(b).toBe(want);
      const w = base.wasteAt(s, x, y);
      expect(['snow', 'desert']).toContain(w);
      if (b === 'snow' || b === 'desert') expect(w).toBe(b);
      else {
        expect(base.wasteAt(s, x, y, -10)).toBe('desert'); // everything is warmer than that
        expect(base.wasteAt(s, x, y, 10)).toBe('snow');
      }
    }
    expect(seen.size).toBeGreaterThan(3);
    for (const b of seen) expect(base.BIOMES[b as base.Biome]).toBeDefined();
  });

  it('biomeOf: a land of the rim is its waste (or where it lies, if it kept none), any other land where it lies', () => {
    const c = fresh();
    const t = c.territories[0];
    t.rim = false;
    expect(base.biomeOf(c, 0)).toBe(base.biomeAt(c.seed, t.x, t.y));
    t.rim = true; t.waste = 'desert';
    expect(base.biomeOf(c, 0)).toBe('desert');
    t.waste = 'snow';
    expect(base.biomeOf(c, 0)).toBe('snow');
    delete t.waste;
    expect(base.biomeOf(c, 0)).toBe(base.wasteAt(c.seed, t.x, t.y));
  });
});

describe('the sea and the march', () => {
  it('lanesOf runs both ways; onSea is an open coast or a land with a lane', () => {
    const c = fresh();
    const [a, b, d] = c.territories.filter((t) => t.trait !== 'coast');
    c.lanes = [{ a: a.id, b: b.id }];
    expect(base.lanesOf(c, a.id)).toEqual([b.id]);
    expect(base.lanesOf(c, b.id)).toEqual([a.id]);
    expect(base.lanesOf(c, d.id)).toEqual([]);
    expect(base.onSea(c, a.id)).toBe(true);
    expect(base.onSea(c, d.id)).toBe(false);
    d.trait = 'coast';
    expect(base.onSea(c, d.id)).toBe(true);
    delete c.lanes;
    expect(base.lanesOf(c, a.id)).toEqual([]);
    expect(base.SEA_LANDING).toBeLessThan(1);
  });

  it('reach: next door only, unless a harbour stands: then along its lanes, and from an open coast to every other coast', () => {
    const c = fresh();
    const t = c.territories.find((x) => x.adj.length > 0)!;
    t.buildings = [];
    expect(base.reach(c, t.id)).toBe(t.adj);
    const far = c.territories.find((x) => x.id !== t.id && !t.adj.includes(x.id))!;
    c.lanes = [{ a: far.id, b: t.id }];
    t.buildings = ['harbour'];
    t.trait = '';
    expect(base.reach(c, t.id).sort((p, q) => p - q)).toEqual([...t.adj, far.id].sort((p, q) => p - q));
    // An open coast sails to every other coast, each once.
    t.trait = 'coast';
    const r = base.reach(c, t.id);
    const coasts = c.territories.filter((x) => x.trait === 'coast' && x.id !== t.id).map((x) => x.id);
    for (const id of coasts) expect(r).toContain(id);
    expect(new Set(r).size).toBe(r.length);
    expect(r).not.toContain(t.id);
    // A lane with no harbour is no way out.
    t.buildings = [];
    expect(base.reach(c, t.id)).toBe(t.adj);
  });
});

describe('weather', () => {
  it('every kind slows an attacker marching into it', () => {
    for (const k of Object.keys(base.WEATHER) as base.Sky[]) {
      expect(base.WEATHER[k].march).toBeGreaterThan(0);
      expect(base.WEATHER[k].march).toBeLessThan(1);
    }
  });

  it('newFront suits the country it starts over and comes in from the edge when asked; frontsOf makes three, once', () => {
    for (let s = 1; s <= 8; s++) {
      const c = fresh(s);
      for (let k = 0; k < 30; k += 3) {
        const f = base.newFront(c, k, true);
        const b = base.biomeAt(c.seed, base.MAP_W / 2, f.y);
        expect(f.kind).toBe(b === 'snow' ? 'snow' : b === 'desert' || b === 'steppe' ? 'dust' : 'rain');
        expect(f.x === -80 || f.x === base.MAP_W + 80).toBe(true);
        expect(Math.sign(f.vx)).toBe(f.x < 0 ? 1 : -1); // it moves onto the map
        expect(f.r).toBeGreaterThanOrEqual(95);
        expect(f.r).toBeLessThanOrEqual(140);
        expect(f.y).toBeGreaterThanOrEqual(base.MAP_H * 0.1);
        expect(f.y).toBeLessThanOrEqual(base.MAP_H * 0.9);
        const inner = base.newFront(c, k, false);
        expect(inner.x).toBeGreaterThanOrEqual(0);
        expect(inner.x).toBeLessThanOrEqual(base.MAP_W);
        expect(base.newFront(c, k, false)).toEqual(inner); // the same for the same turn and key
      }
    }
    const c = fresh();
    delete c.fronts;
    const fs = base.frontsOf(c);
    expect(fs).toHaveLength(3);
    expect(base.frontsOf(c)).toBe(fs);
  });

  it('weatherAt: the kind of a front whose circle a land lies in, nothing outside, and nothing for no land', () => {
    const c = fresh();
    const t = c.territories[0];
    c.fronts = [{ kind: 'snow', x: t.x + 50, y: t.y, r: 60, vx: 0, vy: 0 }];
    expect(base.weatherAt(c, t.id)).toBe('snow');
    c.fronts[0].r = 50; // exactly on the edge is outside
    expect(base.weatherAt(c, t.id)).toBe('');
    c.fronts = [];
    expect(base.weatherAt(c, t.id)).toBe('');
    expect(base.weatherAt(c, 99999)).toBe('');
  });
});
