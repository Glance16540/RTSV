// Looking out: in a match, the camera comes down from its place over the town to stand low and face the sky,
// turned toward the sun by day and the moon by night. The same key takes it back.

import type { Renderer } from './renderer';

/** How low the camera stands when it looks out, and how far the eyes may be raised or dropped from level. */
export const LOW = 0.12, GAZE_MIN = -0.12, GAZE_MAX = 0.7;
const TURN = 0.22, SECONDS = 0.9;

/**
 * Where the light stands at an hour of the day (0 to 1, as the game counts it): the way the camera must face to
 * look at it, and whether it is the moon. It follows the path the renderer gives its sun and the sky gives its moon.
 */
export function lightBearing(dayT: number): { yaw: number; moon: boolean } {
  if (dayT >= 0.69 && dayT < 0.98) return { yaw: Math.atan2(-30, 18), moon: true };
  const across = Math.min(1, dayT / 0.7), sx = -Math.cos(across * Math.PI) * 46;
  return { yaw: Math.atan2(-sx, -20), moon: false };
}

/** The short way round from one bearing to another. */
export const shortTurn = (from: number, to: number): number => Math.atan2(Math.sin(to - from), Math.cos(to - from));

export class Outlook {
  /** True while the camera is down, or on its way down. */
  out = false;
  private k = 0;
  private yaw = 0;
  private gaze = 0;

  /** `home` is the game's own view, which the camera leaves and comes back to. */
  constructor(private r: Renderer, private home: { yaw: number; pitch: number }, private dayT: () => number) {}

  /** Go down to look out, or come back. Nothing happens while something else (the menu) holds the camera. */
  toggle(): boolean {
    if (!this.out && this.k === 0 && this.r.cine) return false;
    this.out = !this.out;
    // The panel along the bottom would stand in front of the land, so it is put away while the view is down.
    if (typeof document !== 'undefined') document.body.classList.toggle('looking-out', this.out);
    if (this.out) {
      const light = lightBearing(this.dayT());
      this.yaw = light.yaw;
      this.gaze = light.moon ? 0.13 : 0.08;
    }
    return true;
  }

  /** Turn the view a step to the left (-1) or right (1). Only while looking out. */
  turn(dir: number): boolean {
    if (!this.out) return false;
    this.yaw += dir * TURN;
    return true;
  }

  /** The wheel raises and drops the eyes while looking out, in place of drawing the camera in and back. */
  wheel(deltaY: number): boolean {
    if (!this.out) return false;
    this.gaze = Math.min(GAZE_MAX, Math.max(GAZE_MIN, this.gaze + (deltaY > 0 ? -0.05 : 0.05)));
    return true;
  }

  update(dt: number): void {
    if (!this.out && this.k === 0) return;
    this.k = Math.min(1, Math.max(0, this.k + (this.out ? dt : -dt) / SECONDS));
    if (this.k === 0) { this.r.cine = null; return; }
    const e = this.k * this.k * (3 - 2 * this.k), c = this.r.cine;
    const yaw = this.home.yaw + shortTurn(this.home.yaw, this.yaw) * e;
    // Turning and raising the eyes are eased too, so a key press swings the view and does not jump it.
    const ease = Math.min(1, dt * 6);
    const nowYaw = c && this.k === 1 ? c.yaw + shortTurn(c.yaw, this.yaw) * ease : yaw;
    const nowGaze = c?.gaze !== undefined && this.k === 1 ? c.gaze + (this.gaze - c.gaze) * ease : this.gaze;
    this.r.cine = { yaw: nowYaw, pitch: this.home.pitch + (LOW - this.home.pitch) * e, gaze: nowGaze, low: e };
  }
}
