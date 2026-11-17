// Order and roads, drawn on a land's panel (docs/DESIGN.md, "Buildings and research that answer the systems"):
// what a town has of the buildings that keep order. The orders to raise them are the shared ones (townworks.ts); the
// rules are src/sim/watchhouse.ts and its fellows. Also where these buildings are put in the villagers' build menu.
import type { Campaign } from '../sim/campaign';
import { BUILDINGS, BUILD_PAGES } from '../sim/data';
import { begunAt } from '../sim/townworks';
import { hasWatchHouse } from '../sim/watchhouse';
import { grudge, grudgeWatch, grudgeWork, oldCount } from '../sim/oldpeople';
import { folkOf, grown } from '../sim/township';

// In a town they are built from the military page, with the towers. (Added here as the game loads, so that the
// shared list in data.ts is not one line every new building must be written into.)
for (const type of ['watchhouse', 'fortress', 'inn']) if (!BUILD_PAGES.some((p) => p.includes(type))) BUILD_PAGES[1].push(type);

const esc = (s: string): string => s.replace(/[<>&"]/g, '');

/** A taken town: how many of its grown people are still of the people it was taken from, and what their grudge costs (oldpeople.ts). */
function oldHtml(c: Campaign, tid: number): string {
  const t = c.territories[tid], n = oldCount(c, tid);
  if (!n || !t.old) return '';
  const whose = t.old.of < 0 ? 'the local tribes' : t.old.of === 0 ? 'your own people' : `the ${c.factions[t.old.of]?.name ?? 'people it was taken from'}`;
  const all = grown(folkOf(c, tid)), g = grudge(c, tid);
  const cost = g > 0.02 ? ` While the town resents its holder they work and watch grudgingly: ${Math.round((1 - grudgeWork(c, tid)) * 100)}% less of its harvest, and its men count for ${Math.round((1 - grudgeWatch(c, tid)) * 100)}% less against a band.` : ' They bear no grudge now.';
  return `<div class="hint order-work" title="They join its holder over the years, by marriage, by their children growing up, and by settling; sooner as the town's resentment eases.">🏴 ${n} of its ${all} grown people are still of ${esc(whose)}.${cost}</div>`;
}

/** What a town has of them, as lines for its panel. */
export function orderHtml(c: Campaign, tid: number): string {
  return watchHtml(c, tid) + oldHtml(c, tid);
}
function watchHtml(c: Campaign, tid: number): string {
  const d = BUILDINGS.watchhouse;
  if (hasWatchHouse(c, tid)) return `<div class="hint order-work" title="${esc(d.desc)}">${d.icon} A ${d.name} keeps the watch here: thieves are caught sooner, and a killer's clues are found faster.</div>`;
  return begunAt(c, tid, 'watchhouse') ? `<div class="hint order-work">${d.icon} A ${d.name} is being raised here. It keeps no watch until it is finished.</div>` : '';
}
