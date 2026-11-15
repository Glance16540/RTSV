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
import { BIRTH_TIME } from './data';

/**
 * The pace of births in a campaign town, slower than a skirmish's (the owner's word: faster than on the map, but
 * far from a child every half minute, and "you can slow the birth rate"). A housed couple's first child takes over
 * thirteen minutes, a little more than a visit, unless its creed, clergy or renown hasten it; later ones come more
 * slowly still, as in any house. What is born in a visit counts against the season's births on the map
 * (seasonfolk.ts, bornOnVisit), so a town visited every season ends some way larger than one left alone.
 */
export const TOWN_BIRTH = 800;
/** How much longer a birth takes here than the usual BIRTH_TIME. */
export const birthPace = (g: Game): number => (g.bornOnly ? TOWN_BIRTH / BIRTH_TIME : 1);
/**
 * Nobody ages in a campaign town (docs/DESIGN.md, "Time"): a person ages only on the map, a season at a time
 * (ageing.ts). Children there do not grow, the grown do not grow old, and nobody dies of age. A skirmish or a
 * mission keeps the ageing it always had, where `Game.aging` is on.
 */
export const agesHere = (g: Game): boolean => g.aging && !g.bornOnly;
/** How fast children grow up here: not at all in a campaign town, at the usual pace elsewhere. */
export const growPace = (g: Game): number => (g.bornOnly ? 0 : 1);

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
