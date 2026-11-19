// Grief in a town's season of work on the map (docs/DESIGN.md, "Grief": a home that loses its mother or its sons works
// more slowly for a time; the board's line "nothing there is worked more slowly").
//
// In a town a grieving house's people work GRIEF_SLOW more slowly, less in a holy or decadent town (grief.ts). On the
// map the same is read of the town's homes: a home grieves while its loss is fresh, within GRIEF_SEASONS of it, and the
// town is grieving still (its grief, which an Infirmary and the leader there shorten, drift.ts). A home is one that lost
// a man or a son with the army (warhouse.ts's fallen) or a known person of its own (a mother, a veteran, one taken by
// plague: their `lost`). The grieving homes' share of the town's homes (its women, one to a home) is worked that much
// more slowly: `griefWork` is the share of the season's yield the town brings in, read once by harvest.ts.
import type { Campaign } from './campaign';
import { folkOf } from './township';
import { GRIEF_SEASONS, GRIEF_SLOW, griefWeight } from './grief';
import { housesOf } from './warhouse';
import { faithAt } from './townfaith';

/** The homes of a town grieving now, by family (or by name, for one of no known house). */
export function grievingHomes(c: Campaign, tid: number): string[] {
  const f = folkOf(c, tid);
  if (!((f.grief ?? 0) > 0)) return [];
  const fresh = (turn: number): boolean => c.turn - turn < GRIEF_SEASONS;
  const homes = new Set<string>();
  for (const h of housesOf(f)) if ((h.fallen ?? []).some((m) => fresh(m.turn))) homes.add(h.family);
  for (const n of f.notables) if (n.lost && fresh(n.lost.turn)) homes.add(n.family ?? n.name);
  return [...homes];
}

/** The share of its season's work a town brings in for its grieving homes: 1 with none, at least 1 - GRIEF_SLOW. */
export function griefWork(c: Campaign, tid: number): number {
  const sad = grievingHomes(c, tid).length;
  if (!sad) return 1;
  const share = Math.min(1, sad / Math.max(1, folkOf(c, tid).women));
  return 1 - GRIEF_SLOW * griefWeight(faithAt(c, tid)) * share;
}
