// Caravans on the roads (docs/DESIGN.md, the owner's word, 18 November 2026: "A market's trade is carried by caravans that
// can be seen on the roads between towns, and a band can fall on one, as it can on an army. What a market earns comes by
// the caravans that arrive, not by rule alone.")
//
// On the map a Market earned nothing; only in a battle or a visit did the Traders' markets pay by rule (game.ts, which is
// left as it is). Now a town with a Market standing on its record trades by road:
//   - Its partner. The nearest other town with a Market, by road, within CARAVANS.reach lands: a town of its own people, or
//     of a people whose markets are open to it by a trade deal (tradedeal.ts, pacts.ts marketsOpen), which only peoples at
//     peace make (a truce, an alliance or a royal marriage, campaignbase.ts atTruce). The road runs over
//     the lands' borders and, where either end has a Harbour, the sea lanes, as a convoy's does (convoys.ts); it passes
//     only lands of its own people, its partner's, or nobody's, and never the rim.
//   - The caravan. Each season a market town with no caravan of its own on the road sends one to its partner, and it comes
//     home the season after with what the trade was worth in gold: CARAVANS.gold, CARAVANS.perLand more for every land of
//     road, CARAVANS.abroad times for a partner of another people, and CARAVANS.traders times for a people of Traders
//     (data.ts STYLES). Nothing leaves the town's stores for it: the gold is what the trade earned.
//   - On the road it is met as a convoy is (convoys.ts `waylay`): highwaymen on its road or pirates on its sea lanes, unless
//     an army of its people as strong as they are stands on the road, take a share of what it carries; an Inn, Escorts and
//     the Caravanserais ease that as they do for a convoy. Any other band may fall on one where it stands on a land the
//     caravan's road crosses, as on an army: `caravansThrough` and `fallOnCaravan`, for the bands' own season to call
//     (threats.ts, bandfight.ts: theirs to call).
//   - Coming home, the gold goes into the town's stores (the sender's alone). A town lost meanwhile has nothing come in.
//   - Markets. A Market can be raised from the map (data.ts `onMap`), and a town's governor, any people's, begins one of
//     his own accord where a town it could trade with lies within reach, out of plenty (plenty.ts, CARAVANS.plenty), one a
//     season for each people.
// The map draws them walking their roads (src/client/caravandraw.ts). One call a season (campaign.ts), after the convoys.
// Decided by chances of its own (convoys.ts's hash, on caravan numbers of their own), so the rest of the campaign's luck
// is left as it was.
import { escortFight } from './roadclash';
import type { Campaign } from './campaign';
import type { Arrival, Convoy } from './convoys';
import { CONVOYS, convoyLanes, waylay } from './convoys';
import type { Band } from './threats';
import { BUILDINGS, styleOf } from './data';
import { MAX_STORE, STORE_KINDS, folkOf } from './township';
import { armyStrength, atTruce } from './campaignbase';
import { marketsOpen } from './pacts';
import { standsAt } from './studies';
import { begunAt, raiseWork } from './townworks';
import { canSpare } from './plenty';
import { wantsOf } from './governor';
import { escortEdge } from './roads';

/** A caravan: a convoy of the market's trade, coming home from its partner with the gold it earned. */
export interface Caravan extends Convoy { trade: true; /** The gold it set out to bring home. */ worth: number; /** A band fell on it on the road (`fallOnCaravan`): once. */ fallen?: boolean }

declare module './campaign' {
  interface Campaign {
    /** Caravans on the road (caravans.ts), and the numbers they are known by. */
    caravans?: Caravan[]; caravanSeq?: number;
    /** What the caravans have done, for the report: sent, come home, robbed on the way, the gold they brought, every people's and the player's. */
    caravanTally?: { sent: number; came: number; robbed: number; gold: number; mine: { sent: number; came: number; robbed: number; gold: number } };
  }
}

export const CARAVANS = {
  /** The farthest a partner may be, in lands of road. */
  reach: 4,
  /** Gold a caravan brings home, and more for each land of road; times for a partner abroad, and for a people of Traders. */
  gold: 100, perLand: 20, abroad: 1.5, traders: 1.5,
  /** A governor begins a Market only if, after paying, the town still holds this many times what it keeps by it, as for an
   *  Inn. Once over, every town raised one as soon as it had the wood, and the computer-played player won 15 campaigns in
   *  384 fewer in either course for it, with or without the caravans' gold; four times over it wins as many as without. */
  plenty: 4,
  /** Caravans are numbered from here, apart from the convoys, so their chances are their own. */
  ids: 500000,
};

const tally = (c: Campaign) => (c.caravanTally ??= { sent: 0, came: 0, robbed: 0, gold: 0, mine: { sent: 0, came: 0, robbed: 0, gold: 0 } });
const atPeace = (c: Campaign, f: number, g: number): boolean => f === g || atTruce(c, f, g);
/** A town that trades: held, not overrun, not of the rim, with a finished Market. */
const trades = (c: Campaign, tid: number): boolean => { const t = c.territories[tid]; return !!t && t.owner >= 0 && !t.horde && !t.rim && standsAt(c, tid, 'market'); };

/**
 * The road from a town to the nearest town of `f`'s or of a people at peace with it that `want` takes, within CARAVANS.reach
 * lands: over borders and, from a land with a Harbour or to one, sea lanes; through lands of `f`, of the partner's people,
 * or of nobody. Returns the road from the town to the partner, or null.
 */
function nearest(c: Campaign, f: number, from: number, want: (tid: number) => boolean): number[] | null {
  const back = new Map<number, number>([[from, -1]]);
  let edge = [from];
  for (let d = 0; d < CARAVANS.reach && edge.length; d++) {
    const next: number[] = [];
    for (const id of edge) for (const n of [...c.territories[id].adj, ...convoyLanes(c, id)]) {
      const t = c.territories[n];
      if (!t || back.has(n) || t.rim || t.horde) continue;
      if (t.owner >= 0 && !atPeace(c, f, t.owner)) continue; // never through a people it is not at peace with
      back.set(n, id);
      if (n !== from && want(n) && atPeace(c, f, t.owner)) { const road = [n]; for (let k = back.get(n)!; k >= 0; k = back.get(k)!) road.unshift(k); return road; }
      next.push(n);
    }
    edge = next;
  }
  return null;
}

/** The town a market town trades with, and the road to it (from the town to the partner), or null. */
export function partnerOf(c: Campaign, tid: number): { at: number; road: number[] } | null {
  const t = c.territories[tid];
  if (!trades(c, tid)) return null;
  const road = nearest(c, t.owner, tid, (n) => trades(c, n) && marketsOpen(c, t.owner, c.territories[n].owner)); // abroad only under a trade deal (tradedeal.ts)
  return road ? { at: road[road.length - 1], road } : null;
}

/** The gold a caravan on this road between these towns brings home. */
export function caravanWorth(c: Campaign, from: number, to: number, road: number[]): number {
  const f = c.territories[from].owner, g = c.territories[to].owner, C = CARAVANS;
  const traders = styleOf(c.factions[f]?.civ ?? '').id === 'trader';
  return Math.round((C.gold + C.perLand * Math.max(0, road.length - 1)) * (g !== f ? C.abroad : 1) * (traders ? C.traders : 1));
}

/** Caravans of a people on the road. */
export const caravansOf = (c: Campaign, f: number): Caravan[] => (c.caravans ?? []).filter((x) => x.owner === f);
/** Caravans whose road crosses this land: what a band standing there could fall on. */
export const caravansThrough = (c: Campaign, tid: number): Caravan[] => (c.caravans ?? []).filter((x) => x.road.includes(tid));

/**
 * A band falls on a caravan where it stands on its road (for the bands' own season to call, as on an army): unless an army
 * of the caravan's people as strong as the band stands on its road, it takes CONVOYS.rob of the gold (less where Escorts are
 * sent, roads.ts) and grows on it. A caravan is fallen on once. Returns the gold taken.
 */
export function fallOnCaravan(c: Campaign, x: Caravan, b: Band): number {
  if (x.fallen) return 0;
  x.fallen = true;
  const escort = Math.max(0, ...c.armies.filter((y) => y.owner === x.owner && x.road.includes(y.at)).map((y) => armyStrength(y)));
  void escort;
  const met = escortFight(c, 'camp on a caravan', b, x.owner, x.road); // an army of its people on the road fights the band (roadclash.ts)
  if (!met.robbed) return 0;
  const took = Math.floor(x.cargo.gold * CONVOYS.rob * met.share * escortEdge(c, x.owner));
  if (took <= 0) return 0;
  x.cargo.gold -= took;
  b.strength = Math.min(10, b.strength + 1);
  tally(c).robbed++; if (x.owner === 0) tally(c).mine.robbed++;
  if (x.owner === 0) c.log.push(`🗡️ ${b.name[0].toUpperCase() + b.name.slice(1)} fell on your caravan on the road to ${c.territories[x.to].name} and took ${took} gold.`);
  return took;
}

/** The caravans on the road come home: met on the way or not, the gold they bring goes into the town's stores. */
export function caravansHome(c: Campaign): Arrival[] {
  const out: Arrival[] = [], left: Caravan[] = [];
  let mineGold = 0, mineCame = 0;
  for (const x of c.caravans ?? []) {
    if (x.since >= c.turn) { left.push(x); continue; }
    const a: Arrival = { convoy: x, at: x.to };
    const robbed = !!waylay(c, x, a, 'caravan') && !!a.robbed;
    const T = tally(c);
    if (robbed && !x.fallen) { T.robbed++; if (x.owner === 0) T.mine.robbed++; }
    if (c.territories[x.to]?.owner !== x.owner) { a.lost = true; out.push(a); continue; } // its town is lost: nothing comes in
    const k = folkOf(c, x.to);
    for (const s of STORE_KINDS) k.stores[s] = Math.min(MAX_STORE, k.stores[s] + x.cargo[s]);
    T.came++; T.gold += x.cargo.gold;
    if (x.owner === 0) { T.mine.came++; T.mine.gold += x.cargo.gold; mineGold += x.cargo.gold; mineCame++; }
    out.push(a);
  }
  c.caravans = left;
  if (mineCame) c.log.push(`🐪 ${mineCame === 1 ? 'A caravan has' : `${mineCame} caravans have`} come home from the markets, with ${mineGold} gold.`);
  return out;
}

/** Every market town with no caravan of its own on the road sends one to its partner. Returns those sent. */
export function sendCaravans(c: Campaign): Caravan[] {
  const sent: Caravan[] = [], out = new Set((c.caravans ?? []).map((x) => x.to));
  for (const t of c.territories) {
    if (out.has(t.id) || !c.factions[t.owner]?.alive) continue;
    const p = partnerOf(c, t.id);
    if (!p) continue;
    const worth = caravanWorth(c, t.id, p.at, p.road);
    const x: Caravan = {
      id: CARAVANS.ids + (c.caravanSeq = (c.caravanSeq ?? 0) + 1), owner: t.owner, from: p.at, to: t.id, road: [...p.road].reverse(), since: c.turn,
      cargo: { food: 0, wood: 0, gold: worth, stone: 0, men: [], women: [] }, trade: true, worth,
    };
    (c.caravans ??= []).push(x);
    sent.push(x);
    tally(c).sent++; if (t.owner === 0) tally(c).mine.sent++;
  }
  return sent;
}

/** Has a town the means to spare for a Market? Only out of plenty, as for an Inn (plenty.ts, the one rule for every purchase). */
const spare = (c: Campaign, tid: number): boolean => canSpare(c, tid, BUILDINGS.market.cost, { wants: wantsOf(c, tid), times: CARAVANS.plenty });

/**
 * The governors' season: in each people, the first town with no Market begun that has a town it could trade with in reach
 * (of its own people or one at peace with it, a Market there or not) begins one, out of plenty. Returns the towns that did.
 */
export function governMarkets(c: Campaign): number[] {
  const begun: number[] = [], done = new Set<number>();
  for (const t of c.territories) {
    const f = t.owner;
    if (f < 0 || t.horde || t.rim || done.has(f) || begunAt(c, t.id, 'market') || !spare(c, t.id)) continue;
    if (!nearest(c, f, t.id, (n) => { const u = c.territories[n]; return u.owner >= 0 && !u.horde; })) continue;
    const log = c.log.length;
    if (raiseWork(c, f, t.id, 'market') !== '') continue;
    c.log.length = log; // said in the governor's own words
    done.add(f); begun.push(t.id);
    if (f === 0) c.log.push(`The governor of ${t.name} has begun a Market: there are towns to trade with on its roads.`);
  }
  return begun;
}

/** A season of trade: the caravans on the road come home, governors raise markets, and the markets send their caravans. */
export function caravansSeason(c: Campaign): { home: Arrival[]; sent: Caravan[]; markets: number[] } {
  const home = caravansHome(c), markets = governMarkets(c), sent = sendCaravans(c);
  return { home, sent, markets };
}
