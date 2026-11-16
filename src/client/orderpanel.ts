// Order and roads, drawn on a land's panel (docs/DESIGN.md, "Buildings and research that answer the systems"):
// what a town has of the buildings that keep order. The orders to raise them are the shared ones (townworks.ts); the
// rules are src/sim/watchhouse.ts and its fellows. Also where these buildings are put in the villagers' build menu.
import type { Campaign } from '../sim/campaign';
import { BUILDINGS, BUILD_PAGES } from '../sim/data';
import { begunAt } from '../sim/townworks';
import { hasWatchHouse } from '../sim/watchhouse';

// In a town they are built from the military page, with the towers. (Added here as the game loads, so that the
// shared list in data.ts is not one line every new building must be written into.)
for (const type of ['watchhouse', 'fortress']) if (!BUILD_PAGES.some((p) => p.includes(type))) BUILD_PAGES[1].push(type);

const esc = (s: string): string => s.replace(/[<>&"]/g, '');

/** What a town has of them, as lines for its panel. */
export function orderHtml(c: Campaign, tid: number): string {
  const d = BUILDINGS.watchhouse;
  if (hasWatchHouse(c, tid)) return `<div class="hint order-work" title="${esc(d.desc)}">${d.icon} A ${d.name} keeps the watch here: thieves are caught sooner, and a killer's clues are found faster.</div>`;
  return begunAt(c, tid, 'watchhouse') ? `<div class="hint order-work">${d.icon} A ${d.name} is being raised here. It keeps no watch until it is finished.</div>` : '';
}
