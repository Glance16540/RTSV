// A story of the leader's house, as the field shows it on a visit to the town where the court is kept
// (src/sim/courtfield.ts): who waits at the hall and the answers the leader may give there, and the great spoken of in
// a plot, shown as grown people of the town by name and title. Kept small: the rules are all in the sim.
import type { Building, Game, Unit } from '../sim/game';
import { FIELD_ANSWERS, FIELD_COURT, answerBar, cmdAnswer, courtsOf, guiseOf, plotOf, type CourtOnField } from '../sim/courtfield';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
type Command = { id: string; icon: string; name: string; desc: string; locked?: string; act: () => void };

/** The name one of the great is shown under on the field, or '' for anyone else. */
export function nobleName(g: Game, u: Unit): string {
  const n = guiseOf(g, u);
  return n ? `${esc(n.name)} <small>${esc(n.title)}</small>` : '';
}

/** A line under a villager who is shown as one of the great. Nothing on the field says which one plots. */
export function nobleLine(g: Game, u: Unit): string {
  const s = plotOf(g, u), n = guiseOf(g, u); // the plot that speaks of them, where more than one story is afoot
  if (!s || !n || u.noble === undefined) return '';
  if ((s.cleared ?? []).includes(u.noble) || (s.out ?? []).includes(u.noble)) return '<div class="good">👁️ Watched, and true: spoken of no longer</div>';
  if ((s.tried ?? []).includes(u.noble)) return '<div class="warn">👁️ Spoken of in the plot. Watched, and nothing settled by it.</div>';
  const had = s.watched?.[u.noble] ?? 0, need = FIELD_COURT.watch * (s.informers ? FIELD_COURT.informed : 1);
  return `<div class="warn">👁️ Spoken of in the plot against you. ${had > 0 ? `A soldier keeps watch: ${Math.max(0, Math.ceil(need - had))} seconds more.` : 'Keep a soldier close by to have them watched.'}</div>`;
}

/** A line under the hall where a rival's envoy or a suitor waits, or ''. */
export function guestLine(g: Game, b: Building, pid: number): string {
  if (b.type !== 'towncenter' || b.owner !== pid) return '';
  return courtsOf(g, pid).map(oneLine).join(''); // every story of the house afoot at once: an envoy, a suitor, a plot
}
function oneLine(s: CourtOnField): string {
  if (s.kind === 'plot') {
    const left = (s.nobles ?? []).filter((_, i) => !(s.cleared ?? []).includes(i) && !(s.out ?? []).includes(i)).length;
    return `<div class="warn">👁️ One of the great plots for your place. ${left} ${left === 1 ? 'is' : 'are'} spoken of, and they are in the town: set a soldier to keep watch on one.</div>`;
  }
  const given = s.answer ? ` <b>Your answer is given</b>, and is done when you leave the town.` : '';
  const said = s.kind === 'suitor' && s.asked ? ` ${esc(s.daughter ?? 'She')} ${s.willing ? 'would have him' : 'would not have him'}.` : '';
  return `<div class="${s.answer ? 'good' : 'warn'}">${s.kind === 'rival' ? '🗡️' : '💍'} ${esc(cap(s.guest ?? 'A guest'))} waits in your hall. ${esc(s.errand ?? '')}${said}${given}</div>`;
}

/** The answers the leader may give at the hall, as commands on it; none where nobody waits on one. */
export function answerCommands(g: Game, pid: number, b: Building): Command[] {
  if (b.type !== 'towncenter' || b.owner !== pid) return [];
  return courtsOf(g, pid).flatMap((s) => answersOf(g, pid, s));
}
function answersOf(g: Game, pid: number, s: CourtOnField): Command[] {
  if (s.kind === 'plot') return [];
  const icon: Record<string, string> = { defy: '✊', buy: '💰', yield: '🕊️', give: '💍', decline: '🎁', spurn: '🚪', ask: '💬' };
  const one = (id: string, name: string, desc: string): Command => { const bar = answerBar(g, pid, id); return { id: `court:${id}`, icon: icon[id] ?? '⚖️', name, desc, ...(bar ? { locked: bar } : {}), act: () => { cmdAnswer(g, pid, id); } }; };
  const out: Command[] = [];
  if (s.kind === 'suitor') out.push(one('ask', `Ask ${s.daughter ?? 'her'}`, `Ask ${esc(s.daughter ?? 'your daughter')} what she wants before you answer for her.`));
  for (const a of s.answers) if (FIELD_ANSWERS[s.kind].includes(a.id)) out.push(one(a.id, a.label, 'Your answer, given in your own hall. It is done when you leave the town, as it would be from the map.'));
  return out;
}
