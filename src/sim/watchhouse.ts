// The Watch House (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads). A town that
// keeps a watch catches its thieves sooner, finds a killer's clues faster and loses fewer to a killer meanwhile.
// It answers the stories inside the story (intrigue.ts), which is where its effect is read.
//
// On the map. A Watch House is one of the buildings raised on a town's record (townworks.ts; data.ts `watchhouse`,
// marked `onMap`): begun from the land's panel out of the town's own stores, and finished by its governor. It counts
// once it stands finished. A town's governor begins one of its own accord once the town has had cause: a thief or a
// killer has been at work there two seasons, or was within the last two years. It stays with the town whoever
// holds it.
//
// In a town. It is a real building, raised by villagers like any other, and what stands in the town is what the
// map's record keeps. While one stands, the watch raises the town to any fire: villagers are called off their work
// to a burning building without being told (calamity.ts), where otherwise only the idle go.
//
// Strengths here are first guesses.
import type { Campaign } from './campaign';
import { standsAt } from './studies';
import { begunAt, raiseWork } from './townworks';

export const WATCH = {
  /** What it adds to the chance, each season, that a thief is taken, whether or not a watch is set on the houses. */
  thief: 0.15,
  /** What it adds to the chance, each season, that a clue to a killer turns up. */
  clue: 0.2,
  /** What a killer's chance of killing in a season is multiplied by. */
  strike: 0.75,
  /** The governor begins one when a story has run this many seasons in the town, or ended there within this many. */
  after: 2, since: 8,
};

/** Does a Watch House stand finished in this town? */
export const hasWatchHouse = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'watchhouse');
/** What a town's watch does for it against a thief and a killer: nothing where there is none. */
export function watchEdge(c: Campaign, tid: number): { thief: number; clue: number; strike: number } {
  return hasWatchHouse(c, tid) ? { thief: WATCH.thief, clue: WATCH.clue, strike: WATCH.strike } : { thief: 0, clue: 0, strike: 1 };
}
/**
 * The governors' season: a town that has had cause, and has none begun, begins a Watch House out of its own stores
 * if it can pay and has room. Returns the towns that did. (Only the player's towns have stories yet, so only they
 * have cause.)
 */
export function governWatch(c: Campaign): number[] {
  const begun: number[] = [];
  for (const it of c.intrigues ?? []) {
    if (it.kind !== 'thief' && it.kind !== 'killer') continue;
    const cause = it.ended ? c.turn - it.ended.turn <= WATCH.since && it.ended.how !== 'lost' : c.turn - it.since >= WATCH.after;
    const t = c.territories[it.at];
    if (!cause || !t || t.owner < 0 || begun.includes(it.at) || begunAt(c, it.at, 'watchhouse')) continue;
    const log = c.log.length;
    if (raiseWork(c, t.owner, it.at, 'watchhouse') !== '') continue;
    c.log.length = log; // said in the governor's own words
    begun.push(it.at);
    if (t.owner === 0) c.log.push(`The governor of ${t.name} has begun a Watch House, after what happened there.`);
  }
  return begun;
}
