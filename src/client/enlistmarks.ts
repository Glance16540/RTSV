// A villager on the way to take up arms, shown on the field: a mark over the figure and a faint line to the building
// that will train them. Who is going where is `src/sim/pickman.ts`.
import type { Game, Unit } from '../sim/game';
import { enlistOf } from '../sim/pickman';

/** The mark over each of this player's villagers called to arms and still walking, with a line to where they go. */
export function drawEnlistMarks(ctx: CanvasRenderingContext2D, game: Game, pid: number, ppt: number, project: (x: number, y: number, h: number) => { x: number; y: number }, seen: (u: Unit) => boolean): void {
  ctx.save();
  ctx.textAlign = 'center';
  for (const u of game.units) {
    if (u.owner !== pid || u.inside || u.order?.t !== 'enlist' || !seen(u)) continue;
    const e = enlistOf(game, u);
    if (!e) continue;
    const s = project(u.x, u.y, 1.35), to = project(e.b.x, e.b.y, 0.2);
    ctx.globalAlpha = 0.45; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#e8c070';
    ctx.beginPath(); ctx.moveTo(s.x, s.y + ppt * 0.2); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 0.95;
    ctx.font = `${Math.max(10, ppt * 0.3)}px sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.fillStyle = '#e8c070';
    ctx.strokeText('⚔', s.x, s.y); ctx.fillText('⚔', s.x, s.y);
  }
  ctx.restore();
}
