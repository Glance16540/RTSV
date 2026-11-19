// A noble's petition, on the land's panel of their town among the matters in it: who asks, what, how long they will
// wait, and the leader's two answers. The rules are src/sim/petitions.ts.
import type { Campaign } from '../sim/campaign';
import { grant, grantBar, petitionAt, petitionLeft, petitionText, refuse } from '../sim/petitions';
import { noblesOf, titleOf } from '../sim/nobles';
import { nationOf, notablePortrait } from '../sim/portrait';
import { portraitHtml } from './portrait';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');

/** The petition waiting in this land of the player's, if any. */
export function petitionHtml(c: Campaign, tid: number): string {
  const p = petitionAt(c, 0, tid);
  if (!p) return '';
  const n = noblesOf(c, 0).find((x) => x.key === p.key);
  if (!n) return '';
  const face = portraitHtml(notablePortrait(nationOf(c.factions[0]?.civ), { name: n.name, gender: n.female ? 'f' : 'm', kind: 'person' }, {}), '', 'sm');
  const left = petitionLeft(c, p);
  return `<div class="story-box"><b>📜 A petition</b><div class="likeness-row story-person">${face}<span><b>${esc(titleOf(c, n))}</b> <small>asks ${esc(petitionText(c, 0, p))}</small></span></div><div class="hint">${left <= 1 ? 'They will not wait past this season.' : `They will wait ${left} seasons for your answer.`}</div></div>`;
}

/** The leader's answers, as buttons for the land's panel. */
export function petitionButtons(c: Campaign, tid: number): string {
  if (c.phase !== 'player' || !petitionAt(c, 0, tid)) return '';
  const bar = grantBar(c, 0);
  return `<button data-act="petition:grant"${bar ? ` disabled title="${esc(bar)}"` : ''}>✅ Grant the petition</button><button data-act="petition:refuse" title="Their mood falls, and stays lower for a year">✖ Refuse it</button>`;
}

/** Do what a button above asks. */
export function petitionDo(c: Campaign, id: string): void {
  if (id === 'grant') grant(c, 0); else if (id === 'refuse') refuse(c, 0);
}
