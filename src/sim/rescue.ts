// Getting captives back without burning the camp down, and what a camp's keeper should do about it.
//
// A town whose people are held in a Work Camp can send soldiers to the stockade. Each guard posted there holds
// off two of them; every soldier beyond that works at the gate, and the town's people are let out one at a time
// and run for home. A camp with no guard is emptied by a single soldier; a full guard of four holds off eight.
// (Razing the camp still frees everyone at once, and killing a Slaver on the road still frees the one he leads.)
//
// The second half is for whoever plays the keeper: `postGuards` sends idle Slavers to stand guard where captives
// are unwatched, and `guardsShort` and `heldAt` say how many more are wanted and where a town's own people are held.
import type { Building, Game, Unit } from './game';
import { GUARD_WATCH } from './creed';
import { rectDist } from './path';

/** How near the stockade a soldier must stand to work at the gate, in tiles from its wall. */
export const RESCUE_REACH = 2.5;
/** Soldiers each posted guard holds off. */
export const RESCUE_GUARD = 2;
/** Seconds one soldier, over and above those the guards hold off, takes to let one captive out. */
export const RESCUE_TIME = 6;

const guards = (b: Building): number => Math.min(b.def.guards ?? 0, b.staff?.length ?? 0);
const atGate = (b: Building, u: Unit): boolean => rectDist(u.x, u.y, b.cx, b.cy, b.cx + b.size, b.cy + b.size) <= RESCUE_REACH;

/** The soldiers standing at a camp who have come for the people taken from `from`: its own and its allies'. */
export function rescuers(g: Game, b: Building, from: number): Unit[] {
  return g.units.filter((u) => !u.dead && !u.inside && !u.def.slaver && g.isMilitary(u) && u.owner !== g.wild
    && !g.hostile(u.owner, from) && g.hostile(u.owner, b.owner) && atGate(b, u));
}

/** How many soldiers must stand at this camp before the first captive is let out. */
export const rescueForce = (b: Building): number => RESCUE_GUARD * guards(b) + 1;

/** How things stand at a camp's gate, for whoever is looking at it. */
export interface GateWork {
  /** The people whose soldiers are doing most there (the one a captive would next be let out for). */
  from: number;
  /** Soldiers standing at the gate for that people. */
  soldiers: number;
  /** How many of them the guards hold off, and how many are needed before anyone gets out. */
  heldOff: number; force: number;
  /** Soldiers over and above those held off: the ones at work. None, and no one is getting out. */
  spare: number;
  /** How far along the next captive is, from 0 to 1, and the seconds until they are out (null if no one is working). */
  progress: number; nextIn: number | null;
}

/**
 * Who is at this camp's gate and how near they are to getting someone out; null when it holds no one who could
 * be rescued or no soldier has come for them. Changes nothing.
 */
export function gateWork(g: Game, b: Building): GateWork | null {
  if (!b.def.guards || !b.captives?.length) return null;
  const off = RESCUE_GUARD * guards(b);
  let best: GateWork | null = null;
  for (const from of new Set(b.captives.map((c) => c.from))) {
    if (!g.hostile(from, b.owner)) continue;
    const soldiers = rescuers(g, b, from).length;
    if (!soldiers || (best && soldiers <= best.soldiers)) continue;
    const spare = Math.max(0, soldiers - off), progress = spare ? Math.min(1, b.rescueT ?? 0) : 0;
    best = { from, soldiers, heldOff: Math.min(soldiers, off), force: off + 1, spare, progress, nextIn: spare ? Math.max(1, Math.ceil((1 - progress) * RESCUE_TIME / spare)) : null };
  }
  return best;
}

/**
 * One second at a guarded camp (a Work Camp; the marauders' camp has to be burned). Returns how many were let out.
 * The count towards the next one is kept on the camp, and is lost if the soldiers are driven off.
 */
export function rescue(g: Game, b: Building): number {
  if (!b.def.guards || !b.captives?.length) { b.rescueT = 0; return 0; }
  let spare = 0;
  const peoples = [...new Set(b.captives.map((c) => c.from))].filter((from) => g.hostile(from, b.owner));
  const working = peoples.filter((from) => rescuers(g, b, from).length >= rescueForce(b));
  for (const from of working) spare = Math.max(spare, rescuers(g, b, from).length - RESCUE_GUARD * guards(b));
  if (!spare) { b.rescueT = 0; return 0; }
  b.rescueT = (b.rescueT ?? 0) + spare / RESCUE_TIME;
  let out = 0;
  while (b.rescueT >= 1) {
    b.rescueT -= 1;
    // The last brought in is nearest the gate.
    let i = b.captives.length - 1;
    while (i >= 0 && !working.includes(b.captives[i].from)) i--;
    if (i < 0) { b.rescueT = 0; break; }
    g.breakOut(b, i);
    out++;
  }
  if (out) {
    g.events.push({ t: 'msg', player: b.owner, text: `⛓️ Soldiers at the work camp have let ${out === 1 ? 'a captive' : `${out} captives`} out. ${guards(b) < (b.def.guards ?? 0) ? 'More guards would hold them off.' : 'Drive them from the gate.'}` });
    g.events.push({ t: 'alert', player: b.owner, x: b.x, y: b.y });
  }
  return out;
}

/** The camps where people taken from this town are held, nearest its Town Center first, with the force each needs. */
export function heldAt(g: Game, owner: number): { camp: Building; held: number; force: number }[] {
  const tc = g.buildings.find((b) => b.owner === owner && b.type === 'towncenter');
  const far = (b: Building): number => (tc ? Math.hypot(b.x - tc.x, b.y - tc.y) : 0);
  return g.buildings
    .filter((b) => !!b.def.guards && g.hostile(b.owner, owner) && (b.captives ?? []).some((c) => c.from === owner))
    .sort((a, b) => far(a) - far(b))
    .map((camp) => ({ camp, held: camp.captives!.filter((c) => c.from === owner).length, force: rescueForce(camp) }));
}

const freeHand = (u: Unit): boolean => !!u.def.slaver && !u.def.marauder && !u.dead && !u.order && !u.captive && !u.inside;
/** Guards a camp still wants: enough to watch everyone it holds, as far as it has posts for them. */
const wanted = (b: Building): number => Math.max(0, Math.min(b.def.guards ?? 0, Math.ceil((b.captives?.length ?? 0) / GUARD_WATCH)) - (b.staff?.length ?? 0));
const camps = (g: Game, owner: number): Building[] => g.buildings.filter((b) => b.owner === owner && !!b.def.guards && b.complete && !b.dead);

/** How many more Slavers this town would need to train to watch every captive it holds, counting those standing idle. */
export function guardsShort(g: Game, owner: number): number {
  const idle = g.units.filter((u) => u.owner === owner && freeHand(u)).length;
  const onTheWay = g.units.filter((u) => u.owner === owner && u.order?.t === 'staff' && !!u.def.slaver).length;
  return Math.max(0, camps(g, owner).reduce((n, b) => n + wanted(b), 0) - idle - onTheWay);
}

/** Sends this town's idle Slavers to stand guard wherever captives are unwatched, nearest first. Returns how many went. */
export function postGuards(g: Game, owner: number): number {
  let sent = 0;
  for (const b of camps(g, owner)) {
    let need = wanted(b) - g.units.filter((u) => u.owner === owner && u.order?.t === 'staff' && u.order.id === b.id).length;
    while (need > 0) {
      const idle = g.units.filter((u) => u.owner === owner && freeHand(u)).sort((x, y) => Math.hypot(x.x - b.x, x.y - b.y) - Math.hypot(y.x - b.x, y.y - b.y));
      if (!idle.length) return sent;
      g.cmdTarget(owner, [idle[0].id], b.id);
      if (idle[0].order?.t !== 'staff') return sent;
      need--; sent++;
    }
  }
  return sent;
}
