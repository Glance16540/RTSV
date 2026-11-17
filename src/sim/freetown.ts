// Free towns (the gathering session's word, 17 November 2026, from the count of what feeds ruin): a town that
// rises and throws off its people's rule does not simply go to nobody. It is a free town: its people are still in
// it, under nobody, and it remembers whose it was.
//
//   Rising (campaign.ts mapTurn, when unrest comes to a head with nothing to keep order): the town is nobody's,
//     with a few men under arms as before, and is marked free with the people it left and the season.
//   By force it can be taken as any land nobody holds can, by anyone; then it is theirs and free no longer.
//   By treaty it can come back to the people it left. Once FREE.cool seasons have passed, while that people lives
//     and holds a land beside it, and the town is not hungry, each season it may come back of its own accord
//     (FREE.back; twice as likely with an army of theirs standing beside it). It comes back whole, with no war and
//     no yoke: its people were theirs all along.
//
// What makes a town rise is unrest.ts; this is only what it becomes. Plain data; the season's one call is
// `freeTownsSeason`. Strengths are first guesses.
import type { Campaign } from './campaign';
import { folkOf, headcount } from './township';

declare module './campaign' {
  interface Territory {
    /** A free town: it rose against this people in this season, and is nobody's since (freetown.ts). */
    free?: { from: number; since: number };
  }
}

export const FREE = {
  /** The men a risen town keeps under arms. */
  militia: 2,
  /** Seasons before a free town will hear of coming back. */
  cool: 8,
  /** Its chance in a season of coming back to the people it left, and how many times likelier with their army beside it. */
  back: 0.08, army: 2,
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
  const near = new Set([tid, ...t.adj]);
  return FREE.back * (c.armies.some((a) => a.owner === from && near.has(a.at)) ? FREE.army : 1);
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
    const p = backChance(c, t.id);
    if (p <= 0 || hash(c.seed * 71 + t.id * 197, c.turn * 89 + 11) >= p) continue;
    const from = t.free.from, f = c.factions[from], years = Math.round((c.turn - t.free.since) / 4);
    t.owner = from; t.militia = 0;
    delete t.free;
    back.push(t.id);
    c.log.push(`${t.name} has come back under ${from === 0 ? 'your' : `the ${f.name}'`} rule by treaty, ${years} ${years === 1 ? 'year' : 'years'} after it rose.`);
    (c.chronicle ??= []).push({ turn: c.turn, text: `${t.name}, a free town since it rose, came back to ${from === 0 ? 'its people' : `the ${f.name}`} by treaty.` });
    (c.events ??= []).push({ kind: 'calm', at: t.id, turn: c.turn, until: c.turn });
  }
  return back;
}
