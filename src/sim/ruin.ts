/**
 * A world that ends in ruin (docs/DESIGN.md, the owner's word of 15 November 2026): "A world where no people has
 * been able to take land for a long stretch (about twenty years) while bands hold much of the map ends in ruin:
 * no winner, and the chronicle closes the age."
 *
 * How it is read here. Towns change hands with the tribes and the bands in most seasons even of a ruined world,
 * so "has been able to take land" is read as ground gained and kept: no living people holds more land now than
 * it held `RUIN.seasons` ago. "Bands hold much of the map": the lands the marauders hold, and those where a band
 * has its place, are `RUIN.bands` of all the lands or more, and the peoples together hold less than `RUIN.held` of
 * them. (Without the second, strong nations at a stand-off with bands camped on their own land read as ruined:
 * five of 96 computer-played campaigns, none of them a ruined world.) When all of it is so the campaign is over with no
 * winner (`winner` -1, `ended` 'ruin'), and the chronicle says so. Checked once a season, where campaigns are
 * decided; a campaign already over is left as it ended.
 */
import type { Campaign } from './campaign';

declare module './campaign' {
  interface Campaign {
    /** How many lands each people held at the end of each of the last seasons, oldest first (ruin.ts). */
    grounds?: number[][];
    /** How the campaign ended, where it was not won: in ruin (ruin.ts). */
    ended?: 'ruin';
  }
}

export const RUIN = {
  /** Seasons with no people gaining ground: twenty years. */
  seasons: 80,
  /** The share of the map in the bands' hands that counts as much of it. */
  bands: 0.2,
  /** The peoples together must hold less than this share of the map for it to be the bands' and not theirs. */
  held: 0.5,
};
const landsOf = (c: Campaign, f: number): number => c.territories.filter((t) => t.owner === f && !t.horde).length;
/** The share of the map the bands hold: lands the marauders hold, and lands where a band has its place. */
export function bandShare(c: Campaign): number {
  const theirs = new Set<number>(c.territories.filter((t) => t.horde).map((t) => t.id));
  for (const b of c.bands ?? []) if (c.territories[b.at]) theirs.add(b.at);
  return c.territories.length ? theirs.size / c.territories.length : 0;
}
/** The share of the map the living peoples hold between them. */
export const heldShare = (c: Campaign): number => (c.territories.length ? c.territories.filter((t) => t.owner >= 0 && !t.horde && c.factions[t.owner]?.alive).length / c.territories.length : 0);
/** Do the bands hold much of the map, and the peoples little? */
export const bandsHoldMuch = (c: Campaign): boolean => bandShare(c) >= RUIN.bands && heldShare(c) < RUIN.held;
/** Has any living people more land now than it had `RUIN.seasons` ago? True while the record is still too short to say. */
export function groundGained(c: Campaign): boolean {
  const past = c.grounds ?? [];
  if (past.length < RUIN.seasons) return true;
  const then = past[past.length - RUIN.seasons]; // the season that many before this one
  return c.factions.some((f) => f.alive && landsOf(c, f.id) > (then[f.id] ?? 0));
}
/** Seasons left before a world that goes on as it is ends in ruin, or -1 if it is not heading there. For a warning. */
export function ruinIn(c: Campaign): number {
  const past = c.grounds ?? [];
  if (c.phase === 'over' || !bandsHoldMuch(c) || !past.length) return -1;
  // The oldest season on record that some living people has since bettered: ruin comes RUIN.seasons after it.
  for (let back = Math.min(RUIN.seasons, past.length); back >= 1; back--) {
    const then = past[past.length - back];
    if (c.factions.some((f) => f.alive && landsOf(c, f.id) > (then[f.id] ?? 0))) return Math.max(1, RUIN.seasons - back);
  }
  return Math.max(1, RUIN.seasons - Math.min(RUIN.seasons, past.length));
}
/**
 * A season has turned: the ground each people holds is written down, and a world twenty years without any of
 * them gaining ground, with the bands on much of the map, ends in ruin. Returns whether it ended so.
 */
export function ruinSeason(c: Campaign): boolean {
  if (c.phase === 'over') return false;
  const past = (c.grounds ??= []);
  const gained = groundGained(c); // against the record as it stood before this season is added
  past.push(c.factions.map((f) => (f.alive ? landsOf(c, f.id) : 0)));
  if (past.length > RUIN.seasons) past.splice(0, past.length - RUIN.seasons);
  if (gained || !bandsHoldMuch(c)) return false;
  c.phase = 'over';
  c.winner = -1;
  c.ended = 'ruin';
  (c.chronicle ??= []).push({ turn: c.turn, text: 'For twenty years no people had gained ground, and the bands held much of the land. The age closed in ruin, and nobody ruled.' });
  c.log.push('The land lies in ruin. For twenty years no people has gained ground, and the bands hold much of it. The age is over, and nobody has won.');
  return true;
}
/** Did this campaign end in ruin? */
export const inRuin = (c: Campaign): boolean => c.phase === 'over' && c.ended === 'ruin';
/** How a campaign that ended in ruin ended, in words: a heading and a line for the ending screen. */
export const ruinWords = (c: Campaign): { title: string; line: string } => ({
  title: 'The land lies in ruin',
  line: `For twenty years no people gained ground, and the bands held much of the land. Nobody rules it. It took ${c.turn} turns.`,
});
