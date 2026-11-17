// The season's turn for the buildings of rule, law, nobles and faith (hall.ts, and the rest as they come): what a
// rival nation raises of them, one call for campaign.ts. Kept apart from the buildings' own rules, which are read by
// decrees, drift and nobles, so that raising them (townworks.ts) is not in a ring with those.
import type { Campaign } from './campaign';
import { BUILDINGS } from './data';
import { folkOf, grown } from './township';
import { manorNeeds } from './manor';
import { faithAt } from './townfaith';
import { isHoly } from './creed';
import { begunAt, raiseBar, raiseWork } from './townworks';
import { feastSeason } from './feastdays';
import { PLENTY, canSpare } from './plenty';


/** A season for one rival nation: it raises a Hall of Judgement in its chief town when it has none begun and can spare the stores. */
export function hallSeason(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return false;
  const mine = c.territories.filter((t) => t.owner === f && !t.horde);
  if (mine.some((t) => begunAt(c, t.id, 'hall'))) return false;
  const chief = mine.find((t) => t.capital === f) ?? mine[0];
  if (!chief) return false;
  if (!canSpare(c, chief.id, BUILDINGS.hall.cost, { times: PLENTY.rule }) || raiseBar(c, f, chief.id, 'hall')) return false; // plenty.ts, one rule for every purchase
  return raiseWork(c, f, chief.id, 'hall') === '';
}

/** A season for one rival nation: it raises a Noble's Manor in its largest town that has none, when it can spare the stores there. */
export function manorSeason(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return false;
  const big = c.territories.filter((t) => t.owner === f && !t.horde && !begunAt(c, t.id, 'manor') && grown(folkOf(c, t.id)) >= manorNeeds()).sort((a, b) => grown(folkOf(c, b.id)) - grown(folkOf(c, a.id)) || a.id - b.id)[0];
  if (!big) return false;
  if (!canSpare(c, big.id, BUILDINGS.manor.cost, { times: PLENTY.rule }) || raiseBar(c, f, big.id, 'manor')) return false; // plenty.ts, one rule for every purchase
  return raiseWork(c, f, big.id, 'manor') === '';
}

/** A town whose sick or bereaved a Monastery would take in: sick or grieving at the last turn (drift.ts), or with plague in it. */
const struckBySickness = (c: Campaign, tid: number): boolean => { const d = folkOf(c, tid).drift; return !!d?.sick || !!d?.grieving || (c.events ?? []).some((e) => e.at === tid && e.kind === 'plague' && e.until >= c.turn - 1); };

/** A season for one rival nation: it raises a Monastery in its most faithful town that keeps the faith, has none, and is struck by sickness or grief, when it can spare the stores there. */
export function monasterySeason(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return false;
  const holiest = c.territories.filter((t) => t.owner === f && !t.horde && !begunAt(c, t.id, 'monastery') && isHoly(faithAt(c, t.id)) && struckBySickness(c, t.id)).sort((a, b) => faithAt(c, b.id) - faithAt(c, a.id) || a.id - b.id)[0];
  if (!holiest) return false;
  if (!canSpare(c, holiest.id, BUILDINGS.monastery.cost, { times: PLENTY.rule }) || raiseBar(c, f, holiest.id, 'monastery')) return false; // plenty.ts, one rule for every purchase
  return raiseWork(c, f, holiest.id, 'monastery') === '';
}

/** A season for every rival nation's works of rule and faith: at most one begun a season, the Hall first, then a Manor, then a Monastery. */
export function rulesSeason(c: Campaign): void {
  feastSeason(c); // the year's feast, for nations that keep Feast Days (feastdays.ts)
  for (const x of c.factions) { if (!hallSeason(c, x.id) && !manorSeason(c, x.id)) monasterySeason(c, x.id); }
}
