// The church's tending, and grain bought abroad, inside a town (docs/DESIGN.md, "Drift" and "Decrees": the six decrees
// bend drift "on the map and in the town").
//
// On the map (decrees.ts, drift.ts) a decree to tend the sick and the mourning makes sickness and grief weigh on the
// town's strain TEND_EASE less at full strength, and plague takes TEND_PLAGUE fewer. In a battle or a visit the town is
// under the same decree (driftintown.ts `decreesHere`, handed in with its people), and here it does the same:
//   - its strain toward worse (driftintown.ts `townStrain`) weighs its sick and its grieving houses TEND_EASE less;
//   - plague wears its sick down TEND_PLAGUE the slower (game.ts, beside an Infirmary's own care, infirmary.ts).
// Grain bought abroad (grain.ts) acts in a town by what it is: the food is put in the town's stores when the decree is
// given, and the battle or visit fights out of those stores (township.ts musterFolk), so the town is the less hungry.
// Plain data in: the decrees the town turned out under. Nothing is drawn.
import type { Game } from './game';
import { TEND_EASE, TEND_PLAGUE } from './decrees';
import { decreesHere } from './driftintown';

/** The strength of the church's tending in this people's town, 0 if none. */
export const tendHere = (g: Game, owner: number): number => decreesHere(g, owner).tend ?? 0;
/** How much sickness and grief weigh on the town's strain: 1, and TEND_EASE less at full tending (driftintown.ts reads the decree itself). */
export const tendStrain = (g: Game, owner: number): number => 1 - TEND_EASE * tendHere(g, owner);
/** How fast plague wears this people's sick down: 1, and TEND_PLAGUE slower at full tending. */
export const tendSick = (g: Game, owner: number): number => 1 - TEND_PLAGUE * tendHere(g, owner);
