// What the campaign screen says of the bands on the map and of what they have done (src/sim/threats.ts).
import type { Campaign } from '../sim/campaign';
import { bodyOf, captiveKeys, nationOf } from '../sim/portrait';
import type { Portrait } from '../sim/portrait';
import { BANDS, Band, Raid, bandsAt, defenceOf, raidsAt, reportText, seasonsLeft } from '../sim/threats';
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
  const where = b.kind === 'highwaymen' ? `on the road between ${esc(c.territories[b.at].name)} and ${esc(c.territories[b.to!].name)}` : `has its ${k.place} here`;
  const held = b.held.map((h) => {
    const who = [h.women.length ? plural(h.women.length, 'woman', 'women') : '', h.men.length ? plural(h.men.length, 'man', 'men') : ''].filter(Boolean).join(' and ');
    const left = seasonsLeft(c, h);
    const faces = (h.women.length ? heldFace(c, h.owner, 'f', b.kind, `${b.id}|${h.from}|f`) : '') + (h.men.length ? heldFace(c, h.owner, 'm', b.kind, `${b.id}|${h.from}|m`) : '');
    return `<div class="likeness-row">${faces}Holding ${who} of ${h.owner === 0 ? 'yours' : esc(c.factions[h.owner]?.name ?? 'another people') + '\'s'} from ${esc(c.territories[h.from].name)}${h.names?.length ? ` (${h.names.map(esc).join(', ')} among them)` : ''}: ${plural(left, 'season', 'seasons')} left to get them back.</div>`;
  }).join('');
  return `<div class="bad">${k.icon} <b>${esc(b.name[0].toUpperCase() + b.name.slice(1))}</b>, ${k.name.toLowerCase()}, ${where}. Strength ${b.strength}. ${k.desc}${held}<div class="hint">An army standing here when the season turns fights them. Breaking them frees whoever they hold.</div></div>`;
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
  const own = d && (c.bands ?? []).length ? `<div class="hint" title="What this town has to defend itself with against a band: its men, its fortress and barracks, the towers and walls on its battlefield, an army kept here, and the spirit of its people.">🛡️ Against a band this town can muster ${d.total}.</div>` : '';
  return reports + bands + own;
}
