/**
 * Stores replace supplies (docs/DESIGN.md, "Stores"). What a nation has to spend on the map is what its towns
 * hold: food, wood, gold and stone, town by town. Each town keeps a working stock (`KEEP`) that the map does not
 * touch: it is what the town lives on and fights out of. Everything above that, across all its towns, is the
 * nation's to spend, and one supply on the map is a hundred of goods (`SUPPLY`).
 *
 * `Faction.supplies` is kept as that figure, so every price, income and rule that reads or changes a nation's
 * supplies goes on working: `settleStores` carries whatever was spent or earned since it last ran into the
 * towns' stores, and then sets the figure from the towns. So a town sacked, looted or lost takes its share of the
 * nation's wealth with it, what a town gathers or spends in a battle or visit is the nation's gain or loss, and a
 * town run below its working stock has to be made good before there is anything to spend.
 */
import type { Campaign } from './campaign';
import { STORE_KINDS, Stores, folkOf } from './township';

/** One supply, in goods. */
export const SUPPLY: Stores = { food: 40, wood: 30, gold: 15, stone: 15 };
export const SUPPLY_UNITS = 100;
/** A town's working stock, in goods of any kind: what it holds back from the map. (A town is founded with this much.) */
export const KEEP = 600;

const units = (s: Stores): number => STORE_KINDS.reduce((n, k) => n + Math.max(0, s[k]), 0);
const towns = (c: Campaign, f: number) => c.territories.filter((t) => t.owner === f && !t.horde);
const chiefOf = (c: Campaign, f: number) => { const mine = towns(c, f); return mine.find((t) => t.capital === f) ?? mine[0]; };

/** What a town holds above its working stock (below nothing, if it has been run down), in goods. */
export const surplusOf = (c: Campaign, tid: number): number => units(folkOf(c, tid).stores) - KEEP;
/** What a nation has to spend, in supplies: its towns' stores above their working stock, taken together. */
export function nationWorth(c: Campaign, f: number): number {
  return Math.max(0, Math.floor(towns(c, f).reduce((n, t) => n + surplusOf(c, t.id), 0) / SUPPLY_UNITS));
}

/** Put goods into one town's stores, in the proportions of a supply. */
export function stock(c: Campaign, tid: number, goods: number): void {
  const s = folkOf(c, tid).stores, n = Math.max(0, Math.round(goods));
  const food = Math.round((n * SUPPLY.food) / SUPPLY_UNITS), wood = Math.round((n * SUPPLY.wood) / SUPPLY_UNITS), gold = Math.round((n * SUPPLY.gold) / SUPPLY_UNITS);
  s.food += food; s.wood += wood; s.gold += gold; s.stone += n - food - wood - gold;
}
/** Take goods out of one town's stores, of each kind as it has them. Returns what was taken. */
export function draw(c: Campaign, tid: number, goods: number): number {
  const s = folkOf(c, tid).stores, have = units(s), n = Math.min(have, Math.max(0, Math.round(goods)));
  if (!n) return 0;
  let left = n;
  for (const k of STORE_KINDS) { const part = Math.min(s[k], Math.floor((n * Math.max(0, s[k])) / have)); s[k] -= part; left -= part; }
  for (const k of [...STORE_KINDS].sort((a, b) => s[b] - s[a])) { const part = Math.min(s[k], left); s[k] -= part; left -= part; }
  return n - left;
}
/** A nation earns: the goods are shared out among its towns, the odd ones to its chief town. */
export function earn(c: Campaign, f: number, goods: number): void {
  const mine = towns(c, f), n = Math.max(0, Math.round(goods));
  if (!mine.length || !n) return;
  const each = Math.floor(n / mine.length), chief = chiefOf(c, f);
  for (const t of mine) stock(c, t.id, each + (t === chief ? n - each * mine.length : 0));
}
/**
 * A nation spends: the goods come out of what its towns hold above their working stock, each giving in the
 * share it has to give. If that is not enough the working stocks themselves are drawn on. Returns what was found.
 */
export function spend(c: Campaign, f: number, goods: number): number {
  const mine = towns(c, f);
  let left = Math.max(0, Math.round(goods));
  const want = left;
  const over = mine.map((t) => ({ t, s: Math.max(0, surplusOf(c, t.id)) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.t.id - b.t.id);
  const all = over.reduce((n, x) => n + x.s, 0);
  if (all > 0) {
    const share = Math.min(left, all);
    for (const x of over) left -= draw(c, x.t.id, Math.min(x.s, Math.floor((share * x.s) / all)));
    for (const x of over) { if (left <= 0) break; left -= draw(c, x.t.id, Math.min(left, Math.max(0, surplusOf(c, x.t.id)))); }
  }
  for (const t of [...mine].sort((a, b) => units(folkOf(c, b.id).stores) - units(folkOf(c, a.id).stores) || a.id - b.id)) { if (left <= 0) break; left -= draw(c, t.id, left); }
  return want - left;
}

/**
 * Bring a nation's figure and its towns' stores into agreement. Whatever `Faction.supplies` has gained or lost
 * since this last ran (`Faction.stock` is what it left there) is put into, or taken out of, the towns; then the
 * figure is set from the towns. The first time, the nation's supplies are laid down in its towns as goods.
 * Safe to call at any time, any number of times.
 */
export function settleStores(c: Campaign): void {
  for (const x of c.factions) {
    if (!towns(c, x.id).length) { if (x.stock !== undefined) x.supplies = x.stock = 0; continue; } // a people with no town has no stores
    const since = (x.supplies ?? 0) - (x.stock ?? nationWorth(c, x.id));
    if (since > 0) earn(c, x.id, since * SUPPLY_UNITS); else if (since < 0) spend(c, x.id, -since * SUPPLY_UNITS);
    x.supplies = x.stock = nationWorth(c, x.id);
  }
}
/** A nation's stores of each kind, and how much of the whole is its to spend. */
export function treasury(c: Campaign, f: number): { stores: Stores; spare: number; short: number } {
  const stores: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  let over = 0;
  for (const t of towns(c, f)) { for (const k of STORE_KINDS) stores[k] += folkOf(c, t.id).stores[k]; over += surplusOf(c, t.id); }
  return { stores, spare: Math.max(0, over), short: Math.max(0, -over) };
}
