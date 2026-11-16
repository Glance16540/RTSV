// The Fortress as a stronghold (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads).
// A Fortress has been a work of the land on the map (campaignbase.ts SITES; the governor raises one when a town has
// been raided, governor.ts): defence against an army, towers when the town is fought over, and three companies'
// worth against a band (threats.ts). This makes it a real building in the town as well, and gives it a garrison.
//
// In a town. It is a building (data.ts `fortress`): a stronghold that does not shoot (the towers do that) but takes
// in a dozen people when the bell rings, and stands a long time. A town whose land has a Fortress stands with one,
// beside its two towers, when a battle or a visit is laid out. Villagers can raise one in a town that has none, and
// a Fortress standing in the town is a Fortress on the map from then on, whether or not the land has the work.
//
// On the map. When a band strikes a town with a Fortress, its people have somewhere to go: half as many of its men
// die at the walls, and half as many of its people are carried off, as from a town without one.
//
// It reads only the land's works and the town's record of what stands, so that the threats' rules can ask it
// without a ring of imports. Strengths are first guesses.
import type { Campaign } from './campaign';
import { standsAt } from './studies';

export const FORT = {
  /** What the dead and the carried off are multiplied by when a band strikes a town with a Fortress. */
  shelter: 0.5,
};

/** Has this town a Fortress: the land's own work, or one standing finished in the town? */
export function hasFortress(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  return !!t && (t.buildings.includes('fortress') || standsAt(c, tid, 'fortress'));
}
/** What a band's toll of dead and carried off in this town is multiplied by: its people shelter in the Fortress. */
export const fortShelter = (c: Campaign, tid: number): number => (hasFortress(c, tid) ? FORT.shelter : 1);
