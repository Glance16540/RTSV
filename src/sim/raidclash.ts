// A raid fought out a round at a time (docs/DESIGN.md audit: "against a band a town's defence is still a sum").
//
// Today a band's strike sets its force against the sum of what the town has (threats.ts `defenceOf`) and reads the
// outcome off two lines. This fights the same weights with the map's own clash (mapbattle.ts), as an army's battle
// is fought:
//   - the band is a force of companies, foot and bows in RAID.bows' share, worth its force of the day;
//   - the town is its works (its men on the walls, Fortress and barracks, towers and walls, the capital's guard)
//     with the companies of the army standing in it behind them; it stands longer walled, and by its people's
//     heart;
//   - the band breaks, or draws off with neither broken: the town held, and the band is the weaker by what it
//     lost;
//   - the town breaks: the band is in. Where breaking it cost the band little (RAID.easily of its own weight or
//     less) they have the run of it and it is taken; where they had to fight for it, it is raided.
// It comes out with how it went (rounds, who broke), what the band lost of its strength, how hard the town was
// pressed, and what the garrison's companies lost.
//
// STAGE ONE: nothing calls this to decide a strike yet. The health report sets it beside the sum for every strike
// (`raidForeseen`), to see how the two agree before anything is switched. Whether a garrison truly loses the
// companies this says it lost is the owner's to decide: `garrisonLost` is given either way, and a caller may drop it.
//
// It reads a strike's own figures (plain data) and mapbattle.ts's clash; it changes nothing.
import type { Force, Outcome } from './mapbattle';
import { CLASH, clash, heartOf } from './mapbattle';

export const RAID = {
  /** Of a band's strength, the share that fights as bows; the rest on foot (as bandfight.ts lays a band out on a field). */
  bows: 0.35,
  /** What a band's force of the day is worth as weight in a clash, against a town's defence as the sum has it. (Even weights break the attacker, where the sum lets a town hold at 0.82 of the force: this starts the two near each other.) */
  press: 0.82,
  /** A band that breaks a town having lost no more than this share of its own weight has taken it, not only raided it. */
  easily: 0.16,
};

/** What a town has, as the sum has it (threats.ts `Defence`), read here as plain data. */
export interface TownStand { men: number; works: number; walls: number; army: number; guard: number; spirit: number; total: number }
export type RaidOutcome = 'held' | 'raided' | 'taken';
export interface RaidFight {
  outcome: RaidOutcome;
  /** How it went: rounds fought, and who broke (neither: the band drew off). */
  rounds: number; broke: Outcome['broke'];
  /** Points of its strength the band lost. */
  bandLost: number;
  /** How hard the town was pressed: the share of its weight lost, and of its works beaten down, 0 to 1. */
  pressed: number; works: number;
  /** Companies the army standing in the town lost, by kind. */
  garrisonLost: Record<string, number>;
}

/** The two sides of a raid. `force`: the band's of the day; `garrison`: the companies of the holder's army standing in the town, if any; `virtue`: the town's own standing. */
export function raidForces(strength: number, force: number, stand: TownStand, garrison: Record<string, number> = {}, virtue = 0): { a: Force; d: Force } {
  const n = Math.max(1, Math.round(strength)), bows = Math.min(n - 1, Math.round(n * RAID.bows));
  const a: Force = { units: { infantry: n - bows, ...(bows ? { archers: bows } : {}) }, weight: Math.max(0, force) * RAID.press };
  const has = Object.values(garrison).some((v) => v > 0);
  const parts = stand.men + stand.works + stand.walls + stand.army + stand.guard;
  const d: Force = {
    units: has ? garrison : {},
    weight: Math.max(0, stand.total),
    own: has && parts > 0 ? stand.total * (stand.army / parts) : 0, // the army's share of the sum; the rest is the place and its people
    heart: heartOf(virtue),
    walled: stand.works > 0 || stand.walls > 0,
  };
  return { a, d };
}

/** Read a clash as a raid. */
export function raidOf(out: Outcome, strength: number): RaidFight {
  const outcome: RaidOutcome = out.broke === 'defender' ? (out.a.share <= RAID.easily ? 'taken' : 'raided') : 'held';
  const lost = Math.round(strength * out.a.share);
  return {
    outcome, rounds: out.rounds, broke: out.broke,
    bandLost: out.broke === 'attacker' ? Math.max(1, lost) : lost,
    pressed: out.d.share, works: out.d.works,
    garrisonLost: { ...out.d.lost },
  };
}

/** A raid fought: `luckA`, `luckD` are the day's for each side, each 0 to 1 (0.5 an even day). */
export function raidClash(strength: number, force: number, stand: TownStand, garrison: Record<string, number> = {}, virtue = 0, luckA = 0.5, luckD = 0.5): RaidFight {
  const { a, d } = raidForces(strength, force, stand, garrison, virtue);
  const day = (roll: number): number => 1 - CLASH.day + 2 * CLASH.day * Math.max(0, Math.min(1, roll));
  return raidOf(clash(a, d, day(luckA), day(luckD)), strength);
}

/**
 * What a strike already on record would have come to fought out, on an even day (its force already has the band's
 * luck in it). The garrison's kinds are not on the record, so its companies are taken as foot, as many as its strength.
 */
export function raidForeseen(r: { force: number; defence: TownStand }, virtue = 0): RaidFight {
  const army = Math.round(r.defence.army);
  return raidClash(r.force, r.force, r.defence, army > 0 ? { infantry: army } : {}, virtue);
}
