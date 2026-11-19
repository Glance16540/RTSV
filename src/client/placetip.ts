// Why a spot is refused, at the cursor, while a building is being placed (src/sim/placebar.ts says why): a small label on
// a dark card beside the pointer, drawn on the 2D overlay with the rest of the marks.
import type { Game } from '../sim/game';
import { placeBar } from '../sim/placebar';

/** Draw the reason this spot is refused beside the pointer, or nothing where the building can stand. */
export function drawPlaceTip(ctx: CanvasRenderingContext2D, g: Game, type: string, cell: { cx: number; cy: number } | null, mx: number, my: number): void {
  if (!cell) return;
  const why = placeBar(g, type, cell.cx, cell.cy, true);
  if (!why) return;
  ctx.save();
  ctx.font = '600 13px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(why).width + 16, h = 24, x = Math.min(mx + 18, window.innerWidth - w - 6), y = Math.max(h / 2 + 4, my - 22);
  ctx.fillStyle = 'rgba(40,18,12,0.88)';
  ctx.strokeStyle = 'rgba(255,120,96,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y - h / 2, w, h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe2d8';
  ctx.fillText(why, x + 8, y + 1);
  ctx.restore();
}
