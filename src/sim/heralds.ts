// Heralds (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads). A study of the
// nation's (studies.ts), taught at a Watch House: raid news a season sooner.
//
// Without it a people hears of a band when it strikes. With it, as each season ends, heralds bring word of every
// band that has one of its towns for its mark: which band, how strong, and which town. And a town that has been
// warned stands to: when a band strikes it the season after, its defence counts half a company more.
//
// This holds the record of who was warned and what it is worth (so the threats' rules can read it with no ring of
// imports); the season's telling, which must ask the bands for their marks, is raidnews.ts `heraldSeason`.
// Strengths are first guesses.
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

declare module './campaign' {
  interface Campaign { /** The season each town was last warned of a band by heralds (heralds.ts), by land. */ heralded?: Record<number, number> }
}

export const HERALDS = {
  /** What a town warned the season before adds to its defence against a band, in companies. */
  stoodTo: 0.5,
};

/** Does this people keep heralds? */
export const keepsHeralds = (c: Campaign, f: number): boolean => f >= 0 && hasStudy(c, f, 'heralds');
/** A town is warned of a band this season. */
export function warn(c: Campaign, tid: number): void { (c.heralded ??= {})[tid] = c.turn; }
/** Was this town warned last season (or this one): is it standing to? */
export const warned = (c: Campaign, tid: number): boolean => { const w = c.heralded?.[tid]; return w !== undefined && c.turn - w <= 1; };
/** What standing to adds to a town's defence against a band, in companies. */
export const stoodTo = (c: Campaign, tid: number): number => (warned(c, tid) && keepsHeralds(c, c.territories[tid]?.owner ?? -1) ? HERALDS.stoodTo : 0);
