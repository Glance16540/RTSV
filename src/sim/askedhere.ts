// The dilemmas a town has been asked, kept on its record from one visit or battle there to the next (docs/systems-
// board, "Moral standing": a long campaign of visits could be asked the same one again in a later visit).
//
// A people in a town works through its dilemmas in an order of its own, each fitting one before any comes round
// again (dilemmas.ts, `Player.asked`). In a campaign that list is the town's: it goes into a visit, or a battle the
// player fights there for a town of their own (`bonus.asked`), and comes home with what was asked there, onto the
// land's record (`Territory.asked`). Only names of dilemmas there are are kept, at most one round's worth.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { DILEMMAS } from './creed';

declare module './campaign' {
  interface Territory { /** The dilemmas the player's people here have been asked in the round now going (askedhere.ts). */ asked?: string[] }
}

const KNOWN = (): Set<string> => new Set(DILEMMAS.map((d) => d.id));

/** What a town has been asked, to carry into a visit or battle there; undefined if nothing. */
export function askedFor(c: Campaign, tid: number): string[] | undefined {
  const a = c.territories[tid]?.asked;
  return a?.length ? [...a] : undefined;
}
/** What the player's people were asked in a battle or visit, to carry home. */
export const askedOut = (g: Game, pid: number): string[] => [...(g.players[pid]?.asked ?? [])];
/** Keep on a town's record what was asked there, if the town is still the player's. Anything not a dilemma's name is dropped. */
export function keepAsked(c: Campaign, tid: number, v: unknown): void {
  const t = c.territories[tid];
  if (!t || t.owner !== 0 || !Array.isArray(v)) return;
  const known = KNOWN(), kept = [...new Set(v.filter((x): x is string => typeof x === 'string' && known.has(x)))].slice(-DILEMMAS.length);
  if (kept.length) t.asked = kept; else delete t.asked;
}
