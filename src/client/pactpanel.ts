// Royal marriages and trade deals on a rival's land panel: what binds the player's people to theirs, the offers the
// player may make, and an offer of theirs waiting on an answer. The rules are src/sim/royalmarriage.ts and
// src/sim/tradedeal.ts.
import type { Campaign } from '../sim/campaign';
import { pactOf } from '../sim/pacts';
import { answerMarriage, marryBar, matchOf, offerMarriage } from '../sim/royalmarriage';
import { answerTrade, offerTrade, tradeBar } from '../sim/tradedeal';
import { rulerName } from '../sim/dynasty';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');
const btn = (act: string, label: string, bar: string, title: string): string => `<button data-act="${act}"${bar ? ` disabled title="${esc(bar)}"` : ` title="${esc(title)}"`}>${label}</button>`;

/** For a land of rival `f`: the pacts in force, the player's offers, and their offer waiting on an answer. */
export function pactHtml(c: Campaign, f: number): string {
  if (f <= 0 || !c.factions[f]?.alive) return '';
  let html = '';
  const wed = pactOf(c, 'marriage', 0, f), trade = pactOf(c, 'trade', 0, f);
  if (wed) html += `<div class="hint">💍 ${esc(wed.wed?.[wed.a === 0 ? 0 : 1] ?? '')} of your house is wed to ${esc(wed.wed?.[wed.a === 0 ? 1 : 0] ?? '')} of theirs: at peace until turn ${wed.until}.</div>`;
  if (trade) html += `<div class="hint">⚖️ Your markets are open to each other's caravans until turn ${trade.until}.</div>`;
  const o = c.pactOffer;
  if (o && o.from === f && c.phase === 'player') {
    html += `<div class="hint">${o.kind === 'marriage' ? `💍 ${esc(rulerName(c, f))} offers ${esc(o.wed?.[0] ?? '')} of their house to ${esc(o.wed?.[1] ?? '')} of yours.` : `⚖️ ${esc(rulerName(c, f))} offers a trade deal.`}</div>`;
    html += `<button data-act="pactoffer:yes">Accept</button><button data-act="pactoffer:no">Decline</button>`;
  }
  if (c.phase === 'player') {
    const m = matchOf(c, 0, f);
    if (!wed) html += btn(`marry:${f}`, `💍 Offer ${esc(m ? m[0].name : 'a child of your house')} in marriage`, marryBar(c, 0, f), `${m ? `${m[0].name} of your house would wed ${m[1].name} of theirs. ` : ''}Grown children only. Binds your peoples in peace, and in time a child of both houses may have a claim on both thrones.`);
    if (!trade) html += btn(`tradedeal:${f}`, '⚖️ Offer a trade deal', tradeBar(c, 0, f), 'Opens your markets to each other\'s caravans for a term, with gold to each.');
  }
  return html;
}

/** Do what a button above asks. */
export function pactDo(c: Campaign, kind: string, id: string): void {
  if (kind === 'marry') offerMarriage(c, Number(id));
  else if (kind === 'tradedeal') offerTrade(c, Number(id));
  else if (kind === 'pactoffer') { if (c.pactOffer?.kind === 'marriage') answerMarriage(c, id === 'yes'); else answerTrade(c, id === 'yes'); }
}
