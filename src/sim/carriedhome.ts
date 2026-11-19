// Those carried off in a battle come home under their own roofs (docs/DESIGN.md, "People persist"; battlecarried.ts).
//
// Those a battle carried off are held on the map by name and house (`Held.who`, battlecarried.ts). When they are got
// back (carriedoff.ts free, after threats.ts bringHome has counted them home), each goes back under their own house's
// roof on the town's record (roofsmap.ts `Folk.households`) if that roof is still kept and has no one of their kind
// in it: a wife to her husband's house, a man to his own. Those with no such roof are of the town as anyone is, and
// take a roof at the next sitting.
// Plain data: it reads and writes the town's record only.
import type { Campaign } from './campaign';
import type { Roof } from './roofs';
import type { Held } from './threats';

declare module './threats' {
  interface Held {
    /** Who they are, in the order of the women and then the men: name, house and age when taken (battlecarried.ts). */
    who?: { name: string; family?: string; gender: 'm' | 'f'; seasons: number }[];
  }
}

/** Those of a battle come home: each goes back under their own house's roof on the town's record, where it has room. */
export function homeAgain(c: Campaign, h: Held): number {
  if (!h.who?.length) return 0;
  const t = c.territories[h.from];
  const home = t && t.owner === h.owner ? t : c.territories.find((x) => x.owner === h.owner) ?? t;
  const kept = home?.folk?.households, list = (kept?.list ?? []) as Roof[];
  // The record keeps ages as of its own turn (roofsmap.ts adds the seasons since): the age taken, and the seasons held, less those.
  const later = Math.round(Math.max(0, c.turn - h.since)) - Math.max(0, c.turn - (kept?.turn ?? c.turn));
  let k = 0;
  for (const w of h.who) {
    if (!w.family) continue;
    const r = list.find((x) => x.family === w.family && !x[w.gender] && !(x.m?.name === w.name || x.f?.name === w.name));
    if (!r) continue;
    r[w.gender] = { name: w.name, seasons: Math.max(0, Math.min(400, w.seasons + later)) };
    k++;
  }
  return k;
}
