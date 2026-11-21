// A rival's towns train by standing orders, as the player's do (docs/CLOSING.md, "It carries on with its last orders": a
// rival's towns did not train by orders). The player's town left with an order to train raises a company a season, out
// of its own men and stores, until the army standing in it is as large as it was told to stop at (townmuster.ts). A rival
// gives its towns that order itself: each season every town of its on a frontier (beside a people it reckons with,
// reckon.ts) that has a yard is told to train what its yards raise, to stop at RIVAL_DRILL.stop companies; a town away
// from every frontier is told to stop. Then its towns train as the player's do. Its other raising (campaign.ts, out of the
// nation's supplies) goes on as before.
import type { Campaign } from './campaign';
import { COMPANIES } from './campaignbase';
import { onFrontier } from './reckon';
import { drillTown } from './townmuster';
import type { Drilled } from './townmuster';

export const RIVAL_DRILL = {
  /** The army a rival's frontier town trains up to, in companies. */
  stop: 3,
};

/** The companies a town's yards raise: those whose building stands there, on the map's record or finished in the town. */
const yardsOf = (c: Campaign, tid: number): string[] => {
  const t = c.territories[tid];
  return Object.keys(COMPANIES).filter((k) => t.buildings.includes(COMPANIES[k].needs) || !!t.town?.b.some((x) => x[0] === COMPANIES[k].needs && x[4] === undefined));
};

/** A rival gives its towns their orders to train: a frontier town with a yard trains what it raises; any other, nothing. */
export function rivalDrillOrders(c: Campaign, f: number): number {
  let n = 0;
  for (const t of c.territories) {
    if (t.owner !== f || t.horde) continue;
    const kinds = onFrontier(c, f, t.id) ? yardsOf(c, t.id) : [];
    if (kinds.length) {
      t.orders = { ...(t.orders ?? { turn: c.turn }), train: kinds };
      t.standing = { ...(t.standing ?? {}), drillStop: RIVAL_DRILL.stop };
      n++;
    } else if (t.orders?.train) { const o = { ...t.orders }; delete o.train; t.orders = o; }
  }
  return n;
}

/** A season: every rival led by the computer gives its orders, and its towns train by them. Returns the companies raised. */
export function rivalDrillSeason(c: Campaign): Drilled[] {
  const out: Drilled[] = [];
  for (const x of c.factions) {
    if (!x.alive || !x.isAI || x.id === 0) continue;
    rivalDrillOrders(c, x.id);
    for (const t of c.territories) if (t.owner === x.id && t.orders?.train?.length) { const d = drillTown(c, t.id); if (d) out.push(d); }
  }
  return out;
}
