// What a season truly added to what the player has to spend (docs/PLAYTEST.md 4.6: the bar said "+8 each turn" from
// the lands' yield, while what there was to spend rose three or four a season). Supplies are what the towns hold above
// their working stock (stores.ts), so a season's gain is the yield less what the towns ate, what spoiled, the upkeep,
// what the governors raised out of the stores, a failed harvest and a raid. It is measured, not foretold: the figure
// as the player ends the turn, against the figure as the next turn opens, so what the player spent in the turn is not
// counted against the season. Two calls a season (campaign.ts endTurn and the turn's opening).
import type { Campaign } from './campaign';

declare module './campaign' {
  interface Campaign {
    /** What the player had to spend as the last turn was ended, and what the season after it added (seasongain.ts). */
    seasonGain?: { left?: number; gained?: number; turn?: number };
  }
}

/** The player ends the turn: what there is to spend now (the nation's figure, which what was spent has already left), to measure the season against. Reads only. */
export function turnLeft(c: Campaign): void {
  (c.seasonGain ??= {}).left = c.factions[0]?.supplies ?? 0;
}

/** A new turn opens, the season's income and losses in the stores: what it added, for the bar. */
export function turnOpened(c: Campaign): void {
  const g = c.seasonGain;
  if (g?.left === undefined) return;
  g.gained = (c.factions[0]?.supplies ?? 0) - g.left;
  g.turn = c.turn;
  delete g.left;
}

/** What the last season added to what the player has to spend, or undefined before a season has been measured. */
export const lastGain = (c: Campaign): number | undefined => (c.seasonGain?.turn === c.turn ? c.seasonGain.gained : undefined);
