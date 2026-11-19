// The leader's stay in a town (the board's "The leader on the field": steadying a town was one effect only, on unrest).
// A town of their own people's that the leader goes to (court.ts: sent there, keeping to it, or riding with an army in
// it) feels it every season the leader is there. Every leader draws it toward its nation's standing (`pull`); the rest
// follows their calling (hero.ts), each a modest share, and every calling spends the same weight (LEAN_WEIGHT: the
// shares by which its factors stand off 1, added up), only on different things:
//   - a Steward keeps the town: its land yields more (`work`, harvest.ts), what it is building goes up faster (`build`,
//     governor.ts), and its grief passes sooner (`grief`, drift.ts);
//   - a Warlord steadies it: its strain weighs less (`strain`, drift.ts), unrest is less likely in the people's towns
//     beside it (`steady`, unrest.ts; in the town itself it never begins), and its own men count for more in its
//     defence (`militia`, militia.ts);
//   - a Strategist watches the roads: convoys whose road passes the town are met by a band less often (`roads`,
//     convoys.ts), the town stands readier against a band (`watch`, threats.ts), and its grief and strain ease a little.
// Not in the people's chief town, where the leader sits when nowhere else and the court is counted already (its yield,
// its unrest): the stay is the leader going out to a town, a choice with a cost elsewhere, not a standing gift to the seat.
// The same for every people, the player's and the rivals'. Readers only: it keeps nothing and rolls no dice.
import type { Campaign } from './campaign';
import { heroFor } from './campaignbase';
import { leaderAt } from './court';
import type { Calling } from './hero';

/** What a stay does, as factors on what it touches (1 is nothing). */
export interface Stay {
  /** How much harder the town is drawn toward its nation's standing. */
  pull: number;
  /** What its land yields. */
  work: number;
  /** How fast what it is building goes up. */
  build: number;
  /** Seasons of grief that pass in one. */
  grief: number;
  /** The share of its strain still felt. */
  strain: number;
  /** The chance of unrest in the people's towns beside it. */
  steady: number;
  /** What its own men add to its defence. */
  militia: number;
  /** The chance a band meets a convoy whose road passes it. */
  roads: number;
  /** Its defence against a band. */
  watch: number;
}

const NONE: Stay = { pull: 1, work: 1, build: 1, grief: 1, strain: 1, steady: 1, militia: 1, roads: 1, watch: 1 };

export const LEADER_STAY: Record<Calling, Stay> = {
  steward: { ...NONE, pull: 1.5, work: 1.2, build: 1.25, grief: 1.25, strain: 0.95 },
  warlord: { ...NONE, pull: 1.5, grief: 1.1, strain: 0.8, steady: 0.75, militia: 1.2 },
  strategist: { ...NONE, pull: 1.5, grief: 1.15, strain: 0.85, roads: 0.7, watch: 1.15 },
};

/** The weight a calling spends beyond the pull: its factors' shares off 1, added up (the same for every calling). */
export const LEAN_WEIGHT = 0.75;
/** The weight a stay spends: every factor's share off 1, the pull's left out. */
export const leanWeight = (s: Stay): number => (Object.keys(NONE) as (keyof Stay)[]).filter((k) => k !== 'pull').reduce((n, k) => n + Math.abs(s[k] - 1), 0);

/** The leader of the town's own people is in it, and it is not their chief town. */
export const leaderStays = (c: Campaign, tid: number): boolean => { const t = c.territories[tid]; return !!t && t.owner >= 0 && t.capital !== t.owner && leaderAt(c, t.owner, tid); };
/** What the leader's stay does for this town: by their calling while they are in it, else nothing. */
export const stayAt = (c: Campaign, tid: number): Stay => (leaderStays(c, tid) ? LEADER_STAY[heroFor(c, c.territories[tid].owner).calling] ?? NONE : NONE);

/** How much harder the town is drawn toward its nation's standing (townfaith.ts). */
export const leaderPull = (c: Campaign, tid: number): number => stayAt(c, tid).pull;
/** What the town's land yields, as a share (harvest.ts). */
export const leaderWork = (c: Campaign, tid: number): number => stayAt(c, tid).work;
/** How fast what the town is building goes up (governor.ts). */
export const leaderBuild = (c: Campaign, tid: number): number => stayAt(c, tid).build;
/** Seasons of grief that pass in one (drift.ts). */
export const leaderGrief = (c: Campaign, tid: number): number => stayAt(c, tid).grief;
/** The share of the town's strain still felt (drift.ts). */
export const leaderEase = (c: Campaign, tid: number): number => stayAt(c, tid).strain;
/** What the town's own men add to its defence, as a share (militia.ts). */
export const leaderMilitia = (c: Campaign, tid: number): number => stayAt(c, tid).militia;
/** Its defence against a band, as a share (threats.ts). */
export const leaderWatch = (c: Campaign, tid: number): number => stayAt(c, tid).watch;
/** The chance of unrest in this town, by a stay in a town of its people's beside it (unrest.ts): the most steadying of them. */
export function leaderSteady(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0) return 1;
  return Math.min(1, ...t.adj.filter((n) => c.territories[n]?.owner === t.owner).map((n) => stayAt(c, n).steady));
}
/** The chance a band meets a convoy of this people's on this road (convoys.ts): the most a stay in one of its own towns on it gives. */
export function leaderRoads(c: Campaign, owner: number, road: number[]): number {
  return Math.min(1, ...road.filter((tid) => c.territories[tid]?.owner === owner).map((tid) => stayAt(c, tid).roads));
}
