// The Mill (docs/DESIGN.md, "Buildings and research that answer the systems": "a Mill makes farms yield more").
//
// On the map it is a building on the land's record (SITES.mill), raised by the player or by the governor. A land
// with Farmland and a Mill yields MILL.yield times the food it would (harvest.ts asks `millYield`); without
// Farmland it grinds nothing. The governor raises one where food runs short in a town that already has its
// Farmland (the Farm comes first), has a place free and can pay for it. Rivals' towns have governors too.
//
// In a town (a battle or a visit) a finished Mill makes its people's farms yield MILL.yield times as fast
// (game.ts asks `millPace` as a farm is worked).
//
// The numbers are first guesses.
import type { Campaign } from './campaign';
import type { Game } from './game';

export const MILL = {
  /** How many times the food a farmed land yields, or a farm is worked for. */
  yield: 1.2,
};

/** Whether a land has a Mill on its record. */
export const hasMill = (c: Campaign, tid: number): boolean => !!c.territories[tid]?.buildings.includes('mill');
/** The food a land yields, times this (harvest.ts): MILL.yield with Farmland and a Mill, else 1. */
export const millYield = (c: Campaign, tid: number): number => {
  const b = c.territories[tid]?.buildings ?? [];
  return b.includes('mill') && b.includes('farm') ? MILL.yield : 1;
};
/** Whether the governor wants a Mill here: food is short, the town has Farmland, and no Mill. */
export const millWanted = (c: Campaign, tid: number, foodShort: boolean): boolean => {
  const b = c.territories[tid]?.buildings ?? [];
  return foodShort && b.includes('farm') && !b.includes('mill');
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
