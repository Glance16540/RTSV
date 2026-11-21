/**
 * What the computer knows of works that shoot (docs/DESIGN.md, "the Fortress on the field"). A Fortress in a town
 * shoots as a Watch Tower does, and the computer knew its towers by name only: its raiders walked under a
 * shooting Fortress to seize people, and it left a Fortress out when it weighed a town's defence. Here is the
 * one place that says which works shoot from their walls, how far a raiding party keeps from each, and what
 * each is worth to a defence, so that ai.ts asks instead of naming.
 */
import type { Building } from './game';

export const AIFORTS = {
  /** How far, in tiles, a raider's mark must stand from a hostile work that shoots: its reach and one more; a Town Center, which the townsfolk man, a tile further. */
  clear: 1, hall: 10,
  /** What a work is worth to a town's defence, in the measure soldiers are weighed in (the cost of them): a tower, a Town Center, a Fortress. */
  tower: 200, towncenter: 300, fortress: 400,
};
/** Does this work shoot from its walls by itself: a Watch Tower, or a Fortress. (A Town Center shoots only when manned.) */
export const shootsAlone = (b: Building): boolean => b.type === 'tower' || b.type === 'fortress';
/** How far a raiding party keeps its marks from this hostile work, or 0 if it need not. `open`: the foe has next to no soldiers, and only what shoots by itself is feared. */
export function keepsClear(b: Building, open: boolean): number {
  if (!b.complete) return 0;
  if (shootsAlone(b)) return (b.def.range ?? 0) + AIFORTS.clear;
  return !open && b.type === 'towncenter' ? AIFORTS.hall : 0;
}
/** What this work adds to its owner's weight when it stands to defend. */
export function defenceWorth(b: Building): number {
  if (!b.complete) return 0;
  return b.type === 'tower' ? AIFORTS.tower : b.type === 'towncenter' ? AIFORTS.towncenter : b.type === 'fortress' ? AIFORTS.fortress : 0;
}
