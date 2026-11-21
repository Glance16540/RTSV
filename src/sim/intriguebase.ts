// What every story inside the story is made of (intrigue.ts, courtstory.ts, aftermath.ts): the record of a story,
// the people in it, the notes it leaves for the report, and the four things every kind of story does: take a
// chance of its own, begin, say something, and end. They are kept below the stories themselves so that the stories
// of a town, the stories of the leader's house and what a story leaves behind can each use them without importing
// one another in a ring. Moved out of intrigue.ts as they stood; intrigue.ts gives them out again under the same
// names, so whoever imports them from there does so as before.
import type { Campaign } from './campaign';

/** Ended stories kept on record, and notes kept for the report. */
export const KEEP = { kept: 30, notes: 60 };
/**
 * Those who are to be told when a story ends, with the campaign and the story: what it leaves behind is theirs to
 * settle (aftermath.ts puts itself here as it loads). A story's ending does not know who they are.
 */
export const ENDINGS: ((c: Campaign, it: Intrigue) => void)[] = [];

export type IntrigueKind = 'thief' | 'killer' | 'rival' | 'suitor' | 'plot';
/** The stories of a town, and those of the leader's own house (courtstory.ts). */
export const TOWN_KINDS: IntrigueKind[] = ['thief', 'killer'];
export const ofTown = (it: { kind: IntrigueKind }): boolean => TOWN_KINDS.includes(it.kind);
/** A grown person of the town a story turns on. */
export interface Person { name: string; family: string; gender: 'm' | 'f'; trade: string; /** They are on the town's own record (township.ts): one of its notable people, or the man of a notable house. */ known?: 'notable' | 'husband' }
export interface Clue { turn: number; text: string; /** Those of `people` it clears, by place in the list. */ clears: number[] }
export interface Intrigue {
  id: number; kind: IntrigueKind; owner: number; at: number; since: number;
  /** A thief: the houses robbed, by the head of each. A killer: those suspected. */
  people: Person[];
  /** A killer: which of `people` it is. A thief: who it is, once caught. Not for showing. */
  culprit: number; thief?: Person; why?: 'hunger' | 'widow' | 'drink' | 'greed';
  /** A killer's dead. */
  victims: (Person & { turn: number })[];
  /** A thief: gold gone from the town's store, and how often each house was robbed. */
  taken: number; robbed: number[];
  clues: Clue[]; cleared: number[];
  /** A watch is kept (it costs the town gold each season), and for how many seasons it has been. */
  watch?: boolean; watched: number;
  /** A thief stands before the leader for judgement since this turn. */
  caught?: number;
  /** A killer seized on the field and held for judgement (killerseized.ts): which of `people` (the guilty one), since `caught`. */
  held?: number;
  /** A pardoned thief the lesson did not take with: the town may have another story at once. */
  again?: boolean;
  /** An innocent was hanged for it. */
  wronged?: Person[];
  /** A story of the leader's house (courtstory.ts): the rival people in it, how far it has gone, the turn its next step falls, and who is in it by name. */
  rival?: number; stage?: number; due?: number; cast?: { spouse?: string; daughter?: string; suitor?: string; king?: string }; willing?: boolean; asked?: boolean;
  /** A plot (courtstory.ts): the nobles suspected, by their key in nobles.ts; `culprit` is which, and `found` that it is known. */
  nobles?: { key: string; name: string; title: string; female: boolean }[]; found?: boolean; /** Gifts have gone out to the nobles over this plot. */ sweetened?: boolean;
  ended?: { turn: number; how: 'hanged' | 'banished' | 'worked' | 'pardoned' | 'unfound' | 'lost' | 'yielded' | 'bought' | 'foiled' | 'slain' | 'wounded' | 'wed' | 'refused' | 'spurned' | 'outlived' | 'executed' | 'usurped' | 'nothing'; text: string };
}
/** Something a story did in a season, for the report. `who`: the person it is about, for a face. */
export interface IntrigueNote { turn: number; id: number; kind: IntrigueKind; at: number; owner: number; tone: 'good' | 'bad' | 'plain'; text: string; who?: Person }
export interface Choice { id: string; label: string; /** Why it cannot be taken now, if it cannot. */ bar?: string; who?: Person }

declare module './campaign' {
  interface Campaign {
    /** Stories inside the story, open and ended (intrigue.ts). */
    intrigues?: Intrigue[]; intrigueSeq?: number; intrigueNews?: IntrigueNote[];
  }
}

/** A chance of this story's own: by the campaign, the season and a salt. */
export function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x51ed270b, 0x9e3779b1) ^ Math.imul(c.turn + 0x1b873593, 0x85ebca6b) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export const fullName = (p: Person): string => `${p.name} ${p.family}`.trim();

export function note(c: Campaign, it: Intrigue, tone: IntrigueNote['tone'], text: string, who?: Person): void {
  const news = (c.intrigueNews ??= []);
  news.push({ turn: c.turn, id: it.id, kind: it.kind, at: it.at, owner: it.owner, tone, text, ...(who ? { who } : {}) });
  if (news.length > KEEP.notes) news.splice(0, news.length - KEEP.notes);
  if (it.owner === 0) c.log.push(text);
}
export function end(c: Campaign, it: Intrigue, how: NonNullable<Intrigue['ended']>['how'], text: string, tone: IntrigueNote['tone'], who?: Person): void {
  it.ended = { turn: c.turn, how, text };
  delete it.caught; it.watch = false;
  note(c, it, tone, text, who);
  if (it.owner === 0) (c.chronicle ??= []).push({ turn: c.turn, text }); // a mark on the record, whatever came of it: the player's own (a rival's that he hears of, rivalstories.ts)
  for (const ended of ENDINGS) ended(c, it); // and what it leaves behind in the town or the court (aftermath.ts)
  const all = (c.intrigues ??= []), done = all.filter((x) => x.ended);
  if (done.length > KEEP.kept) all.splice(all.indexOf(done[0]), 1);
}

export function begin(c: Campaign, kind: IntrigueKind, at: number): Intrigue {
  const it: Intrigue = { id: (c.intrigueSeq = (c.intrigueSeq ?? 0) + 1), kind, owner: c.territories[at].owner, at, since: c.turn, people: [], culprit: -1, victims: [], taken: 0, robbed: [], clues: [], cleared: [], watched: 0 };
  (c.intrigues ??= []).push(it);
  return it;
}
