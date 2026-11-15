// Stories inside the story (docs/DESIGN.md, "Relationships"): personal matters that come up by chance out of the
// systems already running, play out over several seasons, have a choice or a search in them, are told through
// named people, and leave a mark on the record whatever comes of them.
//
// This is the plumbing and the first two. The other three (a rival king, a suitor, a plotting noble) wait for
// the leader's household and the nobles to be on record, and are added here as further kinds.
//
//   A thief. In a town with gold in store, somebody keeps robbing the same few houses: each season one of them
//     is robbed and gold goes from the town's store. Likelier where the town is hungry or its people have drifted
//     to the tavern. The leader may set a watch on those houses (it costs the town gold each season it is kept,
//     and is surer every season, since it is always the same houses) or leave it. A thief who is caught stands
//     before the leader, with the reason they stole, and is hanged, banished, set to work it off, or pardoned.
//   A killer. In a town of some size a grown person is found dead, and then another. A few grown people of the
//     town are suspected. Each season the leader's people search: a clue may turn up that clears one of them (or,
//     once, everyone of one sex), surer if the leader's court or an army is in the town. The leader may accuse one
//     at any time. Accused rightly, the killer hangs and it is over. Accused wrongly, an innocent hangs, the town
//     knows it, and the killings go on. Left long enough, the killer is never found.
//
// Two rules hold for every story here, now and later: none touches a child (nobody under age is robbed, suspected,
// accused, killed or named), and nothing is shown of what is done to a captive.
//
// Plain data: an `Intrigue` on the campaign, `intrigueSeason(c)` once a season, `choicesFor` / `choose` for whoever
// puts it to the player, `intrigueNews` for whoever reports it. Chances are a run of their own, so the rest of a
// campaign's luck is left as it was. `culprit` is the sim's own knowledge: a client must not show it.
import type { Campaign } from './campaign';
import { shiftVirtue } from './campaign';
import { FAMILY_NAMES, NAMES_F, NAMES_M } from './data';
import { agesOf } from './ageing';
import { leaderAt } from './court';
import { needOf } from './larder';
import { folkOf, grown, living } from './township';
import { courtBegin, courtChoices, courtChoose, courtStanding, courtStep } from './courtstory';

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
  /** A pardoned thief the lesson did not take with: the town may have another story at once. */
  again?: boolean;
  /** An innocent was hanged for it. */
  wronged?: Person[];
  /** A story of the leader's house (courtstory.ts): the rival people in it, how far it has gone, the turn its next step falls, and who is in it by name. */
  rival?: number; stage?: number; due?: number; cast?: { spouse?: string; daughter?: string; suitor?: string; king?: string }; willing?: boolean; asked?: boolean;
  /** A plot (courtstory.ts): the nobles suspected, by their key in nobles.ts; `culprit` is which, and `found` that it is known. */
  nobles?: { key: string; name: string; title: string; female: boolean }[]; found?: boolean;
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

export const INTRIGUE = {
  /** No story before this season; a town has one at a time and is left alone this long after one ends; a people has this many open at once. */
  from: 6, rest: 8, open: 1,
  /** Ended stories kept on record, and notes kept for the report. */
  kept: 30, notes: 60,
  /** The chance someone in a town's story is one of the people its record knows by name, where it knows any. */
  known: 0.5,
  thief: {
    /** The chance each season, for the whole nation, in a town that has the gold; times `strained` where it is hungry or drinks. */
    chance: 0.04, strained: 2, gold: 80,
    houses: 3,
    /** The share of the town's gold a robbery takes, and the most. */
    share: 0.06, most: 30,
    /** A watch: its cost in gold a season, the chance it catches the thief the first season, and what each season more adds. */
    cost: 15, catch: 0.3, surer: 0.2,
    /** The chance the thief is caught without one, and seasons until they stop of their own accord. */
    luck: 0.05, lasts: 10,
    /** Seasons a thief who is taken waits for the leader's judgement before the town's elders give their own. */
    wait: 3,
    /** What each judgement does to the people's piety, and the share of what was taken that is worked off or got back. */
    virtue: { hanged: -6, banished: -1, worked: 3, pardoned: 5 }, hungerHanged: -6, back: { worked: 0.6, hanged: 0.3, banished: 0.3, pardoned: 0 },
    /** The chance a pardoned thief who stole for drink or greed is at it again. */
    again: 0.5,
  },
  killer: {
    chance: 0.02, strained: 2, grown: 8,
    suspects: 5,
    /** The chance of a killing each season after the first, and the fewest grown people it leaves a town. */
    strike: 0.3, leave: 7,
    /** The chance a killing is of one of the suspected (who is thereby cleared). */
    among: 0.25,
    /** The chance of a clue a season; more with the leader's court in the town, or an army. */
    clue: 0.45, court: 0.3, army: 0.15,
    /** The chance a clue is of the killer's sex rather than where one person was. */
    sex: 0.3,
    /** Seasons until the killer is gone unfound; seasons the town waits once only one is left before it acts itself. */
    lasts: 10, patience: 2,
    virtue: { found: 4, wrong: -8, unfound: -4 },
  },
};

const TRADES = ['miller', 'smith', 'carter', 'weaver', 'herder', 'brewer', 'thatcher', 'fowler', 'tanner', 'potter', 'cooper', 'baker'];
const PLACES = ['the mill', 'the forge', 'the well', 'the far field', 'the church', 'the ford', 'the granary', 'the tavern'];

/** A chance of this story's own: by the campaign, the season and a salt. */
export function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x51ed270b, 0x9e3779b1) ^ Math.imul(c.turn + 0x1b873593, 0x85ebca6b) ^ Math.imul(salt + 0x27d4eb2f, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const pick = <T>(xs: readonly T[], r: number): T => xs[Math.min(xs.length - 1, Math.floor(r * xs.length))];
export const fullName = (p: Person): string => `${p.name} ${p.family}`.trim();
const they = (p: Person): string => (p.gender === 'f' ? 'she' : 'he');
const their = (p: Person): string => (p.gender === 'f' ? 'her' : 'his');
const land = (c: Campaign, at: number): string => c.territories[at].name;

/** The people a town's record already knows by name: its notable people still living, and the men of its notable houses. */
export function onRecord(c: Campaign, at: number): Person[] {
  const out: Person[] = [];
  for (const n of living(folkOf(c, at))) {
    const r = chance(c, at * 577 + n.name.length * 31 + n.turn);
    out.push({ name: n.name, family: n.family ?? '', gender: n.gender, trade: n.kind === 'veteran' ? 'veteran' : pick(TRADES, r), known: 'notable' });
    if (n.kind === 'mother' && n.husband) out.push({ name: n.husband.split(' ')[0], family: n.family ?? n.husband.split(' ').slice(1).join(' '), gender: 'm', trade: pick(TRADES, 1 - r), known: 'husband' });
  }
  return out;
}
const same = (a: Person, b: Person): boolean => a.name === b.name && a.family === b.family;
/**
 * A grown person of a town, by name. Where the town's record knows people by name, some of a story's people are
 * those people (`INTRIGUE.known` of the time); the rest are made up, of one of the houses on its record where it
 * has any. `not`: those already in the story.
 */
function person(c: Campaign, at: number, salt: number, not: Person[], gender?: 'm' | 'f'): Person {
  const f = folkOf(c, at), houses = ((f as { houses?: { family?: string }[] }).houses ?? []).map((h) => h?.family).filter((x): x is string => !!x && x !== 'Nameless');
  const known = onRecord(c, at).filter((p) => (!gender || p.gender === gender) && !not.some((x) => same(x, p)));
  if (known.length && chance(c, salt * 97 + at * 1009 + 77) < INTRIGUE.known) return pick(known, chance(c, salt * 97 + at * 1009 + 78));
  for (let k = 0; ; k++) {
    const r = (n: number): number => chance(c, salt * 97 + k * 13 + n + at * 1009);
    const g = gender ?? (r(1) < (f.men + 0.5) / (f.men + f.women + 1) ? 'm' : 'f');
    const p: Person = { name: pick(g === 'f' ? NAMES_F : NAMES_M, r(2)), family: houses.length && r(3) < 0.6 ? pick(houses, r(4)) : pick(FAMILY_NAMES, r(4)), gender: g, trade: pick(TRADES, r(5)) };
    if (k > 40 || !not.some((x) => same(x, p))) return p;
  }
}
/** One grown person is gone from the town's count, a man or a woman as near as the town has them. Never a child. */
function strike(c: Campaign, at: number, p: Person, how: string): boolean {
  const f = folkOf(c, at), gender = p.gender;
  if (gender === 'f' ? f.women > 0 : f.men > 0) { if (gender === 'f') f.women--; else f.men--; }
  else if (f.elders > 0) f.elders--;
  else if (f.men + f.women > 0) { if (f.men > 0) f.men--; else f.women--; }
  else return false;
  if (f.ages) agesOf(c, at, f); // the record of ages loses them too
  // Someone the town knew by name is struck from its record as lost, and how.
  if (p.known === 'notable') { const n = living(f).find((x) => x.name === p.name && (x.family ?? '') === p.family); if (n) n.lost = { turn: c.turn, how }; }
  if (p.known === 'husband') { const n = living(f).find((x) => x.kind === 'mother' && !!x.husband && x.husband.split(' ')[0] === p.name && (x.family ?? '') === p.family); if (n) delete n.husband; }
  return true;
}
export function note(c: Campaign, it: Intrigue, tone: IntrigueNote['tone'], text: string, who?: Person): void {
  const news = (c.intrigueNews ??= []);
  news.push({ turn: c.turn, id: it.id, kind: it.kind, at: it.at, owner: it.owner, tone, text, ...(who ? { who } : {}) });
  if (news.length > INTRIGUE.notes) news.splice(0, news.length - INTRIGUE.notes);
  if (it.owner === 0) c.log.push(text);
}
export function end(c: Campaign, it: Intrigue, how: NonNullable<Intrigue['ended']>['how'], text: string, tone: IntrigueNote['tone'], who?: Person): void {
  it.ended = { turn: c.turn, how, text };
  delete it.caught; it.watch = false;
  note(c, it, tone, text, who);
  (c.chronicle ??= []).push({ turn: c.turn, text }); // a mark on the record, whatever came of it
  const all = (c.intrigues ??= []), done = all.filter((x) => x.ended);
  if (done.length > INTRIGUE.kept) all.splice(all.indexOf(done[0]), 1);
}

/** The stories of a people still running (the player's by default), and all of them, ended too. */
export const openIntrigues = (c: Campaign, f = 0): Intrigue[] => (c.intrigues ?? []).filter((x) => x.owner === f && !x.ended);
export const intrigueAt = (c: Campaign, at: number): Intrigue | undefined => (c.intrigues ?? []).find((x) => x.at === at && !x.ended && ofTown(x));
/** Every story running in a land: its town's, and the leader's house's if the court is kept there. */
export const intriguesAt = (c: Campaign, at: number): Intrigue[] => (c.intrigues ?? []).filter((x) => x.at === at && !x.ended);
/** Those of a killer's suspects not yet cleared, by place in the list. */
export const suspected = (it: Intrigue): number[] => it.people.map((_, i) => i).filter((i) => !it.cleared.includes(i));
/** What a season's stories did that concerns a people, for the report. */
export const intrigueNews = (c: Campaign, turn = c.turn, f = 0): IntrigueNote[] => (c.intrigueNews ?? []).filter((n) => n.turn === turn && n.owner === f);

/** Is the town strained: short of a season's food, or with people gone to the tavern? Stories come likelier there. */
export function strained(c: Campaign, at: number): boolean {
  const f = folkOf(c, at), d = (f as { drifted?: { tavern?: number } }).drifted;
  return f.stores.food < needOf(c, at) || (d?.tavern ?? 0) > 0;
}
/** May a story begin in this town now? One at a time, and not too soon after the last. */
function free(c: Campaign, at: number): boolean {
  const t = c.territories[at];
  if (t.owner < 0 || t.horde) return false;
  return !(c.intrigues ?? []).some((x) => ofTown(x) && x.at === at && (!x.ended || (!x.again && c.turn - x.ended.turn < INTRIGUE.rest)));
}
export function begin(c: Campaign, kind: IntrigueKind, at: number): Intrigue {
  const it: Intrigue = { id: (c.intrigueSeq = (c.intrigueSeq ?? 0) + 1), kind, owner: c.territories[at].owner, at, since: c.turn, people: [], culprit: -1, victims: [], taken: 0, robbed: [], clues: [], cleared: [], watched: 0 };
  (c.intrigues ??= []).push(it);
  return it;
}

/** A thief begins on a town: the houses are chosen, and the first is robbed. For the season's chance, and for tests. */
export function beginThief(c: Campaign, at: number): Intrigue {
  const it = begin(c, 'thief', at);
  for (let i = 0; i < INTRIGUE.thief.houses; i++) it.people.push(person(c, at, it.id * 31 + i, it.people));
  it.robbed = it.people.map(() => 0);
  rob(c, it, true);
  return it;
}
function rob(c: Campaign, it: Intrigue, first = false): void {
  const T = INTRIGUE.thief, f = folkOf(c, it.at), i = Math.floor(chance(c, it.id * 53 + 1) * it.people.length), who = it.people[i];
  const gold = Math.min(T.most, Math.ceil(f.stores.gold * T.share), f.stores.gold);
  f.stores.gold -= gold; it.taken += gold; it.robbed[i]++;
  const times = it.robbed[i];
  note(c, it, 'bad', first
    ? `A thief is at work in ${land(c, it.at)}: the house of ${fullName(who)} the ${who.trade} was robbed in the night${gold ? `, and ${gold} gold is gone` : ''}.`
    : `The thief of ${land(c, it.at)} has robbed the house of ${fullName(who)} ${times > 2 ? `a ${['third', 'fourth', 'fifth'][times - 3] ?? 'further'} time` : times === 2 ? 'again' : 'now'}${gold ? `: ${gold} gold gone` : ''}.`, who);
}
/** Why this thief stole, out of how the town stands: hunger, a house whose man fell with the army, drink, or plain greed. */
function reason(c: Campaign, it: Intrigue, thief: Person): NonNullable<Intrigue['why']> {
  const f = folkOf(c, it.at);
  if (f.stores.food < needOf(c, it.at)) return 'hunger';
  const fallen = ((f as { houses?: { family?: string; fallen?: unknown[] }[] }).houses ?? []).some((h) => h?.family === thief.family && (h.fallen?.length ?? 0) > 0);
  if (thief.gender === 'f' && fallen) return 'widow';
  if (((f as { drifted?: { tavern?: number } }).drifted?.tavern ?? 0) > 0) return 'drink';
  return 'greed';
}
const WHY: Record<NonNullable<Intrigue['why']>, (p: Person) => string> = {
  hunger: (p) => `There was no food in ${their(p)} house, and ${they(p)} stole to eat`,
  widow: (p) => `${their(p)[0].toUpperCase() + their(p).slice(1)} man fell with the army, and the house had nothing coming in`,
  drink: (p) => `${they(p)[0].toUpperCase() + they(p).slice(1)} owed more at the tavern than ${they(p)} could ever pay`,
  greed: (p) => `${they(p)[0].toUpperCase() + they(p).slice(1)} wanted for nothing, and stole all the same`,
};
function catchThief(c: Campaign, it: Intrigue): void {
  const thief = person(c, it.at, it.id * 71, it.people);
  it.thief = thief; it.why = reason(c, it, thief); it.caught = c.turn;
  note(c, it, 'good', `The thief of ${land(c, it.at)} is taken at the house of ${fullName(it.people[it.robbed.indexOf(Math.max(...it.robbed))])}: it is ${fullName(thief)} the ${thief.trade}. ${WHY[it.why](thief)}. ${they(thief)[0].toUpperCase() + they(thief).slice(1)} waits on your judgement.`, thief);
}
function thiefSeason(c: Campaign, it: Intrigue): void {
  const T = INTRIGUE.thief, f = folkOf(c, it.at);
  if (it.caught !== undefined) {
    // The leader's judgement is waited for, but not for ever: the town's elders give their own, and it is a mild one.
    if (c.turn - it.caught >= T.wait && it.thief) {
      const g = Math.round(it.taken * T.back.worked); f.stores.gold += g;
      end(c, it, 'worked', `No judgement came for ${fullName(it.thief)} of ${land(c, it.at)}, taken for a thief, so the elders gave their own: ${they(it.thief)} works off what ${they(it.thief)} stole. ${g} gold came back to the town.`, 'plain', it.thief);
    }
    return;
  }
  if (it.watch) {
    if (f.stores.gold >= T.cost) { f.stores.gold -= T.cost; it.watched++; }
    else { it.watch = false; note(c, it, 'plain', `${land(c, it.at)} cannot pay its watch, and the watch is stood down.`); }
  }
  const odds = it.watch ? T.catch + T.surer * (it.watched - 1) : T.luck;
  if (chance(c, it.id * 53 + 2) < odds) { catchThief(c, it); return; }
  if (c.turn - it.since >= T.lasts) { end(c, it, 'unfound', `The thief of ${land(c, it.at)} was never taken. The robberies stopped, and ${it.taken} gold was never seen again.`, 'plain'); return; }
  rob(c, it);
}

/** A killer begins in a town: a grown person is found dead, and a few are suspected. For the season's chance, and for tests. */
export function beginKiller(c: Campaign, at: number): Intrigue {
  const K = INTRIGUE.killer, it = begin(c, 'killer', at);
  for (let i = 0; i < K.suspects; i++) it.people.push(person(c, at, it.id * 31 + i, it.people));
  // Whatever chance made of them, there is someone of each sex among them, so that a clue of the killer's sex tells something.
  if (it.people.every((p) => p.gender === it.people[0].gender)) it.people[K.suspects - 1] = person(c, at, it.id * 31 + 9, it.people, it.people[0].gender === 'f' ? 'm' : 'f');
  it.culprit = Math.floor(chance(c, it.id * 59 + 1) * it.people.length);
  kill(c, it, true);
  return it;
}
function kill(c: Campaign, it: Intrigue, first = false): boolean {
  const K = INTRIGUE.killer, f = folkOf(c, it.at);
  if (grown(f) <= K.leave) return false;
  const left = suspected(it).filter((i) => i !== it.culprit);
  let dead: Person;
  if (!first && left.length > 1 && chance(c, it.id * 59 + 2) < K.among) {
    const i = pick(left, chance(c, it.id * 59 + 3));
    dead = it.people[i]; it.cleared.push(i); // nobody suspects the dead
  } else dead = person(c, it.at, it.id * 67 + it.victims.length, [...it.people, ...it.victims]);
  if (!strike(c, it.at, dead, 'was killed in the night')) return false;
  it.victims.push({ ...dead, turn: c.turn });
  const names = suspected(it).map((i) => fullName(it.people[i]));
  note(c, it, 'bad', first
    ? `${fullName(dead)} the ${dead.trade} is found dead in ${land(c, it.at)}, and not by accident. ${names.length} of the town are spoken of: ${names.join(', ')}.`
    : `Another is dead in ${land(c, it.at)}: ${fullName(dead)} the ${dead.trade}${it.people.includes(dead) ? `, who was ${dead.gender === 'f' ? 'herself' : 'himself'} suspected` : ''}. That is ${it.victims.length}.`, dead);
  return true;
}
function clue(c: Campaign, it: Intrigue): void {
  const K = INTRIGUE.killer, left = suspected(it).filter((i) => i !== it.culprit);
  if (!left.length) return;
  const guilty = it.people[it.culprit], other = left.filter((i) => it.people[i].gender !== guilty.gender);
  let found: Clue;
  if (other.length && !it.clues.some((x) => x.clears.length > 1 || /print/.test(x.text)) && chance(c, it.id * 61 + 1) < K.sex) {
    found = { turn: c.turn, clears: other, text: `By the last of the dead there is the print of a ${guilty.gender === 'f' ? 'woman\'s shoe' : 'man\'s boot'}. It was no ${guilty.gender === 'f' ? 'man' : 'woman'} did this.` };
  } else {
    const i = pick(left, chance(c, it.id * 61 + 2)), p = it.people[i];
    found = { turn: c.turn, clears: [i], text: `${fullName(p)} was at ${pick(PLACES, chance(c, it.id * 61 + 3))} that night, and three will swear to it. It was not ${p.gender === 'f' ? 'her' : 'him'}.` };
  }
  it.clues.push(found); it.cleared.push(...found.clears);
  const now = suspected(it);
  note(c, it, 'good', `In ${land(c, it.at)}: ${found.text} ${now.length === 1 ? `Only ${fullName(it.people[now[0]])} is left.` : `${now.length} are still spoken of.`}`);
}
function hang(c: Campaign, it: Intrigue, i: number, by: 'you' | 'town'): void {
  const K = INTRIGUE.killer, p = it.people[i], who = by === 'you' ? 'You accused' : `The people of ${land(c, it.at)} did not wait for you: they took`;
  strike(c, it.at, p, i === it.culprit ? 'was hanged for a killer' : `was hanged for killings ${they(p)} did not do`);
  if (i === it.culprit) {
    shiftVirtue(c, it.owner, K.virtue.found, { at: it.at });
    end(c, it, 'hanged', `${who} ${fullName(p)} the ${p.trade} for the ${it.victims.length === 1 ? 'death' : `${it.victims.length} deaths`} in ${land(c, it.at)}, and ${they(p)} confessed it and was hanged. The town sleeps again.`, 'good', p);
    return;
  }
  it.cleared.push(i); (it.wronged ??= []).push(p);
  shiftVirtue(c, it.owner, K.virtue.wrong, { at: it.at });
  note(c, it, 'bad', `${who} ${fullName(p)} the ${p.trade} for the deaths in ${land(c, it.at)}, and ${they(p)} was hanged swearing ${they(p)} had done nothing. ${they(p)[0].toUpperCase() + they(p).slice(1)} had not.`, p);
  (c.chronicle ??= []).push({ turn: c.turn, text: `${fullName(p)} of ${land(c, it.at)} was hanged for killings ${they(p)} did not do.` });
}
function killerSeason(c: Campaign, it: Intrigue): void {
  const K = INTRIGUE.killer, t = c.territories[it.at];
  const odds = K.clue + (leaderAt(c, it.owner, it.at) ? K.court : 0) + (c.armies.some((a) => a.owner === it.owner && a.at === it.at) ? K.army : 0);
  if (chance(c, it.id * 59 + 4) < odds) clue(c, it);
  const left = suspected(it);
  // Once only one is left the town will not wait for ever.
  if (left.length === 1) {
    const sure = it.clues.length ? c.turn - it.clues[it.clues.length - 1].turn : 0;
    if (sure >= K.patience) { hang(c, it, left[0], 'town'); return; }
  }
  if (c.turn - it.since >= K.lasts) {
    shiftVirtue(c, it.owner, K.virtue.unfound, { at: it.at });
    end(c, it, 'unfound', `Whoever killed ${it.victims.length} of the people of ${t.name} was never found. The killing stopped as it had begun, and nobody there has forgotten it.`, 'bad');
    return;
  }
  if (it.watch) { const f = folkOf(c, it.at); if (f.stores.gold >= INTRIGUE.thief.cost) { f.stores.gold -= INTRIGUE.thief.cost; it.watched++; } else it.watch = false; }
  if (chance(c, it.id * 59 + 5) < K.strike * (it.watch ? 0.5 : 1)) kill(c, it);
}

/** What the leader may do about a story now. Empty for one that is over, or that is not the player's to settle. */
export function choicesFor(c: Campaign, it: Intrigue): Choice[] {
  if (it.ended) return [];
  if (!ofTown(it)) return courtChoices(c, it);
  const f = folkOf(c, it.at), T = INTRIGUE.thief;
  const watch: Choice = it.watch ? { id: 'unwatch', label: 'Stand the watch down' } : { id: 'watch', label: `Set a watch (${T.cost} gold a season from the town)`, ...(f.stores.gold < T.cost ? { bar: 'The town has not the gold.' } : {}) };
  if (it.kind === 'thief') {
    if (it.caught === undefined || !it.thief) return [watch];
    const p = it.thief;
    return [
      { id: 'work', label: `Set ${p.gender === 'f' ? 'her' : 'him'} to work it off`, who: p },
      { id: 'pardon', label: `Pardon ${p.gender === 'f' ? 'her' : 'him'}`, who: p },
      { id: 'banish', label: `Banish ${p.gender === 'f' ? 'her' : 'him'}`, who: p },
      { id: 'hang', label: `Hang ${p.gender === 'f' ? 'her' : 'him'}`, who: p },
    ];
  }
  return [...suspected(it).map((i): Choice => ({ id: `accuse:${i}`, label: `Accuse ${fullName(it.people[i])}`, who: it.people[i] })), watch];
}
/** The leader settles something in a story. False if it could not be done. */
export function choose(c: Campaign, id: number, choice: string): boolean {
  const it = (c.intrigues ?? []).find((x) => x.id === id), T = INTRIGUE.thief;
  if (!it || it.ended) return false;
  if (!ofTown(it)) return courtChoose(c, it, choice);
  const ok = choicesFor(c, it).find((x) => x.id === choice);
  if (!ok || ok.bar) return false;
  const f = folkOf(c, it.at), where = land(c, it.at);
  if (choice === 'watch') { it.watch = true; note(c, it, 'plain', it.kind === 'thief' ? `A watch is set on the robbed houses of ${where}.` : `A watch walks ${where} by night.`); return true; }
  if (choice === 'unwatch') { it.watch = false; note(c, it, 'plain', `The watch in ${where} is stood down.`); return true; }
  if (it.kind === 'killer') { hang(c, it, Number(choice.split(':')[1]), 'you'); return true; }
  const p = it.thief!, why = it.why ?? 'greed', n = fullName(p);
  const back = (share: number): number => { const g = Math.round(it.taken * share); f.stores.gold += g; return g; };
  if (choice === 'hang') {
    strike(c, it.at, p, 'was hanged for a thief');
    shiftVirtue(c, it.owner, T.virtue.hanged + (why === 'hunger' || why === 'widow' ? T.hungerHanged : 0), { at: it.at });
    const g = back(T.back.hanged);
    end(c, it, 'hanged', `${n} of ${where} was hanged for a thief${why === 'hunger' ? ', who had stolen to eat' : why === 'widow' ? ', a soldier\'s widow' : ''}. ${g} gold was found under ${their(p)} floor.`, why === 'hunger' || why === 'widow' ? 'bad' : 'plain', p);
  } else if (choice === 'banish') {
    strike(c, it.at, p, 'was banished for a thief');
    shiftVirtue(c, it.owner, T.virtue.banished, { at: it.at });
    const g = back(T.back.banished);
    end(c, it, 'banished', `${n} was put out of ${where} for a thief, with what ${they(p)} could carry. ${g} gold was got back.`, 'plain', p);
  } else if (choice === 'work') {
    shiftVirtue(c, it.owner, T.virtue.worked, { at: it.at });
    const g = back(T.back.worked);
    end(c, it, 'worked', `${n} of ${where}, taken for a thief, was set to work off what ${they(p)} stole. ${g} gold came back to the town, and ${they(p)} is still of it.`, 'good', p);
  } else if (choice === 'pardon') {
    shiftVirtue(c, it.owner, T.virtue.pardoned, { at: it.at });
    const again = (why === 'drink' || why === 'greed') && chance(c, it.id * 53 + 7) < T.again;
    end(c, it, 'pardoned', `${n} of ${where}, taken for a thief, was pardoned before the whole town.${again ? ' It is said the lesson did not take.' : why === 'hunger' ? ' Bread was sent to the house.' : ''}`, 'good', p);
    if (again) it.again = true; // the town is not left alone for long
  } else return false;
  return true;
}

/**
 * A season of stories. Those running move on a step; a town that was lost takes its story with it; and with a
 * chance, where a town of the player's is fit for it, a new one begins. Only the player's people have them yet.
 */
export function intrigueSeason(c: Campaign): Intrigue[] {
  const T = INTRIGUE.thief, K = INTRIGUE.killer, began: Intrigue[] = [];
  for (const it of [...(c.intrigues ?? [])]) {
    if (it.ended) continue;
    if (!ofTown(it)) { courtStep(c, it); continue; }
    const t = c.territories[it.at];
    if (!t || t.owner !== it.owner || t.horde) { end(c, it, 'lost', `${t?.name ?? 'The town'} was lost, and what was afoot there (${it.kind === 'thief' ? 'a thief' : 'a killer'} never taken) went with it.`, 'plain'); continue; }
    if (it.kind === 'thief') thiefSeason(c, it); else killerSeason(c, it);
  }
  began.push(...courtBegin(c));
  if (c.turn < INTRIGUE.from) return began;
  // One town of the player's is looked at each season, a strained one for choice: the chance is the nation's, not each town's.
  if (openIntrigues(c, 0).filter(ofTown).length >= INTRIGUE.open) return began;
  const towns = c.territories.filter((t) => t.owner === 0 && !t.horde && t.folk && free(c, t.id));
  if (!towns.length) return began;
  const hard = towns.filter((t) => strained(c, t.id)), from = hard.length && chance(c, 5) < 0.7 ? hard : towns;
  const t = from[Math.floor(chance(c, 6) * from.length)], f = folkOf(c, t.id), k = strained(c, t.id);
  if (grown(f) >= K.grown && chance(c, 7) < K.chance * (k ? K.strained : 1)) began.push(beginKiller(c, t.id));
  else if (f.stores.gold >= T.gold && grown(f) >= 4 && chance(c, 8) < T.chance * (k ? T.strained : 1)) began.push(beginThief(c, t.id));
  return began;
}

/** One line on where a story stands, for a panel. */
export function standing(c: Campaign, it: Intrigue): string {
  if (it.ended) return it.ended.text;
  if (!ofTown(it)) return courtStanding(c, it);
  if (it.kind === 'thief') return it.caught !== undefined && it.thief
    ? `${fullName(it.thief)} the ${it.thief.trade} is held for the robberies in ${land(c, it.at)}. ${WHY[it.why ?? 'greed'](it.thief)}.`
    : `A thief has robbed the same ${it.people.length} houses of ${land(c, it.at)} ${((n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`))(it.robbed.reduce((a, b) => a + b, 0))}; ${it.taken} gold is gone.${it.watch ? ' A watch is kept.' : ''}`;
  const left = suspected(it);
  return `${it.victims.length} dead in ${land(c, it.at)}. ${left.length === 1 ? `Only ${fullName(it.people[left[0]])} is still spoken of.` : `${left.length} are spoken of.`}${it.watch ? ' A watch walks by night.' : ''}`;
}
