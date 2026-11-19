// Income credited to the land that yields it (docs/DESIGN.md, "Stores"). When the season turns, each town's
// yield goes into its own stores. It is earned here and nowhere else (the governor sets the work, larder.ts eats).
//
//   How much: what the land yields its holder (campaign.ts's measure, which counts its farms, its country and the
//     weather), in a hundred of goods a supply, as far as the town has the hands to work it: full with HANDS_FULL
//     grown men and women or more, less below that, nothing with none.
//   Of what: the town's people work where they were set by its last orders, or where its governor sets them (and
//     sends them to the fields when food is short): governor.ts's shares. Each share is weighed by what a hand
//     brings in at that work (GOVERN.yield; half as much food again on Farmland), and by what the land leans to:
//     more food on fertile or coastal land, gold from gold hills, stone from hills and from snow or desert, wood
//     from forest.
//
// What a people earns as a whole and not from any one land (a fair it holds, the Persians' tribute) goes into its
// chief town, and so does the yield of a land the marauders still sit in. A store is full at MAX_STORE, and what
// will not fit is lost. The nation's figure is then set from its towns (stores.ts).
import type { Campaign, Territory } from './campaign';
import { biomeOf } from './campaignbase';
import { MAX_STORE, STORE_KINDS, TOWN_SCALE, folkOf } from './township';
import type { Stores } from './township';
import { SUPPLY_UNITS, settleStores } from './stores';
import { nobleWork } from './nobles';
import { GOVERN, shareOf } from './governor';
import { millYield } from './mill';
import { leaderWork } from './leaderstay';
import { noteReaped } from './larderwatch';

/** Grown men and women a town needs to work its land in full: six in the towns of today, TOWN_SCALE times as many in bigger towns. */
export const HANDS_FULL = 6 * TOWN_SCALE;

/** What a land leans to, kind by kind: 1 where it is like any other. */
export function landLean(c: Campaign, tid: number): Stores {
  const t = c.territories[tid], l: Stores = { food: 1, wood: 1, gold: 1, stone: 1 };
  if (t.trait === 'fertile') l.food *= 1.5;
  if (t.trait === 'coast') l.food *= 1.25;
  if (t.trait === 'gold') l.gold *= 4;
  if (t.trait === 'hills') l.stone *= 3;
  const ground = biomeOf(c, tid);
  if (ground === 'forest') l.wood *= 2;
  if (ground === 'snow' || ground === 'desert') l.stone *= 1.5;
  return l;
}

/** The shares of a town's yield: where its people work (governor.ts), what a hand brings in there, and what the land leans to. */
export function yieldShares(c: Campaign, tid: number): Stores {
  const t = c.territories[tid], { share } = shareOf(c, tid), lean = landLean(c, tid), s: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const k of STORE_KINDS) s[k] = share[k] * GOVERN.yield[k] * (k === 'food' && t.buildings.includes('farm') ? GOVERN.farm : 1) * (k === 'food' ? millYield(c, tid) : 1) * lean[k]; // a Mill grinds more (mill.ts)
  return STORE_KINDS.some((k) => s[k] > 0) ? s : { food: 1, wood: 0, gold: 0, stone: 0 };
}
/** How much of its land's yield a town has the hands to bring in: 1 with HANDS_FULL grown men and women or more. */
export const handsShare = (c: Campaign, tid: number): number => { const f = folkOf(c, tid); return Math.max(0, Math.min(1, (f.men + f.women) / HANDS_FULL)); };

/** So many goods split by shares, in whole numbers that add up to it. */
export function spread(goods: number, shares: Stores): Stores {
  const total = Math.max(0, Math.round(goods)), sum = STORE_KINDS.reduce((n, k) => n + shares[k], 0) || 1, out: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  let left = total;
  for (const k of STORE_KINDS) { const n = Math.floor((total * shares[k]) / sum); out[k] = n; left -= n; }
  out.food += left;
  return out;
}

/** Put goods into a town as far as it has room. Returns what did not fit. */
export function putIn(c: Campaign, tid: number, goods: Stores): number {
  const s = folkOf(c, tid).stores;
  let over = 0;
  for (const k of STORE_KINDS) { const room = Math.max(0, MAX_STORE - s[k]), n = Math.max(0, Math.round(goods[k])); s[k] += Math.min(room, n); over += Math.max(0, n - room); }
  return over;
}

/** What one season's yield came to, people by people: goods into towns, and goods lost to full stores. */
export interface Harvest { [people: number]: { goods: number; lost: number } }

/**
 * The season's yield. `landYield(f, t)`: the supplies a land yields its holder (campaign.ts's measure); `whole(f)`:
 * what a people earns besides; `times(f)`: a people's multiplier (the rivals' handicap).
 */
export function harvest(c: Campaign, landYield: (f: number, t: Territory) => number, whole: (f: number) => number, times: (f: number) => number = () => 1): Harvest {
  settleStores(c); // anything spent or earned before is in the towns first
  const out: Harvest = {};
  for (const x of c.factions) {
    if (!x.alive) continue;
    const k = times(x.id), held = c.territories.filter((t) => t.owner === x.id), lands = held.filter((t) => !t.horde);
    if (!lands.length) continue;
    const chief = lands.find((t) => t.capital === x.id) ?? lands[0];
    let goods = 0, lost = 0;
    // A land the marauders still sit in has no town of its people's to keep its yield: that goes to the chief town.
    for (const t of held) {
      // A land the marauders sit in yields what its own town's hands bring in, but into the chief town.
      const into = t.horde ? chief : t, n = Math.round(landYield(x.id, t) * k * SUPPLY_UNITS * handsShare(c, t.id) * nobleWork(c, t.id) * leaderWork(c, t.id)); // an angry noble's town works slacker (nobles.ts), the leader's harder (leaderstay.ts)
      const got = spread(n, yieldShares(c, into.id));
      noteReaped(c, into.id, got.food); // for the reckoning ahead (larderwatch.ts)
      goods += n; lost += putIn(c, into.id, got);
    }
    const extra = Math.round(whole(x.id) * k * SUPPLY_UNITS);
    const kept = spread(extra, yieldShares(c, chief.id));
    noteReaped(c, chief.id, kept.food);
    goods += extra; lost += putIn(c, chief.id, kept);
    out[x.id] = { goods, lost };
  }
  settleStores(c); // the figure, from the towns as they now are
  return out;
}
