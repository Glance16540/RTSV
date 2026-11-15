// A town kept in peace (docs/DESIGN.md, "A visit"). When the computer keeps a campaign town for the player on a
// visit, or for itself, with no enemy present or threatening, it keeps the town: it works, houses its couples and
// builds what a town lives by, and raises no military works (barracks, range, stable, siege workshop, towers or
// walls). A visit's buildings stay on the map (visit.ts), and works of war left there would have the town's men
// raised from it on the next turn.
import type { Game } from './game';

/** The works a town keeps for war. */
export const MILITARY_WORKS = ['barracks', 'range', 'stable', 'workshop', 'tower'];

/**
 * Is this town in peace: a campaign town (born-only), no marauders about, and nobody in the game who is not an
 * ally or a neutral party? Beasts belong to the wild, which is neutral.
 */
export function inPeace(g: Game, owner: number): boolean {
  if (!g.bornOnly || g.marauders) return false;
  return g.players.every((p) => p.id === owner || p.neutral || p.defeated || !g.hostile(p.id, owner));
}
