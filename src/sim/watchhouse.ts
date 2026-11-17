// The Watch House (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads). A town that
// keeps a watch catches its thieves sooner, finds a killer's clues faster and loses fewer to a killer meanwhile.
// It answers the stories inside the story (intrigue.ts), which is where its effect is read.
//
// On the map. A Watch House is one of the buildings raised on a town's record (townworks.ts; data.ts `watchhouse`,
// marked `onMap`): begun from the land's panel out of the town's own stores, and finished by its governor. It counts
// once it stands finished. A town's governor begins one of its own accord once the town has had cause: a thief or a
// killer has been at work there two seasons, or was within the last two years, and only out of plenty,
// as he buys a granary or a well: bread and a roof come first. A rival's governor begins one in a town a band has struck within two years,
// once it has its wall. It stays with the town whoever holds it.
//
// In a town. It is a real building, raised by villagers like any other, and what stands in the town is what the
// map's record keeps. While one stands, the watch raises the town to any fire: villagers are called off their work
// to a burning building without being told (calamity.ts), where otherwise only the idle go.
//
// Strengths here are first guesses.
import type { Campaign } from './campaign';
import { standsAt } from './studies';
import { BUILDINGS } from './data';
import { wantsOf } from './governor';
import { begunAt, raiseWork } from './townworks';
import { canSpare } from './plenty';

export const WATCH = {
  /** What it adds to the chance, each season, that a thief is taken, whether or not a watch is set on the houses. */
  thief: 0.15,
  /** What it adds to the chance, each season, that a clue to a killer turns up. */
  clue: 0.2,
  /** What a killer's chance of killing in a season is multiplied by. */
  strike: 0.75,
  /** The governor begins one when a story has run this many seasons in the town, or ended there within this many. */
  after: 2, since: 8,
  /** A governor begins one only if, after paying, the town still holds this many times what it keeps by it, in goods other than its bread. */
  plenty: 4,
};

/** Does a Watch House stand finished in this town? */
export const hasWatchHouse = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'watchhouse');
/** What a town's watch does for it against a thief and a killer: nothing where there is none. */
export function watchEdge(c: Campaign, tid: number): { thief: number; clue: number; strike: number } {
  return hasWatchHouse(c, tid) ? { thief: WATCH.thief, clue: WATCH.clue, strike: WATCH.strike } : { thief: 0, clue: 0, strike: 1 };
}
/**
 * Has a town the means to spare for a Watch House? Only out of plenty, as the governor buys the granary and the
 * well (governor.ts): it has its Farmland already, wants for neither food nor a roof, and after paying would still
 * hold four times what a town keeps by it in goods other than its bread (a town buys bread with its goods when it is hungry). Otherwise what it spent here would be what it
 * lacked for a farm the next hungry season.
 */
function spare(c: Campaign, tid: number): boolean {
  return canSpare(c, tid, BUILDINGS.watchhouse.cost, { wants: wantsOf(c, tid), times: WATCH.plenty }); // plenty.ts, one rule for every purchase
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
    if (!spare(c, it.at)) continue; // bread and a roof come first
    const log = c.log.length;
    if (raiseWork(c, t.owner, it.at, 'watchhouse') !== '') continue;
    c.log.length = log; // said in the governor's own words
    begun.push(it.at);
    if (t.owner === 0) c.log.push(`The governor of ${t.name} has begun a Watch House, after what happened there.`);
  }
  // A rival's town that a band has struck of late has cause too: its Watch House is where Town Watch is taught
  // (townwatch.ts), and with that it stands the better against the next band.
  for (const r of c.raids ?? []) {
    const t = c.territories[r.at];
    if (!t || t.owner < 0 || t.owner !== r.owner || !c.factions[t.owner]?.isAI || c.turn - r.turn > WATCH.since || begun.includes(r.at) || begunAt(c, r.at, 'watchhouse')) continue;
    if (!spare(c, r.at) || wantsOf(c, r.at).wall) continue; // bread, a roof and a wall first
    if (raiseWork(c, t.owner, r.at, 'watchhouse') === '') begun.push(r.at);
  }
  return begun;
}
