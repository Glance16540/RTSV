// The season's report, drawn: a small card over the map when a turn has ended, saying what changed in the player's
// nation that season. Known people by name and face, everyone else in counts; only lines with something in them.
// What goes into it is src/sim/seasonreport.ts.
import type { Campaign } from '../sim/campaign';
import { reportDue, reportLines, SeasonReport, Named } from '../sim/seasonreport';
import { nationOf, notablePortrait } from '../sim/portrait';
import { portraitHtml } from './portrait';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const ICON = { people: '👶', loss: '✝', captives: '⛓️', raid: '🔥', drift: '🍺', land: '🏴' } as const;

/** A known person's row: their face, name and what they are known for. */
function personRow(c: Campaign, n: Named, gone?: string): string {
  const face = portraitHtml(notablePortrait(nationOf(c.factions[0]?.civ), n, gone ? { bereaved: true } : {}), '', 'md');
  const who = `<b>${esc(n.name)}</b>${n.family ? ' ' + esc(n.family) : ''} <small>of ${esc(n.land)}</small>`;
  return `<div class="season-person${gone ? ' gone' : ''}">${face}<div>${who}<div>${gone ? `who ${esc(n.deed)}: ${esc(gone)}` : `has ${esc(n.deed)}, and is known for it`}</div></div></div>`;
}

/** The card's inner HTML for a report. */
export function seasonCardHtml(c: Campaign, r: SeasonReport): string {
  const lines = reportLines(r).map((l) => `<div class="season-line ${l.tone}"><span>${ICON[l.kind]}</span> ${esc(l.text)}</div>`).join('');
  const made = r.made.map((n) => personRow(c, n)).join(''), gone = r.gone.map((n) => personRow(c, n, n.how)).join('');
  const span = r.turn - r.from > 1 ? `Turns ${r.from + 1} to ${r.turn}` : `Turn ${r.turn}`;
  return `<button class="season-x" title="Close (Esc)" aria-label="Close">×</button><h2>The season past <small>${span}</small></h2>` +
    (gone ? `<h3>Lost</h3>${gone}` : '') + (made ? `<h3>Known by name</h3>${made}` : '') + (lines ? `<div class="season-lines">${lines}</div>` : '') +
    '<div class="season-foot"><button class="season-ok">Close</button></div>';
}

/** Show the season's card if one is waiting and nothing else is being asked of the player; closing it marks it seen. */
export function seasonCard(c: Campaign, busy: boolean, onClose: () => void): void {
  let el = document.getElementById('season-card');
  const r = reportDue(c);
  if (!r || busy || c.phase !== 'player') { el?.remove(); return; }
  if (el) return; // already showing
  el = document.createElement('div');
  el.id = 'season-card';
  el.innerHTML = `<div class="season-sheet" role="dialog" aria-label="The season past">${seasonCardHtml(c, r)}</div>`;
  const close = (): void => { r.seen = true; el!.remove(); document.removeEventListener('keydown', key); onClose(); };
  const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', (e) => { const t = e.target as HTMLElement; if (t === el || t.closest('.season-x, .season-ok')) close(); });
  document.addEventListener('keydown', key);
  (document.getElementById('overworld') ?? document.body).appendChild(el);
}
