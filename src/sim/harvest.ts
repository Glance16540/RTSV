// Income credited to the land that yields it (docs/DESIGN.md, "Stores"). When the season turns, each land's
// yield goes into its own town's stores, in the kinds the land gives: food from farmland and from fertile or
// coastal land, gold from gold hills, stone from hills, wood from forest, and something of everything everywhere.
// What a people earns as a whole and not from any one land (a fair it holds, the Persians' tribute) goes into its
// chief town, and so does the yield of a land the marauders still sit in. A store is full at MAX_STORE, and what will not fit is lost. The nation's figure is then set from its
// towns (stores.ts).
import type { Campaign, Territory } from './campaign';
import { biomeOf } from './campaign';
import { MAX_STORE, STORE_KINDS, folkOf } from './township';
import type { Stores } from './township';
import { SUPPLY_UNITS, settleStores } from './stores';

/** What a land yields, share by share, before its own works and country are counted. */
export const MIX: Stores = { food: 0.4, wood: 0.3, gold: 0.15, stone: 0.15 };

/** The shares of what a land yields: its works and its country lean it toward one store or another. */
export function yieldShares(c: Campaign, tid: number): Stores {
  const t = c.territories[tid], s = { ...MIX };
  if (t.buildings.includes('farm')) s.food += 0.4;
  if (t.trait === 'fertile') s.food += 0.2;
  if (t.trait === 'coast') s.food += 0.1;
  if (t.trait === 'gold') s.gold += 0.5;
  if (t.trait === 'hills') s.stone += 0.3;
  const ground = biomeOf(c, tid);
  if (ground === 'forest') s.wood += 0.3;
  if (ground === 'snow' || ground === 'desert') s.stone += 0.1;
  return s;
}

/** So many goods split by shares, in whole numbers that add up to it. */
export function spread(goods: number, shares: Stores): Stores {
  const total = Math.max(0, Math.round(goods)), sum = STORE_KINDS.reduce((n, k) => n + shares[k], 0) || 1, out: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  let left = total;
  for (const k of STORE_KINDS) { const n = Math.floor((total * shares[k]) / sum); out[k] = n; left -= n; }
  out.food += left;
  return out;
}

/** Put goods into a town as far as it has room. Returns what did not fit. */
export function putIn(c: Campaign, tid: number, goods: Stores): number {
  const s = folkOf(c, tid).stores;
  let over = 0;
  for (const k of STORE_KINDS) { const room = Math.max(0, MAX_STORE - s[k]), n = Math.max(0, Math.round(goods[k])); s[k] += Math.min(room, n); over += Math.max(0, n - room); }
  return over;
}

/** What one season's yield came to, people by people: goods into towns, and goods lost to full stores. */
export interface Harvest { [people: number]: { goods: number; lost: number } }

/**
 * The season's yield. `landYield(f, t)`: the supplies a land yields its holder (campaign.ts's measure); `whole(f)`:
 * what a people earns besides; `times(f)`: a people's multiplier (the rivals' handicap).
 */
export function harvest(c: Campaign, landYield: (f: number, t: Territory) => number, whole: (f: number) => number, times: (f: number) => number = () => 1): Harvest {
  settleStores(c); // anything spent or earned before is in the towns first
  const out: Harvest = {};
  for (const x of c.factions) {
    if (!x.alive) continue;
    const k = times(x.id), held = c.territories.filter((t) => t.owner === x.id), lands = held.filter((t) => !t.horde);
    if (!lands.length) continue;
    const chief = lands.find((t) => t.capital === x.id) ?? lands[0];
    let goods = 0, lost = 0;
    // A land the marauders still sit in has no town of its people's to keep its yield: that goes to the chief town.
    for (const t of held) { const n = Math.round(landYield(x.id, t) * k * SUPPLY_UNITS), into = t.horde ? chief : t; goods += n; lost += putIn(c, into.id, spread(n, yieldShares(c, t.id))); }
    const extra = Math.round(whole(x.id) * k * SUPPLY_UNITS);
    goods += extra; lost += putIn(c, chief.id, spread(extra, yieldShares(c, chief.id)));
    out[x.id] = { goods, lost };
  }
  settleStores(c); // the figure, from the towns as they now are
  return out;
}
