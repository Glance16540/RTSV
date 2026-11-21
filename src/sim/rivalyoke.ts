// A rival rules a resentful town with its resentment in mind (docs/CLOSING.md, "Sooner settled where they are ruled well":
// rivals garrisoned a resentful town and learned Written Law, but did not build with its resentment in mind). A town
// taken eases its resentment the faster with Farmland (YOKE.farm) in it (conquered.ts). Each season a rival led by the
// computer, with supplies to spare, builds Farmland in its most resentful town that has none. One a season a people.
// Farmland only, no Church after it. Read at 384 campaigns in each course (seeds 1-384, and the answer course 385-768),
// on main at 67229de: with a Church for a devout people after the Farmland, a nation that builds churches stood 33.4 and
// 43.7 toward the holy end where 15 to 40 is wanted, and taken towns left ungarrisoned rose 14.8% where 15 to 35% is
// wanted. With Farmland only, 25.5 and 32.2, and 16.9% and 17.6%; undecided at 200 seasons 5.2% and 9.1% (4.2% and 5.7%
// with the Church). Farmland first had been chosen over a Church first, which left more rivals' lords content at twenty
// years than the 5 to 20% they should be (nobles.ts).
// Building is the hub's (campaign.ts canBuild, build): it lends them, so this imports nothing of it.
import type { Campaign } from './campaign';
import { siteCost } from './campaignbase';
import { YOKE } from './conquered';

export const RIVAL_YOKE = {
  /** Supplies a rival keeps in hand beyond the price before it builds for a resentful town. */
  spare: 4,
};

/** A rival's taken towns that still resent it enough to rise, the most resentful first. */
export const resentful = (c: Campaign, f: number): number[] => c.territories
  .filter((t) => t.owner === f && !t.horde && t.yoke && !t.yoke.settled && t.yoke.resent > YOKE.quiet)
  .sort((a, b) => b.yoke!.resent - a.yoke!.resent || a.id - b.id).map((t) => t.id);

/** What a rival would build for a resentful town: Farmland, if it lacks it. */
export function easeWith(c: Campaign, _f: number, tid: number): 'farm' | null {
  return c.territories[tid].buildings.includes('farm') ? null : 'farm';
}

/** One rival's season: Farmland raised in its most resentful town, if it can spare the price. Returns what was built where. */
export function rivalEasesYoke(c: Campaign, f: number, o: { canBuild: (c: Campaign, f: number, tid: number, site: string) => boolean; build: (c: Campaign, f: number, tid: number, site: string) => boolean }): { at: number; site: string } | null {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI || f === 0) return null;
  for (const tid of resentful(c, f)) {
    const site = easeWith(c, f, tid);
    if (!site || fac.supplies < siteCost(c.territories[tid], site, fac.civ) + RIVAL_YOKE.spare || !o.canBuild(c, f, tid, site)) continue;
    if (o.build(c, f, tid, site)) return { at: tid, site };
  }
  return null;
}
