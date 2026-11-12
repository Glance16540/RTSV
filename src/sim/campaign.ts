// Conquest mode: a turn-based strategic map layered over the real-time battles.
// Pure rules, no DOM, so it can be tested headless.

import { CIVS, CIV_COLOR, CIV_IDS } from './data';
import type { PlayerSetup } from './game';
import { LEADERS, LeaderEvent, Speech } from './leaders';

export const MAP_W = 1000;
export const MAP_H = 600;
export const CAMPAIGN_VERSION = 6;

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
  fortress: { name: 'Fortress', icon: '🏰', cost: 9, desc: '+3 defence. In battle the defender starts in the Bronze Age with towers.' },
};
export const slots = (t: Territory) => (t.capital >= 0 ? 4 : 3);

/** What each troop type is good against: its companies fight up to 30% harder against that type. */
export const BEATS: Record<string, string> = { cavalry: 'archers', archers: 'infantry', infantry: 'cavalry' };
export const MAX_VETERAN = 3;

/** Some land is special. */
export interface TraitDef { name: string; icon: string; desc: string }
export const TRAITS: Record<string, TraitDef> = {
  gold: { name: 'Gold hills', icon: '⛏️', desc: '+3 supplies each turn.' },
  fertile: { name: 'Rich soil', icon: '🌱', desc: 'Farmland here yields +4 instead of +2.' },
  hills: { name: 'High ground', icon: '⛰️', desc: '+2 defence.' },
  horses: { name: 'Horse plains', icon: '🐎', desc: 'Stables and cavalry cost less here.' },
};
/** What sets each people apart on the campaign map. */
export const CAMPAIGN_EDGE: Record<string, string> = {
  stonekin: 'Fortresses cost 5 instead of 9 and add 4 defence instead of 3.',
  steppe: 'Cavalry costs 1 less, and an army that marches into friendly land may march again.',
  hearth: 'Farmland yields 1 more, and so does the capital.',
  forge: 'Every building costs 1 less.',
  dawn: 'A new Warlord costs half, and attacks ignore the defender\'s home advantage.',
  wild: 'Local tribes fight them at 1 less, and taking their land brings 2 supplies of plunder.',
};

/** How each leader plays: caution in attack, taste for forts and farms, openness to peace, and greed. */
export const PERSONA: Record<string, { margin: number; fort: number; farm: number; peace: number; greed: number }> = {
  stonekin: { margin: 1, fort: 0.6, farm: 0.5, peace: 0.6, greed: 0.1 },
  steppe: { margin: -1, fort: 0.1, farm: 0.3, peace: 0.25, greed: 0.35 },
  hearth: { margin: 1, fort: 0.3, farm: 0.8, peace: 0.75, greed: 0.05 },
  forge: { margin: 0, fort: 0.3, farm: 0.5, peace: 0.45, greed: 0.2 },
  dawn: { margin: 0, fort: 0.2, farm: 0.5, peace: 0.5, greed: 0.25 },
  wild: { margin: -1, fort: 0.05, farm: 0.3, peace: 0.2, greed: 0.4 },
};
export const TRUCE_COST = 3;
export const TRUCE_TURNS = 6;

export function siteCost(t: Territory, site: string, civ = ''): number {
  if (site === 'fortress' && civ === 'stonekin') return 5;
  return Math.max(2, SITES[site].cost - (site === 'stable' && t.trait === 'horses' ? 2 : 0) - (civ === 'forge' ? 1 : 0));
}
export function companyCost(t: Territory, type: string, civ = ''): number {
  return Math.max(1, COMPANIES[type].cost - (type === 'cavalry' && t.trait === 'horses' ? 1 : 0) - (type === 'cavalry' && civ === 'steppe' ? 1 : 0));
}
export const heroCost = (civ: string): number => (civ === 'dawn' ? HERO_COST / 2 : HERO_COST);

export interface Faction {
  id: number; name: string; civ: string; color: number; isAI: boolean; supplies: number; alive: boolean; heroAlive: boolean;
  lastDemand: number; // turn this rival last demanded tribute
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
}

export interface Army {
  id: number;
  owner: number;
  at: number;
  units: Record<string, number>; // companies by type
  hero: boolean; // the faction's Warlord marches with this army
  marched?: boolean; // has already made its extra march this turn (Steppe Riders)
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
  /** How the player chose to fight it: armies only on open ground, or a full battle with towns. */
  mode?: 'field' | 'siege';
}

export interface Campaign {
  v: number;
  seed: number;
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
}

const NAMES = [
  'Ashford Vale', 'Stonereach', 'Greenmere', 'Highmoor', 'Riverbend', 'Wolfwood', 'Sunfields', 'Ironcrag',
  'Mistfen', 'Eastmarch', 'Goldwater', 'Thornhold', 'Westshore', 'Redcliff', 'Oakhollow', 'Harrowdale',
  'Saltmarsh', 'Kingsbarrow', 'Emberfell', 'Windscar', 'Lowmere', 'Frosthollow', 'Amberfield', 'Ravenmoor',
  'Greywater', 'Brackenridge',
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
    factions: [], territories: [], armies: [], pending: null, nextArmy: 1, winner: -1, log: [], speech: [], truces: [], honor: 0, demand: null,
  };
  const pick = <T>(list: T[]): T => list.splice(Math.floor(rand(c) * list.length), 1)[0];
  const [cols, rows] = pick([[4, 3], [5, 3], [5, 3], [6, 3], [5, 4], [6, 4]]);
  const names = NAMES.slice();
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      c.territories.push({
        id: j * cols + i, name: pick(names), owner: -1, capital: -1, adj: [],
        x: ((i + 0.5) * MAP_W) / cols + (rand(c) - 0.5) * (MAP_W / cols) * 0.5, y: ((j + 0.5) * MAP_H) / rows + (rand(c) - 0.5) * (MAP_H / rows) * 0.4,
        buildings: rand(c) < 0.35 ? ['farm'] : [], trait: rand(c) < 0.45 ? Object.keys(TRAITS)[Math.floor(rand(c) * 4)] : '', militia: 2 + Math.floor(rand(c) * 3), seed: 1 + Math.floor(rand(c) * 1e6),
      });
    }
  // Neighbours are whichever territories share a border.
  const step = 5;
  const link = (a: number, b: number) => {
    if (a !== b && !c.territories[a].adj.includes(b)) { c.territories[a].adj.push(b); c.territories[b].adj.push(a); }
  };
  for (let y = 0; y < MAP_H; y += step)
    for (let x = 0; x < MAP_W; x += step) {
      const t = territoryAt(c.territories, x, y);
      if (x + step < MAP_W) link(t, territoryAt(c.territories, x + step, y));
      if (y + step < MAP_H) link(t, territoryAt(c.territories, x, y + step));
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
  const rim = c.territories.filter((t) => t.id % cols === 0 || t.id % cols === cols - 1 || t.id < cols || t.id >= cols * (rows - 1));
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
  c.log.push(`Turn 1. You lead the ${CIVS[mine].name}. ${c.factions.slice(1).map((f) => f.name).join(', ')} ${count > 1 ? 'share' : 'shares'} this land with you.`);
  advise(c, 'p_start');
  for (let f = 1; f <= count; f++) say(c, f, 'intro');
  return c;
}

// ---- Queries ----

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
  for (const t of c.territories) if (t.owner === f) n += territoryIncome(t, c.factions[f].civ);
  return n;
}
export function territoryIncome(t: Territory, civ = ''): number {
  const hearth = civ === 'hearth' ? 1 : 0;
  return 2 + (t.buildings.includes('farm') ? (t.trait === 'fertile' ? 4 : 2) + hearth : 0) + (t.capital >= 0 ? 2 + hearth : 0) + (t.trait === 'gold' ? 3 : 0);
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
  const ground = t.trait === 'hills' ? 2 : 0;
  if (t.owner < 0) return Math.max(1, t.militia - (attackerCiv === 'wild' ? 1 : 0)) + ground;
  const a = armyAt(c, tid);
  const fort = t.buildings.includes('fortress') ? (c.factions[t.owner].civ === 'stonekin' ? 4 : 3) : 0;
  return Math.round(((a && a.owner === t.owner ? strengthVs(a, vs) : 0) + 1 + fort + ground) * 10) / 10;
}

/** True while the player and a rival are bound by a truce. */
export function atTruce(c: Campaign, a: number, b: number): boolean {
  const other = a === 0 ? b : b === 0 ? a : -1;
  return other > 0 && c.truces.some((t) => t.with === other && t.until >= c.turn);
}
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
  return t.owner === f && !!SITES[site] && !t.buildings.includes(site) && t.buildings.length < slots(t) && c.factions[f].supplies >= siteCost(t, site, c.factions[f].civ);
}
export function canRaise(c: Campaign, f: number, tid: number, type: string): boolean {
  const t = c.territories[tid], def = COMPANIES[type];
  const a = armyAt(c, tid);
  return t.owner === f && !!def && t.buildings.includes(def.needs) && c.factions[f].supplies >= companyCost(t, type, c.factions[f].civ) && (!a || (a.owner === f && armySize(a) < MAX_ARMY));
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
  c.factions[f].supplies -= companyCost(c.territories[tid], type, c.factions[f].civ);
  let a = armyAt(c, tid);
  if (!a) {
    a = { id: c.nextArmy++, owner: f, at: tid, units: {}, hero: false, vet: 0, moved: true }; // fresh troops march next turn
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
  if (a.hero) c.factions[a.owner].heroAlive = false;
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
  if (!a || a.moved || c.pending || c.demand || !c.territories[a.at].adj.includes(to)) return 'invalid';
  const t = c.territories[to];
  const civ = c.factions[a.owner].civ;
  if (t.owner === a.owner) {
    const other = armyAt(c, to);
    // Steppe Riders cover ground: one march through friendly land does not end an army's turn.
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
    c.truces = c.truces.filter((x) => x.with !== t.owner);
    c.honor--;
    say(c, t.owner, 'betray');
    c.log.push(`You have broken your truce with ${c.factions[t.owner].name}.`);
  }
  const support = (f: number, skip: number) => (f < 0 ? 0 : reserves(c, f, to, skip).reduce((n, r) => n + armyStrength(r) * 0.3, 0));
  const round = (v: number) => Math.round(v * 10) / 10;
  c.pending = {
    armyId, from: a.at, to, attacker: a.owner, defender: t.owner,
    aStr: round(strengthVs(a, defenders(c, to)) + support(a.owner, a.id)), dStr: round(defence(c, to, a.units, civ) + support(t.owner, -1)),
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
  if (!fac || !fac.isAI || !fac.alive || atTruce(c, 0, f) || c.factions[0].supplies < TRUCE_COST || c.phase !== 'player') return false;
  const mine = totalStrength(c, 0), theirs = totalStrength(c, f);
  const willing = PERSONA[fac.civ].peace + (mine >= theirs ? 0.25 : -0.15);
  if (c.honor < 0 || rand(c) > willing) {
    say(c, f, 'refuse');
    c.log.push(`${fac.name} will not hear of a truce.`);
    return false;
  }
  c.factions[0].supplies -= TRUCE_COST;
  c.truces.push({ with: f, until: c.turn + TRUCE_TURNS });
  say(c, f, 'truce');
  c.log.push(`A truce with ${fac.name} until turn ${c.turn + TRUCE_TURNS}.`);
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
      army.at = p.to;
      army.moved = true;
    }
    c.log.push(`${fname(c, p.attacker, true)} took ${t.name} from ${fname(c, p.defender)}.`);
    if (p.defender < 0 && c.factions[p.attacker].civ === 'wild') c.factions[p.attacker].supplies += 2; // plunder
    if (t.capital >= 0 && t.capital !== p.attacker) {
      // Sacking a capital carries off its stores.
      const loot = Math.floor(c.factions[t.capital].supplies / 2);
      c.factions[t.capital].supplies -= loot;
      c.factions[p.attacker].supplies += loot;
      t.capital = -1;
    }
    t.owner = p.attacker;
    t.buildings = t.buildings.filter((b) => b !== 'fortress'); // the walls do not survive the assault
  } else {
    if (army) destroyArmy(c, army);
    if (defArmy) { casualties(defArmy, Math.ceil(p.aStr * 0.3)); defArmy.vet = Math.min(MAX_VETERAN, defArmy.vet + 1); }
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
    }
  }
  const alive = c.factions.filter((f) => f.alive);
  if (!c.factions[0].alive) { c.phase = 'over'; c.winner = alive[0]?.id ?? -1; }
  else if (alive.length === 1) { c.phase = 'over'; c.winner = 0; }
}

// ---- Turn structure ----

/** Finish the player's turn and play the rivals' turns. Stops early if one of them attacks the player. */
export function endTurn(c: Campaign): void {
  if (c.phase !== 'player' || c.pending) return;
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
      for (const x of c.factions) if (x.alive) x.supplies += Math.round(income(c, x.id) * (x.isAI ? [0.8, 1, 1.25][c.level] : 1));
      c.log.push(`Turn ${c.turn}.`);
      turnEvent(c);
      return;
    }
    if (f.alive && !aiStep(c, f)) continue; // aiStep returns false while the faction still has moves
    c.cursor++;
    c.spent = false;
  }
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
    c.log.push(`A fine harvest in ${t.name} adds 4 to ${who} supplies.`);
  } else if (roll < 0.5 && a && a.owner === f.id && armySize(a) < MAX_ARMY) {
    a.units.infantry = (a.units.infantry ?? 0) + 1;
    c.log.push(`Volunteers from ${t.name} join ${who} army.`);
  } else if (roll < 0.7 && a && a.owner === f.id && armySize(a) > 1) {
    casualties(a, 1);
    c.log.push(`Fever in the camp at ${t.name} costs ${who} army a company.`);
  } else if (roll < 0.85 && t.buildings.includes('farm')) {
    t.buildings.splice(t.buildings.indexOf('farm'), 1);
    c.log.push(`Raiders burn the farmland of ${t.name}.`);
  } else {
    f.supplies = Math.max(0, f.supplies - 3);
    c.log.push(`A hard season in ${t.name} costs 3 of ${who} supplies.`);
  }
}

/** One decision for an AI faction. Returns true once it has nothing left to do this turn. */
function aiStep(c: Campaign, f: Faction): boolean {
  const me = PERSONA[f.civ];
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
    for (const t of own) {
      const border = t.adj.some((n) => c.territories[n].owner !== f.id);
      if (t.capital === f.id && f.supplies > 12 && rand(c) < 0.5) build(c, f.id, t.id, rand(c) < 0.5 ? 'range' : 'stable');
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
  const targets = here.adj.filter((id) => c.territories[id].owner !== f.id && !atTruce(c, f.id, c.territories[id].owner))
    .sort((a, b) => defence(c, a, army.units, civ) - defence(c, b, army.units, civ));
  // A leader who has just been refused goes for the player before anyone else.
  if (f.angry) targets.sort((a, b) => (c.territories[a].owner === 0 ? 0 : 1) - (c.territories[b].owner === 0 ? 0 : 1));
  if (targets.length) {
    const t = c.territories[targets[0]];
    // Cautious leaders want better odds; a leader who has just been refused wants blood.
    const margin = [3, 2, 1][c.level] + me.margin - (f.angry && t.owner === 0 ? 2 : 0);
    if (strengthVs(army, defenders(c, t.id)) >= defence(c, t.id, army.units, civ) + margin) {
      moveArmy(c, army.id, t.id);
      return false;
    }
  }
  if (!here.adj.some((id) => c.territories[id].owner !== f.id)) {
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
    for (const n of c.territories[cur].adj) {
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

export interface BattleConfig { seed: number; size: number; level: number; title: string; setups: PlayerSetup[]; humanAttacks: boolean; field: boolean }

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
  const side = (army: Army | undefined, defending: boolean, str: number) => {
    const units: Record<string, number> = {};
    const add = (type: string, n: number) => { units[type] = (units[type] ?? 0) + n; };
    if (army) {
      for (const [type, n] of Object.entries(army.units)) for (const [u, k] of Object.entries(COMPANIES[type].units)) add(u, k * n);
      if (army.hero) add('warlord', 1);
    }
    if (defending) add('clubman', t.owner < 0 ? t.militia * 2 : 2); // the people of the land turn out too
    const fort = defending && t.buildings.includes('fortress');
    return {
      units, res: 30 * str + (defending && t.buildings.includes('farm') ? 150 : 0),
      age: fort ? 1 : 0, buildings: fort ? ['tower', 'tower'] : [], atk: army ? army.vet : 0,
    };
  };
  // The locals of a territory are always the same people, one that is not the player's.
  const localCiv = CIV_IDS.filter((id) => id !== c.factions[0].civ)[t.seed % (CIV_IDS.length - 1)];
  const myReserve = reserves(c, 0, p.to, p.armyId)[0];
  const foeReserve = foe < 0 ? undefined : reserves(c, foe, p.to, p.armyId)[0];
  const shade = (col: number, k: number) => [16, 8, 0].reduce((n, sh) => n | (Math.min(255, Math.round(((col >> sh) & 255) * k)) << sh), 0);
  return {
    seed: t.seed, size: field ? 56 : 72, level: foe < 0 ? 0 : c.level, humanAttacks, field,
    title: humanAttacks ? `The assault on ${t.name}` : `The defence of ${t.name}`,
    setups: [
      { name: 'You', color: c.factions[0].color, isAI: false, team: 0, civ: c.factions[0].civ, bonus: humanAttacks ? side(attackers, false, p.aStr) : side(defenders, true, p.dStr) },
      {
        name: foe < 0 ? LOCALS.name : c.factions[foe].name, color: foe < 0 ? LOCALS.color : c.factions[foe].color, isAI: true, team: 1, civ: foe < 0 ? localCiv : c.factions[foe].civ,
        bonus: humanAttacks ? side(defenders, true, p.dStr) : side(attackers, false, p.aStr),
      },
      // The strongest army next door on each side joins the battle as an ally with its own camp.
      ...(foeReserve ? [{ name: `${c.factions[foe].name} reserve`, color: shade(c.factions[foe].color, 0.65), isAI: true, team: 1, civ: c.factions[foe].civ, bonus: side(foeReserve, false, armyStrength(foeReserve)) }] : []),
      ...(myReserve ? [{ name: 'Your reserve', color: shade(c.factions[0].color, 1.5), isAI: true, team: 0, civ: c.factions[0].civ, bonus: side(myReserve, false, armyStrength(myReserve)) }] : []),
    ],
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
export function finishBattle(c: Campaign, playerWon: boolean, survivors?: Record<string, number>): void {
  const p = c.pending;
  if (!p) return;
  const humanAttacks = p.attacker === 0;
  const mine = humanAttacks ? c.armies.find((a) => a.id === p.armyId) : armyAt(c, p.to);
  const before = mine ? { units: { ...mine.units }, hero: mine.hero } : null;
  resolvePending(c, playerWon === humanAttacks ? 'attacker' : 'defender');
  if (!playerWon || !survivors || !mine || !before || !c.armies.includes(mine)) return;
  const units: Record<string, number> = {};
  for (const [type, had] of Object.entries(before.units)) {
    const [unit, per] = unitsOf(type);
    const left = Math.min(had, Math.ceil((survivors[unit] ?? 0) / per));
    if (left > 0) units[type] = left;
  }
  // An army is never wiped out by a battle it won: its last company limps home.
  if (!Object.keys(units).length) units[Object.keys(before.units)[0] ?? 'infantry'] = 1;
  mine.units = units;
  if (before.hero && !(survivors.warlord > 0)) {
    mine.hero = false;
    c.factions[0].heroAlive = false;
    c.log.push('Your Warlord fell in the fighting.');
  }
}
