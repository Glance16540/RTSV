// What the computer player does for its own people and its allies' (the board audit: famine.ts and rescue.ts wrote
// what a town's keeper should do, and nobody did it). Once a second, from ai.ts:
//   - guards: its idle Slavers stand guard where captives in its camps are unwatched (rescue.ts postGuards), before
//     they are sent out to take more;
//   - famine: it sends a load of food to each ally going hungry, keeping enough for itself (famine.ts succour), and
//     buys food at its Market while its own people go hungry, whatever its usual reckoning of gold (famine.ts buyFood);
//   - rescue: where its own people are held in a guarded camp (rescue.ts heldAt), nearest first, and it is neither
//     under attack nor marching on a rival, it sends soldiers standing idle to the camp's gate: enough to beat the guard
//     (rescueForce) and AICARE.spare more, or none at all, counting those already on their way or at the gate.
// Plain rules over the game's own commands; it keeps nothing.
import type { Building, Game, Unit } from './game';
import { buyFood, succour } from './famine';
import { heldAt, postGuards, rescueForce, rescuers } from './rescue';

export const AICARE = {
  /** Soldiers sent to a camp over and above the force that beats its guard: these are the ones at work at the gate. */
  spare: 2,
  /** A soldier this near a camp, or bound for a spot this near it, counts as already gone to it. */
  near: 6,
};

/** Soldiers of this people that could go: standing idle, fit to fight, not a Slaver and not in a building. */
const idleFighters = (g: Game, army: Unit[]): Unit[] => army.filter((u) => !u.dead && !u.order && !u.inside && !u.captive && !u.def.slaver && u.def.atk > 0 && g.isMilitary(u));
/** Soldiers of this people at the camp's gate or marching to it. */
function goneTo(g: Game, owner: number, camp: Building, army: Unit[]): number {
  const at = new Set(rescuers(g, camp, owner).filter((u) => u.owner === owner).map((u) => u.id));
  const bound = army.filter((u) => !at.has(u.id) && (u.order?.t === 'move' || u.order?.t === 'attackMove') && Math.hypot(u.order.x - camp.x, u.order.y - camp.y) <= AICARE.near);
  return at.size + bound.length;
}

/**
 * Send idle soldiers to free this people's own held at the nearest camp, if there are enough to do it. Returns how
 * many were sent. `busy`: under attack or on the march, when nobody is spared.
 */
export function mountRescue(g: Game, owner: number, army: Unit[], busy: boolean): number {
  if (busy) return 0;
  const held = heldAt(g, owner)[0];
  if (!held) return 0;
  const want = rescueForce(held.camp) + AICARE.spare, gone = goneTo(g, owner, held.camp, army);
  if (gone >= want) return 0;
  const idle = idleFighters(g, army).sort((a, b) => Math.hypot(a.x - held.camp.x, a.y - held.camp.y) - Math.hypot(b.x - held.camp.x, b.y - held.camp.y));
  if (gone + idle.length < want) return 0; // too few to beat the guard: they would only be held off
  const go = idle.slice(0, want - gone);
  g.cmdMove(owner, go.map((u) => u.id), held.camp.x, held.camp.y);
  return go.length;
}

/** All of it, once a second: guards, food, a rescue. */
export function aiCare(g: Game, owner: number, o: { army: Unit[]; busy: boolean }): { guards: number; sent: number; bought: boolean; rescuers: number } {
  const guards = postGuards(g, owner);
  const sent = succour(g, owner);
  const bought = buyFood(g, owner);
  return { guards, sent, bought, rescuers: mountRescue(g, owner, o.army, o.busy) };
}
