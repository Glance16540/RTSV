// Conquest mode: a turn-based strategic map layered over the real-time battles.
// Pure rules, no DOM, so it can be tested headless.

import type { PlayerSetup } from './game';

export const MAP_W = 1000;
export const MAP_H = 600;
export const CAMPAIGN_VERSION = 1;

export const RECRUIT_COST = 6;
export const RECRUIT_SIZE = 3;
export const REINFORCE_COST = 2;
export const MAX_ARMY = 12;
export const MAX_DEV = 3;
export const developCost = (dev: number) => 3 * (dev + 1);

export interface Faction { id: number; name: string; color: number; isAI: boolean; supplies: number; alive: boolean }

export interface Territory {
  id: number;
  name: string;
  x: number;
  y: number;
  owner: number; // faction id, or -1 for independent locals
  capital: number; // faction whose capital this is, or -1
  dev: number; // development 0..3: more income, stronger defence
  militia: number; // defenders of an independent territory
  adj: number[];
  seed: number; // battles here are always fought on the same ground
}

export interface Army { id: number; owner: number; at: number; size: number; moved: boolean }

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
        dev: rand(c) < 0.35 ? 1 : 0, militia: 1 + Math.floor(rand(c) * 3), seed: 1 + Math.floor(rand(c) * 1e6),
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
    c.factions.push({ id: f, name: FACTIONS[f][0], color: FACTIONS[f][1], isAI: f > 0, supplies: 6, alive: true });
    const t = c.territories[homes[f]];
    t.owner = f;
    t.capital = f;
    t.dev = 2;
    c.armies.push({ id: c.nextArmy++, owner: f, at: t.id, size: RECRUIT_SIZE, moved: false });
  }
  c.log.push('Turn 1. Your people look beyond their borders.');
  return c;
}

// ---- Queries ----

export const armyAt = (c: Campaign, tid: number): Army | undefined => c.armies.find((a) => a.at === tid);

export function income(c: Campaign, f: number): number {
  let n = 0;
  for (const t of c.territories) if (t.owner === f) n += 2 + t.dev + (t.capital === f ? 2 : 0);
  return n;
}

/** Everything that defends a territory: its army plus its walls and people. */
export function defence(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (t.owner < 0) return t.militia;
  const a = armyAt(c, tid);
  return (a && a.owner === t.owner ? a.size : 0) + 1 + t.dev;
}

export function canRecruit(c: Campaign, f: number, tid: number): boolean {
  const t = c.territories[tid];
  return t.owner === f && (t.capital === f || t.dev >= 2) && !armyAt(c, tid) && c.factions[f].supplies >= RECRUIT_COST;
}
export function canReinforce(c: Campaign, f: number, tid: number): boolean {
  const a = armyAt(c, tid);
  return !!a && a.owner === f && c.territories[tid].owner === f && a.size < MAX_ARMY && c.factions[f].supplies >= REINFORCE_COST;
}
export function canDevelop(c: Campaign, f: number, tid: number): boolean {
  const t = c.territories[tid];
  return t.owner === f && t.dev < MAX_DEV && c.factions[f].supplies >= developCost(t.dev);
}

// ---- Actions ----

export function recruit(c: Campaign, f: number, tid: number): boolean {
  if (!canRecruit(c, f, tid)) return false;
  c.factions[f].supplies -= RECRUIT_COST;
  c.armies.push({ id: c.nextArmy++, owner: f, at: tid, size: RECRUIT_SIZE, moved: true });
  return true;
}
export function reinforce(c: Campaign, f: number, tid: number): boolean {
  if (!canReinforce(c, f, tid)) return false;
  c.factions[f].supplies -= REINFORCE_COST;
  armyAt(c, tid)!.size++;
  return true;
}
export function develop(c: Campaign, f: number, tid: number): boolean {
  if (!canDevelop(c, f, tid)) return false;
  c.factions[f].supplies -= developCost(c.territories[tid].dev);
  c.territories[tid].dev++;
  return true;
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
      // Two friendly armies become one; anyone over the limit stays behind.
      const total = Math.min(MAX_ARMY, a.size + other.size);
      const left = a.size + other.size - total;
      other.size = total;
      if (left > 0) a.size = left;
      else c.armies.splice(c.armies.indexOf(a), 1);
    } else a.at = to;
    return 'moved';
  }
  c.pending = { armyId, from: a.at, to, attacker: a.owner, defender: t.owner, aStr: a.size, dStr: defence(c, to) };
  const human = (f: number) => f >= 0 && !c.factions[f].isAI;
  if (!human(a.owner) && !human(t.owner)) resolvePending(c, 'auto');
  return 'battle';
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
    if (defArmy) c.armies.splice(c.armies.indexOf(defArmy), 1);
    if (army) {
      army.size = Math.max(1, army.size - Math.ceil(p.dStr * 0.4));
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
    t.dev = Math.max(0, t.dev - 1);
  } else {
    if (army) c.armies.splice(c.armies.indexOf(army), 1);
    if (defArmy) defArmy.size = Math.max(1, defArmy.size - Math.ceil(p.aStr * 0.3));
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
      return;
    }
    if (f.alive && !aiStep(c, f)) continue; // aiStep returns false while the faction still has moves
    c.cursor++;
    c.spent = false;
  }
}

/** One decision for an AI faction. Returns true once it has nothing left to do this turn. */
function aiStep(c: Campaign, f: Faction): boolean {
  if (!c.spent) {
    c.spent = true;
    for (const t of c.territories) if (canRecruit(c, f.id, t.id) && (t.capital === f.id || rand(c) < 0.5)) recruit(c, f.id, t.id);
    const mine = c.armies.filter((a) => a.owner === f.id).sort((a, b) => b.size - a.size);
    for (const a of mine) while (a.size < 9 && reinforce(c, f.id, a.at)) { /* keep growing the army */ }
    for (const t of c.territories) if (rand(c) < 0.4 && canDevelop(c, f.id, t.id)) develop(c, f.id, t.id);
    return false;
  }
  const army = c.armies.find((a) => a.owner === f.id && !a.moved);
  if (!army) return true;
  const here = c.territories[army.at];
  const targets = here.adj.filter((id) => c.territories[id].owner !== f.id).sort((a, b) => defence(c, a) - defence(c, b));
  const margin = [2, 1, 0][c.level];
  if (targets.length && army.size >= defence(c, targets[0]) + margin) {
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

/** Turn the pending battle into a real-time match: bigger armies and built-up land start stronger. */
export function battleConfig(c: Campaign): BattleConfig | null {
  const p = c.pending;
  if (!p) return null;
  const t = c.territories[p.to];
  const humanAttacks = p.attacker === 0;
  const foe = humanAttacks ? p.defender : p.attacker;
  const side = (str: number, defending: boolean) => ({
    units: { clubman: str, slinger: Math.ceil(str / 2) },
    res: 40 * str + (defending ? 80 * t.dev : 0),
    age: defending && t.dev >= 3 ? 1 : 0,
  });
  return {
    seed: t.seed, size: 72, level: foe < 0 ? 0 : c.level, humanAttacks,
    title: humanAttacks ? `The assault on ${t.name}` : `The defence of ${t.name}`,
    setups: [
      { name: 'You', color: c.factions[0].color, isAI: false, bonus: side(humanAttacks ? p.aStr : p.dStr, !humanAttacks) },
      { name: foe < 0 ? LOCALS.name : c.factions[foe].name, color: foe < 0 ? LOCALS.color : c.factions[foe].color, isAI: true, bonus: side(humanAttacks ? p.dStr : p.aStr, humanAttacks) },
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
