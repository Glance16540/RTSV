// The roads (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads). What an Inn and
// two studies do for a convoy on the road (convoys.ts reads these; the Inn's own rules, and its governor, are inn.ts).
//
//   An Inn. A convoy whose road passes through a town of its people where an Inn stands has somewhere to lie up
//     behind a door: highwaymen (and pirates, where the road crosses the sea) are half as likely to meet it.
//   Escorts, a study taught at an Inn: every convoy goes with a few hired men, and a band that stops one takes
//     half as much as it would have.
//   Paved Roads, a study taught at an Inn: the carts go quicker and drier, and the food a convoy brings in goes a
//     quarter further than what was loaded. (A convoy sent in a season was never late: it comes in as that season
//     turns, before the town eats. Paved Roads first brought it in the moment it was sent, which gained no meal
//     and put the food in the town before the season's bands, fires and spending; the health report read more
//     hunger with it than without, so that was taken out.)
//
// It reads only the nation's studies and the towns' records of what stands, so that the convoys' rules can ask it
// without a ring of imports. Strengths are first guesses.
import type { Campaign } from './campaign';
import { hasStudy, standsAt } from './studies';

export const ROADS = {
  /** What the chance that a band meets a convoy is multiplied by when an Inn stands in a town on its road. */
  inn: 0.5,
  /** What a band's share of a convoy's stores is multiplied by for a people with Escorts. */
  escorts: 0.5,
  /** What the food a convoy brings in is multiplied by for a people with Paved Roads. */
  load: 1.25,
};

/** Does an Inn stand finished in this town? */
export const hasInn = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'inn');
/** How likely a band is to meet a convoy on this road, against a road with no Inn: an Inn in any town of its people on the way. */
export const innRisk = (c: Campaign, owner: number, road: number[]): number => (road.some((tid) => c.territories[tid]?.owner === owner && hasInn(c, tid)) ? ROADS.inn : 1);
/** What a band that stops this people's convoy takes of it, against what it would take from another's. */
export const escortEdge = (c: Campaign, f: number): number => (hasStudy(c, f, 'escorts') ? ROADS.escorts : 1);
/** Are this people's roads paved? */
export const paved = (c: Campaign, f: number): boolean => hasStudy(c, f, 'pavedroads');
/** The food a convoy of this people brings in for this much loaded: more on Paved Roads. */
export const pavedLoad = (c: Campaign, f: number, food: number): number => (paved(c, f) ? Math.floor(food * ROADS.load) : food);
