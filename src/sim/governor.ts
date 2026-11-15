/**
 * A town left to itself (docs/DESIGN.md). It carries on with the last orders it was given: where its people
 * work, what was being built, what was being trained. Those are written down when the player leaves a battle or
 * a visit there (`Game.orders`). Season by season its people work as they were set to, what was left
 * half built is finished, and a governor fills the gaps sensibly: Farmland (and hands to the fields) when food
 * runs short, a house when couples have no roof, a Fortress when the town has been raided. He spends only what
 * the town itself holds in store. Every town on the map is kept so, the player's and a rival's alike.
 *
 * Where the people work decides what the town's yield is made of; it is earned once, when the season turns, by
 * harvest.ts, which sets how much from the land, its farms and its hands and splits it by `shareOf` here. A town
 * eats once, in larder.ts. The governor neither earns nor feeds: he sets the work, finishes and begins.
 */
import type { Campaign, Territory } from './campaign';
import { siteCost, slots } from './campaign';
import { BUILDINGS } from './data';
import { STORE_KINDS, Stores, folkOf, headcount } from './township';
import { couplesOf, housesOf, roomOf } from './seasonfolk';
import { KEEP_SEASONS, needOf } from './larder';

/** The last orders a town was given. `work`: how many of its people were at each kind of work. `turn`: when they were given. */
export interface Orders { work?: Stores; build?: string[]; train?: string[]; turn: number }
export const GOVERN = {
  /** Where a town's people work when nobody has said: shares of its working people by what they bring in. */
  work: { food: 0.5, wood: 0.25, gold: 0.125, stone: 0.125 } as Stores,
  /** What one person brings in at each kind of work, against the others: it weighs how a town's yield splits (harvest.ts). */
  yield: { food: 4, wood: 2, gold: 2, stone: 2 } as Stores,
  /** Farmland makes the fields bring in this much as much. */
  farm: 2.5,
  /** Food in store per head under which a town is short, and the share of its people the governor then sends to the fields. */
  short: 15, fields: 0.6,
  /** With a full granary and no orders, the share of the usual hands kept at the fields. */
  full: 0.5,
  /** How much of a building a season's work finishes. */
  build: 0.34,
  /** What a town keeps in store whatever the governor builds, and what he holds back of each kind when he pays for a house. */
  floor: 300, spare: 50,
  /** Seasons after a raid in which the town still wants a wall. */
  raided: 4,
};
const RAIDS = ['raid', 'carried', 'raiders', 'taken', 'overrun'];
const units = (s: Stores): number => STORE_KINDS.reduce((n, k) => n + Math.max(0, s[k]), 0);
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/[^a-z0-9_]/gi, '').slice(0, 30) : '');

/** Make safe the orders handed back from a battle or a visit. Nothing if there are none worth keeping. */
export function cleanOrders(x: Partial<Orders> | null | undefined, turn: number): Orders | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const w = x.work && typeof x.work === 'object' ? x.work : undefined;
  const work = w ? { food: 0, wood: 0, gold: 0, stone: 0 } as Stores : undefined;
  if (work) for (const k of STORE_KINDS) work[k] = Math.max(0, Math.min(200, Math.round(Number(w![k]) || 0)));
  const list = (l: unknown): string[] => [...new Set((Array.isArray(l) ? l : []).map(text).filter(Boolean))].slice(0, 12);
  const build = list(x.build).filter((b) => !!BUILDINGS[b]), train = list(x.train);
  if (!(work && units(work)) && !build.length && !train.length) return undefined;
  return { ...(work && units(work) ? { work } : {}), ...(build.length ? { build } : {}), ...(train.length ? { train } : {}), turn };
}
/** The player has left a town: what it was doing as they left is what it goes on doing. */
export function keepOrders(c: Campaign, tid: number, x: Partial<Orders> | null | undefined): Orders | undefined {
  const t = c.territories[tid], kept = cleanOrders(x, c.turn);
  if (t && kept) t.orders = kept;
  return kept;
}
/** Where a town's people work, as shares that add to one: by its last orders, or as a governor would set them. */
export function workOf(t: Territory): Stores {
  const w = t.orders?.work, all = w ? units(w) : 0;
  if (!w || !all) return { ...GOVERN.work };
  return { food: w.food / all, wood: w.wood / all, gold: w.gold / all, stone: w.stone / all };
}

/** What a town is in want of, as a governor sees it. */
export function wantsOf(c: Campaign, tid: number): { food: boolean; roof: boolean; wall: boolean } {
  const t = c.territories[tid], f = folkOf(c, tid);
  const roofs = housesOf(t);
  const roof = roofs !== null && (couplesOf(t, f) < Math.min(f.men, f.women) || headcount(f) >= roomOf(t));
  const raided = (c.events ?? []).some((e) => e.at === tid && RAIDS.includes(e.kind) && e.turn > c.turn - GOVERN.raided);
  return { food: f.stores.food / Math.max(1, headcount(f)) < GOVERN.short, roof, wall: raided && !t.buildings.includes('fortress') };
}

/** A free place for a building on a town's record: the nearest to its hall that touches nothing already standing. */
export function plotFor(t: Territory, type: string): { cx: number; cy: number } | null {
  const def = BUILDINGS[type], b = t.town?.b ?? [];
  const hall = b.find((x) => x[0] === 'towncenter') ?? b[0];
  if (!def || !hall) return null;
  const hits = (cx: number, cy: number): boolean => b.some((x) => { const s = BUILDINGS[x[0]]?.size ?? 2; return cx < x[1] + s + 1 && cx + def.size + 1 > x[1] && cy < x[2] + s + 1 && cy + def.size + 1 > x[2]; });
  for (let r = 3; r <= 12; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = hall[1] + dx, cy = hall[2] + dy;
        if (cx < 6 || cy < 6 || cx > 60 || cy > 60 || hits(cx, cy)) continue;
        return { cx, cy };
      }
  return null;
}

/**
 * Where a town's people work this season, as shares that add to one: by its last orders, unless food is short,
 * when the governor sends GOVERN.fields of them to the fields whatever the orders were. `fields`: he has.
 */
export function shareOf(c: Campaign, tid: number): { share: Stores; fields: boolean } {
  const t = c.territories[tid], share = workOf(t);
  // A full granary, and nobody's orders: the governor sends hands from the fields to work that keeps (larder.ts spoils food beyond what keeps).
  if (!t.orders?.work && folkOf(c, tid).stores.food >= KEEP_SEASONS * needOf(c, tid) && needOf(c, tid) > 0) {
    const was = share.food, now = was * GOVERN.full, rest = 1 - was || 1;
    for (const k of STORE_KINDS) if (k !== 'food') share[k] = (share[k] / rest) * (1 - now);
    share.food = now;
    return { share, fields: false };
  }
  if (!(wantsOf(c, tid).food && share.food < GOVERN.fields)) return { share, fields: false };
  const rest = 1 - share.food || 1;
  for (const k of STORE_KINDS) if (k !== 'food') share[k] = (share[k] / rest) * (1 - GOVERN.fields);
  share.food = GOVERN.fields;
  return { share, fields: true };
}

export interface Governed { at: number; fields: boolean; finished: string[]; began?: string }
/**
 * A season in one town left to itself: its people are set to their work (what it brings in is harvest.ts's, what
 * they eat larder.ts's); what stood half built is taken further; and where the town is in want the governor
 * answers, one thing a season, out of its own stores.
 */
export function governTown(c: Campaign, tid: number): Governed | null {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde) return null;
  const f = folkOf(c, tid), want = wantsOf(c, tid), mine = t.owner === 0;
  // Short of food, the governor sends hands to the fields whatever the orders were (shareOf): next season's yield is the more food for it.
  const out: Governed = { at: tid, fields: shareOf(c, tid).fields, finished: [] };
  // What was left half built is taken further.
  if (t.town?.b) t.town.b = t.town.b.map((x) => {
    if (x[4] === undefined) return x;
    const done = Math.round((x[4] + GOVERN.build) * 100) / 100;
    if (done < 1) return [x[0], x[1], x[2], x[3] ?? 0.01, done] as typeof x;
    out.finished.push(x[0]);
    return (x[3] !== undefined && x[3] < 1 && x[3] > 0.01 ? [x[0], x[1], x[2], x[3]] : [x[0], x[1], x[2]]) as typeof x;
  });
  // One thing a season, by need: bread first, then a roof, then a wall.
  const civ = c.factions[t.owner].civ, room = t.buildings.length < slots(t);
  const afford = (site: string): boolean => units(f.stores) - siteCost(t, site, civ) * 100 >= GOVERN.floor;
  const pay = (goods: number): void => { let left = goods; for (const k of [...STORE_KINDS].sort((a, b) => f.stores[b] - f.stores[a])) { const part = Math.min(f.stores[k], k === 'food' ? 0 : left); f.stores[k] -= part; left -= part; } if (left > 0) f.stores.food = Math.max(0, f.stores.food - left); };
  if (want.food && !t.buildings.includes('farm') && room && afford('farm')) { pay(siteCost(t, 'farm', civ) * 100); t.buildings.push('farm'); out.began = 'farm'; }
  else if (want.roof && !t.town!.b.some((x) => x[0] === 'house' && x[4] !== undefined)) {
    const cost = BUILDINGS.house.cost, at = plotFor(t, 'house');
    if (at && STORE_KINDS.every((k) => f.stores[k] >= (cost[k] ?? 0) + GOVERN.spare)) {
      for (const k of STORE_KINDS) f.stores[k] -= cost[k] ?? 0;
      t.town!.b.push(['house', at.cx, at.cy, 0.01, 0]); out.began = 'house';
    }
  } else if (want.wall && room && afford('fortress')) { pay(siteCost(t, 'fortress', civ) * 100); t.buildings.push('fortress'); out.began = 'fortress'; }
  if (mine && out.began) c.log.push(out.began === 'house' ? `The governor of ${t.name} has begun a house: there are couples there with no roof.` : `The governor of ${t.name} has raised ${out.began === 'farm' ? 'Farmland: food was running short' : 'a Fortress: the town was raided'}, out of the town's own stores.`);
  if (mine && out.finished.length) c.log.push(`${out.finished.map((b) => `The ${BUILDINGS[b]?.name.toLowerCase() ?? b}`).join(' and ')} begun at ${t.name} ${out.finished.length === 1 ? 'is' : 'are'} finished.`);
  if (mine && out.fields) c.log.push(`Food is short at ${t.name}: the governor has sent more of its people to the fields.`);
  return out;
}
/** A season of governing in every held town. */
export function governTowns(c: Campaign): Governed[] {
  const out: Governed[] = [];
  for (const t of c.territories) { const g = c.factions[t.owner]?.alive ? governTown(c, t.id) : null; if (g) out.push(g); }
  return out;
}
/** What a town's orders say, in words. */
export function ordersText(t: Territory): string {
  const o = t.orders, w = workOf(t);
  const work = STORE_KINDS.filter((k) => w[k] > 0.01).sort((a, b) => w[b] - w[a]).map((k) => `${Math.round(w[k] * 100)}% ${k}`).join(', ');
  return `${o?.work ? 'By your last orders its people work' : 'A governor keeps it; its people work'}: ${work}.${o?.build?.length ? ` Building: ${o.build.map((b: string) => BUILDINGS[b]?.name ?? b).join(', ')}.` : ''}${o?.train?.length ? ` Was training: ${o.train.join(', ')}.` : ''}`;
}
