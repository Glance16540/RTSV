// Grief (docs/DESIGN.md, "Grief"). A home that loses its mother or its sons works more slowly for a time. It tells
// most in a town of middling morals, and less in a holy or a decadent one.
//
// In a town (a battle, a visit or a skirmish): when the woman of a house dies or is carried off, or a son born under
// its roof does (at home or at war: household.ts keeps a soldier on the record of his house), the house grieves for
// GRIEF_SECONDS. Whoever lives in it works more slowly while it does, by GRIEF_SLOW at most. A man trained to arms
// is not lost to his house, and his going is not mourned.
//
// On the map: a town whose people were lost (a notable lost, people carried off: what the town's mood reads as
// bereaved, portrait.ts) grieves for GRIEF_SEASONS. A grieving town's people strain toward worse (drift.ts).
import type { Building, Game, Unit } from './game';
import type { Folk } from './township';
import { GRIEF_SEASONS as NOTABLE_GRIEF } from './notableweight';
import { griefEase } from './infirmary';

declare module './game' {
  interface Building { /** Seconds the house has left to grieve. */ griefT?: number }
  interface Unit { /** Gone into a building to be trained (muster.ts): not dead to their house. */ enlisted?: boolean }
}
declare module './township' {
  interface Folk { /** Seasons the town has left to grieve. */ grief?: number }
}

/** How long a house grieves in a town, how much more slowly its people work then, and how long a town grieves on the map. */
export const GRIEF_SECONDS = 180;
export const GRIEF_SLOW = 0.4;
export const GRIEF_SEASONS = NOTABLE_GRIEF; // as long as the loss of a known person is felt (notableweight.ts)

/** How hard grief tells, by the town's standing: fully in a middling town, half as much at the holy or decadent end. */
export const griefWeight = (virtue: number): number => 1 - 0.5 * Math.min(1, Math.abs(virtue) / 70);

const houseOf = (g: Game, id: number, owner: number): Building | null => {
  const b = id ? g.entities.get(id) : undefined;
  return b && b.kind === 'building' && b.type === 'house' && !b.dead && b.owner === owner ? b : null;
};

/** Someone of the town has died or been taken: the house that loses its mother or a son grieves. Returns that house. */
export function mourn(g: Game, u: Unit): Building | null {
  if (u.enlisted || !u.gender || u.lifespan <= 0) return null;
  const home = houseOf(g, u.homeId, u.owner);
  const house = u.gender === 'f' && home && home.residents.f === u.id && home.children > 0 ? home // a mother
    : u.gender === 'm' ? houseOf(g, u.bornAt, u.owner) : null; // a son, wherever he was
  if (!house) return null;
  house.griefT = GRIEF_SECONDS;
  return house;
}

/** Is this house grieving? */
export const grieving = (b: Building | null | undefined): boolean => !!b && (b.griefT ?? 0) > 0;

/** How fast this person works: more slowly while their house grieves, by how the town stands. */
export function griefPace(g: Game, u: Unit): number {
  const home = u.homeId ? g.entities.get(u.homeId) : undefined;
  if (!home || home.kind !== 'building' || !grieving(home)) return 1;
  return 1 - GRIEF_SLOW * griefWeight(g.players[u.owner]?.virtue ?? 0);
}

/** A second passes for the grieving houses of a town. */
export function griefSecond(g: Game): void {
  for (const b of g.buildings) if (b.griefT) b.griefT = Math.max(0, b.griefT - griefEase(g, b.owner)); // an Infirmary sits with them (infirmary.ts)
}

/** The share of a people's houses that are grieving. */
export function griefShare(g: Game, owner: number): number {
  let houses = 0, sad = 0;
  for (const b of g.buildings) if (b.owner === owner && b.type === 'house' && !b.dead && b.complete) { houses++; if (grieving(b)) sad++; }
  return houses ? sad / houses : 0;
}

/** A season passes for a town on the map: it grieves anew if it was bereaved, and otherwise grieves a season less. */
export function griefSeason(f: Folk, bereaved: boolean, opts: { ease?: number } = {}): void {
  f.grief = bereaved ? GRIEF_SEASONS : Math.max(0, (f.grief ?? 0) - (opts.ease ?? 1)); // `ease`: seasons that pass in one (an Infirmary, infirmary.ts)
}
