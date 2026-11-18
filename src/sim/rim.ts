// A rim of true wilderness (docs/DESIGN.md, the owner's word, 17 November 2026: "The map's edge is ringed with true
// wilderness, snow and desert that nobody can settle or farm, so a rim of wild country lasts all campaign and bands can
// be born there and march in from afar where a people can see them coming. It takes no farmland from anyone.")
//
// The wild lands of wilds.ts are a share of the lands the world was made with, about one and a half a map and mostly
// beside a town: there was seldom anywhere far to come from. The rim is made of NEW lands. When the world is made
// (campaign.ts newCampaign), after everything else, a few lands are added where the map's edge was open water or
// nobody's: each is true wilderness (wilds.ts `wilderness`), empty for good, with a way out on foot to the nearest land
// or two that are nobody's chief town. It is nobody's neighbour: its `adj` is empty and no land's `adj` names it, so
// every rule that reads a town's neighbours never sees the rim, no town is a border town for it, no army stands at a
// front that is not there, and nobody can march in. What it has is `down`, the lands it looks down on: what is born in
// the rim finds its way out by them (`outOf`, read by the bands' rules alone), and the towns below see it gather. (Joined both ways,
// 192 campaigns left one in five undecided where one in twelve was: every people's armies beside the rim held as at a
// frontier, for good.) No land the world already had is changed, moved or renamed, none of its random draws
// is spent (the rim is drawn from the seed by its own hash), and no farmland is taken: the lands a people can hold,
// settle and win by are exactly those there were (ruin.ts `holdable`, campaignbase.ts dominionNeed, founding.ts).
//
//   Where. Places are tried around the edge, a little inside it (RIM.inset), RIM.round of them, shifted by the seed.
//     One is kept if it lies RIM.apart or more from every land and every rim land already kept, and has a land that is
//     no chief town within RIM.near to be joined to. Cold and parched places are kept first, so that where the world
//     has snow or desert at its edge the rim is of it; up to RIM.lands are kept.
//   What. A rim land has no tribe, no town, no works, no people, and never will: it cannot be settled or taken
//     (founding.ts, migration.ts read `wilderness`). Camps of raiders and slavers are born there (bandwilds.ts) and
//     march in. It is marked `wild` and `rim`.
//
// It reads and writes only the lands.
import type { Campaign, Territory } from './campaign';
import { MAP_H, MAP_W, biomeAt } from './campaignbase';

declare module './campaign' {
  interface Territory {
    /** This land is of the rim of true wilderness at the map's edge: added to the world, never anyone's (rim.ts). */
    rim?: boolean;
    /** A rim land: the lands it looks down on, which is its only way out. It is nobody's neighbour (`adj` is empty). */
    down?: number[];
  }
}

export const RIM = {
  /** The most lands the rim is made of. */
  lands: 4,
  /** Places tried around the edge, and how far inside it they lie, as a share of the map's width and height. */
  round: 20, inset: 0.05,
  /** A rim land lies at least this far from every other land, and is joined to lands no farther than `near`: the two nearest at most. */
  apart: 150, near: 300, joins: 2,
};

/** A number drawn from the world's seed and a place's, the same every time, and none of the world's own draws. */
function draw(seed: number, k: number): number {
  let h = (Math.imul(seed ^ 0x51ed270b, 0x85ebca6b) ^ Math.imul(k + 0x2545f491, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The places around the edge where a rim land might lie, in the order they are tried: cold and parched first, then by the seed. */
export function rimPlaces(seed: number): { x: number; y: number; side: 'north' | 'east' | 'south' | 'west'; waste: boolean }[] {
  const out: { x: number; y: number; side: 'north' | 'east' | 'south' | 'west'; waste: boolean; k: number }[] = [];
  const ix = MAP_W * RIM.inset, iy = MAP_H * RIM.inset, w = MAP_W - 2 * ix, h = MAP_H - 2 * iy, round = 2 * (w + h), turn = draw(seed, 1);
  for (let i = 0; i < RIM.round; i++) {
    let d = (((i + turn) / RIM.round) * round) % round, x: number, y: number, side: 'north' | 'east' | 'south' | 'west';
    if (d < w) { x = ix + d; y = iy; side = 'north'; }
    else if ((d -= w) < h) { x = MAP_W - ix; y = iy + d; side = 'east'; }
    else if ((d -= h) < w) { x = MAP_W - ix - d; y = MAP_H - iy; side = 'south'; }
    else { d -= w; x = ix; y = MAP_H - iy - d; side = 'west'; }
    const b = biomeAt(seed, x, y);
    out.push({ x: Math.round(x), y: Math.round(y), side, waste: b === 'snow' || b === 'desert', k: draw(seed, 10 + i) });
  }
  return out.sort((a, b) => Number(b.waste) - Number(a.waste) || a.k - b.k).map(({ x, y, side, waste }) => ({ x, y, side, waste }));
}

const WASTES: Record<string, string[]> = {
  snow: ['Frozen Reach', 'White Waste', 'Ice Marches', 'Winter Fells'],
  desert: ['Burning Waste', 'Red Sands', 'Dry Marches', 'Salt Flats'],
  other: ['Far Barrens', 'Stone Wastes', 'Grey Fells', 'Lost Marches'],
};

/** Ring the map's edge with true wilderness: new lands, nobody's for good. Returns the lands added. */
export function makeRim(c: Campaign): number[] {
  const made: number[] = [], world = c.territories.length, dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
  for (const p of rimPlaces(c.seed)) {
    if (made.length >= RIM.lands) break;
    if (c.territories.some((t) => dist(t, p) < RIM.apart)) continue;
    // Joined to the nearest lands the world was made with that are nobody's chief town: never to another rim land alone.
    const to = c.territories.slice(0, world).filter((t) => t.capital < 0 && dist(t, p) <= RIM.near).sort((a, b) => dist(a, p) - dist(b, p) || a.id - b.id).slice(0, RIM.joins);
    if (!to.length) continue;
    const b = biomeAt(c.seed, p.x, p.y), kind = b === 'snow' || b === 'desert' ? b : 'other', id = c.territories.length;
    const names = WASTES[kind], side = p.side[0].toUpperCase() + p.side.slice(1) + 'ern';
    let name = `the ${side} ${names[Math.floor(draw(c.seed, 100 + id) * names.length)]}`;
    for (let k = 0; c.territories.some((t) => t.name === name) && k < names.length; k++) name = `the ${side} ${names[k]}`;
    const t: Territory = {
      id, name, owner: -1, capital: -1, adj: [], down: to.map((x) => x.id), x: p.x, y: p.y, buildings: [], trait: '', militia: 0, seed: 1 + Math.floor(draw(c.seed, 200 + id) * 1e6),
      wild: true, rim: true, tribal: true, // never made up to a tribe's strength (tribes.ts)
      folk: { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] },
    };
    c.territories.push(t);
    made.push(id);
  }
  return made;
}

/** The lands of the world that are not of the rim: those a people may hold, and by which the map's size is reckoned. */
export const landsWithin = (c: Campaign): number => c.territories.filter((t) => !t.rim).length;

/** The lands a band standing here may go on to or be seen from: a land's neighbours, or, for a land of the rim, those it looks down on. */
export const outOf = (c: Campaign, tid: number): number[] => { const t = c.territories[tid]; return !t ? [] : t.rim ? t.down ?? [] : t.adj; };
