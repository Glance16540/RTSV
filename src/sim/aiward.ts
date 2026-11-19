// A computer-played town and the marauders (docs/DESIGN.md audit, "computer opponent": marauders.ts wrote `partyNear`,
// `hideWomen` and `scoutSpots` "for whoever plays a town", and nobody called them).
//
// A player sees a raiding party coming and gets the women indoors, and sends a rider to find the camp before it grows.
// The computer did neither: its women were carried off from the fields while it watched, and it learned where the camp
// was only by losing someone to it or stumbling on it. Now, each time it thinks (ai.ts, once a second):
//   Hiding. While a party is after this town's women or leading one away within sight of its buildings (`partyNear`),
//     the women out of doors are sent into the nearest hall or tower with room (`hideWomen`, by the order a player
//     gives). When the party is gone they come out again, unless the town's own bell is rung for an attack, which
//     keeps them in by its own rule. Children are no units on the field (nursery.ts): there is nobody else to hide.
//   Scouting. While the marauders have a camp this town has not found, and the town is at peace (building, not under
//     attack) with fighters to spare (WARD.least), one of them, the fastest, rides the places a camp could be
//     (`scoutSpots`), one after another, until some unit of the town has seen the camp. Then ai.ts's own rule marches on
//     it when it can win. The scout is one of the town's fighters still: it is called back with the army when it marches.
//
// It keeps a little state (who rides, where next, whether the women are in on its account), saved with the computer
// player. It gives the same orders a player can and nothing else.
import type { Game, Unit } from './game';
import { hideWomen, partyNear, scoutSpots } from './marauders';

export const WARD = {
  /** Fighters a town must have idle and out of doors before one is spared to look for the camp. */
  least: 3,
};

/** What the computer keeps between thoughts. */
export interface WardState { hid?: boolean; scout?: number; scoutI?: number }

/** Get the women in while a party is near, and let them out when it has gone. Returns how many were sent in. */
export function wardWomen(g: Game, pid: number, w: WardState): number {
  if (partyNear(g, pid).length) {
    w.hid = true;
    return hideWomen(g, pid);
  }
  if (w.hid) {
    w.hid = false;
    if (!g.players[pid].bell) g.cmdBell(pid, false); // the all clear; a bell rung for an attack is cleared by its own rule
  }
  return 0;
}

/**
 * Send a rider to look for the camp. `may`: the town is at peace and does not know where the camp is. `free`: its
 * fighters with nothing to do. Returns the place the scout was sent to, if it was sent anywhere now.
 */
export function wardScout(g: Game, pid: number, w: WardState, free: Unit[], may: boolean): { x: number; y: number } | null {
  if (!may) { delete w.scout; return null; }
  const spots = scoutSpots(g, pid);
  if (!spots.length) { delete w.scout; return null; }
  let s = g.units.find((u) => u.id === w.scout && u.owner === pid && !u.dead);
  if (!s) {
    if (free.length < WARD.least) return null;
    s = [...free].sort((a, b) => b.def.speed - a.def.speed || a.id - b.id)[0];
    w.scout = s.id; w.scoutI = 0;
  }
  if (s.order || s.inside) return null; // still on its way, or busy
  const at = spots[(w.scoutI ?? 0) % spots.length];
  w.scoutI = (w.scoutI ?? 0) + 1;
  g.cmdMove(pid, [s.id], at.x, at.y, false);
  return at;
}
