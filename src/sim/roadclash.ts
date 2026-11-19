// A band meets soldiers on the road, fought out (docs/DESIGN.md, "A town defends itself": "a strike on a road is still an
// escort or nothing").
//
// A strike on a town is a fight (raidclash.ts). On the road it was still a comparison of two numbers: an escort as strong
// as the band saw it off and one a point weaker did nothing; an army going after a band, or fallen on by one, won if its
// strength on the day was the greater. This is the same clash as every other battle on the map (mapbattle.ts), for the
// four places a band meets soldiers away from a town's walls:
//   - an army of a people goes out against a band, or a band falls on an army on the march (bandfight.ts);
//   - highwaymen or pirates stop a convoy or a caravan that has an army of its people on its road (convoys.ts);
//   - a camp falls on a caravan whose road crosses the land it stands on (caravans.ts, bandcaravan.ts);
//   - highwaymen strike at a road's end where an army stands (threats.ts).
// The band is what it is in a raid: companies on foot and with bows, worth its force of the day (ROAD.press of it). The
// soldiers are their own companies at the strength the map gives them there (the ground and the weather are in that
// strength already, campaignbase.ts armyStrength), with their veterans, their leader and their people's heart. There are
// no walls. Either side may break, or neither.
//
// `roadClash` fights it and says who broke, what each lost, and what the band would come away with if it won (`time`
// and `hands`, as raidclash.ts `spoilsOf` reads a raid). It is plain data: who calls it decides what follows.
//
// Stage one (this): it decides nothing. Each of the four places fights its meeting this way beside the rule it goes by
// and tallies whether the two agree (`roadTally`), for the health report.
import type { Army, Campaign } from './campaign';
import { armyStrength, rankWith, virtueOf } from './campaignbase';
import { CLASH, clash, heartOf } from './mapbattle';
import type { Force } from './mapbattle';
import { RAID, spoilsOf } from './raidclash';

declare module './campaign' {
  interface Campaign {
    /** Stage one of the road fight: how each meeting went by its own rule and how the clash would have had it (roadclash.ts). Report only. */
    roadTally?: Record<string, { n: number; ruleBand: number; clashBand: number; agree: number; neither: number }>;
  }
}

export const ROAD = {
  /** What a band's force of the day is worth as weight against soldiers in the open. (Against a town it is RAID.press, 0.82: there is no wall here to make up for.) */
  press: 1,
  /** Of what the clash says a band lost, the share its strength is the weaker by (as RAID.rally): most who run find the camp again. */
  rally: 0.3,
};

/** The soldiers a band meets: their companies, what they are worth there, and what makes them stand. */
export interface Soldiers { units: Record<string, number>; strength: number; vet?: number; led?: boolean; rank?: number; virtue?: number }
/** How a meeting on the road went. */
export interface RoadFight {
  /** Who broke: the band, the soldiers, or neither (they drew off). */
  broke: 'band' | 'soldiers' | 'neither';
  rounds: number;
  /** Points of its strength the band lost; the share of its weight the fight cost it. */
  bandLost: number; cost: number;
  /** Companies the soldiers lost, by kind; the share of their strength lost in the fight and the rout. */
  lost: Record<string, number>; body: number;
  /** If the band won: how much of the day it had the road, and the hands it has left to carry (raidclash.ts spoilsOf). */
  time: number; hands: number;
}

/** An army as the soldiers a band meets: its companies, what the map makes it worth where it stands (times `scale`, for a day's luck or an army caught out), its veterans, leader and people's heart. */
export const soldiersOf = (c: Campaign, a: Army, scale = 1): Soldiers => ({ units: a.units, strength: armyStrength(a, c) * scale, vet: a.vet, led: a.hero, rank: rankWith(c, a), virtue: virtueOf(c, a.owner) });

/** The two sides: the band first. `force`: the band's of the day. */
export function roadForces(strength: number, force: number, s: Soldiers): { a: Force; d: Force } {
  const n = Math.max(1, Math.round(strength)), bows = Math.min(n - 1, Math.round(n * RAID.bows));
  const a: Force = { units: { infantry: n - bows, ...(bows ? { archers: bows } : {}) }, weight: Math.max(0, force) * ROAD.press };
  const d: Force = { units: s.units, weight: Math.max(0, s.strength), vet: s.vet, led: s.led, rank: s.rank, heart: heartOf(s.virtue ?? 0) };
  return { a, d };
}

/** A band and soldiers meet on the road: `luckA`, `luckD` the day's for each, 0 to 1 (0.5 an even day). */
export function roadClash(strength: number, force: number, s: Soldiers, luckA = 0.5, luckD = 0.5): RoadFight {
  const { a, d } = roadForces(strength, force, s);
  const day = (roll: number): number => 1 - CLASH.day + 2 * CLASH.day * Math.max(0, Math.min(1, roll));
  const out = clash(a, d, day(luckA), day(luckD));
  const broke = out.broke === 'attacker' ? 'band' : out.broke === 'defender' ? 'soldiers' : 'neither';
  const lost = Math.round(strength * out.a.share * ROAD.rally);
  return {
    broke, rounds: out.rounds,
    bandLost: broke === 'band' ? Math.max(1, lost) : lost, cost: out.a.share,
    lost: { ...out.d.lost }, body: out.d.body ?? out.d.share,
    ...spoilsOf({ rounds: out.rounds, cost: out.a.share }),
  };
}

/** Stage one: note how a meeting went by its own rule (`ruleBand`: the band had the better of it) beside the clash. */
export function roadTally(c: Campaign, kind: string, ruleBand: boolean, f: RoadFight): void {
  const t = ((c.roadTally ??= {})[kind] ??= { n: 0, ruleBand: 0, clashBand: 0, agree: 0, neither: 0 });
  const clashBand = f.broke === 'soldiers';
  t.n++; if (ruleBand) t.ruleBand++; if (clashBand) t.clashBand++; if (f.broke === 'neither') t.neither++;
  if (ruleBand === clashBand) t.agree++;
}

/**
 * Stage one, for a convoy or a caravan met on its road: where an army of its people stands on the road, how the rule
 * went (an escort as strong as the band sees it off) beside the clash of that army with the band. Nothing where there is
 * no escort: then there is nobody to fight.
 */
export function escortTally(c: Campaign, kind: string, band: { strength: number }, owner: number, road: number[], escort: number): void {
  if (escort <= 0) return;
  const a = c.armies.filter((y) => y.owner === owner && road.includes(y.at)).sort((x, y) => armyStrength(y) - armyStrength(x) || x.id - y.id)[0];
  if (a) roadTally(c, kind, escort < band.strength, roadClash(band.strength, band.strength, soldiersOf(c, a)));
}
