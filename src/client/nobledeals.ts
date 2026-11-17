// The leader's dealings with the nobles of a town, on the land's panel: one "Deal with ..." for each noble, which opens
// the five dealings with each one's price and what it does, and asks again before a noble is stripped of their lands.
// The rules are in src/sim/nobledeal.ts.
import type { Campaign } from '../sim/campaign';
import { DEALS, dealCost, dealEffect, dealWith, dealsFor, nobleByKey } from '../sim/nobledeal';
import type { DealKind } from '../sim/nobledeal';
import { noblesAt, titleOf } from '../sim/nobles';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const ICON: Record<DealKind, string> = { summon: '🏰', gift: '🎁', post: '🎖️', wed: '💍', strip: '⚔️' };

/** One "Deal with ..." for each noble of one of the player's towns that may be dealt with. */
export function nobleDealPanel(c: Campaign, tid: number): string {
  if (c.territories[tid]?.owner !== 0) return '';
  let html = '';
  for (const n of noblesAt(c, tid).filter((x) => x.rank !== 'close')) {
    if (!dealsFor(c, 0, n.key).length) continue;
    const held = [n.title, n.wed ? `wed to ${n.wed} of your house` : ''].filter(Boolean).join(', ');
    html += `<button data-act="nobledeal:${encodeURIComponent(n.key)}" ${c.phase !== 'player' ? 'disabled' : ''} title="Summon, a gift, a post, a marriage, or stripping of lands">🤝 Deal with ${esc(titleOf(c, n))}${held ? ` (${esc(held)})` : ''}</button>`;
  }
  return html;
}

/** The dealings open with a noble, for the dialog: each with its name, what it costs and does, and why not if it cannot be done. */
export function dealChoices(c: Campaign, key: string): { kind: DealKind; name: string; detail: string; bar: string }[] {
  const n = nobleByKey(c, 0, key);
  if (!n) return [];
  return dealsFor(c, 0, key).map((d) => ({ ...d, name: `${ICON[d.kind]} ${d.name}`, detail: `${dealCost(d.kind)} ${dealEffect(c, 0, n, d.kind)}` }));
}

/** A dealing chosen: `kind` and the noble's key. */
export function dealFromPanel(c: Campaign, kind: string, key: string): string {
  if (!(kind in DEALS)) return 'There is no such dealing.';
  return dealWith(c, 0, key, kind as DealKind);
}
