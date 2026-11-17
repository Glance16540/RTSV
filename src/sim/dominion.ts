// A dip does not undo dominion (docs/DESIGN.md, the owner's word, 17 November 2026).
//
// One people rules beyond challenge when it has held most of the land for DOMINION_TURNS turns (campaignbase.ts,
// campaign.ts checkDominion). The count used to be of turns running: one season under the share set it back to
// nothing. Read over 384 campaigns in each course, a third to a half of the campaigns still undecided after 200
// seasons had held the share at some time, several for nine turns of the ten, and lost the count to one town rising.
//
// So the count is kept through a dip (`dominionNext`): a season in which the people whose count it is holds less than
// the share takes DOMINION_DIP turns off it, and only when nothing is left is it gone. Another people coming to the
// share begins its own count at one, and the first people's is lost: there is one count, and it is of whoever holds
// most of the land now. A people that is no more has no count.
// Plain data: it is given the count and who holds the share this season, and gives the count back.

/** Turns a season under the share takes off a people's count. */
export const DOMINION_DIP = 2;

/** The count: whose it is (-1 nobody's) and how many turns it stands at. */
export interface Dominion { f: number; turns: number }

/**
 * The count after this season. `lead`: the people that holds the share now, or -1 if nobody does. `alive`: whether
 * the people whose count it was is still a people.
 */
export function dominionNext(was: Dominion | undefined, lead: number, alive = true): Dominion {
  const w = was && was.f >= 0 && was.turns > 0 ? was : { f: -1, turns: 0 };
  if (lead >= 0) return { f: lead, turns: w.f === lead ? w.turns + 1 : 1 };
  if (w.f < 0 || !alive) return { f: -1, turns: 0 };
  const turns = w.turns - DOMINION_DIP;
  return turns > 0 ? { f: w.f, turns } : { f: -1, turns: 0 };
}
