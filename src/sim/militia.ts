/**
 * A town's own men in its defence against a nation, on the map (docs/DESIGN.md, "A town defends itself").
 *
 * When a nation's army came against a town and nobody watched, the town itself was worth one point of defence
 * whoever was in it: a capital of a hundred men and a hamlet whose men were all away with the army stood the
 * same, and its men were asked only whether there was one to man a wall (sieges.ts). Here the town's men are in
 * the fight:
 *
 *   - `militiaOf`: the men at home turn out by bands, as a tribe's do (tribes.ts, `bandMen`: eight men to a band
 *     in towns of the size they are now), each band worth `MILITIA.worth` of a company, for they are townsmen
 *     and not soldiers; never more than `MILITIA.most`, since a wall has only so much room, and never less
 *     than `MILITIA.least` while there is a man in the town at all: a handful still bar a gate. A town with no
 *     man in it defends itself with nothing.
 *   - `militiaBands`: how many bands that is, for the fight itself (mapbattle.ts): where no army stands in the
 *     town they are its companies, on foot, so cavalry is the worse for meeting them and archers the better.
 *
 * A town with a man in it is the one point it was always given at the least, a town full of men up to twice
 * that, and an empty one nothing. (Without the least, at 384 campaigns the computer took the walled towns whose
 * men were away: sieges held fell from 67% to 63% and campaigns undecided or ruined rose to one in ten.) The men who die of it are
 * those the bands lost in the fight (militiatoll.ts): this weighs them, and that counts their dead.
 */
import type { Campaign } from './campaign';
import { bandMen } from './tribes';
import { folkOf } from './township';

export const MILITIA = {
  /** What a band of townsmen is worth beside a company of soldiers. */
  worth: 0.5,
  /** The most a town's own men can add to its defence, however many they are. */
  most: 2,
  /** And the least, for a town with any man in it at all: a handful still bar a gate. */
  least: 1,
};
/** Bands of its own men a town can turn out: the men at home, so many to a band (parts of a band count). */
export function militiaBands(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde) return 0;
  return Math.max(0, folkOf(c, tid).men) / bandMen();
}
/** What a town's own men add to its defence against a nation. */
export const militiaOf = (c: Campaign, tid: number): number => { const b = militiaBands(c, tid); return b <= 0 ? 0 : Math.round(Math.max(MILITIA.least, Math.min(MILITIA.most, b * MILITIA.worth)) * 10) / 10; };
