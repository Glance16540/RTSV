// Stories inside the story, drawn on a land's panel: where a thief or a killer stands in that town, or a rival king
// or a suitor at the leader's court, the people it turns on by name and face, what has been found out, and what the leader may do. The rules are src/sim/intrigue.ts.
// The sim knows who the killer is; nothing here reads it.
import type { Campaign } from '../sim/campaign';
import { Intrigue, Person, choicesFor, fullName, intriguesAt, standing, suspected } from '../sim/intrigue';
import '../sim/kin';
import { nationOf, notablePortrait } from '../sim/portrait';
import { portraitHtml } from './portrait';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const face = (c: Campaign, it: Intrigue, p: Person, grief = false): string =>
  portraitHtml(notablePortrait(nationOf(c.factions[it.owner]?.civ), { name: p.name, family: p.family, gender: p.gender, kind: 'person' }, grief ? { bereaved: true } : {}), '', 'sm');
const row = (c: Campaign, it: Intrigue, p: Person, words: string, cls = ''): string =>
  `<div class="likeness-row story-person ${cls}">${face(c, it, p, cls === 'dead')}<span><b>${esc(fullName(p))}</b>${p.known ? ' <span title="Known by name in this town">★</span>' : ''} the ${esc(p.trade)}${words ? ` <small>${esc(words)}</small>` : ''}</span></div>`;

const TITLE: Record<Intrigue['kind'], string> = { thief: 'A thief', killer: 'A killer', rival: 'A rival king', suitor: 'A suitor', plot: 'A plot at court' };
/** Someone of the leader's house or a rival's, by name alone, with a face. */
const named = (c: Campaign, f: number, name: string | undefined, gender: 'm' | 'f', words: string): string =>
  (name ? `<div class="likeness-row story-person">${portraitHtml(notablePortrait(nationOf(c.factions[f]?.civ), { name, gender, kind: 'person' }, {}), '', 'sm')}<span><b>${esc(name)}</b> <small>${esc(words)}</small></span></div>` : '');

function storyHtml(c: Campaign, it: Intrigue): string {
  let people = '';
  if (it.kind === 'rival') {
    const s = c.factions[0]?.kin?.spouse;
    people = named(c, it.rival ?? 0, it.cast?.king, c.factions[it.rival ?? 0]?.hero?.female ? 'f' : 'm', `of the ${c.factions[it.rival ?? 0]?.name ?? 'rival people'}`) + named(c, 0, it.cast?.spouse, s?.female === false ? 'm' : 'f', s?.female === false ? 'your husband' : 'your wife');
  } else if (it.kind === 'suitor') {
    people = named(c, it.rival ?? 0, it.cast?.suitor, 'm', `a son of the house of ${it.cast?.king ?? 'a rival'}`) + named(c, 0, it.cast?.daughter, 'f', 'your daughter');
  } else if (it.kind === 'plot') {
    people = (it.nobles ?? []).map((n, i) => {
      const cleared = it.cleared.includes(i), words = it.found && !cleared ? 'the plotter, held for your judgement' : cleared ? 'cleared' : 'is spoken of';
      return `<div class="likeness-row story-person ${cleared ? 'cleared' : ''}">${portraitHtml(notablePortrait(nationOf(c.factions[0]?.civ), { name: n.name, gender: n.female ? 'f' : 'm', kind: 'person' }, {}), '', 'sm')}<span><b>${esc(n.title)}</b> <small>${words}</small></span></div>`;
    }).join('') + it.clues.map((k) => `<div class="hint">🔎 ${esc(k.text)}</div>`).join('');

    people = it.caught !== undefined && it.thief
      ? row(c, it, it.thief, 'held for the robberies, awaiting your judgement')
      : it.people.map((p, i) => row(c, it, p, it.robbed[i] ? `robbed ${it.robbed[i] === 1 ? 'once' : `${it.robbed[i]} times`}` : 'not yet robbed')).join('');
  } else {
    const left = suspected(it), wronged = it.wronged ?? [];
    people = it.victims.map((p) => row(c, it, p, 'found dead', 'dead')).join('') +
      it.people.map((p, i) => (left.includes(i) ? row(c, it, p, 'is spoken of') : it.victims.some((v) => v.name === p.name && v.family === p.family) ? '' : row(c, it, p, wronged.some((w) => w.name === p.name && w.family === p.family) ? 'hanged, and innocent' : 'cleared', 'cleared'))).join('') +
      it.clues.map((k) => `<div class="hint">🔎 ${esc(k.text)}</div>`).join('');
  }
  const title = it.kind === 'rival' && c.factions[it.rival ?? 0]?.hero?.female ? 'A rival queen' : TITLE[it.kind];
  return `<div class="story-box"><b>🕯️ ${title}${it.kind === 'thief' || it.kind === 'killer' ? ` in ${esc(c.territories[it.at].name)}` : ''}</b><div>${esc(standing(c, it))}</div>${people}</div>`;
}
/** The stories running in a land of the player's: its town's, and those of the leader's house where the court is. */
export function intrigueHtml(c: Campaign, tid: number): string {
  return intriguesAt(c, tid).filter((it) => it.owner === 0).map((it) => storyHtml(c, it)).join('');
}

/** What the leader may do about them: each a button for the land's panel. */
export function intrigueButtons(c: Campaign, tid: number): string {
  if (c.phase !== 'player') return '';
  return intriguesAt(c, tid).filter((it) => it.owner === 0).flatMap((it) => choicesFor(c, it).map((k) => `<button data-act="story:${it.id}/${k.id.replace(':', '.')}"${k.bar ? ` disabled title="${esc(k.bar)}"` : ''}>${esc(k.label)}</button>`)).join('');
}
/** The act a button above carries, as the story and the choice. */
export const intrigueAct = (id: string): [number, string] => [Number(id.split('/')[0]), (id.split('/')[1] ?? '').replace('.', ':')];
