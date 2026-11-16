/**
 * A world that ends in ruin (docs/DESIGN.md, the owner's word of 15 November 2026): "A world where no people has
 * been able to take land for a long stretch (about twenty years) while bands hold much of the map ends in ruin:
 * no winner, and the chronicle closes the age."
 *
 * How it is read here. Towns change hands with the tribes and the bands in most seasons even of a ruined world,
 * so "has been able to take land" is read as ground gained and kept: no living people holds more land now than
 * it held `RUIN.seasons` ago. "Bands hold much of the map": the lands the marauders hold, and those where a band
 * has its place, were `RUIN.bands` of all the lands or more in `RUIN.often` of those seasons, and the peoples
 * together hold less than `RUIN.held` of them. (Without the second, strong nations at a stand-off with bands camped on their own land read as ruined:
 * five of 96 computer-played campaigns, none of them a ruined world.) When all of it is so the campaign is over with no
 * winner (`winner` -1, `ended` 'ruin'), and the chronicle says so. Checked once a season, where campaigns are
 * decided; a campaign already over is left as it ended.
 */
import type { Campaign } from './campaign';

declare module './campaign' {
  interface Campaign {
    /** How many lands each people held at the end of each of the last seasons, oldest first (ruin.ts). */
    grounds?: number[][];
    /** The share of the map the bands held at the end of each of the last seasons, oldest first (ruin.ts). */
    bandGrounds?: number[];
    /** How the campaign ended, where it was not won: in ruin (ruin.ts). */
    ended?: 'ruin';
  }
}

export const RUIN = {
  /** Seasons with no people gaining ground: twenty years. */
  seasons: 80,
  /** The share of the map in the bands' hands that counts as much of it. */
  bands: 0.2,
  /** In how many of those seasons the bands must have held that much: a quarter of them. Their hold comes and goes with every band broken or newly camped, and read at one moment the same world was ruined one season and not the next. */
  often: 0.25,
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
/** In what share of the seasons on record (this one, where there is no record) the bands held `RUIN.bands` of the map or more. */
export function bandsOften(c: Campaign): number {
  const past = c.bandGrounds ?? [];
  if (!past.length) return bandShare(c) >= RUIN.bands ? 1 : 0;
  return past.filter((x) => x >= RUIN.bands).length / past.length;
}
/** Do the bands hold much of the map, and the peoples little? The bands' hold is read over the years on record, the peoples' as it stands. */
export const bandsHoldMuch = (c: Campaign): boolean => bandsOften(c) >= RUIN.often && heldShare(c) < RUIN.held;
/** Has any living people more land now than it had `RUIN.seasons` ago? True while the record is still too short to say. */
export function groundGained(c: Campaign): boolean {
  const past = c.grounds ?? [];
  if (past.length < RUIN.seasons) return true;
  const then = past[past.length - RUIN.seasons]; // the season that many before this one
  return c.factions.some((f) => f.alive && landsOf(c, f.id) > (then[f.id] ?? 0));
}
/** How near to ruin the player is warned of it. */
export const RUIN_WARN = 20;
/**
 * Seasons left before a world that goes on exactly as it stands ends in ruin, or -1 if it is not heading there
 * (the bands do not hold much of the map, or it is over). It is the first season ahead at which no living people
 * would hold more land than it held `RUIN.seasons` before; at the latest that is `RUIN.seasons` from now, when the
 * comparison is with today.
 */
export function ruinIn(c: Campaign): number {
  const past = c.grounds ?? [];
  if (c.phase === 'over' || !bandsHoldMuch(c)) return -1;
  for (let k = 1; k <= RUIN.seasons; k++) {
    const back = RUIN.seasons + 1 - k; // at that season the record looked to is this many entries back from the latest (1: the latest itself)
    if (back > past.length) continue; // further back than the record goes: it cannot be judged then
    const then = past[past.length - back];
    if (!c.factions.some((f) => f.alive && landsOf(c, f.id) > (then[f.id] ?? 0))) return k;
  }
  return RUIN.seasons;
}
/** The warning the player is given when ruin is near, or nothing. */
export function ruinWarning(c: Campaign): string {
  const left = ruinIn(c);
  return left > 0 && left < RUIN_WARN ? `The land is going to ruin: no people has gained ground in years, and the bands hold much of it. In ${left} ${left === 1 ? 'season' : 'seasons'} the age ends with no winner, unless some people takes land and keeps it.` : '';
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
  const bands = (c.bandGrounds ??= []);
  bands.push(Math.round(bandShare(c) * 1000) / 1000);
  if (bands.length > RUIN.seasons) bands.splice(0, bands.length - RUIN.seasons);
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
