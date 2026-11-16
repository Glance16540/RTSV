// What stands on a town's record (`Territory.town.b`), read without anything else: for the rules modules that ask
// whether a building of theirs is there (granary.ts, mill.ts, well.ts, infirmary.ts), so they need import nothing
// that imports them back. studies.ts and townworks.ts ask the same of the record by their own names.
import type { Campaign } from './campaign';

/** Is one begun or standing on the town's record? */
export const onRecord = (c: Campaign, tid: number, type: string): boolean => !!c.territories[tid]?.town?.b?.some((x) => x[0] === type);
/** Is one standing finished on the town's record? */
export const standing = (c: Campaign, tid: number, type: string): boolean => !!c.territories[tid]?.town?.b?.some((x) => x[0] === type && x[4] === undefined);
