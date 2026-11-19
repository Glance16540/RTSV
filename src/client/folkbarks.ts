// The people speak when it happens to them, not only when they are clicked or ordered (docs/systems-board, "Leaders":
// the badly wounded and town-attacked lines were written and recorded for but never played).
//
//   - Badly hurt: one of the player's soldiers (the folk script gives the wounded cry to warriors) who falls below a third of their health says so, once, until they are
//     whole again (above two thirds); and never more than one such cry in a few seconds.
//   - The town struck: when the player's town is attacked, the nearest of its people to the blow cries out, if the
//     player can see that spot; not more than once in a while.
// What they say is the folk script's line for that moment, in the temper of their town and in their own faith's words
// where it has them (voice.ts bark, folkfaith.ts). Nothing here touches a rule.
import type { Game, Unit } from '../sim/game';
import { bark } from './voice';

/** Below this share of health a person cries out; above `whole` they may again. */
export const HURT = { at: 1 / 3, whole: 2 / 3, every: 6, fearEvery: 8, fearReach: 12 };

export class FolkBarks {
  private cried = new Set<number>();
  private hurtAt = -1e9;
  private fearAt = -1e9;
  private scanT = 0;

  /** Once in a while: who of the player's people is badly hurt and in sight. `seen` says whether the player can see a spot. */
  update(game: Game, pid: number, dt: number, seen: (x: number, y: number) => boolean): void {
    if ((this.scanT -= dt) > 0) return;
    this.scanT = 0.5;
    const now = performance.now() / 1000;
    for (const id of this.cried) { const u = game.entities.get(id); if (!u || u.kind !== 'unit' || u.dead || u.hp > u.maxHp * HURT.whole) this.cried.delete(id); }
    if (now - this.hurtAt < HURT.every) return;
    const hurt = game.units.find((u) => u.owner === pid && u.type !== 'villager' && !u.dead && !u.inside && u.hp > 0 && u.hp < u.maxHp * HURT.at && !this.cried.has(u.id) && seen(u.x, u.y));
    if (!hurt) return;
    this.cried.add(hurt.id);
    this.hurtAt = now;
    bark(game, hurt, 'hurt');
  }

  /** The player's town is struck at (x, y): the nearest of its people there cries out, where the player can see it. */
  struck(game: Game, pid: number, x: number, y: number, seen: (x: number, y: number) => boolean): Unit | null {
    const now = performance.now() / 1000;
    if (now - this.fearAt < HURT.fearEvery || !seen(x, y)) return null;
    let best: Unit | null = null, bd = HURT.fearReach;
    for (const u of game.units) {
      if (u.owner !== pid || u.dead || u.inside || u.type !== 'villager') continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < bd) { bd = d; best = u; }
    }
    if (!best) return null;
    this.fearAt = now;
    bark(game, best, 'fear');
    return best;
  }
}
