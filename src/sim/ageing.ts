// A person ages only on the map, a season at a time (docs/DESIGN.md, "Time").
//
// Each town keeps the age of every one of its people on its record (`Folk.ages`, in seasons): its men, its women
// (the old among them, who are 60 and more) and its children. A battle or a visit loads the same people at the same
// ages and writes back the ages it finds; nobody grows older there and nobody dies of age there (birthonly.ts stops
// the clock in a campaign town). On the map, once a season (seasonfolk.ts):
//
//  - every child is a season older, and at fifteen years steps out as a man or a woman;
//  - every grown person is a season older, and is old at sixty;
//  - the old die over the years after: a small chance each season at sixty, larger every year past it.
//
// The record is coarse in one way: the counts (`men`, `women`, `elders`, `children`) are what the rest of the game
// reads and changes, and the ages follow them. Whatever changes a count without an age (the toll of a battle
// settled from the map, an older save) is made good the next time the ages are read, with ages drawn from the
// campaign's seed for anyone added and anyone taken away chosen the same way.
import type { Campaign } from './campaign';
import type { Folk } from './township';
import { ELDER_AT } from './data';

/** Seasons in a year; the years a child is grown at and a grown person is old at. */
export const SEASONS_A_YEAR = 4;
export const GROWN_YEARS = 15;
export const OLD_YEARS = 60;
export const GROWN_SEASON = GROWN_YEARS * SEASONS_A_YEAR;
export const OLD_SEASON = OLD_YEARS * SEASONS_A_YEAR;
/** The chance each season that an old person dies: DEATH_AT_60 at sixty, and DEATH_A_YEAR more for every year past it. */
export const DEATH_AT_60 = 0.01;
export const DEATH_A_YEAR = 0.005;
/** Nobody on the record is older than this. */
export const LAST_SEASON = 100 * SEASONS_A_YEAR;

/** The ages on a town's record, in seasons: grown men and women (the old among them), and children. */
export interface Ages { m: number[]; f: number[]; k: number[] }

const hash = (a: number, b: number, k: number): number => {
  let h = Math.imul((a | 0) ^ 0x2545f491, 0x85ebca6b) ^ Math.imul(b + 0x6c8e9cf5, 0xc2b2ae35) ^ Math.imul(k + 7, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13; h = Math.imul(h, 0x297a2d39); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/**
 * A person in a battle has an age in seconds of adult life and a span of life in seconds; on the record, years.
 * The two are tied so that the moment a battle counts someone old (`ELDER_AT` of their span) is sixty years.
 */
export const yearsOf = (age: number, lifespan: number): number => GROWN_YEARS + ((OLD_YEARS - GROWN_YEARS) * age) / (ELDER_AT * lifespan);
export const ageFor = (years: number, lifespan: number): number => Math.max(1, ((years - GROWN_YEARS) / (OLD_YEARS - GROWN_YEARS)) * ELDER_AT * lifespan);
/** A child's age in seasons from how far it is from coming of age in a battle (`left` of `grow` seconds), and back. */
export const childSeasons = (left: number, grow: number): number => Math.max(0, Math.min(GROWN_SEASON - 1, Math.round(GROWN_SEASON * (1 - left / grow))));
// A child on the record at 59 seasons has under a second left in a battle's measure: kept exactly (above nothing),
// so that a visit hands back the same age and a child visited every season still comes of age.
export const leftFor = (seasons: number, grow: number): number => Math.max(grow / (4 * GROWN_SEASON), grow * (1 - seasons / GROWN_SEASON));

const clean = (a: unknown, lo: number, hi: number): number[] => (Array.isArray(a) ? a : []).filter((x) => Number.isFinite(x)).map((x) => Math.max(lo, Math.min(hi, Math.round(Number(x))))).slice(0, 200);
/** Make safe a record of ages handed back from a battle. Nothing if it is not one. */
export function cleanAges(x: unknown): Ages | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const a = x as Partial<Ages>;
  return { m: clean(a.m, GROWN_SEASON, LAST_SEASON), f: clean(a.f, GROWN_SEASON, LAST_SEASON), k: clean(a.k, 0, GROWN_SEASON - 1) };
}

/**
 * The ages on a town's record, made to agree with its counts: so many men and women under sixty, so many old,
 * so many children. Anyone missing is added at an age drawn from the seed, anyone over is taken away.
 */
export function agesOf(c: Campaign, tid: number, f: Folk): Ages {
  const a = cleanAges(f.ages) ?? { m: [], f: [], k: [] };
  const salt = c.seed * 7919 + tid * 104729 + c.turn;
  let n = 0;
  const draw = (lo: number, hi: number): number => lo + Math.floor(hash(salt, n++, 1) * (hi - lo + 1));
  const fit = (list: number[], want: number, lo: number, hi: number): number[] => {
    const out = list.slice();
    while (out.length > want) out.splice(Math.floor(hash(salt, n++, 2) * out.length), 1);
    while (out.length < want) out.push(draw(lo, hi));
    return out;
  };
  const young = (l: number[]) => l.filter((s) => s < OLD_SEASON), old = (l: number[]) => l.filter((s) => s >= OLD_SEASON);
  const men = fit(young(a.m), f.men, GROWN_SEASON, OLD_SEASON - 1), women = fit(young(a.f), f.women, GROWN_SEASON, OLD_SEASON - 1);
  let oldM = old(a.m), oldF = old(a.f);
  while (oldM.length + oldF.length > f.elders) { if (oldM.length >= oldF.length) oldM = fit(oldM, oldM.length - 1, 0, 0); else oldF = fit(oldF, oldF.length - 1, 0, 0); }
  while (oldM.length + oldF.length < f.elders) { if (oldM.length <= oldF.length) oldM.push(draw(OLD_SEASON, OLD_SEASON + 39)); else oldF.push(draw(OLD_SEASON, OLD_SEASON + 39)); }
  const kids = fit(a.k, f.children, 0, GROWN_SEASON - 1);
  const out = { m: [...men, ...oldM], f: [...women, ...oldF], k: kids };
  f.ages = out;
  return out;
}

/** Set the counts of a town from the ages on its record. */
export function countFrom(f: Folk, a: Ages): void {
  f.ages = a;
  f.men = a.m.filter((s) => s < OLD_SEASON).length;
  f.women = a.f.filter((s) => s < OLD_SEASON).length;
  f.elders = a.m.length + a.f.length - f.men - f.women;
  f.children = a.k.length;
}

/** The chance an old person of this many seasons dies in a season. */
export const deathChance = (seasons: number): number => (seasons < OLD_SEASON ? 0 : Math.min(1, DEATH_AT_60 + DEATH_A_YEAR * (seasons - OLD_SEASON) / SEASONS_A_YEAR));

/** A season passes for the people of a town: children grow toward fifteen, the grown toward sixty, the old die. */
export function ageTown(c: Campaign, tid: number, f: Folk, max = 60): { grew: number; aged: number; died: number } {
  const a = agesOf(c, tid, f), salt = c.seed * 31 + tid * 977 + c.turn * 13;
  let grew = 0, aged = 0, died = 0, n = 0;
  const older = (list: number[]): number[] => {
    const out: number[] = [];
    for (const s of list) {
      const next = s + 1;
      if (hash(salt, n++, 3) < deathChance(next) || next > LAST_SEASON) { died++; continue; }
      if (s < OLD_SEASON && next >= OLD_SEASON) aged++;
      out.push(next);
    }
    return out;
  };
  const m = older(a.m), w = older(a.f), k: number[] = [];
  for (const s of a.k) {
    if (s + 1 < GROWN_SEASON) { k.push(s + 1); continue; }
    // Of age: a son or a daughter, as the seed has it, where the town has room for one more of that kind.
    const boy = hash(salt, n++, 4) < 0.5;
    const youngM = m.filter((x) => x < OLD_SEASON).length, youngF = w.filter((x) => x < OLD_SEASON).length;
    if ((boy && youngM < max) || youngF >= max) m.push(GROWN_SEASON); else w.push(GROWN_SEASON);
    grew++;
  }
  countFrom(f, { m, f: w, k });
  return { grew, aged, died };
}
