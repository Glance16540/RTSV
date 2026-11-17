// People moving between towns by road of their own accord (docs/DESIGN.md: "nothing moves between towns by road; a town
// is held to the room of the houses on its record"). Convoys carry what a ruler orders (convoys.ts) and the unmarried
// go to marry (suitors.ts); this is the rest: families leaving a town that is hard to live in for a better one of
// their own people.
//
// Push. A town pushes a family out when it is crowded (its people fill the room of its houses on record, seasonfolk.ts),
// hungry (larder.ts), sick (a plague in force), lately raided or carried from (threats.ts), or grieving (grief.ts).
// Pull. A town draws them when it has room to spare (MIGRATE.room places beyond its people and those already on the
// road to it), bread in store for the newcomers too (MIGRATE.bread of what plenty.ts calls short, a head, with them
// counted in), and none of those troubles.
// Who goes. One family from a pushed town a season, by chance (MIGRATE.chance): its youngest man and woman of working
// age, and up to MIGRATE.children of its children. A town never lets one go that would leave it under MIGRATE.keep
// grown people or without a couple, so a hamlet is not emptied by it. They go to the town that draws most (most room)
// of those their people can reach by road (convoys.ts: a road through their own lands or a sea lane from a Harbour),
// as a convoy does, a season on the way, and are of that town from then on. At most MIGRATE.season families a people
// a season. Every nation's towns do it, the player's and the rivals' alike; the player is told in a line a season.
//
// The numbers are first guesses.
import type { Campaign } from './campaign';
import { roadBetween, sendFamily } from './convoys';
import { roomOf } from './seasonfolk';
import { PLENTY } from './plenty';
import { folkOf, headcount } from './township';

export const MIGRATE = {
  /** The chance a season that a pushed town sends a family. */
  chance: 0.35,
  /** Grown people a town keeps whatever goes. */
  keep: 8,
  /** Places beyond its people (and those on the road to it) a town must have to draw a family. */
  room: 2,
  /** Bread a town must hold to draw a family, a head with the family counted in, in plenty.ts's measures of short bread. */
  bread: 1,
  /** Children who go with a family, at most. */
  children: 2,
  /** Seasons a raid is remembered as a reason to leave, or to stay away. */
  raided: 4,
  /** Families a people moves in a season, at most. */
  season: 2,
};

export type Push = 'crowded' | 'hungry' | 'sick' | 'raided' | 'grieving';
export interface Move { owner: number; from: number; to: number; why: Push; people: number }

const lately = (c: Campaign, tid: number, kinds: string[], seasons: number): boolean =>
  (c.events ?? []).some((e) => e.at === tid && kinds.includes(e.kind) && e.until >= c.turn - seasons);
const sick = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.at === tid && e.kind === 'plague' && e.until >= c.turn);
/** People already on the road to a town. */
const coming = (c: Campaign, tid: number): number => (c.convoys ?? []).filter((x) => x.to === tid).reduce((n, x) => n + x.cargo.men.length + x.cargo.women.length + (x.cargo.children?.length ?? 0), 0);
const roll = (c: Campaign, tid: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 13, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(tid * 977 + salt + 7, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};

/** Why a town would send a family away, the gravest first, or null if nothing pushes it. */
export function pushOf(c: Campaign, tid: number): Push | null {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde) return null;
  const f = folkOf(c, tid);
  if (f.hungry) return 'hungry';
  if (sick(c, tid)) return 'sick';
  if (lately(c, tid, ['raid', 'carried'], MIGRATE.raided)) return 'raided';
  if (headcount(f) >= roomOf(t)) return 'crowded';
  if (f.grief) return 'grieving';
  return null;
}

/** How strongly a town draws a family: the places it has to spare, or 0 if it draws none. */
export function pullOf(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde || pushOf(c, tid)) return 0;
  const f = folkOf(c, tid), people = headcount(f) + coming(c, tid) + 2 + MIGRATE.children;
  if (f.stores.food / people < MIGRATE.bread * PLENTY.short) return 0; // bread for them too
  const free = roomOf(t) - headcount(f) - coming(c, tid);
  return free >= MIGRATE.room ? free : 0;
}

/** A family that could leave a town: a man and a woman of working age and some children, if the town keeps enough. */
function familyOf(c: Campaign, tid: number): { men: number; women: number; children: number } | null {
  const f = folkOf(c, tid);
  if (f.men < 2 || f.women < 2 || f.men + f.women + f.elders - 2 < MIGRATE.keep) return null;
  return { men: 1, women: 1, children: Math.min(MIGRATE.children, f.children) };
}

/** One season of a people's families moving. Returns the moves. */
export function migrateOf(c: Campaign, f: number): Move[] {
  const fac = c.factions[f];
  if (!fac?.alive) return [];
  const mine = c.territories.filter((t) => t.owner === f && !t.horde);
  const out: Move[] = [];
  for (const t of mine) {
    if (out.length >= MIGRATE.season) break;
    const why = pushOf(c, t.id);
    if (!why || roll(c, t.id, 31) >= MIGRATE.chance) continue;
    const who = familyOf(c, t.id);
    if (!who) continue;
    const to = mine.filter((x) => x.id !== t.id).map((x) => ({ id: x.id, pull: pullOf(c, x.id) })).filter((x) => x.pull > 0)
      .sort((a, b) => b.pull - a.pull || a.id - b.id).find((x) => roadBetween(c, f, t.id, x.id));
    if (!to) continue;
    const convoy = sendFamily(c, f, t.id, to.id, who);
    if (!convoy) continue;
    out.push({ owner: f, from: t.id, to: to.id, why, people: convoy.cargo.men.length + convoy.cargo.women.length + (convoy.cargo.children?.length ?? 0) });
  }
  return out;
}

const WHY: Record<Push, string> = { crowded: 'there was no room', hungry: 'it was hungry', sick: 'plague was there', raided: 'it had been raided', grieving: 'it was grieving' };
/** One season of families moving in every nation. The player is told in a line. Returns the moves. */
export function migrationSeason(c: Campaign): Move[] {
  const all = c.factions.flatMap((x) => migrateOf(c, x.id));
  const mine = all.filter((m) => m.owner === 0);
  if (mine.length) c.log.push(`${mine.length === 1 ? 'A family has' : `${mine.length} families have`} set out by road: ${mine.map((m) => `from ${c.territories[m.from].name} to ${c.territories[m.to].name}, since ${WHY[m.why]}`).join('; ')}.`);
  return all;
}
