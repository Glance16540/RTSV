// The battles fought out on the map, told in full (src/sim/battletales.ts reads them; mapbattle.ts keeps them). Read only.
//
// Opened three ways: the "⚔️ Battles" button beside the chronicle lists them all, newest open; a battle's line in the
// log opens it; and the land panel names the battles fought on the land selected, each opening its own.
import type { Campaign } from '../sim/campaign';
import type { BattleTale } from '../sim/mapbattle';
import { readTale, talesAt, talesOf } from '../sim/battletales';
import type { TaleSide } from '../sim/battletales';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const MARK = { won: '🏆', lost: '💀', theirs: '⚔️' } as const;

/** One battle as a page. */
export function taleHtml(c: Campaign, t: BattleTale): string {
  const r = readTale(c, t);
  const side = (s: TaleSide): string => `<span class="tale-side${s.won ? ' tale-won' : ''}"><b>${esc(s.who)}</b>${s.won ? ' <small>won the field</small>' : ''}
    ${s.led ? `<span>♛ Led by ${esc(s.led)}</span>` : '<span><small>No leader of note</small></span>'}
    <span>Brought: ${esc(s.began)}</span>
    <span>Lost: ${s.lostN ? esc(s.lost) : 'nobody'}</span>
    ${s.scattered ? '<span class="tale-bad">Scattered, and went home</span>' : ''}</span>`;
  return `<span class="tale"><span class="tale-when">${esc(r.when)}</span><span class="tale-how"><b>${esc(r.how)}</b></span>
    <span class="tale-sides">${side(r.sides[0])}${side(r.sides[1])}</span>
    ${r.walls ? `<span class="tale-walls">🧱 ${esc(r.walls)}</span>` : ''}
    ${r.fell.length ? `<span class="tale-h">The fallen of note</span><span class="tale-fell">${r.fell.map((n) => `<span>🕯️ ${esc(n)}</span>`).join('')}</span>` : ''}
    ${r.stood ? `<span class="tale-h">Who stood</span><span class="tale-stood">⭐ ${esc(r.stood)}</span>` : ''}</span>`;
}

/** Every battle the player fought on the map, newest first, each folded but the newest. */
export function talesHtml(c: Campaign, open?: BattleTale): string {
  const all = talesOf(c, 0);
  if (!all.length) return '<span class="tale-none">No battle has been fought out on the map yet. When one is, it is told here: who came, who broke, and who fell.</span>';
  const first = open ?? all[0];
  return `<span class="tales">${all.map((t) => { const r = readTale(c, t); return `<details class="tale-fold"${t === first ? ' open' : ''}><summary>${MARK[r.mine]} ${esc(r.title)} <small>turn ${t.turn}</small></summary>${taleHtml(c, t)}</details>`; }).join('')}</span>`;
}

/** For the land panel: the battles fought on this land, each a link that opens it. */
export function landTalesHtml(c: Campaign, tid: number): string {
  const here = talesAt(c, tid).slice(0, 3);
  return here.length ? `<div class="hint tale-here">⚔️ Fought here: ${here.map((t) => `<a href="#" class="tale-link" data-tale="${(c.tales ?? []).indexOf(t)}">turn ${t.turn}, ${t.attackerWon ? 'taken' : 'held'}</a>`).join(' · ')}</div>` : '';
}

/** A line of the log, made a link to its battle if it tells one. */
export function logLine(c: Campaign, line: string): string {
  const i = (c.tales ?? []).findIndex((t) => t.text === line);
  return i < 0 ? `<div>${line}</div>` : `<div><a href="#" class="tale-link" data-tale="${i}">${line}</a></div>`;
}

let opener: ((t?: BattleTale) => void) | undefined;
/** Put the "Battles" button in the map's foot and listen for a battle's link anywhere: `open` shows the dialog. */
export function mountTales(c: () => Campaign, open: (html: string) => void): void {
  opener = (t) => open(talesHtml(c(), t));
  if (!document.body.dataset.tales) {
    document.body.dataset.tales = '1';
    document.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement)?.closest?.<HTMLElement>('.tale-link');
      if (!a) return;
      e.preventDefault();
      const t = c().tales?.[Number(a.dataset.tale)];
      if (t) opener?.(t);
    });
  }
  const by = document.getElementById('ow-roll') ?? document.getElementById('ow-chronicle');
  if (!by || document.getElementById('ow-tales')) return;
  const b = document.createElement('button');
  b.id = 'ow-tales';
  b.textContent = '⚔️ Battles';
  b.addEventListener('click', () => opener?.());
  by.after(b);
}
