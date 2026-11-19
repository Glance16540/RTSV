// The season's report, drawn: a small card over the map when a turn has ended, saying what changed in the player's
// nation that season. Known people by name and face, everyone else in counts; only lines with something in them.
// What goes into it is src/sim/seasonreport.ts.
import type { Campaign } from '../sim/campaign';
import { pastSeasons, reportDue, reportLines, SeasonReport, Named } from '../sim/seasonreport';
import { nationOf, notablePortrait } from '../sim/portrait';
import { portraitHtml } from './portrait';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const ICON = { people: '👶', loss: '✝', captives: '⛓️', raid: '🔥', drift: '🍺', land: '🏴', story: '🕯️', settle: '🏡', food: '🌾' } as const;

/** A known person's row: their face, name and what they are known for. */
function personRow(c: Campaign, n: Named, gone?: string): string {
  const face = portraitHtml(notablePortrait(nationOf(c.factions[0]?.civ), n, gone ? { bereaved: true } : {}), '', 'md');
  const who = `<b>${esc(n.name)}</b>${n.family ? ' ' + esc(n.family) : ''} <small>of ${esc(n.land)}</small>`;
  return `<div class="season-person${gone ? ' gone' : ''}">${face}<div>${who}<div>${gone ? `who ${esc(n.deed)}: ${esc(gone)}` : `has ${esc(n.deed)}, and is known for it`}</div></div></div>`;
}

const spanOf = (r: SeasonReport): string => (r.turn - r.from > 1 ? `Turns ${r.from + 1} to ${r.turn}` : `Turn ${r.turn}`);
/** What a season brought: the known people lost and made, then the lines. */
function bodyHtml(c: Campaign, r: SeasonReport): string {
  const lines = foldTold(reportLines(r), c.strikesTold === r.turn).map((l) => `<div class="season-line ${l.tone}"><span>${ICON[l.kind]}</span> ${esc(l.text)}</div>`).join('');
  const made = r.made.map((n) => personRow(c, n)).join(''), gone = r.gone.map((n) => personRow(c, n, n.how)).join('');
  return (gone ? `<h3>Lost</h3>${gone}` : '') + (made ? `<h3>Known by name</h3>${made}` : '') + (lines ? `<div class="season-lines">${lines}</div>` : '');
}
const closer = '<button class="season-x" title="Close (Esc)" aria-label="Close">×</button>';

/** The card's inner HTML for a report. */
type Line = ReturnType<typeof reportLines>[number];
/**
 * The raids that got into the player's towns this season, when they were already told face to face as the season turned
 * (bandmeet.ts tellStrikes): one line in their place rather than the same news twice. Raids beaten off stay as they are.
 */
export function foldTold(lines: Line[], told: boolean): Line[] {
  if (!told) return lines;
  const struck = (l: Line): boolean => l.kind === 'raid' && l.tone === 'bad';
  const n = lines.filter(struck).length, at = lines.findIndex(struck);
  if (!n) return lines;
  const rest = lines.filter((l) => !struck(l));
  rest.splice(at, 0, { kind: 'raid', tone: 'plain', text: `${n === 1 ? 'The raid' : `The ${n} raids`} on your towns, as you were told when the season turned.` });
  return rest;
}

export function seasonCardHtml(c: Campaign, r: SeasonReport): string {
  const past = pastSeasons(c).length > 1;
  return `${closer}<h2>The season past <small>${spanOf(r)}</small></h2>${bodyHtml(c, r)}` +
    `<div class="season-foot">${past ? '<button class="season-past">Past seasons</button>' : ''}<button class="season-ok">Close</button></div>`;
}
/** The seasons kept, newest first, each folded but the newest. */
export function pastSeasonsHtml(c: Campaign): string {
  const list = pastSeasons(c);
  const items = list.map((r, i) => `<details class="season-past-item"${i === 0 ? ' open' : ''}><summary>${spanOf(r)}</summary>${bodyHtml(c, r)}</details>`).join('');
  return `${closer}<h2>Past seasons <small>the last ${list.length}</small></h2>${items || '<p>Nothing is written yet.</p>'}<div class="season-foot"><button class="season-ok">Close</button></div>`;
}

/** A card over the map with the given HTML: closed by its buttons, Escape or a click beside it. */
function overlay(html: string, kind: 'season' | 'past', onClose: () => void, onPast?: () => void): void {
  document.getElementById('season-card')?.remove();
  const el = document.createElement('div');
  el.id = 'season-card';
  el.dataset.kind = kind;
  el.innerHTML = `<div class="season-sheet" role="dialog" aria-label="The seasons">${html}</div>`;
  const done = (): void => { el.remove(); document.removeEventListener('keydown', key); };
  const close = (): void => { done(); onClose(); };
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (onPast && t.closest('.season-past')) { done(); onPast(); return; }
    if (t === el || t.closest('.season-x, .season-ok')) close();
  });
  document.addEventListener('keydown', key);
  (document.getElementById('overworld') ?? document.body).appendChild(el);
}
/** Look back over the seasons kept. */
export function showPastSeasons(c: Campaign, onClose: () => void = () => {}): void { overlay(pastSeasonsHtml(c), 'past', onClose); }

/** Show the season's card if one is waiting and nothing else is being asked of the player; closing it marks it seen. */
export function seasonCard(c: Campaign, busy: boolean, onClose: () => void): void {
  const el = document.getElementById('season-card');
  if (el?.dataset.kind === 'past') return; // the player is looking back: leave them to it
  const r = reportDue(c);
  if (!r || busy || c.phase !== 'player') { el?.remove(); return; }
  if (el) return; // already showing
  const seen = (): void => { r.seen = true; onClose(); };
  overlay(seasonCardHtml(c, r), 'season', seen, () => { r.seen = true; showPastSeasons(c, onClose); }); // looking back first: what waits comes when that is closed
}
