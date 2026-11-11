// Procedural, point-symmetric two-player map generation.

export const T_GRASS = 0;
export const T_WATER = 1;
export const T_DIRT = 2;

export type NodeType = 'tree' | 'berries' | 'gold' | 'stone' | 'carcass';

export interface MapSpec {
  size: number;
  terrain: Uint8Array;
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

export function generateMap(seed: number, size = 96): MapSpec {
  const rng = mulberry32(seed);
  const N = size;
  const terrain = new Uint8Array(N * N);
  const taken = new Uint8Array(N * N); // cells holding a resource node
  const nodes: MapSpec['nodes'] = [];
  const starts = [
    { x: 17, y: 17 },
    { x: N - 17, y: N - 17 },
  ];

  const forestN = valueNoise(rng, N, 8);
  const waterN = valueNoise(rng, N, 13);
  // Averaging a point with its mirror image keeps the map fair for both players.
  const sym = (f: (x: number, y: number) => number, x: number, y: number) =>
    (f(x, y) + f(N - 1 - x, N - 1 - y)) / 2;
  const startDist = (x: number, y: number) =>
    Math.min(...starts.map((s) => Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y)));

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = startDist(x, y);
      const i = y * N + x;
      if (d < 5) terrain[i] = T_DIRT;
      else if (d > 15 && sym(waterN, x, y) > 0.66) terrain[i] = T_WATER;
    }
  }

  const free = (cx: number, cy: number, s = 1) => {
    for (let y = cy; y < cy + s; y++)
      for (let x = cx; x < cx + s; x++) {
        if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) return false;
        if (terrain[y * N + x] === T_WATER || taken[y * N + x]) return false;
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
  /** Place a node and its mirror image. */
  const putPair = (type: NodeType, cx: number, cy: number) => {
    const s = type === 'gold' || type === 'stone' ? 2 : 1;
    const mx = N - cx - s, my = N - cy - s;
    if (!free(cx, cy, s) || !free(mx, my, s)) return false;
    put(type, cx, cy);
    put(type, mx, my);
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
  scatter('gold', 4, 22);
  scatter('stone', 3, 22);
  scatter('berries', 3, 18);

  // Forests.
  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      if (startDist(x, y) < 8) continue;
      if (sym(forestN, x, y) > 0.6 && rng() < 0.82 && y * N + x <= (N - 1 - y) * N + (N - 1 - x)) putPair('tree', x, y);
    }

  // Guarantee a land route between the two bases by carving one if needed.
  const blocked = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) blocked[i] = terrain[i] === T_WATER || taken[i] ? 1 : 0;
  if (!connected(N, blocked, starts[0], starts[1])) {
    const carve = new Uint8Array(N * N);
    const steps = N * 3;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const wob = Math.sin(t * Math.PI * 3) * 6;
      const x = starts[0].x + (starts[1].x - starts[0].x) * t + wob;
      const y = starts[0].y + (starts[1].y - starts[0].y) * t - wob;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const cx = Math.floor(x) + dx, cy = Math.floor(y) + dy;
          if (cx >= 0 && cy >= 0 && cx < N && cy < N) carve[cy * N + cx] = 1;
        }
    }
    for (let i = 0; i < N * N; i++) if (carve[i] && terrain[i] === T_WATER) terrain[i] = T_GRASS;
    for (let k = nodes.length - 1; k >= 0; k--) {
      const n = nodes[k];
      if (n.type === 'tree' && carve[n.cy * N + n.cx]) nodes.splice(k, 1);
    }
  }

  // Wildlife: deer near each base and out on the map, wolf packs in the wilds.
  const animals: MapSpec['animals'] = [];
  const herd = (type: 'deer' | 'wolf', x: number, y: number, count: number): number => {
    let placed = 0;
    for (let k = 0; k < count * 4 && placed < count; k++) {
      const ax = x + (rng() - 0.5) * 4, ay = y + (rng() - 0.5) * 4;
      if (!free(Math.floor(ax), Math.floor(ay)) || !free(Math.floor(N - ax), Math.floor(N - ay))) continue;
      animals.push({ type, x: ax, y: ay }, { type, x: N - ax, y: N - ay });
      placed++;
    }
    return placed;
  };
  for (let a = 0, done = false; a < 12 && !done; a++) {
    const ang = rng() * Math.PI * 2;
    done = herd('deer', s0.x + Math.cos(ang) * 12, s0.y + Math.sin(ang) * 12, 4) >= 3;
  }
  for (let k = 0, tries = 0; k < 3 && tries < 60; tries++) {
    const x = 6 + rng() * (N - 12), y = 6 + rng() * (N - 12);
    if (startDist(x, y) > 20 && herd('deer', x, y, 3) > 0) k++;
  }
  for (let k = 0, tries = 0; k < 2 && tries < 60; tries++) {
    const x = 6 + rng() * (N - 12), y = 6 + rng() * (N - 12);
    if (startDist(x, y) > 27 && herd('wolf', x, y, 2 + Math.floor(rng() * 2)) > 0) k++;
  }

  return { size: N, terrain, starts, nodes, animals };
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
