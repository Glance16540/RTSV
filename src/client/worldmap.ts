// The campaign map in three dimensions: a table-top country seen from above and to one side. The land rises out
// of a sea, mountains stand up where the ground is high, woods are stands of small trees, capitals are walled
// towns, armies are figures under a standard, and weather passes overhead as cloud with rain, snow or dust
// falling from it. The chart drawn by the map screen (borders, washes of colour, roads) is laid over the ground
// as its paint.

import * as THREE from 'three';
import { Campaign, EVENTS, LOCALS, MAP_H, MAP_W, ageOf, armyAt, armySize, eventsAt, frontsOf, slots } from '../sim/campaign';
import { lookOf } from './models';
import { RealPerson, loadPeople, makePerson, outfitFor, peopleReady, play } from './person';

/** Map points to a unit of the world. */
const K = 0.1;
const WX = (px: number): number => px * K - (MAP_W * K) / 2;
const WZ = (py: number): number => py * K - (MAP_H * K) / 2;
const STEP = 4; // map points between heights

const hash = (x: number, y: number): number => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const smooth = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export interface Glyph { kind: string; x: number; y: number; s: number }

export class WorldMap {
  readonly canvas: HTMLCanvasElement;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.5, 600);
  private ground: THREE.Mesh;
  private paintTex: THREE.CanvasTexture | null = null;
  private heights: Float32Array;
  private gw: number; private gh: number;
  /** Everything that is rebuilt when the campaign changes: towns, armies, names, marks. */
  private pieces = new THREE.Group();
  private people: RealPerson[] = [];
  private flags: THREE.Object3D[] = [];
  private rings: { m: THREE.Mesh; live: boolean }[] = [];
  private bobs: THREE.Object3D[] = [];
  /** Names and numbers, which are drawn larger the farther back the eye stands, so they can still be read. */
  private labels: { s: THREE.Sprite; w: number; h: number }[] = [];
  private clouds: { g: THREE.Group; fall: THREE.Points; kind: string; r: number }[] = [];
  private tx = 0; private tz = -2; private dist = 110;
  private clock = new THREE.Clock();
  private fit = 110;
  private moved = false;
  private raf = 0;
  private c: Campaign;
  private last: { sel: number; reach: Set<number> } = { sel: -1, reach: new Set() };
  private textures: THREE.Texture[] = [];

  constructor(private host: HTMLElement, c: Campaign, private cell: Uint8Array, edge: Float32Array, glyphs: Glyph[], private onPick: (tid: number) => void) {
    this.c = c;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'ow-gl';
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x101820);
    this.scene.fog = new THREE.Fog(0x1a2a38, 150, 320);
    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x6a5a48, 1.25));
    const sun = new THREE.DirectionalLight(0xffe8c8, 2.6);
    sun.position.set(-46, 70, 34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -62; sc.right = 62; sc.top = 44; sc.bottom = -44; sc.near = 5; sc.far = 220;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.06;
    this.scene.add(sun, sun.target);

    // ---- the lie of the land: a height for every few points of the map ----
    const gw = (this.gw = Math.floor(MAP_W / STEP) + 1), gh = (this.gh = Math.floor(MAP_H / STEP) + 1);
    const H = (this.heights = new Float32Array(gw * gh));
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const px = Math.min(MAP_W - 1, i * STEP), py = Math.min(MAP_H - 1, j * STEP), ci = py * MAP_W + px;
      const t = c.territories[cell[ci]];
      // The country stands out of the sea: its edge is a ragged shore.
      const rim = Math.min(px, py, MAP_W - 1 - px, MAP_H - 1 - py);
      const shore = smooth(10, 46, rim + (noise(px * 0.02, py * 0.02) - 0.5) * 44 - (t.trait === 'coast' ? 16 : 0));
      const roll = 0.55 + noise(px * 0.012, py * 0.012) * 0.7 + noise(px * 0.05, py * 0.05) * 0.18;
      // Mountains where the land is high, clear of the middle where its town and its army stand.
      const high = t.trait === 'hills' ? 6.2 : t.trait === 'gold' ? 4.2 : 0;
      let m = 0;
      if (high) {
        const ridge = 1 - Math.abs(noise(px * 0.035 + 7, py * 0.035 + 3) * 2 - 1);
        const inside = smooth(5, 34, edge[ci]) * smooth(34, 78, Math.hypot(px - t.x, py - (t.y + 6)));
        m = inside * (ridge * ridge * high + noise(px * 0.09, py * 0.09) * 0.9);
      }
      H[j * gw + i] = shore * (roll + m) - (1 - shore) * 1.6;
    }
    const geo = new THREE.PlaneGeometry(MAP_W * K, MAP_H * K, gw - 1, gh - 1).rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position'), col = new Float32Array(pos.count * 3);
    for (let n = 0; n < pos.count; n++) {
      const h = H[n];
      pos.setY(n, h);
      // Bare rock on the steep high ground, snow on the heads of the mountains, wet sand at the shore.
      const rock = smooth(2.3, 3.4, h), snow = smooth(4.3, 5.2, h), sand = 1 - smooth(-0.2, 0.5, h);
      const grass = (1 - rock) * (1 - sand) * 0.14; // a breath of green on the low country
      const r = 1 + rock * -0.24 + snow * 0.62 - sand * 0.1 - grass, g = 1 + rock * -0.25 + snow * 0.66 - sand * 0.06 + grass * 0.1, b = 1 + rock * -0.22 + snow * 0.8 + sand * 0.02 - grass * 1.3;
      col[n * 3] = r; col[n * 3 + 1] = g; col[n * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true }));
    this.ground.receiveShadow = true;
    this.ground.castShadow = true;
    this.scene.add(this.ground);
    // The sea all round, and the table it lies on far below.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 420).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f6a86, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.95 }));
    sea.position.y = 0;
    sea.receiveShadow = true;
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(520, 420).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c3e52, roughness: 1 }));
    bed.position.y = -1.7;
    this.scene.add(sea, bed);

    // ---- woods: small trees wherever the chart marks them ----
    const firs: THREE.Matrix4[] = [], rounds: THREE.Matrix4[] = [], mt = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    for (const gph of glyphs) {
      if (gph.kind !== 'tree' && gph.kind !== 'fir') continue;
      for (let k = 0; k < 7; k++) {
        const px = gph.x + (hash(gph.x + k, gph.y) - 0.5) * 34, py = gph.y + (hash(gph.x, gph.y + k * 3) - 0.5) * 30;
        if (px < 4 || py < 4 || px > MAP_W - 4 || py > MAP_H - 4) continue;
        const h = this.heightAt(px, py);
        if (h < 0.35 || h > 2.4) continue;
        const s = 0.55 + hash(px, py) * 0.5;
        mt.compose(v.set(WX(px), h, WZ(py)), q, sv.set(s, s * (0.9 + hash(py, px) * 0.5), s));
        (gph.kind === 'fir' ? firs : rounds).push(mt.clone());
      }
    }
    const stand = (g: THREE.BufferGeometry, color: number, list: THREE.Matrix4[]): void => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }), list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im);
    };
    stand(new THREE.ConeGeometry(0.42, 1.5, 6).translate(0, 0.85, 0), 0x3f5e3a, firs);
    stand(new THREE.IcosahedronGeometry(0.55, 0).translate(0, 0.75, 0), 0x5c7a3c, rounds);

    // ---- the weather: a bank of cloud for each front, and what falls from it ----
    for (const f of frontsOf(c)) this.addCloud(f.kind, f.r * K, WX(f.x), WZ(f.y));

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
      this.tx = Math.min(50, Math.max(-50, down.tx - dx * k));
      this.tz = Math.min(30, Math.max(-30, down.tz - dy * k * 1.3));
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
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.moved = true; this.dist = Math.min(this.fit * 1.1, Math.max(22, this.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
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

  /** Lay the painted chart over the ground. */
  setSheet(sheet: HTMLCanvasElement): void {
    if (!this.paintTex) {
      this.paintTex = new THREE.CanvasTexture(sheet);
      this.paintTex.colorSpace = THREE.SRGBColorSpace;
      this.paintTex.anisotropy = 8;
      (this.ground.material as THREE.MeshStandardMaterial).map = this.paintTex;
      (this.ground.material as THREE.MeshStandardMaterial).needsUpdate = true;
    }
    this.paintTex.needsUpdate = true;
  }

  private resize(): void {
    const w = Math.max(200, this.host.clientWidth), h = Math.max(200, this.host.clientHeight);
    this.gl.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Far enough back to take in the whole country, the first time and whenever the window changes shape.
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    this.fit = Math.max(63 / (half * this.camera.aspect), 38 / half);
    if (!this.moved) this.dist = this.fit;
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
    this.people = []; this.flags = []; this.rings = []; this.bobs = []; this.labels = [];
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
        const bad = e.kind === 'unrest' || e.kind === 'revolt' || e.kind === 'fever' || e.kind === 'raiders' || e.kind === 'hard';
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
      const color = a ? c.factions[a.owner].color : LOCALS.color;
      const piece = new THREE.Group();
      piece.position.set(X + 0.8, y, Z + 1.8);
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
            this.people.push(made.real);
          } else {
            add(new THREE.CylinderGeometry(0.16, 0.26, 1.2, 8), solid(color), px, 0.88, pz, piece);
            add(new THREE.SphereGeometry(0.2, 10, 8), solid(0xe0b890), px, 1.66, pz, piece);
          }
        });
        if (a.moved && c.phase === 'player') piece.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && m.color && (o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh) { m.transparent = true; m.opacity = 0.55; } });
      } else {
        for (const [dx, dz] of [[-0.3, 0.1], [0.4, -0.25]]) add(new THREE.ConeGeometry(0.42, 0.62, 6), solid(0x8a7250), dx, 0.59, dz, piece);
      }
      this.pieces.add(piece);
      // Its numbers, on a shield in its colour that always faces whoever is looking.
      const shield = this.sprite((x, w, h) => {
        x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, 8); x.lineTo(w - 8, h * 0.5); x.quadraticCurveTo(w - 12, h * 0.82, w / 2, h - 6); x.quadraticCurveTo(12, h * 0.82, 8, h * 0.5); x.closePath();
        x.fillStyle = '#' + color.toString(16).padStart(6, '0'); x.fill(); x.lineWidth = 7; x.strokeStyle = a ? '#fff4d8' : '#5a4a30'; x.stroke(); x.lineWidth = 2.5; x.strokeStyle = '#2a1c0c'; x.stroke();
        x.font = '700 50px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.strokeText(String(n), w / 2, h * 0.45); x.fillStyle = '#fff'; x.fillText(String(n), w / 2, h * 0.45);
        if (a?.hero) { x.font = '34px serif'; x.fillStyle = '#f6d860'; x.strokeStyle = '#3a2c18'; x.lineWidth = 5; x.strokeText('♛', w / 2, 2); }
      }, 96, 112, a ? 2.5 : 1.9);
      shield.position.set(X + 3.9, y + (a ? 2.2 : 1.6), Z + 2.8);
      this.pieces.add(shield);
    }
  }

  private frame(): void {
    const dt = Math.min(0.1, this.clock.getDelta()), now = this.clock.elapsedTime;
    const pitch = 0.92;
    this.camera.position.set(this.tx, Math.sin(pitch) * this.dist, this.tz + Math.cos(pitch) * this.dist);
    this.camera.lookAt(this.tx, 0, this.tz);
    const grow = Math.min(1.6, Math.max(1, this.dist / 62));
    for (const l of this.labels) l.s.scale.set(l.w * grow, l.h * grow, 1);
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
