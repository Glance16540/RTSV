// The Infirmary (docs/DESIGN.md, "Buildings and research that answer the systems": "an Infirmary (or Almshouse)
// tends the sick and the grieving").
//
// On the map it is a building on the town's record (townworks.ts: raised from the map, finished by the governor). The sick are nursed: plague takes
// INFIRMARY.sick of those it would have taken there (acts.ts asks `infirmaryCare`). The grieving are sat with: a
// grieving town grieves INFIRMARY.grief seasons less each season (drift.ts passes `infirmaryEase` to grief.ts),
// so its strain toward worse eases sooner. The governor raises one in a town of INFIRMARY.big people or more that
// has lately had plague or is grieving. Rivals' towns have governors too.
//
// In a town (a battle or a visit) a finished Infirmary makes plague wear its people down INFIRMARY.sick as fast
// (game.ts asks `infirmaryCare` while someone is sick), and a grieving house there grieves INFIRMARY.grief seconds
// for every second (grief.ts asks `griefEase`).
//
// The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { folkOf, headcount } from './township';
import { standsAt } from './studies';
import { begunAt } from './townworks';

export const INFIRMARY = {
  /** The share of plague's toll the sick still pay where they are nursed. */
  sick: 0.6,
  /** Seasons (on the map) or seconds (in a town) of grief eased for each one that passes. */
  grief: 2,
  /** The people a town must have for the governor to want one, and how many seasons back plague counts. */
  big: 14, recall: 8,
};

/** Whether an Infirmary stands finished on the town's record. */
export const hasInfirmary = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'infirmary');
/** The share of plague's toll the town still pays (acts.ts): INFIRMARY.sick with an Infirmary. */
export const infirmaryCare = (c: Campaign, tid: number): number => (hasInfirmary(c, tid) ? INFIRMARY.sick : 1);
/** Seasons of grief that pass in a season (grief.ts, by way of drift.ts): INFIRMARY.grief with an Infirmary. */
export const infirmaryEase = (c: Campaign, tid: number): number => (hasInfirmary(c, tid) ? INFIRMARY.grief : 1);
/** Whether the governor wants an Infirmary here: a town of some size that has lately had plague, or is grieving. */
export function infirmaryWanted(c: Campaign, tid: number): boolean {
  const f = folkOf(c, tid);
  if (begunAt(c, tid, 'infirmary') || headcount(f) < INFIRMARY.big) return false;
  return !!f.grief || (c.events ?? []).some((e) => e.kind === 'plague' && e.at === tid && e.turn > c.turn - INFIRMARY.recall);
}

/** Who has a finished Infirmary, worked out once a tick, since this is asked for every sick person and grieving house. */
const seen = new WeakMap<Game, { tick: number; owners: Set<number> }>();
function tended(g: Game, owner: number): boolean {
  let s = seen.get(g);
  if (!s || s.tick !== g.tick) { s = { tick: g.tick, owners: new Set(g.buildings.filter((b) => !b.dead && b.complete && b.type === 'infirmary').map((b) => b.owner)) }; seen.set(g, s); }
  return s.owners.has(owner);
}
/** In a town: how fast plague wears this people down (game.ts): INFIRMARY.sick with a finished Infirmary. */
export const sickCare = (g: Game, owner: number): number => (tended(g, owner) ? INFIRMARY.sick : 1);
/** In a town: seconds of a house's grief that pass in a second (grief.ts): INFIRMARY.grief with a finished Infirmary. */
export const griefEase = (g: Game, owner: number): number => (tended(g, owner) ? INFIRMARY.grief : 1);
