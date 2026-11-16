// The Mill (docs/DESIGN.md, "Buildings and research that answer the systems": "a Mill makes farms yield more").
//
// On the map it is a building on the town's record (townworks.ts: raised from the map, finished by the governor). A land
// with Farmland and a finished Mill yields MILL.yield times the food it would (harvest.ts asks `millYield`); without
// Farmland it grinds nothing. The governor raises one where a town that already has its Farmland (the Farm comes
// first) runs short of food or has grown to MILL.big people, and can pay for it. Rivals' towns have governors too.
//
// In a town (a battle or a visit) a finished Mill makes its people's farms yield MILL.yield times as fast
// (game.ts asks `millPace` as a farm is worked).
//
// The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';
import { standsAt } from './studies';
import { begunAt } from './townworks';
import { folkOf, headcount } from './township';

export const MILL = {
  /** How many times the food a farmed land yields, or a farm is worked for. */
  yield: 1.2,
  /** A farmed town of this many people wants one before its food runs short. */
  big: 16,
};

/** Whether a Mill stands finished on the town's record. */
export const hasMill = (c: Campaign, tid: number): boolean => standsAt(c, tid, 'mill');
/** The food a land yields, times this (harvest.ts): MILL.yield with Farmland and a Mill, else 1. */
export const millYield = (c: Campaign, tid: number): number => {
  return hasMill(c, tid) && !!c.territories[tid]?.buildings.includes('farm') ? MILL.yield : 1;
};
/** Whether the governor wants a Mill here: the town has Farmland and no Mill, and its food is short or it is of MILL.big people or more. */
export const millWanted = (c: Campaign, tid: number, foodShort: boolean): boolean => {
  return (foodShort || headcount(folkOf(c, tid)) >= MILL.big) && !!c.territories[tid]?.buildings.includes('farm') && !begunAt(c, tid, 'mill');
};

/** Who has a finished Mill, worked out once a tick, since this is asked every time a farm is worked. */
const seen = new WeakMap<Game, { tick: number; owners: Set<number> }>();
/** In a town: how many times as fast this people's farms yield (game.ts). */
export function millPace(g: Game, owner: number): number {
  let s = seen.get(g);
  if (!s || s.tick !== g.tick) {
    s = { tick: g.tick, owners: new Set(g.buildings.filter((b) => !b.dead && b.complete && b.type === 'mill').map((b) => b.owner)) };
    seen.set(g, s);
  }
  return s.owners.has(owner) ? MILL.yield : 1;
}
