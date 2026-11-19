// The computer opponent and the lie of the land, the night and the weather in a battle (docs/systems-board, "Computer
// opponent": it ignored all three).
//
//   - It gathers its idle army on the highest open ground near where it would gather it: a blow struck from higher
//     ground lands harder (game.ts highGround), and an enemy coming at it comes uphill.
//   - Ready to attack, it holds back while it is the weaker side in a storm (rain, snow or blowing dust heavy enough
//     to matter) or by night, when its bows reach less and its men see less; and it will not go uphill at an enemy
//     standing clearly higher unless it is the stronger by half again. It does not hold back for ever: after HOLD
//     seconds ready it goes all the same.
// Only the computer's choices: the rules of the ground, the night and the weather are as they were.
import { HIGH_GROUND } from './game';
import type { Game } from './game';

export const AIGROUND = {
  /** How far from the gathering point it looks for higher ground, in tiles, and how much higher a place must be to be worth the walk. */
  look: 6, lift: 0.15,
  /** The edge it wants to attack uphill. */
  uphill: 1.5,
  /** The longest it holds back, in seconds, once ready. */
  hold: 240,
};

/** The highest open ground within reach of a point, or the point itself where nothing nearby is higher (or the map is flat). */
export function highGroundNear(g: Game, x: number, y: number, r = AIGROUND.look): { x: number; y: number } {
  if (!g.relief) return { x, y };
  let best = { x, y }, top = g.heightAt(x, y) + AIGROUND.lift;
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    if (dx * dx + dy * dy > r * r) continue;
    const px = Math.floor(x + dx) + 0.5, py = Math.floor(y + dy) + 0.5;
    if (px < 2 || py < 2 || px > g.size - 2 || py > g.size - 2 || g.landPf.isBlocked(Math.floor(px), Math.floor(py))) continue;
    const h = g.heightAt(px, py) - Math.hypot(dx, dy) * 0.01; // the nearer of two heights alike
    if (h > top) { top = h; best = { x: px, y: py }; }
  }
  return best;
}

/** Is the way from one place to another clearly uphill: the other stands higher by more than the height that tells in a blow? */
export const uphill = (g: Game, from: { x: number; y: number }, to: { x: number; y: number }): boolean =>
  g.relief && g.heightAt(to.x, to.y) - g.heightAt(from.x, from.y) > HIGH_GROUND;

/**
 * Why an army ready to attack should hold back, or '' to go. `ours` and `theirs` are the two sides' weight as the
 * computer reckons them; `waited` how long it has been ready.
 */
export function holdBack(g: Game, s: { ours: number; theirs: number; from: { x: number; y: number }; to?: { x: number; y: number }; waited: number }): '' | 'storm' | 'night' | 'uphill' {
  if (s.waited >= AIGROUND.hold || s.theirs <= 0) return '';
  const weaker = s.ours < s.theirs;
  if (weaker && g.foul) return 'storm';
  if (weaker && g.night && !g.field) return 'night';
  if (s.to && uphill(g, s.from, s.to) && s.ours < s.theirs * AIGROUND.uphill) return 'uphill';
  return '';
}
