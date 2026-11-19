// A free town on the land's panel (src/sim/freetown.ts): what it is, and the order to treat with it.
import type { Campaign } from '../sim/campaign';
import { canPayFor } from '../sim/prices';
import { FREE, isFree, treatBar, treatCost } from '../sim/freetown';
import { claimantLine } from '../sim/claimantrising';

const esc = (s: string): string => s.replace(/[<>&"]/g, '');

/** The line and the button for a free town: whose it was, what it asks, and why it might refuse. '' for any other land. */
export function freeTownButtons(c: Campaign, tid: number): string {
  if (!isFree(c, tid)) return '';
  const t = c.territories[tid], from = t.free!.from, years = Math.round((c.turn - t.free!.since) / 4);
  const whose = from === 0 ? 'your rule' : `the rule of the ${c.factions[from]?.name ?? 'people it left'}`;
  const line = `<div class="hint">🕊️ ${esc(t.name)} is a free town: it threw off ${esc(whose)} ${years < 1 ? 'this year' : years === 1 ? 'a year ago' : `${years} years ago`}, and its people are still there.</div>${claimantLine(c, tid) ? `<div class="hint">👑 ${esc(claimantLine(c, tid))}</div>` : ''}`;
  if (from !== 0) return line;
  const bar = treatBar(c, 0, tid), price = treatCost(c, tid), short = !bar && !canPayFor(c, 0, 'dealing', price);
  const why = bar || (short ? `You have not the ${price} supplies it asks.` : `It comes back whole, with no war. It asks less as the years pass and with your army beside it; it would refuse if it were hungry, or if you marched on it and were thrown back (for ${FREE.grudge} seasons).`);
  return `${line}<button data-act="treat" title="${esc(why)}" ${!bar && !short && c.phase === 'player' ? '' : 'disabled'}>🕊️ Treat with ${esc(t.name)} <small>${price}</small></button>${bar ? `<div class="hint">${esc(bar)}</div>` : ''}`;
}
