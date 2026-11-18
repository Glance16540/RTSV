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
// threats.ts `strike` decides a strike on a town by this (a strike on a road is still an escort or nothing). An army
// standing in the town loses the companies this says it lost, each a man of his town (the owner's word, 17 November
// 2026: "a garrison in a raided town loses companies when pressed"). The health report still sets it beside the old
// sum for every strike (`raidForeseen` gives the clash from a strike's own record).
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
  /** The same line where the town's men are turned out as bands (stage three): far lower, since less of the town is the place that strikes back and a band breaks it more cheaply. Read off 192 campaigns, report only: at 0.16 a third of strikes on towns would end in a taking (33.7%, against 17.6% as it is); at 0.04, 18.6%; at 0.035, 16.9%, and the whole row would read held off 38.4%, raided 47.4%, taken 14.2%. */
  easilyOut: 0.035,
  /** Of what a clash says a band lost, the share its strength is the weaker by: most of those who run find the camp again. Never less than one point where it broke. */
  rally: 0.3,
  /** A town that held is blooded (a man of it dies, as a town was) where it lost this share of its weight or more in holding. */
  blooded: 0.3,
};

/** What a town has, as the sum has it (threats.ts `Defence`), read here as plain data. */
export interface TownStand { men: number; works: number; walls: number; army: number; guard: number; spirit: number; total: number }
export type RaidOutcome = 'held' | 'raided' | 'taken';
export interface RaidFight {
  outcome: RaidOutcome;
  /** How it went: rounds fought, and who broke (neither: the band drew off). */
  rounds: number; broke: Outcome['broke'];
  /** Points of its strength the band lost, and the share of its weight the fight cost it (what the line for a taking is read against). */
  bandLost: number; cost: number;
  /** How hard the town was pressed: the share of its weight lost, and of its works beaten down, 0 to 1. */
  pressed: number; works: number;
  /** Companies the army standing in the town lost, by kind. */
  garrisonLost: Record<string, number>;
}

/** The two sides of a raid. `force`: the band's of the day; `garrison`: the companies of the holder's army standing in the town, if any; `virtue`: the town's own standing. */
export function raidForces(strength: number, force: number, stand: TownStand, garrison: Record<string, number> = {}, virtue = 0, militia?: Militia): { a: Force; d: Force } {
  if (militia) return turnedOut(strength, force, stand, garrison, virtue, militia);
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

/** A town's own men as they turn out (militia.ts): so many bands on foot, worth so much in all before the town's spirit. */
export interface Militia { bands: number; worth: number }

/**
 * Stage three, the town as it turns out against a nation (mapbattle.ts forcesOf): its own men are bands on foot beside
 * the companies of any army there, and only its works, walls, towers and guard are the place itself, which strikes and
 * shelters. `stand` is still the sum's reading of the town; its `men` part is put aside for what the bands are worth, and
 * the town's spirit (the sum's total over its parts) is kept on everything.
 */
function turnedOut(strength: number, force: number, stand: TownStand, garrison: Record<string, number>, virtue: number, m: Militia): { a: Force; d: Force } {
  const n = Math.max(1, Math.round(strength)), bows = Math.min(n - 1, Math.round(n * RAID.bows));
  const a: Force = { units: { infantry: n - bows, ...(bows ? { archers: bows } : {}) }, weight: Math.max(0, force) * RAID.press };
  const parts = stand.men + stand.works + stand.walls + stand.army + stand.guard, spirit = parts > 0 ? stand.total / parts : 1;
  const worth = Math.max(0, m.worth), bands = worth > 0 ? Math.max(1, Math.round(m.bands)) : 0;
  const units: Record<string, number> = { ...garrison };
  if (bands) units.infantry = (units.infantry ?? 0) + bands;
  const d: Force = {
    units,
    weight: Math.max(0, (stand.works + stand.walls + stand.guard + stand.army + worth) * spirit),
    own: Math.max(0, (stand.army + worth) * spirit),
    heart: heartOf(virtue),
    walled: stand.works > 0 || stand.walls > 0,
  };
  return { a, d };
}

/** Read a clash as a raid. */
export function raidOf(out: Outcome, strength: number, line: number = RAID.easily): RaidFight {
  const outcome: RaidOutcome = out.broke === 'defender' ? (out.a.share <= line ? 'taken' : 'raided') : 'held';
  const lost = Math.round(strength * out.a.share * RAID.rally);
  return {
    outcome, rounds: out.rounds, broke: out.broke,
    bandLost: out.broke === 'attacker' ? Math.max(1, lost) : lost, cost: out.a.share,
    pressed: out.d.share, works: out.d.works,
    garrisonLost: { ...out.d.lost },
  };
}

/** A raid fought: `luckA`, `luckD` are the day's for each side, each 0 to 1 (0.5 an even day). */
export function raidClash(strength: number, force: number, stand: TownStand, garrison: Record<string, number> = {}, virtue = 0, luckA = 0.5, luckD = 0.5, militia?: Militia): RaidFight {
  const { a, d } = raidForces(strength, force, stand, garrison, virtue, militia);
  const day = (roll: number): number => 1 - CLASH.day + 2 * CLASH.day * Math.max(0, Math.min(1, roll));
  return raidOf(clash(a, d, day(luckA), day(luckD)), strength, militia ? RAID.easilyOut : RAID.easily);
}

/**
 * What a strike already on record would have come to fought out, on an even day (its force already has the band's
 * luck in it). The garrison's kinds are not on the record, so its companies are taken as foot, as many as its strength.
 */
export function raidForeseen(r: { force: number; defence: TownStand }, virtue = 0): RaidFight {
  const army = Math.round(r.defence.army);
  return raidClash(r.force, r.force, r.defence, army > 0 ? { infantry: army } : {}, virtue);
}
