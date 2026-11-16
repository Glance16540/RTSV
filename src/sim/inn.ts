// The Inn (docs/DESIGN.md, "Buildings and research that answer the systems": order and roads). An Inn on a road
// keeps convoys safer from highwaymen, and is where the studies of the road are taught (Paved Roads and Escorts:
// roads.ts, which also says what an Inn does for a convoy).
//
// On the map. An Inn is one of the buildings raised on a town's record (townworks.ts; data.ts `inn`, marked `onMap`):
// begun from the land's panel out of the town's own stores, finished by its governor. A town's governor begins one
// of his own accord when highwaymen sit on a road that ends at the town, and only out of plenty, as he buys a
// Watch House (watchhouse.ts): the town has its Farmland, wants for neither food nor a roof, and would still hold
// four times what it keeps by it in goods other than bread.
//
// In a town. It is a real building, raised by villagers like any other; what stands in the town is what the map keeps.
import type { Campaign } from './campaign';
import { BUILDINGS } from './data';
import { GOVERN, wantsOf } from './governor';
import { STORE_KINDS, folkOf } from './township';
import { begunAt, raiseWork } from './townworks';

export const INN = {
  /** A governor begins one only if, after paying, the town still holds this many times what it keeps by it, in goods other than its bread. */
  plenty: 4,
};

/** Has a town the means to spare for an Inn? Only out of plenty (see watchhouse.ts: goods spent are bread it cannot buy). */
function spare(c: Campaign, tid: number): boolean {
  const t = c.territories[tid], wants = wantsOf(c, tid), s = folkOf(c, tid).stores, cost = BUILDINGS.inn.cost;
  const goods = STORE_KINDS.reduce((n, k) => n + (k === 'food' ? 0 : s[k] - (cost[k] ?? 0)), 0);
  return t.buildings.includes('farm') && !wants.food && !wants.roof && !wants.wall && goods >= INN.plenty * GOVERN.floor;
}
/**
 * The governors' season: a town at either end of a road where highwaymen sit, and that has no Inn begun, begins one
 * out of its own stores if it can do so out of plenty. Returns the towns that did.
 */
export function governInns(c: Campaign): number[] {
  const begun: number[] = [];
  for (const b of c.bands ?? []) {
    if (b.kind !== 'highwaymen' || b.to === undefined) continue;
    for (const tid of [b.at, b.to]) {
      const t = c.territories[tid];
      if (!t || t.owner < 0 || t.horde || begun.includes(tid) || begunAt(c, tid, 'inn') || !spare(c, tid)) continue;
      const log = c.log.length;
      if (raiseWork(c, t.owner, tid, 'inn') !== '') continue;
      c.log.length = log; // said in the governor's own words
      begun.push(tid);
      if (t.owner === 0) c.log.push(`The governor of ${t.name} has begun an Inn: there are highwaymen on its road.`);
    }
  }
  return begun;
}
