// A story afoot in the town, as the info panel shows it on the field (src/sim/fieldstory.ts): the robbed houses marked,
// those spoken of named, and the Question command for one of them. Kept small: the rules are all in the sim.
import type { Building, Game, Unit } from '../sim/game';
import { cmdQuestion, questionBar } from '../sim/fieldstory';
import { accuseBar, cmdAccuse } from '../sim/fieldaccuse';

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
  if (s.seized === u.suspect) return s.seized === s.culprit ? '<div class="warn">⛓️ Seized, and has confessed: held for your judgement</div>' : '<div class="good">⚖️ Seized and let go: spoken of no longer</div>'; // fieldaccuse.ts
  const done = s.cleared.includes(u.suspect) || (s.out ?? []).includes(u.suspect);
  return done ? '<div class="good">⚖️ Spoken of no longer</div>' : `<div class="warn">⚖️ Spoken of in the killing, as the ${esc(s.people[u.suspect]?.trade ?? 'villager')}</div>`;
}

/** The Question command for one villager a story speaks of, or null. */
export function questionCommand(g: Game, pid: number, units: Unit[]): { id: string; icon: string; name: string; desc: string; locked?: string; act: () => void } | null {
  const u = units.length === 1 ? units[0] : undefined;
  if (!u || u.suspect === undefined || !g.players[pid]?.story) return null;
  const bar = questionBar(g, pid, u);
  return { id: 'question', icon: '⚖️', name: 'Question', desc: `Ask ${esc(u.name)} where they were that night. One who did no wrong may be cleared by it. You may question one of those spoken of each time you come to the town.`, ...(bar ? { locked: bar } : {}), act: () => { cmdQuestion(g, pid, u.id); } };
}

/** The Seize command for one villager a story speaks of, or null (fieldaccuse.ts). */
export function accuseCommand(g: Game, pid: number, units: Unit[]): { id: string; icon: string; name: string; desc: string; locked?: string; act: () => void } | null {
  const u = units.length === 1 ? units[0] : undefined;
  if (!u || u.suspect === undefined || g.players[pid]?.story?.kind !== 'killer') return null;
  const bar = accuseBar(g, pid, u);
  return { id: 'accuse', icon: '⛓️', name: 'Seize', desc: `Accuse ${esc(u.name)} of the killings and have a soldier beside ${u.gender === 'f' ? 'her' : 'him'} seize ${u.gender === 'f' ? 'her' : 'him'}. The guilty confess and are held for your judgement; an innocent is let go, and the town and their household remember it. One may be seized each time you come to the town.`, ...(bar ? { locked: bar } : {}), act: () => { cmdAccuse(g, pid, u.id); } };
}

/**
 * Marks on the field (the 2D overlay, as notables.ts draws its stars): a key over each building where a household was
 * robbed until the thief is taken, and scales over each villager still spoken of in a killing.
 */
export function drawStoryMarks(ctx: CanvasRenderingContext2D, g: Game, pid: number, ppt: number, project: (x: number, y: number, h: number) => { x: number; y: number }, seen: (e: Unit | Building) => boolean): void {
  const s = g.players[pid]?.story;
  if (!s) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.95;
  // A mark on a dark disc, so that it reads on snow and on grass alike.
  const mark = (icon: string, x: number, y: number, size: number): void => {
    ctx.fillStyle = 'rgba(30,20,10,0.72)'; ctx.strokeStyle = 'rgba(242,201,76,0.9)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, size * 0.72, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = `${size}px sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(icon, x, y + size * 0.05);
  };
  if (s.kind === 'thief' && !s.caught) {
    for (const b of g.buildings) {
      if (b.owner !== pid || b.dead || !b.robbed || !seen(b)) continue;
      const p = project(b.x, b.y, b.type === 'farm' ? 1.2 : b.size * 0.5 + 1.9);
      mark('🗝️', p.x, p.y, Math.max(14, ppt * 0.55));
    }
  }
  if (s.kind === 'killer' && s.seized !== s.culprit) { // none once the killer is seized (fieldaccuse.ts)
    for (const u of g.units) {
      if (u.owner !== pid || u.dead || u.inside || u.suspect === undefined || !seen(u)) continue;
      if (s.cleared.includes(u.suspect) || (s.out ?? []).includes(u.suspect)) continue;
      const p = project(u.x, u.y, 1.9);
      mark('⚖️', p.x, p.y, Math.max(11, ppt * 0.38));
    }
  }
  ctx.restore();
}
