// A visit brings home a season's worth (docs/DESIGN.md, the owner's word of 21 November 2026). A town's people in a
// visit gather at the field's rate, and a ten-minute visit brought home many seasons of the town's goods: the field's
// rate is a battle's, not the map's. So what a visit carries home is weighed to the season: what the town gathered in
// it (each kind it came home with more of) counts up to what that town brings in in a season on the map (harvest.ts
// landGoods), and a shorter visit up to its share of that, by the minutes stayed. What was spent there stays spent:
// a kind the town came home with less of is taken whole. The visit plays as it did; only what carries home is weighed.
//
// It stands in place of the town's season, not on top of it: a town visited brings in nothing more at the season's
// turn (`visitStands`, read by the hub's harvest), and the bar's season gain counts what the visit carried
// (seasongain.ts). People born or trained, buildings raised, and everything else a visit brings home, carry as before.
import type { Campaign } from './campaign';
import { STORE_KINDS } from './township';
import type { Census, Stores } from './township';
import { landGoods } from './harvest';

declare module './campaign' {
  interface Campaign {
    /** What the visits of this season and the last carried home of their towns' gathering, town by town (visitworth.ts). */
    visitCarry?: { at: number; turn: number; goods: number }[];
  }
}

/** What a town brings in in a season on the map, in goods, from what its land yields its holder in supplies (campaign.ts landIncome, passed in): the measure a full visit is weighed to. */
export const seasonWorth = (c: Campaign, tid: number, supplies: number): number => {
  const t = c.territories[tid];
  return t ? landGoods(c, t, supplies) : 0;
};

/**
 * Weigh what a visit carries home: `had`, the town's stores as the visit began; `census`, its people and stores as the
 * player left (changed in place); `share`, how much of a full visit was stayed, 0 to 1; `supplies`, what the land yields
 * its holder in a season (campaign.ts landIncome). Returns the goods carried home.
 */
export function weighCarried(c: Campaign, tid: number, had: Stores, census: Census | undefined, o: { share: number; supplies: number }): number {
  if (!census?.stores) return 0;
  const got: Stores = { food: 0, wood: 0, gold: 0, stone: 0 };
  for (const k of STORE_KINDS) got[k] = Math.max(0, census.stores[k] - had[k]);
  const gathered = STORE_KINDS.reduce((n, k) => n + got[k], 0);
  const most = Math.round(seasonWorth(c, tid, o.supplies) * Math.max(0, Math.min(1, o.share)));
  let carried = gathered;
  if (gathered > most) {
    // Each kind gathered in its own share of the season's worth, in whole goods that add up to it.
    carried = most;
    let left = most;
    const kinds = STORE_KINDS.filter((k) => got[k] > 0);
    for (const k of kinds) { const n = Math.floor((most * got[k]) / gathered); census.stores[k] = had[k] + n; left -= n; }
    for (const k of [...kinds].sort((a, b) => got[b] - got[a])) { if (left <= 0) break; census.stores[k]++; left--; }
  }
  c.visitCarry = [...(c.visitCarry ?? []).filter((x) => x.turn >= c.turn - 1 && x.at !== tid), { at: tid, turn: c.turn, goods: carried }];
  return carried;
}

/** The visit to this land stood in place of its season: the season that turns after it brings the land in nothing more. Read as the season turns (c.turn already the new one). */
export const visitStands = (c: Campaign, f: number, tid: number): boolean =>
  f === 0 && !!c.visitCarry?.some((x) => x.at === tid && x.turn === c.turn - 1);

/** The goods a visit in the season just ended carried home, for the bar's season gain (seasongain.ts). */
export const carriedLastSeason = (c: Campaign): number => (c.visitCarry ?? []).reduce((n, x) => n + (x.turn === c.turn - 1 ? x.goods : 0), 0);
