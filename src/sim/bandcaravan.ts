// A band falls on a caravan (docs/DESIGN.md, the owner's word, 18 November 2026: "a band can fall on one, as it can on
// an army"). The caravans are caravans.ts's; highwaymen on a caravan's road and pirates on its sea lanes already meet it
// as they meet any convoy (convoys.ts `waylay`). This is the other bands: a camp of raiders or slavers, or the marauders,
// standing on a land a caravan's road crosses.
//
//   Each season, each such band that is in its place (not one still on its march in from the far wilds, which strikes
//   nobody until it is there) looks at the caravans whose road runs through the land it stands on. If there is one not
//   yet fallen on, it falls on it BANDCARAVAN.dare of the time: the richest first. What comes of that is caravans.ts's to
//   say (`fallOnCaravan`): an army of the caravan's people as strong as the band on its road sees it off; otherwise the
//   band takes its share of the gold and grows on it, and the caravan's people are told. A band falls on one caravan a
//   season, and a caravan is fallen on once.
//
// It reads the bands and the caravans and calls the one function; it keeps nothing of its own. Nobody is hurt or taken:
// a caravan is its gold.
import type { Campaign } from './campaign';
import type { Band } from './threats';
import { chance } from './threats';
import { caravansThrough, fallOnCaravan } from './caravans';

export const BANDCARAVAN = {
  /** The chance a season that a band with a caravan's road under it falls on one. */
  dare: 0.5,
};

/** Is this a band that falls on caravans this way: raiders, slavers or marauders, in their place and not on the march in? */
export const waylays = (b: Band): boolean => (b.kind === 'raiders' || b.kind === 'slavers' || b.kind === 'marauders') && !b.afar;

/** One season: each such band may fall on a caravan whose road crosses the land it stands on. Returns the gold taken in all. */
export function caravanSeason(c: Campaign): number {
  let took = 0;
  for (const b of [...(c.bands ?? [])]) {
    if (!waylays(b)) continue;
    const prey = caravansThrough(c, b.at).filter((x) => !x.fallen).sort((x, y) => y.cargo.gold - x.cargo.gold || x.id - y.id)[0];
    if (!prey || chance(c, b.id, 113) >= BANDCARAVAN.dare) continue;
    took += fallOnCaravan(c, prey, b);
  }
  return took;
}
