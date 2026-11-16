// Order and roads, drawn on a land's panel (docs/DESIGN.md, "Buildings and research that answer the systems"):
// what a town has of the buildings that keep order, and the orders to raise them. The rules are src/sim/watchhouse.ts
// and its fellows. Also where these buildings are given a stand-in to be drawn as, and their place in the build menu.
import type { Campaign } from '../sim/campaign';
import { BUILDINGS } from '../sim/data';
import { priceOf, priceText } from '../sim/prices';
import { WATCH, hasWatchHouse, raiseWatch, watchBar } from '../sim/watchhouse';
import { STANDINS, inBuildMenu } from './standins';

// Until the real models are made: a Watch House is a low tower in pale timber.
STANDINS.watchhouse = { as: 'tower', scale: 0.78, tint: 0xd8c08a };
inBuildMenu('watchhouse', 1);

const esc = (s: string): string => s.replace(/[<>&"]/g, '');

/** What a town has of them, as lines for its panel. */
export function orderHtml(c: Campaign, tid: number): string {
  const d = BUILDINGS.watchhouse;
  return hasWatchHouse(c, tid) ? `<div class="hint order-work" title="${esc(d.desc)}">${d.icon} A ${d.name} keeps the watch here: thieves are caught sooner, and a killer's clues are found faster.</div>` : '';
}
/** The orders the player may give for them in a town of theirs. */
export function orderButtons(c: Campaign, tid: number): string {
  const t = c.territories[tid], d = BUILDINGS.watchhouse;
  if (c.phase !== 'player' || t.owner !== 0 || hasWatchHouse(c, tid)) return '';
  const bar = watchBar(c, 0, tid);
  return `<button data-act="order:watch"${bar ? ` disabled` : ''} title="${esc(bar || `${d.desc} Paid in ${priceText(priceOf('barracks', WATCH.cost))}, from this town first. It takes none of the land's places for works.`)}">${d.icon} Raise a ${d.name} <small>(${WATCH.cost})</small></button>`;
}
/** Do what a button above asks, in the land selected. */
export function orderDo(c: Campaign, tid: number, what: string): void {
  if (what === 'watch') raiseWatch(c, 0, tid);
}
