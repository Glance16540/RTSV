// A rival rules a resentful town with its resentment in mind (docs/CLOSING.md, "Sooner settled where they are ruled well":
// rivals garrisoned a resentful town and learned Written Law, but did not build a Church or Farmland with its resentment
// in mind). A town taken eases its resentment the faster with a Church (YOKE.church) and Farmland (YOKE.farm) in it
// (conquered.ts). Each season a rival led by the computer, with supplies to spare, builds in its most resentful town
// that has not settled Farmland, and then, for a devout people only (temper.ts, as its own houses of faith are chosen
// in campaign.ts: a people builds what it believes in), a Church. One a season a people.
// Farmland first, though a Church eases more: read at 384 campaigns in each course, a Church first left more of the
// rivals' lords content at twenty years than the 5 to 20% they should be (19.4 to 21.9% where 16 to 18.6% were, 19.0%
// with no building at all), a church in every resentful town being one more to call the people to and tend the sick
// from, which pleases pious and kindly lords (nobles.ts).
// Building is the hub's (campaign.ts canBuild, build): it lends them, so this imports nothing of it.
import type { Campaign } from './campaign';
import { siteCost } from './campaignbase';
import { LEANING } from './creed';
import { leaningWith } from './temper';
import { YOKE } from './conquered';

export const RIVAL_YOKE = {
  /** Supplies a rival keeps in hand beyond the price before it builds for a resentful town. */
  spare: 4,
};

/** A rival's taken towns that still resent it enough to rise, the most resentful first. */
export const resentful = (c: Campaign, f: number): number[] => c.territories
  .filter((t) => t.owner === f && !t.horde && t.yoke && !t.yoke.settled && t.yoke.resent > YOKE.quiet)
  .sort((a, b) => b.yoke!.resent - a.yoke!.resent || a.id - b.id).map((t) => t.id);

/** What a rival would build for a resentful town: what eases its resentment most of what it lacks. */
export function easeWith(c: Campaign, f: number, tid: number): 'church' | 'farm' | null {
  const t = c.territories[tid], civ = c.factions[f].civ, devout = leaningWith(civ, LEANING[civ] ?? 0.5) >= 0.6; // as its own houses of faith are chosen (campaign.ts)
  const order: ('church' | 'farm')[] = devout ? ['farm', 'church'] : ['farm'];
  return order.find((s) => !t.buildings.includes(s)) ?? null;
}

/** One rival's season: a Church or Farmland raised in its most resentful town, if it can spare the price. Returns what was built where. */
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
