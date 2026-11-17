/**
 * What the map's systems share, below all of them (docs/PORTING.md: systems stay separate).
 * campaign.ts is the hub: it calls every system each season and in every battle. The systems in turn needed small
 * things the hub kept, the size of an army, a company's price, how a people stands, and imported them from it, so
 * hub and systems could only be had together. Those things live here instead. This module imports no system:
 * only the data tables and the modules that are themselves below everything (creed, hero, powers). The systems
 * import it; campaign.ts re-exports all of it, so whoever imported these from the hub still finds them there.
 *
 * The campaign's record itself (the Campaign, Territory, Army and Faction interfaces) stays in campaign.ts: the
 * systems add their own fields to it there, and an import of types alone ties nothing.
 */
import type { Army, Campaign, Territory } from './campaign';
import { creedOf } from './creed';
import type { HeroSpec } from './hero';
import { leaderAsMade } from './powers';

export const MAP_W = 1300;

export const MAP_H = 800;

export const CAMPAIGN_VERSION = 8;

export const MAX_ARMY = 12; // companies in one army

export const HERO_STRENGTH = 2;

/** What each rank of a leader's veterancy adds to the army they march with, when a battle is settled on the map. */
export const HERO_RANK_STRENGTH = 0.5;

/** Troop companies an army is made of. Each needs a building in the territory where it is raised. */
export interface CompanyDef { name: string; icon: string; cost: number; str: number; needs: string; units: Record<string, number> }

export const COMPANIES: Record<string, CompanyDef> = {
  infantry: { name: 'Infantry', icon: '🗡️', cost: 2, str: 1, needs: 'barracks', units: { clubman: 2 } },
  archers: { name: 'Archers', icon: '🏹', cost: 2, str: 1, needs: 'range', units: { slinger: 2 } },
  cavalry: { name: 'Cavalry', icon: '🐎', cost: 4, str: 2, needs: 'stable', units: { rider: 2 } },
};

/** Buildings that can stand on a territory. */
export interface SiteDef { name: string; icon: string; cost: number; desc: string }

export const SITES: Record<string, SiteDef> = {
  farm: { name: 'Farmland', icon: '🌾', cost: 4, desc: '+2 supplies each turn.' },
  barracks: { name: 'Barracks', icon: '🗡️', cost: 5, desc: 'Raise infantry here.' },
  range: { name: 'Archery Range', icon: '🏹', cost: 5, desc: 'Raise archers here.' },
  stable: { name: 'Stable', icon: '🐴', cost: 7, desc: 'Raise cavalry here.' },
  harbour: { name: 'Harbour', icon: '⚓', cost: 6, desc: 'On the sea only. An army here can make the sea crossings from this land, and from an open coast can sail to any other. Troops landing from the sea fight at four-fifths strength.' },
  church: { name: 'Church', icon: '⛪', cost: 5, desc: 'Your people grow more pious every turn.' },
  tavern: { name: 'Tavern', icon: '🍺', cost: 4, desc: '+1 supply each turn, more among a worldly people. Your people grow more decadent every turn.' },
  fortress: { name: 'Fortress', icon: '🏰', cost: 9, desc: '+3 defence. In battle the defender starts in the Bronze Age with towers.' },
};

/**
 * Piety and decadence on the campaign map. A people's standing (`Faction.virtue`, the same scale as a town's in
 * battle, -100 to 100) is moved each turn by its churches and taverns, sets the creed its towns begin every battle
 * in, and is moved in turn by how the player ruled the town in a battle fought in person.
 * `defence`: how hard its own land is to take. `tavern`: supplies a Tavern pays. `raise`: taken off the cost of a
 * company (swords for hire). `age`: added to the cost of the next age. `steadfast`: its lands never rise in revolt.
 * `restless`: a land of theirs in unrest rises even with a garrison in it if that garrison is a single company.
 */
export const CHURCH_VIRTUE = 2;

export const TAVERN_VIRTUE = 3;

/** How much of what a town became in a battle the whole people takes home with it. */
export const BATTLE_VIRTUE = 0.5;

export interface FaithDef { defence: number; tavern: number; raise: number; age: number; steadfast?: boolean; restless?: boolean; desc: string }

export const FAITH: Record<string, FaithDef> = {
  zealous: { defence: 1.2, tavern: 0, raise: 0, age: 3, steadfast: true, desc: 'Their own land is a fifth harder to take and never rises in revolt. Taverns pay nothing, and each new age costs 3 more.' },
  devout: { defence: 1.1, tavern: 1, raise: 0, age: 1, desc: 'Their own land is a tenth harder to take. Each new age costs 1 more.' },
  temperate: { defence: 1, tavern: 1, raise: 0, age: 0, desc: 'Neither saints nor sinners: nothing is changed.' },
  worldly: { defence: 0.95, tavern: 2, raise: 0, age: 0, desc: 'Taverns pay double. Their own land is a little easier to take.' },
  decadent: { defence: 0.85, tavern: 3, raise: 1, age: 0, restless: true, desc: 'Taverns pay threefold and every company costs 1 less. Their own land is easier to take, and a land in unrest rises unless two companies or more hold it down.' },
};

export const virtueOf = (c: Campaign, f: number): number => (f < 0 ? 0 : c.factions[f]?.virtue ?? 0);

export const faithOf = (c: Campaign, f: number): FaithDef => FAITH[creedOf(virtueOf(c, f)).id];

/** Write a line of the campaign's story. */
export function tell(c: Campaign, text: string): void {
  (c.chronicle ??= []).push({ turn: c.turn, text });
}

export const slots = (t: Territory) => (t.capital >= 0 ? 4 : 3);

/** What each troop type is good against: its companies fight up to 30% harder against that type. */
export const BEATS: Record<string, string> = { cavalry: 'archers', archers: 'infantry', infantry: 'cavalry' };

export const MAX_VETERAN = 3;

export const TRUCE_COST = 3;

export const TRUCE_TURNS = 6;

export const ALLIANCE_COST = 6;

export const MAX_FAVOR = 3;

/** Hold this share of all the land for this many turns running and the campaign is won. */
export const DOMINION_SHARE = 0.6;

export const DOMINION_TURNS = 10;

export function siteCost(t: Territory, site: string, civ = ''): number {
  if (site === 'fortress' && civ === 'stonekin') return 5;
  if (site === 'farm' && civ === 'egypt') return 2;
  return Math.max(2, SITES[site].cost - (site === 'stable' && t.trait === 'horses' ? 2 : 0) - (civ === 'forge' ? 1 : 0));
}

export function companyCost(t: Territory, type: string, civ = '', hire = 0): number {
  return Math.max(1, COMPANIES[type].cost - hire - (type === 'cavalry' && t.trait === 'horses' ? 1 : 0) - (type === 'cavalry' && civ === 'steppe' ? 1 : 0) - ((type === 'infantry' && civ === 'greece') || (type === 'archers' && civ === 'england') ? 1 : 0));
}

/** The building that stands on the battlefield for each building of the campaign map. */
export const SITE_BUILDING: Record<string, string> = { farm: 'farm', barracks: 'barracks', range: 'range', stable: 'stable', harbour: 'dock', fortress: 'tower' };

/** The corner of its battlefield a land's holder defends from. The attacker makes camp in the one opposite. */
export const homeCorner = (t: Territory): number => t.town?.at ?? 2;

/** Marauders on the map: the turn they may first appear, how strong a camp grows, and what breaking one is worth. */
export const HORDE_TURN = 4;

export const HORDE_MAX = 12;

export const HORDE_SPREAD = 6;

export const HORDE_PRIZE = 4;

/** A run of chances of its own for weather and the lasting events, so the rest of the campaign's luck is left as it was. */
export function luck(c: Campaign, k: number): number {
  let t = (Math.imul(c.seed | 0, 2654435761) ^ Math.imul(c.turn + 11, 40503) ^ Math.imul(k + 7, 69069)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Smooth noise that comes out the same on every machine (whole-number hashing, no sines). */
export function landNoise(x: number, y: number, seed: number): number {
  const h = (i: number, j: number): number => {
    let t = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
    t = Math.imul(t ^ (t >>> 13), 1103515245);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** The kinds of country a world is made of. Every campaign lays them out differently. */
export type Biome = 'grass' | 'forest' | 'marsh' | 'steppe' | 'desert' | 'snow';

export const BIOMES: Record<Biome, { name: string; icon: string; desc: string; climate: 'temperate' | 'desert' | 'steppe' | 'snow' }> = {
  grass: { name: 'Green country', icon: '🌾', desc: 'Meadow and scattered woods.', climate: 'temperate' },
  forest: { name: 'Deep forest', icon: '🌲', desc: 'Old woods, thick with timber.', climate: 'temperate' },
  marsh: { name: 'Marshland', icon: '🪷', desc: 'Low, wet ground and reeds.', climate: 'temperate' },
  steppe: { name: 'Steppe', icon: '🐎', desc: 'Dry grass under a wide sky.', climate: 'steppe' },
  desert: { name: 'Desert', icon: '🏜️', desc: 'Sand, rock and the odd oasis.', climate: 'desert' },
  snow: { name: 'The frozen north', icon: '❄️', desc: 'Snow and fir.', climate: 'snow' },
};

/** How warm (0 cold to 1 hot) and how wet (0 dry to 1 wet) a point of a world is. Which end is cold, and where the dry lands lie, differ from world to world. */
/** The broad make of a world: how its land is broken up by the sea, and its temper. Every seed has its own. */
export type WorldShape = 'continent' | 'continents' | 'twin' | 'innersea' | 'archipelago';

export interface World { shape: WorldShape; temper: string; warm: number; wet: number; band: number; peaks: number; lakes: number; turn: number; cut: number }

const worlds = new Map<number, World>();

export function worldOf(seed: number): World {
  const had = worlds.get(seed);
  if (had) return had;
  const r = (k: number): number => landNoise(k * 3 + 1, seed % 9973, (seed % 100000) + 500 + k);
  const pick = r(0);
  const shape: WorldShape = pick < 0.16 ? 'continent' : pick < 0.44 ? 'continents' : pick < 0.62 ? 'twin' : pick < 0.8 ? 'innersea' : 'archipelago';
  const warm = (r(1) - 0.5) * 0.3, wet = (r(2) - 0.5) * 0.3, band = 0.6 + r(3) * 0.45;
  const temper = warm < -0.08 ? 'a cold world' : warm > 0.08 ? (wet < -0.04 ? 'a parched world' : 'a hot world') : wet > 0.08 ? 'a green, rainy world' : wet < -0.08 ? 'a dry world' : 'a mild world';
  const w: World = { shape, temper, warm, wet, band, peaks: (r(4) - 0.5) * 0.14, lakes: (r(5) - 0.5) * 0.12, turn: r(6) * Math.PI, cut: 0.8 + r(7) * 0.5 };
  worlds.set(seed, w);
  return w;
}

export function climateAt(seed: number, x: number, y: number): { warm: number; wet: number } {
  const W = worldOf(seed);
  const flip = (seed >>> 1) % 2 === 1, turn = ((seed >>> 3) % 5) / 5 - 0.4; // cold in the south for half of all worlds; the cold line tilts
  const lat = y / MAP_H + (x / MAP_W - 0.5) * turn;
  const warm = 0.5 + ((flip ? 1 - lat : lat) - 0.5) * 0.85 * W.band + 0.005 + W.warm + (landNoise(x / 190, y / 190, seed + 11) - 0.5) * 0.26;
  const side = (seed >>> 6) % 2 === 1 ? x / MAP_W : 1 - x / MAP_W; // the rain comes from one side
  const wet = 0.2 + W.wet + side * 0.3 + landNoise(x / 150, y / 150, seed + 23) * 0.6;
  return { warm, wet };
}

export function biomeAt(seed: number, x: number, y: number): Biome {
  const { warm, wet } = climateAt(seed, x, y);
  if (warm < 0.3) return 'snow';
  if (warm > 0.68 && wet < 0.55) return 'desert';
  if (wet < 0.44) return 'steppe';
  if (wet > 0.8 && warm > 0.42) return 'marsh';
  if (wet > 0.62) return 'forest';
  return 'grass';
}

export const biomeOf = (c: Campaign, tid: number): Biome => biomeAt(c.seed, c.territories[tid].x, c.territories[tid].y);

/**
 * Close the borders an army cannot cross. A march goes by the straight road from town to town; where mountains, a
 * river or open water lie across it, the two lands are no longer neighbours. Passes and fords are left wherever
 * closing a border would cut the world in two, leave a land with a single way in, or close more than a quarter of all borders.
 */
/** The lands a sea lane runs to from this one. */
export const lanesOf = (c: Campaign, tid: number): number[] => (c.lanes ?? []).filter((l) => l.a === tid || l.b === tid).map((l) => (l.a === tid ? l.b : l.a));

/** Whether ships can put out from this land: it lies on the open coast, or a sea lane runs from it. */
export const onSea = (c: Campaign, tid: number): boolean => c.territories[tid].trait === 'coast' || lanesOf(c, tid).length > 0;

export const SEA_LANDING = 0.8;

export const ageOf = (c: Campaign, f: number): number => (f < 0 ? 0 : c.factions[f].age ?? 0);

/** A faction's leader as they take the field: their making, and the veterancy the campaign has given them. */
export const heroFor = (c: Campaign, f: number): HeroSpec => ({ ...leaderAsMade(c.factions[f].hero, c.factions[f].civ, c.factions[f].isAI), rank: c.factions[f].heroRank ?? 0 });

export const armyAt = (c: Campaign, tid: number): Army | undefined => c.armies.find((a) => a.at === tid);

/** Number of companies in an army. */
export const armySize = (a: Army): number => Object.values(a.units).reduce((n, v) => n + v, 0);

/** An army's strength against a given mix of enemy companies (none: its plain strength). */
export function strengthVs(a: Army, foe: Record<string, number> = {}, heroRank = 0): number {
  const total = Object.values(foe).reduce((n, v) => n + v, 0);
  let s = (a.hero ? HERO_STRENGTH + heroRank * HERO_RANK_STRENGTH : 0) + a.vet;
  for (const [type, n] of Object.entries(a.units)) {
    const edge = total ? (0.3 * (foe[BEATS[type]] ?? 0)) / total : 0;
    s += n * COMPANIES[type].str * (1 + edge);
  }
  return Math.round(s * 10) / 10;
}

/** An army's plain strength. Give the campaign and its leader's veterancy is counted too. */
export const armyStrength = (a: Army, c?: Campaign): number => strengthVs(a, {}, c ? rankWith(c, a) : 0);

export const rankWith = (c: Campaign, a: Army): number => (a.hero ? c.factions[a.owner]?.heroRank ?? 0 : 0);

/** True while the player and a rival are bound by a truce. */
export function atTruce(c: Campaign, a: number, b: number): boolean {
  const other = a === 0 ? b : b === 0 ? a : -1;
  return other > 0 && (other === c.ally || c.truces.some((t) => t.with === other && t.until >= c.turn));
}

/**
 * How many territories a faction must hold to rule by dominion: a share of those with somebody on them to rule. A land
 * nobody holds and nobody lives on (a wild land not yet settled, wilds.ts) is settled, not conquered, and is not counted.
 */
export const dominionNeed = (c: Campaign): number => Math.ceil(c.territories.filter((t) => !unpeopled(t)).length * DOMINION_SHARE);
/** Nobody holds this land and nobody lives on it (founding.ts nobodyThere, read here without its imports). */
const unpeopled = (t: Territory): boolean => t.owner < 0 && !t.horde && (t.militia ?? 0) <= 0 && !!t.folk && t.folk.men + t.folk.women + t.folk.elders + t.folk.children === 0;

export const landOf = (c: Campaign, f: number): number => c.territories.filter((t) => t.owner === f).length;

/** Remove `n` companies from an army, taking from its most numerous type first. It keeps at least one. */
export function casualties(a: Army, n: number): void {
  for (let i = 0; i < n && armySize(a) > 1; i++) {
    const type = Object.keys(a.units).sort((x, y) => a.units[y] - a.units[x])[0];
    if (--a.units[type] <= 0) delete a.units[type];
  }
}

export type Sky = 'rain' | 'snow' | 'dust';

export interface Front { kind: Sky; x: number; y: number; r: number; vx: number; vy: number }

/** What weather does on the map. `march` is what is left of an attacker's strength after marching into it. */
export const WEATHER: Record<Sky, { name: string; icon: string; march: number; desc: string }> = {
  rain: { name: 'Heavy rain', icon: '🌧️', march: 0.9, desc: 'An army attacking into it fights at nine tenths strength. A battle here is fought in the rain.' },
  snow: { name: 'Snow', icon: '🌨️', march: 0.85, desc: 'An army attacking into it fights at 85% strength, and the land yields 1 supply less. A battle here is fought in the snow.' },
  dust: { name: 'Dust storm', icon: '🌪️', march: 0.9, desc: 'An army attacking into it fights at nine tenths strength. A battle here is fought in the dust.' },
};

/** A front of the kind that suits the country it starts over: snow in the cold lands, dust in the dry, rain elsewhere. */
export function newFront(c: Campaign, k: number, edge: boolean): Front {
  const y = MAP_H * (0.1 + luck(c, k) * 0.8);
  const b = biomeAt(c.seed, MAP_W / 2, y);
  const kind: Sky = b === 'snow' ? 'snow' : b === 'desert' || b === 'steppe' ? 'dust' : 'rain';
  const east = luck(c, k + 1) < 0.75; // most weather comes out of the west
  return { kind, x: edge ? (east ? -80 : MAP_W + 80) : MAP_W * luck(c, k + 2), y, r: 95 + luck(c, k + 3) * 45, vx: (east ? 1 : -1) * (70 + luck(c, k + 4) * 50), vy: (luck(c, k + 5) - 0.5) * 50 };
}

/** The weather fronts on the map, made the first time they are asked for. */
export function frontsOf(c: Campaign): Front[] {
  return (c.fronts ??= [0, 1, 2].map((i) => newFront(c, i * 10, false)));
}

/** The weather lying over a territory this turn, if any. */
export function weatherAt(c: Campaign, tid: number): Sky | '' {
  const t = c.territories[tid];
  if (!t) return '';
  for (const f of frontsOf(c)) if (Math.hypot(f.x - t.x, f.y - t.y) < f.r) return f.kind;
  return '';
}

/** Where an army in this territory can go in one march: next door, or from a harbour along its sea lanes and to any other open coast. */
export function reach(c: Campaign, tid: number): number[] {
  const t = c.territories[tid];
  if (!t.buildings.includes('harbour')) return t.adj;
  const lanes = lanesOf(c, tid);
  return [...t.adj, ...lanes, ...(t.trait === 'coast' ? c.territories.filter((x) => x.trait === 'coast' && x.id !== tid && !t.adj.includes(x.id) && !lanes.includes(x.id)).map((x) => x.id) : [])];
}

/**
 * What only the hub can do, lent to the systems below it. Marching an army may begin a battle, a land's defence
 * is the sum of half a dozen systems, and whether a company can be raised is a matter of the nation's purse:
 * these are the hub's own work and cannot come down here. But a system that needs one of them (a rival's army
 * marching, a court moving with its leader) must not import the hub to get it, or hub and system can only be had
 * together. So the hub lends them: campaign.ts fills this in once, as it loads, and a system calls `HUB.moveArmy`.
 * Until the hub has loaded there is nothing here to call, and no system runs before it has.
 */
export interface HubActs {
  /** March an army to a land: it moves, or a battle begins, or it cannot go (campaign.ts, moveArmy). */
  moveArmy: (c: Campaign, armyId: number, to: number) => 'moved' | 'battle' | 'invalid';
  /** How hard a land is to take, against these companies and this people (campaign.ts, defence). */
  defence: (c: Campaign, tid: number, vs?: Record<string, number>, attackerCiv?: string) => number;
  /** Can this people raise this company in this land now? (campaign.ts, canRaise) */
  canRaise: (c: Campaign, f: number, tid: number, type: string) => boolean;
}
export const HUB = {} as HubActs;
