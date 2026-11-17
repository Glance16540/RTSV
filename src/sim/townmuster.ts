/**
 * A town left to itself keeps training what it was last ordered to (docs/DESIGN.md, "A town left to itself").
 * governor.ts writes the order down (`Orders.train`: the kinds of soldier in its queues as the player left); this
 * is what acts on it. Each season a town of the player's with such an order raises one company of the first kind
 * it can: out of its own men, as armytown.ts takes them (the youngest first, never below `MEN.floor` or the
 * husbands `MEN.couples` keeps), and out of its own stores, never below what the governor keeps (`GOVERN.floor`).
 * The company joins the army standing in the town, or forms one there; its men stay tied to the town on the
 * army's roll, and come home to it. It stops when the army there is `DRILL.most` companies, when food is short,
 * or when another people's army stands in the town. Rivals' towns raise by their own rule (rivalrule.ts).
 */
import type { Army, Campaign, Territory } from './campaign';
import { hireOff } from './places';
import { COMPANIES, MAX_ARMY, armyAt, armySize, companyCost } from './campaignbase';
import { BUILDINGS } from './data';
import { MEN, menMustered } from './armytown';
import { GOVERN, wantsOf } from './governor';
import { SUPPLY_UNITS } from './stores';
import { STORE_KINDS, Stores, folkOf } from './township';

export const DRILL = {
  /** The governor raises no more once the army standing in the town is this many companies. */
  most: 4,
  /** Companies a town raises in a season, at the most. */
  season: 1,
};
const units = (s: Stores): number => STORE_KINDS.reduce((n, k) => n + Math.max(0, s[k]), 0);

/** The company a kind of soldier belongs to: the one that fields his kind (a clubman is infantry, a slinger archers, a rider cavalry), else by the building that trains him. */
export function companyOf(unit: string): string | undefined {
  if (COMPANIES[unit]) return unit;
  // The kind a company fields is that company whatever yard trained him: a slinger is of the archers, though a Barracks trains slingers.
  const fielded = Object.keys(COMPANIES).find((k) => unit in COMPANIES[k].units);
  return fielded ?? Object.keys(COMPANIES).find((k) => BUILDINGS[COMPANIES[k].needs]?.trains.includes(unit));
}
/** Whether the town has the building a company needs: on the map's record, or standing finished in the town itself. */
const hasYard = (t: Territory, kind: string): boolean => {
  const needs = COMPANIES[kind].needs;
  return t.buildings.includes(needs) || !!t.town?.b.some((x) => x[0] === needs && x[4] === undefined);
};
/** Men the town can send without going below what it keeps (armytown.ts). */
export function menToSpare(c: Campaign, tid: number): number {
  const f = folkOf(c, tid);
  return Math.max(0, f.men - Math.max(MEN.floor, Math.ceil(f.women * MEN.couples)));
}
/** What a company costs the town, in goods out of its own stores. */
export const goodsFor = (c: Campaign, tid: number, kind: string): number =>
  companyCost(c.territories[tid], kind, c.factions[c.territories[tid].owner].civ, hireOff(c, c.territories[tid].owner, tid)) * SUPPLY_UNITS;

/** Why a town is not training this season, or the company it would raise. */
export function drillOf(c: Campaign, tid: number): { kind?: string; why?: 'none' | 'yard' | 'army' | 'full' | 'food' | 'men' | 'stores' } {
  const t = c.territories[tid];
  const kinds = [...new Set((t?.orders?.train ?? []).map(companyOf).filter((k): k is string => !!k))];
  if (!t || t.owner !== 0 || !kinds.length) return { why: 'none' };
  const yards = kinds.filter((k) => hasYard(t, k));
  if (!yards.length) return { why: 'yard' };
  const a = armyAt(c, tid);
  if ((a && a.owner !== t.owner) || c.pending?.to === tid) return { why: 'army' };
  if (a && armySize(a) >= Math.min(DRILL.most, MAX_ARMY)) return { why: 'full' };
  if (wantsOf(c, tid).food) return { why: 'food' };
  if (menToSpare(c, tid) < MEN.company) return { why: 'men' };
  const have = units(folkOf(c, tid).stores);
  const kind = yards.find((k) => have - goodsFor(c, tid, k) >= GOVERN.floor);
  return kind ? { kind } : { why: 'stores' };
}

export interface Drilled { at: number; kind: string; men: number; army: number }
/** A season's training in one town: one company of what it was last ordered to, if it can. */
export function drillTown(c: Campaign, tid: number): Drilled | null {
  const { kind } = drillOf(c, tid);
  if (!kind) return null;
  const t = c.territories[tid], f = folkOf(c, tid);
  let a: Army | undefined = armyAt(c, tid);
  const fresh = !a;
  if (!a) {
    a = { id: c.nextArmy++, owner: t.owner, at: tid, units: {}, hero: false, vet: c.factions[t.owner].civ === 'japan' ? 1 : 0, moved: true }; // fresh troops march next turn
    c.armies.push(a);
  }
  a.units[kind] = (a.units[kind] ?? 0) + 1;
  const men = menMustered(c, a, tid);
  if (!men) { // nobody of an age to go: nothing is raised and nothing spent
    a.units[kind]--;
    if (!a.units[kind]) delete a.units[kind];
    if (fresh) { c.armies.splice(c.armies.indexOf(a), 1); delete c.musters?.[a.id]; } else if (c.musters?.[a.id]) c.musters[a.id].size = armySize(a);
    return null;
  }
  // Paid out of the town's own stores, its bread last.
  let left = goodsFor(c, tid, kind);
  for (const k of [...STORE_KINDS].filter((x) => x !== 'food').sort((x, y) => f.stores[y] - f.stores[x])) { const part = Math.min(Math.max(0, f.stores[k]), left); f.stores[k] -= part; left -= part; }
  if (left > 0) f.stores.food = Math.max(0, f.stores.food - left);
  c.log.push(`${t.name} has raised a company of ${COMPANIES[kind].name.toLowerCase()}, as it was last ordered to: ${men} of its men have gone, paid for out of its own stores.`);
  return { at: tid, kind, men, army: a.id };
}
/** A season's training in every town of the player's that was left with an order to train. */
export function drillTowns(c: Campaign): Drilled[] {
  const out: Drilled[] = [];
  if (!c.factions[0]?.alive) return out;
  for (const t of c.territories) {
    if (t.owner !== 0 || !t.orders?.train?.length) continue;
    for (let i = 0; i < DRILL.season; i++) { const d = drillTown(c, t.id); if (d) out.push(d); else break; }
  }
  return out;
}
/** Why a town with an order to train is not training, in words; nothing if it is, or has no such order. */
export function drillText(c: Campaign, tid: number): string {
  const { kind, why } = drillOf(c, tid);
  if (kind) return `It raises a company of ${COMPANIES[kind].name.toLowerCase()} each season while it has men and stores to spare.`;
  return why === 'yard' ? 'It was training, but has no yard to raise a company in.'
    : why === 'full' ? `It raises no more: the army there is ${DRILL.most} companies.`
    : why === 'food' ? 'It raises nobody while food is short.'
    : why === 'men' ? 'It has no men to spare for a company.'
    : why === 'stores' ? 'Its stores are too low to raise a company.'
    : why === 'army' ? 'It raises nobody with another army in the town.' : '';
}
