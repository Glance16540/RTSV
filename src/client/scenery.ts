// The land itself: painted ground with soft edges between grass, earth and sand, a lake bed that
// falls away under moving water, scattered grass, stones and flowers, and cloud shadows drifting over.

import * as THREE from 'three';
import { bush } from './flora';
import { Climate, T_DIRT, T_MARSH, T_ROCK, T_SAND, T_SNOW, T_WATER } from '../sim/map';

/** Repeatable noise in [0, 1): the same land is drawn the same way every time. */
function hash(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x: number, y: number): number => noise(x, y) * 0.55 + noise(x * 2.1 + 9, y * 2.1 + 4) * 0.3 + noise(x * 4.3 + 3, y * 4.3 + 7) * 0.15;
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export interface Scenery {
  /** Everything to add to the scene. */
  group: THREE.Group;
  /** Height of the ground at a point: hills, mountains, and never below the waterline. */
  heightAt(x: number, y: number): number;
  /** How high the swell stands at a point just now, about -0.7 to 0.7: what a ship there rides on. Matches the water drawn. */
  swellAt(x: number, y: number, clock: number): number;
  /** Advance the water and the cloud shadows. `day` is 1 in daylight down to 0 at night; `grey` is how overcast it is, 0 to 1. */
  update(clock: number, day?: number, grey?: number): void;
  /** Take away the bushes, rocks and reeds within `r` of a point: something has been built there. */
  clearAt(x: number, y: number, r: number): void;
}

export function buildScenery(N: number, T: Uint8Array, hills: Float32Array, climate: Climate = '', woods: { x: number; y: number }[] = []): Scenery {
  const group = new THREE.Group();
  const tAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= N || y >= N ? T_WATER : T[y * N + x]);

  // ---- the shape of the land ----
  // Mountains climb with every step into the range, so a wide range has high peaks and a thin one is a ridge.
  const depth = new Float32Array(N * N);
  let frontier: number[] = [];
  for (let i = 0; i < N * N; i++) if (T[i] === T_ROCK) { const x = i % N, y = (i / N) | 0; if ([tAt(x - 1, y), tAt(x + 1, y), tAt(x, y - 1), tAt(x, y + 1)].some((t) => t !== T_ROCK)) { depth[i] = 1; frontier.push(i); } }
  for (let d = 2; frontier.length; d++) {
    const next: number[] = [];
    for (const i of frontier) for (const j of [i - 1, i + 1, i - N, i + N]) if (j >= 0 && j < N * N && T[j] === T_ROCK && !depth[j]) { depth[j] = d; next.push(j); }
    frontier = next;
  }
  const tileH = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const x = i % N, y = (i / N) | 0;
    tileH[i] = T[i] === T_ROCK ? Math.min(7, 0.8 + Math.pow(depth[i], 1.05) * 1.35) * (0.7 + noise(x * 0.45 + 3, y * 0.45 + 8) * 0.7) : hills[i];
  }
  const W = N + 1;
  const cornerH = new Float32Array(W * W);
  for (let y = 0; y <= N; y++) {
    for (let x = 0; x <= N; x++) {
      const wet = tAt(x - 1, y - 1) === T_WATER && tAt(x, y - 1) === T_WATER && tAt(x - 1, y) === T_WATER && tAt(x, y) === T_WATER;
      let sum = 0, n = 0, rock = 0;
      for (const [tx, ty] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]) if (tx >= 0 && ty >= 0 && tx < N && ty < N) { sum += tileH[ty * N + tx]; n++; if (T[ty * N + tx] === T_ROCK) rock++; }
      // A crag is jagged; a hill is smooth.
      cornerH[y * W + x] = wet ? 0 : (n ? sum / n : 0) + (rock === 4 ? (hash(x * 5, y * 7) - 0.5) * 1.7 : rock >= 2 ? (hash(x * 5, y * 7) - 0.5) * 0.5 : 0);
    }
  }
  // How wet a point is, 0 on dry land to 1 in open water, as a smooth field: the tiles' hard corners are rounded
  // off, so a shore runs in curves and not in steps. Sampled four times to the tile and blurred over about a tile.
  const FINE = 4, F = N * FINE + 1;
  let wet = new Float32Array(F * F);
  {
    const raw = (u: number, v: number): number => {
      const x = u - 0.5, y = v - 0.5, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const k = (a: number, b: number) => (tAt(a, b) === T_WATER ? 1 : 0);
      return (k(xi, yi) * (1 - fx) + k(xi + 1, yi) * fx) * (1 - fy) + (k(xi, yi + 1) * (1 - fx) + k(xi + 1, yi + 1) * fx) * fy;
    };
    for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) wet[j * F + i] = raw(i / FINE, j / FINE);
    const R = 3;
    for (let pass = 0; pass < 2; pass++) {
      for (const along of [1, F]) {
        const out = new Float32Array(F * F);
        for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
          let sum = 0, n = 0;
          for (let d = -R; d <= R; d++) { const a = (along === 1 ? i : j) + d; if (a < 0 || a >= F) { sum += 1; n++; continue; } sum += wet[j * F + i + d * along]; n++; } // beyond the map is sea
          out[j * F + i] = sum / n;
        }
        wet = out;
      }
    }
  }
  const wetAt = (x: number, y: number): number => {
    const fx = Math.min(F - 1.001, Math.max(0, x * FINE)), fy = Math.min(F - 1.001, Math.max(0, y * FINE));
    const xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi, i = yi * F + xi;
    return (wet[i] * (1 - tx) + wet[i + 1] * tx) * (1 - ty) + (wet[i + F] * (1 - tx) + wet[i + F + 1] * tx) * ty;
  };
  // The ground: the land's own height, falling away smoothly into a bed under open water. Land tiles stay dry to
  // their edge (wetness one half), so no one who can walk there is drawn wading.
  const groundH = (x: number, y: number): number => {
    const fx = Math.min(N - 0.001, Math.max(0, x)), fy = Math.min(N - 0.001, Math.max(0, y));
    const xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi, i = yi * W + xi;
    const dry = (cornerH[i] * (1 - tx) + cornerH[i + 1] * tx) * (1 - ty) + (cornerH[i + W] * (1 - tx) + cornerH[i + W + 1] * tx) * ty;
    const w = wetAt(x, y);
    return dry * (1 - smooth(0.3, 0.6, w)) - smooth(0.5, 0.92, w) * 0.62;
  };
  const heightAt = (x: number, y: number): number => Math.max(0, groundH(x, y));
  // How much of a kind of ground there is at a point, blended between tile centres so edges are soft.
  const amount = (kind: number, u: number, v: number): number => {
    const x = u - 0.5, y = v - 0.5, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const k = (a: number, b: number) => (tAt(a, b) === kind ? 1 : 0);
    return (k(xi, yi) * (1 - fx) + k(xi + 1, yi) * fx) * (1 - fy) + (k(xi, yi + 1) * (1 - fx) + k(xi + 1, yi + 1) * fx) * fy;
  };

  // How near water the land is, 0 far off to 1 at the bank: grass is lusher there, and in the desert it is the
  // only place anything green grows.
  const moist = new Float32Array(N * N);
  {
    const d = new Float32Array(N * N).fill(99);
    let front: number[] = [];
    for (let i = 0; i < N * N; i++) if (T[i] === T_WATER || T[i] === T_MARSH) { d[i] = 0; front.push(i); }
    for (let k = 1; k <= 8 && front.length; k++) {
      const next: number[] = [];
      for (const i of front) for (const j of [i - 1, i + 1, i - N, i + N]) if (j >= 0 && j < N * N && d[j] > k) { d[j] = k; next.push(j); }
      front = next;
    }
    for (let i = 0; i < N * N; i++) moist[i] = Math.max(0, 1 - d[i] / 8);
  }
  // Where trees stand close, the ground under them is dark and littered.
  const shade = new Float32Array(N * N);
  for (const w of woods) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = Math.floor(w.x) + dx, y = Math.floor(w.y) + dy;
    if (x >= 0 && y >= 0 && x < N && y < N) shade[y * N + x] = Math.min(1, shade[y * N + x] + (dx || dy ? 0.14 : 0.5));
  }
  const field = (f: Float32Array, u: number, v: number): number => {
    const x = Math.min(N - 1.001, Math.max(0, u - 0.5)), y = Math.min(N - 1.001, Math.max(0, v - 0.5)), xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, i = yi * N + xi;
    return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + N] * (1 - fx) + f[i + N + 1] * fx) * fy;
  };
  const MEADOW = [[244, 233, 176], [240, 200, 216], [216, 208, 255], [255, 208, 96], [255, 255, 255], [220, 70, 60]];

  // ---- the painted ground ----
  const px = N * 16 <= 2048 ? 16 : Math.floor(2048 / N);
  const c = document.createElement('canvas');
  c.width = c.height = N * px;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const u = x / px, v = y / px;
      // Wander the borders so they do not follow the square tiles.
      const ju = u + (noise(u * 1.9 + 31, v * 1.9) - 0.5) * 0.7, jv = v + (noise(u * 1.9, v * 1.9 + 17) - 0.5) * 0.7;
      const water = wetAt(ju, jv), dirt = amount(T_DIRT, ju, jv), rock = amount(T_ROCK, ju, jv), high = groundH(u, v);
      const dune = amount(T_SAND, ju, jv), bog = amount(T_MARSH, ju, jv), white = amount(T_SNOW, ju, jv);
      const broad = fbm(u * 0.16, v * 0.16), mid = fbm(u * 0.9 + 50, v * 0.9), grain = hash(x, y), fine = noise(u * 5.3 + 1, v * 5.3 + 2);
      const wetLand = field(moist, ju, jv), wood = field(shade, ju, jv);
      // Grass: two greens in broad patches, dry tufts here and there, a fine grain over it all.
      let r = 74 + broad * 34 + mid * 14, g = 122 + broad * 30 + mid * 20, b = 52 + broad * 14 + mid * 8;
      const dry = smooth(0.62, 0.8, fbm(u * 0.35 + 7, v * 0.35 + 90));
      r += dry * 34; g += dry * 14; b -= dry * 4;
      if (hash(x >> 1, (y >> 1) + 999) > 0.93) { r -= 16; g -= 14; b -= 10; } // blades in shadow
      // The grass of the country: sun-bleached on the steppe, thin and grey-green in the cold, sparse scrub in the desert.
      if (climate === 'steppe') { r += 46 + dry * 10; g += 26; b += 2; }
      else if (climate === 'snow') {
        // Frost-bitten: grey-green, with snow lying in it in patches.
        r += (150 + mid * 16 - r) * 0.5; g += (166 + mid * 14 - g) * 0.5; b += (146 + mid * 10 - b) * 0.5;
        const fr = smooth(0.42, 0.72, fbm(u * 1.7 + 3, v * 1.7 + 9)) * 0.75;
        r += (228 - r) * fr; g += (234 - g) * fr; b += (242 - b) * fr;
      } else if (climate === 'desert') {
        // Only the banks are green. Away from water it is dry scrub earth with a dark bush here and there.
        const lush = smooth(0.35, 0.85, wetLand + (mid - 0.5) * 0.35);
        r += 26; g += 6; b -= 6;
        r += (178 + broad * 18 + mid * 12 - r) * (1 - lush); g += (154 + broad * 14 + mid * 12 - g) * (1 - lush); b += (98 + broad * 8 + mid * 8 - b) * (1 - lush);
        if (hash(x >> 1, (y >> 1) + 411) > 0.9 + lush * 0.1) { r -= 34; g -= 22; b -= 26; }
      } else {
        // Lusher toward water; meadows of flowers in the open.
        r -= wetLand * 10; g += wetLand * 8;
        const meadow = smooth(0.55, 0.7, fbm(u * 0.22 + 40, v * 0.22 + 3)) * (1 - wood);
        if (meadow > 0 && hash(x, y + 31) > 1 - meadow * 0.03) { const c = MEADOW[Math.floor(hash(x >> 3, y >> 3) * MEADOW.length)]; r = c[0]; g = c[1]; b = c[2]; }
        else if (meadow > 0) { r += meadow * 6; g += meadow * 10; }
      }
      // Under trees: shade, moss and fallen leaves.
      r -= wood * 26; g -= wood * 22; b -= wood * 12;
      if (wood > 0.2 && hash(x >> 1, (y >> 1) + 77) > 0.82) { r += 30 * wood; g += 12 * wood; b -= 4; }
      // Hill grass is paler and drier the higher it grows.
      const up = smooth(0.3, 1.5, high) * (1 - smooth(0.3, 0.6, rock));
      r += up * 30; g += up * 16; b += up * 4;
      // Sand: pale, rippled by the wind, a shade redder in the desert.
      if (dune > 0) {
        const k = smooth(0.2, 0.8, dune + (mid - 0.5) * 0.45 + (fine - 0.5) * 0.3);
        const red = climate === 'desert' ? 10 : 0;
        // Wind ripples everywhere; in the desert, long dunes with a lit face and a shadowed one.
        const crest = climate === 'desert' ? Math.sin(u * 0.5 + v * 0.28 + broad * 7 + noise(u * 0.2, v * 0.2 + 9) * 5) : 0;
        const ripple = Math.sin((u * 0.9 + v * 2.6 + broad * 5) * 3.2) * 5 + crest * 13 + smooth(0.6, 1, crest) * 8;
        r += (188 + red + broad * 18 + ripple - r) * k; g += (156 + broad * 15 + ripple - g) * k; b += (98 - red + broad * 12 + ripple * 0.6 - b) * k; // kept well short of white: the sun is strong
      }
      // Marsh: dark wet green, with pools of standing water.
      if (bog > 0) {
        const k = smooth(0.3, 0.7, bog + (mid - 0.5) * 0.35), pool = smooth(0.56, 0.7, fbm(u * 1.4 + 11, v * 1.4 + 5));
        r += (74 + mid * 22 - r) * k; g += (108 + mid * 24 - g) * k; b += (58 + mid * 12 - b) * k;
        // Pools catch the sky, with a dark muddy rim.
        const rim = smooth(0.5, 0.58, fbm(u * 1.4 + 11, v * 1.4 + 5)) * (1 - pool);
        r -= rim * 22 * k; g -= rim * 22 * k; b -= rim * 10 * k;
        r += (70 - r) * pool * k; g += (112 - g) * pool * k; b += (128 - b) * pool * k;
      }
      // Lying snow, blue in the hollows, with grass showing through at its edges.
      if (white > 0) {
        const k = smooth(0.2, 0.8, white + (mid - 0.5) * 0.5 + (fine - 0.5) * 0.3);
        // Drifts: bright on the windward side, blue in the lee, and a glitter of ice.
        const drift = Math.sin(u * 0.7 + v * 0.33 + broad * 6 + noise(u * 0.25 + 4, v * 0.25) * 4);
        const sr = 226 + broad * 12 + drift * 9, sg = 233 + broad * 10 + drift * 7, sb = 245 + broad * 4 + drift * 2;
        r += (sr - r) * k; g += (sg - g) * k; b += (sb - b) * k;
        if (hash(x, y + 5) > 0.992) { r += 14 * k; g += 12 * k; b += 8 * k; }
      }
      // Bare earth, trodden paler in the middle.
      const earth = smooth(0.3, 0.7, dirt + (mid - 0.5) * 0.35);
      const stone = hash(x >> 1, (y >> 1) + 222) > 0.95 ? 18 : 0;
      const [er, eg, eb] = climate === 'desert' ? [172, 142, 98] : climate === 'snow' ? [132, 118, 96] : [150, 128, 84];
      r += (er + mid * 26 + stone - r) * earth; g += (eg + mid * 22 + stone - g) * earth; b += (eb + mid * 14 + stone - b) * earth;
      // Mountain rock in bands, scree at its foot, snow on the heights.
      const crag = smooth(0.35, 0.6, rock + (mid - 0.5) * 0.3);
      const band = noise(u * 0.5 + v * 1.3, high * 3.1) * 0.6 + grain * 0.4;
      r += (112 + band * 46 - r) * crag; g += (106 + band * 42 - g) * crag; b += (100 + band * 40 - b) * crag;
      const snow = smooth(3.7, 4.5, high + (mid - 0.5) * 1.4) * crag;
      r += (238 - r) * snow; g += (242 - g) * snow; b += (248 - b) * snow;
      // Sand along the shore, wet and darker at the waterline.
      const sand = smooth(0.14, 0.4, water);
      const wet = smooth(0.4, 0.55, water);
      // A shingle strand in the north, mud on the steppe, sand elsewhere.
      const [br, bg, bb] = climate === 'snow' ? [150, 154, 160] : climate === 'steppe' ? [164, 146, 104] : [192, 166, 112];
      const pebble = climate === 'snow' && hash(x >> 1, (y >> 1) + 9) > 0.7 ? (hash(x >> 1, y >> 1) - 0.5) * 50 : 0;
      r += (br + mid * 14 + pebble - r) * sand; g += (bg + mid * 12 + pebble - g) * sand; b += (bb + mid * 10 + pebble - b) * sand;
      r -= wet * 46; g -= wet * 34; b -= wet * 18;
      // The lake bed: sand going down into green-blue dark.
      const deep = smooth(0.5, 1, water);
      r += (30 - r) * deep * 0.92; g += (72 - g) * deep * 0.9; b += (96 - b) * deep * 0.85;
      const k = 0.94 + grain * 0.12;
      const i = (y * c.width + x) * 4;
      img.data[i] = r * k; img.data[i + 1] = g * k; img.data[i + 2] = b * k; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // The ground is flat where anyone can walk and drops away under open water, leaving a bank at the shore.
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  // Two steps to the tile, so the bank can follow the curve of the shore.
  const M = N * 2, MW = M + 1;
  for (let y = 0; y <= M; y++) {
    for (let x = 0; x <= M; x++) {
      pos.push(x / 2, groundH(x / 2, y / 2), y / 2);
      uv.push(x / M, 1 - y / M);
    }
  }
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) { const a = y * MW + x; idx.push(a, a + MW, a + 1, a + 1, a + MW, a + MW + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, flatShading: true }));
  ground.receiveShadow = true;
  ground.castShadow = true; // hills and peaks throw shadows of their own
  group.add(ground);

  // ---- water ----
  let hasWater = false;
  for (let i = 0; i < N * N; i++) if (T[i] === T_WATER) hasWater = true;
  // How far each stretch of water is from the nearest land, out to FAR tiles, so it can deepen gradually and
  // send its waves in toward the shore. Found by spreading outward from the land a ring at a time.
  const FAR = 7, far = new Float32Array(N * N).fill(FAR);
  let ring: number[] = [];
  for (let i = 0; i < N * N; i++) if (T[i] !== T_WATER) { far[i] = 0; ring.push(i); }
  for (let d = 1; d <= FAR && ring.length; d++) {
    const next: number[] = [];
    for (const i of ring) {
      const x = i % N, y = (i / N) | 0;
      for (const [dx, dy, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [-1, 1, 1.41], [1, -1, 1.41], [-1, -1, 1.41]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx, nd = far[i] + w;
        if (nd < far[j]) { far[j] = nd; next.push(j); }
      }
    }
    ring = next;
  }
  // What the water is told about where it is, at the fine grain: how dry (red) and how far out (green).
  const farAt = (x: number, y: number): number => {
    const u = Math.min(N - 1.001, Math.max(0, x - 0.5)), v = Math.min(N - 1.001, Math.max(0, y - 0.5)), xi = Math.floor(u), yi = Math.floor(v), tx = u - xi, ty = v - yi, i = yi * N + xi;
    return (far[i] * (1 - tx) + far[i + 1] * tx) * (1 - ty) + (far[i + N] * (1 - tx) + far[i + N + 1] * tx) * ty;
  };
  const land = new Uint8Array(F * F * 4);
  for (let j = 0; j < F; j++) for (let i = 0; i < F; i++) {
    const k = (j * F + i) * 4, w = wet[j * F + i];
    land[k] = Math.round((1 - w) * 255);
    // Distance out, eased in from the smooth shore so it starts at nothing exactly where the water does.
    land[k + 1] = Math.round(Math.min(1, (farAt(i / FINE, j / FINE) / FAR) * smooth(0.45, 0.9, w) + Math.max(0, w - 0.5) * 0.12) * 255);
    land[k + 3] = 255;
  }
  const landTex = new THREE.DataTexture(land, F, F, THREE.RGBAFormat);
  landTex.magFilter = landTex.minFilter = THREE.LinearFilter;
  landTex.needsUpdate = true;
  // Water: a moving surface with its own small waves, that mirrors the sky at a low angle and lets the bed show
  // through looking down, catches the sun in glitter, breaks white along the shore, and goes dark at night.
  // The colour of water differs with the country: clear and bright under a desert sun, green over a temperate
  // shelf, grey-green and cold in the north, a little muddy on the steppe.
  const tone = ({ desert: [[0.26, 0.70, 0.66], [0.04, 0.27, 0.45], 1], snow: [[0.33, 0.50, 0.50], [0.05, 0.17, 0.25], 0.35], steppe: [[0.34, 0.56, 0.50], [0.07, 0.23, 0.33], 0.6] } as Record<string, [number[], number[], number]>)[climate] ?? [[0.24, 0.66, 0.63], [0.05, 0.25, 0.40], 0.85];
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, land: { value: landTex }, size: { value: N }, fine: { value: new THREE.Vector2(FINE, F) }, shallowC: { value: new THREE.Vector3(...tone[0]) }, deepC: { value: new THREE.Vector3(...tone[1]) }, clear: { value: tone[2] }, sunDir: { value: new THREE.Vector3(-38, 44, 20).normalize() }, day: { value: 1 }, grey: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float time; uniform sampler2D land; uniform float size; uniform vec2 fine; uniform vec3 shallowC; uniform vec3 deepC; uniform float clear; uniform vec3 sunDir; uniform float day; uniform float grey;
      varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.0, 9.0); a *= 0.5; } return s; }
      // The height of the surface: two long swells crossing, and wind chop on top of them.
      float height(vec2 p) {
        float h = sin(dot(p, vec2(0.8, 0.6)) * 0.9 + time * 0.9) * 0.45 + sin(dot(p, vec2(-0.5, 0.86)) * 1.4 - time * 1.1) * 0.28;
        h += fbm(p * 1.6 + vec2(time * 0.25, -time * 0.18)) * 0.9 + fbm(p * 4.3 - vec2(time * 0.4, time * 0.3)) * 0.34;
        return h;
      }
      void main() {
        vec2 P = vW.xz;
        vec2 wob = vec2(noise(P * 0.9 + time * 0.2), noise(P * 0.9 + 7.0 - time * 0.2)) * 0.3 - 0.15;
        vec4 where = texture2D(land, ((P + wob * 0.6) * fine.x + 0.5) / fine.y);
        float l = where.r;
        if (l > 0.4) discard; // it thins to nothing just short of where the surface would cut the bank, so the edge is its own soft line
        // Tiles from the shore (out to seven), and from that how deep it is: shelving gently, then dropping away.
        float out7 = where.g * 7.0 + (0.5 - l) * 0.8;
        float depth = smoothstep(0.2, 4.6, out7);
        // Which way the surface faces here, from the slope of the waves; calmer in the shallows.
        float e = 0.12, h0 = height(P);
        vec3 n = normalize(vec3(h0 - height(P + vec2(e, 0.0)), e * 1.7, h0 - height(P + vec2(0.0, e))));
        n = normalize(mix(vec3(0.0, 1.0, 0.0), n, 0.3 + 0.7 * depth));
        vec3 V = normalize(cameraPosition - vW);
        // Looked at steeply, water shows what is in it; at a glancing angle it shows the sky.
        float fres = 0.07 + 0.93 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 body = mix(shallowC, deepC, smoothstep(0.0, 1.0, depth));
        // Lit by the sun on the faces turned to it, lighter on the crests, and patched with slow drifts of colour.
        body *= 0.72 + 0.5 * max(dot(n, sunDir), 0.0);
        body += (h0 - 1.0) * 0.05;
        body += (fbm(P * 0.22 + vec2(time * 0.02, 0.0)) - 0.5) * vec3(0.03, 0.07, 0.06);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(vec3(0.66, 0.77, 0.88), vec3(0.30, 0.50, 0.80), clamp(R.y, 0.0, 1.0));
        // Clouds drifting overhead show in it as slow pale patches.
        float cloud = smoothstep(0.52, 0.78, fbm(P * 0.11 + R.xz * 1.8 + vec2(time * 0.012, time * 0.008)));
        sky = mix(sky, vec3(0.93, 0.95, 0.97), cloud * 0.55);
        sky = mix(sky, vec3(0.50, 0.54, 0.58), grey);
        vec3 col = mix(body, sky, fres * 0.8);
        // The sun on the water: a hard glitter on the facets turned to it, and a soft sheen round that.
        vec3 H = normalize(sunDir + V);
        float nh = max(dot(n, H), 0.0);
        float sparkle = smoothstep(0.45, 0.8, noise(P * 11.0 + vec2(time * 1.7, -time * 1.3))); // broken into points, not sheets
        col += vec3(1.0, 0.95, 0.82) * (pow(nh, 420.0) * 2.2 * sparkle + pow(nh, 30.0) * 0.07) * (1.0 - grey * 0.8);
        // Light dancing on the bed in the shallows.
        float ca = pow(abs(sin(fbm(P * 2.6 + vec2(time * 0.3, time * 0.22)) * 9.4)), 8.0);
        col += vec3(0.9, 1.0, 0.9) * ca * 0.2 * clear * (1.0 - depth) * (1.0 - grey);
        // Rain on the surface: rings spreading from where each drop lands.
        if (grey > 0.05) {
          vec2 cell = floor(P * 2.2), in2 = fract(P * 2.2) - 0.5;
          float born = hash(cell), age = fract(time * 0.9 + born * 7.0);
          vec2 at = (vec2(hash(cell + 3.1), hash(cell + 9.7)) - 0.5) * 0.5;
          float ringD = abs(length(in2 - at) - age * 0.42);
          col += smoothstep(0.035, 0.0, ringD) * (1.0 - age) * 0.35 * grey;
        }
        // Foam: a broken white edge where it meets the land, lines of it running in to the shore, and a few caps far out.
        float edge = smoothstep(0.1, 0.33, l + (noise(P * 3.0 + time * 0.3) - 0.5) * 0.24 + sin(time * 0.9 + P.x * 0.6 + P.y * 0.8) * 0.05); // the wash runs up the sand and draws back
        // Wave after wave coming in: each a thin white line that sharpens and brightens as it nears the beach.
        float coming = sin(out7 * 4.2 + time * 1.5 + noise(P * 0.7) * 4.0);
        float lines = smoothstep(0.7, 1.0, coming) * (1.0 - smoothstep(0.4, 3.4, out7)) * (0.5 + 0.5 * noise(P * 2.3 - time * 0.2));
        float foam = clamp(edge * 1.0 + lines * 0.9, 0.0, 1.0) * (0.55 + 0.45 * noise(P * 7.0 + time * 0.5));
        foam = max(foam, smoothstep(1.7, 2.0, h0) * 0.22 * depth);
        col = mix(col, vec3(0.95, 0.98, 1.0), foam);
        col *= mix(0.2, 1.0, day);
        col += vec3(0.55, 0.65, 0.9) * pow(nh, 90.0) * 0.5 * (1.0 - day) * sparkle; // moonlight on it at night
        // Clear enough in the shallows to see the sand; nearly opaque where it is deep or seen at a glancing angle.
        // The bed shows through the shallows, but veiled: its own flat facets should not read through the surface.
        float a = max(max(mix(0.55, 0.96, smoothstep(0.0, 0.5, depth)), foam), fres * 0.9) * (1.0 - smoothstep(0.27, 0.385, l + (noise(P * 2.1 - time * 0.15) - 0.5) * 0.05));
        gl_FragColor = vec4(col, a);
      }`,
  });
  if (hasWater) {
    const wg = new THREE.PlaneGeometry(N + 80, N + 80);
    wg.rotateX(-Math.PI / 2);
    wg.translate(N / 2, -0.08, N / 2);
    const water = new THREE.Mesh(wg, waterMat);
    water.renderOrder = 1;
    group.add(water);
  }

  // ---- small things growing and lying about ----
  const tufts: THREE.Matrix4[] = [], tuftCol: THREE.Color[] = [], stones: THREE.Matrix4[] = [], blooms: THREE.Matrix4[] = [], bloomCol: THREE.Color[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const PETALS = [0xf4e9b0, 0xf0c8d8, 0xd8d0ff, 0xffd060, 0xffffff];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (T[y * N + x] === T_WATER || T[y * N + x] === T_ROCK) continue;
      const shore = tAt(x - 1, y) === T_WATER || tAt(x + 1, y) === T_WATER || tAt(x, y - 1) === T_WATER || tAt(x, y + 1) === T_WATER;
      const kind = T[y * N + x];
      const grass = kind !== T_DIRT && kind !== T_SAND && kind !== T_SNOW && !shore;
      for (let k = 0; k < 3; k++) {
        const h = hash(x * 7 + k, y * 13 + k * 5), h2 = hash(x * 3 + k * 11, y * 5 + 77), h3 = hash(x + k * 31, y * 9 + 5);
        const px2 = x + h2, py2 = y + h3;
        q.setFromAxisAngle(up, h * 6.28);
        if (grass && h < 0.22) {
          const s = 0.55 + h2 * 0.6;
          tufts.push(m.compose(new THREE.Vector3(px2, heightAt(px2, py2), py2), q, new THREE.Vector3(s, s * (0.8 + h3 * 0.7), s)).clone());
          tuftCol.push(new THREE.Color().setHSL(climate === 'steppe' ? 0.14 + h3 * 0.05 : kind === T_MARSH ? 0.2 + h3 * 0.05 : 0.25 + h3 * 0.07, 0.55 + h2 * 0.15, 0.13 + h * 0.3 + (climate === 'steppe' ? 0.12 : 0)));
        } else if ((kind === T_SNOW || kind === T_SAND) && !shore && h < 0.05) {
          // Dead stalks standing out of the snow; dry grass on the sand.
          const s = 0.5 + h2 * 0.5;
          tufts.push(m.compose(new THREE.Vector3(px2, heightAt(px2, py2), py2), q, new THREE.Vector3(s, s * (0.9 + h3 * 0.8), s)).clone());
          tuftCol.push(new THREE.Color().setHSL(0.11 + h3 * 0.03, 0.4, kind === T_SNOW ? 0.34 + h * 2 : 0.3 + h * 2));
        } else if (grass && climate !== 'snow' && h > 0.975) {
          blooms.push(m.compose(new THREE.Vector3(px2, heightAt(px2, py2) + 0.07, py2), q, new THREE.Vector3(1, 1, 1)).clone());
          bloomCol.push(new THREE.Color(PETALS[Math.floor(h2 * PETALS.length)]));
        } else if (h > 0.955 && h <= 0.975 && k === 0) {
          const s = 0.5 + h2 * 0.9;
          stones.push(m.compose(new THREE.Vector3(px2, heightAt(px2, py2) + 0.02, py2), q, new THREE.Vector3(s, s * 0.6, s)).clone());
        }
      }
    }
  }
  /** Things big enough to poke through a floor: each is taken away when something is built over it. */
  const standing: { im: THREE.InstancedMesh; i: number; x: number; y: number }[] = [];
  const scatter = (g: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], cols?: THREE.Color[], big = false): void => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((mm, i) => { im.setMatrixAt(i, mm); if (cols) im.setColorAt(i, cols[i]); if (big) standing.push({ im, i, x: mm.elements[12], y: mm.elements[14] }); });
    im.receiveShadow = true;
    im.castShadow = big;
    group.add(im);
  };
  // Grass and reeds lean with the wind.
  const wind = { value: 0 };
  const swaying = <M extends THREE.Material>(mt: M, reach: number): M => {
    mt.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = wind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7;
          float gust = sin(uWind * 1.7 + ph) * 0.6 + sin(uWind * 0.55 + ph * 0.31) * 0.8 + 0.5;
          transformed.x += gust * position.y * ${reach.toFixed(2)};
          transformed.z += gust * position.y * ${(reach * 0.4).toFixed(2)};
        #endif`);
    };
    return mt;
  };
  // A tuft is three blades leaning apart.
  const blade = new THREE.ConeGeometry(0.035, 0.2, 3);
  blade.translate(0, 0.1, 0);
  const tuft = new THREE.BufferGeometry();
  const bp: number[] = [], bn: number[] = [];
  for (const [ox, oz, lean, tall] of [[0, 0, 0, 1.25], [0.06, 0.03, 0.4, 1], [-0.05, 0.05, -0.45, 0.9], [0.02, -0.06, 0.25, 0.7], [-0.03, -0.04, -0.3, 1.1]]) {
    const b2 = blade.clone().toNonIndexed();
    b2.scale(1, tall, 1); b2.rotateY(ox * 40);
    b2.rotateZ(lean); b2.translate(ox, 0, oz);
    bp.push(...(b2.getAttribute('position').array as Float32Array));
    bn.push(...(b2.getAttribute('normal').array as Float32Array).map((_, i) => (i % 3 === 1 ? 1 : 0))); // lit from above, like the ground
  }
  tuft.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  tuft.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3));
  scatter(tuft, swaying(new THREE.MeshLambertMaterial({ color: 0xffffff }), 0.3), tufts, tuftCol);
  scatter(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshLambertMaterial({ color: 0x9a968c, flatShading: true }), stones);
  scatter(new THREE.OctahedronGeometry(0.045, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), blooms, bloomCol);

  // ---- what grows and lies in each country ----
  {
    const bushes: THREE.Matrix4[] = [], bushCol: THREE.Color[] = [], boulders: THREE.Matrix4[] = [], boulderCol: THREE.Color[] = [], reeds: THREE.Matrix4[] = [], reedCol: THREE.Color[] = [];
    const cacti: THREE.Matrix4[] = [], logs: THREE.Matrix4[] = [], pads: THREE.Matrix4[] = [], caps: THREE.Matrix4[] = [];
    const v3 = new THREE.Vector3(), sc = new THREE.Vector3(), tilt = new THREE.Quaternion(), ax = new THREE.Vector3();
    const put = (list: THREE.Matrix4[], x: number, y: number, lift: number, turn: number, sx: number, sy: number, sz: number): void => {
      q.setFromAxisAngle(up, turn);
      list.push(new THREE.Matrix4().compose(v3.set(x, heightAt(x, y) + lift, y), q, sc.set(sx, sy, sz)));
    };
    const rockC = climate === 'desert' ? 0xb89468 : climate === 'snow' ? 0xa8aeb8 : climate === 'steppe' ? 0x9c917c : 0x8f8f88;
    for (let y = 1; y < N - 1; y++) {
      for (let x = 1; x < N - 1; x++) {
        const kind = T[y * N + x];
        if (kind === T_ROCK || kind === T_DIRT) continue;
        const h = hash(x * 17 + 3, y * 29 + 11), h2 = hash(x * 5 + 91, y * 3 + 7), h3 = hash(x * 13 + 5, y * 7 + 41), h4 = hash(x * 3 + 17, y * 11 + 2);
        const px2 = x + 0.15 + h2 * 0.7, py2 = y + 0.15 + h3 * 0.7;
        const shore = kind !== T_WATER && (tAt(x - 1, y) === T_WATER || tAt(x + 1, y) === T_WATER || tAt(x, y - 1) === T_WATER || tAt(x, y + 1) === T_WATER);
        if (kind === T_WATER) {
          // Lily pads in the still shallows of green country.
          const w = wetAt(px2, py2);
          if (climate !== 'snow' && climate !== 'desert' && w > 0.62 && w < 0.86 && h < 0.3) for (let k = 0; k < 3; k++) {
            const a = hash(x + k * 7, y + k * 3) * 6.28, d = 0.1 + k * 0.16, s2 = 0.7 + hash(x * 3 + k, y) * 0.7;
            q.setFromAxisAngle(up, a * 3);
            pads.push(new THREE.Matrix4().compose(v3.set(px2 + Math.cos(a) * d, -0.06, py2 + Math.sin(a) * d), q, sc.set(s2, 1, s2)));
          }
          continue;
        }
        // Reeds: thick in the marsh, a fringe along green and steppe shores.
        if (kind === T_MARSH || (shore && climate !== 'snow' && climate !== 'desert' && h < 0.45) || (shore && climate === 'desert' && h < 0.2)) {
          for (let k = 0; k < (kind === T_MARSH ? 2 : 1); k++) {
            const rx = x + hash(x * 7 + k * 3, y * 5) * 0.9, ry = y + hash(x * 3, y * 9 + k * 5) * 0.9, s2 = 0.7 + hash(x + k, y * 3) * 0.7;
            put(reeds, rx, ry, 0, h * 6.28 + k, s2, s2 * (0.8 + h4 * 0.6), s2);
            reedCol.push(new THREE.Color().setHSL(0.19 + h4 * 0.06, 0.42, 0.3 + h2 * 0.14));
          }
          continue;
        }
        if (shore) continue;
        if (h4 > 0.985) {
          // A boulder, half sunk.
          const s2 = 0.6 + h2 * 1.1;
          ax.set(h - 0.5, 0.2, h3 - 0.5).normalize(); tilt.setFromAxisAngle(ax, h * 2);
          boulders.push(new THREE.Matrix4().compose(v3.set(px2, heightAt(px2, py2) + 0.04 * s2, py2), tilt, sc.set(s2, s2 * (0.55 + h3 * 0.4), s2 * (0.8 + h * 0.5))));
          boulderCol.push(new THREE.Color(rockC).multiplyScalar(0.85 + h * 0.3));
        } else if (kind === T_SAND && climate === 'desert') {
          if (h > 0.975) put(cacti, px2, py2, 0, h2 * 6.28, 0.7 + h3 * 0.7, 0.7 + h2 * 0.8, 0.7 + h3 * 0.7);
          else if (h < 0.035) { put(bushes, px2, py2, 0.05, h2 * 6.28, 0.7 + h3 * 0.5, 0.5 + h2 * 0.3, 0.7 + h3 * 0.5); bushCol.push(new THREE.Color().setHSL(0.11 + h3 * 0.05, 0.4, 0.16 + h2 * 0.08)); }
        } else if (kind === T_SNOW || kind === T_SAND) {
          if (h < 0.012 && kind === T_SNOW) { put(bushes, px2, py2, 0.04, h2 * 6.28, 0.7, 0.45, 0.7); bushCol.push(new THREE.Color(0xe6ecf4)); } // a bush under snow
        } else {
          // Grass: bushes, and in green country the odd fallen log and ring of mushrooms.
          if (h < (climate === 'steppe' ? 0.03 : 0.045)) {
            const s2 = 1 + h3 * 1.1;
            put(bushes, px2, py2, 0.06 * s2, h2 * 6.28, s2, s2 * (0.6 + h2 * 0.35), s2 * (0.8 + h * 4));
            bushCol.push(climate === 'desert' ? new THREE.Color().setHSL(0.17 + h3 * 0.05, 0.4, 0.17 + h2 * 0.07) : climate === 'steppe' ? new THREE.Color().setHSL(0.13 + h3 * 0.05, 0.45, 0.2 + h2 * 0.08) : climate === 'snow' ? new THREE.Color().setHSL(0.3, 0.3, 0.14 + h2 * 0.06) : new THREE.Color().setHSL(0.27 + h3 * 0.05, 0.62, 0.12 + h2 * 0.06));
          } else if (!climate || climate === 'temperate') {
            if (h > 0.992) { q.setFromAxisAngle(up, h2 * 6.28); logs.push(new THREE.Matrix4().compose(v3.set(px2, heightAt(px2, py2) + 0.06, py2), q, sc.set(1, 1, 0.8 + h3 * 0.8))); }
            else if (h > 0.98 && field(shade, x + 0.5, y + 0.5) > 0.1) for (let k = 0; k < 4; k++) put(caps, px2 + Math.cos(k * 1.7 + h * 6) * 0.14, py2 + Math.sin(k * 1.7 + h * 6) * 0.14, 0, 0, 0.7 + k * 0.15, 0.7 + k * 0.15, 0.7 + k * 0.15);
          }
        }
      }
    }
    const lamb = (color: number, flat = true) => new THREE.MeshLambertMaterial({ color, flatShading: flat });
    const jag = (g: THREE.BufferGeometry, amt: number, seed: number): THREE.BufferGeometry => {
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) { const k = 1 + (hash(Math.round(p.getX(i) * 50) + seed, Math.round(p.getY(i) * 50 + p.getZ(i) * 91)) - 0.5) * amt; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
      g.computeVertexNormals();
      return g;
    };
    const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
      const pp: number[] = [], nn: number[] = [];
      for (const part of parts) { const g2 = part.toNonIndexed(); g2.computeVertexNormals(); pp.push(...(g2.getAttribute('position').array as Float32Array)); nn.push(...(g2.getAttribute('normal').array as Float32Array)); }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
      return out;
    };
    scatter(bush(3), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, vertexColors: true }), bushes, bushCol, true);
    scatter(jag(new THREE.IcosahedronGeometry(0.24, 1), 0.4, 9), lamb(0xffffff), boulders, boulderCol, true);
    // A clump of reeds: five stems leaning apart, two with a dark head.
    const stems: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const hgt = 0.34 + (k % 3) * 0.09, st = new THREE.ConeGeometry(0.014, hgt, 3);
      st.translate(0, hgt / 2, 0); st.rotateZ((k - 2) * 0.13); st.rotateY(k * 1.9); st.translate(Math.cos(k * 2.4) * 0.06, 0, Math.sin(k * 2.4) * 0.06);
      stems.push(st);
      if (k % 2 === 0) { const hd = new THREE.CylinderGeometry(0.022, 0.022, 0.09, 5); hd.translate(0, hgt - 0.02, 0); hd.rotateZ((k - 2) * 0.13); hd.rotateY(k * 1.9); hd.translate(Math.cos(k * 2.4) * 0.06, 0, Math.sin(k * 2.4) * 0.06); stems.push(hd); }
    }
    scatter(merge(stems), swaying(lamb(0xffffff, false), 0.22), reeds, reedCol, true);
    // A cactus: a trunk and two arms that turn up.
    const arm = (side: number, at: number, len: number): THREE.BufferGeometry[] => {
      const out2 = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6); out2.rotateZ(Math.PI / 2); out2.translate(side * 0.09, at, 0);
      const rise = new THREE.CylinderGeometry(0.032, 0.036, len, 6); rise.translate(side * 0.15, at + len / 2, 0);
      return [out2, rise];
    };
    scatter(merge([new THREE.CylinderGeometry(0.05, 0.058, 0.5, 7).translate(0, 0.25, 0), new THREE.SphereGeometry(0.05, 7, 4).translate(0, 0.5, 0), ...arm(1, 0.2, 0.2), ...arm(-1, 0.28, 0.14)]), lamb(0x5f8a4a), cacti, undefined, true);
    scatter(merge([new THREE.CylinderGeometry(0.07, 0.08, 0.6, 7).rotateX(Math.PI / 2), new THREE.CylinderGeometry(0.025, 0.03, 0.14, 5).translate(0.03, 0.1, 0.1)]), lamb(0x6a4c30), logs, undefined, true);
    scatter(merge([new THREE.CylinderGeometry(0.012, 0.016, 0.06, 5).translate(0, 0.03, 0), new THREE.SphereGeometry(0.035, 7, 4, 0, 6.3, 0, 1.6).translate(0, 0.055, 0)]), lamb(0xc8553a, false), caps);
    // A lily pad is a disc with a bite out of it.
    const pad = new THREE.CircleGeometry(0.09, 9, 0.4, 5.6); pad.rotateX(-Math.PI / 2);
    scatter(pad, new THREE.MeshLambertMaterial({ color: 0x4f8a3c, side: THREE.DoubleSide }), pads);
  }

  // ---- cloud shadows ----
  const cc = document.createElement('canvas');
  cc.width = cc.height = 256;
  const cx2 = cc.getContext('2d')!;
  const ci = cx2.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      // Tileable: blend the noise with itself shifted by a period.
      const f = (a: number, b: number) => fbm(a / 42, b / 42);
      const wx = x / 256, wy = y / 256;
      const v = (f(x, y) * (1 - wx) + f(x - 256, y) * wx) * (1 - wy) + (f(x, y - 256) * (1 - wx) + f(x - 256, y - 256) * wx) * wy;
      const i = (y * 256 + x) * 4;
      ci.data[i] = ci.data[i + 1] = ci.data[i + 2] = 0;
      ci.data[i + 3] = smooth(0.5, 0.72, v) * 255;
    }
  }
  cx2.putImageData(ci, 0, 0);
  const cloudTex = new THREE.CanvasTexture(cc);
  cloudTex.wrapS = cloudTex.wrapT = THREE.RepeatWrapping;
  cloudTex.repeat.set(N / 60, N / 60);
  const cg = new THREE.PlaneGeometry(N, N);
  cg.rotateX(-Math.PI / 2);
  cg.translate(N / 2, 0.03, N / 2);
  const clouds = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.2, depthWrite: false, depthTest: false, fog: false }));
  clouds.renderOrder = 2;
  group.add(clouds);

  return {
    group,
    heightAt,
    swellAt(x: number, y: number, clock: number): number {
      return Math.sin((x * 0.8 + y * 0.6) * 0.9 + clock * 0.9) * 0.45 + Math.sin((x * -0.5 + y * 0.86) * 1.4 - clock * 1.1) * 0.28;
    },
    update(clock: number, day = 1, grey = 0): void {
      waterMat.uniforms.time.value = clock;
      waterMat.uniforms.day.value = day;
      waterMat.uniforms.grey.value = grey;
      cloudTex.offset.set(clock * 0.004, clock * 0.0025);
      wind.value = clock;
    },
    clearAt(x: number, y: number, r: number): void {
      const none = new THREE.Matrix4().makeScale(0, 0, 0);
      for (const s of standing) if (Math.abs(s.x - x) < r && Math.abs(s.y - y) < r) { s.im.setMatrixAt(s.i, none); s.im.instanceMatrix.needsUpdate = true; s.x = -99; }
    },
  };
}
