// The old people of a taken town (docs/DESIGN.md, "A town taken": "its people stay and become the taker's over
// time"). A town taken by force is still full of the people it was taken from. Its record keeps how many of its
// grown people are of the old nation, and they become the taker's over the years.
//
//   Counted. When a town is taken (it bears a yoke, conquered.ts), every grown person in it is of the people it was
//     taken from: `Territory.old` = whose, how many, and the season of the taking. Children are nobody's old people:
//     those born under the taker grow up the taker's.
//   Becoming the taker's. Each season some of them join, by marriage, by their children growing up, by settling:
//     OLD.join of those left, slowed by how the town still resents its holder (at full resentment a quarter as
//     fast), and never fewer than the town has lost. When the last of them has joined, the record is gone.
//   Lost with the town. If the people it was taken from have it back, or it goes to nobody, there are no old people
//     in it: it is theirs. Taken again by a third people, everyone in it is counted anew as of whoever held it.
//   What resentment costs. While the town resents its holder, its old people work and watch grudgingly. The
//     `grudge` is the share of the town they are, times its resentment (0 to 1). A town's land yields less by
//     OLD.harvest of the grudge (harvest.ts), and its men count for less on the walls against a band by OLD.watch
//     of it (threats.ts). A town all of the old people at full resentment brings in three quarters of its harvest
//     and stands to with half its men. As they join and the resentment eases, it costs nothing.
//
// It reads the town's record and its yoke as plain data, so that the harvest and the threats can ask it with no
// ring of imports. The season's one call is `oldSeason` (from conquered.ts). Strengths are first guesses.
import type { Campaign } from './campaign';
import { folkOf, grown } from './township';

declare module './campaign' {
  interface Territory {
    /** The grown people of a taken town who are still of the people it was taken from (oldpeople.ts): whose (-1 a tribe's), how many, and the season it was taken. */
    old?: { of: number; n: number; since: number };
  }
}

export const OLD = {
  /** The share of the old people left who join the taker in a season, where the town resents nothing. */
  join: 0.06,
  /** At full resentment they join this many times as fast (slower). */
  resented: 0.25,
  /** The share of a town's harvest lost, and of its men's worth on the walls against a band, at a grudge of 1. */
  harvest: 0.25, watch: 0.5,
};

/** How many of a town's grown people are still of the people it was taken from. */
export function oldCount(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t?.old || t.owner < 0 || t.owner === t.old.of) return 0;
  return Math.max(0, Math.min(Math.round(t.old.n), grown(folkOf(c, tid))));
}
/** The share of a town's grown people they are, 0 to 1. */
export function oldShare(c: Campaign, tid: number): number {
  const all = grown(folkOf(c, tid));
  return all > 0 ? oldCount(c, tid) / all : 0;
}
/** How the old people of a town bear on its holder, 0 to 1: the share of the town they are, times how it resents him. */
export function grudge(c: Campaign, tid: number): number {
  const resent = c.territories[tid]?.yoke?.resent ?? 0;
  return resent > 0 ? oldShare(c, tid) * Math.min(1, resent / 100) : 0;
}
/** What a town's land yields of its harvest, for the grudge its old people bear: 1 where there is none. */
export const grudgeWork = (c: Campaign, tid: number): number => 1 - OLD.harvest * grudge(c, tid);
/** What a town's men are worth on the walls against a band, for the same: 1 where there is none. */
export const grudgeWatch = (c: Campaign, tid: number): number => 1 - OLD.watch * grudge(c, tid);

/**
 * A season for the old people of every taken town: a town newly taken has its people counted, some of them join
 * the taker, and a town back with its own people or nobody's has none. Returns the towns whose last old people joined.
 */
export function oldSeason(c: Campaign): number[] {
  const joined: number[] = [];
  for (const t of c.territories) {
    const y = t.yoke;
    // Newly taken (or taken again): everyone grown in it is of the people it was taken from.
    if (y && t.owner >= 0 && !t.horde && (!t.old || t.old.since !== y.since)) t.old = { of: y.from, n: grown(folkOf(c, t.id)), since: y.since };
    const o = t.old;
    if (!o) continue;
    if (t.owner < 0 || t.horde || t.owner === o.of) { delete t.old; continue; }
    o.n = Math.min(o.n, grown(folkOf(c, t.id))); // those who died or left are old people no longer
    const resent = Math.min(1, Math.max(0, (y?.resent ?? 0) / 100));
    o.n -= o.n * OLD.join * (1 - (1 - OLD.resented) * resent);
    if (o.n < 1) { delete t.old; joined.push(t.id); }
  }
  return joined;
}
