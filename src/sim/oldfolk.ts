// A town's old people, within a town taken (docs/DESIGN.md: "its people are not counted as another people's within the
// town, and resentment costs the holder nothing but the risk").
//
// A town taken by force (conquered.ts, `Territory.yoke`) keeps a count of those within it who are still of the people
// it was taken from (`Territory.oldFolk`): at first all of them. Season by season they become the holder's:
//   - OLD.ease of them a season, and OLD.settled more as their resentment eases (all of it once it is gone);
//   - every couple wed in the town that season (marriage.ts) makes one of them the holder's;
//   - children born there are the holder's from the first, so the old are fewer by share as the town grows;
//   - the dead are of either, as they were: the old are never more than the town's people.
// A town taken back by its own people has none of another's in it. Once the last is the holder's, the count is gone.
//
// While they resent it, they cost the holder (the weight is their share of the town times their resentment, 0 to 1):
//   - its building, OLD.build slower (governor.ts): what the governor raises there, and what stood half built.
// (Tried at 192 campaigns and dropped: a share of its harvest and gold withheld, even 0.15 of it at the full weight, lifted
// the share of farmed towns hungry over 2% and the ruined campaigns with it; fewer men answering a levy, 0.3 of them, lifted
// the rivals' wins and a nation's men under arms; more drift, 0.05 strain at the full weight, cut the towns Righteous at
// twenty years by a third. With building alone every band reads as main has it.)
// The land's panel says how many of the old people there are and what they cost this season. Plain data on the town.
import type { Campaign, Territory } from './campaign';
import { folkOf, grown } from './township';
import { markTaken, passOver, trimOld } from './oldmarks';

// (`Territory.oldFolk` is declared in oldmarks.ts: `n` in all, `names` of them known by name, `wed` its couples last season.)

export const OLD = {
  /** The share of the old who become the holder's a season, and what more as their resentment eases (at none, all of this). */
  ease: 0.02, settled: 0.06,
  /** What they cost at the full weight: the share of the building pace lost. */
  build: 0.2,
};

const people = (c: Campaign, tid: number): number => { const f = folkOf(c, tid); return grown(f) + f.children; };

/** The weight of the old people's resentment on a town, 0 to 1: their share of its people, times their resentment. */
export function oldWeight(c: Campaign, tid: number): number {
  const t = c.territories[tid], o = t?.oldFolk, all = t ? people(c, tid) : 0;
  if (!o || !all || !t?.yoke || t.yoke.settled) return 0;
  return Math.max(0, Math.min(1, (o.n / all) * (t.yoke.resent / 100)));
}
/** How fast it builds, against the usual (governor.ts). */
export const oldBuild = (c: Campaign, tid: number): number => 1 - OLD.build * oldWeight(c, tid);

/** A season of one town's old people. */
export function oldSeason(c: Campaign, t: Territory): void {
  const y = t.yoke;
  if (t.owner < 0 || t.horde || (t.oldFolk && t.oldFolk.from === t.owner)) { delete t.oldFolk; return; } // back with its own people, or nobody's
  if (y && !y.settled && !t.oldFolk && y.from !== t.owner) { t.oldFolk = { from: y.from, n: people(c, t.id), wed: folkOf(c, t.id).wed }; markTaken(t); } // those it knows by name are marked by name (oldmarks.ts)
  const o = t.oldFolk;
  if (!o) return;
  const f = folkOf(c, t.id), resent = y && !y.settled ? y.resent : 0;
  trimOld(t, people(c, t.id));
  const wed = Math.max(0, (f.wed ?? 0) - (o.wed ?? f.wed ?? 0));
  o.wed = f.wed;
  const go = Math.min(o.n, Math.ceil(o.n * (OLD.ease + OLD.settled * (1 - resent / 100))) + wed);
  passOver(c, t, go); // which of them: among the named and the rest in their share (oldmarks.ts)
  o.n = Math.max(0, o.n - go);
  if (o.n <= 0) delete t.oldFolk;
}
/** A season of every taken town's old people. */
export function oldSeasons(c: Campaign): void {
  for (const t of c.territories) oldSeason(c, t);
}

const tenth = (x: number): string => { const n = Math.round(x * 10); return n <= 0 ? 'little' : n >= 10 ? 'all' : ['', 'a tenth', 'a fifth', 'three tenths', 'two fifths', 'half', 'three fifths', 'seven tenths', 'four fifths', 'nine tenths'][n]; };
/** The land's panel's line: how many of the old people, and what their resentment costs this season. Empty where none. */
export function oldText(c: Campaign, tid: number, peopleName: (f: number) => string): string {
  const t = c.territories[tid], o = t?.oldFolk;
  if (!o) return '';
  const all = people(c, tid), w = oldWeight(c, tid);
  const of = `Of its ${all} people, ${o.n} are still of ${peopleName(o.from)}.`;
  if (w < 0.05) return `${of} They bear your rule without much grudge.`;
  return `${of} Their resentment makes its building ${tenth(OLD.build * w)} slower.`;
}
