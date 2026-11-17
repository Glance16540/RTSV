// The buildings of a town that found no room on the field (docs/DESIGN.md: towns persist; the gathering session's
// job after the first-lay work, firstlay.ts).
//
// A town met in person for the first time is laid on the field as its record counts it, and a grown town has forty or
// fifty roofs. Where the ground near the hall is cliff, water or wood, some find no room even at the widest ring. They
// used to be left out, and since the field is written back as the town's record when the sitting ends, the town lost
// them for good: a first visit could cost a town its roofs.
//
// So a building that cannot be laid is kept, as fieldcap.ts keeps the people a field has no room for: it stays on the
// record with no place (`[type, -1, -1]`), is counted with the rest wherever the map counts a town's buildings (its
// room, its works), and is handed back with what stands when the field is written back. At the next sitting it is tried
// again (firstlay.ts layKept), and stands if room has been made.
// Kept only for the side that holds the ground after: a town taken by storm is the victor's camp, as before.
// Plain data: a list on the game, by side, and nothing else.
import type { Game, Standing } from './game';

declare module './game' {
  interface Game {
    /** The buildings of each side's town that found no room on this field, kept for its record (unlaid.ts). */
    unlaid?: Record<number, Standing[]>;
  }
}

/** The place of a building that has none on the field. */
export const NO_PLACE = -1;

/** Is this building of a record without a place on the field? */
export const isUnlaid = (x: readonly [string, number, number, ...unknown[]]): boolean => x[1] < 0 || x[2] < 0;

/** The same building with no place, as it was otherwise (its health, how far built). */
export function unplaced(x: Standing): Standing {
  const [type, , , health, built] = x;
  return built !== undefined ? [type, NO_PLACE, NO_PLACE, health ?? 0.01, built] : health !== undefined ? [type, NO_PLACE, NO_PLACE, health] : [type, NO_PLACE, NO_PLACE];
}

/** Keep a building of this side's town that the field has no room for. */
export function keepUnlaid(g: Game, owner: number, x: Standing): void {
  ((g.unlaid ??= {})[owner] ??= []).push(unplaced(x));
}

/** The buildings of this side's town kept off the field, for its record. */
export const unlaidOf = (g: Game, owner: number): Standing[] => (g.unlaid?.[owner] ?? []).map((x) => [...x] as Standing);

/** How many buildings of a record have no place. */
export const unlaidOn = (b: readonly Standing[] | undefined): number => (b ?? []).filter(isUnlaid).length;
