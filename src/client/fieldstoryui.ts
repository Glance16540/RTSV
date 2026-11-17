// A story afoot in the town, as the info panel shows it on the field (src/sim/fieldstory.ts): the robbed houses marked,
// those spoken of named, and the Question command for one of them. Kept small: the rules are all in the sim.
import type { Building, Game, Unit } from '../sim/game';
import { cmdQuestion, questionBar } from '../sim/fieldstory';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** A line under a house the thief has robbed, or ''. */
export function robbedLine(g: Game, b: Building): string {
  if (!b.robbed) return '';
  const s = g.players[b.owner]?.story;
  return s?.caught ? `<div class="good">🗝️ Robbed by the thief, who is taken now</div>`
    : `<div class="warn">🗝️ The ${esc(b.robbed)} household was robbed here. Set a soldier on guard by it to take the thief.</div>`;
}

/** A line under a villager a story speaks of, or ''. Nothing on the field says which one did it. */
export function suspectLine(g: Game, u: Unit): string {
  const s = g.players[u.owner]?.story;
  if (!s || u.suspect === undefined) return '';
  const done = s.cleared.includes(u.suspect) || (s.out ?? []).includes(u.suspect);
  return done ? '<div class="good">⚖️ Spoken of no longer</div>' : `<div class="warn">⚖️ Spoken of in the killing, as the ${esc(s.people[u.suspect]?.trade ?? 'villager')}</div>`;
}

/** The Question command for one villager a story speaks of, or null. */
export function questionCommand(g: Game, pid: number, units: Unit[]): { id: string; icon: string; name: string; desc: string; locked?: string; act: () => void } | null {
  const u = units.length === 1 ? units[0] : undefined;
  if (!u || u.suspect === undefined || !g.players[pid]?.story) return null;
  const bar = questionBar(g, pid, u);
  return { id: 'question', icon: '⚖️', name: 'Question', desc: `Ask ${esc(u.name)} where they were that night. One who did no wrong may be cleared by it.`, ...(bar ? { locked: bar } : {}), act: () => { cmdQuestion(g, pid, u.id); } };
}
