// The leader's dealings with the nobles of a town, on the land's panel: for each noble, a button for each dealing,
// with its cost and why it cannot be done. The rules are in src/sim/nobledeal.ts.
import type { Campaign } from '../sim/campaign';
import { DEALS, dealCost, dealWith, dealsFor } from '../sim/nobledeal';
import type { DealKind } from '../sim/nobledeal';
import { noblesAt, titleOf } from '../sim/nobles';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
const ICON: Record<DealKind, string> = { summon: '🏰', gift: '🎁', post: '🎖️', wed: '💍', strip: '⚔️' };

/** The dealings with the town's nobles, for one of the player's towns. */
export function nobleDealPanel(c: Campaign, tid: number): string {
  const here = noblesAt(c, tid).filter((n) => n.rank !== 'close' && c.territories[tid]?.owner === 0);
  let html = '';
  for (const n of here) {
    const deals = dealsFor(c, 0, n.key);
    if (!deals.length) continue;
    const held = [n.title, n.wed ? `wed to ${n.wed} of your house` : ''].filter(Boolean).join(', ');
    html += `<div class="hint">Deal with ${esc(titleOf(c, n))}${held ? ` (${esc(held)})` : ''}:</div>`;
    for (const d of deals) html += `<button data-act="noble:${d.kind}|${encodeURIComponent(n.key)}" ${d.bar || c.phase !== 'player' ? 'disabled' : ''} title="${esc(d.bar || `${d.name}. ${dealCost(d.kind)}`)}">${ICON[d.kind]} ${esc(d.name)}</button>`;
  }
  return html;
}

/** A dealing chosen on the panel: `id` is "kind|key". */
export function dealFromPanel(c: Campaign, id: string): string {
  const [kind, key] = id.split('|');
  if (!(kind in DEALS)) return 'There is no such dealing.';
  return dealWith(c, 0, decodeURIComponent(key ?? ''), kind as DealKind);
}
