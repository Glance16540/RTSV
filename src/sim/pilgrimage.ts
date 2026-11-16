// Pilgrimage, a study of the nation's (studies.ts): its towns are drawn toward the nation's faith the faster
// (townfaith.ts: each season a town is drawn PULL of the way toward its nation's standing; with pilgrimage, more).
import type { Campaign } from './campaign';
import { hasStudy } from './studies';

export const PILGRIMAGE = { pull: 1.6 };
/** How much faster this nation's towns are drawn toward its faith: PILGRIMAGE.pull once it has learned Pilgrimage. */
export const pilgrimPull = (c: Campaign, f: number): number => (f >= 0 && hasStudy(c, f, 'pilgrimage') ? PILGRIMAGE.pull : 1);
