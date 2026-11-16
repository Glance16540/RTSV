// Convoys by road (docs/DESIGN.md, "Stores", step 2b).
//
// A town sends food, goods or people to another town of its own people. They go by road: through the people's own
// lands, one next to another, and a convoy that has no such road cannot go. A road may cross a sea lane between two of
// the people's lands where either end has a Harbour, as an army may. However long the road, it is a season on the
// way: it leaves the town at once and comes in when the next season turns.
//
// What travels. Stores of any kind, and grown people of working age (the youngest first, with their ages). A town
// never sends its last man or its last woman, and never a child: children are records on their houses.
//
// Highwaymen. A band of highwaymen sits on the road between two lands (threats.ts). A convoy whose road passes
// through either end of theirs may be met: it is escorted by any army of its people standing on that road, and an
// escort as strong as the band sees it through. Otherwise the band takes ROB of every store it carries. People are
// never taken on the road (highwaymen rob stores, never people), and the band grows on what it takes.
//
// Pirates. They reach every coast (threats.ts), so a convoy that crosses a sea lane may be met by them as by
// highwaymen on a road, on the same terms: an escort on its road as strong as they are, or half of every store.
//
// Coming in. The goods go into the town's stores as far as there is room, and the people join it at their ages.
// If the town has been lost meanwhile, the convoy turns for the people's chief town; if they have no town left,
// what it carries is lost.
//
// Decided by a run of chances of its own, so the rest of a campaign's luck is left as it was.
import type { Campaign } from './campaign';
import type { Stores } from './township';
import { MAX_STORE, STORE_KINDS, folkOf } from './township';
import { OLD_SEASON, agesOf, countFrom } from './ageing';
import { armyStrength, lanesOf } from './campaignbase';
import { needOf } from './larder';
import { roadRisk } from './ownstudies';
import { escortEdge, innRisk, paved } from './roads';

/** What a convoy carries: stores, and grown people by their ages in seasons. */
export interface Cargo { food: number; wood: number; gold: number; stone: number; men: number[]; women: number[] }
export interface Convoy { id: number; owner: number; from: number; to: number; road: number[]; cargo: Cargo; since: number }
/** What happened to a convoy as the season turned. */
export interface Arrival { convoy: Convoy; at: number; robbed?: { by: string; took: Stores }; lost?: boolean }

declare module './campaign' {
  interface Campaign {
    /** Convoys on the road (convoys.ts). */
    convoys?: Convoy[];
    convoySeq?: number;
  }
}

export const CONVOYS = {
  /** The share of every store highwaymen take from a convoy they stop, and the chance they are lying in wait. */
  rob: 0.5, meet: 0.75,
  /** The most convoys a people may have on the road at once. */
  most: 6,
  /**
   * The computer player feeds its hungry towns (`relieve`). A town is short when its food is under `hungry` or under
   * what it will eat next season; it is sent `seasons` seasons of its own eating less what it has, and never less
   * than `relief`. The town with the most to spare sends it, or as much of it as it can: a town keeps `seasons`
   * seasons of its own eating (never less than `keep`), and sends nothing under `least`.
   */
  hungry: 150, relief: 300, keep: 100, seasons: 2, least: 100,
};

/** What a convoy would carry: so many of these stores, so many men and women. */
export interface Send { food?: number; wood?: number; gold?: number; stone?: number; men?: number; women?: number }

const hash = (c: Campaign, a: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 7, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(a * 389 + salt + 11, 0xc2b2ae35) ^ 0x3c6ef372;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
/** All the stores in a store, of every kind. */
export const worth = (s: Stores): number => s.food + s.wood + s.gold + s.stone;
/** A people's chief town: its capital while it holds it, else its first town; -1 if it has none. */
export function homeTown(c: Campaign, f: number): number {
  const mine = c.territories.filter((t) => t.owner === f && !t.horde);
  return (mine.find((t) => t.capital === f) ?? mine[0])?.id ?? -1;
}
const whole = (n: number | undefined): number => Math.max(0, Math.floor(Number(n) || 0));
const empty = (): Stores => ({ food: 0, wood: 0, gold: 0, stone: 0 });

const harbour = (c: Campaign, id: number): boolean => c.territories[id]?.buildings.includes('harbour') ?? false;
/** The sea lanes a convoy may cross from this land: every lane where it, or the land at the other end, has a Harbour. */
export const convoyLanes = (c: Campaign, id: number): number[] => lanesOf(c, id).filter((n) => harbour(c, id) || harbour(c, n));
/** The legs of a road that cross the sea: each pair of lands one after the other that are not next to each other. */
export const seaLegs = (c: Campaign, road: number[]): [number, number][] =>
  road.slice(1).map((b, i) => [road[i], b] as [number, number]).filter(([a, b]) => !c.territories[a].adj.includes(b));

/**
 * The road from one land of a people to another through its own lands, from end to end; null if there is none. It
 * crosses a sea lane only where either end has a Harbour, and goes by land where it can do so in as few lands.
 */
export function roadBetween(c: Campaign, f: number, from: number, to: number): number[] | null {
  const own = (id: number) => c.territories[id]?.owner === f;
  if (!own(from) || !own(to) || from === to) return null;
  const back = new Map<number, number>([[from, -1]]), queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === to) break;
    const land = [...c.territories[at].adj].sort((a, b) => a - b), sea = convoyLanes(c, at).filter((n) => !land.includes(n)).sort((a, b) => a - b);
    for (const n of [...land, ...sea]) if (own(n) && !back.has(n)) { back.set(n, at); queue.push(n); }
  }
  if (!back.has(to)) return null;
  const road = [to];
  while (road[0] !== from) road.unshift(back.get(road[0])!);
  return road;
}

/** Why this convoy cannot go, in words; '' if it can. */
export function cannotSend(c: Campaign, f: number, from: number, to: number, what: Send): string {
  if (c.territories[from]?.owner !== f || c.territories[to]?.owner !== f) return 'Both towns must be your people\'s.';
  if (from === to) return 'A convoy goes from one town to another.';
  if (!roadBetween(c, f, from, to)) return 'There is no road through your own lands between them, nor a sea lane from a Harbour.';
  if ((c.convoys ?? []).filter((x) => x.owner === f).length >= CONVOYS.most) return `No more than ${CONVOYS.most} convoys can be on the road at once.`;
  const k = folkOf(c, from);
  for (const s of STORE_KINDS) if (whole(what[s]) > k.stores[s]) return `${c.territories[from].name} has only ${k.stores[s]} ${s}.`;
  if (whole(what.men) > Math.max(0, k.men - 1)) return `${c.territories[from].name} cannot spare ${whole(what.men)} ${whole(what.men) === 1 ? 'man' : 'men'}: a town keeps at least one.`;
  if (whole(what.women) > Math.max(0, k.women - 1)) return `${c.territories[from].name} cannot spare ${whole(what.women)} ${whole(what.women) === 1 ? 'woman' : 'women'}: a town keeps at least one.`;
  if (!STORE_KINDS.some((s) => whole(what[s])) && !whole(what.men) && !whole(what.women)) return 'The convoy carries nothing.';
  return '';
}

/** Take so many grown people of working age out of a town, the youngest first. Returns their ages. */
function setOut(c: Campaign, tid: number, sex: 'm' | 'f', n: number): number[] {
  if (n <= 0) return [];
  const k = folkOf(c, tid), ages = agesOf(c, tid, k);
  const going = ages[sex].map((s, i) => [s, i] as const).filter(([s]) => s < OLD_SEASON).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, n);
  const gone = new Set(going.map(([, i]) => i));
  ages[sex] = ages[sex].filter((_, i) => !gone.has(i));
  countFrom(k, ages);
  return going.map(([s]) => s);
}

/** Send a convoy. It leaves at once and comes in when the season turns. Returns it, or null if it cannot go. */
export function sendConvoy(c: Campaign, f: number, from: number, to: number, what: Send): Convoy | null {
  if (cannotSend(c, f, from, to, what)) return null;
  const k = folkOf(c, from), cargo: Cargo = { ...empty(), men: [], women: [] };
  for (const s of STORE_KINDS) { cargo[s] = whole(what[s]); k.stores[s] -= cargo[s]; }
  cargo.men = setOut(c, from, 'm', whole(what.men));
  cargo.women = setOut(c, from, 'f', whole(what.women));
  const convoy: Convoy = { id: (c.convoySeq = (c.convoySeq ?? 0) + 1), owner: f, from, to, road: roadBetween(c, f, from, to)!, cargo, since: c.turn };
  (c.convoys ??= []).push(convoy);
  const goods = STORE_KINDS.filter((s) => cargo[s]).map((s) => `${cargo[s]} ${s}`), folk = [cargo.men.length ? `${cargo.men.length} ${cargo.men.length === 1 ? 'man' : 'men'}` : '', cargo.women.length ? `${cargo.women.length} ${cargo.women.length === 1 ? 'woman' : 'women'}` : ''].filter(Boolean);
  if (f === 0) c.log.push(`A convoy has left ${c.territories[from].name} for ${c.territories[to].name} with ${[...goods, ...folk].join(', ')}. ${paved(c, f) ? 'The road is paved: it is there within the season.' : 'It will come in next season.'}`);
  // On Paved Roads it is not a season on the way (roads.ts): it comes in now, by the same rules, and no other convoy with it.
  if (paved(c, f)) { const rest = c.convoys.filter((y) => y !== convoy); c.convoys = [convoy]; convoy.since = c.turn - 1; convoysTurn(c); c.convoys = [...rest, ...c.convoys]; }
  return convoy;
}

/** Everything a people has on the road. */
export const onTheRoad = (c: Campaign, f: number): Convoy[] => (c.convoys ?? []).filter((x) => x.owner === f);
/** What a convoy carries, all stores together. */
export const cargoWorth = (x: Convoy): number => worth(x.cargo);

/**
 * Who lies in wait for a convoy, if anyone: the first band of highwaymen one of whose ends its road passes through,
 * else, if it crosses the sea, the strongest band of pirates.
 */
function waylaid(c: Campaign, x: Convoy): { name: string; strength: number; sea: boolean; band: { strength: number } } | null {
  for (const b of c.bands ?? []) {
    if (b.kind !== 'highwaymen' || b.to === undefined) continue;
    if (x.road.includes(b.at) || x.road.includes(b.to)) return { name: b.name, strength: b.strength, sea: false, band: b };
  }
  if (!seaLegs(c, x.road).length) return null;
  const p = (c.bands ?? []).filter((b) => b.kind === 'pirates').sort((a, b) => b.strength - a.strength || a.id - b.id)[0];
  return p ? { name: p.name, strength: p.strength, sea: true, band: p } : null;
}

/**
 * The season turns for every convoy on the road: highwaymen may stop it, and it comes in. Called once a turn, after
 * the bands have struck. Returns what happened to each; the same is written in the log for the player's.
 */
export function convoysTurn(c: Campaign): Arrival[] {
  const out: Arrival[] = [];
  const going = (c.convoys ?? []).filter((x) => x.since < c.turn);
  c.convoys = (c.convoys ?? []).filter((x) => x.since >= c.turn);
  for (const x of going) {
    const a: Arrival = { convoy: x, at: x.to };
    const mine = x.owner === 0;
    // Highwaymen on the road, or pirates at sea, unless an escort of the people's own as strong as they are stands on it.
    const band = waylaid(c, x);
    if (band && hash(c, x.id, 3) < CONVOYS.meet * roadRisk(c, x.owner) * innRisk(c, x.owner, x.road)) { // and where an Inn stands on its road (roads.ts) // less often, for a people whose convoys rest behind walls (ownstudies.ts)
      const escort = Math.max(0, ...c.armies.filter((y) => y.owner === x.owner && x.road.includes(y.at)).map((y) => armyStrength(y)));
      if (escort < band.strength && worth(x.cargo) > 0) {
        const took = empty();
        for (const s of STORE_KINDS) { took[s] = Math.floor(x.cargo[s] * CONVOYS.rob * escortEdge(c, x.owner)); /* less from a people who send Escorts (roads.ts) */ x.cargo[s] -= took[s]; }
        if (worth(took) > 0) {
          a.robbed = { by: band.name, took };
          band.band.strength = Math.min(10, band.band.strength + 1);
          if (mine) c.log.push(`🗡️ ${band.name[0].toUpperCase() + band.name.slice(1)} stopped your convoy to ${c.territories[x.to].name} ${band.sea ? 'at sea' : 'on the road'} and took ${STORE_KINDS.filter((s) => took[s]).map((s) => `${took[s]} ${s}`).join(', ')}.`);
        }
      }
    }
    // Where it comes in: its own town if still held, else the people's chief town.
    const at = c.territories[x.to]?.owner === x.owner ? x.to : homeTown(c, x.owner);
    if (at < 0 || !c.factions[x.owner]?.alive) { a.lost = true; if (mine) c.log.push(`Your convoy to ${c.territories[x.to].name} had nowhere left to go, and what it carried is lost.`); out.push(a); continue; }
    a.at = at;
    const k = folkOf(c, at);
    for (const s of STORE_KINDS) k.stores[s] = Math.min(MAX_STORE, k.stores[s] + x.cargo[s]);
    if (x.cargo.men.length || x.cargo.women.length) {
      const ages = agesOf(c, at, k);
      ages.m.push(...x.cargo.men.map((s) => s + 1));
      ages.f.push(...x.cargo.women.map((s) => s + 1));
      countFrom(k, ages);
    }
    if (mine) c.log.push(`A convoy from ${c.territories[x.from].name} has come in to ${c.territories[at].name}${at !== x.to ? ` (${c.territories[x.to].name} is lost to you)` : ''}.`);
    out.push(a);
  }
  return out;
}

/**
 * The computer player looks after its own: each hungry town of its people with no food already on the way is sent
 * food from the town that has most to spare, if a road joins them. Returns the convoys sent.
 */
export function relieve(c: Campaign, f: number): Convoy[] {
  const sent: Convoy[] = [];
  const mine = c.territories.filter((t) => t.owner === f);
  const food = (id: number): number => folkOf(c, id).stores.food;
  // What a town can give: what it has over its own next seasons of eating.
  const spare = (id: number): number => food(id) - Math.max(CONVOYS.keep, CONVOYS.seasons * needOf(c, id));
  for (const t of mine) {
    const need = needOf(c, t.id);
    if (food(t.id) >= Math.max(CONVOYS.hungry, need) || onTheRoad(c, f).some((x) => x.to === t.id && x.cargo.food > 0)) continue;
    const want = Math.max(CONVOYS.relief, CONVOYS.seasons * need - food(t.id));
    const giver = mine.filter((g) => g.id !== t.id && spare(g.id) >= CONVOYS.least && roadBetween(c, f, g.id, t.id))
      .sort((a, b) => spare(b.id) - spare(a.id) || a.id - b.id)[0];
    if (!giver) continue;
    const x = sendConvoy(c, f, giver.id, t.id, { food: Math.min(want, Math.floor(spare(giver.id))) });
    if (x) sent.push(x);
  }
  return sent;
}
