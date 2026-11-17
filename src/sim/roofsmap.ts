/**
 * Every household under its roof, on the map's side (roofs.ts has the whole account, and the field's side).
 *
 *   - `roofsFor`: what the map hands the field as a battle for a town or a visit to it begins: the households kept from
 *     the last sitting, each a season older for every season since; how many couples the town has married
 *     (marriage.ts); and the houses whose men are away with the armies (warhouse.ts), so that each has its own door.
 *   - `keepRoofs`: when the sitting ends, who lived where is written on the town's record (`Folk.households`), made safe.
 *
 * Between sittings the record is only kept: the town's people are counts on the map (township.ts), and whoever of a
 * household has died or gone is simply not found at the next sitting, when another of the town's people takes the roof.
 */
import type { Campaign } from './campaign';
import { BUILDINGS } from './data';
import { wedOf } from './marriage';
import type { Roof, RoofsIn, Tenant } from './roofs';
import { awayMen } from './warhouse';

declare module './township' {
  interface Folk {
    /** Who lived under each roof as the last battle or visit here ended, and the turn it was (roofsmap.ts). */
    households?: { turn: number; list: Roof[] };
  }
  interface Census {
    /** Who lived under each roof as the battle or visit ended (roofs.ts `roofsOf`). */
    roofs?: Roof[];
  }
}

/** The most households a town's record keeps (as many as it keeps buildings). */
export const MAX_ROOFS = 240;
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[<>&"`\u0000-\u001f]/g, '').slice(0, 40) : '');
const tenant = (x: unknown): Tenant | undefined => {
  const t = x as Tenant | undefined, name = text(t?.name), seasons = Math.round(Number(t?.seasons));
  return name && Number.isFinite(seasons) ? { name, seasons: Math.max(0, Math.min(400, seasons)) } : undefined;
};

/** A list of households made safe, whatever was handed in. */
export function cleanRoofs(x: unknown): Roof[] {
  const out: Roof[] = [];
  if (!Array.isArray(x)) return out;
  for (const r of x as Roof[]) {
    if (!r || !Array.isArray(r.at) || !Number.isInteger(r.at[0]) || !Number.isInteger(r.at[1]) || r.at[0] < 0 || r.at[1] < 0) continue;
    const m = tenant(r.m), f = tenant(r.f), family = text(r.family);
    if (!m && !f) continue;
    out.push({ at: [r.at[0], r.at[1]], ...(family ? { family } : {}), ...(m ? { m } : {}), ...(f ? { f } : {}) });
    if (out.length >= MAX_ROOFS) break;
  }
  return out;
}

/** What the field is handed for this town: its households kept, its married couples, and whose men are away. */
export function roofsFor(c: Campaign, tid: number): RoofsIn | undefined {
  const t = c.territories[tid], f = t?.folk;
  if (!t || !f) return undefined;
  const since = Math.max(0, c.turn - (f.households?.turn ?? c.turn));
  const stands = new Set((t.town?.b ?? []).filter((b) => b[0] === 'house' && BUILDINGS.house && b[4] === undefined).map((b) => `${b[1]},${b[2]}`));
  const older = (x: Tenant | undefined): Tenant | undefined => (x ? { name: x.name, seasons: x.seasons + since } : undefined);
  const kept = cleanRoofs(f.households?.list).filter((r) => stands.has(`${r.at[0]},${r.at[1]}`))
    .map((r): Roof => ({ at: r.at, ...(r.family ? { family: r.family } : {}), ...(r.m ? { m: older(r.m) } : {}), ...(r.f ? { f: older(r.f) } : {}) }));
  return { ...(kept.length ? { kept } : {}), wed: wedOf(f), away: awayMen(c, tid).map((m) => ({ family: m.family, husband: m.as === 'husband' })) };
}

/** Write down who lived where as a sitting ended. Nothing handed in (an old report) leaves the record as it was. */
export function keepRoofs(c: Campaign, tid: number, x: unknown): number {
  const f = c.territories[tid]?.folk;
  if (!f || !Array.isArray(x)) return 0;
  const list = cleanRoofs(x);
  if (list.length) f.households = { turn: c.turn, list }; else delete f.households;
  return list.length;
}
