/**
 * A town taken (docs/DESIGN.md). Its people stay, and become the taker's over time: resentful at first and likely
 * to rise, sooner settled where they are ruled well. Resentment is a state on the town (`Territory.yoke`), 0 to 100.
 * It eases every season, faster under good rule; while it is high the town may rise. A rising with no army in the
 * town throws the taker off: the town goes back to the people it was taken from if they still stand, and otherwise
 * to its own tribe. A rising with an army in the town is put down, at a cost, and is not forgotten.
 * Who in the town is still of the old people, and what their grudge costs its holder meanwhile, is oldpeople.ts.
 */
import { lawEase } from './writtenlaw'; // written law eases resentment (writtenlaw.ts)
import type { Campaign } from './campaign';
import { armyAt, armySize, FAITH, faithOf } from './campaignbase';
import { creedOf } from './creed';
import { faithAt } from './townfaith';
import { leaderAt } from './court';
import { folkOf, headcount } from './township';
import { agesOf } from './ageing';
import { yokeEase, yokeSpared } from './ownstudies';
import { oldSeason } from './oldpeople';

/** `from`: whose it was (-1 for a tribe). `since`: the turn it was taken. `resent`: how its people take it, 0 to 100. */
export interface Yoke { from: number; since: number; resent: number; /** The last turn an army of its holder stood in it. */ held?: number; /** It has settled: it resents nothing more, and is remembered as taken until `YOKE.memory` seasons are up. */ settled?: boolean }
export const YOKE = {
  /** How a town taken from a nation, or from a tribe, feels at first; more if it was their chief town. */
  nation: 80, tribe: 65, capital: 20,
  /** What a season takes off by itself, and what good rule adds to that. */
  ease: 1, church: 3, farm: 2, leader: 4, pious: 2,
  /** What bad rule puts back: a tavern in a town that did not ask for one, and a season in which the town was struck and not protected. */
  tavern: 2, struck: 6,
  /** Under this a town is settled enough not to rise. `revolt` scales the chance, which grows with the square of the resentment above `quiet` and is never more than certain. */
  quiet: 15, revolt: 8.0,
  /** An army in the town makes a rising this much less likely; putting one down adds this to the resentment. */
  garrison: 0.03, putDown: 10,
  /** A town that has had an army in it settles this much faster each such season, and for this many seasons after the army leaves it is cowed: a rising is `cowedBy` as likely (at 0 it does not rise). */
  order: 3, cowed: 8, cowedBy: 0,
  /** Seasons a town is remembered as taken. For that long it rises only by its resentment, never by the common run of unrest (campaign.ts). */
  memory: 20,
};
/** The kinds of thing that befall a town and are held against whoever rules it. */
const STRUCK = ['raid', 'carried', 'famine', 'plague', 'blaze', 'raiders', 'taken'];

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const nameOf = (c: Campaign, f: number): string => (f < 0 ? 'the local tribes' : f === 0 ? 'you' : `the ${c.factions[f].name}`);
const ruleOf = (c: Campaign, f: number): string => (f === 0 ? 'your rule' : `the rule of ${nameOf(c, f)}`);

/** How resentful a town is of whoever holds it: 0 for a town that was never taken, or has settled. */
export const resentOf = (c: Campaign, tid: number): number => c.territories[tid]?.yoke?.resent ?? 0;
/** Resentful enough to show in its people's faces. */
export const resentful = (c: Campaign, tid: number): boolean => resentOf(c, tid) >= YOKE.quiet;

/**
 * A town changes hands by force. Call it before the new holder is written down, with who held it and who takes it.
 * Taken back by the people it was taken from, it is free of the yoke; otherwise it begins resentful.
 */
export function townTaken(c: Campaign, tid: number, from: number, to: number): void {
  const t = c.territories[tid];
  if (!t || to < 0 || from === to) { if (t) delete t.yoke; return; }
  if (t.yoke && t.yoke.from === to) { delete t.yoke; return; } // its own people have it back
  if (headcount(folkOf(c, tid)) === 0) { delete t.yoke; return; } // a dead town: there is nobody in it to resent anything (deadtown.ts)
  t.yoke = { from, since: c.turn, resent: Math.max(0, Math.min(100, (from < 0 ? YOKE.tribe : YOKE.nation) + (t.capital >= 0 && t.capital === from ? YOKE.capital : 0)) - yokeSpared(c, to)) }; // less under a people whose own study it is to rule others (ownstudies.ts)
}
/** How much resentment a season of this rule takes off (or, where rule is bad, puts on: a negative number). */
export function goodRule(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0) return 0;
  const struck = (c.events ?? []).some((e) => e.at === tid && e.turn === c.turn && STRUCK.includes(e.kind));
  return YOKE.ease + yokeEase(c, tid) + lawEase(c, tid) + (t.buildings.includes('church') ? YOKE.church : 0) + (t.buildings.includes('farm') ? YOKE.farm : 0) + (leaderAt(c, t.owner, tid) ? YOKE.leader : 0)
    + (FAITH[creedOf(faithAt(c, tid)).id].defence > 1 ? YOKE.pious : 0) /* the town's own standing (townfaith.ts) */ - (t.buildings.includes('tavern') ? YOKE.tavern : 0) - (struck ? YOKE.struck : 0);
}
/** The chance a town rises this season, as things stand; or, with `bare`, as it would be with no army in it or lately gone from it. */
export function revoltChance(c: Campaign, tid: number, opts: { bare?: boolean } = {}): number {
  const t = c.territories[tid], r = resentOf(c, tid);
  if (!t || t.owner < 0 || r <= YOKE.quiet || leaderAt(c, t.owner, tid)) return 0;
  const a = armyAt(c, tid), y = t.yoke!;
  const held = !opts.bare && !!a && a.owner === t.owner, cowed = !opts.bare && !held && y.held !== undefined && c.turn - y.held <= YOKE.cowed;
  const faith = faithOf(c, t.owner);
  return Math.min(1, YOKE.revolt * ((r - YOKE.quiet) / (100 - YOKE.quiet)) ** 2 * (held ? YOKE.garrison : cowed ? YOKE.cowedBy : 1) * (faith.steadfast ? 0.5 : faith.restless ? 1.5 : 1));
}

export interface YokeNews { at: number; kind: 'rose' | 'put down' | 'settled'; owner: number; to?: number }
/**
 * A season under the yoke, for every town that bears one: resentment eases by the rule it has had, a town that
 * has settled is the taker's own from then on, and a town still resentful may rise.
 */
export function seasonOfYoke(c: Campaign): YokeNews[] {
  const news: YokeNews[] = [];
  oldSeason(c); // the old people of taken towns are counted, and some join the taker (oldpeople.ts)
  for (const t of c.territories) {
    const y = t.yoke;
    if (!y) continue;
    if (t.owner < 0 || t.horde) { delete t.yoke; continue; }
    const owner = t.owner, mine = owner === 0;
    const garrison = armyAt(c, t.id);
    if (garrison && garrison.owner === owner) y.held = c.turn;
    if (hash(c.seed * 131 + t.id, c.turn * 977 + 5) < revoltChance(c, t.id)) {
      const a = armyAt(c, t.id), f = folkOf(c, t.id);
      if (a && a.owner === owner) {
        // Put down: a man of the town dies for it (unless he is its last), the garrison is the worse for it, and nobody forgets.
        if (f.men > (f.women > 0 ? 1 : 0)) { f.men--; if (f.ages) agesOf(c, t.id, f); } // never the last man of a town with women in it (as township.ts's toll)
        if (armySize(a) > 1) { const type = Object.keys(a.units).sort((p, q) => a.units[q] - a.units[p])[0]; if (--a.units[type] <= 0) delete a.units[type]; }
        y.resent = Math.min(100, y.resent + YOKE.putDown);
        c.log.push(`${t.name} rose against ${mine ? 'you' : nameOf(c, owner)} and the garrison put it down. It is not forgotten there.`);
        (c.events ??= []).push({ kind: 'calm', at: t.id, turn: c.turn, until: c.turn }); // put down, and over: not the common run of unrest, which would come to a head again next season (campaign.ts)
        news.push({ at: t.id, kind: 'put down', owner });
        continue;
      }
      const back = y.from >= 0 && y.from !== owner && c.factions[y.from]?.alive ? y.from : -1;
      c.log.push(`${t.name} has risen and thrown off ${ruleOf(c, owner)}${back >= 0 ? `, and gone back to ${nameOf(c, back)}` : ''}.`);
      (c.chronicle ??= []).push({ turn: c.turn, text: `${t.name}, taken ${c.turn - y.since} seasons before, rose and threw off ${ruleOf(c, owner)}${back >= 0 ? ` and went back to ${nameOf(c, back)}` : ''}.` });
      (c.events ??= []).push({ kind: 'revolt', at: t.id, turn: c.turn, until: c.turn });
      t.owner = back;
      if (back < 0) t.militia = Math.max(2, Math.min(4, Math.ceil(f.men / 2)));
      delete t.yoke;
      news.push({ at: t.id, kind: 'rose', owner, to: back });
      continue;
    }
    if (y.settled) { if (c.turn - y.since >= YOKE.memory) delete t.yoke; continue; }
    y.resent = Math.max(0, Math.min(100, y.resent - goodRule(c, t.id) - (y.held === c.turn ? YOKE.order : 0)));
    if (y.resent <= 0) {
      y.settled = true;
      if (c.turn - y.since >= YOKE.memory) delete t.yoke;
      c.log.push(`The people of ${t.name} now count themselves ${mine ? 'yours' : `among ${nameOf(c, owner)}`}.`);
      news.push({ at: t.id, kind: 'settled', owner });
    }
  }
  return news;
}
