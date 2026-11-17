// Grain bought abroad (docs/DESIGN.md, "The food decree buys grain abroad", the owner's word, 17 November 2026).
//
// Sending food between a people's own towns only moves a lean season from one larder to the next. The decree that
// answers a hungry town (decrees.ts, "Give food") brings in new food from outside the nation, paid for in its gold:
//   - How much: enough to end a season's hunger, the town's food brought up to GRAIN.seasons seasons of its own
//     eating (larder.ts), and never less than GRAIN.least.
//   - At what price: GRAIN.price gold a food, GRAIN.famine times that in a famine year (a famine in force in any town
//     of the nation: grain is dear when the harvest has failed).
//   - Sent by messenger, the leader being elsewhere, it is weaker: only that share of the grain arrives, and only
//     what arrives is paid for. (Rather than coming a season later: a hungry town's hunger is this season's.)
//   - Paid in gold alone, from the hungry town first, then from the nation's towns with most gold; never its food,
//     wood or stone. As much is bought as the gold will pay for.
//   - The computer's peoples (decrees.ts, the sensible ruler) buy only when the nation can spare the gold: plenty.ts's
//     one rule, nationCanSpare, at PLENTY.grain floors a town and without the town's own tests (a need, not plenty).
//   - The price and the amount are a first guess, agreed with the food session.
//   - It is put in the town's stores when the decree is given, before the season's larder eats; never above GRAIN.seasons
//     seasons' eating, or the larder's spoilage takes the rest.
// Plain data in, plain data out; nothing here is drawn.
import type { Campaign } from './campaign';
import { folkOf } from './township';
import { needOf } from './larder';
import { PLENTY, nationCanSpare } from './plenty';

export const GRAIN = {
  /** Gold a food, bought abroad. */
  price: 1,
  /** How much dearer it is in a famine year. */
  famine: 1.5,
  /** Seasons of its own eating the town's larder is brought up to. */
  seasons: 2,
  /** The least grain worth sending for. */
  least: 50,
};

const mine = (c: Campaign, f: number): number[] => c.territories.filter((t) => t.owner === f && !t.horde).map((t) => t.id);

/** Is it a famine year for this nation: a famine in force in any of its towns? */
export const famineYear = (c: Campaign, f: number): boolean => {
  const towns = new Set(mine(c, f));
  return (c.events ?? []).some((e) => e.kind === 'famine' && towns.has(e.at) && e.until >= c.turn - 1);
};
/** Gold a food bought abroad costs this nation now. */
export const grainPrice = (c: Campaign, f: number): number => GRAIN.price * (famineYear(c, f) ? GRAIN.famine : 1);
/** The grain a town wants at full strength: its larder brought up to GRAIN.seasons seasons of eating, at least GRAIN.least. */
export const grainWanted = (c: Campaign, tid: number): number => Math.max(GRAIN.least, Math.ceil(GRAIN.seasons * needOf(c, tid) - Math.max(0, folkOf(c, tid).stores.food)));
/** All the gold a nation's towns hold. */
export const goldOf = (c: Campaign, f: number): number => mine(c, f).reduce((n, tid) => n + Math.max(0, folkOf(c, tid).stores.gold), 0);

/** What buying grain for this town at this strength would bring and cost now: as much as the gold will pay for. */
export function grainDeal(c: Campaign, f: number, tid: number, strength = 1): { food: number; gold: number } {
  const price = grainPrice(c, f), want = Math.round(grainWanted(c, tid) * strength);
  const food = Math.min(want, Math.floor(goldOf(c, f) / price));
  return { food, gold: Math.ceil(food * price) };
}

/** Why grain cannot be bought for this town now, or ''. */
export function grainBar(c: Campaign, f: number, tid: number, strength = 1): string {
  const d = grainDeal(c, f, tid, strength);
  if (d.food < Math.min(GRAIN.least, Math.round(GRAIN.least * strength)) || d.food <= 0) return `There is not the gold to buy grain abroad: it costs ${grainPrice(c, f)} gold a food.`;
  return '';
}

/** May a nation spare the gold for this grain? plenty.ts's one rule, at PLENTY.grain floors a town, the town's own tests aside. */
export function canSpareGrain(c: Campaign, f: number, tid: number, strength = 1): boolean {
  const d = grainDeal(c, f, tid, strength);
  return d.food > 0 && nationCanSpare(c, f, tid, { gold: d.gold }, PLENTY.grain, { town: false });
}

/** Buy grain abroad for a town: paid in gold, the town's own first, then the towns with most. Returns what came and what it cost. */
export function buyGrain(c: Campaign, f: number, tid: number, strength = 1): { food: number; gold: number } {
  const d = grainDeal(c, f, tid, strength);
  if (d.food <= 0) return { food: 0, gold: 0 };
  let left = d.gold;
  const order = [tid, ...mine(c, f).filter((x) => x !== tid).sort((a, b) => folkOf(c, b).stores.gold - folkOf(c, a).stores.gold || a - b)];
  for (const id of order) { if (left <= 0) break; const s = folkOf(c, id).stores, take = Math.min(Math.max(0, s.gold), left); s.gold -= take; left -= take; }
  folkOf(c, tid).stores.food += d.food;
  return d;
}
