// Nobles who act (the owner's "nobles you can deal with": a content lord helps in need, an angry one withholds or plots).
//
// Once a season, for every living nation, after its nobles have been reckoned (nobles.ts):
//   - A content lord (mood ACTS.content or more) answers the nation's need, at most once in ACTS.every seasons:
//       men: a town of the nation struck by a band in the last season and left with fewer than ACTS.fewMen grown men
//            has ACTS.men of the lord's own young men sent to it, from a town of his that keeps ACTS.keepMen after;
//       goods: while the nation is at war (rivalrule.ts, `warFooting`) and its chief town is short of gold (under
//            ACTS.poor), the lord sends ACTS.purse gold of his own into it: new goods, out of his purse, not a town's.
//   - An angry lord withholds his due: ACTS.withhold gold a season goes from his town's stores to his own keeping, and
//     the nation sees none of it.
//   - An angry noble of the player's joins a plot that is afoot and not yet found out (courtstory.ts): each one who
//     joins brings its rising a season nearer. (The rising's odds already count every angry noble.)
// The player is told each by name, in the log and the season's report; a rival's nobles act by the same rules unseen.
// Real people only move between towns of the nation, with their ages; no child is ever sent.
import type { Campaign } from './campaign';
import type { Noble } from './nobles';
import { isAngry, noblesOf, titleOf } from './nobles';
import { folkOf } from './township';
import { agesOf, countFrom } from './ageing';
import { warFooting } from './rivalrule';

declare module './nobles' {
  interface Noble {
    /** The season this noble last answered the nation's need (nobleacts.ts). */
    gave?: number;
    /** The plot this noble has joined (nobleacts.ts): its id. */
    joined?: number;
    /** The last season this noble withheld their due (nobleacts.ts). */
    withheld?: number;
  }
}

export const ACTS = {
  /** At or above this mood a lord is content enough to help. */
  content: 30,
  /** At most once in so many seasons. */
  every: 4,
  /** Men sent to a struck town, the fewest grown men a town has before it is helped, the most the lord's town keeps after. */
  men: 2, fewMen: 4, keepMen: 6,
  /** Gold out of the lord's purse, and the chief town's gold under which it is short. */
  purse: 80, poor: 150,
  /** Gold an angry lord withholds a season. */
  withhold: 40,
};

const tell = (c: Campaign, f: number, tid: number, tone: 'good' | 'bad' | 'plain', text: string): void => {
  if (f !== 0) return;
  c.log.push(text);
  (c.intrigueNews ??= []).push({ turn: c.turn, id: -1, kind: 'plot', at: tid, owner: f, tone, text });
};
const his = (n: Noble): string => (n.female ? 'her' : 'his');
const mine = (c: Campaign, f: number) => c.territories.filter((t) => t.owner === f && !t.horde);
const struck = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.at === tid && ['raid', 'carried'].includes(e.kind) && e.turn >= c.turn - 1);
const chiefOf = (c: Campaign, f: number): number => { const m = mine(c, f); return (m.find((t) => t.capital === f) ?? m[0])?.id ?? -1; };

/** Send `n` of a town's youngest grown men to another town of the nation, with their ages. Returns how many went. */
export function sendMen(c: Campaign, from: number, to: number, n: number): number {
  const a = folkOf(c, from), b = folkOf(c, to), ages = agesOf(c, from, a), there = agesOf(c, to, b);
  const k = Math.max(0, Math.min(n, ages.m.length));
  if (!k) return 0;
  ages.m.sort((x, y) => x - y);
  there.m.push(...ages.m.splice(0, k));
  countFrom(a, ages); countFrom(b, there);
  return k;
}

/** A content lord answers the nation's need, if there is one he can answer. Returns what he did, or ''. */
function help(c: Campaign, f: number, n: Noble): string {
  if (n.rank !== 'lord' || n.mood < ACTS.content || (n.gave !== undefined && n.gave > c.turn - ACTS.every)) return '';
  const own = folkOf(c, n.town);
  const town = mine(c, f).find((t) => t.id !== n.town && struck(c, t.id) && folkOf(c, t.id).men < ACTS.fewMen);
  if (town && own.men - ACTS.men >= ACTS.keepMen) {
    const went = sendMen(c, n.town, town.id, ACTS.men);
    if (went) { n.gave = c.turn; tell(c, f, town.id, 'good', `${titleOf(c, n)} sends ${went} of ${his(n)} young men to ${town.name}, struck and short of men.`); return 'men'; }
  }
  const chief = chiefOf(c, f);
  if (chief >= 0 && warFooting(c, f) === 'war' && folkOf(c, chief).stores.gold < ACTS.poor) {
    folkOf(c, chief).stores.gold += ACTS.purse;
    n.gave = c.turn;
    tell(c, f, chief, 'good', `${titleOf(c, n)} sends ${ACTS.purse} gold of ${his(n)} own for the war.`);
    return 'goods';
  }
  return '';
}

/** An angry lord withholds his due from his town's stores. Returns the gold withheld. */
function withhold(c: Campaign, f: number, n: Noble): number {
  if (n.rank !== 'lord' || !isAngry(n)) return 0;
  const s = folkOf(c, n.town).stores, kept = Math.min(Math.max(0, s.gold), ACTS.withhold);
  s.gold -= kept;
  if (kept <= 0) return 0;
  if (n.withheld !== c.turn - 1) tell(c, f, n.town, 'bad', `${titleOf(c, n)} is angry, and withholds ${his(n)} due from ${c.territories[n.town]?.name ?? ''}.`); // told when it begins
  n.withheld = c.turn;
  return kept;
}

/** Angry nobles of the player's join a plot afoot and not yet found out: each brings its rising a season nearer. */
function joinPlots(c: Campaign): number {
  const plot = (c.intrigues ?? []).find((it) => it.kind === 'plot' && !it.ended && !it.found && it.owner === 0);
  if (!plot || plot.due === undefined) return 0;
  const plotter = plot.nobles?.[plot.culprit]?.key;
  let joined = 0;
  for (const n of noblesOf(c, 0)) {
    if (!isAngry(n) || n.key === plotter || n.joined === plot.id) continue;
    n.joined = plot.id; plot.due = Math.max(c.turn + 1, plot.due - 1); joined++;
  }
  if (joined) tell(c, 0, plot.at, 'bad', `More of the great are whispered to have joined the plot at court. It ripens the sooner.`);
  return joined;
}

/** A season of one nation's nobles acting. */
export function nobleActsSeason(c: Campaign, f: number): void {
  if (!c.factions[f]?.alive) return;
  for (const n of noblesOf(c, f)) { if (!help(c, f, n)) withhold(c, f, n); }
  if (f === 0) joinPlots(c);
}
/** A season of every living nation's nobles acting. */
export function nobleActsSeasons(c: Campaign): void {
  for (const x of c.factions) nobleActsSeason(c, x.id);
}
