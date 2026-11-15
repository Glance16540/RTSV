// A town's drift and its decrees on the land's panel: one line saying how the town stands and is moving, and a
// button for each decree. The rules are in src/sim/drift.ts and src/sim/decrees.ts.
import type { Campaign } from '../sim/campaign';
import { DECREES, DECREE_KINDS, decreeBar, decreesAt } from '../sim/decrees';
import { townStanding } from '../sim/drift';
import { folkOf } from '../sim/township';

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** The panel's line and buttons for one of the player's towns. */
export function decreePanel(c: Campaign, tid: number): string {
  const f = folkOf(c, tid), d = f.drift, now = decreesAt(c, tid);
  const way = !d ? 'steady' : d.moved > 0.5 ? 'drifting toward the holy way' : d.moved < -0.5 ? `drifting to worse${d.hungry ? ' (hungry)' : ''}${d.raided ? ' (raided)' : ''}` : 'steady';
  const grief = (f.grief ?? 0) > 0 ? ', grieving' : '';
  const gone = f.drifted ? [f.drifted.tavern ? `${f.drifted.tavern} of its women at the tavern` : '', f.drifted.mines ? `${f.drifted.mines} of its men at the mines` : ''].filter(Boolean).join(' and ') : '';
  let html = `<div class="hint">Standing ${Math.round(townStanding(c, tid))}, ${way}${grief}.${gone ? ` Drifted: ${gone}.` : ''}${now.length ? ' Decrees: ' + now.map((x) => `${DECREES[x.kind].name.toLowerCase()} (to turn ${x.until}${x.strength < 1 ? ', by messenger' : ''})`).join('; ') + '.' : ''}</div>`;
  for (const k of DECREE_KINDS) {
    const bar = decreeBar(c, 0, tid, k), def = DECREES[k];
    html += `<button data-act="decree:${k}" ${bar || c.phase !== 'player' ? 'disabled' : ''} title="${esc(bar || `${def.desc} ${def.cost} supplies, ${def.seasons} season${def.seasons === 1 ? '' : 's'}.`)}">📜 ${esc(def.name)}</button>`;
  }
  return html;
}
