// People moving between towns by road of their own accord (docs/DESIGN.md: "nothing moves between towns by road; a town
// is held to the room of the houses on its record"). Convoys carry what a ruler orders (convoys.ts) and the unmarried
// go to marry (suitors.ts); this is the rest: families leaving a town that is hard to live in for a better one of
// their own people.
//
// Push. A town pushes a family out when it is crowded (its people fill the room of its houses on record, seasonfolk.ts),
// hungry (larder.ts), sick (a plague in force), lately raided or carried from (threats.ts), or grieving (grief.ts).
// Pull. A town draws them when it has room to spare (MIGRATE.room places beyond its people and those already on the
// road to it), bread in store for the newcomers too (MIGRATE.bread of what plenty.ts calls short, a head, with them
// counted in), and none of those troubles.
// Who goes. One household from a pushed town a season, by chance (MIGRATE.chance): a couple of working age, their
// children and one of the town's old, as householdmove.ts says (a known woman's house goes whole, her man staying with
// the army if he is away). A town never lets one go that would leave it under MIGRATE.keep
// grown people or without a couple, so a hamlet is not emptied by it. They go to the town that draws most (most room)
// of those their people can reach by road (convoys.ts: a road through their own lands or a sea lane from a Harbour),
// as a convoy does, a season on the way, and are of that town from then on. At most MIGRATE.season families a people
// a season. Every nation's towns do it, the player's and the rivals' alike; the player is told in a line a season.
//
// The numbers are first guesses.
import type { Campaign } from './campaign';
import { roadBetween, sendFamily, sendSettlers } from './convoys';
import { mayLeave } from './townorders';
import { FOUNDING, settleable, wayOut } from './founding';
import { wilderness } from './wilds';
import { roomOf } from './seasonfolk';
import { PLENTY } from './plenty';
import { folkOf, headcount, living } from './township';
import { householdOf } from './householdmove';

export const MIGRATE = {
  /** The chance a season that a pushed town sends a family. */
  chance: 0.35,
  /** Grown people a town keeps whatever goes. */
  keep: 8,
  /** Places beyond its people (and those on the road to it) a town must have to draw a family. */
  room: 2,
  /** Bread a town must hold to draw a family, a head with the family counted in, in plenty.ts's measures of short bread. */
  bread: 1,
  /** Children who go with a family, at most. */
  children: 2,
  /** Seasons a raid is remembered as a reason to leave, or to stay away. */
  raided: 4,
  /** Families a people moves in a season, at most. */
  season: 2,
  /** The chance that a family going is a known one: a woman the town knows by name and her household, or a veteran and his. */
  named: 0.3,
  /** Moves kept on record for the season's report. */
  kept: 40,
  /** Settlers the player orders out of a town (`settle`): so many couples, and up to so many children. */
  settlers: 2, settlerKids: 3,
  /** What settlers carry to found a town on an empty land: its first food and timber. */
  provisions: { food: 200, wood: 150 },
  /** The chance a season that a rival's crowded town sends settlers to an empty land beside its people's. */
  found: 0.25,
};

export type Push = 'crowded' | 'hungry' | 'sick' | 'raided' | 'grieving';
export interface Move { owner: number; from: number; to: number; why: Push; people: number; /** Settlers bound for an empty land, to found a town there. */ found?: boolean; /** The known person who went with them, by name and sex, and the turn. */ name?: string; female?: boolean; turn?: number }

declare module './campaign' {
  interface Campaign { /** The latest families to move (migration.ts), for the season's report. */ moves?: Move[] }
}

const lately = (c: Campaign, tid: number, kinds: string[], seasons: number): boolean =>
  (c.events ?? []).some((e) => e.at === tid && kinds.includes(e.kind) && e.until >= c.turn - seasons);
const sick = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.at === tid && e.kind === 'plague' && e.until >= c.turn);
/** People already on the road to a town. */
const coming = (c: Campaign, tid: number): number => (c.convoys ?? []).filter((x) => x.to === tid).reduce((n, x) => n + x.cargo.men.length + x.cargo.women.length + (x.cargo.children?.length ?? 0), 0);
const roll = (c: Campaign, tid: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 13, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(tid * 977 + salt + 7, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};

/** Why a town would send a family away, the gravest first, or null if nothing pushes it. */
export function pushOf(c: Campaign, tid: number): Push | null {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde) return null;
  const f = folkOf(c, tid);
  if (f.hungry) return 'hungry';
  if (sick(c, tid)) return 'sick';
  if (lately(c, tid, ['raid', 'carried'], MIGRATE.raided)) return 'raided';
  if (headcount(f) >= roomOf(t)) return 'crowded';
  if (f.grief) return 'grieving';
  return null;
}

/** How strongly a town draws a family: the places it has to spare, or 0 if it draws none. */
export function pullOf(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde || pushOf(c, tid)) return 0;
  const f = folkOf(c, tid), people = headcount(f) + coming(c, tid) + 2 + MIGRATE.children;
  if (f.stores.food / people < MIGRATE.bread * PLENTY.short) return 0; // bread for them too
  const free = roomOf(t) - headcount(f) - coming(c, tid);
  return free >= MIGRATE.room ? free : 0;
}


/** One season of a people's families moving. Returns the moves. */
export function migrateOf(c: Campaign, f: number): Move[] {
  const fac = c.factions[f];
  if (!fac?.alive) return [];
  const mine = c.territories.filter((t) => t.owner === f && !t.horde);
  const out: Move[] = [];
  for (const t of mine) {
    if (out.length >= MIGRATE.season) break;
    const why = pushOf(c, t.id);
    if (!why || !mayLeave(c, t.id, 'family') || roll(c, t.id, 31) >= MIGRATE.chance) continue; // unless the player's standing orders keep them (townorders.ts)
    // Now and then the family is a known one: a woman of the town's record and her household (or a veteran and his).
    const known = roll(c, t.id, 47) < MIGRATE.named ? living(folkOf(c, t.id)).sort((a, b) => (a.kind === 'mother' ? 0 : 1) - (b.kind === 'mother' ? 0 : 1))[0] : undefined;
    const who = householdOf(c, t.id, { known, keep: MIGRATE.keep }); // the couple, their children and an old one, and the house they go as (householdmove.ts)
    if (!who) continue;
    const to = mine.filter((x) => x.id !== t.id).map((x) => ({ id: x.id, pull: pullOf(c, x.id) })).filter((x) => x.pull > 0)
      .sort((a, b) => b.pull - a.pull || a.id - b.id).find((x) => roadBetween(c, f, t.id, x.id));
    if (!to) continue;
    const convoy = sendFamily(c, f, t.id, to.id, { ...who, ...(known ? { notable: known } : {}) });
    if (!convoy) continue;
    const move: Move = { owner: f, from: t.id, to: to.id, why, people: convoy.cargo.men.length + convoy.cargo.women.length + (convoy.cargo.children?.length ?? 0), turn: c.turn, ...(convoy.cargo.notables?.length ? { name: [convoy.cargo.notables[0].name, convoy.cargo.notables[0].family].filter(Boolean).join(' '), female: convoy.cargo.notables[0].gender === 'f' } : {}) };
    out.push(move);
    (c.moves ??= []).push(move);
    if (c.moves.length > MIGRATE.kept) c.moves.splice(0, c.moves.length - MIGRATE.kept);
  }
  return out;
}

const WHY: Record<Push, string> = { crowded: 'there was no room', hungry: 'it was hungry', sick: 'plague was there', raided: 'it had been raided', grieving: 'it was grieving' };
/** One season of families moving in every nation. The player is told in a line. Returns the moves. */
export function migrationSeason(c: Campaign): Move[] {
  // Settlers first: a crowded town that can found a town of its own on empty land does so before a family drifts off.
  const all = c.factions.flatMap((x) => [...foundOf(c, x.id), ...migrateOf(c, x.id)]);
  const mine = all.filter((m) => m.owner === 0 && !m.found);
  if (mine.length) c.log.push(`${mine.length === 1 ? 'A family has' : `${mine.length} families have`} set out by road: ${mine.map((m) => `${m.name ? `${m.name} and ${m.female ? 'her' : 'his'} household ` : ''}from ${c.territories[m.from].name} to ${c.territories[m.to].name}, since ${WHY[m.why]}`).join('; ')}.`);
  return all;
}

/**
 * The season's report on who moved (seasonreport.ts): a line or two, not a flood. The known by name first, each in a
 * line; the rest counted in one. Only moves of this people since the season began.
 */
export function movesReport(c: Campaign, f: number, since: number): string[] {
  const ms = (c.moves ?? []).filter((m) => m.owner === f && (m.turn ?? 0) > since);
  const at = (id: number): string => c.territories[id]?.name ?? 'a town';
  // Towns founded since: settlers came in (founding.ts claimLand).
  const made = c.territories.filter((t) => t.owner === f && t.foundedBy && t.foundedBy.turn > since).map((t) => `Settlers from ${at(t.foundedBy!.from)} have founded ${t.name}.`);
  if (!ms.length) return made;
  const founded = ms.filter((m) => m.found).slice(0, 2), others = ms.filter((m) => !m.found);
  const named = others.filter((m) => m.name).slice(0, 2), rest = others.filter((m) => !named.includes(m));
  const lines = [...made, ...founded.map((m) => `Settlers set out from ${at(m.from)} to found a town at ${at(m.to)}.`)];
  lines.push(...named.map((m) => `${m.name} and ${m.female ? 'her' : 'his'} household left ${at(m.from)} for ${at(m.to)}, since ${WHY[m.why]}.`));
  if (rest.length) lines.push(rest.length === 1 ? `A family left ${at(rest[0].from)} for ${at(rest[0].to)}, since ${WHY[rest[0].why]}.` : `${rest.length} families moved between your towns: ${[...new Set(rest.map((m) => at(m.from)))].join(', ')} to ${[...new Set(rest.map((m) => at(m.to)))].join(', ')}.`);
  return lines;
}

/**
 * The player orders a town settled from another (the land's panel): `MIGRATE.settlers` couples of working age and up to
 * `MIGRATE.settlerKids` children go by road as a family does, to a town of the people's that is empty or has room. Why
 * not, in words, or '' if they can go. The town they leave keeps MIGRATE.keep grown people and a couple.
 */
export function settleBar(c: Campaign, f: number, from: number, to: number): string {
  const a = c.territories[from], b = c.territories[to];
  if (!a || !b || a.owner !== f || a.horde) return 'Settlers go from a town of your people\'s.';
  if (wilderness(c, to)) return `${b.name} is true wilderness: nobody can settle it.`;
  const founding = settleable(c, to);
  if (!founding && (b.owner !== f || b.horde)) return b.horde || (c.bands ?? []).some((x) => x.at === to) ? `${b.name} is held by a band: it cannot be settled until it is cleared.` : 'Settlers go to a town of your people\'s, or to an empty land beside your own.';
  if (from === to) return 'Settlers go from one town to another.';
  if (founding ? !wayOut(c, f, to) : !roadBetween(c, f, from, to)) return founding ? `${b.name} is too far: settlers cross at most ${FOUNDING.reach - 1} lands with nobody on them beyond your own to reach it.` : 'There is no road through your own lands between them, nor a sea lane from a Harbour.';
  const way = founding ? wayOut(c, f, to) : null;
  if (way && way.gate !== from && !roadBetween(c, f, from, way.gate)) return `There is no road through your own lands from ${a.name} toward ${b.name}.`;
  const k = folkOf(c, from), n = MIGRATE.settlers;
  if (k.men < n + 1 || k.women < n + 1 || k.men + k.women + k.elders - 2 * n < MIGRATE.keep) return `${a.name} cannot spare ${n} families: a town keeps ${MIGRATE.keep} grown people and a couple.`;
  if (founding) return '';
  const room = roomOf(b) - headcount(folkOf(c, to)) - coming(c, to);
  if (room < 2 * n) return `${b.name} has no room for them: build houses there first.`;
  return '';
}
/** Send settlers (see `settleBar`). Returns '' when they set out, or why not. */
export function settle(c: Campaign, f: number, from: number, to: number): string {
  const bar = settleBar(c, f, from, to);
  if (bar) return bar;
  const k = folkOf(c, from), n = MIGRATE.settlers, founding = settleable(c, to);
  const who = { men: n, women: n, children: Math.min(MIGRATE.settlerKids, k.children) };
  const convoy = founding ? sendSettlers(c, f, from, to, who, MIGRATE.provisions) : sendFamily(c, f, from, to, who);
  if (!convoy) return 'They could not set out.';
  const people = convoy.cargo.men.length + convoy.cargo.women.length + (convoy.cargo.children?.length ?? 0);
  if (founding) {
    const move: Move = { owner: f, from, to, why: 'crowded', people, turn: c.turn, found: true };
    (c.moves ??= []).push(move);
    if (c.moves.length > MIGRATE.kept) c.moves.splice(0, c.moves.length - MIGRATE.kept);
  }
  if (f === 0) c.log.push(founding
    ? `${people} settlers have set out from ${c.territories[from].name} with food and timber to found a town on the empty land at ${c.territories[to].name}; they will be there ${seasonsTo(c, f, to) > 1 ? `in ${seasonsTo(c, f, to)} seasons` : 'next season'}.`
    : `${people} settlers have set out from ${c.territories[from].name} to make their homes in ${c.territories[to].name}; they will be there next season.`);
  return '';
}

/** Empty lands beside a people's own (founding.ts), where its settlers could found a town. */
export const freeLands = (c: Campaign, f: number): number[] => c.territories
  .map((t) => ({ id: t.id, way: settleable(c, t.id) ? wayOut(c, f, t.id) : null }))
  .filter((x) => x.way).sort((a, b) => a.way!.through.length - b.way!.through.length || a.id - b.id).map((x) => x.id);
/**
 * Can settlers of this people reach an empty land, in words for its panel (docs/PLAYTEST.md 3.1): which town of theirs
 * can send them and how long they are on the road, or why none can. '' for a land that is not settleable.
 */
export function settleReach(c: Campaign, f: number, to: number): string {
  if (!settleable(c, to)) return '';
  const way = wayOut(c, f, to);
  if (!way) return `No town of yours can reach it: settlers cross at most ${FOUNDING.reach - 1} ${FOUNDING.reach - 1 === 1 ? 'land' : 'lands'} with nobody on them beyond your own, never a land somebody lives on.`;
  const towns = c.territories.filter((t) => t.owner === f && !t.horde && (t.id === way.gate || roadBetween(c, f, t.id, way.gate)));
  if (!towns.length) return 'No town of yours has a road through your own lands toward it.';
  const n = way.through.length, from = towns.find((t) => t.id === way.gate) ?? towns[0];
  return `In reach: settlers from ${from.name}${towns.length > 1 ? ' or another town of yours' : ''} would be ${n === 1 ? 'a season' : `${n} seasons`} on the road. Send them from the town's convoy part.`;
}
/** Seasons settlers take to reach an empty land, a season a land beyond the people's own; 0 if they cannot. */
export const seasonsTo = (c: Campaign, f: number, to: number): number => wayOut(c, f, to)?.through.length ?? 0;

/**
 * A crowded town sends settlers to found a town on an empty land beside its people's, now and then (MIGRATE.found): a
 * rival's, and the player's by its governor's choice (governor.ts keeps every town, the player's too; the owner's word,
 * 17 November 2026), as the player may order. At most one a season a people. Returns the moves.
 */
export function foundOf(c: Campaign, f: number): Move[] {
  const fac = c.factions[f];
  if (!fac?.alive) return [];
  const free = freeLands(c, f);
  if (!free.length) return [];
  for (const t of c.territories.filter((x) => x.owner === f && !x.horde)) {
    if (pushOf(c, t.id) !== 'crowded' || !mayLeave(c, t.id, 'settlers') || roll(c, t.id, 61) >= MIGRATE.found) continue; // unless the player's standing orders keep them (townorders.ts)
    const to = free.find((id) => settleBar(c, f, t.id, id) === '');
    if (to === undefined) continue;
    if (settle(c, f, t.id, to) === '') return [c.moves!.at(-1)!];
  }
  return [];
}
