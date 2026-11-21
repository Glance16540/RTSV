// A Fortress keeps a garrison, and is a stronghold when a band strikes (docs/DESIGN.md, "Buildings and research that
// answer the systems": a Fortress stands in the town as a stronghold against bands; docs/CLOSING.md: "no garrison is
// kept in it between seasons").
//
// On the map a Fortress was three companies' worth of works against a band (threats.ts) and somewhere for the people to
// go (fortress.ts). It held no soldiers: a town with a Fortress and no army in it met a band with its townsmen alone.
// Here it keeps a garrison, season in and season out, with no order given:
//
//   Who. Men of the town itself, and nobody from nowhere: so many companies as the town can spare men for (a man to a
//     company as towns are sized, armytown.ts MEN.company) while it keeps KEEP.atHome men at their own work, and never
//     more than KEEP.companies. They stay on the town's record, in their houses and at its work between strikes; they
//     are the men who have the keeping of the Fortress, drilled and armed, and when a band comes they stand as soldiers
//     and not as townsmen. A town with too few men has no garrison, and its Fortress is walls and nothing more.
//   When. Only where no army of the town's people stands in it: an army there is the garrison, and holds the Fortress.
//   What they are worth. Each company counts as a company of foot in the town's defence (the `army` part of what it
//     has, threats.ts `defenceOf`) and fights as one in the clash (raidclash.ts). The townsmen's own part is reckoned
//     without those men, so nobody stands twice.
//   A stronghold. A Fortress with anyone to hold it (its garrison, or an army) is a stronghold: a band that breaks the
//     town has the run of its streets and stores, but not of the keep, where its people are. Such a town is raided and
//     never taken (raidclash.ts reads `stronghold`): nobody is carried off from it. An empty Fortress is no stronghold.
//
// What the garrison loses in a fight is counted with the town's men, by the share of its side that fell (threats.ts):
// they are the same men. It reads the town's record and the land's works, and changes nothing.
import type { Campaign } from './campaign';
import { MEN } from './armytown';
import { hasFortress } from './fortress';
import { TOWN_SCALE, folkOf } from './township';

export const KEEP = {
  /** The most companies a Fortress's garrison stands at. */
  companies: 2,
  /** Men the town keeps at their own work before any is spared for the garrison, in towns of the old size (times TOWN_SCALE now). */
  atHome: 2,
};

/** The companies of a Fortress's own garrison in this town: its own men, as many as it can spare; none without a Fortress, a holder or the men. */
export function keepOf(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde || !hasFortress(c, tid)) return 0;
  const spare = Math.floor(folkOf(c, tid).men) - KEEP.atHome * TOWN_SCALE;
  return Math.max(0, Math.min(KEEP.companies, Math.floor(spare / Math.max(1, MEN.company))));
}
/** The men of the town who make up that garrison. */
export const keepMen = (c: Campaign, tid: number): number => keepOf(c, tid) * MEN.company;
/** The garrison as companies for a fight: foot. Empty where there is none. */
export const keepUnits = (c: Campaign, tid: number): Record<string, number> => { const k = keepOf(c, tid); return k > 0 ? { infantry: k } : {}; };
/** Is this town's Fortress a stronghold now: has it anyone to hold it, its own garrison or an army of its people standing there? */
export function isStronghold(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || !hasFortress(c, tid)) return false;
  return keepOf(c, tid) > 0 || c.armies.some((a) => a.at === tid && a.owner === t.owner);
}
