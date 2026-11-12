// Leaders speaking: the words on screen, and the recording of them once one exists.

import { CIV_COLOR, CIVS } from '../sim/data';
import { Speech, leaderOf, lineKey, speechText } from '../sim/leaders';
import { ico, voiceCredit, voiceUrl } from './assets';
import { sfx } from './sfx';

let playing: HTMLAudioElement | null = null;

/** Play the recording of a line if there is one. Silent otherwise, and whenever sound is muted. */
export function playLine(s: Speech): void {
  const url = voiceUrl(lineKey(s.civ, s.event, s.index));
  if (!url || sfx.muted) return;
  playing?.pause();
  playing = new Audio(url);
  void playing.play().catch(() => { /* the browser refused: the text is still on screen */ });
}

/** A leader's portrait, name and line as HTML. A portrait image named `leader_<civ>` replaces the emoji. */
export function speechHtml(s: Speech): string {
  const l = leaderOf(s.civ);
  if (!l) return '';
  const color = '#' + CIV_COLOR[s.civ].toString(16).padStart(6, '0');
  return `<div class="speech"><span class="portrait" style="border-color:${color}">${ico('leader_' + s.civ, l.icon)}</span>` +
    `<div><b style="color:${color}">${l.name}</b> <small>${s.event.startsWith('p_') ? 'your leader' : CIVS[s.civ].name}${voiceCredit(s.civ) ? ` · voiced by ${voiceCredit(s.civ).replace(/[<>&]/g, '')}` : ''}</small><p>\u201c${speechText(s)}\u201d</p></div></div>`;
}
