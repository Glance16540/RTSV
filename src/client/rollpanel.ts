// The "Your people" screen: the roll of the player's nation (src/sim/roll.ts), drawn. Read only.
// Children are counted, never listed.
import type { Campaign } from '../sim/campaign';
import { rollOf } from '../sim/roll';
import type { Roll } from '../sim/roll';
import { FEELING_WORDS, feelingOf, nationOf, notablePortrait } from '../sim/portrait';
import type { Feeling, Mood } from '../sim/portrait';
import { portraitHtml, townFaces } from './portrait';
import { HEIR_AGE } from '../sim/dynasty';
import { SEASONS_A_YEAR } from '../sim/ageing';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const n = (k: number, one: string, many: string): string => `${k} ${k === 1 ? one : many}`;

/** The roll as a page. */
export function rollHtml(c: Campaign, roll: Roll = rollOf(c, 0)): string {
  const r = roll, L = r.leader;
  const head = `<span class="roll-head"><b>The ${esc(r.people)}</b>${r.house ? ` · the House of ${esc(r.house)}` : ''}</span>
    <span class="roll-sum">${n(r.totals.grown, 'grown person', 'grown people')}, ${n(r.totals.children, 'child', 'children')}${r.totals.away ? ` · ${n(r.totals.away, 'man', 'men')} away with the armies` : ''}${r.totals.held ? ` · ${r.totals.held} held captive` : ''} · ${n(r.totals.known, 'person', 'people')} known by name</span>`;
  const leader = `<span class="roll-h">Who leads them</span><span class="roll-leader">♛ <b>${esc(L.name)}</b>${L.rank ? ` <small>${esc(L.rank)}</small>` : ''}${L.alive ? (L.at ? `, at ${esc(L.at)}` : '') : ' <span class="roll-bad">has fallen: the rule is unsettled</span>'}</span>` +
    (r.spouse ? `<span class="roll-spouse">${face(r.spouse.name, r.spouse.female, r.spouse.lost ? 'grief' : 'content')}<span>${r.spouse.female ? 'Wife' : 'Husband'}: <b>${esc(r.spouse.name)}</b>, ${n(r.spouse.years, 'year', 'years')} old${r.spouse.lost ? ` <span class="roll-bad">${r.spouse.lost.how === 'taken' ? (r.spouse.lost.final ? 'carried off, and lost for good' : 'carried off, and held: see below') : r.spouse.lost.how} (turn ${r.spouse.lost.turn})</span>` : ''}</span></span>` : '') +
    (r.heirs.length ? `<span class="roll-heirs">${r.heirs.map((h) => `<span>${h.female ? 'Daughter' : 'Son'}${h.parent ? ` of ${esc(h.parent)}` : ''}: <b>${esc(h.name)}</b>, ${n(h.years, 'year', 'years')} old${h.ofAge ? ' <small>of age to lead</small>' : ` <small>of age in ${n(Math.ceil((HEIR_AGE / SEASONS_A_YEAR) - h.years), 'year', 'years')}</small>`}</span>`).join('')}</span>` : '<span class="roll-heirs"><small>No heirs.</small></span>');
  const remembered = (marks: string[]): string => marks.map((m) => `<span class="roll-mark">🕯️ ${esc(m)}</span>`).join('');
  const circle = r.circle.length ? `<span class="roll-h">Who stands closest</span><span class="roll-people">${r.circle.map((x) => `<span class="roll-person">${face(x.name, x.female, x.feeling, x.family, x.kind, x.unit)}<span><b>${esc(x.name)}</b> <small>${esc(x.postName)}, of ${esc(x.townName)}</small><br><small>loyalty ${x.loyalty} · ${FEELING_WORDS[x.feeling]}</small>${x.marks.map((m) => `<br><small class="roll-mark">🕯️ ${esc(m)}</small>`).join('')}</span></span>`).join('')}</span>` : '';
  const towns = `<span class="roll-h">Town by town</span>` + r.towns.map((t) => {
    const faces = townFaces(c, t.id), mood = FEELING_WORDS[feelingOf(faces.mood)];
    const people = t.notables.map((p) => `<span class="roll-person">${faces.notable({ name: p.name, ...(p.family ? { family: p.family } : {}), gender: p.gender, kind: p.kind, ...(p.unit ? { unit: p.unit } : {}) })}<span><b>${esc(p.name)}</b>${p.family ? ` <small>${esc(p.family)}</small>` : ''}<br><small>${esc(p.deed)}</small></span></span>`).join('');
    return `<span class="roll-town"><span class="roll-townhead"><b>${esc(t.name)}</b> <small>${n(t.men, 'man', 'men')}, ${n(t.women, 'woman', 'women')}, ${t.elders} old, ${n(t.children, 'child', 'children')} · ${mood}</small>${faces.marks}</span>` +
      remembered(t.marks) +
      (t.away ? `<span class="roll-away">⚔️ ${n(t.away, 'man', 'men')} of ${esc(t.name)} away with the armies</span>` : '') +
      (people ? `<span class="roll-people">${people}</span>` : '<span class="roll-none"><small>Nobody here is known by name yet.</small></span>') + '</span>';
  }).join('');
  const held = r.captives.length ? `<span class="roll-h">Held captive</span>` + r.captives.map((x) => `<span class="roll-held">⛓️ ${[x.women ? n(x.women, 'woman', 'women') : '', x.men ? n(x.men, 'man', 'men') : ''].filter(Boolean).join(' and ')} of ${esc(x.from)}${x.names.length ? ` (${x.names.map(esc).join(', ')})` : ''}, held by ${esc(x.kind.toLowerCase())}, ${esc(x.band)}, at ${esc(x.place)}: <b>${x.seasonsLeft ? n(x.seasonsLeft, 'season', 'seasons') + ' left' : 'about to be lost'}</b> to get them back.</span>`).join('') : '';
  const lost = r.lost.length ? `<span class="roll-h">Lost of late</span>` + r.lost.map((p) => `<span class="roll-lost"><b>${esc(p.name)}</b> of ${esc(p.townName)}, who ${esc(p.deed)}: ${esc(p.how)} <small>(turn ${p.turn})</small></span>`).join('') : '';
  return `<span class="roll">${head}${leader}${remembered(r.marks)}${circle}${towns}${held}${lost}</span>`;

  /** A face for someone close to the leader, in their own mood. */
  function face(name: string, female: boolean, feeling: Feeling, family?: string, kind?: string, unit?: string): string {
    const mood: Mood = feeling === 'angry' ? { wronged: true } : feeling === 'afraid' ? { raided: true } : feeling === 'grief' ? { bereaved: true } : {};
    return portraitHtml(notablePortrait(nationOf(c.factions[0]?.civ), { name, gender: female ? 'f' : 'm', kind: kind ?? 'kin', ...(family ? { family } : {}), ...(unit ? { unit } : {}) }, mood), '', 'sm');
  }
}

/** Put the "Your people" button in the map's foot, beside the chronicle. */
export function mountRoll(open: () => void): void {
  const by = document.getElementById('ow-chronicle');
  if (!by || document.getElementById('ow-roll')) return;
  const b = document.createElement('button');
  b.id = 'ow-roll';
  b.textContent = '👥 Your people';
  b.addEventListener('click', open);
  by.after(b);
}
