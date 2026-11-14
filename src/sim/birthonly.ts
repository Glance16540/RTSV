// People come only by birth (docs/DESIGN.md).
//
// In the campaign (a battle or a visit, flagged by `Game.bornOnly`) no villager is bought at the Town Center: a
// town's people are those it was loaded with and those its housed couples raise (the houses' children, nursery.ts).
// A skirmish or a mission keeps villagers for hire as it always had.
//
// Under that rule a town lives or dies by its couples, so this is also where the computer is told how to keep
// them: every man and woman with no roof is a couple waiting for a house, and a husband is the last man sent to arms
// (muster.ts asks for a man with no house before one with a wife).
import type { Game, Unit } from './game';

/** Why the Town Center will not train a villager here. */
export const BORN_ONLY = 'In the campaign no villager is bought: a town\'s people are born to its housed couples.';

/** Why this player may not train a villager in this match, or null when they may. */
export const hireBar = (g: Game): string | null => (g.bornOnly ? BORN_ONLY : null);

/** A grown villager who could move into a house: not a child, not inside, not freed, not called to arms. */
const free = (u: Unit): boolean => u.type === 'villager' && !u.dead && u.growT <= 0 && !u.inside && !u.freed && !u.captive && u.order?.t !== 'enlist';

/**
 * How many couples of a people have no roof to raise children under: the smaller of its unhoused men and its
 * unhoused women, less those already on their way into a house.
 */
export function unhousedCouples(g: Game, owner: number): number {
  let m = 0, f = 0;
  for (const u of g.units) {
    if (u.owner !== owner || !free(u) || u.homeId || u.order?.t === 'movein') continue;
    if (u.gender === 'm') m++; else f++;
  }
  return Math.min(m, f);
}

/** Houses of a people standing empty of a man or a woman, or not yet built: room for couples to come. */
export function roomForCouples(g: Game, owner: number): number {
  let n = 0;
  for (const b of g.buildings) {
    if (b.owner !== owner || b.dead || b.type !== 'house') continue;
    if (!b.complete || !b.residents.m || !b.residents.f) n++;
  }
  return n;
}
