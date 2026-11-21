/**
 * A rival that thinks as a people: two armies for one assault (docs/DESIGN.md, "Rivals live by the same rules").
 * An army that came to the edge of its people's lands on the way to the war aim (rivalplan.ts) and did not dare
 * the next land used to give the aim up or wander off. Now it holds there and sends for a second army:
 * - the nearest free army of its people comes through their own lands, a land a season;
 * - if the two make one army within the limit they join; if not, the second stands in a land of theirs beside
 *   the one to be taken and lends its weight, as any army beside a battle does (campaign.ts, moveArmy);
 * - the first waits `MASS.wait` seasons for it. If the second never comes, or has come and the two together
 *   still do not dare, the aim is given up (rivalplan.ts, giveUp).
 * So that the wait is worth it, a rival judging whether it dares a march now counts what its armies beside that
 * land would lend (`lent`): the rule the battle already goes by.
 * Plain data on the campaign, by nation.
 */
import type { Army, Campaign } from './campaign';
import { MAX_ARMY, armySize, armyStrength } from './campaignbase';
import { gatesOf, giveUp } from './rivalplan';
import { threatened } from './rivalrule';

export const MASS = {
  /** The share of its strength an army beside a battle lends to it (campaign.ts, moveArmy). */
  lend: 0.3,
  /** Seasons an army waits before the way for a second to come. */
  wait: 5,
  /** How far, in lands of its own people, a second army is sent for. */
  far: 6,
};
/** An assault being massed for: where the first army holds, the land to be taken, and who was sent for. */
export interface Massing { at: number; gate: number; since: number; by: number; with: number; /** The turn the second came up. */ joined?: number }
declare module './campaign' {
  interface Campaign { /** Each computer-led people's assault being massed for (rivalmass.ts). */ massing?: Record<string, Massing> }
}
/** An order to an army from `massOrder`: hold where it stands. */
export const HOLD = -2;

/** What a people's other armies beside a land would lend an assault on it. */
export function lent(c: Campaign, f: number, to: number, skip = -1): number {
  const adj = c.territories[to]?.adj ?? [];
  return c.armies.filter((a) => a.owner === f && a.id !== skip && a.at !== to && adj.includes(a.at)).reduce((n, a) => n + armyStrength(a) * MASS.lend, 0);
}
/** How many lands of its own people an army is from a land of theirs, and its first step there: null if there is no way within `MASS.far`. */
export function wayTo(c: Campaign, f: number, from: number, to: number): { steps: number; first: number } | null {
  if (from === to) return { steps: 0, first: -1 };
  const prev = new Map<number, number>([[from, -1]]), depth = new Map<number, number>([[from, 0]]), queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (depth.get(cur)! >= MASS.far) continue;
    for (const n of c.territories[cur].adj) {
      if (prev.has(n) || c.territories[n].owner !== f) continue;
      prev.set(n, cur); depth.set(n, depth.get(cur)! + 1);
      if (n === to) { let s = n; while (prev.get(s) !== from) s = prev.get(s)!; return { steps: depth.get(n)!, first: s }; }
      queue.push(n);
    }
  }
  return null;
}
/** The army a people would send for: the nearest by its own lands, the stronger of two as near, not the garrison of a threatened town. */
export function secondFor(c: Campaign, f: number, first: Army): Army | undefined {
  return c.armies.filter((a) => a.owner === f && a.id !== first.id && c.territories[a.at].owner === f && !threatened(c, a.at))
    .map((a) => ({ a, way: wayTo(c, f, a.at, first.at) })).filter((x) => x.way && x.way.steps > 0)
    .sort((p, q) => p.way!.steps - q.way!.steps || armyStrength(q.a) - armyStrength(p.a) || p.a.id - q.a.id)[0]?.a;
}
/** The massing as it stands, if its two armies and its ground still do: the first where it held, the second alive (or come up), the land still to be taken. */
export function massingOf(c: Campaign, f: number): Massing | undefined {
  const m = c.massing?.[f];
  if (!m) return undefined;
  const first = c.armies.find((a) => a.id === m.by && a.owner === f);
  const there = !!first && first.at === m.at && c.territories[m.at].owner === f && c.territories[m.gate].owner !== f;
  const second = m.joined !== undefined || c.armies.some((a) => a.id === m.with && a.owner === f);
  if (!there || !second) { delete c.massing![f]; return undefined; }
  return m;
}
/**
 * What an army with nothing it dares does about the massing. The first army, standing before the way to the aim,
 * sends for a second and holds (`HOLD`); the second gets its next land toward the first, or `HOLD` once it stands
 * beside the land to be taken and the two would not make one army. -1: nothing to do with it. When the wait
 * runs out, or the second has come and still nothing is dared, the aim is given up.
 */
export function massOrder(c: Campaign, f: number, army: Army): number {
  const m = massingOf(c, f);
  if (m && army.id === m.by) {
    if (m.joined !== undefined ? c.turn > m.joined : c.turn - m.since > MASS.wait) { delete c.massing![f]; giveUp(c, f); return -1; }
    return HOLD;
  }
  if (m && army.id === m.with && m.joined === undefined) {
    const first = c.armies.find((a) => a.id === m.by)!;
    const beside = c.territories[m.gate].adj.includes(army.at) && c.territories[army.at].owner === f;
    const one = armySize(first) + armySize(army) <= MAX_ARMY;
    if (beside && (!one || army.at === m.at)) { m.joined = c.turn; return HOLD; }
    const way = wayTo(c, f, army.at, m.at);
    if (!way) { delete c.massing![f]; return -1; }
    if (way.steps === 1) m.joined = c.turn; // it comes up this season
    return way.first;
  }
  if (m) return -1;
  // No massing yet: an army before the way to the aim, with a second to send for, begins one.
  const gate = gatesOf(c, f, army.at)[0];
  if (gate === undefined || c.territories[army.at].owner !== f) return -1;
  const second = secondFor(c, f, army);
  if (!second) return -1;
  (c.massing ??= {})[f] = { at: army.at, gate, since: c.turn, by: army.id, with: second.id };
  return HOLD;
}
