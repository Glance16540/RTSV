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
import { feastSeason } from './feastdays';
import { PLENTY, breadless, canSpare, nationCanSpare } from './plenty';


/**
 * The nation's other towns send a town what it lacks of a cost, of each kind the town with most of it first, each giving
 * only what it holds beyond a floor of its own and one more (plenty.ts, PLENTY.floor), so that none is left unable to
 * raise its own Farmland. Nothing is sent unless all of it can be. Returns whether it was.
 */
function sendToward(c: Campaign, f: number, to: number, cost: Partial<Record<string, number>>): boolean {
  const s = folkOf(c, to).stores, keep = 2 * PLENTY.floor;
  const others = c.territories.filter((x) => x.owner === f && !x.horde && x.id !== to);
  const spare = (id: number): number => Math.max(0, breadless(folkOf(c, id).stores) - keep);
  const lack = STORE_KINDS.reduce((n, k) => n + Math.max(0, (cost[k] ?? 0) - Math.max(0, s[k])), 0);
  if (others.reduce((n, t) => n + spare(t.id), 0) < lack) return false;
  for (const k of STORE_KINDS) {
    let want = Math.max(0, (cost[k] ?? 0) - Math.max(0, s[k]));
    for (const t of [...others].sort((a, b) => folkOf(c, b.id).stores[k] - folkOf(c, a.id).stores[k] || a.id - b.id)) {
      if (want <= 0) break;
      const o = folkOf(c, t.id).stores, give = Math.min(Math.max(0, o[k]), want, spare(t.id));
      o[k] -= give; s[k] += give; want -= give;
    }
    if (want > 0) return false;
  }
  return true;
}

/**
 * A season for one rival nation: it raises a Hall of Judgement in its chief town when it has none begun and can spare the
 * stores, the nation's other towns sending it what it lacks (at 192 campaigns, paid by the chief town alone, 46.5% and
 * 43.6% of rivals had one by twenty years; helped, 58.4% and 55.0%); and where even so it cannot, in the richest town
 * of the nation that can spare it alone (with fewer wild lands the helped chief town read 49.8% and 56.8%; with this,
 * 54.9% and 54.4%).
 */
export function hallSeason(c: Campaign, f: number): boolean {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI) return false;
  const mine = c.territories.filter((t) => t.owner === f && !t.horde);
  if (mine.some((t) => begunAt(c, t.id, 'hall'))) return false;
  const chief = mine.find((t) => t.capital === f) ?? mine[0];
  if (!chief) return false;
  const cost = BUILDINGS.hall.cost;
  // The chief town pays, or, where it cannot alone, the nation's other towns send it what it lacks (a Hall is the nation's
  // seat of judgement): the nation keeps PLENTY.rule floors a town after paying (plenty.ts, one rule for every purchase).
  if (!canSpare(c, chief.id, cost, { times: PLENTY.rule })) {
    if (!nationCanSpare(c, f, chief.id, cost, PLENTY.rule) || !sendToward(c, f, chief.id, cost)) {
      // Else in the town of the nation that can spare it, the richest first.
      const other = mine.filter((t) => t.id !== chief.id && canSpare(c, t.id, cost, { times: PLENTY.rule }) && !raiseBar(c, f, t.id, 'hall')).sort((a, b) => breadless(folkOf(c, b.id).stores) - breadless(folkOf(c, a.id).stores) || a.id - b.id)[0];
      return other ? raiseWork(c, f, other.id, 'hall') === '' : false;
    }
  }
  if (raiseBar(c, f, chief.id, 'hall')) return false;
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
