// A computer-led people whose own are held weighs the clock, on the map (the board's line "The computer does not know
// captives are on a clock: it neither hurries a rescue nor sells"; aicaptives.ts is the same in a town).
//
// People are held on the map two ways, each for a few seasons before they are past getting back: carried off by a
// nation that took their town (carriedoff.ts, CARRY.seasons; got back by taking the land they are held in), and taken
// by a band (threats.ts, THREATS.holdFor; got back by breaking it). A rival whose people are held:
//   - marches first on the land its carried-off are held in once they have RIVAL_CLOCK.last seasons or fewer left,
//     the fewest left first (`heldFirst`, over the order rivalaim.ts gives; campaign.ts). Whether it dares the march is
//     still decided by the fight (mapbattle.ts wouldTake): it does not throw an army away for them;
//   - goes after a band holding its own at odds that shorten as their seasons run out (`bandOdds`, bandfight.ts):
//     FIGHT.theirs while there is time, down to RIVAL_CLOCK.bandLast in their last season.
// Nothing is sold on the map, by the player or anyone, and nothing here sells. No child is ever taken (only the grown
// are carried off or held), and those got back bring home their children as they do now.
// Plain rules over the campaign's record.
import type { Campaign } from './campaign';
import { carriedLeft } from './carriedoff';
import type { Held } from './threats';
import { THREATS } from './threatsbase';

export const RIVAL_CLOCK = {
  /** Seasons left at which a land holding a people's carried-off goes first in its march. */
  last: 2,
  /** The odds a people needs to go after a band holding its own, in their last season (bandfight.ts FIGHT.theirs before). */
  bandLast: 1.2,
};

/** The fewest seasons left of this people's carried-off held in a land; Infinity for none. */
export function heldLeft(c: Campaign, f: number, tid: number): number {
  let least = Infinity;
  for (const x of c.carried ?? []) if (x.at === tid && x.held.owner === f && x.by !== f) least = Math.min(least, carriedLeft(c, x));
  return least;
}

/** The lands a rival could march on, in order: those holding its own in their last seasons first, the fewest left first; the rest as they were. */
export function heldFirst(c: Campaign, f: number, targets: readonly number[]): number[] {
  const left = new Map(targets.map((id) => [id, heldLeft(c, f, id)]));
  const urgent = (id: number): number => { const k = left.get(id)!; return k <= RIVAL_CLOCK.last ? k : Infinity; };
  return targets.map((id, i) => ({ id, i, k: urgent(id) })).sort((a, b) => (a.k === b.k ? a.i - b.i : a.k - b.k)).map((x) => x.id);
}

/** The odds a people needs to go after a band holding these of its own: `theirs` with time left, shortening to RIVAL_CLOCK.bandLast in their last season. */
export function bandOdds(c: Campaign, held: readonly Held[], theirs: number): number {
  const left = held.reduce((m, h) => Math.min(m, Math.max(0, THREATS.holdFor - (c.turn - h.since))), Infinity);
  if (!Number.isFinite(left)) return theirs;
  const run = Math.max(0, Math.min(1, (THREATS.holdFor - left) / Math.max(1, THREATS.holdFor - 1))); // 0 just taken, 1 in the last season
  return theirs - (theirs - Math.min(theirs, RIVAL_CLOCK.bandLast)) * run;
}
