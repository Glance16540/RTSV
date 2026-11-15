// Sending convoys from a town on the map (src/sim/convoys.ts): where to, and three loads to choose from.
import type { Campaign } from '../sim/campaign';
import { CONVOYS, Send, cannotSend, onTheRoad, roadBetween, sendConvoy } from '../sim/convoys';

/** The loads a player can send. */
export const LOADS: Record<string, { label: string; what: Send; tip: string }> = {
  food: { label: '🌾 Food', what: { food: 200 }, tip: '200 food.' },
  goods: { label: '📦 Goods', what: { wood: 100, gold: 100, stone: 100 }, tip: '100 wood, 100 gold and 100 stone.' },
  folk: { label: '👫 A couple', what: { men: 1, women: 1 }, tip: 'A man and a woman, the youngest the town can spare, to make a home there.' },
};

/** The convoy part of a town's panel: nothing if the town has no road to another town of yours. */
export function convoyHtml(c: Campaign, tid: number): string {
  const to = c.territories.filter((t) => t.owner === 0 && t.id !== tid && roadBetween(c, 0, tid, t.id));
  if (!to.length) return '';
  const going = onTheRoad(c, 0).filter((x) => x.from === tid || x.to === tid);
  const first = to[0].id;
  return `<div class="ow-convoy"><div class="hint">🐂 Send by road, a season on the way${going.length ? ` (${going.length} on the road to or from here)` : ''}. Highwaymen rob convoys they catch unescorted: ${Math.round(CONVOYS.rob * 100)}% of the goods, never the people.</div>
    <select id="ow-convoy-to">${to.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}</select>
    ${Object.entries(LOADS).map(([k, l]) => { const why = cannotSend(c, 0, tid, first, l.what); return `<button data-act="convoy:${k}" title="${l.tip}${why ? ' ' + why : ''}" ${c.phase === 'player' && !why ? '' : 'disabled'}>${l.label}</button>`; }).join('')}</div>`;
}

/** The player sends a load from the town shown to the town chosen. */
export function sendFromPanel(c: Campaign, tid: number, load: string): boolean {
  const pick = document.getElementById('ow-convoy-to') as HTMLSelectElement | null, l = LOADS[load];
  if (!pick || !l) return false;
  return !!sendConvoy(c, 0, tid, Number(pick.value), l.what);
}
