// Conquest mode: a turn-based strategic map layered over the real-time battles.
// Pure rules, no DOM, so it can be tested headless.

import { AGES, CIVS, CIV_COLOR, CIV_IDS, TECHS } from './data';
import type { PlayerSetup } from './game';
import { LEADERS, LeaderEvent, Speech } from './leaders';
import { habitsWith, leaningWith } from './temper';
import { LEANING, creedOf } from './creed';
import { COMET_VIRTUE, PLACES, Place, PlaceKind, TALES, TALE_EVERY, TALE_FROM, TALE_RIVAL, Tale, TaleChoice, WORLD_CHANCE, WORLD_EVENTS, WORLD_FROM, WORLD_REST, WorldKind } from './story';

export const MAP_W = 1300;
export const MAP_H = 800;
export const CAMPAIGN_VERSION = 8;

export const MAX_ARMY = 12; // companies in one army
export const HERO_COST = 8;
export const HERO_STRENGTH = 2;

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
export const CHURCH_VIRTUE = 6;
export const TAVERN_VIRTUE = 6;
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
/** How far a people's churches and taverns will move it next turn. */
export function virtueDrift(c: Campaign, f: number): number {
  let n = 0;
  for (const t of c.territories) if (t.owner === f) n += (t.buildings.includes('church') ? CHURCH_VIRTUE : 0) - (t.buildings.includes('tavern') ? TAVERN_VIRTUE : 0);
  return n + placeGood(c, f, 'virtue');
}
function shiftVirtue(c: Campaign, f: number, by: number): void {
  const x = c.factions[f];
  if (!x || !by) return;
  const was = creedOf(x.virtue ?? 0);
  x.virtue = Math.max(-100, Math.min(100, Math.round((x.virtue ?? 0) + by)));
  const now = creedOf(x.virtue);
  if (now.id !== was.id) {
    c.log.push(`${x.id === 0 ? 'Your people are' : `${x.name} are`} now ${now.name}. ${FAITH[now.id].desc}`);
    if (now.id === 'zealous' || now.id === 'decadent') tell(c, `${x.id === 0 ? 'Your people' : x.name} became ${now.name}.`);
  }
}
/** Write a line of the campaign's story. */
function tell(c: Campaign, text: string): void {
  (c.chronicle ??= []).push({ turn: c.turn, text });
}
const hash = (a: number, b: number): number => {
  let t = (Math.imul(a | 0, 2654435761) ^ Math.imul(b + 17, 40503)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  return ((t ^ (t >>> 13)) >>> 0) / 4294967296;
};
/** The named places of this world: a few lands that are not capitals, chosen and named by the seed. */
export function placesOf(c: Campaign): Place[] {
  if (c.places) return c.places;
  const open = c.territories.filter((t) => t.capital < 0).sort((a, b) => hash(c.seed, a.id) - hash(c.seed, b.id));
  const kinds = (Object.keys(PLACES) as PlaceKind[]).sort((a, b) => hash(c.seed + 1, a.length * 7 + a.charCodeAt(0)) - hash(c.seed + 1, b.length * 7 + b.charCodeAt(0)));
  const n = Math.min(open.length, 3 + Math.floor(c.territories.length / 6));
  c.places = [];
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length], def = PLACES[kind];
    const k = Math.floor(hash(c.seed + 2, i % kinds.length) * def.names.length) + Math.floor(i / kinds.length); // a second of its kind takes the next name
    c.places.push({ at: open[i].id, kind, name: def.names[k % def.names.length], legend: def.legends[Math.floor(hash(c.seed + 3, i) * def.legends.length)] });
  }
  return c.places;
}
export const placeAt = (c: Campaign, tid: number): Place | undefined => placesOf(c).find((p) => p.at === tid);
/** Add up one kind of good from every named place a people holds. */
const placeGood = (c: Campaign, f: number, what: 'virtue' | 'supplies' | 'age'): number =>
  placesOf(c).reduce((n, p) => n + (c.territories[p.at].owner === f ? PLACES[p.kind][what] ?? 0 : 0), 0);
/** What is befalling the world this turn, if anything. */
export const worldNow = (c: Campaign): WorldKind | '' => (c.world && c.world.until >= c.turn ? c.world.kind : '');
/** Supplies off a company raised by this people in this land: swords for hire, iron in the ground, a season of iron. */
export const hireOff = (c: Campaign, f: number, tid: number): number =>
  faithOf(c, f).raise + (PLACES[placeAt(c, tid)?.kind as PlaceKind]?.raise ?? 0) + (worldNow(c) === 'iron' ? 1 : 0);
export const slots = (t: Territory) => (t.capital >= 0 ? 4 : 3);

/** What each troop type is good against: its companies fight up to 30% harder against that type. */
export const BEATS: Record<string, string> = { cavalry: 'archers', archers: 'infantry', infantry: 'cavalry' };
export const MAX_VETERAN = 3;
import { HeroSpec, cleanHero, MAX_RANK } from './hero';

/** Some land is special. */
export interface TraitDef { name: string; icon: string; desc: string }
export const TRAITS: Record<string, TraitDef> = {
  gold: { name: 'Gold hills', icon: '⛏️', desc: '+3 supplies each turn.' },
  fertile: { name: 'Rich soil', icon: '🌱', desc: 'Farmland here yields +4 instead of +2.' },
  hills: { name: 'High ground', icon: '⛰️', desc: '+2 defence.' },
  horses: { name: 'Horse plains', icon: '🐎', desc: 'Stables and cavalry cost less here.' },
};
/** Land on the edge of the map may lie on the sea. Not drawn by lot with the others, so old worlds keep their shape. */
export const COAST: TraitDef = { name: 'Coast', icon: '🌊', desc: '+1 supply each turn from fishing. Siege battles here are fought around a great lake, with docks and ships.' };
export const traitOf = (key: string): TraitDef | undefined => (key === 'coast' ? COAST : TRAITS[key]);
/** What sets each people apart on the campaign map. */
export const CAMPAIGN_EDGE: Record<string, string> = {
  stonekin: 'Fortresses cost 5 instead of 9 and add 4 defence instead of 3.',
  steppe: 'Cavalry costs 1 less, and an army that marches into friendly land may march again.',
  hearth: 'Farmland yields 1 more, and so does the capital.',
  forge: 'Every building costs 1 less.',
  dawn: 'A new Warlord costs half, and attacks ignore the defender\'s home advantage.',
  wild: 'Local tribes fight them at 1 less, and taking their land brings 2 supplies of plunder.',
  egypt: 'Farmland costs 2 instead of 4.',
  babylon: 'Advancing an age costs 3 less.',
  persia: 'One more supply each turn for every three territories held.',
  greece: 'Infantry costs 1 instead of 2.',
  england: 'Archers cost 1 instead of 2.',
  arabs: 'A truce costs 1 instead of 3, and gifts cost 3 instead of 4.',
  japan: 'New armies are raised as veterans of one battle.',
};

/** How each leader plays: caution in attack, taste for forts and farms, openness to peace, and greed. */
export const PERSONA: Record<string, { margin: number; fort: number; farm: number; peace: number; greed: number }> = {
  stonekin: { margin: 1, fort: 0.6, farm: 0.5, peace: 0.6, greed: 0.1 },
  steppe: { margin: -1, fort: 0.1, farm: 0.3, peace: 0.25, greed: 0.35 },
  hearth: { margin: 1, fort: 0.3, farm: 0.8, peace: 0.75, greed: 0.05 },
  forge: { margin: 0, fort: 0.3, farm: 0.5, peace: 0.45, greed: 0.2 },
  dawn: { margin: 0, fort: 0.2, farm: 0.5, peace: 0.5, greed: 0.25 },
  wild: { margin: -1, fort: 0.05, farm: 0.3, peace: 0.2, greed: 0.4 },
  egypt: { margin: 1, fort: 0.4, farm: 0.8, peace: 0.55, greed: 0.2 },
  babylon: { margin: 1, fort: 0.6, farm: 0.5, peace: 0.5, greed: 0.3 },
  persia: { margin: 0, fort: 0.2, farm: 0.5, peace: 0.6, greed: 0.35 },
  greece: { margin: 0, fort: 0.3, farm: 0.4, peace: 0.5, greed: 0.15 },
  england: { margin: 1, fort: 0.4, farm: 0.7, peace: 0.65, greed: 0.1 },
  arabs: { margin: 0, fort: 0.2, farm: 0.4, peace: 0.7, greed: 0.25 },
  japan: { margin: 0, fort: 0.4, farm: 0.6, peace: 0.4, greed: 0.15 },
};
export const TRUCE_COST = 3;
export const TRUCE_TURNS = 6;
export const ALLIANCE_COST = 6;
export const GIFT_COST = 4;
/** Supplies to bring a whole people into the next age, from the Stone Age up. */
export const AGE_COST = [10, 16, 24, 34];
/** Each age past the first makes a people's armies this much stronger. */
export const AGE_EDGE = 0.1;
export const MAX_FAVOR = 3;
/** Hold this share of all the land for this many turns running and the campaign is won. */
export const DOMINION_SHARE = 0.6;
export const DOMINION_TURNS = 3;

export function siteCost(t: Territory, site: string, civ = ''): number {
  if (site === 'fortress' && civ === 'stonekin') return 5;
  if (site === 'farm' && civ === 'egypt') return 2;
  return Math.max(2, SITES[site].cost - (site === 'stable' && t.trait === 'horses' ? 2 : 0) - (civ === 'forge' ? 1 : 0));
}
export function companyCost(t: Territory, type: string, civ = '', hire = 0): number {
  return Math.max(1, COMPANIES[type].cost - hire - (type === 'cavalry' && t.trait === 'horses' ? 1 : 0) - (type === 'cavalry' && civ === 'steppe' ? 1 : 0) - ((type === 'infantry' && civ === 'greece') || (type === 'archers' && civ === 'england') ? 1 : 0));
}
export const heroCost = (civ: string): number => (civ === 'dawn' ? HERO_COST / 2 : HERO_COST);

export interface Faction {
  id: number; name: string; civ: string; color: number; isAI: boolean; supplies: number; alive: boolean; heroAlive: boolean;
  lastDemand: number; // turn this rival last demanded tribute
  /** The leader as someone has made them, and the veterancy they have earned across the campaign's battles. */
  hero?: Partial<HeroSpec>; heroRank?: number;
  /** Where this people stands between piety (100) and decadence (-100): see FAITH. */
  virtue?: number;
  age?: number; // the age this people has reached on the campaign map, 0 to 4
  favor?: number; // goodwill earned with gifts and help, up to MAX_FAVOR: makes them readier to deal
  refused?: number; // turn they last turned the player down: they will not be asked twice in a turn
  angry: boolean; // refused: will attack the player at worse odds this turn
}

export interface Territory {
  id: number;
  name: string;
  x: number;
  y: number;
  owner: number; // faction id, or -1 for independent locals
  capital: number; // faction whose capital this is, or -1
  buildings: string[];
  trait: string; // key of TRAITS, or '' for ordinary land
  militia: number; // defenders of an independent territory
  adj: number[];
  seed: number; // battles here are always fought on the same ground
  /** Marauders have made this land their own: they grow here, carry off women from the lands around, and spread. */
  horde?: boolean;
  /** Women carried off from here by marauders: each costs the land a supply a turn until they are freed. */
  taken?: number;
}

export interface Army {
  id: number;
  owner: number;
  at: number;
  units: Record<string, number>; // companies by type
  hero: boolean; // the faction's Warlord marches with this army
  marched?: boolean; // has already made its extra march this turn (Mongols)
  vet: number; // battles won, up to MAX_VETERAN: +1 strength each
  moved: boolean;
}

/** A battle waiting to be fought or auto-resolved. */
export interface Pending {
  armyId: number;
  from: number;
  to: number;
  attacker: number;
  defender: number; // -1 for locals
  aStr: number;
  dStr: number;
  /** The attackers came by ship. */
  sea?: boolean;
  /** How the player chose to fight it: armies only on open ground, or a full battle with towns. */
  mode?: 'field' | 'siege';
}

export interface Campaign {
  v: number;
  seed: number;
  /** Borders closed by mountains, a river or open water: the lands either side are not neighbours. */
  barriers?: Barrier[];
  /** Crossings by open water between two lands: an army makes one only from a land with a Harbour. */
  lanes?: { a: number; b: number }[];
  rngState: number;
  level: number; // 0 easy, 1 normal, 2 hard
  turn: number;
  phase: 'player' | 'ai' | 'over';
  cursor: number; // faction whose turn is being played during the AI phase
  spent: boolean; // has the cursor faction done its spending this turn
  factions: Faction[];
  territories: Territory[];
  armies: Army[];
  pending: Pending | null;
  nextArmy: number;
  winner: number;
  log: string[];
  /** Things rival leaders have said that the player has not yet been shown. */
  speech: Speech[];
  /** Truces between the player and rivals: neither side may attack the other until the turn given. */
  truces: { with: number; until: number }[];
  /** Falls when the player breaks a truce; rivals will not deal with a known oathbreaker. */
  honor: number;
  /** A rival's demand for tribute, waiting for the player's answer. */
  demand: { from: number; amount: number } | null;
  /** The rival sworn to the player as an ally, or -1. */
  ally: number;
  /** Who holds most of the land, and for how many turns running. */
  dominion: { f: number; turns: number };
  /** The ally has asked the player to strike at this people before the turn given. */
  request?: { foe: number; until: number } | null;
  /** Weather crossing the map: each front lies over the land within its reach and drifts on every turn. */
  fronts?: Front[];
  /** Things that have happened, or are happening, in particular lands: shown on the map where they are. */
  events?: MapEvent[];
  /** Places with names of their own (see story.ts): made once from the seed, and the same in every telling. */
  places?: Place[];
  /** What is befalling the whole world, until the turn given; and the turn before which nothing new will. */
  world?: { kind: WorldKind; until: number } | null;
  worldRest?: number;
  /** A tale waiting for the player's answer this turn, with the names that fill it in. */
  tale?: { id: string; land: number; rival: number; tribe: number } | null;
  lastTale?: string;
  /** The story so far: what will still matter when the campaign is over. */
  chronicle?: { turn: number; text: string }[];
}

export type Sky = 'rain' | 'snow' | 'dust';
export interface Front { kind: Sky; x: number; y: number; r: number; vx: number; vy: number }
/** What weather does on the map. `march` is what is left of an attacker's strength after marching into it. */
export const WEATHER: Record<Sky, { name: string; icon: string; march: number; desc: string }> = {
  rain: { name: 'Heavy rain', icon: '🌧️', march: 0.9, desc: 'An army attacking into it fights at nine tenths strength. A battle here is fought in the rain.' },
  snow: { name: 'Snow', icon: '🌨️', march: 0.85, desc: 'An army attacking into it fights at 85% strength, and the land yields 1 supply less. A battle here is fought in the snow.' },
  dust: { name: 'Dust storm', icon: '🌪️', march: 0.9, desc: 'An army attacking into it fights at nine tenths strength. A battle here is fought in the dust.' },
};
export type EventKind = 'harvest' | 'volunteers' | 'fever' | 'raiders' | 'hard' | 'unrest' | 'revolt' | 'calm' | 'hoard' | 'found' | 'horde' | 'taken' | 'overrun' | 'freed';
export interface MapEvent { kind: EventKind; at: number; turn: number; until: number }
export const EVENTS: Record<EventKind, { name: string; icon: string; desc: string }> = {
  harvest: { name: 'A fine harvest', icon: '🌾', desc: 'Its holder gained 4 supplies.' },
  volunteers: { name: 'Volunteers', icon: '🚩', desc: 'A company joined the army here.' },
  fever: { name: 'Fever in the camp', icon: '☠️', desc: 'The army here lost a company.' },
  raiders: { name: 'Raiders', icon: '🔥', desc: 'The farmland here was burnt.' },
  hard: { name: 'A hard season', icon: '🥀', desc: 'Its holder lost 3 supplies.' },
  unrest: { name: 'Unrest', icon: '⚔️', desc: 'The people are restless. Unless an army of its holder stands here when it comes to a head, the land goes back to the local tribes.' },
  revolt: { name: 'Revolt', icon: '🏴', desc: 'The land threw off its holder and is the local tribes\' again.' },
  calm: { name: 'Order kept', icon: '🕊️', desc: 'The garrison kept the peace.' },
  hoard: { name: 'A hoard', icon: '💰', desc: 'Word of buried treasure. Whoever holds this land when the digging is done gains 5 supplies.' },
  found: { name: 'Treasure found', icon: '👑', desc: 'Its holder gained 5 supplies.' },
  horde: { name: 'Marauders', icon: '🏴', desc: 'A band that belongs to no people has made camp here. It grows every turn, carries off women from the lands around, and will spread if it is left alone. Take this land to break it.' },
  taken: { name: 'Women carried off', icon: '⛓️', desc: 'Marauders have taken women from here. The land yields a supply less for each raid, up to two, until their camp is broken.' },
  overrun: { name: 'Overrun', icon: '🏴', desc: 'The marauders have taken this land for their own.' },
  freed: { name: 'The women freed', icon: '🕊️', desc: 'The marauders\' camp is broken and those they held have come home.' },
};
export const UNREST_TURNS = 2;
export const HOARD_TURNS = 3;
export const HOARD_PRIZE = 5;
/** Marauders on the map: the turn they may first appear, how strong a camp grows, and what breaking one is worth. */
export const HORDE_TURN = 4;
export const HORDE_MAX = 12;
export const HORDE_SPREAD = 6;
export const HORDE_PRIZE = 4;
export const MAX_TAKEN = 2;

/** A run of chances of its own for weather and the lasting events, so the rest of the campaign's luck is left as it was. */
function luck(c: Campaign, k: number): number {
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
export const WORLD_SHAPES: Record<WorldShape, string> = {
  continent: 'One great continent', continents: 'Several continents, parted by straits', twin: 'Two lands with a sea between',
  innersea: 'Lands round an inner sea', archipelago: 'An archipelago of many islands',
};
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

/** Map points between the heights of the land. */
export const LAND_STEP = 3;
export interface Terrain { gw: number; gh: number; /** Height at every few points: at or under 0 is water. */ H: Float32Array; /** Each river, as the points it runs through from spring to mouth. */ rivers: number[][]; /** 1 where a river runs. */ wet: Uint8Array }
const terrains = new Map<string, Terrain>();
const ease = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * The lie of a world's land, grown from its seed: a ragged coast with bays, lakes between the lands, mountain
 * ranges, and rivers that run from the high ground by the lowest way to the sea. The same for everyone who
 * looks at the same world; the map draws it, and it decides where an army cannot march.
 */
export function terrainOf(c: Campaign): Terrain {
  const key = c.seed + ':' + c.territories.map((t) => `${Math.round(t.x)},${Math.round(t.y)},${t.trait}`).join(';');
  const had = terrains.get(key);
  if (had) return had;
  const sd = c.seed % 100000, N = (x: number, y: number, k: number): number => landNoise(x, y, sd + k);
  const gw = Math.floor(MAP_W / LAND_STEP) + 1, gh = Math.floor(MAP_H / LAND_STEP) + 1, ts = c.territories;
  const H = new Float32Array(gw * gh), W = worldOf(c.seed), ca = Math.cos(W.turn), sa = Math.sin(W.turn);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const px = Math.min(MAP_W - 1, i * LAND_STEP), py = Math.min(MAP_H - 1, j * LAND_STEP);
    // Whose land this is, and how far inside it (half the difference between the nearest town and the next).
    const wx = px + 16 * Math.sin(py / 37), wy = py + 16 * Math.sin(px / 43);
    let best = 0, d1 = Infinity, d2 = Infinity;
    for (let k = 0; k < ts.length; k++) { const d = Math.hypot(ts[k].x - wx, ts[k].y - wy); if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d; }
    const t = ts[best], inside = (d2 - d1) / 2, dC = Math.hypot(px - t.x, py - t.y);
    // The coast: a ragged shore with deep bays, though every land keeps firm ground under its town.
    const rim = Math.min(px, py, MAP_W - 1 - px, MAP_H - 1 - py);
    // Land rises round the towns and nowhere else: a ragged shore with deep bays, though every land keeps firm ground under its town.
    const shore = 1 - ease(84, 132, dC + (N(px / 150, py / 150, 2) - 0.5) * 110 + (N(px / 40, py / 40, 3) - 0.5) * 30 + (t.trait === 'coast' ? 12 : 0));
    // The world's edge is ragged too, so no shore runs straight, and small isles stand off it.
    const rag = rim + (N(px / 115, py / 115, 17) - 0.5) * 110 + (N(px / 30, py / 30, 14) - 0.5) * 34 + (N(px / 10, py / 10, 15) - 0.5) * 9 - 12;
    const isle = ease(0.7, 0.78, N(px / 20, py / 20, 16)) * ease(6, 16, rim) * 0.7 * ease(W.shape === 'archipelago' ? 0.3 : 0.52, 0.62, N(px / 130, py / 130, 18));
    const keep = (1 - ease(30, 66, dC)), firm = 1 - ease(22, 40, dC), edge = ease(6, 36, rag);
    // The sea breaks the world up after its own fashion: straits between continents, one sea down the middle, a sea at the heart, or islands.
    const bend = (N(px / 120, py / 120, 22) - 0.5) * 150, cx = px - MAP_W / 2, cy = py - MAP_H / 2;
    const vein = (sc: number, k: number, wide: number): number => 1 - ease(wide, wide + 0.06, Math.abs(N(px / sc, py / sc, k) * 2 - 1));
    let cut = 0;
    if (W.shape === 'continents') cut = vein(230, 20, 0.1 * W.cut);
    else if (W.shape === 'archipelago') cut = Math.max(vein(170, 20, 0.13 * W.cut), vein(140, 21, 0.11 * W.cut));
    else if (W.shape === 'twin') cut = 1 - ease(34 * W.cut, 34 * W.cut + 30, Math.abs(cx * ca * 0.6 + cy * sa + bend));
    else if (W.shape === 'innersea') cut = 1 - ease(0.75, 1.05, Math.hypot(cx / (250 * W.cut), cy / (140 * W.cut)) + (N(px / 90, py / 90, 22) - 0.5) * 0.7);
    // Lakes and inland seas lie between the lands, never on a town.
    const lake = ease(0.7 + W.lakes, 0.8 + W.lakes, N(px / 110, py / 110, 5)) * ease(50, 85, dC);
    const land = Math.max(Math.max(shore, keep) * (1 - cut) * edge, firm, isle) * (1 - lake * (1 - firm)) * ease(0, 9, rim); // and the sea lies all round
    const { warm, wet } = climateAt(c.seed, px, py);
    const hot = ease(0.62, 0.72, warm) * (1 - ease(0.5, 0.6, wet)), marsh = ease(0.76, 0.84, wet) * ease(0.4, 0.46, warm);
    let roll = 0.5 + N(px / 85, py / 85, 6) * 0.75 + N(px / 20, py / 20, 8) * 0.16;
    roll += hot * Math.abs(Math.sin((px + py * 0.6) / 13 + N(px / 50, py / 50, 12) * 5)) * 0.3; // dunes
    roll += (0.2 - roll) * marsh; // fen lies flat and low
    // Mountain ranges cross the world where the seed puts them, and stand on high ground and gold hills; clear of the towns.
    const range = Math.min(1.25, ease(0.56 + W.peaks, 0.72 + W.peaks, N(px / 170, py / 170, 7)) + (t.trait === 'hills' ? 0.85 : t.trait === 'gold' ? 0.55 : 0) * ease(4, 34, inside));
    let m = 0;
    if (range > 0) {
      const ridge = 1 - Math.abs(N(px / 38 + 7, py / 38 + 3, 9) * 2 - 1);
      m = range * ease(30, 74, Math.hypot(px - t.x, py - (t.y + 6))) * (ridge * ridge * ridge * 5.6 + (1 - Math.abs(N(px / 15, py / 15, 13) * 2 - 1)) * ridge * 1.6 + N(px / 9, py / 9, 10) * 0.7);
    }
    H[j * gw + i] = land * (roll + m) - (1 - land) * 1.6;
  }
  // Rivers: flood the land from the sea upward, so every point knows its lowest way down.
  const parent = new Int32Array(gw * gh).fill(-1), level = new Float32Array(gw * gh), seen = new Uint8Array(gw * gh);
  const heap: number[] = [];
  const push = (n: number): void => { heap.push(n); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (level[heap[p]] <= level[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = (): number => {
    const top = heap[0], end = heap.pop()!;
    if (heap.length) { heap[0] = end; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let b = k; if (l < heap.length && level[heap[l]] < level[heap[b]]) b = l; if (r < heap.length && level[heap[r]] < level[heap[b]]) b = r; if (b === k) break; [heap[b], heap[k]] = [heap[k], heap[b]]; k = b; } }
    return top;
  };
  for (let n = 0; n < H.length; n++) if (H[n] <= 0) { seen[n] = 1; level[n] = 0; push(n); }
  while (heap.length) {
    const n = pop(), i = n % gw, j = (n - i) / gw;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= gw || b >= gh) continue;
      const q = b * gw + a;
      if (seen[q]) continue;
      seen[q] = 1; parent[q] = n; level[q] = Math.max(level[n], H[q]) + (di && dj ? 0.004 : 0); push(q);
    }
  }
  const rivers: number[][] = [], wet = new Uint8Array(gw * gh);
  for (let k = 0; k < 60 && rivers.length < 7; k++) {
    const i = 4 + Math.floor(N(k * 3, 1, 60) * (gw - 8)), j = 4 + Math.floor(N(k * 3, 2, 61) * (gh - 8));
    let n = j * gw + i;
    if (H[n] < 1.7 || rivers.some((r) => Math.hypot((r[0] % gw) - i, Math.floor(r[0] / gw) - j) < 26)) continue;
    const path: number[] = [];
    while (n >= 0 && H[n] > 0 && path.length < 900 && !wet[n]) { path.push(n); n = parent[n]; }
    if (n >= 0) path.push(n); // the mouth, or the river it runs into
    if (path.length < 14) continue;
    for (const q of path) { wet[q] = 1; if (H[q] > 0.12) H[q] = Math.max(0.1, H[q] - 0.22); }
    rivers.push(path);
  }
  const made = { gw, gh, H, rivers, wet };
  if (terrains.size > 12) terrains.delete(terrains.keys().next().value as string);
  terrains.set(key, made);
  return made;
}

/** What lies across the straight road between two towns: mountains, a river, open water, or nothing. */
export type BarrierKind = 'mountains' | 'river' | 'water';
export const BARRIERS: Record<BarrierKind, { icon: string; by: string }> = { mountains: { icon: '⛰️', by: 'the mountains' }, river: { icon: '🏞️', by: 'the river' }, water: { icon: '🌊', by: 'open water' } };
export interface Barrier { a: number; b: number; kind: BarrierKind }
function crossing(c: Campaign, a: number, b: number): { kind: BarrierKind; n: number } | null {
  const T = terrainOf(c), A = c.territories[a], B = c.territories[b], len = Math.hypot(B.x - A.x, B.y - A.y);
  const count: Record<BarrierKind, number> = { mountains: 0, river: 0, water: 0 };
  for (let d = 26; d < len - 26; d += 2) {
    const i = Math.round((A.x + ((B.x - A.x) * d) / len) / LAND_STEP), j = Math.round((A.y + ((B.y - A.y) * d) / len) / LAND_STEP), n = j * T.gw + i;
    if (T.H[n] > 2.3) count.mountains++;
    else if (T.H[n] <= 0) count.water++;
    else if (T.wet[n] || T.wet[n + 1] || T.wet[n - 1] || T.wet[n + T.gw] || T.wet[n - T.gw]) count.river++;
  }
  // A ridge or a stretch of water has to be some twenty points across to stop an army; any river does.
  const kind: BarrierKind | '' = count.mountains >= 9 ? 'mountains' : count.water >= 10 ? 'water' : count.river >= 1 ? 'river' : '';
  return kind ? { kind, n: kind === 'river' ? 14 + count.river : count[kind] } : null; // a river counts as a ridge some thirty points deep
}
/**
 * Close the borders an army cannot cross. A march goes by the straight road from town to town; where mountains, a
 * river or open water lie across it, the two lands are no longer neighbours. Passes and fords are left wherever
 * closing a border would cut the world in two, leave a land with a single way in, or close more than a quarter of all borders.
 */
/** The lands a sea lane runs to from this one. */
export const lanesOf = (c: Campaign, tid: number): number[] => (c.lanes ?? []).filter((l) => l.a === tid || l.b === tid).map((l) => (l.a === tid ? l.b : l.a));
/** Whether ships can put out from this land: it lies on the open coast, or a sea lane runs from it. */
export const onSea = (c: Campaign, tid: number): boolean => c.territories[tid].trait === 'coast' || lanesOf(c, tid).length > 0;
function raiseBarriers(c: Campaign): void {
  const ts = c.territories, found: (Barrier & { n: number })[] = [];
  for (const t of ts) for (const o of t.adj) if (o > t.id) { const x = crossing(c, t.id, o); if (x) found.push({ a: t.id, b: o, kind: x.kind, n: x.n }); }
  found.sort((p, q) => q.n - p.n || p.a - q.a || p.b - q.b); // the greatest barriers first
  // Open water is no bar for good: it is a sea lane, crossed from a harbour.
  c.lanes = [];
  for (const f of found) if (f.kind === 'water') {
    const A = ts[f.a], B = ts[f.b];
    if ((A.capital >= 0 && A.adj.length <= 1) || (B.capital >= 0 && B.adj.length <= 1)) continue; // a capital always keeps one way out on foot: a ford at low water
    A.adj = A.adj.filter((n) => n !== f.b); B.adj = B.adj.filter((n) => n !== f.a);
    c.lanes.push({ a: f.a, b: f.b });
  }
  const links = ts.reduce((n, t) => n + t.adj.length, 0) / 2;
  const ways = (id: number): number[] => [...ts[id].adj, ...lanesOf(c, id)];
  const whole = (): boolean => {
    const seen = new Set([0]), q = [0];
    while (q.length) for (const n of ways(q.pop()!)) if (!seen.has(n)) { seen.add(n); q.push(n); }
    return seen.size === ts.length;
  };
  c.barriers = [];
  for (const f of found) {
    if (f.kind === 'water') continue;
    if (c.barriers.length >= links / 4) break;
    const A = ts[f.a], B = ts[f.b];
    if (ways(f.a).length <= 2 || ways(f.b).length <= 2) continue;
    if ((A.capital >= 0 && A.adj.length <= 1) || (B.capital >= 0 && B.adj.length <= 1)) continue;
    A.adj = A.adj.filter((n) => n !== f.b); B.adj = B.adj.filter((n) => n !== f.a);
    if (whole()) c.barriers.push({ a: f.a, b: f.b, kind: f.kind });
    else { A.adj.push(f.b); B.adj.push(f.a); }
  }
}

/** A front of the kind that suits the country it starts over: snow in the cold lands, dust in the dry, rain elsewhere. */
function newFront(c: Campaign, k: number, edge: boolean): Front {
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

/** What is marked on a territory this turn: the newest thing first. */
export function eventsAt(c: Campaign, tid: number): MapEvent[] {
  return (c.events ?? []).filter((e) => e.at === tid && e.until >= c.turn).reverse();
}

function mark(c: Campaign, kind: EventKind, at: number, turns = 0): void {
  (c.events ??= []).push({ kind, at, turn: c.turn, until: c.turn + turns });
}

/**
 * The marauders: a band that belongs to no people. They take root in some land of the local tribes far from any
 * capital, and from then on they grow each turn, carry off women from the lands next to them (which costs those
 * lands supplies until the women are freed), and when strong enough overrun a neighbour. Whoever takes a land
 * from them breaks that camp: the women it took go home, and the victor is the richer for it.
 */
function hordeTurn(c: Campaign): void {
  const lairs = c.territories.filter((t) => t.horde);
  // A camp that has fallen to someone: those it held are free.
  for (const t of lairs.filter((x) => x.owner >= 0)) {
    t.horde = false;
    const f = c.factions[t.owner];
    let home = 0;
    for (const n of [t.id, ...t.adj]) { home += c.territories[n].taken ?? 0; c.territories[n].taken = 0; }
    f.supplies += HORDE_PRIZE;
    mark(c, 'freed', t.id);
    c.log.push(`${f.id === 0 ? 'You have' : `${f.name} have`} broken the marauders at ${t.name}${home ? ' and the women they took have come home' : ''}: ${HORDE_PRIZE} supplies.`);
  }
  const live = c.territories.filter((t) => t.horde && t.owner < 0);
  if (!live.length) {
    for (const t of c.territories) t.taken = 0; // no camp left to hold anyone
    if (c.turn < HORDE_TURN || luck(c, 70) > 0.45) return;
    const caps = c.territories.filter((t) => t.capital >= 0);
    const wild = c.territories.filter((t) => t.owner < 0 && t.capital < 0)
      .sort((a, b) => Math.min(...caps.map((k) => Math.hypot(k.x - b.x, k.y - b.y))) - Math.min(...caps.map((k) => Math.hypot(k.x - a.x, k.y - a.y))));
    const t = wild[0];
    if (!t) return;
    t.horde = true;
    t.militia = Math.max(t.militia, 4);
    mark(c, 'horde', t.id, 1);
    c.log.push(`Marauders have made camp at ${t.name}. They take women, and they grow.`);
    return;
  }
  live.forEach((t, i) => {
    t.militia = Math.min(HORDE_MAX, t.militia + 1);
    // A raid on a neighbour: the weakest-held land next door.
    const near = t.adj.map((n) => c.territories[n]).filter((x) => x.owner >= 0 && (x.taken ?? 0) < MAX_TAKEN)
      .sort((a, b) => (armyAt(c, a.id) ? 1 : 0) - (armyAt(c, b.id) ? 1 : 0) || a.id - b.id);
    const prey = near[Math.floor(luck(c, 80 + i) * Math.min(2, near.length))];
    if (prey && luck(c, 90 + i) < 0.6) {
      prey.taken = (prey.taken ?? 0) + 1;
      mark(c, 'taken', prey.id);
      c.log.push(`Marauders out of ${t.name} carry off women from ${prey.name}${prey.owner === 0 ? ': it yields a supply less until you break their camp' : ''}.`);
    }
    // Strong enough, they take the land next door for their own: a tribe's, or a people's that no army holds.
    if (t.militia >= HORDE_SPREAD && luck(c, 100 + i) < 0.3) {
      const open = t.adj.map((n) => c.territories[n]).filter((x) => !x.horde && x.capital < 0 && !(x.owner >= 0 && armyAt(c, x.id)));
      const next = open[Math.floor(luck(c, 110 + i) * open.length)];
      if (next) {
        if (next.owner >= 0) c.log.push(`The marauders have overrun ${next.name} and thrown out ${next.owner === 0 ? 'your people' : c.factions[next.owner].name}.`);
        else c.log.push(`The marauders have overrun ${next.name}.`);
        next.owner = -1; next.horde = true; next.militia = Math.max(3, Math.floor(t.militia / 2));
        t.militia -= 2;
        mark(c, 'overrun', next.id);
      }
    }
  });
}

/** A new turn on the map itself: the weather moves on, what was brewing comes to a head, and now and then something new begins. */
function mapTurn(c: Campaign): void {
  const fronts = frontsOf(c);
  fronts.forEach((f, i) => {
    f.x += f.vx; f.y += f.vy;
    if (f.x < -140 || f.x > MAP_W + 140 || f.y < -140 || f.y > MAP_H + 140) fronts[i] = newFront(c, i * 10 + 100, true);
  });
  const ev = (c.events ??= []);
  for (const e of ev.filter((x) => x.until === c.turn - 1)) {
    const t = c.territories[e.at];
    if (e.kind === 'unrest' && t.owner >= 0) {
      const a = armyAt(c, t.id), f = c.factions[t.owner];
      const faith = faithOf(c, t.owner);
      if (faith.steadfast) { mark(c, 'calm', t.id); c.log.push(`${t.name} keeps faith with ${f.id === 0 ? 'you' : f.name}: the unrest passes.`); }
      else if (a && a.owner === t.owner && !(faith.restless && armySize(a) < 2)) { mark(c, 'calm', t.id); c.log.push(`The garrison keeps order in ${t.name}.`); }
      else {
        c.log.push(`${t.name} has risen and thrown off ${f.id === 0 ? 'your' : `${f.name}'s`} rule.`);
        if (placeAt(c, t.id)) tell(c, `${t.name} rose and threw off ${f.id === 0 ? 'your' : `${f.name}'s`} rule, and ${placeAt(c, t.id)!.name} with it.`);
        t.owner = -1; t.militia = 2;
        mark(c, 'revolt', t.id);
      }
    } else if (e.kind === 'hoard') {
      if (t.owner >= 0) {
        const f = c.factions[t.owner];
        f.supplies += HOARD_PRIZE;
        mark(c, 'found', t.id);
        c.log.push(`The hoard at ${t.name} is dug up: ${HOARD_PRIZE} supplies for ${f.id === 0 ? 'you' : f.name}.`);
      } else c.log.push(`The hoard at ${t.name} is carried off by the local tribes.`);
    }
  }
  c.events = ev.filter((x) => x.until >= c.turn - 1);
  const busy = new Set(c.events.filter((x) => x.until >= c.turn).map((x) => x.at));
  hordeTurn(c);
  if (c.turn >= 3 && luck(c, 50) < 0.3) {
    const open = c.territories.filter((t) => t.owner >= 0 && t.capital < 0 && !busy.has(t.id) && !c.armies.some((a) => a.at === t.id && a.owner === t.owner));
    const t = open[Math.floor(luck(c, 51) * open.length)];
    if (t) {
      mark(c, 'unrest', t.id, UNREST_TURNS - 1);
      busy.add(t.id);
      c.log.push(`There is unrest in ${t.name}. ${t.owner === 0 ? 'Send an army there within ' + UNREST_TURNS + ' turns or it will rise.' : ''}`.trim());
    }
  }
  if (c.turn >= 2 && luck(c, 60) < 0.22 && !c.events.some((x) => x.kind === 'hoard' && x.until >= c.turn)) {
    const open = c.territories.filter((t) => !busy.has(t.id) && t.capital < 0);
    const t = open[Math.floor(luck(c, 61) * open.length)];
    if (t) {
      mark(c, 'hoard', t.id, HOARD_TURNS - 1);
      c.log.push(`Word of a hoard buried at ${t.name}: whoever holds it in ${HOARD_TURNS} turns gains ${HOARD_PRIZE} supplies.`);
    }
  }
}

const NAMES = [
  'Ashford Vale', 'Stonereach', 'Greenmere', 'Highmoor', 'Riverbend', 'Wolfwood', 'Sunfields', 'Ironcrag',
  'Mistfen', 'Eastmarch', 'Goldwater', 'Thornhold', 'Westshore', 'Redcliff', 'Oakhollow', 'Harrowdale',
  'Saltmarsh', 'Kingsbarrow', 'Emberfell', 'Windscar', 'Lowmere', 'Frosthollow', 'Amberfield', 'Ravenmoor',
  'Greywater', 'Brackenridge', 'Hollowmere', 'Stagsford', 'Blackfen', 'Whitepeak', 'Dunmarrow', 'Larkfield',
  'Cinderholt', 'Marrowdeep', 'Silverrun', 'Heronwick', 'Drystone', 'Fallowmead', 'Gullhaven', 'Thistledown',
];
export const LOCALS = { name: 'Local Tribe', color: 0x9a8a6a };

/** A rival leader speaks: queue one of their lines for the map screen to show (and, one day, play). */
function say(c: Campaign, f: number, event: LeaderEvent): void {
  const fac = c.factions[f];
  if (!fac || !fac.isAI || !LEADERS[fac.civ]) return;
  c.speech.push({ civ: fac.civ, event, index: Math.floor(rand(c) * LEADERS[fac.civ].lines[event].length) });
}

/** The player's own leader has something to say. */
function advise(c: Campaign, event: LeaderEvent): void {
  const civ = c.factions[0]?.civ;
  if (civ && LEADERS[civ]) c.speech.push({ civ, event, index: Math.floor(rand(c) * LEADERS[civ].lines[event].length) });
}

function rand(c: { rngState: number }): number {
  let t = (c.rngState = (c.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Territory containing a map point. Borders are bent a little so they do not look ruled. */
export function territoryAt(ts: { x: number; y: number }[], px: number, py: number): number {
  const x = px + 16 * Math.sin(py / 37), y = py + 16 * Math.sin(px / 43);
  let best = 0, bd = Infinity;
  for (let i = 0; i < ts.length; i++) {
    const d = (ts[i].x - x) ** 2 + (ts[i].y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/**
 * A fresh campaign on a newly generated map. The size and shape of the map, where each capital
 * lies and which peoples are in play all vary with the seed. Every faction is a different people;
 * `playerCiv` fixes the player's, otherwise that is random too.
 */
export function newCampaign(seed: number, rivals = 1, level = 1, playerCiv?: string): Campaign {
  const c: Campaign = {
    v: CAMPAIGN_VERSION, seed, rngState: seed >>> 0, level, turn: 1, phase: 'player', cursor: 0, spent: false,
    factions: [], territories: [], armies: [], pending: null, nextArmy: 1, winner: -1, log: [], speech: [], truces: [], honor: 0, demand: null, ally: -1, dominion: { f: -1, turns: 0 },
  };
  const pick = <T>(list: T[]): T => list.splice(Math.floor(rand(c) * list.length), 1)[0];
  // The world is a wide sea, and land rises only where there are towns: of forty places a town might stand, between
  // fifteen and thirty are taken, chosen after the fashion of this world, so that its lands lie as continents, a ring, two shores or islands.
  const cols = 8, rows = 5, want = 15 + Math.floor(rand(c) * 16), W = worldOf(seed), sd = seed % 100000;
  const spots: { x: number; y: number; score: number }[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = ((i + 0.5) * MAP_W) / cols + (rand(c) - 0.5) * (MAP_W / cols) * 0.55, y = ((j + 0.5) * MAP_H) / rows + (rand(c) - 0.5) * (MAP_H / rows) * 0.5;
      const cx = (x - MAP_W / 2) / (MAP_W / 2), cy = (y - MAP_H / 2) / (MAP_H / 2), far = Math.hypot(cx, cy);
      let score = landNoise(x / 330, y / 330, sd + 31) + rand(c) * 0.12;
      if (W.shape === 'continent') score = score * 0.5 - Math.hypot(cx - (landNoise(1, 2, sd + 32) - 0.5), cy - (landNoise(3, 4, sd + 32) - 0.5)) * 0.9;
      else if (W.shape === 'twin') score = score * 0.4 + Math.min(0.5, Math.abs(cx * Math.cos(W.turn) + cy * Math.sin(W.turn) * 0.7)) * 1.6;
      else if (W.shape === 'innersea') score = score * 0.3 + Math.min(far, 0.8) * 1.4 - Math.max(0, far - 0.95) * 2;
      else if (W.shape === 'archipelago') score = landNoise(x / 120, y / 120, sd + 31) + rand(c) * 0.3;
      spots.push({ x, y, score });
    }
  const taken = spots.slice().sort((a, b) => b.score - a.score).slice(0, want).sort((a, b) => a.y * 0.02 + a.x * 0.0001 - (b.y * 0.02 + b.x * 0.0001));
  const names = NAMES.slice();
  for (const sp of taken) {
    c.territories.push({
      id: c.territories.length, name: pick(names), owner: -1, capital: -1, adj: [], x: sp.x, y: sp.y,
      buildings: rand(c) < 0.35 ? ['farm'] : [], trait: rand(c) < 0.45 ? Object.keys(TRAITS)[Math.floor(rand(c) * 4)] : '', militia: 2 + Math.floor(rand(c) * 3), seed: 1 + Math.floor(rand(c) * 1e6),
    });
  }
  // Neighbours are whichever territories share a border and lie near enough to march or make a short crossing.
  const step = 5, near = (MAP_W / cols) * 1.8;
  const link = (a: number, b: number) => {
    const A = c.territories[a], B = c.territories[b];
    if (a !== b && !A.adj.includes(b) && Math.hypot(A.x - B.x, A.y - B.y) < near) { A.adj.push(b); B.adj.push(a); }
  };
  for (let y = 0; y < MAP_H; y += step)
    for (let x = 0; x < MAP_W; x += step) {
      const t = territoryAt(c.territories, x, y);
      if (x + step < MAP_W) link(t, territoryAt(c.territories, x + step, y));
      if (y + step < MAP_H) link(t, territoryAt(c.territories, x, y + step));
    }
  // No land is cut off for good: where the sea parts two shores, the shortest crossing between them is a sea lane.
  for (;;) {
    const group = c.territories.map(() => -1);
    let groups = 0;
    for (const t of c.territories) if (group[t.id] < 0) { const q = [t.id]; group[t.id] = groups; while (q.length) for (const n of c.territories[q.pop()!].adj) if (group[n] < 0) { group[n] = groups; q.push(n); } groups++; }
    if (groups < 2) break;
    let ba = -1, bb = -1, bd = Infinity;
    for (const a of c.territories) for (const b of c.territories) if (group[a.id] === 0 && group[b.id] !== 0) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < bd) { bd = d; ba = a.id; bb = b.id; } }
    c.territories[ba].adj.push(bb); c.territories[bb].adj.push(ba);
  }
  // And none hangs by a single thread: a land with one neighbour gets a lane to the next nearest shore.
  for (const t of c.territories) if (t.adj.length < 2) {
    const o = c.territories.filter((u) => u !== t && !t.adj.includes(u.id)).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
    t.adj.push(o.id); o.adj.push(t.id);
  }

  // Peoples: the player's choice (or luck), then a different one for every rival.
  const pool = CIV_IDS.slice();
  const mine = playerCiv && CIVS[playerCiv] ? pool.splice(pool.indexOf(playerCiv), 1)[0] : pick(pool);
  const civs = [mine];
  const count = Math.min(3, Math.max(1, rivals));
  for (let f = 1; f <= count; f++) civs.push(pick(pool));

  // Capitals: the first anywhere on the rim of the map, each further one as far from the others as it can be.
  const steps = (from: number): number[] => {
    const d = c.territories.map(() => Infinity);
    d[from] = 0;
    const q = [from];
    while (q.length) { const cur = q.shift()!; for (const n of c.territories[cur].adj) if (d[n] === Infinity) { d[n] = d[cur] + 1; q.push(n); } }
    return d;
  };
  const mx = c.territories.reduce((n, t) => n + t.x, 0) / c.territories.length, my = c.territories.reduce((n, t) => n + t.y, 0) / c.territories.length;
  const rim = c.territories.slice().sort((a, b) => Math.hypot(b.x - mx, b.y - my) - Math.hypot(a.x - mx, a.y - my)).slice(0, Math.ceil(c.territories.length / 2));
  const homes = [rim[Math.floor(rand(c) * rim.length)].id];
  while (homes.length <= count) {
    const dist = homes.map(steps);
    let best = -1, bestD = -1;
    for (const t of c.territories) {
      if (homes.includes(t.id)) continue;
      const d = Math.min(...dist.map((row) => row[t.id])) + rand(c) * 0.5; // the fraction breaks ties differently each time
      if (d > bestD) { bestD = d; best = t.id; }
    }
    homes.push(best);
  }
  civs.forEach((civ, f) => {
    c.factions.push({ id: f, name: f === 0 ? 'You' : CIVS[civ].name, civ, color: CIV_COLOR[civ], isAI: f > 0, supplies: 8, alive: true, heroAlive: true, lastDemand: 0, angry: false });
    const t = c.territories[homes[f]];
    t.owner = f;
    t.capital = f;
    t.buildings = ['barracks', 'farm'];
    t.trait = '';
    c.armies.push({ id: c.nextArmy++, owner: f, at: t.id, units: { infantry: 3 }, hero: true, vet: 0, moved: false });
  });
  // Some plain land on the rim of the map lies on the sea.
  for (const t of c.territories) {
    const rim = t.x < MAP_W * 0.14 || t.x > MAP_W * 0.86 || t.y < MAP_H * 0.16 || t.y > MAP_H * 0.84;
    if (rim && !t.trait && t.capital < 0 && t.seed % 2 === 0) t.trait = 'coast';
  }
  raiseBarriers(c);
  c.log.push(`Turn 1. You lead the ${CIVS[mine].name}. ${c.factions.slice(1).map((f) => f.name).join(', ')} ${count > 1 ? 'share' : 'shares'} this land with you.`);
  tell(c, `The ${[CIVS[mine].name, ...c.factions.slice(1).map((f) => `the ${f.name}`)].join(', ').replace(/, ([^,]*)$/, ' and $1')} came into a country of ${c.territories.length} lands, and each meant to have all of it.`);
  placesOf(c);
  advise(c, 'p_start');
  for (let f = 1; f <= count; f++) say(c, f, 'intro');
  return c;
}

// ---- Queries ----

/** Where an army in this territory can go in one march: next door, or from a harbour along its sea lanes and to any other open coast. */
export function reach(c: Campaign, tid: number): number[] {
  const t = c.territories[tid];
  if (!t.buildings.includes('harbour')) return t.adj;
  const lanes = lanesOf(c, tid);
  return [...t.adj, ...lanes, ...(t.trait === 'coast' ? c.territories.filter((x) => x.trait === 'coast' && x.id !== tid && !t.adj.includes(x.id) && !lanes.includes(x.id)).map((x) => x.id) : [])];
}
export const SEA_LANDING = 0.8;
/** What the next age costs this people. */
export const ageCost = (c: Campaign, f: number): number => Math.max(1, (AGE_COST[ageOf(c, f)] ?? Infinity) + faithOf(c, f).age - placeGood(c, f, 'age') - (c.factions[f].civ === 'babylon' ? 3 : 0));
export const truceCost = (civ: string): number => (civ === 'arabs' ? 1 : TRUCE_COST);
export const giftCost = (civ: string): number => (civ === 'arabs' ? 3 : GIFT_COST);
export const ageOf = (c: Campaign, f: number): number => (f < 0 ? 0 : c.factions[f].age ?? 0);
const ageEdge = (c: Campaign, f: number): number => 1 + AGE_EDGE * ageOf(c, f);
export const canAdvance = (c: Campaign, f: number): boolean => ageOf(c, f) < AGE_COST.length && c.factions[f].alive && c.factions[f].supplies >= ageCost(c, f);
/** Bring a people into the next age: stronger armies everywhere, and battles begin in that age with its weapons. */
export function advanceAge(c: Campaign, f: number): boolean {
  if (!canAdvance(c, f)) return false;
  const fac = c.factions[f];
  fac.supplies -= ageCost(c, f);
  fac.age = ageOf(c, f) + 1;
  c.log.push(`${f === 0 ? 'Your people have' : `${fac.name} have`} entered the ${AGES[fac.age].name}.`);
  if (f === 0) advise(c, 'p_ageup');
  else say(c, f, 'ageup');
  return true;
}
/** A leader who comes through a battle won is the more seasoned for it. */
const seasonHero = (c: Campaign, f: number): void => { c.factions[f].heroRank = Math.min(MAX_RANK, (c.factions[f].heroRank ?? 0) + 1); };
/** A faction's leader as they take the field: their making, and the veterancy the campaign has given them. */
export const heroFor = (c: Campaign, f: number): HeroSpec => ({ ...cleanHero(c.factions[f].hero, c.factions[f].civ), rank: c.factions[f].heroRank ?? 0 });
export const armyAt = (c: Campaign, tid: number): Army | undefined => c.armies.find((a) => a.at === tid);
/** Number of companies in an army. */
export const armySize = (a: Army): number => Object.values(a.units).reduce((n, v) => n + v, 0);
/** An army's strength against a given mix of enemy companies (none: its plain strength). */
export function strengthVs(a: Army, foe: Record<string, number> = {}): number {
  const total = Object.values(foe).reduce((n, v) => n + v, 0);
  let s = (a.hero ? HERO_STRENGTH : 0) + a.vet;
  for (const [type, n] of Object.entries(a.units)) {
    const edge = total ? (0.3 * (foe[BEATS[type]] ?? 0)) / total : 0;
    s += n * COMPANIES[type].str * (1 + edge);
  }
  return Math.round(s * 10) / 10;
}
export const armyStrength = (a: Army): number => strengthVs(a);

export function income(c: Campaign, f: number): number {
  let n = 0;
  let held = 0;
  const world = worldNow(c);
  for (const t of c.territories) if (t.owner === f) { n += Math.max(0, territoryIncome(t, c.factions[f].civ) + (t.buildings.includes('tavern') ? faithOf(c, f).tavern : 0) + (world === 'plenty' && t.buildings.includes('farm') ? 1 : 0) - (world === 'winter' ? 1 : 0) - (weatherAt(c, t.id) === 'snow' ? 1 : 0) - (t.taken ?? 0)); held++; }
  return n + placeGood(c, f, 'supplies') + (c.factions[f].civ === 'persia' ? Math.floor(held / 3) : 0);
}
export function territoryIncome(t: Territory, civ = ''): number {
  const hearth = civ === 'hearth' ? 1 : 0;
  return 2 + (t.buildings.includes('farm') ? (t.trait === 'fertile' ? 4 : 2) + hearth : 0) + (t.capital >= 0 ? 2 + hearth : 0) + (t.trait === 'gold' ? 3 : t.trait === 'coast' ? 1 : 0);
}

/** The companies an attacker would face in a territory. Locals and town guards fight as infantry. */
export function defenders(c: Campaign, tid: number): Record<string, number> {
  const t = c.territories[tid];
  const a = armyAt(c, tid);
  if (t.owner >= 0 && a && a.owner === t.owner) return a.units;
  return { infantry: t.owner < 0 ? t.militia : 1 };
}

/** Everything that defends a territory, optionally against a particular mix of attackers. */
export function defence(c: Campaign, tid: number, vs: Record<string, number> = {}, attackerCiv = ''): number {
  const t = c.territories[tid];
  const ground = (t.trait === 'hills' ? 2 : 0) + (PLACES[placeAt(c, tid)?.kind as PlaceKind]?.defence ?? 0);
  if (t.owner < 0) return Math.max(1, t.militia - (attackerCiv === 'wild' ? 1 : 0)) + ground;
  const a = armyAt(c, tid);
  const fort = t.buildings.includes('fortress') ? (c.factions[t.owner].civ === 'stonekin' ? 4 : 3) : 0;
  return Math.round(((a && a.owner === t.owner ? strengthVs(a, vs) : 0) + 1 + fort + ground) * faithOf(c, t.owner).defence * 10) / 10;
}

/** True while the player and a rival are bound by a truce. */
export function atTruce(c: Campaign, a: number, b: number): boolean {
  const other = a === 0 ? b : b === 0 ? a : -1;
  return other > 0 && (other === c.ally || c.truces.some((t) => t.with === other && t.until >= c.turn));
}
/** The faction fighting at this one's side, or -1: the player and their ally stand together. */
export const allyOf = (c: Campaign, f: number): number => (c.ally < 0 ? -1 : f === 0 ? c.ally : f === c.ally ? 0 : -1);
/** How many territories a faction must hold to rule by dominion. */
export const dominionNeed = (c: Campaign): number => Math.ceil(c.territories.length * DOMINION_SHARE);
export const landOf = (c: Campaign, f: number): number => c.territories.filter((t) => t.owner === f).length;
export const totalStrength = (c: Campaign, f: number): number => c.armies.filter((a) => a.owner === f).reduce((n, a) => n + armyStrength(a), 0);

/** Chance (0..1) that the attacker wins an auto-resolved battle at these strengths. */
export function winChance(aStr: number, dStr: number, home = 1.1): number {
  let wins = 0;
  const n = 24;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) if (aStr * (0.75 + (0.5 * i) / (n - 1)) > dStr * home * (0.75 + (0.5 * j) / (n - 1))) wins++;
  return wins / (n * n);
}

export function canBuild(c: Campaign, f: number, tid: number, site: string): boolean {
  const t = c.territories[tid];
  return t.owner === f && !!SITES[site] && (site !== 'harbour' || onSea(c, tid)) && !t.buildings.includes(site) && t.buildings.length < slots(t) && c.factions[f].supplies >= siteCost(t, site, c.factions[f].civ);
}
export function canRaise(c: Campaign, f: number, tid: number, type: string): boolean {
  const t = c.territories[tid], def = COMPANIES[type];
  const a = armyAt(c, tid);
  return t.owner === f && !!def && t.buildings.includes(def.needs) && c.factions[f].supplies >= companyCost(t, type, c.factions[f].civ, hireOff(c, f, tid)) && (!a || (a.owner === f && armySize(a) < MAX_ARMY));
}
export function canSummonHero(c: Campaign, f: number, tid: number): boolean {
  const a = armyAt(c, tid);
  return c.territories[tid].capital === f && !!a && a.owner === f && !c.factions[f].heroAlive && c.factions[f].supplies >= heroCost(c.factions[f].civ);
}

// ---- Actions ----

export function build(c: Campaign, f: number, tid: number, site: string): boolean {
  if (!canBuild(c, f, tid, site)) return false;
  c.factions[f].supplies -= siteCost(c.territories[tid], site, c.factions[f].civ);
  c.territories[tid].buildings.push(site);
  return true;
}

/** Raise one company. It joins the army standing in the territory, or forms a new one. */
export function raise(c: Campaign, f: number, tid: number, type: string): boolean {
  if (!canRaise(c, f, tid, type)) return false;
  c.factions[f].supplies -= companyCost(c.territories[tid], type, c.factions[f].civ, hireOff(c, f, tid));
  let a = armyAt(c, tid);
  if (!a) {
    a = { id: c.nextArmy++, owner: f, at: tid, units: {}, hero: false, vet: c.factions[f].civ === 'japan' ? 1 : 0, moved: true }; // fresh troops march next turn
    c.armies.push(a);
  }
  a.units[type] = (a.units[type] ?? 0) + 1;
  return true;
}

export function summonHero(c: Campaign, f: number, tid: number): boolean {
  if (!canSummonHero(c, f, tid)) return false;
  c.factions[f].supplies -= heroCost(c.factions[f].civ);
  c.factions[f].heroAlive = true;
  armyAt(c, tid)!.hero = true;
  return true;
}

/** Remove `n` companies from an army, taking from its most numerous type first. It keeps at least one. */
function casualties(a: Army, n: number): void {
  for (let i = 0; i < n && armySize(a) > 1; i++) {
    const type = Object.keys(a.units).sort((x, y) => a.units[y] - a.units[x])[0];
    if (--a.units[type] <= 0) delete a.units[type];
  }
}

function destroyArmy(c: Campaign, a: Army): void {
  if (a.hero) { c.factions[a.owner].heroAlive = false; c.factions[a.owner].heroRank = Math.max(0, (c.factions[a.owner].heroRank ?? 0) - 1); }
  c.armies.splice(c.armies.indexOf(a), 1);
}

/** A faction's name as it reads in a sentence: `start` for the beginning, otherwise mid-sentence. */
const fname = (c: Campaign, f: number, start = false) =>
  f < 0 ? (start ? 'The locals' : 'the locals') : f === 0 && !start ? 'you' : c.factions[f].name;

/**
 * March an army into a neighbouring territory. Entering your own land just moves (or merges).
 * Entering anyone else's starts a battle: it is returned as `c.pending` for the caller to fight
 * or to settle with `resolvePending`. Battles with no human involved are settled at once.
 */
export function moveArmy(c: Campaign, armyId: number, to: number): 'moved' | 'battle' | 'invalid' {
  const a = c.armies.find((x) => x.id === armyId);
  if (!a || a.moved || c.pending || c.demand || !reach(c, a.at).includes(to)) return 'invalid';
  const sea = !c.territories[a.at].adj.includes(to);
  const t = c.territories[to];
  const civ = c.factions[a.owner].civ;
  if (t.owner === a.owner) {
    const other = armyAt(c, to);
    // The Mongols cover ground: one march through friendly land does not end an army's turn.
    if (civ === 'steppe' && !a.marched) a.marched = true;
    else a.moved = true;
    if (other) {
      // Two friendly armies become one; companies over the limit stay behind.
      for (const type of Object.keys(a.units)) {
        while (a.units[type] > 0 && armySize(other) < MAX_ARMY) { a.units[type]--; other.units[type] = (other.units[type] ?? 0) + 1; }
        if (!a.units[type]) delete a.units[type];
      }
      if (a.hero) { other.hero = true; a.hero = false; }
      other.vet = Math.max(other.vet, a.vet);
      other.moved = other.moved || a.moved;
      if (!armySize(a)) c.armies.splice(c.armies.indexOf(a), 1);
    } else a.at = to;
    return 'moved';
  }
  // Armies in neighbouring land lend some of their weight to the fight.
  if (atTruce(c, a.owner, t.owner)) {
    if (a.owner !== 0) return 'invalid'; // rivals keep their word
    // The player marches on a truce partner: the truce is over and nobody forgets it.
    const sworn = c.ally === t.owner;
    c.truces = c.truces.filter((x) => x.with !== t.owner);
    if (sworn) c.ally = -1;
    c.honor -= sworn ? 2 : 1;
    say(c, t.owner, 'betray');
    c.log.push(`You have broken your ${sworn ? 'alliance' : 'truce'} with ${c.factions[t.owner].name}.`);
    tell(c, `You broke your ${sworn ? 'alliance' : 'truce'} with ${c.factions[t.owner].name}. It was remembered.`);
  }
  const lend = (f: number, skip: number) => (f < 0 ? 0 : reserves(c, f, to, skip).reduce((n, r) => n + armyStrength(r) * 0.3, 0));
  const support = (f: number, skip: number) => lend(f, skip) + lend(f < 0 ? -1 : allyOf(c, f), skip);
  const round = (v: number) => Math.round(v * 10) / 10;
  c.pending = {
    armyId, from: a.at, to, attacker: a.owner, defender: t.owner,
    aStr: round((strengthVs(a, defenders(c, to)) + support(a.owner, a.id)) * (sea ? SEA_LANDING : 1) * ageEdge(c, a.owner) * (weatherAt(c, to) ? WEATHER[weatherAt(c, to) as Sky].march : 1)), ...(sea ? { sea: true } : {}), dStr: round((defence(c, to, a.units, civ) + support(t.owner, -1)) * ageEdge(c, t.owner)),
  };
  const human = (f: number) => f >= 0 && !c.factions[f].isAI;
  if (!human(a.owner) && !human(t.owner)) resolvePending(c, 'auto');
  else if (human(t.owner)) say(c, a.owner, 'attack');
  else if (c.speech[c.speech.length - 1]?.event !== 'betray') say(c, t.owner, 'defend');
  return 'battle';
}

/** A faction's armies next door to a territory, strongest first: they can support a battle there. */
export function reserves(c: Campaign, f: number, tid: number, skipArmy = -1): Army[] {
  return c.armies.filter((a) => a.owner === f && a.id !== skipArmy && a.at !== tid && c.territories[tid].adj.includes(a.at))
    .sort((x, y) => armyStrength(y) - armyStrength(x));
}

/** How much fighting on home ground is worth to a defender against this attacker. */
export const homeEdge = (c: Campaign, attacker: number): number => (c.factions[attacker]?.civ === 'dawn' ? 1 : 1.1);

/**
 * Offer a rival a truce. Whether they accept depends on their leader's temper, who is stronger
 * and whether the player has kept faith before. The supplies are only spent if they agree.
 */
export function offerTruce(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac || !fac.isAI || !fac.alive || atTruce(c, 0, f) || c.factions[0].supplies < truceCost(c.factions[0].civ) || c.phase !== 'player' || fac.refused === c.turn) return false;
  const mine = totalStrength(c, 0), theirs = totalStrength(c, f);
  const willing = habitsWith(fac.civ, PERSONA[fac.civ]).peace + (mine >= theirs ? 0.25 : -0.15) + 0.1 * (fac.favor ?? 0);
  if (c.honor < 0 || rand(c) > willing) {
    fac.refused = c.turn;
    say(c, f, 'refuse');
    c.log.push(`${fac.name} will not hear of a truce.`);
    return false;
  }
  c.factions[0].supplies -= truceCost(c.factions[0].civ);
  c.truces.push({ with: f, until: c.turn + TRUCE_TURNS });
  say(c, f, 'truce');
  c.log.push(`A truce with ${fac.name} until turn ${c.turn + TRUCE_TURNS}.`);
  return true;
}

/**
 * Offer an alliance to a rival the player is at truce with. An ally never attacks the player,
 * and each lends its neighbouring armies to the other's battles. Only one alliance at a time,
 * and none when just two peoples are left: one of them must rule.
 */
export function canAlly(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  return !!fac && fac.isAI && fac.alive && fac.refused !== c.turn && c.ally < 0 && c.phase === 'player' && c.honor >= 0 && c.truces.some((t) => t.with === f && t.until >= c.turn)
    && c.factions.filter((x) => x.alive).length >= 3 && c.factions[0].supplies >= ALLIANCE_COST;
}
export function offerAlliance(c: Campaign, f: number): boolean {
  if (!canAlly(c, f)) return false;
  const fac = c.factions[f];
  // A leader is readier to stand with you against someone stronger than both of you.
  const threat = c.factions.some((x) => x.alive && x.id !== 0 && x.id !== f && totalStrength(c, x.id) > totalStrength(c, f));
  if (rand(c) > habitsWith(fac.civ, PERSONA[fac.civ]).peace + (threat ? 0.35 : 0.05) + 0.1 * (fac.favor ?? 0)) {
    fac.refused = c.turn;
    say(c, f, 'refuse');
    c.log.push(`${fac.name} will not bind themselves to you.`);
    return false;
  }
  c.factions[0].supplies -= ALLIANCE_COST;
  c.ally = f;
  say(c, f, 'ally');
  c.log.push(`${fac.name} are now your allies.`);
  return true;
}

/** Send a rival supplies. It earns goodwill, and an ally can spend them on troops. */
export function canGift(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  return !!fac && fac.isAI && fac.alive && c.phase === 'player' && c.honor >= 0 && c.factions[0].supplies >= giftCost(c.factions[0].civ) && (c.ally === f || (fac.favor ?? 0) < MAX_FAVOR);
}
export function sendGift(c: Campaign, f: number): boolean {
  if (!canGift(c, f)) return false;
  const fac = c.factions[f];
  c.factions[0].supplies -= giftCost(c.factions[0].civ);
  fac.supplies += GIFT_COST;
  fac.favor = Math.min(MAX_FAVOR, (fac.favor ?? 0) + 1);
  c.log.push(`You sent ${fac.name} supplies.`);
  return true;
}

/** Answer a rival's demand for tribute: pay and be left alone for a while, or refuse and face them. */
export function answerDemand(c: Campaign, pay: boolean): void {
  const d = c.demand;
  if (!d) return;
  const fac = c.factions[d.from];
  c.demand = null;
  if (pay && c.factions[0].supplies >= d.amount) {
    c.factions[0].supplies -= d.amount;
    fac.supplies += d.amount;
    c.truces.push({ with: d.from, until: c.turn + 4 });
    c.log.push(`You paid ${fac.name} ${d.amount} supplies. They will leave you be until turn ${c.turn + 4}.`);
  } else {
    fac.angry = true;
    c.log.push(`You refused ${fac.name}'s demand.`);
  }
}

/** Settle the pending battle by dice, or record the result of one that was fought out. */
export function resolvePending(c: Campaign, how: 'auto' | 'attacker' | 'defender'): boolean {
  const p = c.pending;
  if (!p) return false;
  let attackerWon = how === 'attacker';
  if (how === 'auto') {
    // Defenders fight on their own ground, which is worth a little.
    const a = p.aStr * (0.75 + rand(c) * 0.5), d = p.dStr * homeEdge(c, p.attacker) * (0.75 + rand(c) * 0.5);
    attackerWon = a > d;
  }
  c.pending = null;
  // The rival leader has something to say about a battle against the player.
  if (p.attacker === 0 || p.defender === 0) {
    const won = attackerWon === (p.attacker === 0);
    say(c, p.attacker === 0 ? p.defender : p.attacker, won ? 'lose' : 'win');
    advise(c, won ? 'p_win' : 'p_loss');
  }
  const t = c.territories[p.to];
  const army = c.armies.find((x) => x.id === p.armyId);
  const defArmy = armyAt(c, p.to);
  if (attackerWon) {
    if (defArmy) destroyArmy(c, defArmy);
    if (army) {
      casualties(army, Math.ceil(p.dStr * 0.4));
      army.vet = Math.min(MAX_VETERAN, army.vet + 1);
      if (army.hero) seasonHero(c, army.owner);
      army.at = p.to;
      army.moved = true;
    }
    c.log.push(`${fname(c, p.attacker, true)} took ${t.name} from ${fname(c, p.defender)}.`);
    const place = placeAt(c, t.id);
    if (place) tell(c, `${fname(c, p.attacker, true)} took ${place.name} in ${t.name} from ${fname(c, p.defender)}.`);
    if (t.capital >= 0 && t.capital !== p.attacker) tell(c, `${t.name}, chief town of ${fname(c, t.capital)}, fell to ${fname(c, p.attacker)}.`);
    if (p.defender < 0 && c.factions[p.attacker].civ === 'wild') c.factions[p.attacker].supplies += 2; // plunder
    if (t.capital >= 0 && t.capital !== p.attacker) {
      // Sacking a capital carries off its stores.
      const loot = Math.floor(c.factions[t.capital].supplies / 2);
      c.factions[t.capital].supplies -= loot;
      c.factions[p.attacker].supplies += loot;
      t.capital = -1;
    }
    t.owner = p.attacker;
    if (c.ally >= 0 && c.factions[c.ally].alive) {
      const ally = c.factions[c.ally];
      if (p.defender === c.ally && p.attacker > 0 && !c.request) {
        c.request = { foe: p.attacker, until: c.turn + 4 };
        c.log.push(`${ally.name} ask you to strike at ${c.factions[p.attacker].name} before turn ${c.turn + 4}.`);
      } else if (p.attacker === 0 && c.request && p.defender === c.request.foe) {
        const thanks = Math.min(4, ally.supplies);
        ally.supplies -= thanks;
        c.factions[0].supplies += thanks;
        ally.favor = Math.min(MAX_FAVOR, (ally.favor ?? 0) + 1);
        c.request = null;
        c.log.push(`${ally.name} thank you for answering their call${thanks ? ` and send ${thanks} supplies` : ''}.`);
      }
    }
    t.buildings = t.buildings.filter((b) => b !== 'fortress'); // the walls do not survive the assault
  } else {
    if (army) destroyArmy(c, army);
    if (defArmy) { casualties(defArmy, Math.ceil(p.aStr * 0.3)); defArmy.vet = Math.min(MAX_VETERAN, defArmy.vet + 1); if (defArmy.hero) seasonHero(c, defArmy.owner); }
    else if (t.owner < 0) t.militia = Math.max(1, t.militia - Math.floor(p.aStr * 0.3));
    c.log.push(`${fname(c, p.attacker, true)} attacked ${t.name} and ${p.attacker === 0 ? 'were' : 'was'} thrown back.`);
  }
  checkElimination(c);
  return attackerWon;
}

function checkElimination(c: Campaign): void {
  for (const f of c.factions) {
    if (f.alive && !c.territories.some((t) => t.owner === f.id)) {
      f.alive = false;
      say(c, f.id, 'eliminated');
      c.armies = c.armies.filter((a) => a.owner !== f.id);
      c.log.push(`${f.name} ${f.isAI ? 'has' : 'have'} been wiped from the map.`);
      tell(c, f.id === 0 ? 'Your people were driven from their last land.' : `The ${f.name} were driven from their last land and are heard of no more.`);
    }
  }
  const alive = c.factions.filter((f) => f.alive);
  if (!c.factions[0].alive) { c.phase = 'over'; c.winner = alive[0]?.id ?? -1; }
  else if (alive.length === 1) { c.phase = 'over'; c.winner = 0; }
  else if (c.ally >= 0 && (!c.factions[c.ally].alive || alive.length === 2)) {
    // With every other people gone, allies become the last two rivals.
    const was = c.factions[c.ally];
    c.ally = -1;
    if (was.alive) {
      c.truces = c.truces.filter((t) => t.with !== was.id).concat({ with: was.id, until: c.turn + 2 });
      say(c, was.id, 'rivalry');
      c.log.push(`Only you and ${was.name} remain. The alliance is over; they will hold their hand until turn ${c.turn + 2}.`);
    }
  }
}

/** Count the turns one people has held most of the land; long enough and nobody can challenge them. */
function checkDominion(c: Campaign): void {
  const need = dominionNeed(c);
  const lead = c.factions.find((f) => f.alive && landOf(c, f.id) >= need);
  if (!lead) { c.dominion = { f: -1, turns: 0 }; return; }
  c.dominion = { f: lead.id, turns: c.dominion.f === lead.id ? c.dominion.turns + 1 : 1 };
  const left = DOMINION_TURNS - c.dominion.turns;
  if (left <= 0) {
    c.phase = 'over';
    c.winner = lead.id;
    tell(c, lead.id === 0 ? 'No one was left who could challenge your rule.' : `No one was left who could challenge the ${lead.name}.`);
    c.log.push(lead.id === 0 ? 'Your rule is beyond challenge.' : `${lead.name} rule beyond challenge.`);
  } else {
    c.log.push(`${lead.id === 0 ? 'You hold' : `${lead.name} hold`} most of the land. ${left} more turn${left > 1 ? 's' : ''} and ${lead.id === 0 ? 'your' : 'their'} rule is beyond challenge.`);
  }
}

// ---- Turn structure ----

/** Finish the player's turn and play the rivals' turns. Stops early if one of them attacks the player. */
export function endTurn(c: Campaign): void {
  if (c.phase !== 'player' || c.pending) return;
  if (c.tale) { c.tale = null; c.log.push('The matter before you was left to settle itself.'); }
  c.phase = 'ai';
  c.cursor = 1;
  c.spent = false;
  continueAI(c);
}

/** Carry on with the rivals' turns, e.g. after the player has defended against an attack. */
export function continueAI(c: Campaign): void {
  while (c.phase === 'ai' && !c.pending && !c.demand) {
    const f = c.factions[c.cursor];
    if (!f) {
      // Everyone has moved: a new turn begins.
      c.turn++;
      c.phase = 'player';
      for (const a of c.armies) { a.moved = false; a.marched = false; }
      for (const x of c.factions) x.angry = false;
      for (const tr of c.truces) if (tr.until < c.turn && c.factions[tr.with].alive) c.log.push(`Your truce with ${c.factions[tr.with].name} has run out.`);
      c.truces = c.truces.filter((tr) => tr.until >= c.turn);
      for (const x of c.factions) if (x.alive) shiftVirtue(c, x.id, virtueDrift(c, x.id));
      for (const x of c.factions) if (x.alive) x.supplies += Math.round(income(c, x.id) * (x.isAI ? [0.8, 1, 1.25][c.level] : 1));
      c.log.push(`Turn ${c.turn}.`);
      if (c.request && (c.request.until < c.turn || c.ally < 0 || !c.factions[c.request.foe].alive)) c.request = null;
      if (c.ally >= 0 && c.factions[c.ally].supplies >= 12 && c.factions[0].supplies < 6) {
        // An ally with full stores does not watch a friend go hungry.
        c.factions[c.ally].supplies -= 3;
        c.factions[0].supplies += 3;
        c.log.push(`${c.factions[c.ally].name} share 3 supplies with you.`);
      }
      mapTurn(c);
      turnEvent(c);
      storyTurn(c);
      checkDominion(c);
      return;
    }
    if (f.alive && !aiStep(c, f)) continue; // aiStep returns false while the faction still has moves
    c.cursor++;
    c.spent = false;
  }
}

/** The words of a tale with its names filled in. */
export function taleText(c: Campaign, text: string): string {
  const t = c.tale;
  if (!t) return text;
  return text.replace(/\{land\}/g, c.territories[t.land]?.name ?? 'your land').replace(/\{rival\}/g, t.rival > 0 ? `the ${c.factions[t.rival].name}` : 'a rival').replace(/\{tribe\}/g, c.territories[t.tribe]?.name ?? 'the next valley')
    .replace(/(^|[.!?] )the /g, (_, lead: string) => `${lead}The `);
}
export const taleNow = (c: Campaign): Tale | undefined => (c.tale ? TALES.find((x) => x.id === c.tale!.id) : undefined);
/** Can the player afford this answer to the tale before them? */
export function canAnswer(c: Campaign, choice: 'a' | 'b'): boolean {
  const tale = taleNow(c);
  return !!tale && c.phase === 'player' && c.factions[0].supplies + tale[choice].supplies >= 0;
}
/** The player answers the tale before them. */
export function answerTale(c: Campaign, choice: 'a' | 'b'): boolean {
  const tale = taleNow(c), t = c.tale;
  if (!tale || !t || !canAnswer(c, choice)) return false;
  const ch: TaleChoice = tale[choice], me = c.factions[0];
  const result = taleText(c, ch.result);
  c.tale = null;
  me.supplies += ch.supplies;
  if (ch.favor && t.rival > 0) c.factions[t.rival].favor = Math.max(-MAX_FAVOR, Math.min(MAX_FAVOR, (c.factions[t.rival].favor ?? 0) + ch.favor));
  if (ch.militia && c.territories[t.tribe]?.owner < 0) c.territories[t.tribe].militia = Math.max(1, c.territories[t.tribe].militia + ch.militia);
  if (ch.company) {
    const home = c.territories.find((x) => x.capital === 0 && x.owner === 0) ?? c.territories[t.land];
    const a = armyAt(c, home.id);
    if (a && a.owner === 0) { if (armySize(a) < MAX_ARMY) a.units.infantry = (a.units.infantry ?? 0) + 1; }
    else if (!a) c.armies.push({ id: c.nextArmy++, owner: 0, at: home.id, units: { infantry: 1 }, hero: false, vet: 0, moved: true });
  }
  c.log.push(result);
  tell(c, `${tale.title}: ${result}`);
  shiftVirtue(c, 0, ch.virtue);
  return true;
}

/** The world's own events, and the tales that come before each people in turn. */
function storyTurn(c: Campaign): void {
  // Something that befalls everyone.
  if (c.world && c.world.until < c.turn) { c.log.push(`${WORLD_EVENTS[c.world.kind].name} is over.`); c.world = null; c.worldRest = c.turn + WORLD_REST; }
  if (!c.world && c.turn >= Math.max(WORLD_FROM, c.worldRest ?? 0) && luck(c, 70) < WORLD_CHANCE) {
    const kinds = Object.keys(WORLD_EVENTS) as WorldKind[];
    const kind = kinds[Math.floor(luck(c, 71) * kinds.length)], def = WORLD_EVENTS[kind];
    c.log.push(`${def.icon} ${def.name}. ${def.desc}${def.turns ? ` It will last ${def.turns} turns.` : ''}`);
    tell(c, def.tell);
    if (def.turns) c.world = { kind, until: c.turn + def.turns - 1 };
    else {
      c.worldRest = c.turn + WORLD_REST;
      if (kind === 'comet') for (const f of c.factions) if (f.alive) shiftVirtue(c, f.id, COMET_VIRTUE);
      if (kind === 'pestilence') for (const a of c.armies.slice()) if (armySize(a) >= 3 && !faithOf(c, a.owner).steadfast) casualties(a, 1);
    }
  }
  // A tale for the player, and each rival answers one of its own as its people lean.
  if (c.turn < TALE_FROM || (c.turn - TALE_FROM) % TALE_EVERY) return;
  c.factions.forEach((f) => {
    if (!f.alive || !f.isAI) return;
    shiftVirtue(c, f.id, luck(c, 80 + f.id) < leaningWith(f.civ, LEANING[f.civ] ?? 0.5) ? TALE_RIVAL : -TALE_RIVAL);
  });
  const mine = c.territories.filter((t) => t.owner === 0);
  if (!mine.length || c.phase === 'over') return;
  const rivals = c.factions.filter((f) => f.alive && f.id > 0);
  const tribes = mine.flatMap((t) => t.adj).filter((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
  const open = TALES.filter((x) => x.id !== c.lastTale && (x.needs !== 'rival' || rivals.length) && (x.needs !== 'tribe' || tribes.length));
  const tale = open[Math.floor(luck(c, 90) * open.length)];
  if (!tale) return;
  c.lastTale = tale.id;
  c.tale = {
    id: tale.id, land: mine[Math.floor(luck(c, 91) * mine.length)].id,
    rival: rivals.length ? rivals[Math.floor(luck(c, 92) * rivals.length)].id : -1,
    tribe: tribes.length ? tribes[Math.floor(luck(c, 93) * tribes.length)] : -1,
  };
  c.log.push(`${tale.title}: a matter is brought before you.`);
}

/** Now and then something happens that nobody planned. */
function turnEvent(c: Campaign): void {
  if (rand(c) > 0.4) return;
  const owned = c.territories.filter((t) => t.owner >= 0);
  const t = owned[Math.floor(rand(c) * owned.length)];
  if (!t) return;
  const f = c.factions[t.owner];
  const who = f.id === 0 ? 'your' : `${f.name}'s`;
  const a = armyAt(c, t.id);
  const roll = rand(c);
  if (roll < 0.3) {
    f.supplies += 4;
    mark(c, 'harvest', t.id);
    c.log.push(`A fine harvest in ${t.name} adds 4 to ${who} supplies.`);
  } else if (roll < 0.5 && a && a.owner === f.id && armySize(a) < MAX_ARMY) {
    a.units.infantry = (a.units.infantry ?? 0) + 1;
    mark(c, 'volunteers', t.id);
    c.log.push(`Volunteers from ${t.name} join ${who} army.`);
  } else if (roll < 0.7 && a && a.owner === f.id && armySize(a) > 1) {
    casualties(a, 1);
    mark(c, 'fever', t.id);
    c.log.push(`Fever in the camp at ${t.name} costs ${who} army a company.`);
  } else if (roll < 0.85 && t.buildings.includes('farm')) {
    t.buildings.splice(t.buildings.indexOf('farm'), 1);
    mark(c, 'raiders', t.id);
    c.log.push(`Raiders burn the farmland of ${t.name}.`);
  } else {
    f.supplies = Math.max(0, f.supplies - 3);
    mark(c, 'hard', t.id);
    c.log.push(`A hard season in ${t.name} costs 3 of ${who} supplies.`);
  }
}

/** One decision for an AI faction. Returns true once it has nothing left to do this turn. */
function aiStep(c: Campaign, f: Faction): boolean {
  const me = habitsWith(f.civ, PERSONA[f.civ]);
  const civ = f.civ;
  if (!c.spent) {
    // A greedy leader with the stronger army and a border with the player may ask to be paid off.
    const neighbours = c.territories.some((t) => t.owner === f.id && t.adj.some((n) => c.territories[n].owner === 0));
    if (neighbours && c.turn >= 4 && c.turn - f.lastDemand >= 6 && !atTruce(c, 0, f.id) && c.factions[0].alive
      && totalStrength(c, f.id) > totalStrength(c, 0) * 1.3 && rand(c) < me.greed) {
      f.lastDemand = c.turn;
      c.demand = { from: f.id, amount: Math.min(8, 3 + Math.floor(c.turn / 5)) };
      say(c, f.id, 'demand');
      return false;
    }
    c.spent = true;
    const own = c.territories.filter((t) => t.owner === f.id);
    for (const t of own) if (canSummonHero(c, f.id, t.id)) summonHero(c, f.id, t.id);
    // A people with stores to spare moves with the times.
    if (c.turn >= 5 && f.supplies >= ageCost(c, f.id) + 8) advanceAge(c, f.id);
    // A people shut in by the sea builds a harbour before anything else.
    const shut = !own.some((t) => reach(c, t.id).some((n) => c.territories[n].owner !== f.id));
    if (shut) { const port = own.find((t) => lanesOf(c, t.id).some((n) => c.territories[n].owner !== f.id) && canBuild(c, f.id, t.id, 'harbour')); if (port) build(c, f.id, port.id, 'harbour'); }
    // A people builds what it believes in: the pious a church, the worldly a tavern, each in its chief town first.
    const lean = leaningWith(civ, LEANING[civ] ?? 0.5);
    const house = lean >= 0.6 ? 'church' : lean <= 0.4 ? 'tavern' : '';
    if (house && c.turn >= 3 && f.supplies >= siteCost(own[0] ?? c.territories[0], house, civ) + 6 && own.filter((t) => t.buildings.includes(house)).length < 1 + Math.floor(own.length / 5)) {
      const at = own.find((t) => t.capital === f.id && canBuild(c, f.id, t.id, house)) ?? own.find((t) => !t.adj.some((n) => c.territories[n].owner !== f.id) && canBuild(c, f.id, t.id, house));
      if (at) build(c, f.id, at.id, house);
    }
    for (const t of own) {
      const border = t.adj.some((n) => c.territories[n].owner !== f.id);
      if (t.capital === f.id && f.supplies > 12 && rand(c) < 0.5) build(c, f.id, t.id, rand(c) < 0.5 ? 'range' : 'stable');
      else if (onSea(c, t.id) && !t.buildings.includes('harbour') && f.supplies > 12 && rand(c) < 0.4) build(c, f.id, t.id, 'harbour');
      else if (rand(c) < me.farm) build(c, f.id, t.id, 'farm');
      else if (border && f.supplies > siteCost(t, 'fortress', civ) + 5 && rand(c) < me.fort) build(c, f.id, t.id, 'fortress');
    }
    // Spend what is left on troops, growing existing armies before starting new ones.
    const yards = own.filter((t) => Object.values(COMPANIES).some((d) => t.buildings.includes(d.needs)))
      .sort((a, b) => (armyAt(c, b.id) ? 1 : 0) - (armyAt(c, a.id) ? 1 : 0));
    for (const t of yards) {
      for (let guard = 0; guard < 12; guard++) {
        const a = armyAt(c, t.id);
        if (a && armySize(a) >= 9) break;
        const types = Object.keys(COMPANIES).filter((k) => canRaise(c, f.id, t.id, k));
        if (!types.length) break;
        raise(c, f.id, t.id, types[Math.floor(rand(c) * types.length)]);
      }
    }
    return false;
  }
  const army = c.armies.find((a) => a.owner === f.id && !a.moved);
  if (!army) return true;
  const here = c.territories[army.at];
  // Never march on someone we have a truce with.
  const targets = reach(c, here.id).filter((id) => c.territories[id].owner !== f.id && !atTruce(c, f.id, c.territories[id].owner))
    .sort((a, b) => defence(c, a, army.units, civ) - defence(c, b, army.units, civ));
  // A leader who has just been refused goes for the player before anyone else.
  // An ally goes first for whoever is at the player's borders.
  if (c.ally === f.id) {
    const foe = (id: number) => { const o = c.territories[id].owner; return o > 0 && c.territories.some((t) => t.owner === o && t.adj.some((n) => c.territories[n].owner === 0)) ? 0 : 1; };
    targets.sort((a, b) => foe(a) - foe(b));
  }
  if (f.angry) targets.sort((a, b) => (c.territories[a].owner === 0 ? 0 : 1) - (c.territories[b].owner === 0 ? 0 : 1));
  if (targets.length) {
    const t = c.territories[targets[0]];
    // Cautious leaders want better odds; a leader who has just been refused wants blood.
    const margin = [3, 2, 1][c.level] + me.margin - (f.angry && t.owner === 0 ? 2 : 0);
    const bySea = !here.adj.includes(t.id);
    if (strengthVs(army, defenders(c, t.id)) * (bySea ? SEA_LANDING : 1) * ageEdge(c, f.id) >= defence(c, t.id, army.units, civ) * ageEdge(c, t.owner) + margin) {
      moveArmy(c, army.id, t.id);
      return false;
    }
  }
  if (!reach(c, here.id).some((id) => c.territories[id].owner !== f.id)) {
    // Deep in friendly land: walk towards the nearest border.
    const next = stepToBorder(c, f.id, army.at);
    if (next >= 0 && moveArmy(c, army.id, next) === 'moved') { army.moved = true; return false; }
  }
  army.moved = true;
  return false;
}

function stepToBorder(c: Campaign, f: number, from: number): number {
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of reach(c, cur)) {
      if (prev.has(n)) continue;
      prev.set(n, cur);
      if (c.territories[n].owner !== f) {
        // Found foreign land: walk back to the first step, which must be our own.
        let s = cur;
        while (prev.get(s) !== from && prev.get(s) !== -1) s = prev.get(s)!;
        return s === from ? -1 : s;
      }
      queue.push(n);
    }
  }
  return -1;
}

// ---- Real-time battles ----

export interface BattleConfig { seed: number; size: number; level: number; title: string; setups: PlayerSetup[]; humanAttacks: boolean; field: boolean; sea: boolean; /** The weather over the land being fought for. */ weather?: Sky; /** The country it lies in. */ climate?: 'temperate' | 'desert' | 'steppe' | 'snow' }

/** Turn the pending battle into a real-time match: each side fields the troops it has on the map. */
export function battleConfig(c: Campaign): BattleConfig | null {
  const p = c.pending;
  if (!p) return null;
  const t = c.territories[p.to];
  const humanAttacks = p.attacker === 0;
  const field = p.mode === 'field';
  const foe = humanAttacks ? p.defender : p.attacker;
  const attackers = c.armies.find((a) => a.id === p.armyId);
  const defenders = armyAt(c, p.to);
  const side = (army: Army | undefined, defending: boolean, str: number, age = 0) => {
    const calling = army && c.factions[army.owner] ? heroFor(c, army.owner).calling : 'warlord';
    const units: Record<string, number> = {};
    const add = (type: string, n: number) => { units[type] = (units[type] ?? 0) + n; };
    if (army) {
      for (const [type, n] of Object.entries(army.units)) for (const [u, k] of Object.entries(COMPANIES[type].units)) add(u, k * n);
      if (army.hero) add(calling, 1);
    }
    if (defending) add('clubman', t.owner < 0 ? t.militia * 2 : 2); // the people of the land turn out too
    const fort = defending && t.buildings.includes('fortress');
    return {
      units, res: 30 * str + (defending && t.buildings.includes('farm') ? 150 : 0),
      age: Math.max(fort ? 1 : 0, age), armed: true, buildings: fort ? ['tower', 'tower'] : [], atk: army ? army.vet : 0,
    };
  };
  // The locals of a territory are always the same people, one that is not the player's.
  const localCiv = CIV_IDS.filter((id) => id !== c.factions[0].civ)[t.seed % (CIV_IDS.length - 1)];
  const myReserve = reserves(c, 0, p.to, p.armyId)[0];
  const foeReserve = foe < 0 ? undefined : reserves(c, foe, p.to, p.armyId)[0];
  const allyReserve = c.ally < 0 ? undefined : reserves(c, c.ally, p.to, p.armyId)[0];
  const shade = (col: number, k: number) => [16, 8, 0].reduce((n, sh) => n | (Math.min(255, Math.round(((col >> sh) & 255) * k)) << sh), 0);
  return {
    ...(weatherAt(c, p.to) ? { weather: weatherAt(c, p.to) as Sky } : {}),
    climate: BIOMES[biomeOf(c, p.to)].climate,
    seed: t.seed, size: field ? 56 : t.trait === 'coast' ? 96 : 72, level: foe < 0 ? 0 : c.level, humanAttacks, field, sea: !field && t.trait === 'coast',
    title: humanAttacks ? `${p.sea ? 'The landing at' : 'The assault on'} ${t.name}` : `The defence of ${t.name}`,
    setups: [
      { name: 'You', color: c.factions[0].color, isAI: false, team: 0, civ: c.factions[0].civ, hero: heroFor(c, 0), virtue: virtueOf(c, 0), bonus: humanAttacks ? side(attackers, false, p.aStr, ageOf(c, 0)) : side(defenders, true, p.dStr, ageOf(c, 0)) },
      {
        name: foe < 0 ? LOCALS.name : c.factions[foe].name, color: foe < 0 ? LOCALS.color : c.factions[foe].color, isAI: true, team: 1, civ: foe < 0 ? localCiv : c.factions[foe].civ, ...(foe < 0 ? {} : { hero: heroFor(c, foe) }), virtue: virtueOf(c, foe),
        bonus: humanAttacks ? side(defenders, true, p.dStr, ageOf(c, foe)) : side(attackers, false, p.aStr, ageOf(c, foe)),
      },
      // The strongest army next door on each side joins the battle as an ally with its own camp.
      ...(foeReserve ? [{ name: `${c.factions[foe].name} reserve`, color: shade(c.factions[foe].color, 0.65), isAI: true, team: 1, civ: c.factions[foe].civ, hero: heroFor(c, foe), virtue: virtueOf(c, foe), bonus: side(foeReserve, false, armyStrength(foeReserve), ageOf(c, foe)) }] : []),
      ...(myReserve ? [{ name: 'Your reserve', color: shade(c.factions[0].color, 1.5), isAI: true, team: 0, civ: c.factions[0].civ, hero: heroFor(c, 0), virtue: virtueOf(c, 0), bonus: side(myReserve, false, armyStrength(myReserve), ageOf(c, 0)) }] : []),
      ...(allyReserve ? [{ name: `${c.factions[c.ally].name} (ally)`, color: c.factions[c.ally].color, isAI: true, team: 0, civ: c.factions[c.ally].civ, hero: heroFor(c, c.ally), virtue: virtueOf(c, c.ally), bonus: side(allyReserve, false, armyStrength(allyReserve), ageOf(c, c.ally)) }] : []),
    ].slice(0, 4),
  };
}

/** Record the outcome of a battle the player fought in person. */
/** Units that fight in person for each company type, e.g. two clubmen for an infantry company. */
const unitsOf = (type: string): [string, number] => Object.entries(COMPANIES[type].units)[0];

/**
 * Record the outcome of a battle the player fought in person. If the player won and `survivors`
 * (their remaining units, by type) is given, their army keeps only the companies that lived
 * through it, in place of the usual estimate of losses.
 */
export function finishBattle(c: Campaign, playerWon: boolean, survivors?: Record<string, number>, virtue?: number, heroRank?: number): void {
  const p = c.pending;
  if (!p) return;
  // What the town became under the player's hand goes home with the army: half of how far it moved.
  if (virtue !== undefined && Number.isFinite(virtue)) shiftVirtue(c, 0, (virtue - virtueOf(c, 0)) * BATTLE_VIRTUE);
  const humanAttacks = p.attacker === 0;
  const mine = humanAttacks ? c.armies.find((a) => a.id === p.armyId) : armyAt(c, p.to);
  const before = mine ? { units: { ...mine.units }, hero: mine.hero } : null;
  const rankBefore = c.factions[0].heroRank ?? 0;
  resolvePending(c, playerWon === humanAttacks ? 'attacker' : 'defender');
  if (!playerWon || !survivors || !mine || !before || !c.armies.includes(mine)) return;
  const units: Record<string, number> = {};
  for (const [type, had] of Object.entries(before.units)) {
    const [unit, per] = unitsOf(type);
    // In a later age the company fought with better weapons: count those too.
    let alive = 0;
    for (let u: string | undefined = unit; u; u = Object.values(TECHS).find((t) => t.upgrade?.[0] === u)?.upgrade![1]) alive += survivors[u] ?? 0;
    const left = Math.min(had, Math.ceil(alive / per));
    if (left > 0) units[type] = left;
  }
  // An army is never wiped out by a battle it won: its last company limps home.
  if (!Object.keys(units).length) units[Object.keys(before.units)[0] ?? 'infantry'] = 1;
  mine.units = units;
  const hero = heroFor(c, 0);
  if (before.hero && !(survivors[hero.calling] > 0)) {
    mine.hero = false;
    c.factions[0].heroAlive = false;
    c.factions[0].heroRank = Math.max(0, rankBefore - 1);
    c.log.push(`${hero.name} fell in the fighting.`);
  } else if (before.hero && heroRank != null) {
    // The veterancy earned on the field itself stands in place of the usual step for a battle won.
    c.factions[0].heroRank = Math.max(0, Math.min(MAX_RANK, Math.round(heroRank)));
  }
}
