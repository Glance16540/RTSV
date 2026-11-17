/**
 * A town is at work from its first second (docs/DESIGN.md, "A town left to itself"; docs/PLAYTEST.md 4.3, the part
 * left over: "the town's people stand idle on arrival until they are set to work").
 *
 * On the map a town's people work by shares every season: its last orders, or its governor's (governor.ts shareOf).
 * On the field they came to every visit and siege standing in a crowd by the hall with nothing to do. So as a sitting
 * begins the player's town is set to the same shares (`setToWork`): of its grown villagers so many to food, to wood,
 * to gold and to stone, each sent to the nearest of its kind within reach of the hall (as the computer sends its own:
 * ai.ts assignWorkers), and to another kind where there is none of its own, so that nobody stands idle while there is
 * work near. A side the computer plays is left alone: it sets its own people to work, or calls them in, by its own
 * rules.
 *
 * What they were set to is remembered on each (`Unit.setTo`), so that the town's orders written back when the player
 * leaves are the player's and not an echo of this (`workChanged`): if nobody has been put to a different kind of
 * work, the field reports no work at all, and the town keeps its last orders or its governor (givenorders.ts). The
 * moment the player moves one hand, the whole town is counted as it stands.
 * Nothing here is random.
 */
import type { ResType } from './data';
import type { Game, Unit } from './game';

declare module './game' {
  interface Unit { /** The work this villager was set to as the sitting began, by the town's shares (atwork.ts). */ setTo?: ResType }
}

export const ATWORK = {
  /** How far from the hall to look for each kind, as the computer does for its own. */
  reach: { food: 18, wood: 40, gold: 64, stone: 64 } as Record<ResType, number>,
  /** A node this near a villager is taken before the nearest to the hall, if it is not far from home. */
  beside: 10, home: 34,
};
const KINDS: ResType[] = ['food', 'wood', 'gold', 'stone'];
/** The villagers of a side who can be set to work: grown, free, with nothing to do. A man home on leave is walking to his door. */
const hands = (g: Game, owner: number): Unit[] =>
  g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead && !u.growT && !u.inside && !u.captive && !u.order && !u.onLeave && !(u as { drifted?: unknown }).drifted).sort((a, b) => a.id - b.id);

/** How many of `n` hands go to each kind by these shares: whole numbers that add to `n`, the largest remainders made up first. */
export function handsBy(shares: Partial<Record<ResType, number>> | undefined, n: number): Record<ResType, number> {
  const s = KINDS.map((k) => Math.max(0, Number(shares?.[k]) || 0)), sum = s.reduce((a, b) => a + b, 0);
  const out: Record<ResType, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  if (!(sum > 0) || n <= 0) return out;
  const exact = s.map((x) => (x / sum) * n);
  KINDS.forEach((k, i) => { out[k] = Math.floor(exact[i]); });
  const order = KINDS.map((k, i) => ({ k, r: exact[i] - Math.floor(exact[i]), i })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let left = n - KINDS.reduce((a, k) => a + out[k], 0), j = 0; left > 0; left--, j++) out[order[j % 4].k]++;
  return out;
}

/** Set a side's idle villagers to work by these shares, around its start. Returns how many were set to each kind. */
export function setToWork(g: Game, owner: number, shares: Partial<Record<ResType, number>> | undefined, st: { x: number; y: number }): Record<ResType, number> {
  const set: Record<ResType, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
  const free = hands(g, owner), want = handsBy(shares, free.length);
  const first = KINDS.slice().sort((a, b) => want[b] - want[a] || KINDS.indexOf(a) - KINDS.indexOf(b));
  const send = (v: Unit, res: ResType): boolean => {
    let t = g.findResourceNear(st.x, st.y, res, owner, ATWORK.reach[res]);
    if (!t) return false;
    const near = g.findResourceNear(v.x, v.y, res, owner, ATWORK.beside);
    if (near && Math.hypot(near.x - st.x, near.y - st.y) < ATWORK.home) t = near;
    g.cmdTarget(owner, [v.id], t.id);
    if (v.order?.t !== 'gather') return false;
    v.setTo = v.order.res; set[v.order.res]++;
    return true;
  };
  let i = 0;
  for (const res of KINDS) for (let k = 0; k < want[res] && i < free.length; k++, i++) {
    const v = free[i];
    if (!send(v, res)) for (const other of first) if (other !== res && send(v, other)) break; // none of its own kind near: the next most wanted
  }
  return set;
}

/** Has anybody been put to a kind of work the town was not set to as the sitting began? (Nobody was set: yes, as before.) */
export function workChanged(g: Game, owner: number): boolean {
  const all = g.units.filter((u) => u.owner === owner && u.type === 'villager' && !u.dead);
  if (!all.some((u) => u.setTo)) return true;
  return all.some((u) => u.order?.t === 'gather' && u.order.res !== u.setTo);
}
