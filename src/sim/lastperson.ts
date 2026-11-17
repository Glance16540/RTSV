/**
 * A side with no people left does not hold a battle open (docs/DESIGN.md, "A soldier costs a person").
 *
 * A people was beaten when its Town Center had fallen and none was begun in time (beaten.ts), or when its last
 * building fell. In a campaign battle or a visit nobody is bought (birthonly.ts): a town has only the people
 * born to it. So a town whose last grown person had fallen, or that had died out before the battle began, could
 * raise no soldier and no builder and yet stood, undefeated, until someone pulled its hall down. Here it is
 * beaten when the last of them is gone: no soldier and no villager of its own left alive anywhere on the field
 * or under a roof. Children are not counted: they cannot fight, and in a town of the campaign they do not grow
 * up inside a battle; they are still written back with the town when it is over.
 *
 * Only where people come by birth alone. In a skirmish a people with a Town Center can still buy a villager, so
 * it is not finished while that stands; and a war band with no town is beaten by its own rule (game.ts).
 */
import type { Game } from './game';

/** Has this side nobody left: no person of its own alive, where none can be bought? */
export function nobodyLeft(g: Game, owner: number): boolean {
  if (!g.bornOnly || g.field || g.warband(owner)) return false;
  return !g.units.some((u) => u.owner === owner && !u.dead);
}
