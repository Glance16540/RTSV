/**
 * A rival that thinks as a people: its war aim (docs/DESIGN.md, "Rivals live by the same rules"). A computer-led
 * nation used to weigh only the lands beside each army, season by season, so it never went anywhere on purpose.
 * Now it sets its heart on one land worth having and goes for it over several seasons:
 * - a chief town (another people's capital), a rich town (many people, many works, good country), or a town that
 *   was taken from it, which it wants back (conquered.ts keeps whom a town was taken from);
 * - the further off, the less it is wanted: every land between must be taken or crossed first.
 * The aim steers the marches it already makes and decides none of them. Of the lands an army dares, one that
 * brings it nearer the aim goes first (`aimFirst`); an army with nothing to dare walks through its own lands to
 * the border nearest the aim (`planStep`). An aim is kept for `PLAN.keep` seasons, or until it is taken, or a
 * truce covers it, or an army has stood before the way to it and balked (`balk`): then another is chosen, and
 * the one given up is left alone for `PLAN.rest` seasons.
 * Plain data on the campaign, by nation. The computer plays by it for whoever it plays.
 */
import type { Army, Campaign } from './campaign';
import { armyStrength, atTruce, reach } from './campaignbase';
import { countryYield } from './country';
import { nobodyThere } from './founding';
import { headcount } from './township';

export const PLAN = {
  /** How many lands beyond its own border a people looks for an aim. */
  far: 4,
  /** What a chief town is worth, a town once its own, and each point of a town's riches. */
  chief: 6, revenge: 8, rich: 1,
  /** What each land of the way costs the wanting of it. */
  step: 2,
  /** Seasons an aim is kept before the people thinks again; and seasons an aim given up is left alone. */
  keep: 12, rest: 8,
  /** People in a town to a point of riches. */
  people: 40,
};
export type AimWhy = 'chief' | 'revenge' | 'rich';
export interface WarPlan { aim: number; since: number; why: AimWhy; /** Aims given up, and the turn each was. */ balked?: Record<string, number> }
declare module './campaign' {
  interface Campaign { /** Each computer-led people's war aim (rivalplan.ts). */ plans?: Record<string, WarPlan> }
}

/** May this people march into this land at all: not its own, not under a truce, and somebody there to conquer. */
const foreign = (c: Campaign, f: number, tid: number): boolean => {
  const t = c.territories[tid];
  return !!t && t.owner !== f && !atTruce(c, f, t.owner) && !nobodyThere(c, tid);
};
/**
 * How many marches each land is from a land, for this people: through its own lands and through lands it may
 * march into, never across a truce or an empty land. The land itself is 0.
 */
export function marchesTo(c: Campaign, f: number, to: number): Map<number, number> {
  const from = c.territories.filter((t) => t.owner === f || foreign(c, f, t.id)).map((t) => ({ id: t.id, into: reach(c, t.id) }));
  const d = new Map<number, number>([[to, 0]]), queue = [to];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const t of from) {
      if (d.has(t.id) || !t.into.includes(cur)) continue; // t marches into cur
      d.set(t.id, d.get(cur)! + 1);
      queue.push(t.id);
    }
  }
  return d;
}
/** A town's riches: its people, its works and its country. */
export function riches(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  return (t.folk ? headcount(t.folk) / PLAN.people : 0) + t.buildings.length + Math.max(0, countryYield(c, tid));
}
/** Why a land would be aimed at: taken from this people, another's chief town, or only rich. */
export function whyAim(c: Campaign, f: number, tid: number): AimWhy {
  const t = c.territories[tid];
  if (t.yoke?.from === f) return 'revenge';
  if (t.capital >= 0 && t.capital === t.owner) return 'chief';
  return 'rich';
}
/** What a land is worth to a people as a war aim, `away` marches from its nearest land. The higher, the more wanted. */
export function aimWorth(c: Campaign, f: number, tid: number, away: number): number {
  const why = whyAim(c, f, tid);
  return PLAN.rich * riches(c, tid) + (why === 'revenge' ? PLAN.revenge : why === 'chief' ? PLAN.chief : 0) - PLAN.step * Math.max(0, away - 1);
}
/** The lands a people might aim at, the most wanted first: within `PLAN.far` marches of its own, and not lately given up. */
export function aimsOf(c: Campaign, f: number): { id: number; worth: number; away: number }[] {
  const own = c.territories.filter((t) => t.owner === f && !t.horde);
  if (!own.length) return [];
  const balked = c.plans?.[f]?.balked ?? {};
  // How far each land is from the people's nearest: one flood out of all its lands together.
  const away = new Map<number, number>(own.map((t) => [t.id, 0])), queue = own.map((t) => t.id);
  while (queue.length) {
    const cur = queue.shift()!;
    if (away.get(cur)! >= PLAN.far) continue;
    for (const n of reach(c, cur)) {
      if (away.has(n) || !foreign(c, f, n)) continue;
      away.set(n, away.get(cur)! + 1);
      queue.push(n);
    }
  }
  return [...away].filter(([id, n]) => n > 0 && !(balked[id] !== undefined && c.turn - balked[id] <= PLAN.rest))
    .map(([id, n]) => ({ id, away: n, worth: aimWorth(c, f, id, n) }))
    .sort((a, b) => b.worth - a.worth || a.id - b.id);
}
/** Does an aim still stand: not yet taken, not under a truce, somebody there, and not kept too long? */
const stands = (c: Campaign, f: number, p: WarPlan): boolean => foreign(c, f, p.aim) && c.turn - p.since <= PLAN.keep;
/** The land a people has set its heart on, choosing one if it has none that stands. -1 if there is nothing to want. */
export function aimOf(c: Campaign, f: number): number {
  const plans = (c.plans ??= {});
  const p = plans[f];
  if (p && p.aim >= 0 && stands(c, f, p)) return p.aim;
  const best = aimsOf(c, f)[0];
  const balked = p?.balked;
  if (!best) { plans[f] = { aim: -1, since: c.turn, why: 'rich', ...(balked ? { balked } : {}) }; return -1; }
  plans[f] = { aim: best.id, since: c.turn, why: whyAim(c, f, best.id), ...(balked ? { balked } : {}) };
  return best.id;
}
/** The plan as it stands, without choosing: for whoever shows a rival's mind, and for tests. */
export const planOf = (c: Campaign, f: number): WarPlan | undefined => c.plans?.[f];
/**
 * Of the lands an army might march on from where it stands, those that bring it nearer the aim go first, each
 * group in the order given. The aim itself is nearest of all.
 */
export function aimFirst(c: Campaign, f: number, from: number, targets: readonly number[]): number[] {
  const aim = aimOf(c, f);
  if (aim < 0 || !targets.length) return [...targets];
  const d = marchesTo(c, f, aim), here = d.get(from);
  if (here === undefined) return [...targets];
  const nearer = (id: number): boolean => (d.get(id) ?? Infinity) < here;
  return [...targets.filter(nearer), ...targets.filter((id) => !nearer(id))];
}
/**
 * An army with nothing it dares goes toward the aim through its own lands: the neighbour of its own that is
 * nearer the aim than where it stands, or -1 if there is none (it stands as near as its own lands go).
 */
export function planStep(c: Campaign, f: number, from: number): number {
  const aim = aimOf(c, f);
  if (aim < 0) return -1;
  const d = marchesTo(c, f, aim), here = d.get(from);
  if (here === undefined) return -1;
  const next = reach(c, from).filter((n) => c.territories[n].owner === f && (d.get(n) ?? Infinity) < here)
    .sort((a, b) => d.get(a)! - d.get(b)! || a - b)[0];
  return next ?? -1;
}
/** Does an army stand where the way to the aim leaves its people's own lands: a land it may not yet dare is next? */
export function beforeAim(c: Campaign, f: number, from: number): boolean {
  const aim = c.plans?.[f]?.aim ?? -1;
  if (aim < 0 || !foreign(c, f, aim)) return false;
  const d = marchesTo(c, f, aim), here = d.get(from);
  return here !== undefined && planStep(c, f, from) < 0 && reach(c, from).some((n) => foreign(c, f, n) && (d.get(n) ?? Infinity) < here);
}
/**
 * A people's strongest army stood before the way to the aim and did not dare it: the aim is given up, and left
 * alone a while. A lesser army balking gives nothing up: the strongest may yet come. Returns whether it was given up.
 */
export function balk(c: Campaign, f: number, army: Army): boolean {
  const p = c.plans?.[f];
  if (!p || p.aim < 0 || !beforeAim(c, f, army.at)) return false;
  if (c.armies.some((a) => a.owner === f && a.id !== army.id && armyStrength(a, c) > armyStrength(army, c))) return false;
  (p.balked ??= {})[p.aim] = c.turn;
  for (const k of Object.keys(p.balked)) if (c.turn - p.balked[k] > PLAN.rest) delete p.balked[k];
  p.aim = -1;
  p.since = c.turn - PLAN.keep - 1; // nothing stands: the next asking chooses again
  return true;
}
/** The aim in words, for whoever shows a rival's mind. */
export function planText(c: Campaign, f: number): string {
  const p = c.plans?.[f];
  if (!p || p.aim < 0 || !foreign(c, f, p.aim)) return '';
  const name = c.territories[p.aim].name;
  return p.why === 'revenge' ? `They mean to have ${name} back.` : p.why === 'chief' ? `They mean to take ${name}, a chief town.` : `They have their eye on ${name}, a rich town.`;
}
