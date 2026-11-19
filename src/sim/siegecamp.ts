// A siege camp has no people from nowhere (docs/DESIGN.md, the owner's word, 19 November 2026: "A besieging army's camp
// starts with no villagers: its men are the army's own, from the map's roll, and nobody is born there. Its soldiers
// build the camp's works themselves, its rams' workshop and its stores, so a siege can still be pressed.").
//
// The attacking side of a campaign siege (besieger.ts `PlayerSetup.besieger`, the computer's and the player's alike):
//   - starts with its camp's hall and its army, and no villagers (game.ts lays none for it): with nobody to bear, nobody
//     is born there, and none is bought (birthonly.ts);
//   - its foot soldiers (not horse, not engines, not the leader) build and mend the camp's works, CAMP.works: a Siege
//     Workshop for its rams and a Storehouse for its stores (`campBuilds`);
//   - a siege engine is crewed by one of its foot soldiers, called in as a villager would be (muster.ts asks
//     `campCrew` when it has no villager to call), so the workshop is of use with nobody else in the camp;
//   - the computer, besieging, raises its workshop with two of its soldiers once it is of the age and can pay
//     (`campWorks`), only once its first storm has gone in and failed, with the men idle by then: as a second wave. Raised
//     before the storm, the workshop and its crews were men out of the line, and the computer won fewer sieges for it.
// A skirmish, a mission, a field battle, the defender and a war band are not touched.
// Plain data: it reads the field and gives orders only as the field already does.
import type { Building, Game, Unit } from './game';
import type { UnitDef } from './data';
import { BUILDINGS, UNITS } from './data';
import { besieging } from './besieger';

export const CAMP = {
  /** The works a besieging side's soldiers build and mend. */
  works: ['workshop', 'storehouse'],
  /** Soldiers the computer sends to raise its workshop. */
  builders: 2,
  /** How far from its camp's hall the computer looks for room for a work. */
  near: 9,
  /** Rams the computer keeps in hand from its workshop, while it has more foot soldiers than that and two besides. */
  rams: 2,
};

/** A foot soldier of a besieging side: one who may build the camp's works, or crew an engine. */
const footman = (g: Game, u: Unit): boolean => !u.dead && !u.hero && !u.inside && (u.def.cls === 'infantry' || u.def.cls === 'ranged') && besieging(g, u.owner) && !g.field;

/** Does this people's camp have no villagers in it from the start: the attacking side of a campaign siege? */
export const campWithoutPeople = (setup: { besieger?: boolean } | undefined): boolean => !!setup?.besieger;

/** A besieging army is not housed: it raises nobody but engines out of its own men, so no roof limits it (game.ts training). */
export const campUnhoused = (g: Game, pid: number): boolean => besieging(g, pid) && !g.field;

/** May this unit build or mend a building of this type? A villager anything; a besieging side's foot soldier the camp's works. */
export const campBuilds = (g: Game, u: Unit, type: string): boolean => footman(g, u) && CAMP.works.includes(type);

/** A soldier to crew a siege engine for a besieging side that has no villager to send: the nearest idle foot soldier. */
export function campCrew(g: Game, b: Building, def: UnitDef): Unit | null {
  if (def.cls !== 'siege' || !besieging(g, b.owner)) return null;
  let best: Unit | null = null, bestD = Infinity;
  for (const u of g.units) {
    if (u.owner !== b.owner || !footman(g, u) || u.order?.t === 'enlist') continue;
    const d = Math.hypot(u.x - b.x, u.y - b.y) + (u.order ? 1000 : 0);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

/** The computer, besieging with no villagers: raise a workshop with two of its soldiers when it has none, is of the age and can pay;
 *  once it stands, keep CAMP.rams rams in hand, each crewed by one of its soldiers. Returns a workshop begun, or null. */
export function campWorks(g: Game, pid: number, place: (type: string, near: { x: number; y: number }, builders: Unit[]) => Building | null): Building | null {
  if (!besieging(g, pid) || g.field) return null;
  const p = g.players[pid], def = BUILDINGS.workshop;
  if (!def || p.age < def.age) return null;
  if (g.units.some((u) => u.owner === pid && !u.dead && u.type === 'villager')) return null; // one with villagers builds as it always has
  const shop = g.buildings.find((b) => b.owner === pid && !b.dead && b.type === 'workshop');
  if (shop) {
    const rams = g.units.filter((u) => u.owner === pid && !u.dead && u.type === 'ram').length + shop.queue.filter((q) => q.id === 'ram').length;
    const men = g.units.filter((u) => u.owner === pid && footman(g, u)).length;
    if (shop.complete && rams < CAMP.rams && men > CAMP.rams + 2 && g.canAfford(p, UNITS.ram.cost)) g.cmdTrain(pid, shop.id, 'ram');
    return null;
  }
  if (!g.canAfford(p, def.cost)) return null;
  const hall = g.buildings.find((b) => b.owner === pid && !b.dead && b.type === 'towncenter');
  const men = g.units.filter((u) => u.owner === pid && footman(g, u) && !u.order).slice(0, CAMP.builders);
  if (!hall || men.length < CAMP.builders) return null;
  return place('workshop', hall, men);
}
