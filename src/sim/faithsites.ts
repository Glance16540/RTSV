// A Church or a Tavern built in a town is a Church or a Tavern on the map (docs/DESIGN.md, "Towns persist": what is
// built in a town is kept on its record; docs/CLOSING.md, before the move, 2).
//
// What the player builds in a battle fought in person, or on a visit, is kept on the town's record building for building
// (campaign.ts finishBattle, visit.ts finishVisit), and a Farmland, a Barracks, a Range, a Stable or a Harbour built
// there is raised as the map's site of that kind (campaignbase.ts SITE_BUILDING). A Church and a Tavern were not: they
// stood on the record and did nothing on the map, so a town where the player built a church was no more pious for it,
// and one where a tavern was built no more worldly and no richer. Here they are raised the same way: where the land has
// room (campaignbase.ts `slots`) and has none of that kind, a finished one becomes the map's site, which moves the
// town's faith each season (townfaith.ts) and, for a Tavern, pays as a Tavern does.
//
// It is a table of its own and not two more rows of SITE_BUILDING, because that table is also read the other way: a
// land's sites are laid as buildings in the holder's town when a battle begins there, and a town's Church and Tavern are
// already on its record, so they would stand twice.
//
// It reads the town's record as it was handed back and writes the land's sites and the log.
import type { Campaign } from './campaign';
import { SITES, slots } from './campaignbase';

/** The map's site of faith, and the building in a town that is one. */
export const FAITH_SITES: Record<string, string> = { church: 'temple', tavern: 'tavern' };

/**
 * Raise the Church and the Tavern that stand finished in a town (`standing`: its record, each `[type, x, y, health?,
 * built?]`, where a fifth part means it was never finished) as the map's sites, where the land has room and has none.
 * `when` is how the log says it was built ("in the fighting", "on your visit"). Returns the sites raised.
 */
export function raiseFaithSites(c: Campaign, tid: number, standing: readonly (readonly unknown[])[], when: string): string[] {
  const land = c.territories[tid], raised: string[] = [];
  if (!land) return raised;
  for (const [site, type] of Object.entries(FAITH_SITES)) {
    if (land.buildings.includes(site) || land.buildings.length >= slots(land)) continue;
    if (!standing.some((x) => x[0] === type && x[4] === undefined)) continue; // a finished one
    land.buildings.push(site);
    raised.push(site);
    c.log.push(`The ${SITES[site].name} you built ${when} stands in ${land.name}.`);
  }
  return raised;
}
