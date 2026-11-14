// How the hours run. A day is a set number of seconds, and the last three tenths of it are night; the player
// may choose a shorter or longer day, or have no night at all. This is the arithmetic of it, apart from the game.

/** The lengths of day a player can choose, in seconds. */
export const DAY_LENGTHS = [180, 300, 600];
/** How far through the day the light begins to go: the hours stop here when night is switched off. */
export const DUSK = 0.66;

/**
 * How far through the day it is at `time`: 0 at dawn, 0.7 at nightfall, 1 at the next dawn.
 * With `nightless`, there is no nightfall: the hours run from dawn to dusk at the same pace as ever and then
 * back again to dawn, so the light never jumps and never goes.
 */
export function dayPhase(time: number, length: number, nightless = false): number {
  if (!nightless) return (time % length) / length;
  const span = DUSK * length;
  return DUSK * (1 - Math.abs((time % (2 * span)) / span - 1));
}
