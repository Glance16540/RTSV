// A town's water, read off the campaign map, for the ground of a battle or a visit there (waterlay.ts lays it). The map
// keeps its own country (campaign.ts terrainOf): a height at every few points, at or under nought where it is sea, and
// the rivers that run from the high ground to the sea. Round the town, within TOWN_WATER.reach of it:
//   - the sea: how much of the land round it is sea, and on which side; a town on the coast has a shore however little
//     of the sea is near, looking farther for it;
//   - islands, where most of the land round it is sea (TOWN_WATER.wide);
//   - a river: where a river runs near, the way it runs and how far it passes from the town. A town whose name speaks of a
//     river (Riverbend, Silverrun, Stagsford) has one: the map's nearest within TOWN_WATER.riverReach, else one by its name.
// For a field battle the water is read where the field lies, between the two lands, and laid from the field's middle.
// The same land gives the same water every time (the map's country is the seed's). It reads the campaign and changes nothing;
// whoever calls it hands it the map's country, so that it imports nothing of campaign.ts but its types.
import type { Campaign, Terrain } from './campaign';
import { MAP_W, homeCorner } from './campaignbase';
import type { WaterShape } from './waterlay';

export const TOWN_WATER = {
  /** How far round the town is looked at, in the map's points; for a coastal town with no sea that near, how far to look for it. */
  reach: 48, coastReach: 120,
  /** A share of sea round the town at or over this gives it a shore though it is not on the coast. */
  shore: 0.08,
  /** Over this share of sea, there are islands out in it. */
  wide: 0.4,
  /** How far a river may pass from the town on the ground, as a share of its width. */
  riverOff: 0.35,
  /** A town named for a river (`RIVER_NAME`) with none this near looks this far for the map's nearest. */
  riverReach: 160,
};

/** A town whose name speaks of a river: it has one on its ground (a river, a stream that runs, a ford). */
export const RIVER_NAME = /river|run\b|ford/i;

/**
 * The water of a land, for its ground, or undefined where it has none. `T` is the map's country (campaign.ts terrainOf).
 * `at`: for a field battle, the point the field lies at (between the lands) and the ground is laid from its middle.
 */
export function waterOf(c: Campaign, tid: number, T: Terrain, at?: { x: number; y: number }): WaterShape | undefined {
  const land = c.territories[tid];
  if (!land) return undefined;
  const t = at ? { x: at.x, y: at.y, trait: '', name: '' } : land;
  const S = Math.round(MAP_W / (T.gw - 1)); // the map's own step between points (campaign.ts LAND_STEP)
  const look = (reach: number): { n: number; sea: number; sx: number; sy: number; wet: [number, number][] } => {
    const out = { n: 0, sea: 0, sx: 0, sy: 0, wet: [] as [number, number][] };
    const r = Math.ceil(reach / S), gi = Math.round(t.x / S), gj = Math.round(t.y / S);
    for (let j = gj - r; j <= gj + r; j++) for (let i = gi - r; i <= gi + r; i++) {
      if (i < 0 || j < 0 || i >= T.gw || j >= T.gh) continue;
      const ux = i * S - t.x, uy = j * S - t.y;
      if (Math.hypot(ux, uy) > reach) continue;
      const k = j * T.gw + i;
      out.n++;
      if (T.H[k] <= 0) { out.sea++; out.sx += ux; out.sy += uy; } else if (T.wet[k]) out.wet.push([ux, uy]);
    }
    return out;
  };
  const near = look(TOWN_WATER.reach), shape: WaterShape = { corner: at ? -1 : homeCorner(land) };
  let share = near.n ? near.sea / near.n : 0, from = near;
  if (t.trait === 'coast' && near.sea === 0) { from = look(TOWN_WATER.coastReach); share = 0; }
  if ((share >= TOWN_WATER.shore || t.trait === 'coast') && from.sea > 0) {
    shape.shore = { angle: Math.atan2(from.sy, from.sx), share };
    if (share > TOWN_WATER.wide) shape.islands = 2 + Math.min(2, Math.floor((share - TOWN_WATER.wide) * 6));
  }
  // A town named for a river has one: where none runs this near, the map's nearest within riverReach, else one by its name.
  const named = !at && RIVER_NAME.test(land.name);
  const wet = near.wet.length >= 2 || !named ? near.wet : look(TOWN_WATER.riverReach).wet;
  if (named && wet.length < 2) {
    let h = 0; for (const ch of land.name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    shape.river = { angle: ((h % 360) / 360) * Math.PI, offset: (((h >>> 9) % 100) / 100 - 0.5) * TOWN_WATER.riverOff };
  } else if (wet.length >= 2) {
    // The way the river runs: the long axis of its wet points near the town.
    const cx = wet.reduce((a, p) => a + p[0], 0) / wet.length, cy = wet.reduce((a, p) => a + p[1], 0) / wet.length;
    let xx = 0, yy = 0, xy = 0;
    for (const [x, y] of wet) { xx += (x - cx) ** 2; yy += (y - cy) ** 2; xy += (x - cx) * (y - cy); }
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy), dx = Math.cos(angle), dy = Math.sin(angle);
    const across = -cx * dy + cy * dx; // how far its middle passes from the town, across its way
    shape.river = { angle, offset: Math.max(-TOWN_WATER.riverOff, Math.min(TOWN_WATER.riverOff, (across / TOWN_WATER.reach) * TOWN_WATER.riverOff)) }; // a far river is drawn in to pass at most riverOff from the town
  }
  return shape.shore || shape.river ? shape : undefined;
}
