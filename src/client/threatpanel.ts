// What the campaign screen says of the bands on the map and of what they have done (src/sim/threats.ts).
import { strengthOf, strengthWord, whole } from '../sim/strengthwords';
import { carriedLeft } from '../sim/carriedoff';
import type { Campaign } from '../sim/campaign';
import { bodyOf, captiveKeys, nationOf } from '../sim/portrait';
import type { Portrait } from '../sim/portrait';
import { BANDS, Band, Raid, bandsAt, defenceOf, heldFrom, raidsAt, reportText, seasonsLeft } from '../sim/threats';
import { armiesFor } from '../sim/bandfight';
import { raidPending } from '../sim/raidfought';
import { fig } from './mapfigures';
import { seasonNews } from '../sim/raidnews';
import { portraitHtml } from './portrait';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The likeness of someone held by a band: as their own people, in the keeper's hands. Slavers' captives have faces of their own. */
function heldFace(c: Campaign, owner: number, sex: 'm' | 'f', kind: Band['kind'], seed: string): string {
  const nation = nationOf(c.factions[owner]?.civ), body = bodyOf(sex, seed);
  const p: Portrait = { keys: captiveKeys(nation, sex, kind === 'slavers' ? 'slaver' : 'rival', body), marks: ['captive'], sex, body, nation, words: sex === 'f' ? 'a woman carried off' : 'a man taken in chains' };
  return portraitHtml(p, '', 'sm');
}

function bandHtml(c: Campaign, b: Band): string {
  const k = BANDS[b.kind];
  const where = b.kind === 'marauders' ? 'hold this land' : b.kind === 'highwaymen' ? `on the road between ${esc(c.territories[b.at].name)} and ${esc(c.territories[b.to!].name)}` : `has its ${k.place} here`;
  const held = b.held.map((h) => {
    const who = [h.women.length ? plural(h.women.length, 'woman', 'women') : '', h.men.length ? plural(h.men.length, 'man', 'men') : ''].filter(Boolean).join(' and ');
    const left = seasonsLeft(c, h);
    const faces = (h.women.length ? heldFace(c, h.owner, 'f', b.kind, `${b.id}|${h.from}|f`) : '') + (h.men.length ? heldFace(c, h.owner, 'm', b.kind, `${b.id}|${h.from}|m`) : '');
    return `<div class="likeness-row">${faces}Holding ${who} of ${h.owner === 0 ? 'yours' : esc(c.factions[h.owner]?.name ?? 'another people') + '\'s'} from ${esc(c.territories[h.from].name)}${h.names?.length ? ` (${h.names.map(esc).join(', ')} among them)` : ''}: ${plural(left, 'season', 'seasons')} left to get them back.</div>`;
  }).join('');
  return `<div class="bad">${k.icon} <b>${esc(b.name[0].toUpperCase() + b.name.slice(1))}</b>, ${k.name.toLowerCase()}, ${where}. Strength ${whole(b.strength)} (${strengthWord(b.strength)}). ${k.desc}${held}<div class="hint">${b.kind === 'marauders' ? 'They hold this land: march an army into it to break them.' : 'Send an army that stands here or next door against them. Breaking them frees whoever they hold.'}</div></div>`;
}

function raidHtml(c: Campaign, r: Raid): string {
  const faces = (r.taken.women ? heldFace(c, r.owner, 'f', r.kind, `${r.band}|${r.at}|f`) : '') + (r.taken.men ? heldFace(c, r.owner, 'm', r.kind, `${r.band}|${r.at}|m`) : '');
  const [head, ...rest] = reportText(c, r).map(esc);
  return `<div class="${r.outcome === 'held' ? 'good' : 'bad'} raid-report"><b>${BANDS[r.kind].icon} ${head}</b>${rest.map((l) => `<div>${l}</div>`).join('')}${faces ? `<div class="likeness-row">${faces}</div>` : ''}</div>`;
}

/** Everything about bands that belongs on a land's panel: this season's reports of strikes on it, any band placed there, and what the town could defend with. */
export function threatHtml(c: Campaign, tid: number): string {
  const t = c.territories[tid];
  const reports = raidsAt(c, tid).map((r) => raidHtml(c, r)).join('');
  const bands = bandsAt(c, tid).map((b) => bandHtml(c, b)).join('');
  const d = t.owner === 0 ? defenceOf(c, tid) : null;
  const own = d && (c.bands ?? []).length ? `<div class="hint" title="What this town has to defend itself with against a band: its men, its fortress and barracks, the towers and walls on its battlefield, an army kept here, and the spirit of its people.">🛡️ Against a band this town can muster ${whole(d.total)}.</div>` : '';
  // Those of this town who are in a band's hands: who, how many, where they are held and how long is left.
  const gone = heldFrom(c, tid).map(({ band: b, held: h }) => {
    const who = [h.women.length ? plural(h.women.length, 'woman', 'women') : '', h.men.length ? plural(h.men.length, 'man', 'men') : ''].filter(Boolean).join(' and ');
    const left = seasonsLeft(c, h);
    return `<div class="bad">⛓️ ${who} of this town ${h.women.length + h.men.length === 1 ? 'is' : 'are'} held by ${esc(b.name)} at ${esc(c.territories[b.at].name)}: ${plural(left, 'season', 'seasons')} left to get ${h.women.length + h.men.length === 1 ? (h.women.length ? 'her' : 'him') : 'them'} back${b.kind === 'marauders' ? ' by taking that land' : ' by breaking the band'}.</div>`;
  }).join('');
  // Those a nation has led away: where they are held, and the town they were taken from (carriedoff.ts).
  const led = (c.carried ?? []).filter((x) => x.at === tid || x.held.from === tid).map((x) => {
    const who = [x.held.women.length ? plural(x.held.women.length, 'woman', 'women') : '', x.held.men.length ? plural(x.held.men.length, 'man', 'men') : ''].filter(Boolean).join(' and ');
    const whose = x.held.owner === 0 ? 'yours' : esc(c.factions[x.held.owner]?.name ?? 'another people') + '\'s', left = carriedLeft(c, x);
    return x.at === tid
      ? `<div class="bad">⛓️ ${who} of ${whose} from ${esc(c.territories[x.held.from].name)} ${x.held.women.length + x.held.men.length === 1 ? 'is' : 'are'} held here by the ${esc(c.factions[x.by]?.name ?? 'holders')}: ${plural(left, 'season', 'seasons')} until they are theirs for good. Whoever takes this land sets them free.</div>`
      : `<div class="bad">⛓️ ${who} of this town ${x.held.women.length + x.held.men.length === 1 ? 'was' : 'were'} led away by the ${esc(c.factions[x.by]?.name ?? 'takers')} to ${esc(c.territories[x.at].name)}: ${plural(left, 'season', 'seasons')} left to get them back by taking it.</div>`;
  }).join('');
  return reports + bands + gone + led + own;
}

/** The orders a land's panel offers against the bands placed there: one for each army of the player's that could be sent. */
export function bandButtons(c: Campaign, tid: number): string {
  if (c.phase !== 'player') return '';
  return bandsAt(c, tid).flatMap((b) => armiesFor(c, b.id).map((a) =>
    `<button data-act="band:${a.id}/${b.id}" title="A battle you can enter: your army's own companies against the band's men on open ground. Nothing changes hands but the band's captives and what it stole.">⚔️ Send the army at ${esc(c.territories[a.at].name)} against ${esc(b.name)}</button>`)).join('');
}

/** What to ask the player when an army of theirs is about to fight a band; `decline`: whether the fight can be called off (not when the band came against the army). */
export function bandPrompt(c: Campaign): { title: string; text: string; decline: boolean } | null {
  const p = c.pending, b = (c.bands ?? []).find((x) => x.id === p?.band);
  if (!p || !b) return null;
  const held = b.held.reduce((n, h) => n + h.men.length + h.women.length, 0);
  const odds = `Your army's strength of ${fig(p.aStr)} against ${BANDS[b.kind].name.toLowerCase()} of ${strengthOf(b.strength)}, at ${esc(c.territories[p.from].name)}. ` +
    (held ? `They hold ${plural(held, 'person', 'people')}, who go free if the band is broken. ` : '');
  if (p.ambush) return {
    title: `${b.name[0].toUpperCase() + b.name.slice(1)} fall on your army!`,
    text: `They have come against it in the open. ${odds}Fight it yourself, or leave it to the army, which will do as well or as badly as its strength allows. It cannot be called off.`,
    decline: false,
  };
  return {
    title: `Fight ${b.name}?`,
    text: `${odds}Fight it yourself on open ground, or leave it to the army, which will do as well or as badly as its strength allows. No land changes hands.`,
    decline: true,
  };
}

/** What to ask the player when a band is about to strike a town of theirs (raidfought.ts): fight for it in person, or leave it to the town. It cannot be called off. */
export function raidPrompt(c: Campaign): { title: string; text: string } | null {
  const p = c.pending, b = raidPending(c);
  if (!p || !b) return null;
  const t = c.territories[p.to];
  return {
    title: `${b.name[0].toUpperCase() + b.name.slice(1)} come against ${t.name}!`,
    text: `${BANDS[b.kind].name} of ${strengthOf(b.strength)} against the town's defence of ${fig(p.dStr)}. Fight for the town yourself, with its own men and any army standing there, or leave it to the town, which will hold or fall by what it has. Beaten off, they are the weaker for it; if they get in they take what they can carry, and may lead people away.`,
  };
}

/** The season's news of the bands, each line opening the land it happened in. */
export function newsHtml(c: Campaign): string {
  const news = seasonNews(c);
  if (!news.length) return '';
  return `<div class="raid-news">${news.map((n) => `<div class="${n.tone === 'good' ? 'good' : n.tone === 'bad' ? 'bad' : ''}" data-land="${n.at}" title="Open ${esc(n.land)}">${esc(n.headline)}</div>`).join('')}</div>`;
}
