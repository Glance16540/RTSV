// A town's drift and its decrees on the land's panel: one line saying how the town stands and is moving, and a
// button for each decree. The rules are in src/sim/drift.ts and src/sim/decrees.ts.
import type { Campaign } from '../sim/campaign';
import { DECREES, DECREE_KINDS, decreeBar, decreesAt, strengthAt } from '../sim/decrees';
import { famineYear, grainDeal } from '../sim/grain';
import { townStanding } from '../sim/drift';
import { folkOf } from '../sim/township';
import { isAngry, noblesAt, sayOn, titleOf } from '../sim/nobles';
import { bereftText } from '../sim/widowhood';
import { nobleDealPanel } from './nobledeals';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** The panel's line and buttons for one of the player's towns. */
export function decreePanel(c: Campaign, tid: number): string {
  const f = folkOf(c, tid), d = f.drift, now = decreesAt(c, tid);
  const way = !d ? 'steady' : d.moved > 0.5 ? 'drifting toward the holy way' : d.moved < -0.5 ? `drifting to worse${d.hungry ? ' (hungry)' : ''}${d.raided ? ' (raided)' : ''}` : 'steady';
  const grief = (f.grief ?? 0) > 0 ? ', grieving' : '';
  const gone = f.drifted ? [f.drifted.tavern ? `${f.drifted.tavern} of its women at the tavern` : '', f.drifted.mines ? `${f.drifted.mines} of its men at the mines` : ''].filter(Boolean).join(' and ') : '';
  let html = `<div class="hint">Standing ${Math.round(townStanding(c, tid))}, ${way}${grief}.${gone ? ` Drifted: ${gone}.` : ''}${now.length ? ' Decrees: ' + now.map((x) => `${DECREES[x.kind].name.toLowerCase()} (to turn ${x.until}${x.strength < 1 ? ', by messenger' : ''})`).join('; ') + '.' : ''}</div>`;
  // Its widowed and orphans (src/sim/widowhood.ts).
  const bereft = bereftText(c, tid);
  if (bereft) html += `<div class="hint">Bereaved: ${esc(bereft)}.</div>`;
  // The town's nobles and how they feel (src/sim/nobles.ts); each decree says whom it would please and anger.
  const here = noblesAt(c, tid);
  if (here.length) html += `<div class="hint">Nobles: ${here.map((n) => `${esc(titleOf(c, n))} (${n.leaning}, ${isAngry(n) ? 'angry' : n.mood >= 20 ? 'pleased' : n.mood <= -15 ? 'displeased' : 'content'})`).join('; ')}.</div>`;
  html += nobleDealPanel(c, tid); // the leader's dealings with them (nobledeal.ts)
  const names = (xs: { name: string }[]): string => xs.slice(0, 3).map((n) => n.name).join(', ') + (xs.length > 3 ? ` and ${xs.length - 3} more` : '');
  for (const k of DECREE_KINDS) {
    const bar = decreeBar(c, 0, tid, k), def = DECREES[k], say = sayOn(c, 0, tid, k);
    const heard = `${say.pleased.length ? ` Pleases ${names(say.pleased)}.` : ''}${say.angered.length ? ` Angers ${names(say.angered)}.` : ''}`;
    // Grain bought abroad is paid in gold, not supplies: say what it would bring and cost now (src/sim/grain.ts).
    const deal = k === 'alms' ? grainDeal(c, 0, tid, strengthAt(c, 0, tid)) : null;
    const price = deal ? `${deal.food} food for ${deal.gold} gold${famineYear(c, 0) ? ' (a famine year: dearer)' : ''}` : `${def.cost} supplies, ${def.seasons} season${def.seasons === 1 ? '' : 's'}`;
    html += `<button data-act="decree:${k}" ${bar || c.phase !== 'player' ? 'disabled' : ''} title="${esc(bar || `${def.desc} ${price}.${heard}`)}">📜 ${esc(def.name)}</button>`;
  }
  return html;
}
