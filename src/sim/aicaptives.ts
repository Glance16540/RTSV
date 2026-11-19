// The computer knows its people's captivity is on a clock, in a town (the board's line "The computer does not know
// captives are on a clock: it neither hurries a rescue nor sells"). Read by aicare.ts.
//
// A captive in a Work Camp can be got back for CAPTIVE_HOLD from being seized, and their people are warned at
// CAPTIVE_WARN left (captivity.ts); then they are sold on, by itself, for the player and the computer alike: there is
// no earlier sale to make, and nothing here makes one.
//   - its own held: the camp it goes to first is the one where one of its people has the least time left, not the
//     nearest (`heldFirst`); and once one of them is within CAPTIVE_WARN of being lost (`pressed`) it goes even while
//     it is marching on a rival, drawing on the soldiers marching as well as those idle (aicare.ts mountRescue). It
//     still sends nobody it has too few to beat the guard with: they would only be held off;
//   - those it holds: a rescue under way at a camp of its own is met. Its idle soldiers go to the gate, as many as are
//     working it and one more (`keepCamps`), when it is not busy elsewhere, or whatever it is doing once a captive
//     there is within CAPTIVE_WARN of the sale. It keeps them by the same rules the player has: guards and soldiers.
// Captives are only ever where they are held and how long is left: nothing here is drawn or told. No child is a captive.
// Plain rules over the game's own commands; it keeps nothing.
import type { Building, Game, Unit } from './game';
import { CAPTIVE_WARN, timeLeft } from './captivity';
import { heldAt, rescuers } from './rescue';

export const AICLOCK = {
  /** Time left, in seconds, at which a captive is pressing: their people are warned then (captivity.ts). */
  last: CAPTIVE_WARN,
  /** Defenders sent to a gate over the soldiers working it. */
  more: 1,
};

/** The least time left of this people's captives in a camp; Infinity for those on no clock (a mission's). */
export const leastLeft = (g: Game, camp: Building, from: number): number =>
  (camp.captives ?? []).filter((c) => c.from === from).reduce((m, c) => Math.min(m, timeLeft(g, c) ?? Infinity), Infinity);
/** The least time left of any captive a camp holds. */
const leastHeld = (g: Game, camp: Building): number => (camp.captives ?? []).reduce((m, c) => Math.min(m, timeLeft(g, c) ?? Infinity), Infinity);

/** The camp to go to first for this people's own held: the one with the least time left, then the nearest; and whether it is pressing. */
export function heldFirst(g: Game, owner: number): { camp: Building; force: number; left: number; pressed: boolean } | undefined {
  const all = heldAt(g, owner).map((h, i) => ({ ...h, i, left: leastLeft(g, h.camp, owner) }));
  const first = all.sort((a, b) => a.left - b.left || a.i - b.i)[0];
  return first ? { camp: first.camp, force: first.force, left: first.left, pressed: first.left <= AICLOCK.last } : undefined;
}

/** Soldiers that could go to a gate: idle, or on the march when `marching`; fit to fight, not a Slaver, not in a building. */
export const ableFighters = (g: Game, army: Unit[], marching: boolean): Unit[] => army.filter((u) => !u.dead && !u.inside && !u.captive && !u.def.slaver && u.def.atk > 0 && g.isMilitary(u)
  && (!u.order || (marching && u.order.t === 'attackMove')));

/**
 * A rescue under way at a camp of this people's: its idle soldiers go to the gate, as many as are working it and AICLOCK.more,
 * counting those there already. While `busy`, only for a camp with a captive within AICLOCK.last of the sale. Returns how many went.
 */
export function keepCamps(g: Game, owner: number, army: Unit[], busy: boolean): number {
  let sent = 0;
  for (const camp of g.buildings) {
    if (camp.owner !== owner || camp.dead || !camp.def.guards || !(camp.captives ?? []).length) continue;
    const at = new Set([...new Set((camp.captives ?? []).map((c) => c.from))].flatMap((from) => rescuers(g, camp, from).map((u) => u.id)));
    if (!at.size || (busy && leastHeld(g, camp) > AICLOCK.last)) continue;
    const near = army.filter((u) => !u.dead && u.def.atk > 0 && !u.def.slaver && Math.hypot(u.x - camp.x, u.y - camp.y) <= 4 + camp.size).length;
    const want = at.size + AICLOCK.more - near;
    if (want <= 0) continue;
    const go = ableFighters(g, army, false).filter((u) => Math.hypot(u.x - camp.x, u.y - camp.y) > 4 + camp.size)
      .sort((a, b) => Math.hypot(a.x - camp.x, a.y - camp.y) - Math.hypot(b.x - camp.x, b.y - camp.y)).slice(0, want);
    if (!go.length) continue;
    g.cmdMove(owner, go.map((u) => u.id), camp.x, camp.y, true);
    sent += go.length;
  }
  return sent;
}
