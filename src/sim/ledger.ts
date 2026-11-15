// The season's ledger: what the season's own systems did to each town's people that is not kept anywhere else
// (born, came of age, died of age, died of hunger, fell with the army), noted as it happens so that a report of the
// season can be drawn from it (seasonreport.ts). Plain data on the campaign; nothing here decides anything.
import type { Campaign } from './campaign';

export type LedgerKind = 'born' | 'grew' | 'aged' | 'starved' | 'fell';
/** One thing that happened to a town's people: `seq` counts every entry ever made, so a report can take those since it last looked. */
export interface LedgerEntry { seq: number; turn: number; at: number; owner: number; kind: LedgerKind; n: number }

declare module './campaign' {
  interface Campaign { /** The season's ledger (ledger.ts), and how many entries have ever been made. */ ledger?: LedgerEntry[]; ledgerSeq?: number }
}

/** Seasons an entry is kept. */
export const LEDGER_SEASONS = 4;

/** Note that `n` of a town's people were born, came of age, died of age or of hunger, or fell with the army. */
export function tally(c: Campaign, at: number, kind: LedgerKind, n: number): void {
  if (!(n > 0)) return;
  const l = (c.ledger ??= []);
  c.ledgerSeq = (c.ledgerSeq ?? 0) + 1;
  l.push({ seq: c.ledgerSeq, turn: c.turn, at, owner: c.territories[at]?.owner ?? -1, kind, n });
  if (l[0].turn < c.turn - LEDGER_SEASONS) c.ledger = l.filter((e) => e.turn >= c.turn - LEDGER_SEASONS);
}
/** Entries made since a given `seq`. */
export const ledgerSince = (c: Campaign, seq: number): LedgerEntry[] => (c.ledger ?? []).filter((e) => e.seq > seq);
