// Written Law, a study of the nation's (studies.ts): it eases unrest and a taken town's resentment. A town of a
// nation with written law is less likely to fall into unrest (unrest.ts), and its resentment of having been taken
// eases the faster each season (conquered.ts).
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

export const WRITTEN_LAW = { unrest: 0.8, yoke: 1 };
const knows = (c: Campaign, tid: number): boolean => { const f = c.territories[tid]?.owner ?? -1; return f >= 0 && hasStudy(c, f, 'writtenlaw'); };
/** The share of its chance of unrest a town keeps under written law. */
export const lawUnrest = (c: Campaign, tid: number): number => (knows(c, tid) ? WRITTEN_LAW.unrest : 1);
/** What written law takes off a taken town's resentment a season, beside its other good rule. */
export const lawEase = (c: Campaign, tid: number): number => (knows(c, tid) ? WRITTEN_LAW.yoke : 0);
