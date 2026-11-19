// The leader's stay in a town (the board's "The leader on the field": steadying a town was one effect only, on unrest).
// A town of their own people's that the leader goes to (court.ts: sent there, keeping to it, or riding with an army in
// it) feels it, each a modest share, every season the leader is there:
//   - faith: it is drawn toward its nation's standing LEADER_STAY.pull times as hard as any town is (townfaith.ts PULL);
//   - work: its people bring in LEADER_STAY.work as much from the land (harvest.ts);
//   - grief and drift: grief passes LEADER_STAY.grief times as fast (grief.ts), and the strain that sends its people to
//     the tavern and the mines and pulls its standing down weighs LEADER_STAY.strain as much (drift.ts).
// Not in the people's chief town, where the leader sits when nowhere else and the court is counted already (its yield,
// its unrest): the stay is the leader going out to a town, a choice with a cost elsewhere, not a standing gift to the seat.
// The same for every people, the player's and the rivals'. Readers only: it keeps nothing and rolls no dice.
import type { Campaign } from './campaign';
import { leaderAt } from './court';

export const LEADER_STAY = {
  /** How much harder a town the leader is in is drawn toward its nation's standing. */
  pull: 1.5,
  /** What its land yields, against a town without the leader. */
  work: 1.1,
  /** Seasons of grief that pass in one. */
  grief: 1.5,
  /** The share of the town's strain still felt. */
  strain: 0.85,
};

/** The leader of the town's own people is in it, and it is not their chief town. */
export const leaderStays = (c: Campaign, tid: number): boolean => { const t = c.territories[tid]; return !!t && t.owner >= 0 && t.capital !== t.owner && leaderAt(c, t.owner, tid); };

/** How much harder the town is drawn toward its nation's standing: LEADER_STAY.pull with the leader there, else 1. */
export const leaderPull = (c: Campaign, tid: number): number => (leaderStays(c, tid) ? LEADER_STAY.pull : 1);
/** What the town's land yields, as a share: LEADER_STAY.work with the leader there, else 1. */
export const leaderWork = (c: Campaign, tid: number): number => (leaderStays(c, tid) ? LEADER_STAY.work : 1);
/** Seasons of grief that pass in one: LEADER_STAY.grief with the leader there, else 1. */
export const leaderGrief = (c: Campaign, tid: number): number => (leaderStays(c, tid) ? LEADER_STAY.grief : 1);
/** The share of the town's strain still felt: LEADER_STAY.strain with the leader there, else 1. */
export const leaderEase = (c: Campaign, tid: number): number => (leaderStays(c, tid) ? LEADER_STAY.strain : 1);
