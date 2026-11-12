// Procedural, point-symmetric two-player map generation.

export const T_GRASS = 0;
export const T_WATER = 1;
export const T_DIRT = 2;
/** Mountain: nothing walks, sails or builds here. */
export const T_ROCK = 3;
/** How high the hills rise, in tiles. */
/** Loose sand: desert, and the beach along any shore. A little slow to cross. */
export const T_SAND = 4;
/** Marsh: reeds and standing water. Slow going. */
export const T_MARSH = 5;
/** Lying snow. Slow going. */
export const T_SNOW = 6;
/** The kind of country a map is: '' is the plain grassland of the earliest maps, with none of the newer ground. */
export type Climate = '' | 'temperate' | 'desert' | 'snow' | 'steppe';
export const HILL_HEIGHT = 1.6;

export type NodeType = 'tree' | 'berries' | 'gold' | 'stone' | 'carcass' | 'fish';

export interface MapSpec {
  size: number;
  terrain: Uint8Array;
  /** Height of the land at each tile, 0 on the flat. All zero unless the map was made with relief. */
  height: Float32Array;
  starts: { x: number; y: number }[];
  nodes: { type: NodeType; cx: number; cy: number }[];
  animals: { type: 'deer' | 'wolf'; x: number; y: number }[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(rng: () => number, size: number, scale: number): (x: number, y: number) => number {
  const g = Math.ceil(size / scale) + 2;
  const lattice = new Float32Array(g * g);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / scale, fy = y / scale;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = s(fx - ix), ty = s(fy - iy);
    const a = lattice[iy * g + ix], b = lattice[iy * g + ix + 1];
    const c = lattice[(iy + 1) * g + ix], d = lattice[(iy + 1) * g + ix + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

/**
 * @param sea Put a great lake in the middle of the map, for fishing and warships.
 * @param relief Raise hills and mountain ranges. Mountains cannot be crossed; hills can, and give the high ground.
 */
export function generateMap(seed: number, size = 96, players = 2, sea = false, relief = false, climate: Climate = ''): MapSpec {
  const rng = mulberry32(seed);
  const N = size;
  const terrain = new Uint8Array(N * N);
  const taken = new Uint8Array(N * N); // cells holding a resource node
  const nodes: MapSpec['nodes'] = [];
  // Two players face each other across the map (point symmetry). Three or four each take a
  // corner of a map that looks the same from all four (quarter-turn symmetry).
  const quad = players > 2;
  /** A cell-aligned square and its symmetric images. */
  const images = (cx: number, cy: number, s = 1): [number, number][] => quad
    ? [[cx, cy], [N - s - cy, cx], [N - s - cx, N - s - cy], [cy, N - s - cx]]
    : [[cx, cy], [N - s - cx, N - s - cy]];
  const corners = images(17, 17, 0).map(([x, y]) => ({ x, y }));
  const starts = corners.slice(0, Math.max(2, Math.min(4, players)));

  const forestN = valueNoise(rng, N, 8);
  const waterN = valueNoise(rng, N, 13);
  // Averaging a point with its symmetric images keeps the map fair for every player.
  const sym = (f: (x: number, y: number) => number, x: number, y: number) => {
    let v = 0;
    const im = images(x, y);
    for (const [ix, iy] of im) v += f(ix, iy);
    return v / im.length;
  };
  const startDist = (x: number, y: number) =>
    Math.min(...corners.map((s) => Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y)));

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = startDist(x, y);
      const i = y * N + x;
      if (d < 5) terrain[i] = T_DIRT;
      else if (d > 15 && sym(waterN, x, y) > 0.66) terrain[i] = T_WATER;
      else if (sea && d > 15 && Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) < N * 0.2 * (0.75 + 0.5 * sym(waterN, x, y))) terrain[i] = T_WATER;
    }
  }

  // Hills and mountains use their own dice, so the rest of the land is laid out by the same rolls with or without them.
  const height = new Float32Array(N * N);
  if (relief) {
    const rr = mulberry32(seed ^ 0x7e11ef);
    const hillN = valueNoise(rr, N, 17), ridgeN = valueNoise(rr, N, 10), roughN = valueNoise(rr, N, 5);
    const step = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x, d = startDist(x, y);
        if (terrain[i] === T_WATER) continue;
        // A range runs where two fields of noise both run high, well away from anyone's home.
        const ridge = sym(ridgeN, x, y) * 0.75 + sym(roughN, x, y) * 0.25;
        if (d > 21 && ridge > 0.66 && x > 1 && y > 1 && x < N - 2 && y < N - 2) { terrain[i] = T_ROCK; continue; }
        // Hills swell up between the homes; the land by each Town Center stays level.
        height[i] = step(0.5, 0.8, sym(hillN, x, y)) * step(13, 22, d) * HILL_HEIGHT;
      }
    }
    // The land comes down to meet the water: nothing stands high at the shore.
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        const i = y * N + x;
        if (!height[i]) continue;
        let lo = height[i];
        for (const j of [i - 1, i + 1, i - N, i + N]) lo = Math.min(lo, terrain[j] === T_WATER ? 0 : height[j] + 0.45);
        height[i] = lo;
      }
    }
  }

  const free = (cx: number, cy: number, s = 1) => {
    for (let y = cy; y < cy + s; y++)
      for (let x = cx; x < cx + s; x++) {
        if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) return false;
        if (terrain[y * N + x] === T_WATER || terrain[y * N + x] === T_ROCK || taken[y * N + x]) return false;
      }
    return true;
  };
  const put = (type: NodeType, cx: number, cy: number) => {
    const s = type === 'gold' || type === 'stone' ? 2 : 1;
    if (!free(cx, cy, s)) return false;
    for (let y = cy; y < cy + s; y++) for (let x = cx; x < cx + s; x++) taken[y * N + x] = 1;
    nodes.push({ type, cx, cy });
    return true;
  };
  /** Place a node and its symmetric images. */
  const putPair = (type: NodeType, cx: number, cy: number) => {
    const s = type === 'gold' || type === 'stone' ? 2 : 1;
    const im = images(cx, cy, s);
    if (!im.every(([x, y]) => free(x, y, s))) return false;
    for (const [x, y] of im) put(type, x, y);
    return true;
  };

  // Guaranteed starting resources around the first start (mirrored for the second).
  const s0 = starts[0];
  const berryC = { x: s0.x + 6, y: s0.y - 4 };
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [2, 1], [1, 2], [-1, 1], [2, -1]]) putPair('berries', berryC.x + dx, berryC.y + dy);
  putPair('gold', s0.x - 9, s0.y + 4);
  putPair('gold', s0.x + 5, s0.y + 9);
  putPair('stone', s0.x - 5, s0.y - 10);
  for (const [fx, fy] of [[s0.x - 4, s0.y + 11], [s0.x + 11, s0.y + 2], [s0.x - 11, s0.y - 5]]) {
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if (dx * dx + dy * dy <= 9 + rng() * 3 && startDist(fx + dx, fy + dy) > 6.5) putPair('tree', fx + dx, fy + dy);
  }

  // Contested resources elsewhere on the map.
  const scatter = (type: NodeType, count: number, minStart: number) => {
    let tries = 0;
    while (count > 0 && tries++ < 400) {
      const x = 3 + Math.floor(rng() * (N - 8)), y = 3 + Math.floor(rng() * (N - 8));
      if (startDist(x, y) < minStart) continue;
      if (type === 'berries') {
        let ok = false;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0]]) ok = putPair('berries', x + dx, y + dy) || ok;
        if (ok) count--;
      } else if (putPair(type, x, y)) count--;
    }
  };
  const area = (N * N) / (96 * 96); // more land, more to fight over
  scatter('gold', Math.round(4 * area), 22);
  scatter('stone', Math.round(3 * area), 22);
  scatter('berries', Math.round(3 * area), 18);

  // Forests.
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      if (startDist(x, y) < 8) continue;
      // Each set of symmetric cells is decided once, from its lowest-numbered member.
      if (images(x, y).some(([ix, iy]) => iy * N + ix < y * N + x)) continue;
      if (sym(forestN, x, y) > 0.6 && rng() < 0.82) putPair('tree', x, y);
    }

  // Guarantee a land route from the first base to every other by carving one where needed.
  for (const target of starts.slice(1)) {
    const blocked = new Uint8Array(N * N);
    for (const n of nodes) {
      const sz = n.type === 'gold' || n.type === 'stone' ? 2 : 1;
      for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) blocked[(n.cy + y) * N + n.cx + x] = 1;
    }
    for (let i = 0; i < N * N; i++) if (terrain[i] === T_WATER || terrain[i] === T_ROCK) blocked[i] = 1;
    if (connected(N, blocked, starts[0], target)) continue;
    const carve = new Uint8Array(N * N);
    const steps = N * 3;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const wob = Math.sin(t * Math.PI * 3) * 6;
      const x = starts[0].x + (target.x - starts[0].x) * t + wob;
      const y = starts[0].y + (target.y - starts[0].y) * t - wob;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const cx = Math.floor(x) + dx, cy = Math.floor(y) + dy;
          if (cx >= 0 && cy >= 0 && cx < N && cy < N) carve[cy * N + cx] = 1;
        }
    }
    for (let i = 0; i < N * N; i++) if (carve[i] && (terrain[i] === T_WATER || terrain[i] === T_ROCK)) terrain[i] = T_GRASS; // a ford, or a pass through the mountains
    for (let k = nodes.length - 1; k >= 0; k--) {
      const n = nodes[k];
      if (n.type === 'tree' && carve[n.cy * N + n.cx]) { taken[n.cy * N + n.cx] = 0; nodes.splice(k, 1); }
    }
  }

  // Fish shoals in open water. They use their own dice so that the land is the same with or without them.
  const fishRng = mulberry32(seed ^ 0x51f15e);
  const wet = (x: number, y: number) => x > 0 && y > 0 && x < N - 1 && y < N - 1 && terrain[y * N + x] === T_WATER && !taken[y * N + x];
  for (let k = Math.round((sea ? 9 : 3) * ((N * N) / (96 * 96))), tries = 0; k > 0 && tries < 600; tries++) {
    const x = 2 + Math.floor(fishRng() * (N - 4)), y = 2 + Math.floor(fishRng() * (N - 4));
    const im = images(x, y);
    if (!im.every(([ix, iy]) => wet(ix, iy))) continue;
    for (const [ix, iy] of im) if (!taken[iy * N + ix]) { taken[iy * N + ix] = 1; nodes.push({ type: 'fish', cx: ix, cy: iy }); }
    k--;
  }

  // Wildlife: deer near each base and out on the map, wolf packs in the wilds.
  const animals: MapSpec['animals'] = [];
  const herd = (type: 'deer' | 'wolf', x: number, y: number, count: number): number => {
    let placed = 0;
    for (let k = 0; k < count * 4 && placed < count; k++) {
      const ax = x + (rng() - 0.5) * 4, ay = y + (rng() - 0.5) * 4;
      const im: [number, number][] = quad ? [[ax, ay], [N - ay, ax], [N - ax, N - ay], [ay, N - ax]] : [[ax, ay], [N - ax, N - ay]];
      if (!im.every(([x, y]) => free(Math.floor(x), Math.floor(y)))) continue;
      for (const [x, y] of im) animals.push({ type, x, y });
      placed++;
    }
    return placed;
  };
  for (let a = 0, done = false; a < 12 && !done; a++) {
    const ang = rng() * Math.PI * 2;
    done = herd('deer', s0.x + Math.cos(ang) * 12, s0.y + Math.sin(ang) * 12, 4) >= 3;
  }
  for (let k = 0, tries = 0; k < Math.round(3 * area) && tries < 90; tries++) {
    const x = 6 + rng() * (N - 12), y = 6 + rng() * (N - 12);
    if (startDist(x, y) > 20 && herd('deer', x, y, 3) > 0) k++;
  }
  for (let k = 0, tries = 0; k < Math.round(2 * area) && tries < 90; tries++) {
    const x = 6 + rng() * (N - 12), y = 6 + rng() * (N - 12);
    if (startDist(x, y) > 27 && herd('wolf', x, y, 2 + Math.floor(rng() * 2)) > 0) k++;
  }

  // The country itself, on its own dice: sand, snow and marsh over the grass, and thinner woods where it is dry.
  if (climate) {
    const cr = mulberry32(seed ^ 0xc11a7e);
    const patch = valueNoise(cr, N, 9), fine = valueNoise(cr, N, 4);
    const water = (x: number, y: number, r: number): boolean => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const ax = x + dx, ay = y + dy; if (ax >= 0 && ay >= 0 && ax < N && ay < N && terrain[ay * N + ax] === T_WATER) return true; }
      return false;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      // Decided once for a tile and its mirror images together, so the land is the same from every home.
      const im = images(x, y).map(([ix, iy]) => iy * N + ix);
      if (im.some((j) => j < i) || im.some((j) => terrain[j] !== T_GRASS)) continue;
      const p = sym(patch, x, y), f = sym(fine, x, y), d = startDist(x, y);
      let to = T_GRASS;
      if (climate === 'desert') {
        // Sand everywhere but round water (an oasis), on scattered scrub, and on the green each people settled.
        if (!water(x, y, 3) && p < 0.72 && d > 6) to = T_SAND;
      } else if (climate === 'snow') {
        if (d > 8 && (d > 15 || p * 0.7 + f * 0.3 > 0.34)) to = T_SNOW;
      } else if (water(x, y, 1)) to = T_SAND; // a beach
      else if (climate === 'temperate' && d > 13 && im.every((j) => height[j] < 0.2 && !taken[j]) && ((water(x, y, 3) && p > 0.52) || p * 0.6 + f * 0.4 > 0.8)) to = T_MARSH;
      if (to !== T_GRASS) for (const j of im) terrain[j] = to;
    }
    if (climate === 'desert' || climate === 'steppe') {
      for (let k = nodes.length - 1; k >= 0; k--) {
        const n = nodes[k];
        if (n.type !== 'tree' || startDist(n.cx, n.cy) < 16 || (climate === 'desert' && water(n.cx, n.cy, 4))) continue;
        if (Math.round(sym(fine, n.cx, n.cy) * 1e6) < (climate === 'desert' ? 620000 : 500000)) { taken[n.cy * N + n.cx] = 0; nodes.splice(k, 1); }
      }
    }
  }

  return { size: N, terrain, height, starts, nodes, animals };
}

export function connected(N: number, blocked: Uint8Array, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const seen = new Uint8Array(N * N);
  const start = Math.floor(a.y) * N + Math.floor(a.x);
  const goal = Math.floor(b.y) * N + Math.floor(b.x);
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const c = stack.pop()!;
    if (c === goal) return true;
    const x = c % N, y = (c / N) | 0;
    if (x > 0 && !seen[c - 1] && !blocked[c - 1]) { seen[c - 1] = 1; stack.push(c - 1); }
    if (x < N - 1 && !seen[c + 1] && !blocked[c + 1]) { seen[c + 1] = 1; stack.push(c + 1); }
    if (y > 0 && !seen[c - N] && !blocked[c - N]) { seen[c - N] = 1; stack.push(c - N); }
    if (y < N - 1 && !seen[c + N] && !blocked[c + N]) { seen[c + N] = 1; stack.push(c + N); }
  }
  return false;
}
