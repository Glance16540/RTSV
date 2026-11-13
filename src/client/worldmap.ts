// The campaign map in three dimensions: a living country seen from above and to one side, in the manner of the
// great war-maps of strategy games. Every campaign grows its own world from its seed: its own coastline, bays and
// lakes, mountain ranges, rivers running down to the sea, and its own lie of cold, wet and dry country, so one
// world has snow in the north and desert in the south-east and the next the other way about. The ground is painted
// by what grows there; borders glow in the colour of whoever holds the land. Capitals are walled towns, armies are
// figures under a standard that march from land to land, and the map moves: the sea runs, cloud drifts and throws
// shadow, weather fronts pass with rain, snow or dust, birds wheel, ships go by, and smoke rises from the towns.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Campaign, EVENTS, LOCALS, MAP_H, MAP_W, ageOf, armyAt, armySize, climateAt, eventsAt, frontsOf, landNoise, slots } from '../sim/campaign';
import { lookOf } from './models';
import { RealPerson, loadPeople, makePerson, outfitFor, peopleReady, play } from './person';

/** Map points to a unit of the world. */
const K = 0.13;
/** How much larger the world is than the one the pieces were first sized for. */
const S = K / 0.1;
const WX = (px: number): number => px * K - (MAP_W * K) / 2;
const WZ = (py: number): number => py * K - (MAP_H * K) / 2;
const STEP = 3; // map points between heights

const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (o: number[], c: number[], k: number): void => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };
/** A shape in one colour, ready to be joined to others and still take a tint of its own. */
const tinted = (g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry => {
  const n = g.index ? g.toNonIndexed() : g, c = new THREE.Color(hex), a = new Float32Array(n.getAttribute('position').count * 3);
  for (let i = 0; i < a.length; i += 3) { a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  n.deleteAttribute('uv');
  return n;
};

export class WorldMap {
  readonly canvas: HTMLCanvasElement;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.5, 900);
  private ground: THREE.Mesh;
  private heights: Float32Array;
  private gw: number; private gh: number;
  /** The ground as it is painted before anyone holds it, and the sheet the borders are laid over it on. */
  private base: Uint8ClampedArray;
  private sheet: HTMLCanvasElement;
  private paintTex: THREE.CanvasTexture;
  private seaTex: THREE.CanvasTexture;
  /** Everything that is rebuilt when the campaign changes: towns, armies, names, marks. */
  private pieces = new THREE.Group();
  private people: RealPerson[] = [];
  private flags: THREE.Object3D[] = [];
  private rings: { m: THREE.Mesh; live: boolean }[] = [];
  private bobs: THREE.Object3D[] = [];
  private smokes: { m: THREE.Mesh; x: number; y: number; z: number; ph: number }[] = [];
  /** Armies on the march from where they stood to where they now stand. */
  private movers: { g: THREE.Group; fx: number; fz: number; tx: number; tz: number; t0: number; men: RealPerson[] }[] = [];
  private stood = new Map<number, { x: number; z: number }>();
  /** Names and numbers, which are drawn larger the farther back the eye stands, so they can still be read. */
  private labels: { s: THREE.Sprite; w: number; h: number }[] = [];
  private clouds: { g: THREE.Group; fall: THREE.Points; kind: string; r: number }[] = [];
  private cloudMats: THREE.Material[] = [];
  private puffs: { g: THREE.Group; v: number }[] = [];
  private flocks: { g: THREE.Group; cx: number; cz: number; r: number; v: number; ph: number }[] = [];
  private ships: { g: THREE.Group; ph: number; v: number }[] = [];
  private tx = 0; private tz = -2; private dist = 110;
  private cx = 0; private cz = -2; private cd = 0;
  private clock = new THREE.Clock();
  private fit = 110;
  private moved = false;
  private raf = 0;
  private c: Campaign;
  private last: { sel: number; reach: Set<number> } = { sel: -1, reach: new Set() };
  private textures: THREE.Texture[] = [];

  constructor(private host: HTMLElement, c: Campaign, private cell: Uint8Array, private edge: Float32Array, private onPick: (tid: number) => void) {
    this.c = c;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ow-gl';
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    // A sky that pales to haze at the world's edge, and the same haze over the far sea.
    const sky = document.createElement('canvas');
    sky.width = 4; sky.height = 256;
    const sx = sky.getContext('2d')!, grad = sx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3f6f9c'); grad.addColorStop(0.45, '#8fb2cc'); grad.addColorStop(0.62, '#c3d3dc'); grad.addColorStop(1, '#c3d3dc');
    sx.fillStyle = grad; sx.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(0xb4c6d2, 150 * S, 420 * S);
    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x6a5a48, 1.15));
    const sun = new THREE.DirectionalLight(0xffe8c8, 2.7);
    sun.position.set(-46 * S, 70 * S, 34 * S);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -64 * S; sc.right = 64 * S; sc.top = 46 * S; sc.bottom = -46 * S; sc.near = 5; sc.far = 240 * S;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06;
    this.scene.add(sun, sun.target);

    // ---- the lie of the land, grown from the campaign's seed ----
    const sd = c.seed % 100000, N = (x: number, y: number, k: number): number => landNoise(x, y, sd + k);
    const gw = (this.gw = Math.floor(MAP_W / STEP) + 1), gh = (this.gh = Math.floor(MAP_H / STEP) + 1);
    const H = (this.heights = new Float32Array(gw * gh));
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const px = Math.min(MAP_W - 1, i * STEP), py = Math.min(MAP_H - 1, j * STEP), ci = py * MAP_W + px;
      const t = c.territories[cell[ci]], dC = Math.hypot(px - t.x, py - t.y);
      // The coast: a ragged shore with deep bays, though every land keeps firm ground under its town.
      const rim = Math.min(px, py, MAP_W - 1 - px, MAP_H - 1 - py);
      const shore = smooth(4, 44, rim + (N(px / 150, py / 150, 2) - 0.5) * 130 + (N(px / 40, py / 40, 3) - 0.5) * 26 - 18 - (t.trait === 'coast' ? 14 : 0));
      const keep = (1 - smooth(34, 70, dC)) * smooth(2, 24, rim);
      // Lakes and inland seas lie between the lands, never on a town.
      const lake = smooth(0.7, 0.8, N(px / 110, py / 110, 5)) * smooth(50, 85, dC);
      const land = Math.max(shore, keep) * (1 - lake);
      const { warm, wet } = climateAt(c.seed, px, py);
      const hot = smooth(0.62, 0.72, warm) * (1 - smooth(0.5, 0.6, wet)), marsh = smooth(0.76, 0.84, wet) * smooth(0.4, 0.46, warm);
      let roll = 0.5 + N(px / 85, py / 85, 6) * 0.75 + N(px / 20, py / 20, 8) * 0.16;
      roll += hot * Math.abs(Math.sin((px + py * 0.6) / 13 + N(px / 50, py / 50, 12) * 5)) * 0.3; // dunes
      roll += (0.2 - roll) * marsh; // fen lies flat and low
      // Mountain ranges cross the world where the seed puts them, and stand on high ground and gold hills; clear of the towns.
      const range = Math.min(1.25, smooth(0.56, 0.72, N(px / 170, py / 170, 7)) + (t.trait === 'hills' ? 0.85 : t.trait === 'gold' ? 0.55 : 0) * smooth(4, 34, edge[ci]));
      let m = 0;
      if (range > 0) {
        const ridge = 1 - Math.abs(N(px / 38 + 7, py / 38 + 3, 9) * 2 - 1);
        m = range * smooth(30, 74, Math.hypot(px - t.x, py - (t.y + 6))) * (ridge * ridge * ridge * 5.6 + (1 - Math.abs(N(px / 15, py / 15, 13) * 2 - 1)) * ridge * 1.6 + N(px / 9, py / 9, 10) * 0.7);
      }
      H[j * gw + i] = land * (roll + m) - (1 - land) * 1.6;
    }

    // ---- rivers: from the high ground, by the lowest way, to the sea ----
    const parent = new Int32Array(gw * gh).fill(-1), level = new Float32Array(gw * gh), seen = new Uint8Array(gw * gh);
    const heap: number[] = [];
    const push = (n: number): void => { heap.push(n); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (level[heap[p]] <= level[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = (): number => {
      const top = heap[0], end = heap.pop()!;
      if (heap.length) { heap[0] = end; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let b = k; if (l < heap.length && level[heap[l]] < level[heap[b]]) b = l; if (r < heap.length && level[heap[r]] < level[heap[b]]) b = r; if (b === k) break; [heap[b], heap[k]] = [heap[k], heap[b]]; k = b; } }
      return top;
    };
    for (let n = 0; n < H.length; n++) if (H[n] <= 0) { seen[n] = 1; level[n] = 0; push(n); }
    while (heap.length) {
      const n = pop(), i = n % gw, j = (n - i) / gw;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= gw || b >= gh) continue;
        const q = b * gw + a;
        if (seen[q]) continue;
        seen[q] = 1; parent[q] = n; level[q] = Math.max(level[n], H[q]) + ((di && dj) ? 0.004 : 0); push(q);
      }
    }
    const rivers: number[][] = [], wetGrid = new Uint8Array(gw * gh);
    for (let k = 0; k < 60 && rivers.length < 7; k++) {
      const i = 4 + Math.floor(N(k * 3, 1, 60) * (gw - 8)), j = 4 + Math.floor(N(k * 3, 2, 61) * (gh - 8));
      let n = j * gw + i;
      if (H[n] < 1.7 || rivers.some((r) => Math.hypot((r[0] % gw) - i, Math.floor(r[0] / gw) - j) < 26)) continue;
      const path: number[] = [];
      while (n >= 0 && H[n] > 0 && path.length < 900 && !wetGrid[n]) { path.push(n); n = parent[n]; }
      if (n >= 0) path.push(n); // the mouth, or the river it runs into
      if (path.length < 14) continue;
      for (const q of path) { wetGrid[q] = 1; if (H[q] > 0.12) H[q] = Math.max(0.1, H[q] - 0.22); }
      rivers.push(path);
    }

    const geo = new THREE.PlaneGeometry(MAP_W * K, MAP_H * K, gw - 1, gh - 1).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    for (let n = 0; n < pos.count; n++) pos.setY(n, H[n]);
    geo.computeVertexNormals();

    // ---- the paint: what grows on each stretch of ground, the rock and snow of the heights, sand at the shore ----
    this.sheet = document.createElement('canvas');
    this.sheet.width = MAP_W; this.sheet.height = MAP_H;
    const ctx = this.sheet.getContext('2d')!, img = ctx.createImageData(MAP_W, MAP_H), D = img.data, col = [0, 0, 0];
    const GRASS = [112, 150, 72], FOREST = [74, 114, 60], MARSH = [84, 108, 84], STEPPE = [178, 166, 100], DESERT = [224, 198, 142], SNOW = [238, 242, 246], ROCK = [126, 118, 106], SAND = [216, 202, 152], POOL = [70, 118, 132];
    for (let py = 0; py < MAP_H; py++) for (let px = 0; px < MAP_W; px++) {
      const h = this.heightAt(px, py), o = (py * MAP_W + px) * 4;
      if (h <= 0) {
        const d = smooth(0, -1.5, h);
        col[0] = 96 - d * 66; col[1] = 150 - d * 82; col[2] = 158 - d * 66;
      } else {
        const { warm, wet } = climateAt(c.seed, px, py);
        const cold = 1 - smooth(0.27, 0.35, warm), hot = smooth(0.62, 0.72, warm) * (1 - smooth(0.5, 0.6, wet)), dry = 1 - smooth(0.4, 0.5, wet);
        const marsh = smooth(0.76, 0.84, wet) * smooth(0.4, 0.46, warm);
        col[0] = GRASS[0]; col[1] = GRASS[1]; col[2] = GRASS[2];
        mix3(col, FOREST, smooth(0.56, 0.68, wet) * 0.85);
        mix3(col, MARSH, marsh);
        if (marsh > 0.5 && N(px / 7, py / 7, 31) > 0.66) mix3(col, POOL, 0.8);
        mix3(col, STEPPE, dry);
        mix3(col, DESERT, hot);
        mix3(col, SNOW, cold);
        const hx = this.heightAt(px + 3, py) - this.heightAt(px - 3, py), hy = this.heightAt(px, py + 3) - this.heightAt(px, py - 3);
        const slope = Math.hypot(hx, hy);
        mix3(col, ROCK, Math.max(smooth(2.1, 3.2, h), smooth(0.55, 1.0, slope)) * smooth(0.5, 0.9, h));
        const line = 4.5 - cold * 3.2 - (1 - warm) * 0.8; // the snow lies lower in cold country
        mix3(col, SNOW, smooth(line, line + 0.8, h));
        mix3(col, SAND, (1 - smooth(0.08, 0.42, h)) * (1 - cold));
        if (h < 0.07) mix3(col, [236, 240, 236], 0.5); // surf
        // Light from the north-west picks out every slope.
        const k = (0.93 + N(px / 6, py / 6, 33) * 0.14) * Math.min(1.25, Math.max(0.62, 1 - (hx + hy) * 0.3));
        col[0] *= k; col[1] *= k; col[2] *= k;
      }
      D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // Rivers, widening as they run down.
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const path of rivers) {
      for (const [tone, extra] of [['rgba(40,70,60,0.35)', 2.4], ['#5c9cb8', 0]] as [string, number][]) {
        ctx.strokeStyle = tone;
        for (let k = 1; k < path.length - 1; k++) {
          const p = (q: number): [number, number] => [(path[q] % gw) * STEP, Math.floor(path[q] / gw) * STEP];
          const [ax, ay] = p(k - 1), [bx, by] = p(k), [cx2, cy2] = p(k + 1);
          ctx.lineWidth = 1.4 + (k / path.length) * 3.4 + extra;
          ctx.beginPath(); ctx.moveTo((ax + bx) / 2, (ay + by) / 2); ctx.quadraticCurveTo(bx, by, (bx + cx2) / 2, (by + cy2) / 2); ctx.stroke();
        }
      }
    }
    this.base = ctx.getImageData(0, 0, MAP_W, MAP_H).data;
    this.paintTex = new THREE.CanvasTexture(this.sheet);
    this.paintTex.colorSpace = THREE.SRGBColorSpace;
    this.paintTex.anisotropy = 8;
    this.ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, map: this.paintTex }));
    this.ground.receiveShadow = true;
    this.ground.castShadow = true;
    this.scene.add(this.ground);

    // ---- the sea, running; and its bed far below ----
    const wave = document.createElement('canvas');
    wave.width = wave.height = 128;
    const wx = wave.getContext('2d')!, wimg = wx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const a = (x / 128) * 6.2832, b = (y / 128) * 6.2832;
      const v = 128 + 60 * Math.sin(a * 3 + Math.sin(b * 2) * 1.6) + 50 * Math.sin(b * 5 + Math.sin(a * 2) * 1.2) + 17 * Math.sin((a + b) * 9);
      wimg.data.set([v, v, v, 255], (y * 128 + x) * 4);
    }
    wx.putImageData(wimg, 0, 0);
    this.seaTex = new THREE.CanvasTexture(wave);
    this.seaTex.wrapS = this.seaTex.wrapT = THREE.RepeatWrapping;
    this.seaTex.repeat.set(70, 70);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c6f8e, roughness: 0.28, metalness: 0.15, transparent: true, opacity: 0.84, bumpMap: this.seaTex, bumpScale: 0.9 }));
    sea.receiveShadow = true;
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c3e52, roughness: 1 }));
    bed.position.y = -1.7;
    this.scene.add(sea, bed);

    // ---- what grows: fir in the cold and the high wet, broadleaf in green country, palm in the heat, stone in the dry ----
    const lists: Record<string, { m: THREE.Matrix4; c: THREE.Color }[]> = { fir: [], round: [], palm: [], rock: [] };
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let gy = 5; gy < MAP_H - 4; gy += 7) for (let gx = 5; gx < MAP_W - 4; gx += 7) {
      const r = (k: number): number => landNoise(gx, gy, sd + 70 + k); // whole numbers in: plain chance out
      const px = gx + (r(0) - 0.5) * 6, py = gy + (r(1) - 0.5) * 6, h = this.heightAt(px, py);
      if (h < 0.3 || h > 2.7) continue;
      const t = c.territories[cell[Math.floor(py) * MAP_W + Math.floor(px)]];
      if (Math.hypot(px - (t.x - 6), py - (t.y + 4)) < 44) continue; // room for the town, the army and their names
      if (wetGrid[Math.round(py / STEP) * gw + Math.round(px / STEP)]) continue;
      const { warm, wet } = climateAt(c.seed, px, py);
      const cold = 1 - smooth(0.27, 0.35, warm), hot = smooth(0.62, 0.72, warm) * (1 - smooth(0.5, 0.6, wet)), dry = (1 - smooth(0.4, 0.5, wet)) * (1 - cold), woods = smooth(0.56, 0.68, wet);
      const clump = smooth(0.52, 0.66, N(px / 55, py / 55, 41));
      const trees = Math.max(0.1 + clump * 0.5, woods * 0.92) * (1 - dry * 0.94) * (1 - hot) + hot * 0.02 + cold * 0.12 * clump;
      const s = 0.55 + r(3) * 0.55;
      q.setFromAxisAngle(up, r(4) * 6.28);
      if (r(2) < trees) {
        const kind = hot > 0.5 ? 'palm' : cold > 0.4 || warm < 0.46 || (h > 1.5 && r(5) < 0.6) ? 'fir' : 'round';
        mt.compose(v.set(WX(px), h - 0.03, WZ(py)), q, sv.set(s, s * (0.9 + r(6) * 0.5), s));
        const tone = new THREE.Color(1, 1, 1).multiplyScalar(0.8 + r(7) * 0.35);
        if (kind === 'fir' && cold > 0.5) tone.lerp(new THREE.Color(2.4, 2.6, 2.7), 0.45 + r(8) * 0.3); // snow on the boughs
        if (kind === 'round' && r(8) < 0.07) tone.multiply(new THREE.Color(1.7, 0.9, 0.4)); // one turning early
        lists[kind].push({ m: mt.clone(), c: tone });
      } else if (r(2) > 1 - (dry * 0.05 + hot * 0.05 + smooth(1.6, 2.4, h) * 0.2)) {
        mt.compose(v.set(WX(px), h, WZ(py)), q, sv.set(s * 0.8, s * 0.55, s * 0.7));
        lists.rock.push({ m: mt.clone(), c: new THREE.Color(1, 1, 1).multiplyScalar(0.75 + r(7) * 0.4) });
      }
    }
    const trunk = (hgt: number, rad: number): THREE.BufferGeometry => tinted(new THREE.CylinderGeometry(rad * 0.7, rad, hgt, 5).translate(0, hgt / 2, 0), 0x5a4028);
    const shapes: Record<string, THREE.BufferGeometry> = {
      fir: mergeGeometries([trunk(0.4, 0.08), tinted(new THREE.ConeGeometry(0.44, 0.9, 6).translate(0, 0.8, 0), 0x35583a), tinted(new THREE.ConeGeometry(0.3, 0.75, 6).translate(0, 1.35, 0), 0x3d6240)])!,
      round: mergeGeometries([trunk(0.55, 0.09), tinted(new THREE.IcosahedronGeometry(0.52, 0).translate(0, 0.95, 0), 0x55803a), tinted(new THREE.IcosahedronGeometry(0.34, 0).translate(0.26, 1.3, 0.1), 0x5f8c40)])!,
      palm: mergeGeometries([trunk(1.3, 0.07), tinted(new THREE.IcosahedronGeometry(0.5, 0).scale(1, 0.28, 1).translate(0, 1.36, 0), 0x5d8a3a), tinted(new THREE.ConeGeometry(0.62, 0.3, 6).translate(0, 1.22, 0), 0x4f7a34)])!,
      rock: tinted(new THREE.DodecahedronGeometry(0.42, 0).translate(0, 0.14, 0), 0x8f8674),
    };
    for (const [kind, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(shapes[kind], new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, vertexColors: true }), list.length);
      list.forEach((e, i) => { im.setMatrixAt(i, e.m); im.setColorAt(i, e.c); });
      im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im);
    }

    // ---- the sky: fair-weather cloud that drifts over and shades the land, and a bank for each weather front ----
    for (let k = 0; k < 9; k++) {
      const g = this.puff(0xffffff, 0.8, (3.5 + hash(k, 5) * 4) * S);
      g.position.set((hash(k, 6) - 0.5) * MAP_W * K * 1.3, (15 + hash(k, 7) * 4) * S, (hash(k, 8) - 0.5) * MAP_H * K * 1.2);
      this.scene.add(g);
      this.puffs.push({ g, v: 0.5 + hash(k, 9) * 0.7 });
    }
    for (const f of frontsOf(c)) this.addCloud(f.kind, f.r * K, WX(f.x), WZ(f.y));

    // ---- life: birds wheeling over the land, ships passing on the sea ----
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0.12, -0.5, 0.2, 0, 0, 0, -0.12, 0, 0, 0.12, 0, 0, -0.12, 0.5, 0.2, 0]), 3));
    const feather = new THREE.MeshBasicMaterial({ color: 0x1c1c22, side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group();
      for (let b = 0; b < 5; b++) { const m = new THREE.Mesh(wing, feather); m.position.set(Math.abs(b - 2) * -0.9, 0, (b - 2) * 0.8); m.rotation.y = Math.PI / 2; m.userData.ph = b * 1.3; g.add(m); }
      this.scene.add(g);
      this.flocks.push({ g, cx: (hash(k, 11) - 0.5) * MAP_W * K * 0.7, cz: (hash(k, 12) - 0.5) * MAP_H * K * 0.6, r: (7 + hash(k, 13) * 9) * S, v: (0.16 + hash(k, 14) * 0.1) * (k % 2 ? 1 : -1), ph: k * 1.7 });
    }
    const hullM = new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.9, flatShading: true }), sailM = new THREE.MeshStandardMaterial({ color: 0xf2e8d0, roughness: 0.9, side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.5), hullM); hull.position.y = 0.12;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), hullM); mast.position.y = 0.85;
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), sailM); sail.position.set(0.02, 0.95, 0); sail.rotation.y = Math.PI / 2 - 0.5;
      g.add(hull, mast, sail);
      g.traverse((o) => { o.castShadow = true; });
      this.scene.add(g);
      this.ships.push({ g, ph: k * 1.57 + hash(k, 21), v: (0.012 + hash(k, 22) * 0.01) * (k % 2 ? 1 : -1) });
    }

    this.scene.add(this.pieces);
    loadPeople(() => this.sync(this.c, this.last.sel, this.last.reach));

    // ---- looking and choosing: drag to move over the map, wheel to come closer, click a land to choose it ----
    let down: { x: number; y: number; tx: number; tz: number } | null = null, dragged = false;
    this.canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, tx: this.tx, tz: this.tz }; dragged = false; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 5) { dragged = true; this.moved = true; }
      if (!dragged) return;
      const k = (this.dist * 1.25) / Math.max(200, this.canvas.clientHeight);
      this.tx = Math.min(56 * S, Math.max(-56 * S, down.tx - dx * k));
      this.tz = Math.min(38 * S, Math.max(-32 * S, down.tz - dy * k * 1.3));
    });
    this.canvas.addEventListener('pointerup', (e) => {
      const was = down; down = null;
      if (!was || dragged) return;
      const r = this.canvas.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const hit = ray.intersectObject(this.ground, false)[0];
      if (!hit) return;
      const px = Math.round((hit.point.x + (MAP_W * K) / 2) / K), py = Math.round((hit.point.z + (MAP_H * K) / 2) / K);
      if (px >= 0 && py >= 0 && px < MAP_W && py < MAP_H) this.onPick(this.cell[py * MAP_W + px]);
    });
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.moved = true; this.dist = Math.min(this.fit * 1.1, Math.max(20, this.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    host.appendChild(this.canvas);
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    const loop = (): void => { this.raf = requestAnimationFrame(loop); if (this.canvas.offsetParent !== null && !document.hidden) this.frame(); };
    loop();
  }

  /** Stop drawing and let the graphics go: another map is taking this one's place. */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.gl.dispose();
    this.canvas.remove();
  }

  /** The height of the land at a point of the map. */
  heightAt(px: number, py: number): number {
    const x = Math.min(this.gw - 1.001, Math.max(0, px / STEP)), y = Math.min(this.gh - 1.001, Math.max(0, py / STEP));
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, H = this.heights, w = this.gw;
    return (H[j * w + i] * (1 - fx) + H[j * w + i + 1] * fx) * (1 - fy) + (H[(j + 1) * w + i] * (1 - fx) + H[(j + 1) * w + i + 1] * fx) * fy;
  }

  /** Lay the borders over the painted ground: each land edged in the colour of whoever holds it, the chosen land lit, marauder country darkened. */
  private repaint(c: Campaign, sel: number, reach: Set<number>): void {
    const ctx = this.sheet.getContext('2d')!, img = ctx.createImageData(MAP_W, MAP_H), D = img.data, B = this.base, cell = this.cell, edge = this.edge;
    const tint = c.territories.map((t) => { const col = t.owner >= 0 ? c.factions[t.owner].color : -1; return [col >> 16 & 255, col >> 8 & 255, col & 255, col < 0 ? 0 : 1, t.horde && t.owner < 0 ? 1 : 0, t.id === sel ? 1 : 0, reach.has(t.id) ? (t.owner === 0 ? 1 : 2) : 0]; });
    for (let i = 0, o = 0; i < cell.length; i++, o += 4) {
      let r = B[o], g = B[o + 1], b = B[o + 2];
      const t = tint[cell[i]], e = edge[i], seaHere = b > g && b > r + 30; // open water keeps its own colour
      if (!seaHere) {
        if (t[4]) { r *= 0.5; g *= 0.47; b *= 0.45; }
        if (t[5]) { r += (255 - r) * 0.13; g += (255 - g) * 0.13; b += (255 - b) * 0.1; }
        if (t[6] === 1) { r += (255 - r) * 0.1; g += (255 - g) * 0.1; b += (255 - b) * 0.1; } else if (t[6] === 2) { r += (230 - r) * 0.12; g *= 0.93; b *= 0.92; }
        if (t[3]) { const k = 0.05 + 0.62 * (1 - Math.min(1, e / 15)) ** 1.6; r += (t[0] - r) * k; g += (t[1] - g) * k; b += (t[2] - b) * k; }
        if (e < 1.7) { const k = t[3] ? 0.55 : 0.72; r *= k; g *= k; b *= k; }
      } else if (e < 1.2) { r *= 0.9; g *= 0.9; b *= 0.9; }
      D[o] = r; D[o + 1] = g; D[o + 2] = b; D[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.paintTex.needsUpdate = true;
  }

  /** A bank of cloud, with the shadow it throws. */
  private puff(tone: number, opacity: number, r: number): THREE.Group {
    const mat = new THREE.MeshLambertMaterial({ color: tone, transparent: true, opacity, depthWrite: false });
    mat.userData.full = opacity; this.cloudMats.push(mat);
    const g = new THREE.Group(), lobe = new THREE.IcosahedronGeometry(1, 2);
    for (let k = 0; k < 7; k++) {
      const m = new THREE.Mesh(lobe, mat), a = k * 0.9, d = r * (0.1 + (k % 4) * 0.2);
      m.position.set(Math.cos(a) * d, (k % 3) * 0.4, Math.sin(a) * d * 0.7);
      m.scale.set(r * 0.42, r * 0.16, r * 0.34);
      g.add(m);
    }
    const shade = new THREE.Mesh(new THREE.CircleGeometry(r * 1.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a1018, transparent: true, opacity: 0.16, depthWrite: false }));
    shade.position.set(r * 0.6, 0, -r * 0.3); shade.renderOrder = 2; shade.userData.shade = true;
    g.add(shade);
    return g;
  }

  private resize(): void {
    const w = Math.max(200, this.host.clientWidth), h = Math.max(200, this.host.clientHeight);
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Far enough back to take in the whole country, the first time and whenever the window changes shape.
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    this.fit = Math.max((60 * S) / (half * this.camera.aspect), (36 * S) / half);
    if (!this.moved) this.dist = this.fit;
    if (!this.cd) this.cd = this.fit * 1.7; // the eye comes down out of the sky the first time
  }

  private sprite(draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number, scale: number): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d')!, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    s.scale.set(scale * (w / h), scale, 1);
    s.renderOrder = 10; // over the sea, which is see-through and would otherwise be drawn across it
    this.labels.push({ s, w: scale * (w / h), h: scale });
    return s;
  }

  private addCloud(kind: string, r: number, x: number, z: number): void {
    const tone = kind === 'rain' ? 0x8a94a6 : kind === 'snow' ? 0xf2f5fa : 0xc09a66;
    const mat = new THREE.MeshLambertMaterial({ color: tone, transparent: true, opacity: 0.72, depthWrite: false });
    mat.userData.full = 0.72; this.cloudMats.push(mat);
    const g = new THREE.Group(), lobe = new THREE.IcosahedronGeometry(1, 2);
    for (let k = 0; k < 11; k++) {
      const m = new THREE.Mesh(lobe, mat), a = k * 0.9;
      const d = r * (0.1 + (k % 4) * 0.15);
      m.position.set(Math.cos(a) * d, (k % 3) * 0.5, Math.sin(a) * d * 0.7);
      m.scale.set(r * 0.3, r * 0.13, r * 0.26);
      g.add(m);
    }
    // A shadow of its own on the land, since cloud lets the sun through.
    const shade = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a1018, transparent: true, opacity: 0.2, depthWrite: false }));
    shade.position.y = -12.4; shade.renderOrder = 2;
    g.add(shade);
    const n = 260, pts = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { const a = hash(k, 1) * 6.283, d = Math.sqrt(hash(k, 2)) * r; pts[k * 3] = Math.cos(a) * d; pts[k * 3 + 1] = -hash(k, 3) * 14; pts[k * 3 + 2] = Math.sin(a) * d; }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const fall = new THREE.Points(fg, new THREE.PointsMaterial({ color: kind === 'rain' ? 0x9cc0f0 : kind === 'snow' ? 0xffffff : 0xd0a870, size: kind === 'snow' ? 0.34 : 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
    g.add(fall);
    g.position.set(x, 14.5, z);
    this.scene.add(g);
    this.clouds.push({ g, fall, kind, r });
  }

  /** Set out the pieces as the campaign now stands: towns, buildings, names, armies, marks, and which lands can be marched on. */
  sync(c: Campaign, sel: number, reach: Set<number>): void {
    this.c = c;
    this.last = { sel, reach };
    for (const t of this.textures) t.dispose();
    this.textures = [];
    this.pieces.clear();
    this.people = []; this.flags = []; this.rings = []; this.bobs = []; this.labels = []; this.smokes = []; this.movers = [];
    this.repaint(c, sel, reach);
    const smokeM = new THREE.MeshBasicMaterial({ color: 0xe8e4dc, transparent: true, opacity: 0.5, depthWrite: false }), smokeG = new THREE.SphereGeometry(0.3, 7, 5);
    const live = new Set<number>();
    const solid = (color: number): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
    const stone = solid(0xd9cdb2), roof = solid(0x9a4a34), wood = solid(0x6a4a2c), thatch = solid(0xc8a858);
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D): THREE.Mesh => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    const tower = (p: THREE.Object3D, x: number, z: number, r: number, h: number): void => { add(new THREE.CylinderGeometry(r, r * 1.08, h, 10), stone, x, h / 2, z, p); add(new THREE.ConeGeometry(r * 1.25, r * 1.5, 10), roof, x, h + r * 0.75, z, p); };
    const flagOn = (p: THREE.Object3D, x: number, y: number, z: number, color: number, size: number): void => {
      add(new THREE.CylinderGeometry(0.035 * size, 0.035 * size, 1.6 * size, 5), wood, x, y + 0.8 * size, z, p);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * size, 0.5 * size).translate(0.45 * size, 0, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
      f.position.set(x, y + 1.33 * size, z); f.castShadow = true;
      p.add(f); this.flags.push(f);
    };
    const ring = (x: number, y: number, z: number, r: number, color: number, live: boolean, wide = 0.18): void => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r - wide, r, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, fog: false }));
      m.position.set(x, y + 0.25, z); m.renderOrder = 5;
      this.pieces.add(m); this.rings.push({ m, live });
    };

    for (const t of c.territories) {
      const X = WX(t.x), Z = WZ(t.y), y = Math.max(0.2, this.heightAt(t.x, t.y));
      const fac = t.owner >= 0 ? c.factions[t.owner] : null;
      // Chosen, and within reach of the chosen army.
      if (t.id === sel) ring(X, y, Z, 5.2, 0xfff4d0, false, 0.22);
      if (reach.has(t.id)) ring(X, y, Z, 4.4, t.owner === 0 ? 0xffffff : 0xc03020, true, 0.3);
      if (t.horde && t.owner < 0) ring(X, y, Z, 3.9, 0x181410, false, 0.5);

      // The place itself: a walled town for a capital, a keep where it is fortified, a house for every other building.
      const town = new THREE.Group();
      town.position.set(X - 3.4, y, Z - 0.8);
      town.scale.setScalar(1.6);
      if (t.capital >= 0) {
        add(new THREE.BoxGeometry(2.6, 0.9, 2.2), stone, 0, 0.45, 0, town);
        for (const [dx, dz] of [[-1.3, -1.1], [1.3, -1.1], [-1.3, 1.1], [1.3, 1.1]]) tower(town, dx, dz, 0.36, 1.5);
        tower(town, 0, 0, 0.55, 2.3);
        flagOn(town, 0, 3.1, 0, c.factions[t.capital].color, 1);
      } else if (t.buildings.includes('fortress')) {
        tower(town, 0, 0, 0.5, 1.9);
        add(new THREE.BoxGeometry(1.7, 0.6, 1.5), stone, 0, 0.3, 0, town);
      }
      const homes = t.buildings.filter((b) => b !== 'fortress');
      homes.forEach((b, k) => {
        const a = 2.2 + k * 1.15, hx = Math.cos(a) * 2.4 + (t.capital >= 0 ? 0 : 0.6), hz = Math.sin(a) * 1.9 + 1.2;
        const hy = Math.max(0.2, this.heightAt(t.x - 26 + hx / K, t.y - 6 + hz / K)) - y;
        if (b === 'farm') { const f = add(new THREE.BoxGeometry(1.5, 0.06, 1.1), solid(0xc9a644), hx, hy + 0.05, hz, town); f.rotation.y = 0.4; return; }
        add(new THREE.BoxGeometry(0.75, 0.5, 0.6), b === 'harbour' ? wood : stone, hx, hy + 0.25, hz, town);
        const r = add(new THREE.ConeGeometry(0.62, 0.42, 4), b === 'barracks' ? roof : thatch, hx, hy + 0.7, hz, town); r.rotation.y = Math.PI / 4;
      });
      this.pieces.add(town);
      // Hearth-smoke over every place that is lived in.
      if (t.owner >= 0 && (t.capital >= 0 || t.buildings.length)) for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(smokeG, smokeM.clone()); this.pieces.add(m); this.smokes.push({ m, x: X - 3.4, y: y + (t.capital >= 0 ? 4.2 : 1.6), z: Z - 0.8, ph: k / 3 + t.id * 0.37 }); }

      // Its name, standing over it.
      const big = t.capital >= 0;
      const name = this.sprite((x, w, h) => {
        x.font = `italic 600 ${big ? 44 : 38}px Georgia, 'Times New Roman', serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.lineWidth = 9; x.strokeStyle = 'rgba(28,18,8,0.85)'; x.lineJoin = 'round';
        const text = big ? t.name.toUpperCase() : t.name;
        x.strokeText(text, w / 2, h / 2); x.fillStyle = fac ? '#fff6dc' : '#e6d8b4'; x.fillText(text, w / 2, h / 2);
      }, 512, 72, big ? 2.5 : 2.1);
      name.position.set(X, y + (big ? 6.6 : 4.6), Z - 3.2);
      this.pieces.add(name);
      // Slots: a pip for each building it could hold.
      const n0 = slots(t);
      const pips = this.sprite((x, w, h) => { for (let d = 0; d < n0; d++) { x.fillStyle = d < t.buildings.length ? '#fff0c8' : 'rgba(255,240,200,0.28)'; x.fillRect(w / 2 - n0 * 13 + d * 26 + 2, h / 2 - 5, 20, 9); } }, 160, 24, 0.62);
      pips.position.set(X, y + (big ? 5.3 : 3.5), Z - 3.2);
      this.pieces.add(pips);

      // What has happened here, on seals that hang in the air above it; what is still to be settled beats on the ground.
      const marks = eventsAt(c, t.id).slice(0, 2);
      marks.forEach((e, k) => {
        const bad = e.kind === 'unrest' || e.kind === 'revolt' || e.kind === 'fever' || e.kind === 'raiders' || e.kind === 'hard' || e.kind === 'horde' || e.kind === 'taken' || e.kind === 'overrun';
        const seal = this.sprite((x, w, h) => {
          x.beginPath(); x.arc(w / 2, h / 2, w / 2 - 5, 0, 6.3); x.fillStyle = bad ? '#f0c8b8' : '#f6e8b0'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#3a2a16'; x.stroke();
          x.font = '54px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(EVENTS[e.kind].icon, w / 2, h / 2 + 4);
        }, 96, 96, 2.5);
        seal.position.set(X + 4.6 + k * 2.7, y + 4.6, Z - 0.4);
        seal.userData.y0 = seal.position.y; seal.userData.ph = t.id + k;
        this.pieces.add(seal); this.bobs.push(seal);
        if (e.kind === 'unrest' || e.kind === 'hoard') ring(X, y, Z, 3.4, e.kind === 'unrest' ? 0xb02818 : 0xd8a020, true, 0.26);
      });

      // Who stands here: an army under its standard, or the bands of the local tribes by their tents.
      const a = armyAt(c, t.id);
      const n = a ? armySize(a) : t.owner < 0 ? t.militia : 0;
      if (!n) continue;
      const color = a ? c.factions[a.owner].color : t.horde ? 0x2a2420 : LOCALS.color;
      const holder = new THREE.Group(), piece = new THREE.Group(), men: RealPerson[] = [];
      holder.position.set(X + 0.8, y, Z + 1.8);
      holder.add(piece);
      piece.scale.setScalar(1.6);
      const base = add(new THREE.CylinderGeometry(a ? 1.25 : 0.95, a ? 1.38 : 1.05, 0.28, 28), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), 0, 0.14, 0, piece);
      base.receiveShadow = true;
      add(new THREE.TorusGeometry(a ? 1.3 : 1, 0.07, 6, 28).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: a ? 0xe8c860 : 0x6a5a3a, roughness: 0.4, metalness: 0.5 }), 0, 0.26, 0, piece);
      if (a) {
        flagOn(piece, -0.85, 0.28, -0.4, color, 1.5);
        const civ = c.factions[a.owner].civ, age = ageOf(c, a.owner);
        const kinds = a.hero ? ['warlord'] : [];
        const main = (a.units.cavalry ?? 0) > (a.units.infantry ?? 0) ? 'spearman' : (a.units.archers ?? 0) > (a.units.infantry ?? 0) ? 'bowman' : age >= 2 ? 'swordsman' : age >= 1 ? 'spearman' : 'clubman';
        kinds.push(main); if (n >= 5) kinds.push(age >= 1 ? 'bowman' : 'slinger');
        kinds.slice(0, 3).forEach((type, k) => {
          const made = peopleReady() ? makePerson(outfitFor(type, false, color, lookOf(civ, a.id * 7 + k), a.id * 7 + k, 0, { cls: type === 'warlord' ? 'hero' : type === 'bowman' || type === 'slinger' ? 'ranged' : 'infantry', age })) : null;
          const px = kinds.length === 1 ? 0.1 : [0.15, 0.75, -0.25][k], pz = kinds.length === 1 ? 0.1 : [0.35, -0.2, -0.3][k];
          if (made) {
            made.g.scale.setScalar(k === 0 ? 1.75 : 1.5);
            made.g.position.set(px, 0.28, pz);
            made.g.traverse((o) => { o.castShadow = true; });
            piece.add(made.g);
            play(made.real, 'Idle_Loop', 1);
            this.people.push(made.real); men.push(made.real);
          } else {
            add(new THREE.CylinderGeometry(0.16, 0.26, 1.2, 8), solid(color), px, 0.88, pz, piece);
            add(new THREE.SphereGeometry(0.2, 10, 8), solid(0xe0b890), px, 1.66, pz, piece);
          }
        });
        if (a.moved && c.phase === 'player') piece.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && m.color && (o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) { m.transparent = true; m.opacity = 0.55; } });
      } else {
        for (const [dx, dz] of [[-0.3, 0.1], [0.4, -0.25]]) add(new THREE.ConeGeometry(0.42, 0.62, 6), solid(t.horde ? 0x4a3c30 : 0x8a7250), dx, 0.59, dz, piece);
        // Marauders: a ring of stakes round the tents, a fire, and a black banner.
        if (t.horde) {
          for (let k = 0; k < 12; k++) { const sa = (k / 12) * 6.283; add(new THREE.ConeGeometry(0.06, 0.6, 5), wood, Math.cos(sa) * 0.9, 0.58, Math.sin(sa) * 0.9, piece); }
          add(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a30 }), 0.05, 0.42, 0.25, piece);
          flagOn(piece, -0.75, 0.28, -0.35, 0x121010, 1.4);
        }
      }
      this.pieces.add(holder);
      // An army that stood elsewhere a moment ago marches here over the ground.
      if (a) {
        live.add(a.id);
        const was = this.stood.get(a.id), tx = holder.position.x, tz = holder.position.z;
        if (was && Math.hypot(was.x - tx, was.z - tz) > 1) { this.movers.push({ g: holder, fx: was.x, fz: was.z, tx, tz, t0: this.clock.elapsedTime, men }); holder.position.set(was.x, holder.position.y, was.z); holder.rotation.y = Math.atan2(tx - was.x, tz - was.z); for (const m of men) play(m, 'Walk_Loop', 1); }
        this.stood.set(a.id, { x: tx, z: tz });
      }
      // Its numbers, on a shield in its colour that always faces whoever is looking.
      const shield = this.sprite((x, w, h) => {
        x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, 8); x.lineTo(w - 8, h * 0.5); x.quadraticCurveTo(w - 12, h * 0.82, w / 2, h - 6); x.quadraticCurveTo(12, h * 0.82, 8, h * 0.5); x.closePath();
        x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fill(); x.lineWidth = 7; x.strokeStyle = a ? '#fff4d8' : '#5a4a30'; x.stroke(); x.lineWidth = 2.5; x.strokeStyle = '#2a1c0c'; x.stroke();
        x.font = '700 50px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.strokeText(String(n), w / 2, h * 0.45); x.fillStyle = '#fff'; x.fillText(String(n), w / 2, h * 0.45);
        if (a?.hero) { x.font = '34px serif'; x.fillStyle = '#f6d860'; x.strokeStyle = '#3a2c18'; x.lineWidth = 5; x.strokeText('♛', w / 2, 2); }
      }, 96, 112, a ? 2.5 : 1.9);
      shield.position.set(3.1, a ? 2.2 : 1.6, 1);
      shield.userData.keep = true;
      holder.add(shield);
    }
    for (const id of [...this.stood.keys()]) if (!live.has(id)) this.stood.delete(id);
  }

  private frame(): void {
    const dt = Math.min(0.1, this.clock.getDelta()), now = this.clock.elapsedTime;
    // The eye follows the hand smoothly, and looks more across the land the closer it comes.
    const ease = Math.min(1, dt * 6);
    this.cx += (this.tx - this.cx) * ease; this.cz += (this.tz - this.cz) * ease; this.cd += (this.dist - this.cd) * Math.min(1, dt * 3.2);
    const pitch = 0.6 + 0.36 * smooth(30, this.fit, this.cd);
    this.camera.position.set(this.cx, Math.sin(pitch) * this.cd, this.cz + Math.cos(pitch) * this.cd);
    this.camera.lookAt(this.cx, 0, this.cz);
    const grow = Math.min(1.9, Math.max(0.8, this.cd / 62));
    for (const l of this.labels) l.s.scale.set(l.w * grow, l.h * grow, 1);
    // The sea runs; cloud drifts east; birds wheel; ships go round the coast; smoke rises.
    this.seaTex.offset.set(now * 0.006, now * 0.004);
    // Cloud thins as the eye comes down through it, so it never hides the ground being looked at.
    const thin = 0.25 + 0.75 * smooth(30, 80, this.cd);
    for (const m of this.cloudMats) m.opacity = (m.userData.full as number) * thin;
    const wide = MAP_W * K * 0.75;
    for (const p of this.puffs) { p.g.position.x += p.v * dt; if (p.g.position.x > wide) p.g.position.x = -wide; for (const o of p.g.children) if (o.userData.shade) o.position.y = 1.6 - p.g.position.y; }
    for (const f of this.flocks) {
      const a = now * f.v + f.ph;
      f.g.position.set(f.cx + Math.cos(a) * f.r, 9 + Math.sin(now * 0.4 + f.ph) * 1.2, f.cz + Math.sin(a) * f.r);
      f.g.rotation.y = -a + (f.v > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.PI / 2;
      for (const b of f.g.children) b.scale.y = Math.sin(now * 7 + (b.userData.ph as number)) * 1.4;
    }
    for (const sh of this.ships) {
      const a = now * sh.v + sh.ph;
      sh.g.position.set(Math.cos(a) * (MAP_W * K * 0.5 + 5), Math.sin(now * 1.4 + sh.ph) * 0.04, Math.sin(a) * (MAP_H * K * 0.5 + 4));
      sh.g.rotation.y = -a + (sh.v > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    for (const sm of this.smokes) {
      const k = (now * 0.22 + sm.ph) % 1;
      sm.m.position.set(sm.x + k * 1.1, sm.y + k * 3.4, sm.z);
      sm.m.scale.setScalar(0.6 + k * 1.6);
      (sm.m.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - k) * Math.min(1, k * 6);
    }
    for (let i = this.movers.length - 1; i >= 0; i--) {
      const m = this.movers[i], k = Math.min(1, (now - m.t0) / 1.6), e = k * k * (3 - 2 * k);
      const x = m.fx + (m.tx - m.fx) * e, z = m.fz + (m.tz - m.fz) * e;
      m.g.position.set(x, Math.max(0.2, this.heightAt((x + (MAP_W * K) / 2) / K, (z + (MAP_H * K) / 2) / K)), z);
      if (k >= 1) { m.g.rotation.y = 0; for (const p of m.men) play(p, 'Idle_Loop', 1); this.movers.splice(i, 1); }
    }
    for (const p of this.people) p.mixer.update(dt);
    for (const f of this.flags) f.rotation.y = Math.sin(now * 2.2 + f.position.x) * 0.35 - 0.2;
    for (const r of this.rings) if (r.live) { const k = (now * 0.8) % 1; r.m.scale.setScalar(0.85 + k * 0.45); (r.m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k); }
    for (const b of this.bobs) b.position.y = (b.userData.y0 as number) + Math.sin(now * 1.6 + (b.userData.ph as number)) * 0.18;
    // Cloud glides to where its front now lies; rain drives down, snow drifts, dust blows across.
    const fronts = frontsOf(this.c);
    this.clouds.forEach((cl, i) => {
      const f = fronts[i];
      if (!f) { cl.g.visible = false; return; }
      const gx = WX(f.x), gz = WZ(f.y);
      if (Math.hypot(gx - cl.g.position.x, gz - cl.g.position.z) > 70) cl.g.position.set(gx, cl.g.position.y, gz); // a new front, come in from the edge
      cl.g.position.x += (gx - cl.g.position.x) * Math.min(1, dt * 0.9) + Math.sin(now * 0.3 + i) * dt * 0.2;
      cl.g.position.z += (gz - cl.g.position.z) * Math.min(1, dt * 0.9);
      const p = cl.fall.geometry.getAttribute('position') as THREE.BufferAttribute;
      const speed = cl.kind === 'rain' ? 16 : cl.kind === 'snow' ? 2.4 : 0.8;
      for (let k = 0; k < p.count; k++) {
        let y = p.getY(k) - speed * dt;
        if (y < -14) y += 14;
        p.setY(k, y);
        if (cl.kind === 'dust') { let x = p.getX(k) + dt * 5; if (x > cl.r) x -= cl.r * 2; p.setX(k, x); }
        else if (cl.kind === 'snow') p.setX(k, p.getX(k) + Math.sin(now * 1.3 + k) * dt * 0.5);
      }
      p.needsUpdate = true;
    });
    this.gl.render(this.scene, this.camera);
  }
}
