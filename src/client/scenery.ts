// The land itself: painted ground with soft edges between grass, earth and sand, a lake bed that
// falls away under moving water, scattered grass, stones and flowers, and cloud shadows drifting over.

import * as THREE from 'three';
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
  /** Advance the water and the cloud shadows. `day` is 1 in daylight down to 0 at night; `grey` is how overcast it is, 0 to 1. */
  update(clock: number, day?: number, grey?: number): void;
}

export function buildScenery(N: number, T: Uint8Array, hills: Float32Array, climate: Climate = ''): Scenery {
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
      cornerH[y * W + x] = wet ? -0.55 : (n ? sum / n : 0) + (rock === 4 ? (hash(x * 5, y * 7) - 0.5) * 1.7 : rock >= 2 ? (hash(x * 5, y * 7) - 0.5) * 0.5 : 0);
    }
  }
  const groundH = (x: number, y: number): number => {
    const fx = Math.min(N - 0.001, Math.max(0, x)), fy = Math.min(N - 0.001, Math.max(0, y));
    const xi = Math.floor(fx), yi = Math.floor(fy), tx = fx - xi, ty = fy - yi, i = yi * W + xi;
    return (cornerH[i] * (1 - tx) + cornerH[i + 1] * tx) * (1 - ty) + (cornerH[i + W] * (1 - tx) + cornerH[i + W + 1] * tx) * ty;
  };
  const heightAt = (x: number, y: number): number => Math.max(0, groundH(x, y));
  // How much of a kind of ground there is at a point, blended between tile centres so edges are soft.
  const amount = (kind: number, u: number, v: number): number => {
    const x = u - 0.5, y = v - 0.5, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const k = (a: number, b: number) => (tAt(a, b) === kind ? 1 : 0);
    return (k(xi, yi) * (1 - fx) + k(xi + 1, yi) * fx) * (1 - fy) + (k(xi, yi + 1) * (1 - fx) + k(xi + 1, yi + 1) * fx) * fy;
  };

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
      const water = amount(T_WATER, ju, jv), dirt = amount(T_DIRT, ju, jv), rock = amount(T_ROCK, ju, jv), high = groundH(u, v);
      const dune = amount(T_SAND, ju, jv), bog = amount(T_MARSH, ju, jv), white = amount(T_SNOW, ju, jv);
      const broad = fbm(u * 0.16, v * 0.16), mid = fbm(u * 0.9 + 50, v * 0.9), grain = hash(x, y);
      // Grass: two greens in broad patches, dry tufts here and there, a fine grain over it all.
      let r = 74 + broad * 34 + mid * 14, g = 122 + broad * 30 + mid * 20, b = 52 + broad * 14 + mid * 8;
      const dry = smooth(0.62, 0.8, fbm(u * 0.35 + 7, v * 0.35 + 90));
      r += dry * 34; g += dry * 14; b -= dry * 4;
      if (hash(x >> 1, (y >> 1) + 999) > 0.93) { r -= 16; g -= 14; b -= 10; } // blades in shadow
      // The grass of the country: sun-bleached on the steppe, thin and grey-green in the cold, sparse scrub in the desert.
      if (climate === 'steppe') { r += 46 + dry * 10; g += 26; b += 2; }
      else if (climate === 'snow') { r -= 6; g -= 14; b += 8; }
      else if (climate === 'desert') { r += 26; g += 6; b -= 6; }
      // Hill grass is paler and drier the higher it grows.
      const up = smooth(0.3, 1.5, high) * (1 - smooth(0.3, 0.6, rock));
      r += up * 30; g += up * 16; b += up * 4;
      // Sand: pale, rippled by the wind, a shade redder in the desert.
      if (dune > 0) {
        const k = smooth(0.3, 0.7, dune + (mid - 0.5) * 0.35), ripple = Math.sin((u * 0.9 + v * 2.6 + broad * 5) * 3.2) * 6;
        const red = climate === 'desert' ? 10 : 0;
        r += (188 + red + broad * 18 + ripple - r) * k; g += (156 + broad * 15 + ripple - g) * k; b += (98 - red + broad * 12 + ripple * 0.6 - b) * k; // kept well short of white: the sun is strong
      }
      // Marsh: dark wet green, with pools of standing water.
      if (bog > 0) {
        const k = smooth(0.3, 0.7, bog + (mid - 0.5) * 0.35), pool = smooth(0.56, 0.7, fbm(u * 1.4 + 11, v * 1.4 + 5));
        r += (58 + mid * 18 - r) * k; g += (86 + mid * 22 - g) * k; b += (50 + mid * 12 - b) * k;
        r += (44 - r) * pool * k; g += (70 - g) * pool * k; b += (74 - b) * pool * k;
      }
      // Lying snow, blue in the hollows, with grass showing through at its edges.
      if (white > 0) {
        const k = smooth(0.3, 0.72, white + (mid - 0.5) * 0.45);
        r += (232 + broad * 14 - r) * k; g += (238 + broad * 12 - g) * k; b += (246 + broad * 6 - b) * k;
      }
      // Bare earth, trodden paler in the middle.
      const earth = smooth(0.3, 0.7, dirt + (mid - 0.5) * 0.35);
      r += (150 + mid * 26 - r) * earth; g += (128 + mid * 22 - g) * earth; b += (84 + mid * 14 - b) * earth;
      // Mountain rock in bands, scree at its foot, snow on the heights.
      const crag = smooth(0.35, 0.6, rock + (mid - 0.5) * 0.3);
      const band = noise(u * 0.5 + v * 1.3, high * 3.1) * 0.6 + grain * 0.4;
      r += (112 + band * 46 - r) * crag; g += (106 + band * 42 - g) * crag; b += (100 + band * 40 - b) * crag;
      const snow = smooth(3.7, 4.5, high + (mid - 0.5) * 1.4) * crag;
      r += (238 - r) * snow; g += (242 - g) * snow; b += (248 - b) * snow;
      // Sand along the shore, wet and darker at the waterline.
      const sand = smooth(0.14, 0.4, water);
      const wet = smooth(0.4, 0.55, water);
      r += (192 + mid * 14 - r) * sand; g += (166 + mid * 12 - g) * sand; b += (112 + mid * 10 - b) * sand;
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
  for (let y = 0; y <= N; y++) {
    for (let x = 0; x <= N; x++) {
      pos.push(x, cornerH[y * W + x], y);
      uv.push(x / N, 1 - y / N);
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = y * W + x; idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1); }
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
  const land = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { const l = T[i] === T_WATER ? 0 : 255; if (!l) hasWater = true; land[i * 4] = l; land[i * 4 + 3] = 255; }
  const landTex = new THREE.DataTexture(land, N, N, THREE.RGBAFormat);
  landTex.magFilter = landTex.minFilter = THREE.LinearFilter;
  landTex.needsUpdate = true;
  // Water: a moving surface with its own small waves, that mirrors the sky at a low angle and lets the bed show
  // through looking down, catches the sun in glitter, breaks white along the shore, and goes dark at night.
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, land: { value: landTex }, size: { value: N }, sunDir: { value: new THREE.Vector3(-38, 44, 20).normalize() }, day: { value: 1 }, grey: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float time; uniform sampler2D land; uniform float size; uniform vec3 sunDir; uniform float day; uniform float grey;
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
        float l = texture2D(land, (P + wob) / size).r;
        if (l > 0.62) discard;
        float depth = clamp(1.0 - l * 2.2, 0.0, 1.0);
        // Which way the surface faces here, from the slope of the waves; calmer in the shallows.
        float e = 0.12, h0 = height(P);
        vec3 n = normalize(vec3(h0 - height(P + vec2(e, 0.0)), e * 1.7, h0 - height(P + vec2(0.0, e))));
        n = normalize(mix(vec3(0.0, 1.0, 0.0), n, 0.3 + 0.7 * depth));
        vec3 V = normalize(cameraPosition - vW);
        // Looked at steeply, water shows what is in it; at a glancing angle it shows the sky.
        float fres = 0.07 + 0.93 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 body = mix(vec3(0.24, 0.66, 0.63), vec3(0.05, 0.25, 0.40), smoothstep(0.0, 1.0, depth));
        // Lit by the sun on the faces turned to it, lighter on the crests, and patched with slow drifts of colour.
        body *= 0.72 + 0.5 * max(dot(n, sunDir), 0.0);
        body += (h0 - 1.0) * 0.05;
        body += (fbm(P * 0.22 + vec2(time * 0.02, 0.0)) - 0.5) * vec3(0.03, 0.07, 0.06);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(vec3(0.66, 0.77, 0.88), vec3(0.30, 0.50, 0.80), clamp(R.y, 0.0, 1.0));
        sky = mix(sky, vec3(0.50, 0.54, 0.58), grey);
        vec3 col = mix(body, sky, fres * 0.8);
        // The sun on the water: a hard glitter on the facets turned to it, and a soft sheen round that.
        vec3 H = normalize(sunDir + V);
        float nh = max(dot(n, H), 0.0);
        float sparkle = smoothstep(0.45, 0.8, noise(P * 11.0 + vec2(time * 1.7, -time * 1.3))); // broken into points, not sheets
        col += vec3(1.0, 0.95, 0.82) * (pow(nh, 420.0) * 2.2 * sparkle + pow(nh, 30.0) * 0.07) * (1.0 - grey * 0.8);
        // Light dancing on the bed in the shallows.
        float ca = pow(abs(sin(fbm(P * 2.6 + vec2(time * 0.3, time * 0.22)) * 9.4)), 8.0);
        col += vec3(0.9, 1.0, 0.9) * ca * 0.12 * (1.0 - depth) * (1.0 - grey);
        // Foam: a broken white edge where it meets the land, lines of it running in to the shore, and a few caps far out.
        float edge = smoothstep(0.30, 0.54, l + (noise(P * 3.0 + time * 0.3) - 0.5) * 0.2);
        float lines = smoothstep(0.6, 1.0, sin(l * 15.0 - time * 1.3 + noise(P * 1.3) * 3.0)) * smoothstep(0.08, 0.34, l) * (1.0 - smoothstep(0.5, 0.6, l));
        float foam = clamp(edge * 1.0 + lines * 0.6, 0.0, 1.0) * (0.55 + 0.45 * noise(P * 7.0 + time * 0.5));
        foam = max(foam, smoothstep(1.7, 2.0, h0) * 0.22 * depth);
        col = mix(col, vec3(0.95, 0.98, 1.0), foam);
        col *= mix(0.2, 1.0, day);
        // Clear enough in the shallows to see the sand; nearly opaque where it is deep or seen at a glancing angle.
        float a = max(max(mix(0.38, 0.94, depth), foam), fres * 0.9) * (1.0 - smoothstep(0.54, 0.62, l));
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
        } else if (grass && h > 0.975) {
          blooms.push(m.compose(new THREE.Vector3(px2, heightAt(px2, py2) + 0.07, py2), q, new THREE.Vector3(1, 1, 1)).clone());
          bloomCol.push(new THREE.Color(PETALS[Math.floor(h2 * PETALS.length)]));
        } else if (h > 0.955 && h <= 0.975 && k === 0) {
          const s = 0.5 + h2 * 0.9;
          stones.push(m.compose(new THREE.Vector3(px2, heightAt(px2, py2) + 0.02, py2), q, new THREE.Vector3(s, s * 0.6, s)).clone());
        }
      }
    }
  }
  const scatter = (g: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], cols?: THREE.Color[]): void => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((mm, i) => { im.setMatrixAt(i, mm); if (cols) im.setColorAt(i, cols[i]); });
    im.receiveShadow = true;
    group.add(im);
  };
  // A tuft is three blades leaning apart.
  const blade = new THREE.ConeGeometry(0.035, 0.2, 3);
  blade.translate(0, 0.1, 0);
  const tuft = new THREE.BufferGeometry();
  const bp: number[] = [], bn: number[] = [];
  for (const [ox, oz, lean] of [[0, 0, 0], [0.06, 0.03, 0.4], [-0.05, 0.05, -0.45]]) {
    const b2 = blade.clone().toNonIndexed();
    b2.rotateZ(lean); b2.translate(ox, 0, oz);
    bp.push(...(b2.getAttribute('position').array as Float32Array));
    bn.push(...(b2.getAttribute('normal').array as Float32Array).map((_, i) => (i % 3 === 1 ? 1 : 0))); // lit from above, like the ground
  }
  tuft.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  tuft.setAttribute('normal', new THREE.Float32BufferAttribute(bn, 3));
  scatter(tuft, new THREE.MeshLambertMaterial({ color: 0xffffff }), tufts, tuftCol);
  scatter(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshLambertMaterial({ color: 0x9a968c, flatShading: true }), stones);
  scatter(new THREE.OctahedronGeometry(0.045, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), blooms, bloomCol);

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
    update(clock: number, day = 1, grey = 0): void {
      waterMat.uniforms.time.value = clock;
      waterMat.uniforms.day.value = day;
      waterMat.uniforms.grey.value = grey;
      cloudTex.offset.set(clock * 0.004, clock * 0.0025);
    },
  };
}
