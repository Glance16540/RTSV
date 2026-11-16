// Spymasters, a study of the nation's (studies.ts): a plot against the leader is found the sooner (courtstory.ts).
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

export const SPYMASTERS = { odds: 0.15 };
/** What spymasters add to the season's chance of laying a plot bare. */
export const spyOdds = (c: Campaign, f: number): number => (f >= 0 && hasStudy(c, f, 'spymasters') ? SPYMASTERS.odds : 0);
