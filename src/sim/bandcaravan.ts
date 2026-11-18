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
// It reads the bands and the caravans, calls the one function and leaves a note in the bands' news; it keeps nothing of its own. Nobody is hurt or taken:
// a caravan is its gold.
import type { Campaign } from './campaign';
import type { Band } from './threats';
import { chance, note } from './threats';
import { caravansThrough, fallOnCaravan } from './caravans';

export const BANDCARAVAN = {
  /** The chance a season that a band with a caravan's road under it falls on one. */
  dare: 0.5,
};

/** Is this a band that falls on caravans this way: raiders, slavers or marauders, in their place and not on the march in? */
export const waylays = (b: Band): boolean => (b.kind === 'raiders' || b.kind === 'slavers' || b.kind === 'marauders') && !b.afar;

/**
 * The news of it, kept with the bands' news (raidnews.ts shows a people the notes that are theirs): the caravan's own
 * people are told, and so is whoever holds the land it happened in, and the player where it was his ally's. The line in
 * the log for the player's own caravan is caravans.ts's; this writes none.
 */
function told(c: Campaign, b: Band, owner: number, to: number, gold: number): void {
  const who = b.name[0].toUpperCase() + b.name.slice(1), land = c.territories[b.at], dest = c.territories[to]?.name ?? 'its market';
  const others = [...new Set([land.owner, ...(owner === c.ally ? [0] : [])])].filter((f) => f >= 0 && f !== owner && !!c.factions[f]?.alive);
  note(c, [], 'robbed', b, b.at, `${who} fell on ${owner === 0 ? 'your' : `the ${c.factions[owner]?.name ?? 'traders'}'`} caravan at ${land.name}, on the road to ${dest}, and took ${gold} gold.`, [owner]);
  if (others.length) note(c, [], 'robbed', b, b.at, `${who} fell on a caravan of the ${c.factions[owner]?.name ?? 'traders'} at ${land.name}, on the road to ${dest}, and took ${gold} gold.`, others);
}

/** One season: each such band may fall on a caravan whose road crosses the land it stands on. Returns the gold taken in all. */
export function caravanSeason(c: Campaign): number {
  let took = 0;
  for (const b of [...(c.bands ?? [])]) {
    if (!waylays(b)) continue;
    const prey = caravansThrough(c, b.at).filter((x) => !x.fallen).sort((x, y) => y.cargo.gold - x.cargo.gold || x.id - y.id)[0];
    if (!prey || chance(c, b.id, 113) >= BANDCARAVAN.dare) continue;
    const got = fallOnCaravan(c, prey, b);
    if (got > 0) told(c, b, prey.owner, prey.to, got);
    took += got;
  }
  return took;
}
