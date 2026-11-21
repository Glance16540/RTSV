// A roaming band turns aside for a dead town (docs/CLOSING.md, "Any rival nation or marauders that come for it can take it":
// the marauders walked in only from the land beside; a roaming band did not turn aside for a dead town). A town with
// nobody left in it stands open (deadtown.ts). Now a camp of raiders or slavers that can reach one goes for it: it sets
// out for a land beside it, a land a season as any march (bandroam.ts), and standing beside it walks in. The town is
// overrun as deadtown.ts overruns one that a wandering band finds: the band is the camp of marauders it becomes, and the
// land is theirs. A town garrisoned by its people's army is not open to it (deadtown.ts openDefence).
import type { Campaign } from './campaign';
import { DEAD, openDefence } from './deadtown';
import type { Band } from './threats';

/** The open towns no army keeps: what a band could walk into. */
export const deadTowns = (c: Campaign): number[] => c.territories.filter((t) => openDefence(c, t.id) !== null).map((t) => t.id);

/**
 * A band's season with the dead towns: standing beside one, it walks in (the band is gone into it, and deadtown.ts overruns
 * it this season); with one in reach and nowhere bound, it is bound for a land beside it. `ways` is bandroam.ts waysFrom.
 * Returns 'in' when it walked in, 'bound' when it turned aside, or ''.
 */
export function turnAside(c: Campaign, b: Band, ways: (c: Campaign, b: Band) => { to: number; seasons: number; steps: number }[]): 'in' | 'bound' | '' {
  if ((b.kind !== 'raiders' && b.kind !== 'slavers') || b.afar) return '';
  const dead = deadTowns(c);
  if (!dead.length) return '';
  const beside = dead.find((d) => c.territories[b.at]?.adj.includes(d) || b.at === d);
  if (beside !== undefined) {
    (c.emptied ??= {})[beside] = Math.max(c.emptied[beside] ?? 0, DEAD.found); // as a wandering band that finds it (deadtown.ts)
    c.bands = (c.bands ?? []).filter((x) => x !== b); // they are the camp it becomes
    return 'in';
  }
  if (b.bound !== undefined && dead.some((d) => c.territories[b.bound!]?.adj.includes(d))) return ''; // on its way already
  const way = ways(c, b).filter((w) => dead.some((d) => c.territories[w.to]?.adj.includes(d))).sort((x, y) => x.seasons - y.seasons || x.steps - y.steps || x.to - y.to)[0];
  if (!way) return '';
  b.bound = way.to;
  return 'bound';
}
