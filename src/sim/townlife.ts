// A town's own life moves its faith (docs/DESIGN.md, the owner's word, 17 November 2026: "Hunger, raids and plague draw
// a town toward decadence; a long peace with full stores draws it toward piety; so one town of a nation can stand apart
// from the rest by what it has lived through").
//
// Each season, beside its Church, Tavern and holy place (townfaith.ts `townDrift`), a town of a nation is moved by what
// it lives through:
//   - hungry (its granary empty, larder.ts): LIFE.hunger toward decadence;
//   - plague in it: LIFE.plague toward decadence;
//   - a long peace with full stores: after LIFE.calm seasons running with no hunger, plague, fire, raid, siege or rising
//     in it, and with LIFE.full seasons of its own eating in store, LIFE.peace toward piety;
//   - never, by its life alone, into the Depraved or the Virtuous creed (LIFE.floor, LIFE.ceiling).
// A raid moves a town already, by how it went (threats.ts: held off, it is the better for it; sacked, it loses heart),
// so here a raid only breaks the peace.
//
// At 192 campaigns in each course (true wilderness in both builds), these figures kept the rows in band but one:
// campaigns ruined or undecided, 11% in the answered course (band under 10%; 7.8% without). Stronger (2 a season for
// hunger and plague, or peace after 8 seasons) pushed ruin, a farmed town's hunger or the churched nations out of band.
// None of them widened the gap between a nation's towns (47.5 to 49.2% of nation-seasons in band, against 48.2 to 48.8%).
//
// `lifeSeason` counts each town's seasons of peace (`Territory.calm`), once a season, before the towns move;
// `lifeDrift` is what its life adds to the town's move this season, read without changing anything.
import type { Campaign } from './campaign';
import { folkOf } from './township';
import { needOf } from './larder';

declare module './campaign' {
  interface Territory {
    /** Seasons running with no hunger, plague, fire, raid, siege or rising in this town (townlife.ts). */
    calm?: number;
  }
}

export const LIFE = {
  /** Toward decadence, a season hungry. */
  hunger: 1,
  /** Toward decadence, a season with plague in it. */
  plague: 1,
  /** Toward piety, a season of long peace with full stores. */
  peace: 1,
  /** Seasons of peace running before it counts as long. */
  calm: 24,
  /** Seasons of its own eating in store for its stores to count as full. */
  full: 3,
  /**
   * How far its life alone carries a town: never into the Depraved (-70) nor the Virtuous (70) creed (creed.ts). A
   * hungry town slid toward decadence, and a decadent town's harvest fails the oftener (wrath.ts): unbounded, the two fed
   * each other.
   */
  floor: -69, ceiling: 69,
};

/** What breaks a town's peace, of what befell it last season (campaign.ts EventKind). */
const TROUBLE = ['famine', 'plague', 'blaze', 'raid', 'carried', 'heldoff', 'taken', 'overrun', 'revolt', 'unrest'];

const plagued = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.at === tid && e.kind === 'plague' && e.until >= c.turn - 1);
const troubled = (c: Campaign, tid: number): boolean =>
  !!folkOf(c, tid).hungry || (c.events ?? []).some((e) => e.at === tid && TROUBLE.includes(e.kind) && e.until >= c.turn - 1);

/** Once a season, before the towns move: each held town's seasons of peace, counted on or begun again. */
export function lifeSeason(c: Campaign): void {
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde || !t.folk) { delete t.calm; continue; }
    t.calm = troubled(c, t.id) ? 0 : (t.calm ?? 0) + 1;
  }
}

/** What a town's own life adds to its move this season: below 0 toward decadence, above 0 toward piety. */
export function lifeDrift(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde || !t.folk) return 0;
  const at = t.virtue ?? 0;
  let by = 0;
  if (t.folk.hungry) by -= LIFE.hunger;
  if (plagued(c, tid)) by -= LIFE.plague;
  if (by) return Math.max(by, Math.min(0, LIFE.floor - at)); // not past the edge of decadence
  if ((t.calm ?? 0) >= LIFE.calm && t.folk.stores.food >= LIFE.full * needOf(c, tid)) return Math.max(0, Math.min(LIFE.peace, LIFE.ceiling - at));
  return 0;
}
