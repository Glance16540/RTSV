// Widows, widowers and orphans on the map (docs/DESIGN.md, "People persist"; "Relationships").
//
// The map counts a town's men and women, not its marriages: a couple is any man and woman under a roof
// (seasonfolk.ts). But it does know, by name, some of those who lose a husband or a wife:
//
//   - A man who falls with an army as the husband of his house (warhouse.ts) leaves a widow. Where the town knows
//     his wife by name (a notable mother, township.ts), she is that widow; otherwise she is named from the seed.
//   - A notable mother who dies leaves her husband, named on her record, a widower.
//
// Each is kept on the town's record with the children of their house (counted as the town's children for each of
// its couples, at most four). They mourn MOURN seasons. After that, each season they may marry again (WED): within
// the town if it has a grown person of the other sex with nobody (more men than women, for a widow), or else in
// the nearest town of their people that has one, where they go as convoys carry people (convoys.ts), the youngest
// of the town's grown of that sex taking their place on its record. A widowed person the town no longer has room
// for on its record (its people of that sex fewer than those on record) has died; their house's children are
// orphans, taken into a named house of the town: one with men away or fallen (warhouse.ts), else a known home's,
// else one named from the seed. The children stay the town's: only the record of whose house keeps them moves.
//
// Plain data on the town's record (`Folk.widowed`, `Folk.orphans`). No child is harmed, moved or shown.
import { givenNames, houseNames, townPeople } from './peoplenames';
import type { Campaign } from './campaign';
import { agesOf, countFrom, OLD_SEASON } from './ageing';
import { folkOf, living } from './township';
import type { Folk } from './township';
import { housesOf } from './warhouse';
import { nearestTowns } from './orphans';

/** Someone who has lost a husband or a wife. `of`: who they lost. `since`: the turn. `kids`: their house's children. */
export interface Widowed { name: string; family: string; female: boolean; of: string; since: number; kids: number }
/** Children whose house is gone, and the house of the town that keeps them now. */
export interface Orphans { family: string; into: string; since: number; count: number }
declare module './township' {
  interface Folk {
    /** The widowed of the town (widowhood.ts). */
    widowed?: Widowed[];
    /** Children taken into another house of the town (widowhood.ts). */
    orphans?: Orphans[];
    /** The last turn this town's losses were read for widows and widowers. */
    widowSeen?: number;
  }
}

export const WIDOW = {
  /** Seasons of mourning before the widowed may marry again; the chance a season after; children of a house at most. */
  mourn: 4, wed: 0.2, kids: 4,
  /** The most widowed and orphaned households a town keeps on record. */
  most: 12,
};

const hash = (a: number, b: number, k: number): number => {
  let h = Math.imul((a | 0) ^ 0x5bd1e995, 0x85ebca6b) ^ Math.imul(b + 0x68e31da4, 0xc2b2ae35) ^ Math.imul(k + 3, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13; h = Math.imul(h, 0x297a2d39); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const pick = <T>(list: readonly T[], r: number): T => list[Math.floor(r * list.length) % list.length];
const say = (c: Campaign, owner: number, text: string): void => { if (owner === 0) c.log.push(text); };

/** The children of one of a town's houses, as the map counts them: its children for each of its couples. */
const houseKids = (f: Folk): number => Math.min(WIDOW.kids, Math.round(f.children / Math.max(1, Math.min(f.men, f.women))));
/** A grown person of the other sex with nobody: more men than women in the town for a widow, more women than men for a widower. */
const spare = (f: Folk, female: boolean): boolean => (female ? f.men > f.women : f.women > f.men);

/** Move one grown person of this sex from one town to another, the youngest of working age, ages and all. */
function moveOne(c: Campaign, from: number, to: number, female: boolean): boolean {
  const a = folkOf(c, from), b = folkOf(c, to), A = agesOf(c, from, a), B = agesOf(c, to, b);
  const list = female ? A.f : A.m, i = list.reduce((best, s, k) => (s < OLD_SEASON && (best < 0 || s < list[best]) ? k : best), -1);
  if (i < 0) return false;
  const [age] = list.splice(i, 1);
  countFrom(a, A);
  (female ? B.f : B.m).push(age);
  countFrom(b, B);
  return true;
}

/** A season for one town's widowed and orphans. */
export function widowsTown(c: Campaign, tid: number): void {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde) return;
  const f = folkOf(c, tid), seen = f.widowSeen ?? c.turn - 1, list = (f.widowed ??= []);
  f.widowSeen = c.turn;
  // Who has lost a husband or a wife since the town was last read.
  for (const h of housesOf(f)) for (const x of h.fallen ?? []) {
    if (x.as !== 'husband' || x.turn <= seen) continue;
    const wife = living(f).find((n) => n.kind === 'mother' && n.family === h.family);
    const name = wife?.name ?? pick(givenNames(townPeople(c, tid), 'f'), hash(c.seed, tid * 131 + x.turn, x.name.length));
    if (!list.some((w) => w.name === name && w.family === h.family)) list.push({ name, family: h.family, female: true, of: x.name, since: x.turn, kids: houseKids(f) });
  }
  for (const n of f.notables) {
    if (n.kind !== 'mother' || !n.lost || n.lost.turn <= seen || !n.husband) continue;
    if (!list.some((w) => w.name === n.husband && w.family === (n.family ?? ''))) list.push({ name: n.husband, family: n.family ?? '', female: false, of: n.name, since: n.lost.turn, kids: houseKids(f) });
  }
  // The widowed the town has no room for on its record have died: their children are taken into another house.
  for (const female of [true, false]) {
    const mine = list.filter((w) => w.female === female), room = (female ? f.women : f.men) + f.elders;
    for (const w of mine.slice(0, Math.max(0, mine.length - room))) {
      list.splice(list.indexOf(w), 1);
      if (w.kids > 0 && f.children > 0) {
        const others = [...housesOf(f).map((h) => h.family), ...living(f).filter((n) => n.family).map((n) => n.family!)].filter((x) => x && x !== w.family);
        const into = others.length ? pick(others, hash(c.seed, tid * 977 + c.turn, 7)) : pick(houseNames(townPeople(c, tid)), hash(c.seed, tid * 983 + c.turn, 9));
        (f.orphans ??= []).push({ family: w.family, into, since: c.turn, count: Math.min(w.kids, f.children) });
        say(c, t.owner, `The children of the house of ${w.family} in ${t.name}, ${w.female ? 'its widow' : 'its widower'} ${w.name} gone, are taken into the house of ${into}.`);
      }
    }
  }
  // The widowed who have mourned may marry again: in the town if it has someone for them, else in the nearest town of their people that has.
  for (const w of [...list]) {
    if (c.turn - w.since < WIDOW.mourn || hash(c.seed, tid * 389 + c.turn, w.name.length + w.since) >= WIDOW.wed) continue;
    if (spare(f, w.female)) { list.splice(list.indexOf(w), 1); say(c, t.owner, `${w.name} of the house of ${w.family}, ${w.female ? 'widowed' : 'a widower'}, has married again in ${t.name}.`); continue; }
    const there = nearestTowns(c, t.owner, tid).find((id) => spare(folkOf(c, id), w.female));
    if (there === undefined || !moveOne(c, tid, there, w.female)) continue;
    list.splice(list.indexOf(w), 1);
    say(c, t.owner, `${w.name} of the house of ${w.family}, ${w.female ? 'widowed' : 'a widower'}, has gone from ${t.name} to marry in ${c.territories[there].name}.`);
  }
  if (list.length > WIDOW.most) list.splice(0, list.length - WIDOW.most);
  if (!list.length) delete f.widowed;
  if (f.orphans && f.orphans.length > WIDOW.most) f.orphans.splice(0, f.orphans.length - WIDOW.most);
}

/** A season for the widowed and orphans of every held town. */
export function widowsSeason(c: Campaign): void {
  for (const t of c.territories) widowsTown(c, t.id);
}

/** The widowed and orphans of a town, in words, for its panel or the roll; nothing if there are none. */
export function bereftText(c: Campaign, tid: number): string {
  const f = folkOf(c, tid), parts: string[] = [];
  for (const w of f.widowed ?? []) parts.push(`${w.name} ${w.family}, ${w.female ? 'widow of' : 'widower of'} ${w.of}${c.turn - w.since < WIDOW.mourn ? ', in mourning' : ''}`);
  for (const o of f.orphans ?? []) parts.push(`${o.count} ${o.count === 1 ? 'child' : 'children'} of the house of ${o.family}, kept by the house of ${o.into}`);
  return parts.join('; ');
}
