// Free towns (the gathering session's word, 17 November 2026, from the count of what feeds ruin): a town that
// rises and throws off its people's rule does not simply go to nobody. It is a free town: its people are still in
// it, under nobody, and it remembers whose it was.
//
//   Rising (campaign.ts mapTurn, when unrest comes to a head with nothing to keep order): the town is nobody's,
//     with a few men under arms as before, and is marked free with the people it left and the season.
//   By force it can be taken as any land nobody holds can, by anyone; then it is theirs and free no longer.
//   By treaty it can come back to the people it left, whole, with no war and no yoke: its people were theirs all
//     along. Two ways:
//       Asked (`treat`). The people it left pay a price in supplies, by its size and how lately it rose (it wants
//       more while the quarrel is fresh), a quarter less with their army standing beside it. It refuses while it
//       is hungry, while that people has marched on it and been thrown back within FREE.grudge seasons, in its
//       first FREE.soon seasons, and to a people who no longer hold a land beside it. The player asks from the
//       land's panel; a computer people asks when it can and has the supplies to spare.
//       Unasked. Once FREE.cool seasons have passed, by the same tests, each season it may come back of its own
//       accord (FREE.back; twice as likely with their army beside it).
//
// What makes a town rise is unrest.ts; this is only what it becomes. Plain data; the season's one call is
// `freeTownsSeason`. Strengths are first guesses.
import type { Campaign } from './campaign';
import { TOWN_SCALE, folkOf, headcount } from './township';
import { canPayFor, payFor } from './prices';

declare module './campaign' {
  interface Territory {
    /** A free town: it rose against this people in this season, and is nobody's since; `struck`: the season that people last marched on it and was thrown back (freetown.ts). */
    free?: { from: number; since: number; struck?: number; /** It rose for a claimant to the throne, by the claim's id (claimantrising.ts). */ claimant?: number };
  }
}

export const FREE = {
  /** The men a risen town keeps under arms. */
  militia: 2,
  /** Seasons before a free town will hear of coming back. */
  cool: 8,
  /** Its chance in a season of coming back to the people it left, and how many times likelier with their army beside it. */
  back: 0.08, army: 2,
  /** Asked: seasons after rising before it will treat at all, and seasons it will not treat after being marched on. */
  soon: 2, grudge: 8,
  /** The price of a treaty in supplies: so much for each `folk` people in it, and `fresh` more at first, easing to nothing over `ease` seasons; times `beside` with the asker's army beside it; never under `least`. */
  folk: 10, fresh: 3, ease: 24, beside: 0.75, least: 1,
  /** A computer people asks only with this many supplies left over after the price, and then this often in a season. */
  spare: 12, asks: 0.25,
  /** A town that rose for a claimant to the throne asks this many times the price. */
  claimant: 2,
};

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

/** A town rises and throws off its people's rule: it is a free town from now. */
export function riseFree(c: Campaign, tid: number): void {
  const t = c.territories[tid];
  if (!t || t.owner < 0) return;
  t.free = { from: t.owner, since: c.turn };
  t.owner = -1; t.militia = FREE.militia;
}
/** Is this a free town still: marked so, and nobody's? */
export const isFree = (c: Campaign, tid: number): boolean => { const t = c.territories[tid]; return !!t?.free && t.owner < 0 && !t.horde; };
/** A free town's chance this season of coming back to the people it left: 0 where it cannot. */
export function backChance(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!isFree(c, tid)) return 0;
  const from = t.free!.from, f = c.factions[from];
  if (!f?.alive || c.turn - t.free!.since < FREE.cool) return 0;
  if (!t.adj.some((n) => c.territories[n].owner === from && !c.territories[n].horde)) return 0; // they must still be its neighbours
  const folk = folkOf(c, tid);
  if (headcount(folk) === 0 || (folk.hungry ?? 0) > 0) return 0; // nobody there to treat with; and a hungry town trusts nobody
  if (t.free!.struck !== undefined && c.turn - t.free!.struck < FREE.grudge) return 0; // nor one they lately marched on
  const near = new Set([tid, ...t.adj]);
  return FREE.back * (c.armies.some((a) => a.owner === from && near.has(a.at)) ? FREE.army : 1);
}
const armyBeside = (c: Campaign, tid: number, f: number): boolean => { const near = new Set([tid, ...c.territories[tid].adj]); return c.armies.some((a) => a.owner === f && near.has(a.at)); };
/** What a free town asks of the people it left to come back, in supplies. */
export function treatCost(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!isFree(c, tid)) return 0;
  const fresh = FREE.fresh * Math.max(0, 1 - (c.turn - t.free!.since) / FREE.ease);
  const price = (Math.ceil(headcount(folkOf(c, tid)) / (FREE.folk * TOWN_SCALE)) + fresh) * (armyBeside(c, tid, t.free!.from) ? FREE.beside : 1);
  return Math.max(FREE.least, Math.round(price * (t.free!.claimant !== undefined ? FREE.claimant : 1))); // a town risen for a claimant asks more to give him up (claimantrising.ts)
}
/** Why a free town will not treat with this people now, or '' if it will (whether they can pay is `canTreat`). */
export function treatBar(c: Campaign, f: number, tid: number): string {
  const t = c.territories[tid];
  if (!isFree(c, tid)) return 'It is not a free town.';
  if (t.free!.from !== f) return 'It did not rise against you: it has nothing to come back to.';
  if (!c.factions[f]?.alive) return 'Its people are gone.';
  if (headcount(folkOf(c, tid)) === 0) return 'There is nobody there to treat with.';
  if (c.turn - t.free!.since < FREE.soon) return 'It has only just risen, and will hear nobody yet.';
  if (t.free!.struck !== undefined && c.turn - t.free!.struck < FREE.grudge) return `You marched on it ${c.turn - t.free!.struck <= 1 ? 'this season' : `${c.turn - t.free!.struck} seasons ago`}: it will not treat with those who came with the sword, for ${FREE.grudge - (c.turn - t.free!.struck)} seasons more.`;
  if ((folkOf(c, tid).hungry ?? 0) > 0) return 'It is hungry, and trusts nobody.';
  if (!t.adj.some((n) => c.territories[n].owner === f && !c.territories[n].horde)) return 'You hold no land beside it.';
  return '';
}
/** Can this people bring the free town back by treaty now: it will treat, and they can pay? */
export const canTreat = (c: Campaign, f: number, tid: number): boolean => !treatBar(c, f, tid) && canPayFor(c, f, 'dealing', treatCost(c, tid));
/** The town comes back to the people it left. */
function comeBack(c: Campaign, tid: number, paid = 0): void {
  const t = c.territories[tid], from = t.free!.from, f = c.factions[from], years = Math.round((c.turn - t.free!.since) / 4);
  t.owner = from; t.militia = 0;
  delete t.free;
  c.log.push(`${t.name} has come back under ${from === 0 ? 'your' : `the ${f.name}'`} rule by treaty${paid ? `, for ${paid} supplies` : ''}, ${years} ${years === 1 ? 'year' : 'years'} after it rose.`);
  (c.chronicle ??= []).push({ turn: c.turn, text: `${t.name}, a free town since it rose, came back to ${from === 0 ? 'its people' : `the ${f.name}`} by treaty.` });
  (c.events ??= []).push({ kind: 'calm', at: tid, turn: c.turn, until: c.turn });
}
/** A people treats with a free town that left it: they pay its price, and it comes back. Returns whether it did. */
export function treat(c: Campaign, f: number, tid: number): boolean {
  if (!canTreat(c, f, tid)) return false;
  const price = treatCost(c, tid);
  if (!payFor(c, f, 'dealing', price)) return false;
  comeBack(c, tid, price);
  return true;
}
/** The people a free town left marched on it and was thrown back: it will not treat with them for a while. */
export function freeStruck(c: Campaign, tid: number, by: number): void {
  const t = c.territories[tid];
  if (isFree(c, tid) && t.free!.from === by) t.free!.struck = c.turn;
}

/**
 * A season for the free towns: one taken by anybody is free no longer, and one that will may come back by treaty
 * to the people it left. Returns the towns that came back.
 */
export function freeTownsSeason(c: Campaign): number[] {
  const back: number[] = [];
  for (const t of c.territories) {
    if (!t.free) continue;
    if (t.owner >= 0 || t.horde) { delete t.free; continue; }
    // A computer people asks, when the town will treat and they have supplies to spare.
    const from = t.free.from, f = c.factions[from];
    if (f?.isAI && canTreat(c, from, t.id) && (f.supplies ?? 0) >= treatCost(c, t.id) + FREE.spare && hash(c.seed * 73 + t.id * 199, c.turn * 97 + 13) < FREE.asks && treat(c, from, t.id)) { back.push(t.id); continue; }
    const p = backChance(c, t.id);
    if (p <= 0 || hash(c.seed * 71 + t.id * 197, c.turn * 89 + 11) >= p) continue;
    comeBack(c, t.id);
    back.push(t.id);
  }
  return back;
}
