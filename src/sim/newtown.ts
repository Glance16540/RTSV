/**
 * A town its people have just founded (founding.ts) is no mark for a band yet (the gathering session's job of 22
 * November 2026, after an empty land was left beside every chief town). A band goes for the softest town in its
 * reach, and a town of a few families with no works is always the softest: with every people founding one early,
 * bands fell on the new towns first. For `NEWTOWN.grace` seasons from its founding there is nothing in it worth
 * the march, and a band looks past it to the towns it would have struck before. Raiding is not cut by it: a band
 * with another town in reach strikes that one instead.
 * Reads the lands only.
 */
import type { Campaign } from './campaign';

export const NEWTOWN = {
  /** Seasons from its founding in which a town founded by settlers is no band's mark: two years. */
  grace: 8,
};
/** Is this a town settlers founded so lately that no band marks it yet? */
export function tooNewToRaid(c: Campaign, tid: number): boolean {
  const by = c.territories[tid]?.foundedBy;
  return !!by && c.turn - by.turn < NEWTOWN.grace;
}
/** Seasons of its grace a new town has left: 0 for any other town. */
export const graceLeft = (c: Campaign, tid: number): number => { const by = c.territories[tid]?.foundedBy; return by ? Math.max(0, NEWTOWN.grace - (c.turn - by.turn)) : 0; };
