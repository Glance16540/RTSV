// The cases before a town's Hall of Judgement, on the Hall's own panel: who, what, and the answers. The rules are
// src/sim/hallfield.ts (the field) and src/sim/hallcases.ts (what the map makes of the rulings).
import type { Building, Game } from '../sim/game';
import { casesBefore } from '../sim/hallfield';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const ICON = { thief: '⛓️', plotter: '🗡️', petition: '📜' } as const;

/** The Hall's panel: each case waiting, with the answers as buttons (data-rule="case|answer"). */
export function hallPanelHtml(game: Game, b: Building, pid: number): string {
  if (b.type !== 'hall' || b.owner !== pid) return '';
  const cases = casesBefore(game, pid);
  if (!cases.length) return game.players[pid]?.hall ? '<div class="hint">⚖️ No case waits on your judgement.</div>' : '';
  return `<div class="hall-cases"><b>⚖️ Before your judgement</b>${cases.map((c) => `<div class="hall-case"><div>${ICON[c.kind]} ${esc(c.text)}</div>${c.answers.map((a) => `<button data-rule="${esc(c.id)}|${esc(a.id)}"${a.bar ? ` disabled title="${esc(a.bar)}"` : ''}>${esc(a.label)}</button>`).join('')}</div>`).join('')}<div class="hint">Your ruling is done as you leave the town, as it would be from the map.</div></div>`;
}
