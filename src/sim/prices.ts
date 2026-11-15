// Prices by kind (docs/DESIGN.md, "Stores"). A thing bought on the map is paid in the stores it is made of, not
// in plain supplies: a Barracks in wood, a Fortress in stone, a company in food and gold, a truce or a gift in
// gold. Its price in supplies stays what it was (a supply is a hundred of goods, stores.ts), so nothing grows dearer
// or cheaper; what changes is which stores it takes, and from where.
//
// Where it comes from. A building, a company or a work is paid for out of the town where it is done first, then
// out of the nation's other towns, those with most of that kind first; a dealing (a truce, an alliance, a gift, a
// tribute), a leader hired or a new age out of the chief town first. A nation can buy a thing when it has the
// supplies to spend (stores.ts: its towns' stores above their working stock).
//
// Short of a kind. What a nation's towns do not hold of the kind a thing is made of is made up in their other
// goods, SHORT_RATE of them for every one short (1: at par, so a price in supplies is never more than it was).
// Decided here: held strictly to its kinds, a new nation could not raise its first Range (500 wood against the
// 440 its chief town holds), so the kinds say what is taken first, not what must be had.
import type { Campaign } from './campaign';
import { STORE_KINDS, folkOf } from './township';
import type { Stores } from './township';
import { KEEP, SUPPLY_UNITS, settleStores } from './stores';

export type StoreKind = keyof Stores;
/** Goods of other kinds taken for every one a nation is short of the kind a thing is made of. */
export const SHORT_RATE = 1;
/** What each kind of thing is made of, share by share. */
export const MADE_OF: Record<string, Partial<Stores>> = {
  farm: { wood: 1 },
  barracks: { wood: 1 },
  range: { wood: 1 },
  stable: { wood: 0.7, gold: 0.3 },
  harbour: { wood: 1 },
  church: { stone: 0.6, gold: 0.4 },
  tavern: { wood: 0.6, gold: 0.4 },
  fortress: { stone: 1 },
  bridge: { wood: 0.6, stone: 0.4 },
  pass: { stone: 1 },
  company: { food: 0.3, gold: 0.5, wood: 0.2 },
  cavalry: { food: 0.3, gold: 0.5, wood: 0.2 },
  hero: { gold: 1 },
  age: { food: 0.25, wood: 0.25, gold: 0.25, stone: 0.25 },
  dealing: { gold: 1 },
};

/** The price of a thing that costs `n` supplies, in goods of the kinds it is made of. */
export function priceOf(what: string, n: number): Stores {
  const mix = MADE_OF[what] ?? MADE_OF.dealing, sum = STORE_KINDS.reduce((s, k) => s + (mix[k] ?? 0), 0) || 1;
  const goods = Math.max(0, Math.round(n * SUPPLY_UNITS)), out: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  let left = goods;
  for (const k of STORE_KINDS) { const part = Math.floor((goods * (mix[k] ?? 0)) / sum); out[k] = part; left -= part; }
  const main = STORE_KINDS.reduce((a, b) => ((mix[b] ?? 0) > (mix[a] ?? 0) ? b : a));
  out[main] += left;
  return out;
}
/** A price in words: "300 wood, 200 stone". */
export const priceText = (p: Stores): string => STORE_KINDS.filter((k) => p[k]).map((k) => `${p[k]} ${k}`).join(', ');

const mine = (c: Campaign, f: number) => c.territories.filter((t) => t.owner === f && !t.horde);
/** The chief town of a people: its capital, else its first town. */
const chiefOf = (c: Campaign, f: number): number => { const m = mine(c, f); return (m.find((t) => t.capital === f) ?? m[0])?.id ?? -1; };

/** What a price comes to in goods for this people, with what it is short of each kind made up at SHORT_RATE. */
export function outlay(c: Campaign, f: number, p: Stores): number {
  const have: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const t of mine(c, f)) for (const k of STORE_KINDS) have[k] += folkOf(c, t.id).stores[k];
  return STORE_KINDS.reduce((n, k) => n + Math.min(have[k], p[k]) + Math.max(0, p[k] - have[k]) * SHORT_RATE, 0);
}
/** Can this people pay `n` supplies for this, in its kinds? */
export function canPayFor(c: Campaign, f: number, what: string, n: number): boolean {
  if (n <= 0) return true;
  const x = c.factions[f];
  if (!x || (x.supplies ?? 0) < n) return false;
  return SHORT_RATE <= 1 || (x.supplies ?? 0) * SUPPLY_UNITS >= outlay(c, f, priceOf(what, n));
}

/**
 * Pay `n` supplies for this, in its kinds: from the town `at` first (else the chief town), then from the towns with
 * most of each kind. Nothing is taken unless all of it can be. The nation's figure is set from its towns after.
 */
export function payFor(c: Campaign, f: number, what: string, n: number, opts: { at?: number } = {}): boolean {
  if (n <= 0) return true;
  settleStores(c); // anything spent or earned since is in the towns first
  if (!canPayFor(c, f, what, n)) return false;
  const p = priceOf(what, n), first = opts.at !== undefined && c.territories[opts.at]?.owner === f ? opts.at : chiefOf(c, f);
  const order = (k: StoreKind) => [first, ...mine(c, f).map((t) => t.id).filter((id) => id !== first).sort((a, b) => folkOf(c, b).stores[k] - folkOf(c, a).stores[k] || a - b)].filter((id) => id >= 0);
  let short = 0;
  for (const k of STORE_KINDS) {
    let want = p[k];
    for (const tid of order(k)) { if (want <= 0) break; const s = folkOf(c, tid).stores, take = Math.min(s[k], want); s[k] -= take; want -= take; }
    short += want;
  }
  // What none of its towns had of those kinds, in their other goods: the most plentiful first.
  let left = Math.ceil(short * SHORT_RATE);
  while (left > 0) {
    let best = -1, kind: StoreKind = 'food';
    for (const tid of order('food')) for (const k of STORE_KINDS) if (best < 0 || folkOf(c, tid).stores[k] > folkOf(c, best).stores[kind]) { best = tid; kind = k; }
    const s = best >= 0 ? folkOf(c, best).stores : undefined;
    if (!s || s[kind] <= 0) break;
    const take = Math.min(s[kind], left);
    s[kind] -= take; left -= take;
  }
  settleStores(c); // the figure, from the towns as they now are
  return true;
}

/**
 * For trials and scenarios: make a people's figure exactly `n` supplies, every one of its towns at its working stock
 * of a quarter of each kind, and the `n` supplies laid down in its chief town in the kinds `what` is made of.
 */
export function fundFor(c: Campaign, f: number, what: string, n: number): void {
  settleStores(c);
  const each = Math.floor(KEEP / 4);
  for (const t of mine(c, f)) folkOf(c, t.id).stores = { food: KEEP - 3 * each, wood: each, gold: each, stone: each };
  const chief = chiefOf(c, f), p = priceOf(what, Math.max(0, n));
  if (chief >= 0) for (const k of STORE_KINDS) folkOf(c, chief).stores[k] += p[k];
  settleStores(c);
}
