// Leaders speaking: the words on screen, and the recording of them once one exists.

import { CIV_COLOR, CIVS } from '../sim/data';
import { Speech, leaderOf, lineKey, monogram, speechText } from '../sim/leaders';
import { portrait, voiceCredit, voiceUrl } from './assets';
import { sfx } from './sfx';
import { FOLK_VOICES, FolkMoment, Lean, folkKey, leanOf } from '../sim/folk';
import type { Game, Unit } from '../sim/game';

let playing: HTMLAudioElement | null = null;

/** Play the recording of a line if there is one. Silent otherwise, and whenever sound is muted. */
export function playLine(s: Speech): void {
  const url = voiceUrl(lineKey(s.civ, s.event, s.index));
  if (!url || sfx.muted) return;
  playing?.pause();
  playing = new Audio(url);
  void playing.play().catch(() => { /* the browser refused: the text is still on screen */ });
}

/** A leader's portrait, name and line as HTML. Until a portrait exists they are shown by a seal in their nation's colour. */
/** `as`: the name of whoever leads that people now, where it is no longer the leader as written. */
export function speechHtml(s: Speech, as?: string): string {
  const written = leaderOf(s.civ);
  if (!written) return '';
  const l = as ? { ...written, name: as.replace(/[<>&"]/g, '') } : written;
  const color = '#' + CIV_COLOR[s.civ].toString(16).padStart(6, '0');
  return `<div class="speech"><span class="portrait" style="border-color:${color}">${portrait(s.civ) || `<span class="seal" style="background:${color}">${monogram(l.name)}</span>`}</span>` +
    `<div><b style="color:${color}">${l.name}</b> <small>${s.event.startsWith('p_') ? 'your leader' : CIVS[s.civ].name}${voiceCredit(s.civ) ? ` · voiced by ${voiceCredit(s.civ).replace(/[<>&]/g, '')}` : ''}</small><p>\u201c${speechText(s)}\u201d</p></div></div>`;
}

// ---- the common people ----

/** Which of the people's parts a unit is playing just now: by the work a villager is at, by the arm a warrior fights in. */
export function folkRoleOf(game: Game, u: Unit): string {
  if (u.type === 'villager') {
    const o = u.order;
    if (o?.t === 'build') return 'builder';
    if (o?.t === 'staff') return (game.entities.get(o.id) as { type?: string } | undefined)?.type === 'tavern' ? 'taverner' : 'cleric';
    if (o?.t === 'gather') {
      const kind = (game.entities.get(o.id) as { type?: string } | undefined)?.type;
      return o.res === 'wood' ? 'woodcutter' : o.res === 'gold' || o.res === 'stone' ? 'miner' : kind === 'farm' ? 'farmer' : kind === 'fish' ? 'fisher' : kind === 'carcass' ? 'hunter' : 'forager';
    }
    return 'townsfolk';
  }
  const d = u.def;
  return d.naval ? 'sailor' : d.cls === 'support' ? 'healer' : d.cls === 'siege' ? 'engineer' : d.cls === 'cavalry' ? 'rider' : d.cls === 'ranged' ? 'archer' : 'footman';
}

let barkAt = 0, barking: HTMLAudioElement | null = null;
/**
 * One of the people speaks, if anyone has recorded the line: in the temper of their town, in a man's or a woman's
 * voice as they are, and in one of up to three voices picked by chance. A town between church and tavern, or a line
 * nobody has recorded in its temper, falls back on the plain reading. Never more than one at a time.
 */
export function bark(game: Game, u: Unit, moment: FolkMoment): void {
  if (sfx.muted || performance.now() - barkAt < 900) return;
  const role = folkRoleOf(game, u), sex = u.type === 'villager' && u.gender === 'f' ? 'f' : 'm';
  const mine = leanOf(game.players[u.owner]?.virtue ?? 0);
  const fear: FolkMoment = moment === 'go' && u.type !== 'villager' ? 'march' : moment;
  for (const lean of [mine, 'plain'] as Lean[]) {
    const urls = FOLK_VOICES.map((v) => voiceUrl(folkKey(role, lean, fear, sex, v))).filter((x): x is string => !!x);
    if (!urls.length) continue;
    barkAt = performance.now();
    barking?.pause();
    barking = new Audio(urls[Math.floor(Math.random() * urls.length)]);
    barking.volume = 0.9;
    void barking.play().catch(() => { /* the browser refused */ });
    return;
  }
}
