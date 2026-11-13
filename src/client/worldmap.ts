// The campaign map in three dimensions: a living country seen from above and to one side, in the manner of the
// great war-maps of strategy games. Every campaign grows its own world from its seed: its own coastline, bays and
// lakes, mountain ranges, rivers running down to the sea, and its own lie of cold, wet and dry country, so one
// world has snow in the north and desert in the south-east and the next the other way about. The ground is painted
// by what grows there; borders glow in the colour of whoever holds the land. Capitals are walled towns, armies are
// figures under a standard that march from land to land, and the map moves: the sea runs, cloud drifts and throws
// shadow, weather fronts pass with rain, snow or dust, birds wheel, ships go by, and smoke rises from the towns.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Campaign, EVENTS, LAND_STEP, LOCALS, MAP_H, MAP_W, ageOf, armyAt, armySize, climateAt, eventsAt, frontsOf, landNoise, slots, terrainOf } from '../sim/campaign';
import { lookOf } from './models';
import { RealPerson, loadPeople, makePerson, outfitFor, peopleReady, play } from './person';

/** Map points to a unit of the world. */
const K = 0.13;
/** How much larger the world is than the one the pieces were first sized for. */
const S = K / 0.1;
const WX = (px: number): number => px * K - (MAP_W * K) / 2;
const WZ = (py: number): number => py * K - (MAP_H * K) / 2;
const STEP = LAND_STEP;

const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (o: number[], c: number[], k: number): void => { o[0] += (c[0] - o[0]) * k; o[1] += (c[1] - o[1]) * k; o[2] += (c[2] - o[2]) * k; };
/** A shape in one colour, ready to be joined to others and still take a tint of its own. */
const tinted = (g: THREE.BufferGeometry, hex: number, low = 1): THREE.BufferGeometry => {
  const n = g.index ? g.toNonIndexed() : g, c = new THREE.Color(hex), p = n.getAttribute('position'), a = new Float32Array(p.count * 3);
  n.computeBoundingBox();
  const y0 = n.boundingBox!.min.y, span = Math.max(0.001, n.boundingBox!.max.y - y0);
  // Darker toward the foot, as leaves and walls are where the light does not reach.
  for (let i = 0; i < p.count; i++) { const k = low + (1 - low) * ((p.getY(i) - y0) / span); a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  n.setAttribute('color', new THREE.BufferAttribute(a, 3));
  n.deleteAttribute('uv');
  return n;
};
/** A shape set down somewhere, turned and stretched. */
const put = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rz = 0, rx = 0): THREE.BufferGeometry => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
/** A pitched roof: a ridge along its length, eaves at its foot. */
const gable = (w: number, h: number, d: number): THREE.BufferGeometry => {
  const a = w / 2, b = d / 2, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -a, 0, b, a, 0, b, a, h, 0, -a, 0, b, a, h, 0, -a, h, 0, // front slope
    a, 0, -b, -a, 0, -b, -a, h, 0, a, 0, -b, -a, h, 0, a, h, 0, // back slope
    -a, 0, -b, -a, 0, b, -a, h, 0, a, 0, b, a, 0, -b, a, h, 0, // the two ends
  ]), 3));
  g.computeVertexNormals();
  return g;
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
  private over!: HTMLCanvasElement;
  private overTex!: THREE.CanvasTexture;
  /** 1 where a point of the map is water. */
  private water!: Uint8Array;
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
  /** Each land's town, kept until what stands there changes. */
  private towns = new Map<number, { sig: string; mesh: THREE.Mesh }>();
  private townMat = new THREE.MeshStandardMaterial({ roughness: 0.88, flatShading: true, vertexColors: true });
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
    const fine = Math.min(4096, this.gl.capabilities.maxTextureSize);
    sun.shadow.mapSize.set(fine, fine);
    sun.shadow.radius = 2.2;
    const sc = sun.shadow.camera;
    sc.left = -64 * S; sc.right = 64 * S; sc.top = 46 * S; sc.bottom = -46 * S; sc.near = 5; sc.far = 240 * S;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06;
    this.scene.add(sun, sun.target);

    // ---- the lie of the land, grown from the campaign's seed (the rules know it too: it decides where a march is barred) ----
    const sd = c.seed % 100000, N = (x: number, y: number, k: number): number => landNoise(x, y, sd + k);
    const land = terrainOf(c), gw = (this.gw = land.gw), gh = (this.gh = land.gh), H = (this.heights = land.H), rivers = land.rivers, wetGrid = land.wet;

    const geo = new THREE.PlaneGeometry(MAP_W * K, MAP_H * K, gw - 1, gh - 1).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    for (let n = 0; n < pos.count; n++) pos.setY(n, H[n]);
    geo.computeVertexNormals();

    // ---- the paint: what grows on each stretch of ground, the rock and snow of the heights, sand at the shore ----
    // Painted at twice the fineness of the map's own points, with a grain laid over it in the shader for close looking.
    const R = 2, PW = MAP_W * R, PH = MAP_H * R;
    this.sheet = document.createElement('canvas');
    this.sheet.width = PW; this.sheet.height = PH;
    const ctx = this.sheet.getContext('2d')!, img = ctx.createImageData(PW, PH), D = img.data, col = [0, 0, 0];
    // Warmth and wet are worked out once for every few points and read off between them.
    const warmG = new Float32Array(gw * gh), wetG = new Float32Array(gw * gh);
    for (let gj = 0; gj < gh; gj++) for (let gi = 0; gi < gw; gi++) { const cl = climateAt(c.seed, gi * STEP, gj * STEP); warmG[gj * gw + gi] = cl.warm; wetG[gj * gw + gi] = cl.wet; }
    const read = (A: Float32Array, px: number, py: number): number => {
      const x = Math.min(gw - 1.001, Math.max(0, px / STEP)), y = Math.min(gh - 1.001, Math.max(0, py / STEP)), a = Math.floor(x), b = Math.floor(y), fx = x - a, fy = y - b, n = b * gw + a;
      return (A[n] * (1 - fx) + A[n + 1] * fx) * (1 - fy) + (A[n + gw] * (1 - fx) + A[n + gw + 1] * fx) * fy;
    };
    const GRASS = [106, 148, 66], MEADOW = [134, 164, 76], FOREST = [62, 104, 54], MARSH = [80, 106, 82], STEPPE = [182, 168, 98], DESERT = [228, 200, 140], REDSAND = [208, 160, 108], SNOW = [240, 244, 248], ROCK = [124, 116, 106], DARKROCK = [92, 86, 82], SAND = [222, 208, 158], POOL = [70, 118, 132];
    this.water = new Uint8Array(MAP_W * MAP_H);
    for (let Y = 0; Y < PH; Y++) for (let X = 0; X < PW; X++) {
      const px = X / R, py = Y / R, h = this.heightAt(px, py), o = (Y * PW + X) * 4;
      if (h <= 0) {
        if (X % R === 0 && Y % R === 0) this.water[py * MAP_W + px] = 1;
        // Shallows pale and green over the sand, deep water dark; a line of surf where it meets the land.
        const d = smooth(0, -1.5, h), reef = N(px / 9, py / 9, 35);
        col[0] = 112 - d * 84 + reef * 10; col[1] = 172 - d * 106 + reef * 8; col[2] = 170 - d * 80;
        if (h > -0.06) mix3(col, [240, 246, 242], 0.75 * smooth(-0.06, 0, h));
      } else {
        const warm = read(warmG, px, py), wet = read(wetG, px, py);
        const cold = 1 - smooth(0.27, 0.35, warm), hot = smooth(0.62, 0.72, warm) * (1 - smooth(0.5, 0.6, wet)), dry = 1 - smooth(0.4, 0.5, wet);
        const marsh = smooth(0.76, 0.84, wet) * smooth(0.4, 0.46, warm);
        const patch = N(px / 26, py / 26, 36), fine = N(px / 2.2, py / 2.2, 33), mid = N(px / 9, py / 9, 34);
        col[0] = GRASS[0]; col[1] = GRASS[1]; col[2] = GRASS[2];
        mix3(col, MEADOW, smooth(0.45, 0.7, patch) * 0.7); // lighter meadow among the darker grass
        mix3(col, FOREST, smooth(0.56, 0.68, wet) * 0.85);
        mix3(col, MARSH, marsh);
        if (marsh > 0.5 && N(px / 7, py / 7, 31) > 0.66) mix3(col, POOL, 0.8);
        mix3(col, STEPPE, dry);
        mix3(col, DESERT, hot);
        mix3(col, REDSAND, hot * smooth(0.5, 0.75, patch) * 0.6);
        mix3(col, SNOW, cold);
        const hx = this.heightAt(px + 1.5, py) - this.heightAt(px - 1.5, py), hy = this.heightAt(px, py + 1.5) - this.heightAt(px, py - 1.5);
        const slope = Math.hypot(hx, hy) * 2;
        const rock = Math.max(smooth(2.1, 3.2, h + (mid - 0.5) * 0.8), smooth(0.55, 1.0, slope)) * smooth(0.5, 0.9, h);
        mix3(col, ROCK, rock);
        mix3(col, DARKROCK, rock * smooth(0.5, 0.8, N(px / 4, py / 14, 37)) * 0.6); // strata down the faces
        const line = 4.5 - cold * 3.2 - (1 - warm) * 0.8 + (mid - 0.5) * 0.9; // the snow lies lower in cold country, and raggedly
        mix3(col, SNOW, smooth(line, line + 0.6, h) * (1 - smooth(1.1, 1.6, slope) * 0.6));
        mix3(col, SAND, (1 - smooth(0.08, 0.42, h)) * (1 - cold));
        // Light from the north-west picks out every slope; hollows lie a little in shade.
        const lit = Math.min(1.32, Math.max(0.55, 1 - (hx + hy) * 0.62));
        const k = (0.88 + fine * 0.12 + mid * 0.12) * lit;
        col[0] *= k * (lit > 1 ? 1.03 : 0.97); col[1] *= k; col[2] *= k * (lit > 1 ? 0.96 : 1.06); // warm where the sun falls, cool in shadow
      }
      D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.scale(R, R);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Ploughland and pasture round every town in green country: a quilt of small fields.
    for (const t of c.territories) {
      const warm = read(warmG, t.x, t.y), wet = read(wetG, t.x, t.y);
      if (warm < 0.36 || wet < 0.46 || (warm > 0.66 && wet < 0.56)) continue;
      for (let k = 0; k < 16; k++) {
        const a = hash(t.id, k) * 6.283, d = 14 + hash(k, t.id + 9) * 30, fx = t.x - 6 + Math.cos(a) * d, fy = t.y + 6 + Math.sin(a) * d * 0.8;
        const h = this.heightAt(fx, fy);
        if (h < 0.35 || h > 1.5) continue;
        const w = 7 + hash(k, t.id + 3) * 7, hh = 5 + hash(k, t.id + 5) * 5, turn = (hash(t.id, 40) - 0.5) * 0.9 + (k % 2) * 1.5708;
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(turn);
        ctx.fillStyle = ['rgba(216,190,104,0.8)', 'rgba(150,178,84,0.8)', 'rgba(152,120,76,0.75)', 'rgba(196,204,112,0.8)'][Math.floor(hash(k, t.id + 7) * 4)];
        ctx.fillRect(-w / 2, -hh / 2, w, hh);
        ctx.strokeStyle = 'rgba(70,56,30,0.28)'; ctx.lineWidth = 0.35;
        for (let f = -hh / 2 + 0.8; f < hh / 2; f += 1.1) { ctx.beginPath(); ctx.moveTo(-w / 2, f); ctx.lineTo(w / 2, f); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(60,80,40,0.5)'; ctx.lineWidth = 0.5; ctx.strokeRect(-w / 2, -hh / 2, w, hh); // hedges
        ctx.restore();
      }
    }
    // Rivers, widening as they run down: a dark bank, the water, and a thread of light on it.
    for (const path of rivers) {
      const raw = path.map((q) => [(q % gw) * STEP, Math.floor(q / gw) * STEP]);
      const pts = raw.map((_, k) => { let x = 0, y = 0, n = 0; for (let d = -3; d <= 3; d++) { const e = raw[k + d]; if (e) { x += e[0]; y += e[1]; n++; } } return [x / n, y / n]; });
      for (const [tone, extra, part] of [['rgba(34,60,50,0.4)', 2.2, 1], ['#4f93b4', 0, 1], ['rgba(190,226,236,0.7)', -1.2, 0.35]] as [string, number, number][]) {
        ctx.strokeStyle = tone;
        for (let k = 1; k < pts.length - 1; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k], [cx2, cy2] = pts[k + 1];
          ctx.lineWidth = Math.max(0.3, (1.3 + (k / pts.length) * 3.4) * part + extra);
          ctx.beginPath(); ctx.moveTo((ax + bx) / 2, (ay + by) / 2); ctx.quadraticCurveTo(bx, by, (bx + cx2) / 2, (by + cy2) / 2); ctx.stroke();
        }
      }
    }
    // Roads: a dotted way between every two towns an army can march between. Where there is none, the way is barred.
    ctx.setLineDash([4, 4.5]);
    for (const [tone, wide] of [['rgba(60,40,20,0.4)', 2.6], ['rgba(240,224,176,0.95)', 1.3]] as [string, number][]) {
      ctx.strokeStyle = tone; ctx.lineWidth = wide;
      for (const t of c.territories) for (const o of t.adj) if (o > t.id) {
        const u = c.territories[o], mx = (t.x + u.x) / 2 + (u.y - t.y) * 0.08, my = (t.y + u.y) / 2 - (u.x - t.x) * 0.08;
        ctx.beginPath(); ctx.moveTo(t.x, t.y + 8); ctx.quadraticCurveTo(mx, my + 8, u.x, u.y + 8); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    this.paintTex = new THREE.CanvasTexture(this.sheet);
    this.paintTex.colorSpace = THREE.SRGBColorSpace;
    this.paintTex.anisotropy = this.gl.capabilities.getMaxAnisotropy();
    // The borders are a sheet of their own, laid over the paint, so that choosing a land redraws only that.
    this.over = document.createElement('canvas');
    this.over.width = MAP_W; this.over.height = MAP_H;
    this.overTex = new THREE.CanvasTexture(this.over);
    this.overTex.colorSpace = THREE.SRGBColorSpace;
    this.overTex.anisotropy = 4;
    // A grain that repeats across the land: it roughens the colour and the light close to.
    const grainC = document.createElement('canvas');
    grainC.width = grainC.height = 256;
    const gx = grainC.getContext('2d')!, gimg = gx.createImageData(256, 256);
    const gv = (x: number, y: number): number => hash(x & 255, y & 255);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const v = (gv(x, y) * 2 + gv(x + 1, y) + gv(x - 1, y) + gv(x, y + 1) + gv(x, y - 1) + (gv(x >> 2, (y >> 2) + 300) + gv((x + 2) >> 2, ((y + 2) >> 2) + 300)) * 2) / 10;
      gimg.data.set([v * 255, v * 255, v * 255, 255], (y * 256 + x) * 4);
    }
    gx.putImageData(gimg, 0, 0);
    const grain = new THREE.CanvasTexture(grainC);
    grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
    grain.repeat.set(96, 58);
    grain.anisotropy = 4;
    const earth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0, map: this.paintTex, bumpMap: grain, bumpScale: 0.55 });
    const overTex = this.overTex;
    earth.onBeforeCompile = (sh) => {
      sh.uniforms.overMap = { value: overTex };
      sh.uniforms.grainMap = { value: grain };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D overMap;\nuniform sampler2D grainMap;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n  float grainV = texture2D( grainMap, vMapUv * vec2( 96.0, 58.0 ) ).r;\n  diffuseColor.rgb *= 0.84 + 0.32 * grainV;\n  vec4 overC = texture2D( overMap, vMapUv );\n  diffuseColor.rgb = mix( diffuseColor.rgb, overC.rgb, overC.a );');
    };
    this.ground = new THREE.Mesh(geo, earth);
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
    const lists: Record<string, { m: THREE.Matrix4; c: THREE.Color }[]> = { fir: [], round: [], birch: [], palm: [], cactus: [], bush: [], rock: [] };
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
        const kind = hot > 0.5 ? (h < 0.75 || r(5) < 0.3 ? 'palm' : 'cactus') : cold > 0.4 || warm < 0.46 || (h > 1.5 && r(5) < 0.6) ? 'fir' : r(5) > 0.86 ? 'birch' : r(5) < 0.1 ? 'bush' : 'round';
        mt.compose(v.set(WX(px), h - 0.03, WZ(py)), q, sv.set(s, s * (0.9 + r(6) * 0.5), s));
        const tone = new THREE.Color(1, 1, 1).multiplyScalar(0.8 + r(7) * 0.35);
        if (kind === 'fir' && cold > 0.5) tone.lerp(new THREE.Color(2.4, 2.6, 2.7), 0.45 + r(8) * 0.3); // snow on the boughs
        if ((kind === 'round' || kind === 'birch') && r(8) < 0.07) tone.multiply(new THREE.Color(1.7, 0.9, 0.4)); // one turning early
        lists[kind].push({ m: mt.clone(), c: tone });
      } else if (r(2) > 1 - (dry * 0.05 + hot * 0.05 + smooth(1.6, 2.4, h) * 0.2)) {
        mt.compose(v.set(WX(px), h, WZ(py)), q, sv.set(s * 0.8, s * 0.55, s * 0.7));
        lists.rock.push({ m: mt.clone(), c: new THREE.Color(1, 1, 1).multiplyScalar(0.75 + r(7) * 0.4) });
      }
    }
    const trunk = (hgt: number, rad: number, tone = 0x5a4028): THREE.BufferGeometry => tinted(new THREE.CylinderGeometry(rad * 0.65, rad, hgt, 6).translate(0, hgt / 2, 0), tone, 0.8);
    const leaf = (r: number, x: number, y: number, z: number, tone: number, squash = 0.86): THREE.BufferGeometry => tinted(new THREE.IcosahedronGeometry(r, r > 0.4 ? 1 : 0).scale(1, squash, 1).translate(x, y, z), tone, 0.58);
    const tier = (r: number, hgt: number, y: number, tone: number): THREE.BufferGeometry => tinted(new THREE.ConeGeometry(r, hgt, 8).translate(0, y + hgt / 2, 0), tone, 0.55);
    const frond = (k: number): THREE.BufferGeometry => put(tinted(new THREE.BoxGeometry(0.62, 0.025, 0.17).translate(0.31, 0, 0), k % 2 ? 0x5d8f3a : 0x4c7c32, 1), 0.06, 1.42, 0, (k / 7) * 6.283, -0.42 - (k % 3) * 0.12);
    const shapes: Record<string, THREE.BufferGeometry> = {
      // Fir: four tiers of boughs, narrowing to a point.
      fir: mergeGeometries([trunk(0.35, 0.07), tier(0.5, 0.55, 0.22, 0x2f5236), tier(0.4, 0.5, 0.55, 0x35593a), tier(0.29, 0.48, 0.86, 0x3c6240), tier(0.17, 0.42, 1.18, 0x446b46)])!,
      // Broadleaf: a full, uneven crown of several masses of leaf.
      round: mergeGeometries([trunk(0.6, 0.09), leaf(0.46, 0, 0.95, 0, 0x4d7a36), leaf(0.34, 0.3, 0.86, 0.12, 0x58853a), leaf(0.32, -0.26, 0.9, -0.14, 0x46722f), leaf(0.3, 0.05, 1.28, -0.05, 0x629040), leaf(0.24, -0.1, 0.8, 0.3, 0x5a883c)])!,
      // Birch or poplar: tall and slim on a pale stem.
      birch: mergeGeometries([trunk(0.9, 0.05, 0xd8d2c0), leaf(0.26, 0, 0.95, 0, 0x7fa246, 1.5), leaf(0.2, 0.05, 1.42, 0, 0x8fb04e, 1.5)])!,
      // Palm: a leaning stem and a head of drooping fronds.
      palm: mergeGeometries([put(trunk(0.75, 0.065, 0x8a6a42), 0, 0, 0, 0, -0.08), put(trunk(0.72, 0.05, 0x8a6a42), 0.06, 0.72, 0, 0, 0.06), ...[0, 1, 2, 3, 4, 5, 6].map(frond), tinted(new THREE.SphereGeometry(0.07, 6, 5).translate(0.06, 1.38, 0), 0x6a5030)])!,
      cactus: mergeGeometries([tinted(new THREE.CapsuleGeometry(0.09, 0.6, 3, 7).translate(0, 0.4, 0), 0x5c8a4a, 0.7), tinted(new THREE.CapsuleGeometry(0.055, 0.22, 3, 6).translate(0.2, 0.5, 0), 0x66944f, 0.8), tinted(new THREE.CapsuleGeometry(0.055, 0.07, 3, 6).rotateZ(1.5708).translate(0.12, 0.38, 0), 0x5c8a4a), tinted(new THREE.CapsuleGeometry(0.05, 0.16, 3, 6).translate(-0.18, 0.36, 0), 0x66944f, 0.8), tinted(new THREE.CapsuleGeometry(0.05, 0.06, 3, 6).rotateZ(1.5708).translate(-0.1, 0.27, 0), 0x5c8a4a)])!,
      bush: mergeGeometries([leaf(0.24, 0, 0.2, 0, 0x55803a), leaf(0.18, 0.22, 0.15, 0.06, 0x629040), leaf(0.16, -0.18, 0.13, -0.1, 0x4b7534)])!,
      // Rock: a tumble of three boulders.
      rock: mergeGeometries([tinted(new THREE.DodecahedronGeometry(0.4, 0).scale(1, 0.75, 0.9).translate(0, 0.16, 0), 0x938a78, 0.6), tinted(new THREE.DodecahedronGeometry(0.24, 0).rotateY(1).translate(0.36, 0.08, 0.14), 0x847c6e, 0.65), tinted(new THREE.IcosahedronGeometry(0.17, 0).translate(-0.3, 0.05, -0.2), 0x9c9484, 0.65)])!,
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

  /** The buildings of one land, as a single shape: walls, towers, houses with pitched roofs, and whatever has been built there. */
  private buildTown(t: Campaign['territories'][number], style: string, banner: number, y: number): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [], rnd = (k: number): number => hash(t.id * 7.3 + k, t.seed % 97);
    const desert = style === 'desert', snow = style === 'snow';
    const STONE = desert ? 0xd8c090 : 0xbcb39e, DARK = desert ? 0xb89868 : 0x8e8676, PLASTER = desert ? 0xe2cc9c : snow ? 0x8a6a48 : 0xe8dcc0, TIMBER = 0x6a4a2c;
    const ROOF = snow ? 0xe6ecf0 : desert ? 0xcfb482 : 0xa8502f, THATCH = snow ? 0xdfe6ea : 0xc9a85a, EARTH = desert ? 0xcdb07a : snow ? 0xd8dcdc : 0xa89468;
    const box = (w: number, h: number, d: number, tone: number, x: number, by: number, z: number, ry = 0, low = 0.72): void => { parts.push(put(tinted(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), tone, low), x, by, z, ry)); };
    const cyl = (r: number, h: number, tone: number, x: number, by: number, z: number, seg = 10, top = r): void => { parts.push(put(tinted(new THREE.CylinderGeometry(top, r, h, seg).translate(0, h / 2, 0), tone, 0.7), x, by, z)); };
    const cone = (r: number, h: number, tone: number, x: number, by: number, z: number, seg = 10, ry = 0): void => { parts.push(put(tinted(new THREE.ConeGeometry(r, h, seg).translate(0, h / 2, 0), tone, 0.75), x, by, z, ry)); };
    const house = (x: number, by: number, z: number, ry: number, w = 0.42, d = 0.32, h = 0.24, roofTone = ROOF): void => {
      box(w, h, d, PLASTER, x, by, z, ry);
      if (desert) { box(w + 0.05, 0.05, d + 0.05, DARK, x, by + h, z, ry, 1); if (rnd(x * 9 + z) > 0.6) parts.push(put(tinted(new THREE.SphereGeometry(d * 0.38, 8, 5, 0, 6.283, 0, 1.5708), 0xe8dcc0, 0.8), x, by + h + 0.04, z)); }
      else { parts.push(put(tinted(gable(w + 0.08, h * 0.85, d + 0.1), roofTone, 0.8), x, by + h, z, ry)); box(0.05, 0.16, 0.05, DARK, x + Math.cos(ry) * w * 0.25, by + h + 0.06, z - Math.sin(ry) * w * 0.25, ry, 1); }
      box(0.07, 0.13, 0.02, 0x3a2a1a, x + Math.sin(ry) * (d / 2), by, z + Math.cos(ry) * (d / 2), ry, 1); // a door
    };
    const tower = (x: number, z: number, r: number, h: number, roofTone: number): void => {
      cyl(r * 1.08, h, STONE, x, 0, z, 10, r);
      cyl(r * 1.2, 0.1, DARK, x, h, z, 10, r * 1.2);
      if (desert) for (let k = 0; k < 6; k++) box(0.07, 0.09, 0.07, STONE, x + Math.cos(k * 1.047) * r * 1.05, h + 0.1, z + Math.sin(k * 1.047) * r * 1.05, -k * 1.047, 1);
      else cone(r * 1.3, r * 2, roofTone, x, h + 0.1, z);
    };
    const wall = (x0: number, z0: number, x1: number, z1: number, h: number): void => {
      const len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      box(len, h, 0.13, STONE, mx, 0, mz, ry);
      for (let k = 0; k < 4; k++) { const f = (k + 0.5) / 4 - 0.5; box(len / 9, 0.08, 0.15, STONE, mx + (x1 - x0) * f, h, mz + (z1 - z0) * f, ry, 1); } // battlements
    };
    if (t.capital >= 0) {
      cyl(2.05, 0.05, EARTH, 0, 0, 0, 22);
      // A ring of wall with a tower at every other corner and a gatehouse facing the road.
      const n = 10, R = 1.95, pt = (k: number): [number, number] => [Math.cos((k / n) * 6.283 + 0.314) * R, Math.sin((k / n) * 6.283 + 0.314) * R * 0.86];
      for (let k = 0; k < n; k++) { const [ax, az] = pt(k), [bx, bz] = pt(k + 1); if (k !== 1) wall(ax, az, bx, bz, 0.5); if (k % 2 === 0) tower(ax, az, 0.2, 0.82, ROOF); }
      const [gx0, gz0] = pt(1), [gx1, gz1] = pt(2), gx = (gx0 + gx1) / 2, gz = (gz0 + gz1) / 2;
      box(0.62, 0.8, 0.3, STONE, gx, 0, gz); box(0.26, 0.42, 0.32, 0x2a2018, gx, 0, gz, 0, 1); box(0.7, 0.09, 0.36, DARK, gx, 0.8, gz, 0, 1);
      // The keep: a great hall with corner turrets under a roof in the people's colour.
      box(0.95, 0.95, 0.8, STONE, 0, 0.05, -0.25);
      for (const [dx, dz] of [[-0.48, -0.65], [0.48, -0.65], [-0.48, 0.15], [0.48, 0.15]]) tower(dx, dz, 0.14, 1.25, banner);
      if (desert) parts.push(put(tinted(new THREE.SphereGeometry(0.42, 12, 7, 0, 6.283, 0, 1.5708), banner, 0.75), 0, 1.0, -0.25));
      else parts.push(put(tinted(gable(1.05, 0.5, 0.92), banner, 0.75), 0, 1.0, -0.25));
      cyl(0.03, 0.75, TIMBER, 0, 1.4, -0.25, 5);
      // Streets of houses inside the wall, a well in the square.
      for (let k = 0; k < 11; k++) { const a = 0.5 + (k / 11) * 5.6, d = 1.05 + rnd(k) * 0.5; house(Math.cos(a) * d, 0.05, Math.sin(a) * d * 0.82 + 0.1, a + 1.57 + (rnd(k + 20) - 0.5), 0.3 + rnd(k + 40) * 0.14, 0.26, 0.2 + rnd(k + 60) * 0.1, k % 4 === 0 ? THATCH : ROOF); }
      cyl(0.09, 0.1, DARK, 0.1, 0.05, 0.75, 8);
    } else if (t.buildings.includes('fortress')) {
      // A castle: four walls, four towers, a keep.
      const c4: [number, number][] = [[-0.85, -0.7], [0.85, -0.7], [0.85, 0.7], [-0.85, 0.7]];
      c4.forEach(([ax, az], k) => { const [bx, bz] = c4[(k + 1) % 4]; wall(ax, az, bx, bz, 0.5); tower(ax, az, 0.2, 0.85, ROOF); });
      box(0.7, 1.05, 0.6, STONE, 0, 0, -0.1); if (desert) box(0.78, 0.08, 0.68, DARK, 0, 1.05, -0.1, 0, 1); else parts.push(put(tinted(gable(0.8, 0.4, 0.7), ROOF, 0.75), 0, 1.05, -0.1));
      box(0.24, 0.36, 0.14, 0x2a2018, 0, 0, 0.7, 0, 1);
    } else {
      // A hamlet: a few cottages, a haystack, a fence.
      for (let k = 0; k < 3; k++) house(-0.45 + k * 0.5 + (rnd(k) - 0.5) * 0.2, 0, -0.2 + (rnd(k + 5) - 0.5) * 0.6, (rnd(k + 9) - 0.5) * 1.6, 0.36, 0.28, 0.2, THATCH);
      if (!desert) cone(0.13, 0.2, 0xd8b85a, 0.55, 0, 0.35, 8);
    }
    // What has been built on the land stands round it.
    t.buildings.filter((b) => b !== 'fortress').forEach((b, k) => {
      const a = 2.2 + k * 1.15, hx = Math.cos(a) * 2.75 + (t.capital >= 0 ? 0 : -0.9), hz = Math.sin(a) * 2.2 + 1.2;
      const by = Math.max(0.2, this.heightAt(t.x - 26 + (hx * 1.6) / K, t.y - 6 + (hz * 1.6) / K)) / 1.6 - y / 1.6;
      if (b === 'farm') {
        house(hx, by, hz, 0.5, 0.5, 0.34, 0.26, 0x8a3a2a); // the barn
        for (let f = 0; f < 3; f++) cone(0.1, 0.16, 0xd8b85a, hx + 0.45 + f * 0.2, by, hz + 0.2 - f * 0.12, 7);
        for (let f = 0; f < 5; f++) box(0.02, 0.1, 0.02, TIMBER, hx - 0.5 + f * 0.25, by, hz + 0.45, 0, 1);
        box(1.05, 0.02, 0.02, TIMBER, hx, by + 0.07, hz + 0.45, 0, 1);
      } else if (b === 'barracks') {
        house(hx, by, hz, 0.2, 0.75, 0.34, 0.28, ROOF);
        for (let f = 0; f < 6; f++) cone(0.035, 0.3, TIMBER, hx - 0.5 + f * 0.2, by, hz + 0.42, 5); // a palisade
        box(0.05, 0.3, 0.05, TIMBER, hx + 0.55, by, hz + 0.1, 0, 1); box(0.3, 0.04, 0.04, TIMBER, hx + 0.55, by + 0.26, hz + 0.1, 0, 1); // a practice post
      } else if (b === 'harbour') {
        house(hx, by, hz, 0, 0.4, 0.3, 0.22, THATCH);
        box(0.9, 0.05, 0.16, TIMBER, hx + 0.1, by + 0.02, hz + 0.4, 0.2, 1);
        for (let f = 0; f < 3; f++) cyl(0.025, 0.2, 0x4a3420, hx - 0.25 + f * 0.35, by - 0.1, hz + 0.47 + f * 0.07, 5);
        box(0.36, 0.09, 0.13, 0x5a3c22, hx + 0.55, by, hz + 0.62, 0.5, 1);
      } else {
        house(hx, by, hz, 0.3 + k, 0.55, 0.36, 0.3, b.includes('stable') ? THATCH : ROOF);
        box(0.3, 0.16, 0.24, PLASTER, hx + 0.42, by, hz + 0.05, 0.3 + k); if (!desert) parts.push(put(tinted(gable(0.36, 0.14, 0.32), THATCH, 0.8), hx + 0.42, by + 0.16, hz + 0.05, 0.3 + k));
      }
    });
    return mergeGeometries(parts)!;
  }

  /** Lay the borders over the painted ground: each land edged in the colour of whoever holds it, the chosen land lit, marauder country darkened. */
  private repaint(c: Campaign, sel: number, reach: Set<number>): void {
    const ctx = this.over.getContext('2d')!, img = ctx.createImageData(MAP_W, MAP_H), D = img.data, cell = this.cell, edge = this.edge, W = this.water;
    const tint = c.territories.map((t) => { const col = t.owner >= 0 ? c.factions[t.owner].color : -1; return [col >> 16 & 255, col >> 8 & 255, col & 255, col < 0 ? 0 : 1, t.horde && t.owner < 0 ? 1 : 0, t.id === sel ? 1 : 0, reach.has(t.id) ? (t.owner === 0 ? 1 : 2) : 0]; });
    let r = 0, g = 0, b = 0, a = 0;
    const lay = (cr: number, cg: number, cb: number, ca: number): void => { const n = ca + a * (1 - ca); if (n > 0) { r = (cr * ca + r * a * (1 - ca)) / n; g = (cg * ca + g * a * (1 - ca)) / n; b = (cb * ca + b * a * (1 - ca)) / n; } a = n; };
    for (let i = 0, o = 0; i < cell.length; i++, o += 4) {
      const t = tint[cell[i]], e = edge[i];
      r = g = b = a = 0;
      if (!W[i]) {
        if (t[4]) lay(10, 8, 6, 0.5);
        if (t[5]) lay(255, 250, 230, 0.14);
        if (t[6] === 1) lay(255, 255, 255, 0.1); else if (t[6] === 2) lay(220, 40, 30, 0.13);
        if (t[3]) lay(t[0], t[1], t[2], 0.05 + 0.62 * (1 - Math.min(1, e / 15)) ** 1.6);
        if (e < 2.2) lay(t[3] ? t[0] * 0.4 : 20, t[3] ? t[1] * 0.4 : 16, t[3] ? t[2] * 0.4 : 10, (t[3] ? 0.7 : 0.42) * (1 - smooth(1.1, 2.2, e)));
      } else if (e < 1.6) lay(10, 30, 40, 0.14 * (1 - smooth(0.8, 1.6, e)));
      D[o] = r; D[o + 1] = g; D[o + 2] = b; D[o + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
    this.overTex.needsUpdate = true;
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

      // The place itself: a walled city for a capital, a castle where the land is fortified, a hamlet anywhere people live.
      const { warm, wet } = climateAt(c.seed, t.x, t.y);
      const style = warm < 0.31 ? 'snow' : warm > 0.66 && wet < 0.56 ? 'desert' : 'green';
      const sig = [t.capital, t.owner >= 0 ? c.factions[t.owner].color : -1, t.buildings.join(), style].join('|');
      let town = this.towns.get(t.id);
      if (!town || town.sig !== sig) {
        town?.mesh.geometry.dispose();
        town = { sig, mesh: new THREE.Mesh(this.buildTown(t, style, t.capital >= 0 ? c.factions[t.capital].color : 0x9a4a34, y), this.townMat) };
        town.mesh.castShadow = true; town.mesh.receiveShadow = true;
        this.towns.set(t.id, town);
      }
      town.mesh.position.set(X - 3.4, y, Z - 0.8);
      town.mesh.scale.setScalar(1.6);
      this.pieces.add(town.mesh);
      if (t.capital >= 0) { const pole = new THREE.Group(); pole.position.set(X - 3.4, y, Z - 0.8); pole.scale.setScalar(1.6); flagOn(pole, 0, 2.55, 0, c.factions[t.capital].color, 1); this.pieces.add(pole); }
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
      holder.position.set(X + 2.6, Math.max(0.2, this.heightAt(t.x + 2.6 / K, t.y + 2.4 / K)), Z + 2.4);
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
