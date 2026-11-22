/**
 * An empty land beside every chief town (docs/DESIGN.md, the owner's word of 21 November 2026: "yea it should be
 * there"). A young people seldom had an empty land in reach, so settlers (founding.ts) had nowhere to go for
 * years. When the world is made, each people, the player and every rival alike, is given one: a land beside its
 * chief town with no tribe, no town and nobody there.
 *
 * Which land: one that borders the chief town, that nobody holds, that is no chief town, no marauders' land and
 * no land of the rim, and that is not wild already. A land with no named place is taken before one with (a
 * people in three has a chief town whose only such neighbour holds a named place: the place is then theirs to
 * settle); then a land that touches no other people's chief town before one that does; among those alike, the
 * world's seed chooses, the same every time. No land serves two peoples. A people whose chief town has no such
 * neighbour gets none.
 *
 * It was tried for the player alone and cost it one win in four (384 campaigns: 215 wins to 165), since its
 * armies cannot take a land with nobody on it and the town its settlers found is weak at first; given to every
 * people, the cost is shared. An empty land here is not a wild land (wilds.ts): no band arises in it for being
 * empty beside a capital, and it is marked `beside` with the people it was left for, for the map to say so.
 *
 * It reads and writes only the lands.
 */
import type { Campaign, Territory } from './campaign';
import { placeAt } from './places';

declare module './campaign' {
  interface Territory {
    /** Left empty beside this people's chief town when the world was made (emptybeside.ts). The mark stays when it is settled or taken. */
    beside?: number;
  }
}

export const BESIDE = {
  /** Empty lands left beside each people's chief town. */
  each: 1,
};

/** A number drawn from the world's seed and a land's, the same every time. */
function draw(seed: number, tid: number): number {
  let h = (Math.imul(seed ^ 0x51ed270b, 0x85ebca6b) ^ Math.imul(tid + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** May this land be left empty beside a chief town: nobody's, no chief town, no marauders', not of the rim, not wild or given already. */
export function mayStandEmpty(c: Campaign, t: Territory): boolean {
  void c;
  return t.owner < 0 && t.capital < 0 && !t.horde && !t.rim && !t.wild && t.beside === undefined;
}
/** The lands that might be left empty for a people, the first choice first: those with no named place, those touching no other chief town, then by the world's seed. */
export function besideChoices(c: Campaign, f: number): Territory[] {
  const cap = c.territories.find((t) => t.capital === f);
  if (!cap) return [];
  const others = (t: Territory): number => t.adj.filter((n) => c.territories[n].capital >= 0 && c.territories[n].capital !== f).length;
  return cap.adj.map((n) => c.territories[n]).filter((t) => mayStandEmpty(c, t))
    .sort((a, b) => (placeAt(c, a.id) ? 1 : 0) - (placeAt(c, b.id) ? 1 : 0) || others(a) - others(b) || draw(c.seed, a.id) - draw(c.seed, b.id) || a.id - b.id);
}
/** Leave one land empty beside each people's chief town. Returns the lands, by people; -1 for a people with none to leave. */
export function makeEmptyBeside(c: Campaign): number[] {
  const made: number[] = [];
  for (const f of c.factions) {
    let got = -1;
    for (let k = 0; k < BESIDE.each; k++) {
      const t = besideChoices(c, f.id)[0];
      if (!t) break;
      t.beside = f.id;
      t.tribal = true; // never made up to a tribe's strength (tribes.ts)
      t.militia = 0;
      t.buildings = [];
      delete t.town;
      t.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
      got = t.id;
    }
    made.push(got);
  }
  return made;
}
/** The land left empty for a people, if it had one. */
export const besideFor = (c: Campaign, f: number): Territory | undefined => c.territories.find((t) => t.beside === f);
