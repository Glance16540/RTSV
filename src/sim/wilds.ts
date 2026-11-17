// The wild lands: a share of the far and poor lands start with no tribe and no town (the owner's word, 17 November 2026:
// "a share of the far and poor lands (snow, desert, the map's edge) start with no tribe and no town. They are where
// settlers go and where the wild bands arise").
//
// When the world is made (campaign.ts newCampaign), after the peoples have their homes:
//   - a land may start wild if nobody holds it, it is nobody's chief town, it lies beside no people's chief town, and it
//     is far or poor: snow or desert, or on the map's edge (within WILD.edge of a side);
//   - of those, WILD.share are made wild, chosen by the world's seed, so the same seed makes the same wilds.
// A wild land is an empty land (founding.ts): nobody lives there, no warriors, no works. A wild land of snow or desert is
// true wilderness (`wilderness`): it can never be settled, and stays wild all campaign for the far-wilds bands. It keeps its name and its
// ground. It is marked `wild`, for the far-wilds bands (threats) and the map to read; the mark stays when settlers or an
// army make it someone's, as where the land came from.
//
// It reads and writes only the lands, so that the campaign's setup calls it once and nothing it imports reaches back.
import type { Campaign, Territory } from './campaign';
import { MAP_H, MAP_W, biomeOf } from './campaignbase';

declare module './campaign' {
  interface Territory {
    /** This land started with no tribe and no town: far or poor ground left for settlers (wilds.ts). */
    wild?: boolean;
  }
}

export const WILD = {
  /** Of the lands that may start wild, the share that do. */
  share: 0.3,
  /** How near a side of the map, as a share of its width or height, a land is on the map's edge. */
  edge: 0.12,
};

/** Is this land far or poor: snow, desert, or the map's edge? */
export function farOrPoor(c: Campaign, t: Territory): boolean {
  const b = biomeOf(c, t.id);
  if (b === 'snow' || b === 'desert') return true;
  return t.x < MAP_W * WILD.edge || t.x > MAP_W * (1 - WILD.edge) || t.y < MAP_H * WILD.edge || t.y > MAP_H * (1 - WILD.edge);
}

/** The lands that may start wild: unheld, nobody's chief town, beside no chief town, far or poor. */
export function wildable(c: Campaign): Territory[] {
  const homes = new Set(c.territories.filter((t) => t.capital >= 0).map((t) => t.id));
  return c.territories.filter((t) => t.owner < 0 && t.capital < 0 && !t.horde && !t.adj.some((n) => homes.has(n)) && farOrPoor(c, t));
}

/**
 * Is this land true wilderness: a wild land of snow or desert? It can never be settled (the owner's word, 17 November
 * 2026: "so a rim of wild country lasts all campaign and bands keep arising there to march in from afar"). It is still an
 * empty land (founding.ts emptyLand) for the bands that arise in the far wilds; founding refuses it (founding.ts settleable).
 */
export function wilderness(c: Campaign, tid: number): boolean {
  const t = c.territories[tid];
  if (!t?.wild) return false;
  const b = biomeOf(c, tid);
  return b === 'snow' || b === 'desert';
}

/** A number drawn from the world's seed and a land's, the same every time. */
function draw(seed: number, tid: number): number {
  let h = (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(tid + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Make a share of the far and poor lands wild: no tribe, no town, nobody there. Returns the lands made wild. */
export function makeWilds(c: Campaign): number[] {
  const may = wildable(c).sort((a, b) => draw(c.seed, a.id) - draw(c.seed, b.id));
  const made = may.slice(0, Math.round(may.length * WILD.share));
  for (const t of made) {
    t.wild = true;
    t.tribal = true; // never made up to a tribe's strength (tribes.ts)
    t.militia = 0;
    t.buildings = [];
    delete t.town;
    t.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
  }
  return made.map((t) => t.id);
}
