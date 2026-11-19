// What binds two peoples beyond a truce (docs/DESIGN.md, "Relationships"; the audit, "diplomacy has no royal marriages
// or trade deals"): the record the two kinds of pact share.
//
// A pact is between any two peoples, the player's or two rivals': a royal marriage (royalmarriage.ts), which keeps the
// peace between them while it holds, or a trade deal (tradedeal.ts), which opens each one's markets to the other's
// caravans. Until now only the player could be at peace with anyone (a truce, an alliance: campaignbase.ts atTruce);
// two rivals were always at war. A marriage between two rivals' houses is the first peace between them, read by
// atTruce like any other, so neither marches on the other while it holds.
// Plain data on the campaign: this module imports nothing but types.
import type { Campaign } from './campaign';

export type PactKind = 'marriage' | 'trade';
export interface Pact {
  kind: PactKind; a: number; b: number; since: number; until: number;
  /** A marriage: the two of the houses wed, a's and b's. */
  wed?: [string, string];
  /** A marriage: a child of both houses, a record only until grown; its turn of birth. */
  child?: { name: string; female: boolean; born: number; told?: boolean };
}
declare module './campaign' {
  interface Campaign { /** Marriages and trade deals between peoples (pacts.ts). */ pacts?: Pact[] }
}

const pair = (p: Pact, a: number, b: number): boolean => (p.a === a && p.b === b) || (p.a === b && p.b === a);
/** The pact of this kind between two peoples that holds now, if any. */
export const pactOf = (c: Campaign, kind: PactKind, a: number, b: number): Pact | undefined => (c.pacts ?? []).find((p) => p.kind === kind && pair(p, a, b) && p.until >= c.turn);
/** Are two peoples bound in peace by a royal marriage? */
export const wedPeace = (c: Campaign, a: number, b: number): boolean => a !== b && a >= 0 && b >= 0 && !!pactOf(c, 'marriage', a, b);
/** Are two peoples' markets open to each other's caravans? A people's own always are. */
export const marketsOpen = (c: Campaign, a: number, b: number): boolean => a === b || (a >= 0 && b >= 0 && !!pactOf(c, 'trade', a, b));
/** Break every pact between two peoples (one has marched on the other). Returns how many were broken. */
export function breakPacts(c: Campaign, a: number, b: number): number {
  let n = 0;
  for (const p of c.pacts ?? []) if (pair(p, a, b) && p.until >= c.turn) { p.until = c.turn - 1; n++; } // a marriage stays on record, its peace over
  return n;
}
/** Pacts run out, or end with a people that is gone. */
export function pactsSeason(c: Campaign): void {
  // A marriage is kept on record after its peace has run out, for the child of both houses (royalmarriage.ts); the most recent PACT_KEEP.
  c.pacts = (c.pacts ?? []).filter((p) => c.factions[p.a]?.alive && c.factions[p.b]?.alive && (p.kind === 'marriage' || p.until >= c.turn)).slice(-PACT_KEEP);
}
/** Pacts kept on record at most. */
export const PACT_KEEP = 40;
