// A soldier costs a person (docs/DESIGN.md, step 1).
//
// Training anything that is a person takes a villager as well as the usual resources. The order names him at
// once; he walks to the building and goes in, and only then does the training time run: it is what turns him
// into the unit chosen. If the order is cancelled or the building falls he comes back out as he was.
//
// Who goes: soldiers, crews and engineers come from the men. Healers and the like (the 'support' class) may be
// women or men, and a woman is asked first so that the men are left for the ranks. Of those who may go, the
// nearest with nothing to do is taken; if nobody is idle, the nearest at work. Whoever has no house goes before a
// husband or a wife, so that a household is not broken while there is anyone else to send.
//
// Who costs nobody: a villager (born to housed couples, and outside the campaign trained at the Town Center), a beast
// (hound, mammoth, bear, elephant), and the nation's leader (a named person of the nation, not one of the town).
// Units that do not come out of a building (a war band's first fighters, marauders, hired swords, an army
// brought to a battle) arrive as they always did.
import type { Building, Game, Unit } from './game';
import type { UnitDef } from './data';
import { campCrew } from './siegecamp';

/** A woman who fights strikes this much as hard as a man would (hunting is not fighting). */
export const WOMAN_ATK = 0.4;

/** Does training this take a villager? */
export const needsPerson = (def: UnitDef): boolean => def.cls !== 'villager' && def.cls !== 'beast' && def.cls !== 'hero' && def.cls !== 'prey';

/** May this villager be trained into that? */
export const mayServe = (v: Unit, def: UnitDef): boolean => v.gender === 'm' || def.cls === 'support';

/** Is this villager on his way into a building to be trained, or inside one being trained? */
export function mustering(g: Game, v: Unit): boolean {
  if (v.order?.t === 'enlist') return true;
  const b = v.inside ? g.entities.get(v.inside) : undefined;
  return !!b && b.kind === 'building' && b.queue.some((q) => q.who === v.id);
}

/** The villagers of a people who could be called to train as this: free to walk, and not already called. */
export function recruits(g: Game, owner: number, def: UnitDef): Unit[] {
  return g.units.filter((v) => v.owner === owner && v.type === 'villager' && !v.dead && !v.inside && !v.captive && v.order?.t !== 'enlist' && mayServe(v, def));
}

/** Whom a building calls in to be trained as this, or null when there is nobody. */
export function recruitFor(g: Game, b: Building, def: UnitDef): Unit | null {
  let best: Unit | null = null, bestD = Infinity;
  for (const v of recruits(g, b.owner, def)) {
    // One with no house before one with a husband or wife in it (a house left with one of a couple raises no
    // children), an idle hand before a busy one, and for the healing arts a woman before a man.
    const d = Math.hypot(v.x - b.x, v.y - b.y) + (v.order ? 1000 : 0) + (v.homeId ? 2000 : 0) + (def.cls === 'support' && v.gender === 'm' ? 5000 : 0);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best ?? campCrew(g, b, def); // with no villager, a besieger's foot soldier crews an engine (siegecamp.ts)
}
