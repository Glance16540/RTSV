// The Watch House (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads). A town that
// keeps a watch catches its thieves sooner, finds a killer's clues faster and loses fewer to a killer meanwhile.
// It answers the stories inside the story (intrigue.ts), which is where its effect is read.
//
// On the map. A Watch House is kept on the town's record (`Territory.watchHouse`: the season it was raised),
// outside the three or four works a land has room for. The player raises one for supplies, paid in wood out of the
// town (prices.ts). A town's governor raises one of its own accord once the town has had cause: a thief or a
// killer has been at work there two seasons, or was within the last two years. It needs a town of some size to
// man it. It stays with the town whoever holds it.
//
// In a town. It is a real building (data.ts `watchhouse`): raised by villagers like any other, and a town that has
// one on the map stands with one when a battle or a visit is laid out (townworks.ts). One built in a town is kept
// on the town's own record of what stands, and counts on the map from then on. While one stands, the watch raises
// the town to any fire: villagers are called off their work to a burning building without being told
// (calamity.ts), where otherwise only the idle go.
//
// Costs and strengths here are first guesses.
import type { Campaign } from './campaign';
import { canPayFor, payFor } from './prices';
import { folkOf, grown } from './township';
import { WORKS } from './townworks';

declare module './campaign' {
  interface Territory { /** The season a Watch House was raised here (watchhouse.ts). */ watchHouse?: number }
}

export const WATCH = {
  /** Its price on the map, in supplies (paid in wood, as a Barracks is), and the grown people a town needs to man it. */
  cost: 4, grown: 6,
  /** What it adds to the chance, each season, that a thief is taken, whether or not a watch is set on the houses. */
  thief: 0.15,
  /** What it adds to the chance, each season, that a clue to a killer turns up. */
  clue: 0.2,
  /** What a killer's chance of killing in a season is multiplied by. */
  strike: 0.75,
  /** The governor raises one when a story has run this many seasons in the town, or ended there within this many. */
  after: 2, since: 8,
};

/** Does this town have a Watch House: raised on the map, or standing in the town as the last battle or visit left it? */
export function hasWatchHouse(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  return !!t && (t.watchHouse !== undefined || !!t.town?.b.some((x) => x[0] === 'watchhouse' && x[4] === undefined));
}
/** Why a people cannot raise a Watch House in this town now ('' if it can). */
export function watchBar(c: Campaign, f: number, tid: number): string {
  const t = c.territories[tid];
  if (!t || t.owner !== f || t.horde) return 'It is not your town.';
  if (hasWatchHouse(c, tid)) return 'It has one.';
  if (grown(folkOf(c, tid)) < WATCH.grown) return `A town needs ${WATCH.grown} grown people to keep a watch.`;
  if (!canPayFor(c, f, 'barracks', WATCH.cost)) return 'You have not the supplies.';
  return '';
}
export const canRaiseWatch = (c: Campaign, f: number, tid: number): boolean => watchBar(c, f, tid) === '';
/** Raise a Watch House in a town, for its price. */
export function raiseWatch(c: Campaign, f: number, tid: number): boolean {
  if (!canRaiseWatch(c, f, tid)) return false;
  payFor(c, f, 'barracks', WATCH.cost, { at: tid });
  c.territories[tid].watchHouse = c.turn;
  if (f === 0) c.log.push(`A Watch House stands in ${c.territories[tid].name}.`);
  return true;
}
/** What a town's watch does for it against a thief and a killer: nothing where there is none. */
export function watchEdge(c: Campaign, tid: number): { thief: number; clue: number; strike: number } {
  return hasWatchHouse(c, tid) ? { thief: WATCH.thief, clue: WATCH.clue, strike: WATCH.strike } : { thief: 0, clue: 0, strike: 1 };
}
/**
 * The governors' season: a town that has had cause, and has none, raises a Watch House out of its own people's
 * stores if they can pay. Returns the towns that did. (Only the player's towns have stories yet, so only they have cause.)
 */
export function governWatch(c: Campaign): number[] {
  const raised: number[] = [];
  for (const it of c.intrigues ?? []) {
    if (it.kind !== 'thief' && it.kind !== 'killer') continue;
    const cause = it.ended ? c.turn - it.ended.turn <= WATCH.since && it.ended.how !== 'lost' : c.turn - it.since >= WATCH.after;
    const t = c.territories[it.at];
    if (!cause || !t || t.owner < 0 || raised.includes(it.at) || !canRaiseWatch(c, t.owner, it.at)) continue;
    payFor(c, t.owner, 'barracks', WATCH.cost, { at: it.at });
    t.watchHouse = c.turn;
    raised.push(it.at);
    if (t.owner === 0) c.log.push(`The governor of ${t.name} has raised a Watch House, after what happened there.`);
  }
  return raised;
}

// A town that has one on the map stands with one when a battle or a visit is laid out.
WORKS.push((c, tid) => (c.territories[tid]?.watchHouse !== undefined ? ['watchhouse'] : []));
