// Portraits drawn: the woodblock icon that src/sim/portrait.ts chose, with its marks of condition small over it.
// When none of the chosen icons is there, the old picture or emoji the caller gives stands in.
import type { Captive, Game, Unit, Building } from '../sim/game';
import type { Campaign } from '../sim/campaign';
import { MARK_WORDS, Portrait, STANDING_WORDS, captivePortrait, captorOf, markKey, nationOf, notablePortrait, pickKey, standingKeys, standingOf, townMarks, townMood, townStanding, unitPortrait } from '../sim/portrait';
import { iconSrc } from './assets';

const has = (k: string): boolean => !!iconSrc(k);
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** How many marks a portrait has room for. */
const MARKS = 3;

/** HTML for a portrait at one of three sizes; `fallback` when no icon of it is there. */
export function portraitHtml(p: Portrait | null, fallback = '', size: 'sm' | 'md' | 'lg' = 'md'): string {
  if (!p) return fallback;
  const key = pickKey(p.keys, has);
  if (!key) return fallback;
  const marks = p.marks.map((m) => [m, markKey(m, p.sex)] as const).filter(([, k]) => has(k)).slice(0, MARKS)
    .map(([m, k], i) => `<img class="likeness-mark m${i}" src="${iconSrc(k)}" alt="" title="${esc(MARK_WORDS[m])}" draggable="false">`).join('');
  const title = p.words ? ` title="${esc(p.words[0].toUpperCase() + p.words.slice(1))}"` : '';
  return `<span class="likeness ${size}"${title}><img class="ico" src="${iconSrc(key)}" alt="" draggable="false">${marks}</span>`;
}

/** Anyone on a battlefield. */
export const unitPortraitHtml = (g: Game, u: Unit, fallback = '', size: 'sm' | 'md' | 'lg' = 'lg'): string => portraitHtml(unitPortrait(g, u), fallback, size);
/** Someone held: by the unit leading them away, or in the camp that keeps them. */
export const captivePortraitHtml = (g: Game, c: Captive, by: Unit | Building, size: 'sm' | 'md' | 'lg' = 'sm'): string =>
  portraitHtml(captivePortrait(g, c, captorOf(by), by.kind === 'unit'), '', size);

/** A town's standing, as a man and a woman of it, with the words beside them. */
export function standingHtml(civ: string, virtue: number): string {
  const nation = nationOf(civ), s = townStanding(nation, virtue);
  const man = pickKey(s.man, has), woman = pickKey(s.woman, has);
  if (!man && !woman) return '';
  const img = (k: string | null): string => (k ? `<img class="ico" src="${iconSrc(k)}" alt="" draggable="false">` : '');
  return `<span class="likeness-standing" title="The town's standing: ${STANDING_WORDS[s.standing]}">${img(woman)}${img(man)}<small>${STANDING_WORDS[s.standing]}</small></span>`;
}

/** A woman of the tavern, as the town's standing makes her. */
export function tavernFace(civ: string, virtue: number): string {
  const k = pickKey(standingKeys(nationOf(civ), 'tavern', standingOf(virtue)), has);
  return k ? `<img class="ico" src="${iconSrc(k)}" alt="" draggable="false">` : '';
}

/** On the campaign map: how a town's people are, and its notable people, in its present mood. */
export function townFaces(c: Campaign, tid: number): { mood: ReturnType<typeof townMood>; nation: string; marks: string; notable: (n: Parameters<typeof notablePortrait>[1]) => string } {
  const t = c.territories[tid], f = c.factions[t.owner];
  const nation = nationOf(f?.civ), mood = townMood(c, tid);
  const marks = townMarks(mood).map((m) => (has(markKey(m)) ? `<img class="ico likeness-flag" src="${iconSrc(markKey(m))}" alt="" title="${esc(MARK_WORDS[m])}" draggable="false">` : '')).join('');
  return { mood, nation, marks, notable: (n) => portraitHtml(notablePortrait(nation, n, mood), '', 'sm') };
}
