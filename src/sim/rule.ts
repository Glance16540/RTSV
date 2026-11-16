// The season's turn for the buildings of rule, law, nobles and faith (hall.ts, and the rest as they come): what a
// rival nation raises of them, one call for campaign.ts. Kept apart from the buildings' own rules, which are read by
// decrees, drift and nobles, so that raising them (townworks.ts) is not in a ring with those.
import type { Campaign } from './campaign';
import { BUILDINGS } from './data';
import { STORE_KINDS, folkOf, grown } from './township';
import { manorNeeds } from './manor';
import { faithAt } from './townfaith';
import { isHoly } from './creed';
import { begunAt, raiseBar, raiseWork } from './townworks';
import { STUDY_KEEP } from './studies';
import { feastSeason } from './feastdays';

/** A rival raises one of these in its chief town when its stores there hold this many working stocks over the cost. */
export const RULE_KEEP = 1.5;

/** A season for one rival nation: it raises a Hall of Judgement in its chief town when it has none begun and can spare the stores. */
export function hallSeason(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return false;
  const mine = c.territories.filter((t) => t.owner === f && !t.horde);
  if (mine.some((t) => begunAt(c, t.id, 'hall'))) return false;
  const chief = mine.find((t) => t.capital === f) ?? mine[0];
  if (!chief) return false;
  const s = folkOf(c, chief.id).stores, cost = BUILDINGS.hall.cost;
  const left = STORE_KINDS.reduce((n, k) => n + s[k] - (cost[k] ?? 0), 0);
  if (left < RULE_KEEP * STUDY_KEEP || raiseBar(c, f, chief.id, 'hall')) return false;
  return raiseWork(c, f, chief.id, 'hall') === '';
}

/** A season for one rival nation: it raises a Noble's Manor in its largest town that has none, when it can spare the stores there. */
export function manorSeason(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return false;
  const big = c.territories.filter((t) => t.owner === f && !t.horde && !begunAt(c, t.id, 'manor') && grown(folkOf(c, t.id)) >= manorNeeds()).sort((a, b) => grown(folkOf(c, b.id)) - grown(folkOf(c, a.id)) || a.id - b.id)[0];
  if (!big) return false;
  const s = folkOf(c, big.id).stores, cost = BUILDINGS.manor.cost;
  const left = STORE_KINDS.reduce((n, k) => n + s[k] - (cost[k] ?? 0), 0);
  if (left < RULE_KEEP * STUDY_KEEP || raiseBar(c, f, big.id, 'manor')) return false;
  return raiseWork(c, f, big.id, 'manor') === '';
}

/** A season for one rival nation: it raises a Monastery in its most faithful town that keeps the faith and has none, when it can spare the stores there. */
export function monasterySeason(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return false;
  const holiest = c.territories.filter((t) => t.owner === f && !t.horde && !begunAt(c, t.id, 'monastery') && isHoly(faithAt(c, t.id))).sort((a, b) => faithAt(c, b.id) - faithAt(c, a.id) || a.id - b.id)[0];
  if (!holiest) return false;
  const s = folkOf(c, holiest.id).stores, cost = BUILDINGS.monastery.cost;
  const left = STORE_KINDS.reduce((n, k) => n + s[k] - (cost[k] ?? 0), 0);
  if (left < RULE_KEEP * STUDY_KEEP || raiseBar(c, f, holiest.id, 'monastery')) return false;
  return raiseWork(c, f, holiest.id, 'monastery') === '';
}

/** A season for every rival nation's works of rule and faith: at most one begun a season, the Hall first, then a Manor, then a Monastery. */
export function rulesSeason(c: Campaign): void {
  feastSeason(c); // the year's feast, for nations that keep Feast Days (feastdays.ts)
  for (const x of c.factions) { if (!hallSeason(c, x.id) && !manorSeason(c, x.id)) monasterySeason(c, x.id); }
}
