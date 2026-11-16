// A town's people on the map, season by season (docs/DESIGN.md, "People come only by birth").
//
// Births are one record whether the player is in the town or not. Inside a battle or a visit they come in real
// time, faster than here but not fast (a couple's first child in about a visit: birthonly.ts); on the map the same
// rule runs coarsely once a season, here:
//
//  - Who can bear: a man and a woman of working age under one roof. A town whose buildings are on record has as
//    many roofs as it has finished houses; a town nobody has fought over or visited is kept by its governor, who
//    houses its couples. Each birth costs the same food as in a town, and needs room: five to a house and ten to
//    the hall, as in a town, for every grown person and child.
//  - How often: a couple raises a child about every MAP_BIRTH seasons (a year) at first, more slowly the more children
//    under five the town has on its records (as a house slows in a town), and sooner or later by the town's creed, which
//    also decides how many of the births due do not come (the same shares as in a town). No child dies.
//  - Children are on the town's record, with their ages, and are never shown. Everyone ages a season at a time
//    (ageing.ts): a child comes of age at fifteen into a man or a woman of working age, the grown are old at sixty,
//    and the old die over the years after.
import type { Campaign, Territory } from './campaign';
import { creedOf } from './creed';
import { faithAt } from './townfaith';
import { BIRTH_COST } from './data';
import { GROWN_AT } from './nursery';
import { Folk, MAX_KIND, folkOf, grown } from './township';
import { ageTown } from './ageing';
import { tally } from './ledger';
import { birthPace } from './ownstudies';

declare module './township' {
  interface Folk {
    /** Progress toward the next birth on the map, in births. */
    due?: number;
    /** Births that were due and did not come, as a house keeps the count. */
    missed?: number;
  }
}

/** Seasons between a housed couple's children on the map, before creed and the slowing with more young children. */
export const MAP_BIRTH = 4;
/** Children under this many seasons (five years) are the ones who slow a couple's next. */
export const YOUNG_SEASONS = 20;
/** Seasons a child on the map takes to come of age. */
export const GROWN_SEASONS = GROWN_AT * 4;
/** Room in a town, as in a battle: so many to a finished house and so many to the hall. */
export const HOUSE_ROOM = 5;
export const HALL_ROOM = 10;

const hash = (a: number, b: number, k: number): number => {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(k + 1, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** Finished houses on a town's record, or null when nothing of the town is on record (its governor keeps it). */
export function housesOf(t: Territory): number | null {
  if (!t.town?.b?.length) return null;
  return t.town.b.filter((x) => x[0] === 'house' && x[4] === undefined).length;
}

/** Couples who could raise a child this season: man and woman of working age, under a roof. */
export function couplesOf(t: Territory, f: Folk): number {
  // A woman drifted to the tavern (drift.ts) is no wife at home.
  const pairs = Math.min(f.men, Math.max(0, f.women - (f.drifted?.tavern ?? 0))), roofs = housesOf(t);
  return roofs === null ? pairs : Math.min(pairs, roofs);
}

/** How many people a town has room for, or Infinity when its buildings are not on record. */
export function roomOf(t: Territory): number {
  const roofs = housesOf(t);
  if (roofs === null) return Infinity;
  return roofs * HOUSE_ROOM + (t.town!.b.some((x) => x[0] === 'towncenter' && x[4] === undefined) ? HALL_ROOM : 0);
}

/** One season in one town: children born to its couples, and children come of age. Returns how many were born and grew up. */
export function seasonTown(c: Campaign, tid: number): { born: number; grew: number; missed: number; died: number } {
  const t = c.territories[tid], f = folkOf(c, tid), creed = creedOf(faithAt(c, tid)); // the town's own standing (townfaith.ts)
  let born = 0, grew = 0, missed = 0, died = 0;
  // The town's people are a season older first (ageing.ts): children come of age, the grown grow old, the old die.
  const aged = ageTown(c, tid, f, MAX_KIND);
  grew = aged.grew; died = aged.died;
  const couples = couplesOf(t, f);
  if (!couples) { f.due = 0; tally(c, tid, 'grew', grew); tally(c, tid, 'aged', died); return { born, grew, missed, died }; }
  const young = (f.ages?.k ?? []).filter((s) => s < YOUNG_SEASONS).length;
  const slow = Math.min(3, 1 + 0.2 * (young / couples));
  f.due = Math.min(couples, (f.due ?? 0) + (couples * creed.birth * birthPace(c, tid)) / (MAP_BIRTH * slow)); // a people's own study may bring them sooner (ownstudies.ts)
  while (f.due >= 1) {
    if (grown(f) + f.children + 1 > roomOf(t) || f.stores.food < BIRTH_COST || f.children >= MAX_KIND) { f.due = Math.min(f.due, 1); break; }
    f.due -= 1;
    // The births that do not come are decided without spending the food, as in a town.
    if (hash(c.seed, tid * 131 + c.turn, 1000 + born + missed) < creed.childLoss) { missed++; continue; }
    f.stores.food -= BIRTH_COST;
    f.children++;
    f.ages!.k.push(0);
    born++;
  }
  if (missed) f.missed = (f.missed ?? 0) + missed;
  tally(c, tid, 'born', born); tally(c, tid, 'grew', grew); tally(c, tid, 'aged', died); // for the season's report (ledger.ts)
  return { born, grew, missed, died };
}

/**
 * Children born in a visit to a town are the season's births there, not more on top of them: births are one record
 * whether the player is in the town or not. They are counted against what the town's couples have due on the map,
 * so a town visited every season bears about as a visit bears, and one left alone as the map does.
 */
export function bornOnVisit(c: Campaign, tid: number, born: number): void {
  if (born <= 0) return;
  const f = folkOf(c, tid);
  f.due = (f.due ?? 0) - born;
}

/** A season passes for the people of every town on the map that is not held by marauders. */
export function seasonFolk(c: Campaign): void {
  for (const t of c.territories) if (!t.horde) seasonTown(c, t.id);
}
