/**
 * The map's side of the men who were in a town's training queues (queuedmen.ts has the whole account, and the
 * field's side): they are kept with the town's orders as the player leaves, and each goes out the season after as
 * the man of a company of his own kind.
 */
import type { Army, Campaign } from './campaign';
import { COMPANIES, MAX_ARMY, armyAt, armySize } from './campaignbase';
import { GROWN_SEASON, LAST_SEASON, agesOf } from './ageing';
import { musterMan } from './armytown';
import { QUEUED_MOST, QueuedMan } from './queuedmen';
import { Drilled, companyOf, drillTown } from './townmuster';
import { folkOf } from './township';

declare module './governor' {
  interface Orders {
    /** The men who were in the town's training queues as the player left, in the order they were called (queuedmen.ts). */
    men?: QueuedMan[];
  }
}
export const QUEUED = {
  /** The most men a town's orders remember. */
  most: QUEUED_MOST,
  /** How far a man's age on the town's record may stand from the age he should have reached and still be him (seasons): the record keeps whole seasons. */
  near: 1,
};
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[<>&"]/g, '').slice(0, 40) : '');

/** A list of queued men made safe to keep: whatever came back from the field is not believed blindly. */
export function cleanQueued(x: unknown): QueuedMan[] {
  if (!Array.isArray(x)) return [];
  const out: QueuedMan[] = [];
  for (const m of x) {
    if (!m || typeof m !== 'object') continue;
    const as = text((m as QueuedMan).as), name = text((m as QueuedMan).name), family = text((m as QueuedMan).family), seasons = Math.round(Number((m as QueuedMan).seasons));
    if (!as || !companyOf(as) || !name || !Number.isFinite(seasons)) continue;
    out.push({ as, name, ...(family ? { family } : {}), seasons: Math.max(GROWN_SEASON, Math.min(LAST_SEASON, seasons)) });
    if (out.length >= QUEUED.most) break;
  }
  return out;
}
/** The player has left a town: the men in its queues are written with its orders. Call it after the governor has kept the orders. */
export function keepQueued(c: Campaign, tid: number, men: unknown): QueuedMan[] {
  const t = c.territories[tid], kept = cleanQueued(men);
  if (!t) return [];
  if (!kept.length) { if (t.orders?.men) delete t.orders.men; return []; }
  t.orders ??= { turn: c.turn };
  t.orders.men = kept;
  return kept;
}
/** The men still waiting in a town's orders. */
export const queuedAt = (c: Campaign, tid: number): QueuedMan[] => c.territories[tid]?.orders?.men ?? [];

/** Where a queued man stands on his town's record now: the place in its men's ages of the one who is the age he should have reached, or -1. */
function placeOf(c: Campaign, tid: number, m: QueuedMan, taken: Set<number>): number {
  const t = c.territories[tid], should = m.seasons + Math.max(0, c.turn - (t.orders?.turn ?? c.turn));
  const ages = agesOf(c, tid, folkOf(c, tid)).m;
  let best = -1;
  for (let i = 0; i < ages.length; i++) {
    if (taken.has(i) || Math.abs(ages[i] - should) > QUEUED.near) continue;
    if (best < 0 || Math.abs(ages[i] - should) < Math.abs(ages[best] - should)) best = i;
  }
  return best;
}

/**
 * A season for the men in one town's queues: each who can goes out as the man of a company of his kind. Returns
 * the companies raised. Those who must wait (no yard for the kind, a foreign army in the town, the army full)
 * stay in the orders; those no longer in the town are struck off.
 */
export function drillQueued(c: Campaign, tid: number): Drilled[] {
  const t = c.territories[tid], men = queuedAt(c, tid), out: Drilled[] = [];
  if (!t || t.owner !== 0 || !men.length) return out;
  let a: Army | undefined = armyAt(c, tid);
  if ((a && a.owner !== t.owner) || c.pending?.to === tid) return out; // not with another people's army in the town
  const wait: QueuedMan[] = [], gone: QueuedMan[] = [];
  for (const m of men) {
    const kind = companyOf(m.as)!, needs = COMPANIES[kind].needs;
    const yard = t.buildings.includes(needs) || !!t.town?.b.some((x) => x[0] === needs && x[4] === undefined);
    if (!yard || (a && armySize(a) >= MAX_ARMY)) { wait.push(m); continue; }
    const at = placeOf(c, tid, m, new Set());
    if (at < 0) { gone.push(m); continue; }
    if (!a) { a = { id: c.nextArmy++, owner: t.owner, at: tid, units: {}, hero: false, vet: c.factions[t.owner].civ === 'japan' ? 1 : 0, moved: true }; c.armies.push(a); }
    a.units[kind] = (a.units[kind] ?? 0) + 1;
    musterMan(c, a, tid, at, { name: m.name, family: m.family });
    out.push({ at: tid, kind, men: 1, army: a.id });
    c.log.push(`${m.name}${m.family ? ` ${m.family}` : ''} of ${t.name}, who was training as a ${m.as} when you left, has taken the field: a company of ${COMPANIES[kind].name.toLowerCase()} ${armySize(a) > 1 ? 'joins the army there' : 'stands there'}.`);
  }
  for (const m of gone) c.log.push(`${m.name}${m.family ? ` ${m.family}` : ''} of ${t.name}, who was training as a ${m.as} when you left, is no longer in the town: nobody goes in his place.`);
  if (wait.length) t.orders!.men = wait; else delete t.orders!.men;
  return out;
}
/**
 * A season's training in every town of the player's: the men who were in its queues first, each as himself, and
 * the ordinary drill (townmuster.ts: a company a season of what it was last ordered to) for a town that sent none.
 */
export function drillWithQueued(c: Campaign): Drilled[] {
  const out: Drilled[] = [];
  if (!c.factions[0]?.alive) return out;
  for (const t of c.territories) {
    if (t.owner !== 0) continue;
    const own = drillQueued(c, t.id);
    out.push(...own);
    if (own.length || !t.orders?.train?.length) continue;
    const d = drillTown(c, t.id);
    if (d) out.push(d);
  }
  return out;
}
