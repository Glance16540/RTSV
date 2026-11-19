// Report only: what the Watch House and the Town Watch did, read like for like (docs/TUNING.md; scripts/health.test.ts).
//
// Each of their rules is one number at one point (watchhouse.ts WATCH, townwatch.ts TOWNWATCH). To read whether a rule
// does what its line says, towns with a Watch House cannot simply be set beside towns without: a governor raises one
// where a thief or a killer has been at work, so the towns that have one are the towns with the worst of it. So each
// time a rule is applied, what happened is counted beside what the SAME draw would have come to without it:
//   thief   a thief-season in a town with a Watch House: the thief taken, against taken with no Watch House;
//   clue    a killer-season there: a clue turned up, against one with no Watch House;
//   kill    a killer-season there: the killer killed, against killed with no Watch House;
//   begin   a season a people with Town Watch were looked at for a new thief or killer: one began, against one beginning
//           with no Town Watch;
//   held    a band's strike on a town that keeps a town watch: held off, against held off with a company less.
// Nothing is decided by any of this and nothing reads it but the report.
import type { Campaign } from './campaign';

export type WatchKey = 'thief' | 'clue' | 'kill' | 'begin' | 'held';
/** Times the rule was applied, times the thing happened with it, and times it would have happened without it. */
export interface WatchCount { n: number; did: number; would: number }

declare module './campaign' {
  interface Campaign {
    /** What the Watch House and the Town Watch did, beside what the same draws would have come to without them (watchtally.ts; report only). */
    watchTally?: Partial<Record<WatchKey, WatchCount>>;
  }
}

/** Count one application of a rule: what happened, and what would have without it. */
export function tallyWatch(c: Campaign, key: WatchKey, did: boolean, would: boolean): void {
  const t = ((c.watchTally ??= {})[key] ??= { n: 0, did: 0, would: 0 });
  t.n++; if (did) t.did++; if (would) t.would++;
}
