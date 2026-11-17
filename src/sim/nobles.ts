// Nobles (docs/DESIGN.md, "Relationships"). Some people rise into a noble class by what they did or the post they
// hold, and have a say in decrees; their moods tell on their towns.
//
//   Who is noble, read each season from what the game already keeps:
//     - the leader's inner circle (kin.ts), each at their own town;
//     - in every town, its most famous veteran (a captain) and its most famous mother of a great house (a matron),
//       from the town's notable people (township.ts, notableweight.ts);
//     - in its capital, and in every town of LORD_AT grown people or more, its lord, named from the campaign's seed. A lord holds the
//       town for its people: a town that changes hands has a new lord.
//   Each has a leaning (pious, martial, worldly or kindly), fixed by who they are, and a mood, -100 to 100.
//
//   A decree (decrees.ts) pleases some and angers others by their leaning: a pious lord likes a call to church and
//   hates the women ordered into the tavern, a worldly one the other way about. A decree in a noble's own town
//   weighs on them fully, one elsewhere in the nation less. Moods ease toward nothing each season, and sour a little
//   in a town that is raided, hungry or sick.
//
//   What is done for a noble lasts (nobledeal.ts): their `bonds`, while they hold, set where their mood settles.
//   An angry noble (mood ANGRY or below) tells on their town: its people work slacker (the harvest brings in less,
//   harvest.ts), it is readier to drift (drift.ts adds to its strain), and, while the leader is not there to see it
//   (court.ts), its watch against bands is thinner (drift.ts, `watchOf`, read by threats.ts).
//   The inner circle are nobles too: a decree that pleases or angers one of them moves their loyalty (kin.ts), and the
//   mood of the nobles of their town draws on it each season.
//
// Plain data on the faction, kept in the save. Rivals' nobles are kept by the same rules.
import type { Campaign } from './campaign';
import type { DecreeKind } from './decrees';
import { NAMES_F, NAMES_M } from './data';
import { kinOf, POST_NAMES } from './kin';
import type { Post } from './kin';
import { folkOf, grown, living } from './township';
import { leaderAt } from './court';
import { nobleEase, seatAt } from './hall';
import { lordContent, lordSay } from './manor';
import { oathSteady } from './oaths';
import { moodEase } from './ownstudies';

export type Rank = 'lord' | 'captain' | 'matron' | 'close';
export type Leaning = 'pious' | 'martial' | 'worldly' | 'kindly';
export const LEANINGS: Leaning[] = ['pious', 'martial', 'worldly', 'kindly'];
export const RANK_NAMES: Record<Rank, string> = { lord: 'Lord', captain: 'Captain', matron: 'Matron', close: 'Of the inner circle' };

/** Something done for or to a noble that lasts (nobledeal.ts): while it holds, their mood settles at `rest` more. */
export interface Bond { kind: string; turn: number; rest: number; until?: number; what?: string }
/**
 * One noble. `key` stays the same while they are the same person in the same place, so their mood is kept, and with it
 * what has been done for them (`bonds`, nobledeal.ts) and anything else other modules keep on them.
 */
export interface Noble { key: string; name: string; female: boolean; town: number; rank: Rank; leaning: Leaning; mood: number; post?: Post; bonds?: Bond[] }

declare module './campaign' {
  interface Faction {
    /** The nation's nobles (nobles.ts). */
    nobles?: Noble[];
    /** How many lords each town of the nation has had and lost, by town (nobles.ts, `newLord`). */
    lordsGone?: Record<number, number>;
    /** Nobles stripped of their lands, by key: never reckoned noble again (nobledeal.ts). */
    stripped?: string[];
  }
}

export const NOBLES = {
  /** Grown people a town needs to have a lord of its own. */
  lordAt: 12,
  /** How far a decree moves a noble's mood at full strength, in their own town; elsewhere in the nation, `far` of it. */
  sway: 25, far: 0.3,
  /** Each season a mood eases this share of the way back to where it settles (what a noble remembers for years sets that: nobletemper.ts), and sours in a town struck. */
  ease: 0.2, raided: -8, hungry: -6, sick: -4,
  /** At or below this a noble is angry. */
  angry: -40,
  /** What an angry noble's town suffers: a share of its harvest lost, strain added to its drift, and a share of its watch gone while the leader is away. */
  slack: 0.05, strain: 0.1, watch: 0.2,
  /** A decree's effect on one of the inner circle's loyalty, as a share of its effect on their mood; and how far the mood of their town's nobles draws on it a season. */
  loyal: 0.4, pull: 0.05,
};

/** How each leaning takes each decree, -1 to 1. */
export const LIKES: Record<Leaning, Record<DecreeKind, number>> = {
  pious: { church: 1, guards: 0, alms: 0.5, closeTavern: 1, tavernWomen: -1, tend: 1 },
  martial: { church: 0, guards: 1, alms: -0.5, closeTavern: 0, tavernWomen: 0, tend: 0 },
  worldly: { church: -0.5, guards: 0, alms: -0.5, closeTavern: -1, tavernWomen: 1, tend: -0.5 },
  kindly: { church: 0.5, guards: -0.5, alms: 1, closeTavern: 0, tavernWomen: -1, tend: 1 },
};

const hash = (a: number, b: number, k: number): number => {
  let h = Math.imul((a | 0) ^ 0x1b873593, 0x85ebca6b) ^ Math.imul(b + 0x3c6ef372, 0xc2b2ae35) ^ Math.imul(k + 11, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 13; h = Math.imul(h, 0x297a2d39); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const textHash = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0; return h; };
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** A noble's leaning: by their post or deeds where these say it, otherwise as the seed has it. */
function leaningOf(c: Campaign, key: string, rank: Rank, post?: Post): Leaning {
  if (post === 'priest') return 'pious';
  if (post === 'marshal') return 'martial';
  if (post === 'steward') return 'worldly';
  const r = hash(c.seed, textHash(key), 1);
  if (rank === 'captain') return r < 0.6 ? 'martial' : LEANINGS[Math.floor(r * 4)];
  if (rank === 'matron') return r < 0.5 ? 'kindly' : r < 0.8 ? 'pious' : LEANINGS[Math.floor(r * 4)];
  return LEANINGS[Math.floor(r * 4)];
}

/** Who is noble in a nation now, with the moods they had (new ones at nothing). */
function reckon(c: Campaign, f: number, was: Noble[]): Noble[] {
  const old = new Map(was.map((n) => [n.key, n])), stripped = new Set(c.factions[f]?.stripped ?? []);
  const out: Noble[] = [];
  const add = (key: string, name: string, female: boolean, town: number, rank: Rank, post?: Post): void => {
    if (out.some((n) => n.key === key) || stripped.has(key)) return;
    const o = old.get(key);
    // What other modules keep on a noble (their bonds, a title) goes with them from season to season.
    out.push({ ...(o ?? {}), key, name: o?.name ?? name, female: o?.female ?? female, town, rank, leaning: o?.leaning ?? leaningOf(c, key, rank, post), mood: o?.mood ?? 0, ...(post ? { post } : {}) });
  };
  for (const x of kinOf(c, f).circle) add(`close:${x.post}:${x.name}`, x.name, x.female, x.town, 'close', x.post);
  for (const t of c.territories) {
    if (t.owner !== f || t.horde) continue;
    const folk = folkOf(c, t.id), known = living(folk);
    const best = (kind: 'veteran' | 'mother', worth: (n: (typeof known)[number]) => number) => known.filter((n) => n.kind === kind).sort((a, b) => worth(b) - worth(a))[0];
    const vet = best('veteran', (n) => n.kills ?? 0), mother = best('mother', (n) => (n.kids ?? 0) + (n.made ?? 0) / 100);
    if (vet) add(`captain:${t.id}:${vet.name}`, vet.name, vet.gender === 'f', t.id, 'captain');
    if (mother) add(`matron:${t.id}:${mother.name}`, mother.name, true, t.id, 'matron');
    if (grown(folk) >= NOBLES.lordAt || t.capital === f) { // a capital has its lord whatever its size (the playtest: a small nation had none to deal with)
      // The lord of this town, or the one after them if lords have been lost here (newLord): each has a name of their own.
      const gen = c.factions[f]?.lordsGone?.[t.id] ?? 0, before = gen ? lordName(c, f, t.id, gen - 1).name : '';
      const lord = lordName(c, f, t.id, gen, before);
      add(`lord:${t.id}:${f}${gen ? `:${gen}` : ''}`, lord.name, lord.female, t.id, 'lord');
    }
  }
  return out;
}

/** The name of a town's lord, the `gen`th it has had (0 the first), never the same as the one before. */
function lordName(c: Campaign, f: number, tid: number, gen: number, not = ''): { name: string; female: boolean } {
  const female = hash(c.seed, tid * 131 + f + gen * 7919, 2) < 0.2, list = female ? NAMES_F : NAMES_M;
  let i = Math.floor(hash(c.seed, tid * 977 + f + gen * 104729, 3) * list.length);
  if (list[i] === not) i = (i + 1) % list.length;
  return { name: list[i], female };
}

/**
 * A town's lord is gone (dead, put to death, fled): the town has a new lord at once, of another name, who comes to it
 * with no grudge (mood nothing). Returns the new lord, or undefined if the town is too small to have one now.
 */
export function newLord(c: Campaign, f: number, tid: number, was?: Noble): Noble | undefined {
  const fac = c.factions[f];
  if (!fac) return undefined;
  const list = (fac.nobles ??= []), i = list.findIndex((n) => (was ? n === was || n.key === was.key : n.rank === 'lord' && n.town === tid));
  const old = i >= 0 ? list[i] : undefined;
  const gone = (fac.lordsGone ??= {});
  gone[tid] = (gone[tid] ?? 0) + 1;
  if (grown(folkOf(c, tid)) < NOBLES.lordAt && !old) return undefined;
  // In the place of the one gone, so that the rest of the nobles stand as they were.
  const gen = gone[tid], who = lordName(c, f, tid, gen, old?.name ?? lordName(c, f, tid, gen - 1).name);
  const lord: Noble = { key: `lord:${tid}:${f}:${gen}`, name: who.name, female: who.female, town: tid, rank: 'lord', leaning: leaningOf(c, `lord:${tid}:${f}:${gen}`, 'lord'), mood: 0 };
  if (i >= 0) list[i] = lord; else list.push(lord);
  if (f === 0) c.log.push(`${titleOf(c, lord)} now holds the town for you.`);
  return lord;
}

/** A nation's nobles, reckoned the first time they are asked after. */
export function noblesOf(c: Campaign, f: number): Noble[] {
  const fac = c.factions[f];
  if (!fac) return [];
  if (!fac.nobles) fac.nobles = reckon(c, f, []);
  return fac.nobles;
}

/** The nobles of a town. */
export const noblesAt = (c: Campaign, tid: number): Noble[] => {
  const owner = c.territories[tid]?.owner ?? -1;
  return owner >= 0 ? noblesOf(c, owner).filter((n) => n.town === tid) : [];
};
export const isAngry = (n: Noble): boolean => n.mood <= NOBLES.angry;
/** The bonds still holding on a noble (nobledeal.ts). */
export const bondsOf = (c: Campaign, n: Noble): Bond[] => (n.bonds ?? []).filter((b) => b.until === undefined || b.until >= c.turn);
/** Where a noble's mood settles: nothing, and what their bonds still holding add. */
export const restOf = (c: Campaign, n: Noble): number => bondsOf(c, n).reduce((s, b) => s + b.rest, 0);
/** A town with a noble in it who is angry. */
export const angryAt = (c: Campaign, tid: number): boolean => noblesAt(c, tid).some(isAngry);

/** How a decree to this town would move each noble of the nation: the change in mood, at this strength. */
export function moodsFor(c: Campaign, f: number, tid: number, kind: DecreeKind, strength = 1): { noble: Noble; by: number }[] {
  // A lord with a manor has the more say (manor.ts).
  return noblesOf(c, f).map((noble) => ({ noble, by: Math.round(NOBLES.sway * LIKES[noble.leaning][kind] * strength * (noble.town === tid ? 1 : NOBLES.far) * (noble.rank === 'lord' ? lordSay(c, noble.town) : 1) * oathSteady(c, f)) })).filter((x) => x.by !== 0); // sworn nobles swing less (oaths.ts)
}

/** Who a decree to this town would please and who it would anger (most moved first), for the player to weigh. */
export function sayOn(c: Campaign, f: number, tid: number, kind: DecreeKind): { pleased: Noble[]; angered: Noble[] } {
  const all = moodsFor(c, f, tid, kind).sort((a, b) => Math.abs(b.by) - Math.abs(a.by));
  return { pleased: all.filter((x) => x.by > 0).map((x) => x.noble), angered: all.filter((x) => x.by < 0).map((x) => x.noble) };
}

/** The nobles hear of a decree given (decrees.ts calls this). */
export function heardDecree(c: Campaign, f: number, tid: number, kind: DecreeKind, strength: number): void {
  const circle = kinOf(c, f).circle;
  for (const { noble, by } of moodsFor(c, f, tid, kind, strength)) {
    const was = isAngry(noble);
    noble.mood = clamp(noble.mood + by, -100, 100);
    if (noble.rank === 'close') {
      const x = circle.find((m) => m.post === noble.post && m.name === noble.name);
      if (x) x.loyalty = clamp(Math.round(x.loyalty + by * NOBLES.loyal), 0, 100);
    }
    if (f === 0 && !was && isAngry(noble)) c.log.push(`${titleOf(c, noble)} is angered by the decree in ${c.territories[tid].name}.`);
  }
}

/** A noble as the player reads them: "Lord Aldric of Highford". */
export function titleOf(c: Campaign, n: Noble): string {
  const of = c.territories[n.town]?.name ?? '';
  if (n.rank === 'close') return `${n.name}, ${POST_NAMES[n.post ?? 'right'].toLowerCase()}`;
  if (n.rank === 'lord') return `${n.female ? 'Lady' : 'Lord'} ${n.name} of ${of}`;
  return `${RANK_NAMES[n.rank]} ${n.name} of ${of}`;
}

const struckAt = (c: Campaign, tid: number, kinds: string[]): boolean => (c.events ?? []).some((e) => e.at === tid && kinds.includes(e.kind) && e.until >= c.turn - 1 && e.turn >= c.turn - 1);

/** A season for one nation's nobles: who they are now, their moods eased and soured, and the circle drawn by them. */
export function noblesSeason(c: Campaign, f: number): void {
  const fac = c.factions[f];
  if (!fac?.alive) return;
  const nobles = reckon(c, f, fac.nobles ?? []);
  for (const n of nobles) {
    const folk = folkOf(c, n.town);
    const sour = ((struckAt(c, n.town, ['raid', 'carried']) ? NOBLES.raided : 0) + (folk.hungry ? NOBLES.hungry : 0) + (struckAt(c, n.town, ['plague']) ? NOBLES.sick : 0)) * oathSteady(c, f); // and sworn ones sour less (oaths.ts)
    if (n.bonds) n.bonds = bondsOf(c, n); // spent bonds are struck off
    const rest = restOf(c, n); // and their mood settles where their bonds hold it (nobledeal.ts), not at nothing
    n.mood = clamp(Math.round(rest + (n.mood - rest) * (1 - Math.min(1, NOBLES.ease * nobleEase(c, f) * moodEase(c, f))) + sour + (n.rank === 'lord' ? lordContent(c, n.town) : 0)), -100, 100); // they cool the faster with a Hall to bring their grievances to (hall.ts), and sooner for a people whose own study says so (ownstudies.ts); a lord in his manor grows content (manor.ts)
  }
  fac.nobles = nobles;
  // The inner circle is drawn by the nobles of their town.
  for (const x of kinOf(c, f).circle) {
    const here = nobles.filter((n) => n.town === x.town && n.rank !== 'close');
    if (!here.length) continue;
    const mood = here.reduce((s, n) => s + n.mood, 0) / here.length;
    x.loyalty = clamp(Math.round(x.loyalty + mood * NOBLES.pull), 0, 100);
  }
}

/** A season for every living nation's nobles. */
export function noblesSeasons(c: Campaign): void {
  for (const x of c.factions) noblesSeason(c, x.id);
}

/** The share of its harvest an angry noble's town still brings in (harvest.ts). */
export const nobleWork = (c: Campaign, tid: number): number => (angryAt(c, tid) ? 1 - NOBLES.slack : 1);
/** Strain an angry noble adds to their town's drift (drift.ts). */
export const nobleStrain = (c: Campaign, tid: number): number => (angryAt(c, tid) ? NOBLES.strain : 0);
/** The share of its watch an angry noble's town keeps while the leader is not there (drift.ts, `watchOf`). */
export const nobleWatch = (c: Campaign, tid: number): number => {
  const owner = c.territories[tid]?.owner ?? -1;
  return angryAt(c, tid) && !seatAt(c, owner, tid) ? 1 - NOBLES.watch : 1; // the leader there, or a Hall of Judgement (hall.ts)
};
