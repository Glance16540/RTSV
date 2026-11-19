// A land a war or a band has emptied becomes an empty land (the board's "People move between towns": "a land a tribe or
// a war has emptied does not become one"). A trial, kept only while ruin and raids stay in their bands.
//
// A town with nobody left in it stands open (deadtown.ts): still its people's, taken by whoever marches on it, by the
// marauders beside it, or after DEAD.found seasons by a wandering band. Here: an open town that nobody has come for,
// with no army of its people in it, is let go after EMPTIED.wait seasons more. Nobody holds the land from then on:
// no nation, no tribe, no band, with nobody living there and no warriors (founding.ts emptyLand), so the settlers of
// any people within reach may found a town on it, its old people's among them; a land of snow or desert stays
// wilderness. Its fields and sites stand as they were left; its town's record, its orders and any yoke go with its people.
//
// Measured before it was written (48 campaigns of 200 seasons): no land a people did not hold ever stood with nobody in
// it but the world's wild lands, and towns of a people with nobody in them came to 215 town-seasons in all. So this
// touches few lands, and only ones that had died. It runs after deadtown.ts each season and does not change it.
import type { Campaign } from './campaign';
import { DEAD, isOpen } from './deadtown';

export const EMPTIED = {
  /** Seasons an open town stands empty, beyond the DEAD.open it takes to stand open, before its people let it go. */
  wait: 8,
};

/** A season: open towns nobody has come for, with no army of their people in them, are let go. Returns the lands let go. */
export function letGoSeason(c: Campaign): number[] {
  const out: number[] = [];
  for (const t of c.territories) {
    if (!isOpen(c, t.id) || (c.emptied?.[t.id] ?? 0) < DEAD.open + EMPTIED.wait) continue;
    if (c.armies.some((a) => a.at === t.id && a.owner === t.owner)) continue; // its people still keep it with an army
    const was = t.owner, whose = was === 0 ? 'your people' : `the ${c.factions[was]?.name ?? 'people'}`;
    t.owner = -1; t.horde = false; t.militia = 0;
    if (t.capital === was) t.capital = -1;
    delete t.town; delete t.orders; delete t.yoke;
    delete c.emptied?.[t.id]; delete c.emptiedOf?.[t.id];
    c.log.push(`${t.name} has stood empty for ${DEAD.open + EMPTIED.wait} seasons with nobody come for it: ${whose} have let it go, and it is an empty land now, for settlers.`);
    (c.chronicle ??= []).push({ turn: c.turn, text: `${t.name} stood empty after its people were gone, and was let go: an empty land, where settlers might begin again.` });
    out.push(t.id);
  }
  return out;
}
