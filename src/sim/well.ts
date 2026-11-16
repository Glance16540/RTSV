// The Well (docs/DESIGN.md, "Buildings and research that answer the systems": "a Well (or Bathhouse) slows plague
// in a crowded town").
//
// On the map it is a building on the land's record (SITES.well). Clean water: the town counts as WELL.crowd as
// crowded as it is for plague (acts.ts asks `wellEase` inside `crowding`), so plague breaks out there less often,
// passes to it from a neighbour less often, and takes fewer while it lasts. A hamlet gains little from one, since
// plague seldom troubles a hamlet. The governor raises one in a town crowded to WELL.crowded or more where plague
// has been, there or next door, in the last WELL.recall seasons. Rivals' towns have governors too.
//
// In a town (a battle or a visit) a finished Well makes plague pass among a people's own WELL.pass as readily
// (game.ts asks `wellGuard` when a sick person stands among their own).
//
// The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { folkOf, headcount } from './township';

export const WELL = {
  /** How crowded a town with a Well counts for plague, as a share of how crowded it is. */
  crowd: 0.6,
  /** How crowded a town must be (of acts.ts's measure) for the governor to want one, and how many seasons back plague counts. */
  crowded: 0.8, recall: 12,
  /** In a town: how readily plague passes among a people's own with a Well, as a share. */
  pass: 0.5,
};

/** Whether a land has a Well on its record. */
export const hasWell = (c: Campaign, tid: number): boolean => !!c.territories[tid]?.buildings.includes('well');
/** How crowded a town counts for plague, as a share of how crowded it is (acts.ts). */
export const wellEase = (c: Campaign, tid: number): number => (hasWell(c, tid) ? WELL.crowd : 1);
/** Whether the governor wants a Well here: a crowded town where plague has lately been, there or next door. `crowding` is acts.ts's measure. */
export function wellWanted(c: Campaign, tid: number, crowding: number): boolean {
  const t = c.territories[tid];
  if (!t || hasWell(c, tid) || crowding < WELL.crowded) return false;
  return (c.events ?? []).some((e) => e.kind === 'plague' && (e.at === tid || t.adj.includes(e.at)) && e.turn > c.turn - WELL.recall);
}
/** acts.ts's crowding measure leaves out what a Well does; the governor reads it plain. */
export const crowdOf = (c: Campaign, tid: number, crowd: number): number => Math.min(1, headcount(folkOf(c, tid)) / crowd);

/** In a town: how readily plague passes among this people's own (game.ts): WELL.pass with a finished Well. */
export function wellGuard(g: Game, owner: number): number {
  return g.buildings.some((b) => !b.dead && b.complete && b.owner === owner && b.type === 'well') ? WELL.pass : 1;
}
