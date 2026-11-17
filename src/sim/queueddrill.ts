/**
 * The map's side of the men who were in a town's training queues (queuedmen.ts has the whole account, and the
 * field's side): they are kept with the town's orders as the player leaves, and go out the season after, the men of
 * a kind together, `MEN.company` of them to a company (armytown.ts: two men in towns of the old size, one now).
 * A man queued for what is no company on the map (a healer, an engine's crew) is kept too: he becomes what he was
 * training for on his town's record if it has a place for it (`RECORD_PLACES`), and is otherwise a townsman again,
 * and the log says so.
 */
import type { Army, Campaign } from './campaign';
import { COMPANIES, MAX_ARMY, armyAt, armySize } from './campaignbase';
import { UNITS } from './data';
import { GROWN_SEASON, LAST_SEASON, agesOf } from './ageing';
import { MEN, musterMan } from './armytown';
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
/**
 * What a town's record can make of a man queued for what is no company on the map, by what he was training as: a
 * place on the record, returning whether he took it. None yet: a town's record keeps its people, its veterans and its
 * mothers, and has no place for a healer or an engine's crew, so such a man is a townsman again.
 */
export const RECORD_PLACES: Record<string, (c: Campaign, tid: number, m: QueuedMan) => boolean> = {};

/** A list of queued men made safe to keep: whatever came back from the field is not believed blindly. */
export function cleanQueued(x: unknown): QueuedMan[] {
  if (!Array.isArray(x)) return [];
  const out: QueuedMan[] = [];
  for (const m of x) {
    if (!m || typeof m !== 'object') continue;
    const as = text((m as QueuedMan).as), name = text((m as QueuedMan).name), family = text((m as QueuedMan).family), seasons = Math.round(Number((m as QueuedMan).seasons));
    if (!as || !(companyOf(as) || UNITS[as]) || !name || !Number.isFinite(seasons)) continue; // a man queued for what is no company on the map, but is a unit of the game, is kept too (drillQueued)
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
 * A season for the men in one town's queues. The men of a kind go out together, `MEN.company` of them to a company of
 * their kind, each that same man taken off the town's record and on the army's roll and his house's record as away
 * with it; fewer than a company of a kind wait for more. Returns the companies raised. Those who must wait (no yard
 * for the kind, a foreign army in the town, the army full, not yet a company of them) stay in the orders; those no
 * longer in the town are struck off; a man queued for what is no company on the map takes his place on the town's
 * record if it has one for him, or is a townsman again.
 */
export function drillQueued(c: Campaign, tid: number): Drilled[] {
  const t = c.territories[tid], men = queuedAt(c, tid), out: Drilled[] = [];
  if (!t || t.owner !== 0 || !men.length) return out;
  let a: Army | undefined = armyAt(c, tid);
  if ((a && a.owner !== t.owner) || c.pending?.to === tid) return out; // not with another people's army in the town
  const who = (m: QueuedMan): string => `${m.name}${m.family ? ` ${m.family}` : ''}`;
  const wait: QueuedMan[] = [], gone: QueuedMan[] = [], byKind = new Map<string, QueuedMan[]>();
  for (const m of men) {
    const kind = companyOf(m.as);
    if (!kind) {
      // No company on the map: a place on the record, or a townsman again. He never left the town.
      if (placeOf(c, tid, m, new Set()) < 0) { gone.push(m); continue; }
      const placed = RECORD_PLACES[m.as]?.(c, tid, m) ?? false;
      c.log.push(placed ? `${who(m)} of ${t.name}, who was training as a ${m.as} when you left, has taken his place in the town.` : `${who(m)} of ${t.name} was training as a ${m.as} when you left: there is no company of them on the map, and he is a townsman again.`);
      continue;
    }
    (byKind.get(kind) ?? byKind.set(kind, []).get(kind)!).push(m);
  }
  for (const [kind, list] of byKind) {
    const needs = COMPANIES[kind].needs, yard = t.buildings.includes(needs) || !!t.town?.b.some((x) => x[0] === needs && x[4] === undefined);
    // Who of them is still in the town, by his place on the record.
    const taken = new Set<number>(), here: QueuedMan[] = [];
    for (const m of list) { const at = placeOf(c, tid, m, taken); if (at < 0) gone.push(m); else { taken.add(at); here.push(m); } }
    let left = here;
    while (yard && left.length >= MEN.company && !(a && armySize(a) >= MAX_ARMY)) {
      const band = left.slice(0, MEN.company);
      left = left.slice(MEN.company);
      if (!a) { a = { id: c.nextArmy++, owner: t.owner, at: tid, units: {}, hero: false, vet: c.factions[t.owner].civ === 'japan' ? 1 : 0, moved: true }; c.armies.push(a); }
      a.units[kind] = (a.units[kind] ?? 0) + 1;
      for (const m of band) musterMan(c, a, tid, placeOf(c, tid, m, new Set()), { name: m.name, family: m.family }); // each found afresh: the record shortens as each goes
      out.push({ at: tid, kind, men: band.length, army: a.id });
      const names = band.map(who), them = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
      c.log.push(`${them} of ${t.name}, who ${band.length > 1 ? 'were' : 'was'} training as ${band.length > 1 ? `${band[0].as}s` : `a ${band[0].as}`} when you left, ${band.length > 1 ? 'have' : 'has'} taken the field: a company of ${COMPANIES[kind].name.toLowerCase()} ${armySize(a) > 1 ? 'joins the army there' : 'stands in the town'}.`);
    }
    wait.push(...left);
  }
  for (const m of gone) c.log.push(`${who(m)} of ${t.name}, who was training as a ${m.as} when you left, is no longer in the town: nobody goes in his place.`);
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
