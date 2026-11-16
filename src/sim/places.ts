// The named places of a world, and what is befalling the whole world (docs/PORTING.md: out of the campaign hub).
// A few lands that are not capitals have a place with a name and a past (story.ts): whoever holds the land has the
// good of it. Chosen and named by the campaign's seed, once, and the same in every telling. Moved out of campaign.ts
// as it stood, with nothing changed.
import type { Campaign } from './campaign';
import { LEGENDS, PLACES, Place, PlaceKind, WorldKind } from './story';

declare module './campaign' {
  interface Campaign {
    /** Places with names of their own (see story.ts): made once from the seed, and the same in every telling. */
    places?: Place[];
    /** What is befalling the whole world, until the turn given; and the turn before which nothing new will. */
    world?: { kind: WorldKind; until: number } | null;
    worldRest?: number;
  }
}

// The same run of chances campaign.ts lays its world out by: a place must fall where it always fell.
const hash = (a: number, b: number): number => {
  let t = (Math.imul(a | 0, 2654435761) ^ Math.imul(b + 17, 40503)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  return ((t ^ (t >>> 13)) >>> 0) / 4294967296;
};
/** The named places of this world: a few lands that are not capitals, chosen and named by the seed. */
export function placesOf(c: Campaign): Place[] {
  if (c.places) return suited(c, c.places);
  const open = c.territories.filter((t) => t.capital < 0).sort((a, b) => hash(c.seed, a.id) - hash(c.seed, b.id));
  const kinds = (Object.keys(PLACES) as PlaceKind[]).sort((a, b) => hash(c.seed + 1, a.length * 7 + a.charCodeAt(0)) - hash(c.seed + 1, b.length * 7 + b.charCodeAt(0)));
  const n = Math.min(open.length, 3 + Math.floor(c.territories.length / 6));
  c.places = [];
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length], def = PLACES[kind];
    const k = Math.floor(hash(c.seed + 2, i % kinds.length) * def.names.length) + Math.floor(i / kinds.length); // a second of its kind takes the next name
    c.places.push({ at: open[i].id, kind, name: def.names[k % def.names.length], legend: '' });
  }
  return suited(c, c.places);
}
/** Give each place a legend that is told of that place and no other (and put right those given another's before). */
function suited(c: Campaign, places: Place[]): Place[] {
  for (const p of places) {
    const own = LEGENDS[p.name];
    if (own && !own.includes(p.legend)) p.legend = own[Math.floor(hash(c.seed + 3, p.at) * own.length)];
  }
  return places;
}
export const placeAt = (c: Campaign, tid: number): Place | undefined => placesOf(c).find((p) => p.at === tid);
/** Add up one kind of good from every named place a people holds. */
export const placeGood = (c: Campaign, f: number, what: 'virtue' | 'supplies' | 'age'): number =>
  placesOf(c).reduce((n, p) => n + (c.territories[p.at].owner === f ? PLACES[p.kind][what] ?? 0 : 0), 0);
/** What is befalling the world this turn, if anything. */
export const worldNow = (c: Campaign): WorldKind | '' => (c.world && c.world.until >= c.turn ? c.world.kind : '');
/** What the named place in a land, if there is one, is worth of one kind: its defence, or supplies off a company raised there. */
export const placeWorth = (c: Campaign, tid: number, what: 'defence' | 'raise'): number => PLACES[placeAt(c, tid)?.kind as PlaceKind]?.[what] ?? 0;
