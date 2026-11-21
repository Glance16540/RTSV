// A governor's standing orders (docs/DESIGN.md: "the governor cannot be given orders of his own"; the gathering
// session's job, 17 November 2026). From the land's panel the player tells a town's governor, until told otherwise:
//   - what to put first: food, walls, faith, trade or arms. Where the player has not set the town's work himself (in a
//     battle or a visit), its people are set to it by what comes first; and once the town wants for nothing more
//     pressing (bread, a roof, a wall after a raid), the governor raises what serves it: Farmland, a Fortress, a Church
//     or Barracks (trade asks only for hands at the gold);
//   - what he is not to build, of what he would raise himself;
//   - how much to keep in store before he spends: a little (half the usual), the usual, or much (twice);
//   - whether its people may leave: families moving on (migration.ts), settlers founding a town, both or neither;
//   - whether he may learn the studies taught in the town, when it has the means (governworks.ts).
// Rule first raises a Hall of Judgement where the nation has none, else a Noble's Manor in a town big enough; faith first
// raises a Monastery once the town's Church stands and the town keeps the faith (governworks.ts, the owner's design: "Rule,
// law, nobles and faith").
// A town with no standing orders is governed as before: the computer's towns have none, and so keep their present sense.
// Plain data on the town, kept in the save; the governor (governor.ts) and migration (migration.ts) read it.
import type { Campaign, Territory } from './campaign';
import type { Stores } from './township';

export type Focus = 'food' | 'walls' | 'faith' | 'trade' | 'arms' | 'rule';
export type KeepLevel = 'little' | 'usual' | 'much';
export type Leave = 'both' | 'families' | 'settlers' | 'none';
export interface Standing { first?: Focus; never?: string[]; keep?: KeepLevel; leave?: Leave; /** He may learn the studies taught in the town (governworks.ts). */ learn?: boolean; /** The army standing in the town at which it stops training, in companies (townmuster.ts; DRILL.most if not set). */ drillStop?: number }

declare module './campaign' {
  interface Territory {
    /** The governor's standing orders, given from the land's panel (townorders.ts). */
    standing?: Standing;
  }
}

/** What each thing put first asks: where the hands go, and what the governor raises once the town wants for nothing more. */
export const FOCUS: Record<Focus, { name: string; work: Stores; raise?: string; says: string }> = {
  food: { name: 'Food', work: { food: 0.65, wood: 0.15, gold: 0.1, stone: 0.1 }, raise: 'farm', says: 'more hands at the fields, and Farmland raised when the town can spare it' },
  walls: { name: 'Walls', work: { food: 0.45, wood: 0.15, gold: 0.1, stone: 0.3 }, raise: 'fortress', says: 'hands at the quarry, and a Fortress raised when the town can spare it, raided or not' },
  faith: { name: 'Faith', work: { food: 0.5, wood: 0.2, gold: 0.15, stone: 0.15 }, raise: 'church', says: 'a Church raised when the town can spare it, to keep its people to the holy way, and a Monastery once the Church stands and the town keeps the faith' },
  trade: { name: 'Trade', work: { food: 0.45, wood: 0.15, gold: 0.3, stone: 0.1 }, says: 'more hands at the gold, and nothing raised for it' },
  arms: { name: 'Arms', work: { food: 0.45, wood: 0.25, gold: 0.2, stone: 0.1 }, raise: 'barracks', says: 'hands at the wood and the gold, and Barracks raised when the town can spare it' },
  rule: { name: 'Rule', work: { food: 0.45, wood: 0.2, gold: 0.2, stone: 0.15 }, says: 'a Hall of Judgement raised where your nation has none, else a Noble\'s Manor in a town big enough, when the town can spare it' },
};
export const FOCI = Object.keys(FOCUS) as Focus[];
/** How much the governor keeps in store before he spends, against the usual. */
export const KEEP_TIMES: Record<KeepLevel, number> = { little: 0.5, usual: 1, much: 2 };
export const KEEP_WORDS: Record<KeepLevel, string> = { little: 'little: he spends down to half the usual stock', usual: 'the usual working stock', much: 'much: he keeps twice the usual stock before he spends' };
export const LEAVE_WORDS: Record<Leave, string> = { both: 'families may move on and settlers found towns', families: 'families may move on, but no settlers go', settlers: 'settlers may found towns, but no family moves on', none: 'nobody leaves: no family moves on and no settlers go' };
/** What a governor may be told not to build: what he raises himself. */
export const NEVER_CHOICES = ['farm', 'house', 'fortress', 'mill', 'well', 'infirmary', 'granary', 'church', 'barracks', 'hall', 'manor', 'monastery'];

/** The most companies a town may be told to train up to: a full army (campaignbase.ts MAX_ARMY). */
export const DRILL_MOST_ARMY = 12;
/** Where a town may be told to stop training: the army standing in it, in companies. */
export const DRILL_STOPS = [2, 4, 6, 8, 12];

/** A town's standing orders, or none. */
export const standingOf = (t: Territory | undefined): Standing => t?.standing ?? {};
/** Where its people work by what comes first, where the player has not set its work: or null. */
export const focusWork = (t: Territory): Stores | null => { const f = standingOf(t).first; return f && !t.orders?.work ? { ...FOCUS[f].work } : null; };
/** How many times the usual stock the governor keeps before he spends. */
export const keepTimes = (t: Territory): number => KEEP_TIMES[standingOf(t).keep ?? 'usual'];
/** Is the governor told not to build this? */
export const forbids = (t: Territory, type: string): boolean => (standingOf(t).never ?? []).includes(type);
/** What the governor raises for what comes first, if anything and if he is not told not to. */
export const raiseFor = (t: Territory): string | undefined => { const f = standingOf(t).first, r = f ? FOCUS[f].raise : undefined; return r && !forbids(t, r) ? r : undefined; };
/** May a family move on, or settlers go, from this town? */
export function mayLeave(c: Campaign, tid: number, who: 'family' | 'settlers'): boolean {
  const l = standingOf(c.territories[tid]).leave ?? 'both';
  return l === 'both' || (who === 'family' ? l === 'families' : l === 'settlers');
}

/** Give a town's governor a standing order: only the player's own towns. Returns '' when given, or why not. */
export function setStanding(c: Campaign, tid: number, order: Partial<{ first: Focus | null; never: string[]; keep: KeepLevel; leave: Leave; learn: boolean; drillStop: number | null }>): string {
  const t = c.territories[tid];
  if (!t || t.owner !== 0 || t.horde) return 'Only a town of your own.';
  const s: Standing = { ...standingOf(t) };
  if (order.first !== undefined) { if (order.first === null) delete s.first; else if (FOCI.includes(order.first)) s.first = order.first; else return 'No such order.'; }
  if (order.never !== undefined) s.never = order.never.filter((x) => NEVER_CHOICES.includes(x));
  if (order.keep !== undefined) { if (!(order.keep in KEEP_TIMES)) return 'No such order.'; s.keep = order.keep; }
  if (order.leave !== undefined) { if (!(order.leave in LEAVE_WORDS)) return 'No such order.'; s.leave = order.leave; }
  if (order.learn !== undefined) { if (order.learn) s.learn = true; else delete s.learn; }
  if (order.drillStop !== undefined) { if (order.drillStop === null) delete s.drillStop; else if (Number.isInteger(order.drillStop) && order.drillStop >= 1 && order.drillStop <= DRILL_MOST_ARMY) s.drillStop = order.drillStop; else return 'No such order.'; }
  if (!s.never?.length) delete s.never;
  if (s.keep === 'usual') delete s.keep;
  if (s.leave === 'both') delete s.leave;
  if (Object.keys(s).length) t.standing = s; else delete t.standing;
  return '';
}

/** A town's standing orders in words, for the land's panel. */
export function standingText(t: Territory, names: (type: string) => string): string {
  const s = standingOf(t);
  if (!Object.keys(s).length) return 'The governor keeps the town by his own sense: no standing orders.';
  const parts = [
    s.first ? `${FOCUS[s.first].name} first: ${FOCUS[s.first].says}${t.orders?.work && s.first ? ' (your own orders for its work stand, so its hands stay as you set them)' : ''}` : '',
    s.never?.length ? `never to build ${s.never.map(names).join(', ')}` : '',
    s.keep ? `to keep ${KEEP_WORDS[s.keep]}` : '',
    s.leave ? LEAVE_WORDS[s.leave] : '',
    s.learn ? 'to learn the studies taught in the town when it has the means' : '',
    s.drillStop !== undefined ? `to train until the army in the town is ${s.drillStop} companies strong` : '', // the "Train up to" order, said too (a town with only it said nothing)
  ].filter(Boolean);
  return `The governor's standing orders: ${parts.join('; ')}.`;
}
