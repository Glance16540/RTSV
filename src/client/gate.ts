// A rescue at a Work Camp, shown where it happens. The rule (src/sim/rescue.ts) lets soldiers at the stockade get
// their town's people out one at a time unless the guards hold them off; the game said so only in messages. This
// draws it over the camp on the 2D overlay: a bar that fills as the next captive is got out, or the count of
// soldiers against the number needed while the guards are holding. The same is said in words on the camp's panel.
import type { Building, Game } from '../sim/game';
import { gateWork } from '../sim/rescue';

/** What to show over a camp for this viewer; null when there is nothing at its gate. */
export interface GateSign { keeper: boolean; working: boolean; fill: number; text: string }

export function gateSign(game: Game, b: Building, pid: number): GateSign | null {
  const w = gateWork(game, b);
  if (!w) return null;
  const keeper = !game.hostile(b.owner, pid);
  if (w.spare) return { keeper, working: true, fill: w.progress, text: `${keeper ? '⚠' : '🔓'} ${w.nextIn}s` };
  return { keeper, working: false, fill: 0, text: `🗡 ${w.soldiers}/${w.force}` };
}

/** The same in a sentence, for the selected camp's panel. Empty when no soldier is at the gate. */
export function gatePanel(game: Game, b: Building, pid: number): string {
  const w = gateWork(game, b);
  if (!w) return '';
  const keeper = !game.hostile(b.owner, pid), whose = w.from === pid ? 'your' : `${game.players[w.from]?.name ?? 'their town'}'s`;
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (w.spare) {
    return keeper
      ? `<div class="bad">⚠️ ${n(w.soldiers, 'soldier is', 'soldiers are')} at the gate letting ${whose} people out: the next in about ${w.nextIn}s. ${w.heldOff ? `Your guards hold off ${w.heldOff}; ` : ''}drive them away or post more guards.</div>`
      : `<div class="good">🔓 ${n(w.spare, 'soldier is', 'soldiers are')} working at the gate${w.heldOff ? ` (the guards hold off ${w.heldOff} more)` : ''}: the next of ${whose} people is out in about ${w.nextIn}s. Stay by the stockade.</div>`;
  }
  return keeper
    ? `<div class="good">🗡️ Your guards are holding off ${n(w.soldiers, 'soldier', 'soldiers')} at the gate. ${n(w.force - w.soldiers, 'more', 'more')} and they will start getting people out.</div>`
    : `<div class="warn">🗡️ The guards are holding off ${n(w.soldiers, 'soldier', 'soldiers')} at the gate: ${w.force} are needed before anyone gets out, or the camp must be burnt.</div>`;
}

/** Draw the sign over every Work Camp in sight that has soldiers at its gate. Called from the 2D overlay each frame. */
export function drawGates(ctx: CanvasRenderingContext2D, game: Game, pid: number, ppt: number,
  project: (x: number, y: number, h: number) => { x: number; y: number }, visible: (b: Building) => boolean): void {
  for (const b of game.buildings) {
    if (!b.def.guards || !b.captives?.length || !visible(b)) continue;
    const sign = gateSign(game, b, pid);
    if (!sign) continue;
    const s = project(b.x, b.y, b.size * 0.5 + 2.1), w = Math.max(54, ppt * b.size * 0.7), h = 7;
    const ink = sign.working ? (sign.keeper ? '#e2503c' : '#57d657') : '#c9c2ad';
    ctx.font = `600 ${Math.max(12, Math.min(16, ppt * 0.45))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(sign.text, s.x, s.y - 5);
    ctx.fillStyle = ink;
    ctx.fillText(sign.text, s.x, s.y - 5);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(s.x - w / 2 - 1, s.y - 1, w + 2, h + 2);
    if (sign.working) { ctx.fillStyle = ink; ctx.fillRect(s.x - w / 2, s.y, w * sign.fill, h); }
  }
}
