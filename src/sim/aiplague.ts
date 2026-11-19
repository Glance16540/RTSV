// The computer's armies and plague on the map (docs/systems-board, "Computer opponent": it never moved an army out of a
// plagued land).
//
// Plague in a land (acts.ts) costs an army of its holder's kept there a company a season, and may pass to the land
// next door. So a rival ruler, choosing where its armies go:
//   - marches on a sick land only when nothing it dares is healthy (the lands it would take, sick ones last);
//   - takes an army with nothing to do out of a sick land, to a healthy land of its own next door with no army in it;
//   - does not step into a sick land of its own on the way to a border or to a better one.
// It still fights for a sick land if that is the only thing it dares: a plague is a cost, not a wall.
import type { Army, Campaign } from './campaign';

/** Is there plague in this land this season? */
export const sickAt = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.kind === 'plague' && e.at === tid && e.until >= c.turn);

/** Lands to march on, the sick ones put last, the order otherwise kept. */
export function sickLast(c: Campaign, lands: number[]): number[] {
  const healthy = lands.filter((id) => !sickAt(c, id)), sick = lands.filter((id) => sickAt(c, id));
  return [...healthy, ...sick];
}

/** Where an army in a sick land with nothing else to do should go: a healthy land of its people's next door with no army in it; -1 if it is not sick, or there is none. */
export function leavePlague(c: Campaign, a: Army): number {
  if (!sickAt(c, a.at)) return -1;
  const t = c.territories[a.at];
  const away = t.adj.map((id) => c.territories[id]).find((n) => n.owner === a.owner && !n.horde && !sickAt(c, n.id) && !c.armies.some((x) => x.at === n.id));
  return away ? away.id : -1;
}

/** May an army step through this land of its own on the way somewhere? Not into a sick one. */
export const safeStep = (c: Campaign, tid: number): boolean => tid < 0 || !sickAt(c, tid);
