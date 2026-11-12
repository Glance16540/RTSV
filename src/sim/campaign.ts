// Conquest mode: a turn-based strategic map layered over the real-time battles.
// Pure rules, no DOM, so it can be tested headless.

import type { PlayerSetup } from './game';

export const MAP_W = 1000;
export const MAP_H = 600;
export const CAMPAIGN_VERSION = 3;

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
export const siteCost = (t: Territory, site: string): number => SITES[site].cost - (site === 'stable' && t.trait === 'horses' ? 2 : 0);
export const companyCost = (t: Territory, type: string): number => COMPANIES[type].cost - (type === 'cavalry' && t.trait === 'horses' ? 1 : 0);

export interface Faction { id: number; name: string; color: number; isAI: boolean; supplies: number; alive: boolean; heroAlive: boolean }

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
}

const NAMES = [
  'Ashford Vale', 'Stonereach', 'Greenmere', 'Highmoor', 'Riverbend', 'Wolfwood', 'Sunfields', 'Ironcrag',
  'Mistfen', 'Eastmarch', 'Goldwater', 'Thornhold', 'Westshore', 'Redcliff', 'Oakhollow',
];
const FACTIONS: [string, number][] = [['You', 0x2f7bff], ['Red Tribe', 0xe0452f], ['Golden Horde', 0xe0b020], ['Green Clan', 0x3aa648]];
export const LOCALS = { name: 'Local Tribe', color: 0x9a8a6a };

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

export function newCampaign(seed: number, rivals = 1, level = 1): Campaign {
  const c: Campaign = {
    v: CAMPAIGN_VERSION, seed, rngState: seed >>> 0, level, turn: 1, phase: 'player', cursor: 0, spent: false,
    factions: [], territories: [], armies: [], pending: null, nextArmy: 1, winner: -1, log: [],
  };
  const cols = 5, rows = 3;
  const names = NAMES.slice();
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const name = names.splice(Math.floor(rand(c) * names.length), 1)[0];
      c.territories.push({
        id: j * cols + i, name, owner: -1, capital: -1, adj: [],
        x: ((i + 0.5) * MAP_W) / cols + (rand(c) - 0.5) * 90, y: ((j + 0.5) * MAP_H) / rows + (rand(c) - 0.5) * 70,
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
  // Capitals: you in the west, the first rival in the east, others north and south.
  const homes = [cols, 2 * cols - 1, 2, 2 * cols + 2];
  for (let f = 0; f <= Math.min(3, Math.max(1, rivals)); f++) {
    c.factions.push({ id: f, name: FACTIONS[f][0], color: FACTIONS[f][1], isAI: f > 0, supplies: 8, alive: true, heroAlive: true });
    const t = c.territories[homes[f]];
    t.owner = f;
    t.capital = f;
    t.buildings = ['barracks', 'farm'];
    t.trait = '';
    c.armies.push({ id: c.nextArmy++, owner: f, at: t.id, units: { infantry: 3 }, hero: true, vet: 0, moved: false });
  }
  c.log.push('Turn 1. Your people look beyond their borders.');
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
  for (const t of c.territories) if (t.owner === f) n += territoryIncome(t);
  return n;
}
export const territoryIncome = (t: Territory): number =>
  2 + (t.buildings.includes('farm') ? (t.trait === 'fertile' ? 4 : 2) : 0) + (t.capital >= 0 ? 2 : 0) + (t.trait === 'gold' ? 3 : 0);

/** The companies an attacker would face in a territory. Locals and town guards fight as infantry. */
export function defenders(c: Campaign, tid: number): Record<string, number> {
  const t = c.territories[tid];
  const a = armyAt(c, tid);
  if (t.owner >= 0 && a && a.owner === t.owner) return a.units;
  return { infantry: t.owner < 0 ? t.militia : 1 };
}

/** Everything that defends a territory, optionally against a particular mix of attackers. */
export function defence(c: Campaign, tid: number, vs: Record<string, number> = {}): number {
  const t = c.territories[tid];
  const ground = t.trait === 'hills' ? 2 : 0;
  if (t.owner < 0) return t.militia + ground;
  const a = armyAt(c, tid);
  return Math.round(((a && a.owner === t.owner ? strengthVs(a, vs) : 0) + 1 + (t.buildings.includes('fortress') ? 3 : 0) + ground) * 10) / 10;
}

/** Chance (0..1) that the attacker wins an auto-resolved battle at these strengths. */
export function winChance(aStr: number, dStr: number): number {
  let wins = 0;
  const n = 24;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) if (aStr * (0.75 + (0.5 * i) / (n - 1)) > dStr * 1.1 * (0.75 + (0.5 * j) / (n - 1))) wins++;
  return wins / (n * n);
}

export function canBuild(c: Campaign, f: number, tid: number, site: string): boolean {
  const t = c.territories[tid];
  return t.owner === f && !!SITES[site] && !t.buildings.includes(site) && t.buildings.length < slots(t) && c.factions[f].supplies >= siteCost(t, site);
}
export function canRaise(c: Campaign, f: number, tid: number, type: string): boolean {
  const t = c.territories[tid], def = COMPANIES[type];
  const a = armyAt(c, tid);
  return t.owner === f && !!def && t.buildings.includes(def.needs) && c.factions[f].supplies >= companyCost(t, type) && (!a || (a.owner === f && armySize(a) < MAX_ARMY));
}
export function canSummonHero(c: Campaign, f: number, tid: number): boolean {
  const a = armyAt(c, tid);
  return c.territories[tid].capital === f && !!a && a.owner === f && !c.factions[f].heroAlive && c.factions[f].supplies >= HERO_COST;
}

// ---- Actions ----

export function build(c: Campaign, f: number, tid: number, site: string): boolean {
  if (!canBuild(c, f, tid, site)) return false;
  c.factions[f].supplies -= siteCost(c.territories[tid], site);
  c.territories[tid].buildings.push(site);
  return true;
}

/** Raise one company. It joins the army standing in the territory, or forms a new one. */
export function raise(c: Campaign, f: number, tid: number, type: string): boolean {
  if (!canRaise(c, f, tid, type)) return false;
  c.factions[f].supplies -= companyCost(c.territories[tid], type);
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
  c.factions[f].supplies -= HERO_COST;
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
  if (!a || a.moved || c.pending || !c.territories[a.at].adj.includes(to)) return 'invalid';
  const t = c.territories[to];
  if (t.owner === a.owner) {
    const other = armyAt(c, to);
    a.moved = true;
    if (other) {
      // Two friendly armies become one; companies over the limit stay behind.
      for (const type of Object.keys(a.units)) {
        while (a.units[type] > 0 && armySize(other) < MAX_ARMY) { a.units[type]--; other.units[type] = (other.units[type] ?? 0) + 1; }
        if (!a.units[type]) delete a.units[type];
      }
      if (a.hero) { other.hero = true; a.hero = false; }
      other.vet = Math.max(other.vet, a.vet);
      if (!armySize(a)) c.armies.splice(c.armies.indexOf(a), 1);
    } else a.at = to;
    return 'moved';
  }
  // Armies in neighbouring land lend some of their weight to the fight.
  const support = (f: number, skip: number) => (f < 0 ? 0 : reserves(c, f, to, skip).reduce((n, r) => n + armyStrength(r) * 0.3, 0));
  const round = (v: number) => Math.round(v * 10) / 10;
  c.pending = {
    armyId, from: a.at, to, attacker: a.owner, defender: t.owner,
    aStr: round(strengthVs(a, defenders(c, to)) + support(a.owner, a.id)), dStr: round(defence(c, to, a.units) + support(t.owner, -1)),
  };
  const human = (f: number) => f >= 0 && !c.factions[f].isAI;
  if (!human(a.owner) && !human(t.owner)) resolvePending(c, 'auto');
  return 'battle';
}

/** A faction's armies next door to a territory, strongest first: they can support a battle there. */
export function reserves(c: Campaign, f: number, tid: number, skipArmy = -1): Army[] {
  return c.armies.filter((a) => a.owner === f && a.id !== skipArmy && a.at !== tid && c.territories[tid].adj.includes(a.at))
    .sort((x, y) => armyStrength(y) - armyStrength(x));
}

/** Settle the pending battle by dice, or record the result of one that was fought out. */
export function resolvePending(c: Campaign, how: 'auto' | 'attacker' | 'defender'): boolean {
  const p = c.pending;
  if (!p) return false;
  let attackerWon = how === 'attacker';
  if (how === 'auto') {
    // Defenders fight on their own ground, which is worth a little.
    const a = p.aStr * (0.75 + rand(c) * 0.5), d = p.dStr * 1.1 * (0.75 + rand(c) * 0.5);
    attackerWon = a > d;
  }
  c.pending = null;
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
  while (c.phase === 'ai' && !c.pending) {
    const f = c.factions[c.cursor];
    if (!f) {
      // Everyone has moved: a new turn begins.
      c.turn++;
      c.phase = 'player';
      for (const a of c.armies) a.moved = false;
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
  if (!c.spent) {
    c.spent = true;
    const own = c.territories.filter((t) => t.owner === f.id);
    for (const t of own) if (canSummonHero(c, f.id, t.id)) summonHero(c, f.id, t.id);
    for (const t of own) {
      const border = t.adj.some((n) => c.territories[n].owner !== f.id);
      if (t.capital === f.id && f.supplies > 12 && rand(c) < 0.5) build(c, f.id, t.id, rand(c) < 0.5 ? 'range' : 'stable');
      else if (rand(c) < 0.5) build(c, f.id, t.id, 'farm');
      else if (border && f.supplies > 14 && rand(c) < 0.3) build(c, f.id, t.id, 'fortress');
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
  const targets = here.adj.filter((id) => c.territories[id].owner !== f.id).sort((a, b) => defence(c, a) - defence(c, b));
  const margin = [3, 2, 1][c.level];
  if (targets.length && strengthVs(army, defenders(c, targets[0])) >= defence(c, targets[0], army.units) + margin) {
    moveArmy(c, army.id, targets[0]);
    return false;
  }
  if (!targets.length) {
    // Deep in friendly land: walk towards the nearest border.
    const next = stepToBorder(c, f.id, army.at);
    if (next >= 0) { moveArmy(c, army.id, next); return false; }
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

export interface BattleConfig { seed: number; size: number; level: number; title: string; setups: PlayerSetup[]; humanAttacks: boolean }

/** Turn the pending battle into a real-time match: each side fields the troops it has on the map. */
export function battleConfig(c: Campaign): BattleConfig | null {
  const p = c.pending;
  if (!p) return null;
  const t = c.territories[p.to];
  const humanAttacks = p.attacker === 0;
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
  const myReserve = reserves(c, 0, p.to, p.armyId)[0];
  const foeReserve = foe < 0 ? undefined : reserves(c, foe, p.to, p.armyId)[0];
  const shade = (col: number, k: number) => [16, 8, 0].reduce((n, sh) => n | (Math.min(255, Math.round(((col >> sh) & 255) * k)) << sh), 0);
  return {
    seed: t.seed, size: 72, level: foe < 0 ? 0 : c.level, humanAttacks,
    title: humanAttacks ? `The assault on ${t.name}` : `The defence of ${t.name}`,
    setups: [
      { name: 'You', color: c.factions[0].color, isAI: false, team: 0, bonus: humanAttacks ? side(attackers, false, p.aStr) : side(defenders, true, p.dStr) },
      {
        name: foe < 0 ? LOCALS.name : c.factions[foe].name, color: foe < 0 ? LOCALS.color : c.factions[foe].color, isAI: true, team: 1,
        bonus: humanAttacks ? side(defenders, true, p.dStr) : side(attackers, false, p.aStr),
      },
      // The strongest army next door on each side joins the battle as an ally with its own camp.
      ...(foeReserve ? [{ name: `${c.factions[foe].name} reserve`, color: shade(c.factions[foe].color, 0.65), isAI: true, team: 1, bonus: side(foeReserve, false, armyStrength(foeReserve)) }] : []),
      ...(myReserve ? [{ name: 'Your reserve', color: shade(c.factions[0].color, 1.5), isAI: true, team: 0, bonus: side(myReserve, false, armyStrength(myReserve)) }] : []),
    ],
  };
}

/** Record the outcome of a battle the player fought in person. */
export function finishBattle(c: Campaign, playerWon: boolean): void {
  const p = c.pending;
  if (!p) return;
  const humanAttacks = p.attacker === 0;
  resolvePending(c, playerWon === humanAttacks ? 'attacker' : 'defender');
}
