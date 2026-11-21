// A house is not forgotten when its men come home (docs/DESIGN.md, "A man at war is still of his house": he comes home to
// it; docs/CLOSING.md, the "Not yet" of that line: a house on the map is kept by name only while it has a man away, one
// lately fallen, or deeds to its name).
//
// The map keeps a town's houses by name on the record of its men at war (warhouse.ts, `Folk.houses`). A house with
// nobody away, nobody fallen in WARHOUSE.remembered seasons and no deeds was dropped, so that an ordinary house with
// everyone home became a count again and a man came home to a house then forgotten. Now such a house is kept while the
// town has a home for it: as many houses as it has women, one to a home (as mapgrief.ts counts homes). Where the town
// has fewer homes than houses on record, the houses its men were last away from longest ago go first. So the same houses
// send their men to war again (warhouse.ts enlist asks the houses on record first), and a man comes home to his own.
// The cost to the record: a house is some 120 to 175 bytes on a saved game; a town keeps at most one for each of its
// women (a campaign of twenty years: a few hundred houses more, some 40 to 60 thousand bytes). A saved game from before
// loads as it is: the houses it had are kept from now on.
import type { Folk } from './township';
import type { WarHouse } from './warhouse';

declare module './warhouse' {
  interface WarHouse { /** The last turn a man of the house was away with an army (housekeep.ts). */ seen?: number }
}

/** How many houses a town has homes for: one to each of its women, and at least one. */
export const homesFor = (f: Folk): number => Math.max(1, f.women);

/**
 * Of a town's houses with nobody away and nothing else to keep them (`idle`), those it keeps by name: while it has homes
 * for them over the houses kept for their men (`busy`), the most lately at war first. `turn`: now.
 */
export function keepIdle(f: Folk, busy: readonly WarHouse[], idle: readonly WarHouse[], turn: number): WarHouse[] {
  for (const h of busy) if (h.away.length) h.seen = turn;
  const room = Math.max(0, homesFor(f) - busy.length);
  if (!room) return [];
  return [...idle].sort((a, b) => (b.seen ?? 0) - (a.seen ?? 0)).slice(0, room);
}
