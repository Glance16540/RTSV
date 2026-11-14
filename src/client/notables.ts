// Notable people, shown: a mark over the figure, a line on their panel, and the town's list on its Town Center.
// Who is notable is `src/sim/notable.ts`.
import type { Game, Unit } from '../sim/game';
import { Notable, notableOf, notables } from '../sim/notable';

const SIGN = { leader: '👑', veteran: '⚔️', matron: '🌾' } as const;
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const stars = (n: Notable): string => '★'.repeat(n.rank);

/** The line on a notable person's own panel; empty for anyone else. */
export function notableLine(game: Game, u: Unit): string {
  const n = notableOf(game, u);
  return n ? `<div class="notable">${SIGN[n.kind]} <b>Notable</b> ${stars(n)} · ${esc(n.known)}</div>` : '';
}

/** The town's list, for its Town Center's panel. */
export function notableList(game: Game, owner: number): string {
  const list = notables(game, owner);
  if (!list.length) return '<div class="notables hint">📜 No one of this town has yet made a name.</div>';
  return `<div class="notables"><b>📜 Notable people of this town</b>${list.slice(0, 8).map((n) => `<div>${SIGN[n.kind]} ${esc(n.name)} <small>${stars(n)} ${esc(n.known)}</small></div>`).join('')}${list.length > 8 ? `<div class="hint">and ${list.length - 8} more</div>` : ''}</div>`;
}

/**
 * The mark over each notable figure in view: a gold star for each degree, and the name beside it close in.
 * `project` gives a place on the screen for a place in the world; `seen` says whether a unit is in sight.
 */
export function drawNotableMarks(ctx: CanvasRenderingContext2D, game: Game, pid: number, ppt: number, project: (x: number, y: number, h: number) => { x: number; y: number }, seen: (u: Unit) => boolean): void {
  ctx.save();
  ctx.textAlign = 'center';
  for (const u of game.units) {
    if (u.inside || !seen(u)) continue;
    const n = notableOf(game, u);
    if (!n || n.kind === 'leader') continue; // the leader has their own mark already
    const mine = !game.hostile(u.owner, pid), s = project(u.x, u.y, 1.55);
    ctx.globalAlpha = 0.95;
    ctx.font = `${Math.max(10, ppt * 0.32)}px sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.fillStyle = mine ? '#f2c94c' : '#d8d2c4';
    const text = '★'.repeat(n.rank);
    ctx.strokeText(text, s.x, s.y); ctx.fillText(text, s.x, s.y);
    if (ppt > 34 && mine) {
      ctx.font = `600 ${Math.max(10, ppt * 0.24)}px sans-serif`;
      ctx.strokeText(n.name, s.x, s.y - ppt * 0.34); ctx.fillStyle = '#f6efe0'; ctx.fillText(n.name, s.x, s.y - ppt * 0.34);
    }
  }
  ctx.restore();
}
