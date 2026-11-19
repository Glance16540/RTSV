// Prices by kind (docs/DESIGN.md, "Stores"). A thing bought on the map is paid in the stores it is made of, not
// in plain supplies: a Barracks in wood, a Fortress in stone, a company in food and gold, a truce or a gift in
// gold. Its price in supplies stays what it was (a supply is a hundred of goods, stores.ts), so nothing grows dearer
// or cheaper; what changes is which stores it takes, and from where.
//
// Where it comes from. A building, a company or a work is paid for out of the town where it is done; a dealing (a
// truce, an alliance, a gift, a tribute), a leader hired or a new age out of the chief town. What that town lacks of a
// kind, the nation's other towns send it by road (convoys.ts roadBetween: through the people's own lands, or over a sea
// lane from a Harbour), at a cost: CARRY.cost of what is sent (a tenth) is spent on the way (the carters' keep, the wagons' wear).
// For a thing built or done at a town (payFor's `act`) it goes as convoys, a season on the road, and the thing waits for
// them (sentfor.ts); a company, and a dealing, done at no town, are still paid at once (the owner's word, DESIGN ae5db6f).
// A town with no road to it sends nothing. A town that sends keeps a floor of its own (plenty.ts PLENTY.floor in goods
// other than bread, and two seasons of its own eating in food), so that its governor is not left unable to raise its own
// Farmland and its people are not left without bread.
//
// Short of a kind. What the paying town and the towns with a road to it lack of the kind a thing is made of is made up in
// their other goods, traded at a loss: SHORT_RATE of them for every one short. (Held strictly to its kinds, a new nation
// could not raise its first Range, 500 wood against the 440 its chief town holds, nor pay a truce in gold it has not dug.)
// What cannot be found or carried even so is not bought now (the owner's design: "or the work waits a season"): the
// governor and the computer's peoples ask again each season, and the player is told why (`payBar`). Decrees are paid from
// the nation's supplies (stores.ts) and are not held up by this.
import type { Campaign } from './campaign';
import { STORE_KINDS, folkOf } from './township';
import type { Stores } from './township';
import { KEEP, SUPPLY_UNITS, settleStores } from './stores';
import { roadBetween } from './convoys';
import { PLENTY } from './plenty';
import { needOf } from './larder';
import { sendFor, waitingFor } from './sentfor';
import type { Act, Sending } from './sentfor';

export type StoreKind = keyof Stores;
/**
 * Goods sent by road to pay for a thing: the share of what is sent that is spent on the way. At a fifth, and other goods
 * traded at 1.25 for one, the computer's peoples raised fewer companies and walls where the work was done, and campaigns
 * ruined or undecided went out of band (384 campaigns: 2.6% and 10.4%, from 0.8% and 4.4%; rivals' wins 111 to 82).
 */
export const CARRY = { cost: 0.1 };
/** Goods of other kinds taken for every one short of the kind a thing is made of: traded, at a loss. */
export const SHORT_RATE = 1.1;
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

/** One draw on a town's stores to pay for a thing: so much of a kind, and whether it came by road. */
interface Draw { tid: number; kind: StoreKind; take: number; carried: boolean; /** What comes in of it, for one carried (the rest is the road's cost). */ arrive?: number }

/** What a town can send of a kind to pay for a thing elsewhere: what it holds beyond its own floor. */
function spareOf(c: Campaign, tid: number, k: StoreKind, given: Stores): number {
  const s = folkOf(c, tid).stores;
  if (k === 'food') return Math.max(0, s.food - given.food - 2 * needOf(c, tid));
  const others = STORE_KINDS.filter((x) => x !== 'food').reduce((n, x) => n + Math.max(0, s[x] - given[x]), 0);
  return Math.max(0, Math.min(s[k] - given[k], others - PLENTY.floor));
}

/**
 * How a price would be paid, town by town, or why it cannot be. The town `at` (else the chief town) first; then the
 * nation's other towns with a road to it, those with most of the kind first, each sending what it can spare and
 * CARRY.cost more besides for the road.
 */
function planFor(c: Campaign, f: number, p: Stores, at?: number): { draws: Draw[] } | { bar: string } {
  const first = at !== undefined && c.territories[at]?.owner === f ? at : chiefOf(c, f);
  if (first < 0) return { bar: 'You have no town to pay from.' };
  const draws: Draw[] = [], given: Record<number, Stores> = {}, short: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  const gave = (tid: number): Stores => (given[tid] ??= { food: 0, wood: 0, gold: 0, stone: 0 });
  const roads = new Map<number, boolean>();
  const reach = (tid: number): boolean => { if (!roads.has(tid)) roads.set(tid, !!roadBetween(c, f, tid, first)); return roads.get(tid)!; };
  for (const k of STORE_KINDS) {
    let want = p[k];
    if (want <= 0) continue;
    const own = Math.min(Math.max(0, folkOf(c, first).stores[k]), want);
    if (own > 0) { draws.push({ tid: first, kind: k, take: own, carried: false }); gave(first)[k] += own; want -= own; }
    const senders = mine(c, f).map((t) => t.id).filter((id) => id !== first).sort((a, b) => folkOf(c, b).stores[k] - folkOf(c, a).stores[k] || a - b);
    for (const tid of senders) {
      if (want <= 0) break;
      const spare = spareOf(c, tid, k, gave(tid));
      if (spare <= 0 || !reach(tid)) continue;
      const arrive = Math.min(want, Math.floor(spare / (1 + CARRY.cost))), take = Math.ceil(arrive * (1 + CARRY.cost));
      if (arrive <= 0) continue;
      draws.push({ tid, kind: k, take, carried: true, arrive }); gave(tid)[k] += take; want -= arrive;
    }
    short[k] = want;
  }
  // What none of them had of its kinds, in their other goods, traded at SHORT_RATE: the paying town's first, then what the
  // towns with a road to it can spare, the most plentiful kind first.
  let left = Math.ceil(STORE_KINDS.reduce((n, k) => n + short[k], 0) * SHORT_RATE);
  const ownLeft = (k: StoreKind): number => Math.max(0, folkOf(c, first).stores[k] - gave(first)[k]);
  for (const k of [...STORE_KINDS].sort((a, b) => ownLeft(b) - ownLeft(a))) {
    if (left <= 0) break;
    const take = Math.min(ownLeft(k), left);
    if (take > 0) { draws.push({ tid: first, kind: k, take, carried: false }); gave(first)[k] += take; left -= take; }
  }
  for (const tid of mine(c, f).map((t) => t.id).filter((id) => id !== first && reach(id))) {
    for (const k of [...STORE_KINDS].sort((a, b) => spareOf(c, tid, b, gave(tid)) - spareOf(c, tid, a, gave(tid)))) {
      if (left <= 0) break;
      const arrive = Math.min(left, Math.floor(spareOf(c, tid, k, gave(tid)) / (1 + CARRY.cost)));
      if (arrive <= 0) continue;
      const take = Math.ceil(arrive * (1 + CARRY.cost));
      draws.push({ tid, kind: k, take, carried: true, arrive }); gave(tid)[k] += take; left -= arrive;
    }
  }
  if (left > 0) {
    const k = STORE_KINDS.reduce((a, b) => (short[b] > short[a] ? b : a)), name = c.territories[first]?.name ?? 'the town';
    return { bar: `${name} lacks ${short[k]} ${k}, and neither it nor your towns with a road to it have the goods to make it up: it must wait.` };
  }
  return { draws };
}

/** Why this people cannot pay `n` supplies for this now, or '' if it can. `at`: the town where it is done. */
export function payBar(c: Campaign, f: number, what: string, n: number, opts: { at?: number } = {}): string {
  if (n <= 0) return '';
  const x = c.factions[f];
  if (!x || (x.supplies ?? 0) < n) return `It costs ${n} supplies.`;
  const at = payingTown(c, f, opts.at);
  if (at >= 0 && waitingFor(c, f, at, what)) return `The goods for it are on the road to ${c.territories[at].name}: it waits for them.`;
  const plan = planFor(c, f, priceOf(what, n), opts.at);
  return 'bar' in plan ? plan.bar : '';
}
/** The town a thing is paid for out of: `at` if it is this people's, else its chief town. */
const payingTown = (c: Campaign, f: number, at?: number): number => (at !== undefined && c.territories[at]?.owner === f ? at : chiefOf(c, f));
/** Can the town pay for this out of its own stores alone, with nothing to be sent for? */
export function paysHere(c: Campaign, f: number, what: string, n: number, opts: { at?: number } = {}): boolean {
  if (n <= 0) return true;
  settleStores(c);
  if ((c.factions[f]?.supplies ?? 0) < n) return false;
  const plan = planFor(c, f, priceOf(what, n), opts.at);
  return !('bar' in plan) && !plan.draws.some((d) => d.carried);
}
/** Can this people pay `n` supplies for this, in its kinds, from the town `at` and what its other towns can send by road? */
export function canPayFor(c: Campaign, f: number, what: string, n: number, opts: { at?: number } = {}): boolean {
  return payBar(c, f, what, n, opts) === '';
}

/**
 * Pay `n` supplies for this, in its kinds: from the town `at` first (else the chief town), the rest sent by road from
 * the nation's other towns at CARRY.cost. Nothing is taken unless all of it can be. The nation's figure is set from its
 * towns after.
 */
export function payFor(c: Campaign, f: number, what: string, n: number, opts: { at?: number; /** A thing done at a town: what the town lacks is sent for by road, and the thing waits for it (sentfor.ts); without it, as for a dealing, all is paid at once. */ act?: Act } = {}): boolean {
  if (n <= 0) return true;
  settleStores(c); // anything spent or earned since is in the towns first
  if ((c.factions[f]?.supplies ?? 0) < n) return false;
  const plan = planFor(c, f, priceOf(what, n), opts.at);
  if ('bar' in plan) return false;
  const carried = plan.draws.filter((d) => d.carried);
  if (opts.act && carried.length) {
    // What the town lacks goes by road as convoys, a season on the way; the thing waits for it, and nothing is paid yet.
    const at = payingTown(c, f, opts.at);
    if (waitingFor(c, f, at, what)) return false;
    const by = new Map<number, Sending>();
    for (const d of carried) {
      const s = by.get(d.tid) ?? { from: d.tid, take: { food: 0, wood: 0, gold: 0, stone: 0 }, arrive: { food: 0, wood: 0, gold: 0, stone: 0 } };
      s.take[d.kind] += d.take; s.arrive[d.kind] += d.arrive ?? d.take;
      by.set(d.tid, s);
    }
    const own: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
    for (const d of plan.draws) if (!d.carried) own[d.kind] += d.take;
    sendFor(c, f, at, what, n, opts.act, [...by.values()], own); // the town's own share is set aside while it waits
    settleStores(c);
    return false;
  }
  for (const d of plan.draws) folkOf(c, d.tid).stores[d.kind] -= d.take;
  settleStores(c); // the figure, from the towns as they now are
  return true;
}

/**
 * For trials and scenarios: make a people's figure exactly `n` supplies, every one of its towns at its working stock
 * of a quarter of each kind, and the `n` supplies laid down in its chief town (or the town `at`, where the thing is to be
 * done) in the kinds `what` is made of.
 */
export function fundFor(c: Campaign, f: number, what: string, n: number, opts: { at?: number } = {}): void {
  settleStores(c);
  const each = Math.floor(KEEP / 4);
  for (const t of mine(c, f)) folkOf(c, t.id).stores = { food: KEEP - 3 * each, wood: each, gold: each, stone: each };
  const chief = opts.at !== undefined && c.territories[opts.at]?.owner === f ? opts.at : chiefOf(c, f), p = priceOf(what, Math.max(0, n));
  if (chief >= 0) for (const k of STORE_KINDS) folkOf(c, chief).stores[k] += p[k];
  settleStores(c);
}
