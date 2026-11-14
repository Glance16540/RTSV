// Children. A child is never a unit on the map: it is an entry in the record of the house it was born to (its
// name, its family, what it takes after its parents in), it ages there unseen, and at coming of age a grown
// villager steps out of the door. Nothing on the map can reach a child: not a blow, a raid, a famine or a fire.
// When a house falls its children pass to another roof of the town; see `wardFor`.
import { GROW_TIME } from './data';

export interface Child {
  /** Its number in the game's count of things, which also decides (without the game's dice) whether it thrives. */
  id: number;
  name: string; family: string; gender: 'm' | 'f';
  /** What it takes after its parents in, kept until it is grown. */
  trait: string; trait2: string;
  /** The span of the life it will have. */
  lifespan: number;
  /** Seconds until it comes of age. */
  left: number;
  /** A child that will not live to grow up is lost, of sickness and in its bed, when `left` falls to this. */
  frail?: number;
  /** The house it was born in, whose trade it may take up. */
  bornAt: number;
}

/** The age a child is grown at, in years, and what a child's age is by that measure. */
export const GROWN_AT = 15;
export const yearsOld = (c: Child): number => Math.max(0, Math.min(GROWN_AT - 1, Math.floor(GROWN_AT * (1 - c.left / GROW_TIME))));
export const yearsLeft = (c: Child): number => Math.max(1, GROWN_AT - yearsOld(c));

/** A stretch of time passes for the children under one roof. Those grown and those lost are taken off the record and handed back. */
export function ageYoung(young: Child[], dt: number): { grown: Child[]; lost: Child[] } {
  const grown: Child[] = [], lost: Child[] = [];
  for (let i = young.length - 1; i >= 0; i--) {
    const c = young[i];
    c.left -= dt;
    if (c.frail && c.left <= c.frail) lost.push(...young.splice(i, 1));
    else if (c.left <= 0) grown.push(...young.splice(i, 1));
  }
  return { grown: grown.reverse(), lost: lost.reverse() };
}

interface Roof { id: number; owner: number; type: string; complete: boolean; dead: boolean; x: number; y: number; young?: Child[] }
/**
 * Where the children of a fallen house go: the nearest standing house of their town, or failing that its Town
 * Center, or failing that any roof it has. Null when the town has no roof left, and they travel with its people.
 */
export function wardFor<T extends Roof>(roofs: T[], from: Roof): T | null {
  const mine = roofs.filter((b) => b.id !== from.id && b.owner === from.owner && !b.dead && b.complete);
  const near = (a: T, b: T): number => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y) || a.id - b.id;
  for (const kind of ['house', 'towncenter', '']) {
    const fit = mine.filter((b) => !kind || b.type === kind).sort(near);
    if (fit.length) return fit[0];
  }
  return null;
}
