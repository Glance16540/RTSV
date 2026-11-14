// A clock for a people with no Town Center. The rule (src/sim/beaten.ts) gives them a while to begin another
// before they are beaten; the game says so in messages, and this keeps the time in sight while it runs:
// your own in red at the top of the screen, and any other people's beneath it.

import { hallLeft } from '../sim/beaten';
import type { Game } from '../sim/game';

let box: HTMLElement | null = null;
let shown = '';

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Who has a clock running, your own first, with the seconds each has left. */
export function hallClocks(game: Game, pid: number): { id: number; name: string; left: number; mine: boolean; foe: boolean }[] {
  if (game.winner >= 0) return [];
  return game.players
    .filter((p) => !p.neutral && hallLeft(p, game.time) >= 0)
    .map((p) => ({ id: p.id, name: p.name, left: hallLeft(p, game.time), mine: p.id === pid, foe: game.hostile(p.id, pid) }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.left - b.left);
}

/** Draw the clocks that are running, or take them away. Called every frame; the page is touched only when a second passes. */
export function updateHallClock(game: Game, pid: number): void {
  const hud = document.getElementById('hud')!;
  const list = hallClocks(game, pid);
  const sig = list.map((c) => `${c.id}:${c.left}`).join('|');
  if (sig === shown) return;
  shown = sig;
  if (!box) {
    box = document.createElement('div');
    box.id = 'hall-clock';
    box.setAttribute('role', 'timer');
    document.getElementById('toasts')!.before(box);
  }
  box.innerHTML = list.map((c) =>
    `<div class="${c.mine ? 'mine' : c.foe ? 'foe' : 'friend'}${c.left <= 20 ? ' last' : ''}"><b>${clock(c.left)}</b> ${c.mine
      ? 'You have no Town Center: begin another, or you are beaten.'
      : c.foe ? `${c.name} have no Town Center: keep them from beginning another.`
        : `${c.name}, your allies, have no Town Center.`}</div>`).join('');
  // Messages hang below the clocks, however many are running and however they wrap.
  hud.style.setProperty('--hall-clock', `${list.length ? box.offsetHeight + 6 : 0}px`);
}
