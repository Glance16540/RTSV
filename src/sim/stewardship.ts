// Stewardship, a study of the nation's (studies.ts): a better governor. What a town's governor has begun is taken
// further half again as fast each season (governor.ts).
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

export const STEWARDSHIP = { build: 1.5 };
/** How much faster a town's governor builds: STEWARDSHIP.build once its nation has learned Stewardship. */
export const stewardPace = (c: Campaign, tid: number): number => { const f = c.territories[tid]?.owner ?? -1; return f >= 0 && hasStudy(c, f, 'stewardship') ? STEWARDSHIP.build : 1; };
