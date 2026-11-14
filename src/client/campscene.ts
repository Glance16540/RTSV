// What happens at a Work Camp's gate, shown where it happens. The rules are in `src/sim/rescue.ts` and the camp's
// nights in `game.ts`; until now they were told only in messages. Here: soldiers come for their people turn to the
// gate and hack at it (or stand facing it, held off by the guards) with chips flying, and a rescue, a rising or a
// night escape is marked by dust, flying chips and a sign over the gate. The bar over the camp is `gate.ts`.

import type { Building, Game } from '../sim/game';
import { gateWork, rescuers } from '../sim/rescue';

/** What the renderer lends: its dust and chips, its floating signs, the ground's height, and whether a camp is in sight. */
export interface CampFx {
  chips: (x: number, y: number, z: number, n: number) => void;
  dust: (x: number, y: number, z: number, delay: number) => void;
  sign: (x: number, y: number, text: string) => void;
  height: (x: number, y: number) => number;
  seen: (b: Building) => boolean;
}

/** How a camp stood when last looked at. */
export interface CampState { held: number; working: boolean; burning: boolean }
/**
 * What has just happened at a camp, from how it stood a moment ago and how it stands now: soldiers working at the
 * gate let someone out (a rescue), the place is burning and several are gone at once (a rising), or one is gone
 * with no one at the gate (slipped away). Captives leaving any other way, or arriving, are nothing.
 */
export function campChange(was: CampState | undefined, now: CampState): { what: 'rescue' | 'rising' | 'escape'; out: number } | null {
  if (!was || now.held >= was.held) return null;
  const out = was.held - now.held;
  if (was.working) return { what: 'rescue', out };
  if (now.burning && !was.burning && out >= 2) return { what: 'rising', out };
  return { what: 'escape', out };
}

/** Where a camp's gate is: the middle of its south wall, where those let out are set down. */
export const gateOf = (b: { x: number; y: number; size: number }): { x: number; y: number } => ({ x: b.x, y: b.y + b.size / 2 + 0.1 });

export class CampScenes {
  private was = new Map<number, CampState>();
  /** Soldiers at a gate: which way each should face, and whether they are at work or held off. */
  private gateMen = new Map<number, { yaw: number; working: boolean }>();
  private tick = 0;
  private chipT = 0;

  /** The way a soldier at a gate should face and whether he is hacking at it; undefined for everyone else. */
  at(unitId: number): { yaw: number; working: boolean } | undefined { return this.gateMen.get(unitId); }

  update(game: Game, dt: number, fx: CampFx): void {
    this.tick -= dt;
    this.chipT -= dt;
    const recount = this.tick <= 0, chip = this.chipT <= 0;
    if (recount) { this.tick = 0.3; this.gateMen.clear(); }
    if (chip) this.chipT = 0.45;
    for (const b of game.buildings) {
      if (!b.def.guards || b.dead) continue;
      const held = b.captives?.length ?? 0, gate = gateOf(b), gy = fx.height(gate.x, gate.y);
      const work = held ? gateWork(game, b) : null, shown = fx.seen(b);
      const now: CampState = { held, working: !!work && work.spare > 0, burning: b.burnT > 0 };
      const change = campChange(this.was.get(b.id), now);
      this.was.set(b.id, now);
      if (change && shown) {
        const n = change.what === 'rising' ? 9 : change.what === 'rescue' ? 4 : 1;
        for (let i = 0; i < n; i++) fx.dust(gate.x + (Math.random() - 0.5) * (n > 4 ? 2 : 0.8), gy + 0.15, gate.y + 0.3 + Math.random() * 0.6, -i * 0.06);
        if (change.what !== 'escape') fx.chips(gate.x, gy + 0.6, gate.y, change.what === 'rising' ? 18 : 10);
        fx.sign(gate.x, gate.y, change.what === 'rising' ? '🔥⛓️' : change.what === 'rescue' ? '🔓' : '👣');
      }
      if (!work) continue;
      if (recount) for (const u of rescuers(game, b, work.from)) this.gateMen.set(u.id, { yaw: Math.atan2(gate.x - u.x, gate.y - u.y), working: work.spare > 0 });
      if (!shown) continue;
      if (work.spare > 0 && chip) fx.chips(gate.x + (Math.random() - 0.5) * 0.5, gy + 0.5 + Math.random() * 0.4, gate.y, 2);
    }
    if (recount) for (const id of this.was.keys()) if (!game.buildings.some((b) => b.id === id)) this.was.delete(id);
  }
}
