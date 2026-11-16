// Oaths of Fealty, a study of the nation's (studies.ts): its nobles' moods swing less. A decree pleases or angers
// them less, and a hard season sours them less (nobles.ts).
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

export const OATHS = { steady: 0.6 };
/** How far a noble's mood swings for this nation: OATHS.steady once it has sworn its nobles. */
export const oathSteady = (c: Campaign, f: number): number => (f >= 0 && hasStudy(c, f, 'oaths') ? OATHS.steady : 1);
