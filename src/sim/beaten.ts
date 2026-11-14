// When a people is beaten. A town used to stand until its last building fell, which left a won war to drag on
// through eighty houses and fields. Now the Town Center is the heart of it: a people whose last Town Center has
// fallen has a minute and a half to begin another (twenty seconds if it has no soldier left), and if it does not,
// it is beaten, whatever else still stands.
// (Losing every building still beats it at once, as before. A war band of raiders that has never raised a hall
// has none to lose, and is beaten as it always was: when its last person is gone. Once it has settled it is a
// people like any other.)

/** Seconds a people has to begin a new Town Center after its last one falls. */
export const HALL_GRACE = 90;
/** Seconds it has when it has not one soldier left to guard the work. */
export const ROUT_GRACE = 20;
/** Seconds it has when it begins a battle without one: a town whose hall was razed in an earlier siege. */
export const RAZED_GRACE = 300;
/** Warnings are given when this many seconds are left. */
export const HALL_WARNINGS = [60, 20];

/** What the rule keeps for each people. */
export interface HallState {
  /** It has had a Town Center in this battle (or began it with one razed): only then can losing it beat it. */
  hadHall?: boolean;
  /** The moment by which a Town Center must be standing or begun. Not set while one is. */
  hallDue?: number;
  /** The clock was set at the start of the battle, for a town already razed: it is not cut short for want of soldiers. */
  razedStart?: boolean;
}

export type HallNews = 'fine' | 'lost' | 'raised' | 'warn' | 'beaten';

/**
 * Move a people's clock on. `hasHall` is whether a Town Center of theirs stands, finished or begun.
 * `step` is how long since the last call, so that each warning is given once. `helpless` is whether it has no
 * soldier left: then the time it has is cut to ROUT_GRACE.
 */
export function hallClock(p: HallState, hasHall: boolean, time: number, step: number, helpless = false): HallNews {
  if (hasHall) {
    const was = p.hallDue !== undefined;
    p.hadHall = true;
    p.hallDue = undefined;
    p.razedStart = undefined;
    return was ? 'raised' : 'fine';
  }
  if (!p.hadHall) return 'fine';
  if (p.hallDue === undefined) { p.hallDue = time + (helpless ? ROUT_GRACE : HALL_GRACE); return 'lost'; }
  if (helpless && !p.razedStart && p.hallDue - time > ROUT_GRACE) { p.hallDue = time + ROUT_GRACE; return 'warn'; } // its last soldier has fallen since
  if (time >= p.hallDue) return 'beaten';
  const left = p.hallDue - time;
  return HALL_WARNINGS.some((w) => left <= w && left + step > w) ? 'warn' : 'fine';
}

/** Seconds left to a people with no Town Center, or -1 when no clock is running. */
export const hallLeft = (p: HallState, time: number): number => (p.hallDue === undefined ? -1 : Math.max(0, Math.ceil(p.hallDue - time)));
