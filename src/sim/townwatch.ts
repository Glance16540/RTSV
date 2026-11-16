// Town Watch (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads). A study of the
// nation's (studies.ts), taught at a Watch House. A nation that has learned it keeps a proper watch in every town
// that has a Watch House standing.
//
//   Against bands: such a town counts a company more in its defence when a band strikes it (threats.ts `defenceOf`).
//   Against crime: fewer thieves and killers begin in the nation's towns at all (intrigue.ts).
//   In a town: the people turn out to a fire when called by the watch whether or not a Watch House stands there
//     (calamity.ts reads the side's techs).
//
// It reads only the nation's studies and the town's record of what stands, so that the threats' rules can ask it
// without a ring of imports. Strengths are first guesses.
import type { Campaign } from './campaign';
import { hasStudy, standsAt } from './studies';

export const TOWNWATCH = {
  /** What a town with a Watch House adds to its defence against a band, in companies, once the nation has the study. */
  defence: 1,
  /** What the chance of a thief or a killer beginning is multiplied by in a nation that has it. */
  crime: 0.7,
};

/** Does this town keep a town watch: its people have the study, and a Watch House stands there? */
export function keepsWatch(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  return !!t && t.owner >= 0 && hasStudy(c, t.owner, 'townwatch') && standsAt(c, tid, 'watchhouse');
}
/** What its town watch adds to a town's defence against a band, in companies. */
export const watchDefence = (c: Campaign, tid: number): number => (keepsWatch(c, tid) ? TOWNWATCH.defence : 0);
/** What the chance of a thief or a killer beginning among a people is multiplied by. */
export const crimeEdge = (c: Campaign, f: number): number => (hasStudy(c, f, 'townwatch') ? TOWNWATCH.crime : 1);
