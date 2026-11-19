// The road tool (src/sim/handroads.ts is the rule): from the Town Center's card, "Lay a road" and "Lift a road". Laying:
// click where it begins, then where it ends; the tiles it will take are shown green, those it cannot red, with why at the
// cursor. Lifting: click a road of yours. Right-click or Escape puts the tool away.
import type { Game } from '../sim/game';
import type { App } from './main';
import { HAND_ROADS, cmdLayRoad, cmdLiftRoad, roadBar, roadLine } from '../sim/handroads';
import { sfx } from './sfx';

declare module './main' {
  interface App {
    /** The road tool in hand (roadtool.ts), and where a road being laid begins. */
    roadTool?: 'lay' | 'lift' | null; roadFrom?: { x: number; y: number } | null;
  }
}

/** The tile under the pointer, or null off the land. */
const tileAt = (app: App, mx: number, my: number): { x: number; y: number } | null => {
  const p = app.r.groundAt(mx, my);
  return p ? { x: Math.floor(p.x), y: Math.floor(p.y) } : null;
};
const put = (app: App): void => { app.roadTool = null; app.roadFrom = null; };

/** The road commands on a Town Center of one's own. */
export function roadCommands(app: App, owner: number): { id: string; icon: string; name: string; desc: string; active?: boolean; act: () => void }[] {
  if (owner !== app.pid || app.game.field) return [];
  return [
    { id: 'road:lay', icon: '🛤️', name: 'Lay a road', active: app.roadTool === 'lay', desc: `Click where a road begins, then where it ends: up to ${HAND_ROADS.most} tiles of open ground you have seen, within ${HAND_ROADS.reach} tiles of a Town Center of yours. It costs nothing; people go faster on it, and the town keeps it.`, act: () => { app.select(app.sel); app.roadTool = 'lay'; app.roadFrom = null; } },
    { id: 'road:lift', icon: '⛏️', name: 'Lift a road', active: app.roadTool === 'lift', desc: 'Click a road of yours to take it up: one you laid, or one worn to a building of yours (it is worn again only when a Town Center rises or falls).', act: () => { app.select(app.sel); app.roadTool = 'lift'; app.roadFrom = null; } },
  ];
}

/** A pointer press while a road tool is in hand: returns whether it was the tool's. */
export function roadDown(app: App, e: PointerEvent): boolean {
  if (!app.roadTool) return false;
  if (e.button === 2) { put(app); return true; }
  if (e.button !== 0) return false;
  const t = tileAt(app, e.clientX, e.clientY);
  if (!t) return true;
  if (app.roadTool === 'lift') { if (cmdLiftRoad(app.game, app.pid, t.x, t.y)) sfx.play('place'); return true; }
  if (!app.roadFrom) { app.roadFrom = t; return true; }
  const laid = cmdLayRoad(app.game, app.pid, roadLine(app.roadFrom.x, app.roadFrom.y, t.x, t.y));
  if (laid) sfx.play('place');
  app.roadFrom = e.shiftKey ? t : null; // with Shift held, the next road goes on from here
  if (!e.shiftKey) app.roadTool = laid ? null : app.roadTool;
  return true;
}

/** Escape puts a road tool away: returns whether one was in hand. */
export function roadEscape(app: App): boolean {
  if (!app.roadTool) return false;
  put(app);
  return true;
}

/** The road tool on the 2D overlay: the tiles a road would take, or the road under the pointer, and why not at the cursor. */
export function drawRoadTool(ctx: CanvasRenderingContext2D, app: App, g: Game, mx: number, my: number, ppt: number): void {
  if (!app.roadTool) return;
  const t = tileAt(app, mx, my);
  if (!t) return;
  const cell = (x: number, y: number, ok: boolean): void => {
    const s = app.r.project(x + 0.5, y + 0.5, 0.1);
    ctx.fillStyle = ok ? 'rgba(125,255,138,0.75)' : 'rgba(255,90,74,0.75)';
    ctx.fillRect(s.x - ppt * 0.3, s.y - ppt * 0.3, ppt * 0.6, ppt * 0.6);
  };
  let why = '';
  if (app.roadTool === 'lay') {
    const tiles = app.roadFrom ? roadLine(app.roadFrom.x, app.roadFrom.y, t.x, t.y) : [[t.x, t.y] as [number, number]];
    for (const [x, y] of tiles) cell(x, y, !roadBar(g, app.pid, x, y));
    why = roadBar(g, app.pid, t.x, t.y) || (app.roadFrom ? '' : 'Click where the road begins.');
  } else {
    const has = !!g.road[t.y * g.size + t.x];
    cell(t.x, t.y, has);
    why = has ? '' : 'There is no road here.';
  }
  if (!why) return;
  ctx.save();
  ctx.font = '600 13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(why).width + 16, h = 24, x = Math.min(mx + 18, window.innerWidth - w - 6), y = Math.max(h / 2 + 4, my - 22);
  ctx.fillStyle = 'rgba(40,18,12,0.88)'; ctx.strokeStyle = 'rgba(255,120,96,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y - h / 2, w, h, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe2d8'; ctx.fillText(why, x + 8, y + 1);
  ctx.restore();
}
