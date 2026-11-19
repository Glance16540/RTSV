// The water of a battle's ground, as the land around it has it (the board's "Navy": there was one water map only, a lake
// in the middle, with no shore, river or islands). townwater.ts reads a town's water off the campaign map; this lays it
// on the battle's ground, before anything else is placed on it (map.ts), so that resources, fish, docks and ships find
// it as they find any water:
//   - a shore: the sea beyond a ragged line on the side the land's sea lies, measured from the town's own corner, so
//     that a town on the coast has the sea beside it; the farther the land's sea reaches, the more of the ground it takes;
//   - islands: where the sea is wide, a few of land out in it;
//   - a river: a band of water across the ground, at the angle the land's river runs and as far off as it passes the
//     town, winding a little, with fords across it at intervals (map.ts also carves a way through if any home is cut off).
// The ground round every home stays dry (WATER_LAY.keep). Everything is drawn from the ground's own seed by dice of its
// own, so the same town is the same each time, and a ground with no water shape is laid exactly as before.

/** The water of a battle's ground. Angles in radians on the ground (0 is towards +x, a quarter turn towards +y). */
export interface WaterShape {
  /** The start corner (0 to 3) that is the town's: the shore and the river are placed from it; -1 for the ground's middle (a field battle). */
  corner: number;
  /** The sea: on which side, and how much of the land round it is sea (0 to 1). */
  shore?: { angle: number; share: number };
  /** Islands out in a wide sea: how many. */
  islands?: number;
  /** A river: the way it runs, and how far it passes from the town, as a share of the ground's width (signed). */
  river?: { angle: number; offset: number };
  /** The start corners in use, whose ground stays dry (the game fills it in from its sides; all four if it is not given). */
  dry?: number[];
}

export const WATER_LAY = {
  /** Tiles round each home that stay dry. */
  keep: 13,
  /** How far from the town the shore lies, in tiles, at the least and the most sea. */
  near: 16, far: 30,
  /** A river's half width in tiles; fords every so many tiles along it, and how wide. */
  half: 1.6, fordEvery: 22, ford: 4,
  /** An island's radius in tiles, at the least and the most. */
  isle: [3, 6] as [number, number],
};

const T_WATER = 1, T_GRASS = 0;

function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Lay the water of a shape on a ground's terrain (N by N), keeping the ground round the starts dry. `seed` is the ground's
 * own; the dice are its own too. Returns how many tiles became water.
 */
export function layWater(terrain: Uint8Array, N: number, seed: number, shape: WaterShape, starts: { x: number; y: number }[]): number {
  const r = rngOf(seed ^ 0x3a7e2b1d), home = shape.corner < 0 ? { x: N / 2, y: N / 2 } : starts[Math.max(0, Math.min(starts.length - 1, shape.corner))] ?? { x: N / 2, y: N / 2 };
  const homes = shape.dry?.length ? shape.dry.map((i) => starts[i]).filter(Boolean) : starts; // only the corners someone starts in
  const dry = (x: number, y: number): boolean => homes.some((s) => Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) < WATER_LAY.keep);
  const k = [r(), r(), r(), r()].map((v) => v * Math.PI * 2);
  let n = 0;
  const wet = (i: number): void => { if (terrain[i] !== T_WATER) { terrain[i] = T_WATER; n++; } };
  if (shape.shore) {
    const { angle, share } = shape.shore, dx = Math.cos(angle), dy = Math.sin(angle);
    const line = WATER_LAY.far - (WATER_LAY.far - WATER_LAY.near) * Math.min(1, Math.max(0, share));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (dry(x, y)) continue;
      const along = (x + 0.5 - home.x) * dx + (y + 0.5 - home.y) * dy, across = -(x + 0.5 - home.x) * dy + (y + 0.5 - home.y) * dx;
      const ragged = 2.2 * Math.sin(across / 7 + k[0]) + 1.4 * Math.sin(across / 3.1 + k[1]);
      if (along > line + ragged) wet(y * N + x);
    }
    // Islands where the sea is wide: blobs of land well out from the shore.
    for (let i = 0, tries = 0; i < (shape.islands ?? 0) && tries < 60; tries++) {
      const cx = 3 + r() * (N - 6), cy = 3 + r() * (N - 6), rad = WATER_LAY.isle[0] + r() * (WATER_LAY.isle[1] - WATER_LAY.isle[0]);
      const along = (cx - home.x) * dx + (cy - home.y) * dy;
      if (along < line + rad + 6) continue;
      let land = 0;
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad, edge = 1 + 0.18 * Math.sin(Math.atan2(y - cy, x - cx) * 3 + k[2]);
        if (d < edge && terrain[y * N + x] === T_WATER) { terrain[y * N + x] = T_GRASS; n--; land++; }
      }
      if (land > 6) i++;
    }
  }
  if (shape.river) {
    const { angle, offset } = shape.river, dx = Math.cos(angle), dy = Math.sin(angle), off = offset * N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (dry(x, y)) continue;
      const along = (x + 0.5 - home.x) * dx + (y + 0.5 - home.y) * dy, across = -(x + 0.5 - home.x) * dy + (y + 0.5 - home.y) * dx;
      const bend = 3 * Math.sin(along / 11 + k[3]) + 1.2 * Math.sin(along / 4.3 + k[1]);
      if (Math.abs(across - off - bend) > WATER_LAY.half) continue;
      // A ford every so often along it: dry ground across the water.
      const m = ((along % WATER_LAY.fordEvery) + WATER_LAY.fordEvery) % WATER_LAY.fordEvery;
      if (m < WATER_LAY.ford) continue;
      wet(y * N + x);
    }
  }
  return n;
}
