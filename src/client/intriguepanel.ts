// Stories inside the story, drawn on a land's panel: where a thief or a killer stands in that town, the people it
// turns on by name and face, what has been found out, and what the leader may do. The rules are src/sim/intrigue.ts.
// The sim knows who the killer is; nothing here reads it.
import type { Campaign } from '../sim/campaign';
import { Intrigue, Person, choicesFor, fullName, intrigueAt, standing, suspected } from '../sim/intrigue';
import { nationOf, notablePortrait } from '../sim/portrait';
import { portraitHtml } from './portrait';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const face = (c: Campaign, it: Intrigue, p: Person, grief = false): string =>
  portraitHtml(notablePortrait(nationOf(c.factions[it.owner]?.civ), { name: p.name, family: p.family, gender: p.gender, kind: 'person' }, grief ? { bereaved: true } : {}), '', 'sm');
const row = (c: Campaign, it: Intrigue, p: Person, words: string, cls = ''): string =>
  `<div class="likeness-row story-person ${cls}">${face(c, it, p, cls === 'dead')}<span><b>${esc(fullName(p))}</b> the ${esc(p.trade)}${words ? ` <small>${esc(words)}</small>` : ''}</span></div>`;

/** The story running in a town of the player's, if there is one. */
export function intrigueHtml(c: Campaign, tid: number): string {
  const it = intrigueAt(c, tid);
  if (!it || it.owner !== 0) return '';
  let people = '';
  if (it.kind === 'thief') {
    people = it.caught !== undefined && it.thief
      ? row(c, it, it.thief, 'held for the robberies, awaiting your judgement')
      : it.people.map((p, i) => row(c, it, p, it.robbed[i] ? `robbed ${it.robbed[i] === 1 ? 'once' : `${it.robbed[i]} times`}` : 'not yet robbed')).join('');
  } else {
    const left = suspected(it), wronged = it.wronged ?? [];
    people = it.victims.map((p) => row(c, it, p, 'found dead', 'dead')).join('') +
      it.people.map((p, i) => (left.includes(i) ? row(c, it, p, 'is spoken of') : it.victims.some((v) => v.name === p.name && v.family === p.family) ? '' : row(c, it, p, wronged.some((w) => w.name === p.name && w.family === p.family) ? 'hanged, and innocent' : 'cleared', 'cleared'))).join('') +
      it.clues.map((k) => `<div class="hint">🔎 ${esc(k.text)}</div>`).join('');
  }
  return `<div class="story-box"><b>🕯️ ${it.kind === 'thief' ? 'A thief' : 'A killer'} in ${esc(c.territories[tid].name)}</b><div>${esc(standing(c, it))}</div>${people}</div>`;
}

/** What the leader may do about it: each a button for the land's panel. */
export function intrigueButtons(c: Campaign, tid: number): string {
  const it = intrigueAt(c, tid);
  if (!it || it.owner !== 0 || c.phase !== 'player') return '';
  return choicesFor(c, it).map((k) => `<button data-act="story:${it.id}/${k.id.replace(':', '.')}"${k.bar ? ` disabled title="${esc(k.bar)}"` : ''}>${esc(k.label)}</button>`).join('');
}
/** The act a button above carries, as the story and the choice. */
export const intrigueAct = (id: string): [number, string] => [Number(id.split('/')[0]), (id.split('/')[1] ?? '').replace('.', ':')];
