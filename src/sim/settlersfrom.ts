// Settlers come from the taker's own towns (docs/DESIGN.md, "A soldier costs a person": no man comes from nowhere;
// docs/CLOSING.md, "Nobody from nowhere").
//
// A town taken with nobody left alive in it (a siege fought in person, campaign.ts; a dead town a nation has taken,
// deadtown.ts) was settled at once by people from nowhere: "four who followed the army", or DEAD.settlers men and women.
// Now they are the taker's own: men and women of its nearest towns that can spare them set out by road to settle it, as
// a family does (convoys.ts sendFamily), a season on the way and open to the bands like any convoy. A town sends only
// what it can spare: it keeps SETTLE_FROM.keep grown people and at least one man and one woman, and it sends a man and
// a woman together. Where nobody can be spared, or no road reaches, nobody comes: the town stands empty, and the rules
// for an empty town go on (deadtown.ts). Only the grown go: children stay at home with their own.
import type { Campaign } from './campaign';
import { roadBetween, sendFamily } from './convoys';
import { folkOf } from './township';

export const SETTLE_FROM = {
  /** Grown people a town keeps whatever it sends (as a family leaving does, migration.ts MIGRATE.keep). */
  keep: 8,
  /** Couples sent to a town a battle left empty (there were four from nowhere: two men and two women). */
  taken: 2,
};

/** How many couples a town can spare to settle another: none below SETTLE_FROM.keep grown, and a man and a woman left. */
export function spareCouples(c: Campaign, tid: number): number {
  const f = folkOf(c, tid);
  return Math.max(0, Math.min(f.men - 1, f.women - 1, Math.floor((f.men + f.women - SETTLE_FROM.keep) / 2)));
}

/**
 * Send up to `couples` men and as many women of people `f`'s nearest towns, by road, to settle the empty town `tid`.
 * The nearest by road first. Returns those sent, and the towns they came from.
 */
export function settlersTo(c: Campaign, f: number, tid: number, couples: number): { sent: number; from: number[] } {
  const t = c.territories[tid], out = { sent: 0, from: [] as number[] };
  if (!t || f < 0 || t.owner !== f || couples <= 0) return out;
  const near = c.territories.filter((x) => x.owner === f && x.id !== tid && !x.horde)
    .map((x) => ({ x, road: roadBetween(c, f, x.id, tid) }))
    .filter((r) => !!r.road)
    .sort((a, b) => a.road!.length - b.road!.length || Math.hypot(a.x.x - t.x, a.x.y - t.y) - Math.hypot(b.x.x - t.x, b.x.y - t.y) || a.x.id - b.x.id);
  let left = couples;
  for (const { x } of near) {
    if (left <= 0) break;
    const k = Math.min(left, spareCouples(c, x.id));
    if (k <= 0) continue;
    if (!sendFamily(c, f, x.id, tid, { men: k, women: k, children: 0 })) continue;
    left -= k; out.sent += 2 * k; out.from.push(x.id);
  }
  if (f === 0) {
    const name = t.name;
    c.log.push(out.sent
      ? `Nobody was left alive in ${name}. ${out.sent} of your people from ${out.from.map((id) => c.territories[id].name).join(' and ')} have set out by road to settle it.`
      : `Nobody was left alive in ${name}, and none of your towns within reach can spare anyone to settle it: it stands empty.`);
  }
  return out;
}

/** A battle fought in person has been written back: a town taken with nobody left in it is settled by its taker's own. */
export function settleTaken(c: Campaign, tid: number, was: number): { sent: number; from: number[] } {
  const t = c.territories[tid], f = folkOf(c, tid);
  if (!t || t.owner < 0 || t.owner === was || t.horde || f.men + f.women + f.elders > 0) return { sent: 0, from: [] };
  return settlersTo(c, t.owner, tid, SETTLE_FROM.taken);
}
