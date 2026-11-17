// Settlers found a new town (docs/DESIGN.md, "Settlers found new towns": "a people may send settlers, two couples and
// their children, from one of its towns to an empty land beside its own, where they found a small new town of that
// people without a war").
//
// What an empty land is: nobody holds it (no nation, no tribe), the marauders are not camped on it and no band has its
// place there, nobody lives there and it has no warriors. A land that has never been looked into is not known to be
// empty: its people are made up the first time they are (township.ts), so only a land on record with nobody in it is.
// What founding is: the settlers' convoy (convoys.ts, sent by migration.ts) comes in to an empty land and claims it.
// The land is the people's from then on, with nobody but the settlers and what they carried; its town is laid on the
// record next season as any town of a living people is (rivalrule.ts layTowns: a hall and a roof for every couple).
// If the land is no longer empty when they arrive, they go to their people's chief town as any convoy does.
//
// It reads and writes only the land and its town, so that convoys.ts can ask it without a ring of imports.
import type { Campaign } from './campaign';
import { headcount } from './township';

/** Is this land empty: unheld, not the marauders', no band's place, nobody living there, no warriors? */
export function emptyLand(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  if (!t || t.owner >= 0 || t.horde || (t.militia ?? 0) > 0) return false;
  if ((c.bands ?? []).some((b) => b.at === tid || b.to === tid)) return false;
  return !!t.folk && headcount(t.folk) === 0;
}

/** Settlers of a people come in to an empty land: it is theirs, with nobody in it yet but them. Returns whether it was. */
export function claimLand(c: Campaign, tid: number, f: number): boolean {
  if (!emptyLand(c, tid) || !c.factions[f]?.alive) return false;
  const t = c.territories[tid];
  t.owner = f; t.militia = 0; t.buildings = [];
  delete t.yoke; delete t.town; delete t.orders;
  t.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
  (c.events ??= []).push({ kind: 'founded', at: tid, turn: c.turn, until: c.turn });
  (c.chronicle ??= []).push({ turn: c.turn, text: `${f === 0 ? 'Your people' : `The ${c.factions[f].name}`} founded a new town at ${t.name}: settlers came and made it theirs, without a war.` });
  return true;
}
