// A rival's foresight with its stores (the board's Stores row: "the computer sends only food by convoy" and "rivals do
// not plan which town to spend from or move goods ahead of a purchase"). Since a thing built or done at a town waits a
// season for goods its town lacks (sentfor.ts), a rival that buys without thinking ahead loses a season each time. So:
//   - ahead: a season before it will enter its next age (the stores for it, and its time in this age, rivalrule.ts) or
//     open the border it has chosen (country.ts rivalWay), it sends what the paying town lacks of the price there by
//     convoy, from its towns with the most of each kind to spare; the convoys come in as the season turns, and the thing
//     is paid for at once when its time comes. What is already on the road there for it is counted. Only a season ahead,
//     never the season it buys: then the purchase sends for the goods itself.
//   - where: a rival raising a house of its faith (a church, a tavern) or a harbour where it may choose the town raises it
//     where the town can pay out of its own stores, else where the town holds most of what it is made of.
// Its convoys are the people's own, counted against CONVOYS.most, and met on the road as any are. The player plans their
// own convoys. Plain rules over the game's own; it keeps a mark on the convoys it sends, and nothing else.
import type { Campaign } from './campaign';
import { CONVOYS, sendConvoy } from './convoys';
import { RIVAL, mayAdvance } from './rivalrule';
import { rivalWay } from './country';
import { paysHere, priceOf, spareToSend } from './prices';
import type { StoreKind } from './prices';
import { STORE_KINDS, folkOf } from './township';
import type { Stores } from './township';

declare module './convoys' {
  interface Convoy {
    /** Goods sent ahead by a rival for a thing it will buy at the town it is bound for (rivalstock.ts): what the thing is. */
    ahead?: string;
  }
}

export const RIVAL_STOCK = {
  /** The least worth sending of a kind: less is left to the purchase to send for. */
  least: 20,
};

const chiefOf = (c: Campaign, f: number): number => { const own = c.territories.filter((t) => t.owner === f && !t.horde); return (own.find((t) => t.capital === f) ?? own[0])?.id ?? -1; };

/** Goods of this people already on the road ahead to a town for a thing. */
export function aheadTo(c: Campaign, f: number, at: number, what: string): Stores {
  const out: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const x of c.convoys ?? []) if (x.owner === f && x.to === at && x.ahead === what) for (const k of STORE_KINDS) out[k] += x.cargo[k];
  return out;
}

/**
 * Send ahead to `at` what it lacks of the price of `n` supplies of `what`, from the people's towns with most of each kind to
 * spare, as convoys marked for it. Returns how many convoys set out.
 */
export function sendAhead(c: Campaign, f: number, at: number, what: string, n: number): number {
  if (at < 0 || c.territories[at]?.owner !== f) return 0;
  const p = priceOf(what, n), have = folkOf(c, at).stores, coming = aheadTo(c, f, at, what);
  const lack: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const k of STORE_KINDS) lack[k] = Math.max(0, p[k] - Math.max(0, have[k]) - coming[k]);
  if (!STORE_KINDS.some((k) => lack[k] >= RIVAL_STOCK.least)) return 0;
  const loads = new Map<number, Partial<Stores>>();
  const towns = c.territories.filter((t) => t.owner === f && !t.horde && t.id !== at).map((t) => t.id);
  for (const k of STORE_KINDS as readonly StoreKind[]) {
    let want = lack[k];
    if (want < RIVAL_STOCK.least) continue;
    for (const tid of [...towns].sort((a, b) => spareToSend(c, b, k) - spareToSend(c, a, k) || a - b)) {
      if (want <= 0) break;
      const give = Math.min(want, spareToSend(c, tid, k) - (loads.get(tid)?.[k] ?? 0));
      if (give < RIVAL_STOCK.least) continue;
      loads.set(tid, { ...(loads.get(tid) ?? {}), [k]: (loads.get(tid)?.[k] ?? 0) + give });
      want -= give;
    }
  }
  let sent = 0;
  for (const [from, load] of loads) {
    if ((c.convoys ?? []).filter((x) => x.owner === f && !x.movers && x.pays === undefined).length >= CONVOYS.most) break;
    const x = sendConvoy(c, f, from, at, load);
    if (x) { x.ahead = what; sent++; }
  }
  return sent;
}

/** Will this rival enter its next age when the season turns (and not now)? `cost` the age's price, `income` a season's. */
export function ageNext(c: Campaign, f: number, o: { cost: number; income: number; maxAge: number }): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || (fac.age ?? 0) >= o.maxAge) return false;
  const now = c.turn >= 5 && fac.supplies >= o.cost + 8 && mayAdvance(c, f);
  if (now) return false;
  const seen = c.aged?.[f];
  const timely = !seen || seen.age === 0 || c.turn + 1 - seen.at >= RIVAL.settle;
  return c.turn + 1 >= 5 && fac.supplies + o.income >= o.cost + 8 && timely;
}

/**
 * A rival's foresight for the season: goods sent ahead for its next age, and for the border it will open. `age`: its next
 * age's cost and its season's income; `way`: the border it would open next season and not now (country.ts rivalWay), if any.
 * Returns how many convoys set out.
 */
export function rivalForesight(c: Campaign, f: number, o: { ageCost: number; income: number; maxAge: number }): number {
  if (!c.factions[f]?.isAI || f === 0) return 0;
  let sent = 0;
  if (ageNext(c, f, { cost: o.ageCost, income: o.income, maxAge: o.maxAge })) sent += sendAhead(c, f, chiefOf(c, f), 'age', o.ageCost);
  const way = wayNext(c, f, o.income);
  if (way) sent += sendAhead(c, f, way.from, way.what, way.cost);
  return sent;
}
/** The border this rival will open when the season turns, and not now (campaign.ts opens one from its sixth season, country.ts rivalOpens). */
export function wayNext(c: Campaign, f: number, income: number): ReturnType<typeof rivalWay> {
  if (c.turn >= 6 && rivalWay(c, f)) return null; // it opens one this season: the purchase sends for its own goods
  return c.turn + 1 >= 6 ? rivalWay(c, f, { extra: income }) : null;
}

/**
 * Where a rival raises a thing it may raise in any of these towns: the first that can pay out of its own stores, else the
 * one holding most of what it is made of. `cands`: the towns, in the order it would choose them otherwise, each with its price.
 */
export function spendIn(c: Campaign, f: number, what: string, cands: { tid: number; n: number }[]): number | undefined {
  if (!cands.length) return undefined;
  const here = cands.find((x) => paysHere(c, f, what, x.n, { at: x.tid }));
  if (here) return here.tid;
  const holds = (x: { tid: number; n: number }): number => { const p = priceOf(what, x.n), s = folkOf(c, x.tid).stores; return STORE_KINDS.reduce((a, k) => a + Math.min(Math.max(0, s[k]), p[k]), 0); };
  return [...cands].sort((a, b) => holds(b) - holds(a) || cands.indexOf(a) - cands.indexOf(b))[0].tid;
}
