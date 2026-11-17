// Sending convoys from a town on the map (src/sim/convoys.ts): where to, and the loads to choose from, settlers among them
// (src/sim/migration.ts).
import type { Campaign } from '../sim/campaign';
import { CONVOYS, Convoy, Send, cannotSend, onTheRoad, roadBetween, seaLegs, sendConvoy } from '../sim/convoys';
import { freeLands, seasonsTo, settle, settleBar } from '../sim/migration';

/** The loads a player can send. */
export const LOADS: Record<string, { label: string; what: Send; tip: string }> = {
  food: { label: '🌾 Food', what: { food: 200 }, tip: '200 food.' },
  goods: { label: '📦 Goods', what: { wood: 100, gold: 100, stone: 100 }, tip: '100 wood, 100 gold and 100 stone.' },
  folk: { label: '👫 A couple', what: { men: 1, women: 1 }, tip: 'A man and a woman, the youngest the town can spare, to make a home there.' },
  settle: { label: '🏡 Settlers', what: { men: 2, women: 2 }, tip: 'Two families and their children, to a town of yours with room; or, with food and timber, to found a new town on an empty land near your own, a season on the way for each land beyond your own. They are not one of your convoys.' },
};

/** One convoy on its way, as a line: where it is bound, by road or by sea, and what it carries. */
function goingLine(c: Campaign, x: Convoy, tid: number): string {
  const sea = seaLegs(c, x.road).length > 0, other = c.territories[x.from === tid ? x.to : x.from]?.name ?? '';
  const k = x.cargo, load = [k.food && `${k.food} food`, k.wood && `${k.wood} wood`, k.gold && `${k.gold} gold`, k.stone && `${k.stone} stone`, k.men.length + k.women.length && `${k.men.length + k.women.length} ${k.men.length + k.women.length === 1 ? 'person' : 'people'}`].filter(Boolean).join(', ');
  return `<div class="hint ow-convoy-going">${sea ? '⛵' : '🐂'} ${x.from === tid ? `To ${other}` : `From ${other}`}${sea ? ' by sea' : ' by road'}: ${load || 'nothing'}, in as the season turns.</div>`;
}

/** The convoy part of a town's panel: nothing if the town has no road to another town of yours. */
export function convoyHtml(c: Campaign, tid: number): string {
  const to = c.territories.filter((t) => t.owner === 0 && t.id !== tid && roadBetween(c, 0, tid, t.id));
  const free = freeLands(c, 0);
  if (!to.length && !free.length) return '';
  const going = onTheRoad(c, 0).filter((x) => x.from === tid || x.to === tid);
  const first = to[0]?.id ?? free[0];
  return `<div class="ow-convoy">${going.map((x) => goingLine(c, x, tid)).join('')}<div class="hint">🐂 Send by road, or over a sea lane from a Harbour, a season on the way. Highwaymen on the road and pirates at sea rob convoys they catch unescorted: ${Math.round(CONVOYS.rob * 100)}% of the goods, never the people.</div>
    <select id="ow-convoy-to">${to.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}${free.map((id) => `<option value="${id}">${c.territories[id].name} (empty land: Settlers only, ${seasonsTo(c, 0, id) > 1 ? `${seasonsTo(c, 0, id)} seasons away` : 'a season away'})</option>`).join('')}</select>
    ${Object.entries(LOADS).map(([k, l]) => { const why = k === 'settle' ? settleBar(c, 0, tid, first) : cannotSend(c, 0, tid, first, l.what); return `<button data-act="convoy:${k}" title="${l.tip}${why ? ' ' + why : ''}" ${c.phase === 'player' && !why ? '' : 'disabled'}>${l.label}</button>`; }).join('')}</div>`;
}

/** The player sends a load from the town shown to the town chosen. */
export function sendFromPanel(c: Campaign, tid: number, load: string): boolean {
  const pick = document.getElementById('ow-convoy-to') as HTMLSelectElement | null, l = LOADS[load];
  if (!pick || !l) return false;
  if (load === 'settle') return settle(c, 0, tid, Number(pick.value)) === '';
  return !!sendConvoy(c, 0, tid, Number(pick.value), l.what);
}
