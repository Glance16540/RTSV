/**
 * Armies belong to towns (docs/DESIGN.md). An army is the men of the town that raised it: when a company is
 * raised, men of working age leave the town's record and are carried on the army's roll (`Campaign.musters`),
 * town by town, each at his own age. The army's dead are those towns' dead: when companies are lost, men are
 * struck from the roll for good. When the army is sent home its men go back onto their towns' records, and a
 * soldier who made a name is one of the notable people of the town he came from.
 *
 * A company still marches if its town cannot man it in full: the shortfall are men of no town (see the board).
 */
import type { Army, Campaign } from './campaign';
import { agesOf, countFrom, OLD_SEASON, LAST_SEASON } from './ageing';
import { folkOf, rememberVeteran } from './township';

/**
 * Seasons an army rests in a town it has just taken before it marches again: it buries its dead, sets a watch
 * and brings the town to order. (It is what keeps a campaign from being a land a season.)
 */
export const ARMY_REST = 5;
/** Is this army still resting from its last assault as this turn begins? */
export const resting = (c: Campaign, a: Army): boolean => (a.rest ?? 0) >= c.turn;

/** Men in a company. */
export const MEN_A_COMPANY = 2;
/** An army's roll: how many companies it had when last reckoned, and the men with it by the town they came from (their ages, in seasons). */
export interface Muster { size: number; men: Record<string, number[]> }
/** Men of a town who fell with an army. */
export interface Fallen { town: number; army: number; dead: number; lost: boolean }

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const sizeOf = (a: Army): number => Object.values(a.units).reduce((n, v) => n + v, 0);
const rolls = (c: Campaign): Record<string, Muster> => (c.musters ??= {});
const total = (m: Muster): number => Object.values(m.men).reduce((n, l) => n + l.length, 0);

/** The roll of an army, if it has one. */
export const musterOf = (c: Campaign, armyId: number): Muster | undefined => c.musters?.[armyId];
/** How many of an army's men are of some town, and how many are of none. */
export function menOf(c: Campaign, a: Army): { town: number; none: number } {
  const town = musterOf(c, a.id) ? total(musterOf(c, a.id)!) : 0;
  return { town, none: Math.max(0, sizeOf(a) * MEN_A_COMPANY - town) };
}
/** Men of this town who are away with the armies. */
export const awayFrom = (c: Campaign, tid: number): number => Object.values(c.musters ?? {}).reduce((n, m) => n + (m.men[tid]?.length ?? 0), 0);
/** The town most of an army's men came from: where its veterans are remembered. */
export function homeOf(c: Campaign, a: Army): number | undefined {
  const m = musterOf(c, a.id);
  if (!m) return undefined;
  const best = Object.entries(m.men).filter(([, l]) => l.length).sort((p, q) => q[1].length - p[1].length || Number(p[0]) - Number(q[0]))[0];
  return best ? Number(best[0]) : undefined;
}

/**
 * A company has just been raised in this town and joined this army: its men are the town's. The youngest grown
 * men go, as many as a company takes or as the town has. Returns how many of the town's men went.
 */
export function menMustered(c: Campaign, a: Army, tid: number): number {
  const m = (rolls(c)[a.id] ??= { size: 0, men: {} });
  m.size = sizeOf(a);
  const t = c.territories[tid];
  if (!t || t.owner !== a.owner) return 0;
  const f = folkOf(c, tid), ages = agesOf(c, tid, f);
  const young = ages.m.map((s, i) => [s, i] as [number, number]).filter(([s]) => s < OLD_SEASON).sort((p, q) => p[0] - q[0] || p[1] - q[1]).slice(0, MEN_A_COMPANY);
  if (!young.length) return 0;
  const gone = new Set(young.map(([, i]) => i));
  (m.men[tid] ??= []).push(...young.map(([s]) => s));
  countFrom(f, { m: ages.m.filter((_, i) => !gone.has(i)), f: ages.f, k: ages.k });
  return young.length;
}
/** Two armies of one people have met and shared out their companies: their men are shared out the same way. */
export function armiesJoined(c: Campaign, a: Army, other: Army): void {
  const all = rolls(c), ma = all[a.id], mo = all[other.id];
  if (!ma && !mo) return;
  const sa = c.armies.includes(a) ? sizeOf(a) : 0, so = sizeOf(other);
  const pooled: Record<string, number[]> = {};
  for (const m of [mo, ma]) for (const [tid, l] of Object.entries(m?.men ?? {})) (pooled[tid] ??= []).push(...l);
  const to: Muster = { size: so, men: {} }, stay: Muster = { size: sa, men: {} };
  // The men go with the companies, in the share the companies went.
  for (const [tid, l] of Object.entries(pooled)) { const keep = sa + so ? Math.round((l.length * sa) / (sa + so)) : 0; if (keep) stay.men[tid] = l.slice(0, keep); if (l.length - keep) to.men[tid] = l.slice(keep); }
  all[other.id] = to;
  if (sa) all[a.id] = stay; else delete all[a.id];
}

/**
 * Count the armies against their rolls. Where an army has fewer companies than when it was last counted, men
 * are dead in that share, and an army that is gone has lost them all: they are struck from the roll, and that is
 * where a town's men at war are lost to it. Returns the dead by town, and says so in the log.
 */
export function reckonArmies(c: Campaign): Fallen[] {
  const out: Fallen[] = [], all = rolls(c);
  for (const [key, m] of Object.entries(all)) {
    const id = Number(key), a = c.armies.find((x) => x.id === id);
    const now = a ? sizeOf(a) : 0;
    if (now >= m.size) { m.size = now; continue; }
    const men = total(m), dead = a ? Math.min(men, Math.round((men * (m.size - now)) / m.size)) : men;
    // Who falls is drawn by lot from every man with the army, so each town bears its share.
    const pool = Object.entries(m.men).flatMap(([tid, l]) => l.map((_, i) => ({ tid, i, lot: hash(c.seed * 7 + id * 131 + Number(tid), c.turn * 31 + i) }))).sort((p, q) => p.lot - q.lot).slice(0, dead);
    const byTown: Record<string, Set<number>> = {};
    for (const p of pool) (byTown[p.tid] ??= new Set()).add(p.i);
    for (const [tid, gone] of Object.entries(byTown)) {
      m.men[tid] = m.men[tid].filter((_, i) => !gone.has(i));
      if (!m.men[tid].length) delete m.men[tid];
      const t = c.territories[Number(tid)];
      out.push({ town: Number(tid), army: id, dead: gone.size, lost: !a });
      if (t) c.log.push(`${gone.size} ${gone.size === 1 ? 'man' : 'men'} of ${t.name} ${a ? 'fell with the army' : 'did not come back: the army they marched with is no more'}.`);
    }
    if (a) m.size = now; else delete all[key];
  }
  return out;
}
/** A season passes for the men with the armies, as it does for those at home; then the armies are counted. */
export function seasonOfArmies(c: Campaign): Fallen[] {
  for (const m of Object.values(c.musters ?? {})) for (const tid of Object.keys(m.men)) m.men[tid] = m.men[tid].map((s) => Math.min(LAST_SEASON, s + 1));
  return reckonArmies(c);
}

/**
 * Send some of an army's companies home and keep the army: the most numerous kind first, never its last company.
 * The men of those companies go back onto their towns' records (or settle where the army stands, if their town is
 * no longer their people's). For an army that cannot be sent home whole: the leader's, or a nation's last.
 * Returns how many men went home, or -1 if it cannot be done.
 */
export function sendCompaniesHome(c: Campaign, armyId: number, companies: number): number {
  const a = c.armies.find((x) => x.id === armyId);
  if (!a || c.pending || c.territories[a.at]?.owner !== a.owner) return -1;
  reckonArmies(c);
  const before = sizeOf(a), go = Math.max(0, Math.min(before - 1, Math.floor(companies)));
  if (!go) return 0;
  for (let i = 0; i < go; i++) { const type = Object.keys(a.units).sort((p, q) => a.units[q] - a.units[p] || p.localeCompare(q))[0]; if (--a.units[type] <= 0) delete a.units[type]; }
  const m = musterOf(c, armyId);
  let n = 0;
  if (m) {
    // The men go with their companies, in the share the companies went, town by town.
    for (const key of Object.keys(m.men)) {
      const l = m.men[key], back = Math.round((l.length * go) / before);
      if (!back) continue;
      const tid = c.territories[Number(key)]?.owner === a.owner ? Number(key) : a.at;
      const f = folkOf(c, tid), ages = agesOf(c, tid, f);
      countFrom(f, { m: [...ages.m, ...l.splice(0, back)], f: ages.f, k: ages.k });
      if (!l.length) delete m.men[key];
      n += back;
    }
    m.size = sizeOf(a);
  }
  return n;
}

/** Can this army be sent home? It must stand in a town of its own people, with nothing waiting to be fought. */
export const canSendHome = (c: Campaign, armyId: number): boolean => {
  const a = c.armies.find((x) => x.id === armyId);
  return !!a && !c.pending && c.territories[a.at]?.owner === a.owner && !a.hero;
};
/**
 * Send an army home: it is no more, and its men go back onto the records of the towns they came from (or, where
 * a town is no longer their people's, settle in the town they stand in). A soldier who made a name is from now on
 * one of the notable people of the town most of them came from. Returns how many men went home.
 */
export function sendHome(c: Campaign, armyId: number): number {
  if (!canSendHome(c, armyId)) return -1;
  reckonArmies(c);
  const a = c.armies.find((x) => x.id === armyId)!, m = musterOf(c, armyId), home = homeOf(c, a);
  let n = 0;
  for (const [key, l] of Object.entries(m?.men ?? {})) {
    const tid = c.territories[Number(key)]?.owner === a.owner ? Number(key) : a.at;
    const f = folkOf(c, tid), ages = agesOf(c, tid, f);
    countFrom(f, { m: [...ages.m, ...l], f: ages.f, k: ages.k });
    n += l.length;
  }
  if (a.champion) rememberVeteran(c, home !== undefined && c.territories[home]?.owner === a.owner ? home : a.at, a.champion);
  delete rolls(c)[armyId];
  (c.homecoming ??= []).push(armyId); // sent home, not lost (rivalrule.ts keeps its named soldier living)
  c.armies.splice(c.armies.indexOf(a), 1);
  c.log.push(`${a.owner === 0 ? 'Your army' : 'An army'} at ${c.territories[a.at].name} has been sent home${n ? `: ${n} ${n === 1 ? 'man goes' : 'men go'} back to ${n === 1 ? 'his own town' : 'their own towns'}` : ''}.`);
  return n;
}
