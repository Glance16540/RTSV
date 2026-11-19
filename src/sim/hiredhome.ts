// Men of no town who are sent home settle in the army's chief town (docs/DESIGN.md, "Armies belong to towns";
// docs/CLOSING.md: "Men of no town who are sent home vanish").
//
// A company still marches when its towns cannot man it in full, and the shortfall are men of no town (armytown.ts). When
// an army is sent home its townsmen go back to their own towns, and those of no town simply went nowhere: they were
// gone from the world. Now they settle where the army calls home: the town most of its men came from, if it is still
// their people's (armytown.ts homeOf), else the town the army stands in. Each is a grown man, at the age of the army's
// townsmen in the middle (or a man of five-and-twenty where it has none), and he is a townsman of that town from then
// on, of no house until he marries into one (the town's couples are a count, seasonfolk.ts). Only grown men: an army
// carries no women or children.
import type { Army, Campaign } from './campaign';
import { GROWN_SEASON, OLD_SEASON, agesOf, countFrom } from './ageing';
import { folkOf } from './township';

export const HIRED_HOME = {
  /** The age, in seasons, of a man of no town where the army has no townsman to go by: five-and-twenty years. */
  age: GROWN_SEASON + 7 * 4,
};

/** Where an army's men of no town settle: its chief town if still its people's, else where it stands. */
export const hiredTown = (c: Campaign, a: Army, home: number | undefined): number => (home !== undefined && c.territories[home]?.owner === a.owner ? home : a.at);

/**
 * An army is being sent home with `none` men of no town in it: they settle in its chief town (or where it stands), at
 * the middle age of `townsmen` (the ages of its men of towns). Returns how many settled.
 */
export function hiredHome(c: Campaign, a: Army, none: number, home: number | undefined, townsmen: readonly number[] = []): number {
  const n = Math.max(0, Math.floor(none));
  if (!n) return 0;
  const tid = hiredTown(c, a, home), t = c.territories[tid];
  if (!t || t.owner !== a.owner) return 0;
  const sorted = [...townsmen].filter((s) => Number.isFinite(s)).sort((p, q) => p - q);
  const age = Math.min(OLD_SEASON - 1, Math.max(GROWN_SEASON, sorted.length ? sorted[Math.floor(sorted.length / 2)] : HIRED_HOME.age));
  const f = folkOf(c, tid), ages = agesOf(c, tid, f);
  countFrom(f, { m: [...ages.m, ...Array.from({ length: n }, () => age)], f: ages.f, k: ages.k });
  return n;
}
