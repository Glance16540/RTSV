// The Hall of Judgement (docs/DESIGN.md, "Buildings and research that answer the systems": rule and law).
//
// The leader's seat in a town. It stands on the town's record (townworks.ts), raised from the map or built in the
// town, and while it stands:
//   - a decree given to the town has its full strength, as if the leader were there, not a messenger's (decrees.ts);
//   - the town's thieves, killers and plotters are judged there: a plotter of the town is found out, and a killer's
//     clues turn up, as surely as if the leader's court were in the town (courtstory.ts, intrigue.ts);
//   - the nation's nobles gather at it: their tempers cool half again as fast while the nation has one (nobles.ts),
//     and an angry noble of the town keeps his watch against bands, as when the leader is there.
// A rival nation raises one in its chief town when it has none and its stores hold one and a half working stocks
// over the cost (rule.ts, RULE_KEEP). The player raises theirs from the land's panel: the governor does not.
import type { Campaign } from './campaign';
import { leaderAt } from './court';
import { standsAt } from './studies';

export const HALL = {
  /** How much faster the nobles' tempers cool while the nation has a Hall (nobles.ts). */
  ease: 1.5,
};

/** Is a Hall of Judgement standing in this town? */
export const hallAt = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'hall');
/** Is the town judged as the leader's own seat: the leader there, or a Hall of the town's people standing in it? */
export const seatAt = (c: Campaign, f: number, tid: number): boolean => leaderAt(c, f, tid) || (c.territories[tid]?.owner === f && hallAt(c, tid));
/** How strong a decree given to this town is: whole at the leader's seat, else the messenger's `messenger`. */
export const decreeStrength = (c: Campaign, f: number, tid: number, messenger: number): number => (seatAt(c, f, tid) ? 1 : messenger);
/** How much faster a nation's nobles' tempers cool: HALL.ease while it has a Hall, else 1. */
export const nobleEase = (c: Campaign, f: number): number => (f >= 0 && c.territories.some((t) => t.owner === f && !t.horde && hallAt(c, t.id)) ? HALL.ease : 1);
