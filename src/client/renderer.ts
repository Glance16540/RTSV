// Three.js scene: terrain, fog of war, entity meshes and the RTS camera.

import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import { Building, Entity, Game, GameEvent, ResourceNode, Unit } from '../sim/game';
import { buildScenery, Scenery } from './scenery';
import { Job, lookOf, makeBuilding, makeResource, makeShot, makeUnit, ofPeople, mat, RES_COLOR } from './models';
import { leaningOf } from './assets';
import { Roads } from './roads';
import { Weather } from './weather';
import { Life } from './life';
import { Beast, BeastKind, beastReady, gait, loadBeasts, makeBeast } from './beast';
import { Outfit, RealPerson, leaderOutfit, astride, bear, embrace, drawnReal, sprawl, wounds, hold, lasts, level, loadPeople, makePerson, outfitFor, peopleReady, play, roleOutfit } from './person';
import { acacia, birch, fir, oak, palm } from './flora';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { INK, RAMP, WALL_DIRS } from './shapes';
import { Sky } from './sky';
import { Flame, NightLights, carriesTorch } from './nightlight';
import { CampScenes } from './campscene';
import { canCarryTorch, carryTorch, dropTorch, torchTip } from './torch';

/** How steeply the camera looks down. `?pitch=20` (degrees) lowers it, for looking at figures from the side. */
export const PITCH = ((Number(new URLSearchParams(location.search).get('pitch')) || 50) * Math.PI) / 180;
export const YAW = Math.PI / 4; // the map appears as a diamond, like the classic isometric RTS view
const FOV = 30;

/** One figure in a work camp's yard: a captive on their round, or a Slaver on guard. */
interface CampFig { real?: RealPerson; g: THREE.Group; woman: boolean; guard: boolean; i: number; goal: 'out' | 'work' | 'in'; wait: number; in: boolean }
interface UnitView { g: THREE.Group; phase: number; legs: THREE.Object3D[]; type: string; work: number; job: Job; wear: number; hp: number; flesh: boolean; cls: string; naval: boolean; /** A rider in the saddle, and the height they sit at. */ seat?: THREE.Object3D; seatY?: number; /** A Slaver's prisoner, led behind on a rope. */ led?: { g: THREE.Group; rope: THREE.Mesh; real: RealPerson }; /** Drawn from the real human figure, not from blocks. */ real?: RealPerson; /** Riders and drivers drawn from the real figure, on a mount or car that is still built of blocks. */ riders?: { p: RealPerson; astride: boolean }[]; /** Animals drawn from the real figures: a mount under its rider, or the unit itself. */ beasts?: Beast[]; /** The whole unit is one such animal. */ wildlife?: boolean }
/** A drop of blood in the air, or a chip of wood from an engine or a hull. */
interface Drop { m: THREE.Mesh; vx: number; vy: number; vz: number; blood: boolean }
interface Stain { m: THREE.Mesh; t: number; grow: number; life: number }
interface Dying { g: THREE.Group; t: number; v: UnitView }
const BLOOD = 0x7a0c10;
interface Floater { x: number; y: number; text: string; t: number }
interface Ping { mesh: THREE.Mesh; t: number }
/** A piece of a fallen building, thrown clear and left to tumble. */
interface Rubble { m: THREE.Object3D; vx: number; vy: number; vz: number; spin: THREE.Vector3; t: number; wait: number; ground: number; rest: boolean }
interface Dust { m: THREE.Mesh; t: number }

export class Renderer {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  gl: THREE.WebGLRenderer;
  // Camera target on the ground and distance from it.
  cx: number;
  cy: number;
  dist = 30;
  /** The main menu's camera: it circles low over the town, where the game's own looks down from a fixed quarter. */
  cine: { yaw: number; pitch: number; gaze?: number; low?: number } | null = null;
  /** How dark the unexplored land is drawn, 1 in play. The main menu lifts it so the country can be seen. */
  fogScale = 1;
  private skyC = new THREE.Color(0x0b0d10);
  /** The player's setting: whether lamps and torches cast real light by night, or only show their glow. */
  lamplight = true;
  private heaven!: Sky;
  private nightLights!: NightLights;
  private lampAt = new THREE.Vector3();
  floaters: Floater[] = [];

  private sun: THREE.DirectionalLight;
  private unitViews = new Map<number, UnitView>();
  private buildingViews = new Map<number, THREE.Group>();
  private resViews = new Map<number, THREE.Group>();
  private treeIndex = new Map<number, { ims: THREE.InstancedMesh[]; i: number }>();
  /** Every instanced part of the forest; a felled tree is hidden in each. */
  private forest: THREE.InstancedMesh[] = [];
  private scenery!: Scenery;
  private haze = new THREE.Fog(0x9fb0c4, 60, 160);
  private fogTex!: THREE.DataTexture;
  private misted = false;
  private fogAlpha: Float32Array;
  private rings: THREE.Mesh[] = [];
  /** What is in the air, each with its own shape, and where it will come down. */
  private shots = new Map<object, { g: THREE.Group; kind: string; tx: number; ty: number; seen: number; spin: number }>();
  private shotTick = 0;
  private pings: Ping[] = [];
  private ghost: THREE.Group | null = null;
  private ghostType = '';
  private ghostOk = true;
  private rally: THREE.Group;
  private ray = new THREE.Raycaster();
  private v3 = new THREE.Vector3();
  private clock = 0;
  private wallTick = -1;
  private nightC = new THREE.Color(0x1c2440);
  private duskC = new THREE.Color(0xf0b088);
  private lowSunC = new THREE.Color(0xff8a4a);
  /** How red the light is, 0 at midday to 1 at dawn and dusk. */
  dayWarm = 0;
  private glowTex: THREE.Texture | null = null;
  private moonC = new THREE.Color(0x8fa8ff);
  /** `?fog=0`: the whole map is shown, for looking at the game rather than playing it. */
  private noFog = new URLSearchParams(location.search).get('fog') === '0';
  /** `?motion=0`: the wildlife and the hearth smoke are left out, for quicker still pictures. */
  private still = new URLSearchParams(location.search).get('motion') === '0';
  private shake = 0;
  private dying: Dying[] = [];
  private drops: Drop[] = [];
  private stains: Stain[] = [];
  /** Blood, wounds and bodies. Off with ?gore=0. */
  private gore = new URLSearchParams(location.search).get('gore') !== '0';
  private dropGeo = new THREE.SphereGeometry(0.03, 5, 4);
  private stainGeo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
  private bloodMat = new THREE.MeshBasicMaterial({ color: BLOOD });
  private chipMat = new THREE.MeshBasicMaterial({ color: 0x8a6238 });
  private rubble: Rubble[] = [];
  /** Gear knocked off someone, by the piece it is a copy of, so it can be taken up again if they are healed. */
  private dropped = new WeakMap<THREE.Object3D, THREE.Object3D>();
  private roads!: Roads;
  private weather!: Weather;
  private sky!: THREE.HemisphereLight;
  private tintC = new THREE.Color();
  private staffViews = new Map<number, { key: string; g: THREE.Group; figs: { g: THREE.Group; role: string; seed: number; real: RealPerson }[] }>();
  private dust: Dust[] = [];
  private life!: Life;
  private hearthT = 0;
  private campViews = new Map<number, { key: string; g: THREE.Group; figs: CampFig[] }>();
  /** How far into night it is, 0 by day to 1 in full dark, eased through dusk and dawn. */
  private nightAmt = 0;
  /** Rescues, risings and escapes at the work camps, drawn at their gates. */
  private campScenes!: CampScenes;
  /** Who holds each unit's torch: the first of its figures that can, or null where none of them has a hand free. */
  private torchBy = new Map<number, RealPerson | null>();
  private frameDt = 0.016;
  /** Hearts that rise from where a decadent town is busy at its pleasures. */
  private hearts: { m: THREE.Mesh; t: number; sway: number }[] = [];
  private heartGeo?: THREE.BufferGeometry;
  /** Draws the ink edge around everything standing in the world. Off with ?outline=0. */
  private ink: OutlineEffect | null = null;
  private inked = 0;
  private area: THREE.Mesh;

  constructor(public canvas: HTMLCanvasElement, private game: Game) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x0b0d10);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
    const st = game.spec.starts[game.humanId];
    this.cx = st.x;
    this.cy = st.y;

    // A low warm sun against a cool sky: long soft shadows, and shape on everything that stands up.
    if (new URLSearchParams(location.search).get('outline') !== '0') this.ink = new OutlineEffect(this.gl, { defaultThickness: INK.thickness, defaultColor: INK.color });
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.02;
    this.scene.fog = this.haze;
    this.sky = new THREE.HemisphereLight(0xd6e6ff, 0x8a7858, 1.55);
    this.scene.add(this.sky);
    this.sun = new THREE.DirectionalLight(0xffe2b4, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.sun.shadow.radius = 2.5;
    const fill = new THREE.DirectionalLight(0xa8c0ec, 0.9); // sky light from the shadow side, so shade is blue, not black
    fill.position.set(40, 30, -30);
    this.scene.add(fill);
    this.scene.add(this.sun, this.sun.target);

    this.fogAlpha = new Float32Array(game.size * game.size).fill(1);
    this.scenery = buildScenery(game.size, game.terrain, game.spec.height, game.climate, game.resources.filter((r) => r.type === 'tree'));
    this.scene.add(this.scenery.group);
    this.roads = new Roads(game, this.scenery, this.scene);
    this.weather = new Weather(this.scene, game.climate);
    this.life = new Life(this.scene, game, (x, y) => this.scenery.heightAt(x, y));
    this.life.fogged = !this.noFog;
    loadPeople(); loadBeasts();
    this.buildTrees();
    this.buildFog();
    this.heaven = new Sky(this.glow());
    this.scene.add(this.heaven.group);
    this.nightLights = new NightLights(this.scene, this.glow());
    this.campScenes = new CampScenes();

    this.area = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color: 0xb48cff, transparent: true, opacity: 0.9, depthTest: false }));
    this.area.rotation.x = -Math.PI / 2;
    this.area.renderOrder = 60;
    this.area.visible = false;
    this.scene.add(this.area);

    this.rally = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), mat(0xf0f0f0));
    pole.position.y = 0.6;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.5), mat(0xffd34a, 0x806000));
    cloth.position.set(0, 1.05, 0.27);
    this.rally.add(pole, cloth);
    this.rally.visible = false;
    this.scene.add(this.rally);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- Static scenery ----

  private buildTrees(): void {
    const trees = this.game.resources.filter((r) => r.type === 'tree');
    const cl = this.game.climate;
    const inked = (color: number): THREE.Material => { const mt = new THREE.MeshToonMaterial({ color, gradientMap: RAMP, vertexColors: true }); mt.userData.outlineParameters = INK; return mt; };
    const make = (g: THREE.BufferGeometry, mt: THREE.Material, n: number) => {
      const im = new THREE.InstancedMesh(g, mt, Math.max(1, n));
      im.count = n;
      im.castShadow = im.receiveShadow = true;
      this.forest.push(im);
      return im;
    };
    // Two shapes of each kind, so no two neighbours are quite alike.
    const kinds = { oak: [oak(1), oak(2)], birch: [birch(3), birch(4)], fir: [fir(5), fir(6)], palm: [palm(7), palm(8)], acacia: [acacia(9), acacia(10)] };
    const mesh: Record<string, { trunk: THREE.InstancedMesh; leaf: THREE.InstancedMesh; snow?: THREE.InstancedMesh }[]> = {};
    const leafM = new THREE.MeshToonMaterial({ color: 0xa0a0a0, gradientMap: RAMP, vertexColors: true, side: THREE.DoubleSide });
    leafM.userData.outlineParameters = { visible: false }; // fronds are thin: an inked edge would swallow them
    // Stands of one kind with others among them, more of one or the other from grove to grove.
    const kindOf = (t: { id: number; x: number; y: number }): string => {
      const h3 = ((t.id * 7919) % 1000) / 1000, h4 = ((t.id * 104729) % 1000) / 1000, grove = 0.5 + 0.35 * Math.sin(t.x * 0.13 + t.y * 0.09);
      return cl === 'desert' ? (h3 < 0.55 + (grove - 0.5) * 0.6 ? 'palm' : 'acacia')
        : cl === 'snow' ? (h3 < 0.85 ? 'fir' : 'birch')
          : cl === 'steppe' ? (h3 < 0.12 ? 'fir' : h3 < 0.5 ? 'acacia' : h3 < 0.8 ? 'oak' : 'birch')
            : h3 < grove ? 'fir' : h4 < 0.7 ? 'oak' : 'birch';
    };
    // Each shape is drawn only as many times as there are trees of it.
    const tally: Record<string, number> = {};
    for (const t of trees) { const key = kindOf(t) + (t.id % 2); tally[key] = (tally[key] ?? 0) + 1; }
    for (const [name, list] of Object.entries(kinds)) mesh[name] = list.map((t, v) => { const n = tally[name + v] ?? 0; return { trunk: make(t.trunk, inked(0x9a9a9a), n), leaf: make(t.leaf, name === 'palm' ? leafM : inked(0xa0a0a0), n), snow: t.snow && cl === 'snow' ? make(t.snow, inked(0xffffff), n) : undefined }; });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    const next: Record<string, number> = {};
    trees.forEach((t) => {
      const h = ((t.id * 2654435761) >>> 0) / 4294967296;
      const h2 = ((t.id * 40503) % 1000) / 1000;
      const h4 = ((t.id * 104729) % 1000) / 1000;
      const kind = kindOf(t), key = kind + (t.id % 2), i = (next[key] = (next[key] ?? -1) + 1);
      const sc = (kind === 'fir' ? 0.95 : kind === 'birch' ? 0.9 : 1) * (0.85 + h * 0.5);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, h * 6.28);
      const tx = t.x + (h2 - 0.5) * 0.3, tz = t.y + (h - 0.5) * 0.3;
      m.compose(new THREE.Vector3(tx, this.scenery.heightAt(tx, tz), tz), q, new THREE.Vector3(sc, sc * (0.9 + h2 * 0.3), sc));
      const part = mesh[kind][t.id % 2];
      part.trunk.setMatrixAt(i, m); part.leaf.setMatrixAt(i, m); part.snow?.setMatrixAt(i, m);
      part.snow?.setColorAt(i, col.setHSL(0.58, 0.2, 0.9 + h * 0.06));
      // Bark: brown, grey on a fir, white on a birch, fibrous tan on a palm.
      part.trunk.setColorAt(i, kind === 'birch' ? col.setHSL(0.1, 0.06, 0.86 + h * 0.08) : kind === 'palm' ? col.setHSL(0.08, 0.3, 0.3 + h * 0.06) : kind === 'fir' ? col.setHSL(0.06, 0.25, 0.17 + h * 0.05) : col.setHSL(0.07, 0.35, 0.2 + h * 0.06));
      // Leaves take the colour of the country, and here and there one has turned early.
      const dry = cl === 'steppe' ? 0.5 : 0;
      if (kind === 'fir') col.setHSL(0.38 + h2 * 0.04, cl === 'snow' ? 0.35 : 0.5, 0.15 + h * 0.06);
      else if (kind === 'palm') col.setHSL(0.26 + h2 * 0.05, 0.55, 0.24 + h * 0.07);
      else if (kind === 'acacia') col.setHSL(0.2 + h2 * 0.05, 0.42, 0.25 + h * 0.07);
      else if (cl === 'snow') col.setHSL(0.58, 0.14, 0.8 + h * 0.08); // boughs loaded with snow
      else if (!dry && h4 > 0.95) col.setHSL(0.1 + h2 * 0.05, 0.75, 0.36); // turned gold
      else if (kind === 'birch') col.setHSL(0.24 - dry * 0.06 + h2 * 0.05, 0.6 - dry * 0.2, 0.3 + h * 0.08);
      else col.setHSL(0.29 - dry * 0.08 + h2 * 0.06, 0.6 - dry * 0.2, 0.2 + h * 0.08);
      part.leaf.setColorAt(i, col);
      this.treeIndex.set(t.id, { ims: [part.trunk, part.leaf, ...(part.snow ? [part.snow] : [])], i });
    });
    this.scene.add(...this.forest);
  }

  private buildFog(): void {
    const N = this.game.size;
    const data = new Uint8Array(N * N * 4);
    this.fogTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.LinearFilter;
    this.fogTex.minFilter = THREE.LinearFilter;
    const geo = new THREE.BufferGeometry();
    const e = 40; // extend past the map edge so the outside is black too
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-e, 0.5, -e, N + e, 0.5, -e, N + e, 0.5, N + e, -e, 0.5, N + e], 3));
    const u0 = -e / N, u1 = 1 + e / N;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, u0, u1, u0, u1, u1, u0, u1], 2));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    const fog = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.fogTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    fog.renderOrder = 100;
    fog.frustumCulled = false;
    fog.visible = !this.noFog;
    this.scene.add(fog);
  }

  private updateFog(dt: number): void {
    const vis = this.game.vis, a = this.fogAlpha, d = this.fogTex.image.data as Uint8Array;
    const k = Math.min(1, dt * 6);
    // Looking out over the land, what is not yet known is lost in mist of the sky's colour, not in blackness.
    const mist = (this.cine?.low ?? 0) * 255, h = this.haze.color, mr = h.r * mist, mg = h.g * mist, mb = h.b * mist;
    const tint = mist > 0 || this.misted;
    this.misted = mist > 0;
    for (let i = 0; i < vis.length; i++) {
      const target = vis[i] === 2 ? 0 : vis[i] === 1 ? 0.45 : 1;
      a[i] += (target - a[i]) * k;
      d[i * 4 + 3] = a[i] * 255 * this.fogScale;
      if (tint) { d[i * 4] = mr; d[i * 4 + 1] = mg; d[i * 4 + 2] = mb; }
    }
    this.fogTex.needsUpdate = true;
  }

  // ---- Camera ----

  moveCamera(dxScreen: number, dyScreen: number): void {
    // Screen right is (+x, -z) and screen up is (-x, -z) on the ground for a 45 degree yaw; it turns with the view.
    const yaw = this.cine?.yaw ?? YAW, c = Math.cos(yaw), s = Math.sin(yaw);
    this.cx += dxScreen * c - dyScreen * s;
    this.cy += -dxScreen * s - dyScreen * c;
    this.clampCamera();
  }

  clampCamera(): void {
    const N = this.game.size;
    this.cx = Math.min(N, Math.max(0, this.cx));
    this.cy = Math.min(N, Math.max(0, this.cy));
    this.dist = Math.min(75, Math.max(14, this.dist));
  }

  private placeCamera(): void {
    const yaw = this.cine?.yaw ?? YAW, pitch = this.cine?.pitch ?? PITCH;
    const h = Math.cos(pitch) * this.dist;
    this.camera.position.set(this.cx + h * Math.sin(yaw), Math.sin(pitch) * this.dist, this.cy + h * Math.cos(yaw));
    const sh = this.shake > 0 ? Math.min(1, this.shake) * 0.12 : 0;
    this.camera.position.x += Math.sin(this.clock * 61) * sh;
    this.camera.position.y += Math.sin(this.clock * 47) * sh;
    // Looking out, the eyes are raised from the ground toward the sky: `gaze` is how far above level they rest.
    const low = this.cine ? this.cine.low ?? 1 : 0, gaze = this.cine?.gaze;
    this.camera.lookAt(this.cx, gaze === undefined ? 0 : low * (this.camera.position.y + Math.tan(gaze) * h), this.cy);
    this.camera.updateMatrixWorld();
    const r = this.dist * 0.72;
    // Haze thickens toward the far edge of the view, and thins out when the camera is close in.
    // Weather draws the haze in, greys it, and takes the edge off the sun.
    const w = this.weather.amount;
    this.haze.near = this.dist * (1.25 - w * 0.75);
    this.haze.far = this.dist * (4.6 - w * 2.5);
    this.haze.color.set(0x9fb0c4).lerp(this.weather.tint(this.tintC), w);
    // Night: the sun gives way to a dim blue light, eased in over dusk and out over dawn. A pitched battle is fought by day.
    const dayT = this.game.field ? 0 : this.game.dayT, ramp = (a: number, b: number, v: number): number => Math.min(1, Math.max(0, (v - a) / (b - a)));
    const n = this.nightAmt = Math.min(ramp(0.66, 0.72, dayT), 1 - ramp(0.96, 1, dayT));
    // The sun crosses the sky from dawn to dusk: low and red at either end with long shadows, high and white at
    // midday. By night the moon stands in another quarter.
    const across = Math.min(1, dayT / 0.7), up = Math.sin(across * Math.PI), warm = (1 - up) * (1 - up) * (1 - n);
    this.dayWarm = warm;
    const sx = -Math.cos(across * Math.PI) * 46, sy = 13 + 34 * up;
    this.sun.position.set(this.cx + sx + (30 - sx) * n, sy + (40 - sy) * n, this.cy + 20 + (-38) * n);
    this.haze.color.lerp(this.duskC, warm * 0.5).lerp(this.nightC, n * 0.75);
    this.sun.intensity = 3.0 * (1 - w * 0.6) * (0.6 + 0.4 * up) * (1 - n * 0.74);
    this.sun.color.set(0xffe2b4).lerp(this.lowSunC, warm * 0.85).lerp(this.moonC, n);
    this.sky.color.set(0xd6e6ff).lerp(this.duskC, warm * 0.45).lerp(this.moonC, n * 0.5);
    this.sky.intensity = 1.55 * (1 - w * 0.18) * (1 - n * 0.6);
    this.gl.toneMappingExposure = 1.02 - n * 0.2;
    // Seen from low down the land runs out to a horizon, so it is lost in mist there and the sky takes the mist's colour.
    this.haze.near += (this.dist * 0.9 - this.haze.near) * low;
    this.haze.far += (this.dist * 2.7 - this.haze.far) * low;
    (this.scene.background as THREE.Color).copy(this.skyC).lerp(this.haze.color, low);
    this.heaven.update(this.camera, { horizon: this.haze.color, sunX: sx, sunZ: 20, up, moonX: 30, moonZ: -18, night: n, warm, weather: w, sunColor: this.sun.color });
    this.sun.target.position.set(this.cx, 0, this.cy);
    const sc = this.sun.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 160;
    sc.updateProjectionMatrix();
  }

  /** By night, gather the lamps and torches in view and let the nearest of them cast real light. */
  private lightNight(): void {
    const lamps: Flame[] = [], torches: Flame[] = [], far = (this.dist * 1.3) ** 2, n = this.nightAmt;
    if (n > 0.02) {
      for (const b of this.game.buildings) {
        const g = this.buildingViews.get(b.id), lamp = (g?.userData.lit as THREE.Object3D[] | undefined)?.[1];
        if (!g || !lamp || !g.visible || !b.complete || (b.x - this.cx) ** 2 + (b.y - this.cy) ** 2 > far) continue;
        const at = lamp.getWorldPosition(this.lampAt);
        lamps.push({ x: at.x, y: at.y + 0.25, z: at.z, id: b.id });
      }
      for (const u of this.game.units) {
        if (u.inside || u.def.naval || !this.game.isMilitary(u) || !carriesTorch(u.id, !!u.hero) || (u.x - this.cx) ** 2 + (u.y - this.cy) ** 2 > far) continue;
        const v = this.unitViews.get(u.id);
        if (!v?.g.visible) continue;
        // The flame sits on the torch in the bearer's hand; a unit with no person drawn keeps it at the shoulder.
        const by = this.torchBy.get(u.id), tip = by ? torchTip(by) : null;
        if (tip) torches.push({ x: tip.x, y: tip.y, z: tip.z, id: u.id, torch: true });
        else if (by === undefined) torches.push({ x: v.g.position.x + 0.22, y: v.g.position.y + 1.25, z: v.g.position.z, id: u.id, torch: true });
      }
    }
    this.nightLights.update(n, this.clock, this.cx, this.cy, lamps, torches, this.lamplight);
  }

  /** A soft round glow, made once. */
  private glow(): THREE.Texture {
    if (this.glowTex) return this.glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!, gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (this.glowTex = new THREE.CanvasTexture(c));
  }

  /** What a building shows by night: a lamp by the door and the warm light it throws on the ground. Each has its own material, so each can gutter on its own. */
  private lights(g: THREE.Group, b: Building): void {
    const mk = (color: number): THREE.MeshBasicMaterial => { const m = new THREE.MeshBasicMaterial({ map: this.glow(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); m.userData.outlineParameters = { visible: false }; return m; };
    const half = b.size / 2;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mk(0xffa850));
    pool.scale.setScalar(b.size * 1.9 + 1.6);
    pool.position.set(half * 0.5, 0.06, half * 0.5);
    pool.userData.k = 0.55;
    pool.renderOrder = 3;
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow(), color: 0xffd080, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    lamp.material.userData.outlineParameters = { visible: false };
    lamp.scale.setScalar(0.55 + b.size * 0.12);
    lamp.position.set(half + 0.08, 0.62, half * 0.55);
    lamp.userData.k = 1;
    pool.visible = lamp.visible = false;
    pool.castShadow = false;
    g.add(pool, lamp);
    g.userData.lit = [pool, lamp];
  }

  /** World ground position under a screen point, at an optional height. */
  groundAt(clientX: number, clientY: number, height = 0): { x: number; y: number } | null {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    if (d.y >= -1e-4) return null;
    // The ground is not flat: step toward where the ray meets it.
    let x = 0, y = 0, lift = 0;
    for (let k = 0; k < 4; k++) {
      const t = (height + lift - o.y) / d.y;
      x = o.x + d.x * t; y = o.z + d.z * t;
      lift = this.scenery.heightAt(x, y);
    }
    return { x, y };
  }

  project(x: number, y: number, h = 0): { x: number; y: number } {
    this.v3.set(x, h + this.scenery.heightAt(x, y), y).project(this.camera);
    return { x: (this.v3.x * 0.5 + 0.5) * window.innerWidth, y: (-this.v3.y * 0.5 + 0.5) * window.innerHeight };
  }

  /** Approximate on-screen pixels per world tile at the camera target. */
  pixelsPerTile(): number {
    return window.innerHeight / (2 * this.dist * Math.tan((FOV * Math.PI) / 360));
  }

  // ---- Entities ----

  isVisible(e: Entity): boolean {
    const g = this.game;
    if (e.kind === 'unit' && e.inside) return false;
    if (this.noFog) return true;
    if (e.owner >= 0 && !g.hostile(e.owner, g.humanId)) return true; // ours or an ally's
    if (e.kind === 'building') return e.seen;
    const v = g.vis[Math.floor(e.y) * g.size + Math.floor(e.x)];
    return e.kind === 'unit' ? v === 2 : v > 0;
  }

  handle(ev: GameEvent): void {
    if (ev.t === 'remove') {
      const u = this.unitViews.get(ev.id);
      if (u) {
        // Fallen units topple over and sink away instead of vanishing.
        if (u.g.visible) this.fall(u);
        else this.scene.remove(u.g);
        this.unitViews.delete(ev.id);
      }
      const b = this.buildingViews.get(ev.id);
      if (b) { if (b.userData.site) this.scene.remove(b.userData.site as THREE.Object3D); if (b.visible && !b.userData.site) this.collapse(b); else this.scene.remove(b); this.buildingViews.delete(ev.id); const sv = this.staffViews.get(ev.id); if (sv) { this.scene.remove(sv.g); this.staffViews.delete(ev.id); } const cv = this.campViews.get(ev.id); if (cv) { this.scene.remove(cv.g); this.campViews.delete(ev.id); } }
      const r = this.resViews.get(ev.id);
      if (r) { this.scene.remove(r); this.resViews.delete(ev.id); }
      const ti = this.treeIndex.get(ev.id);
      if (ti !== undefined) {
        const m = new THREE.Matrix4().makeScale(0, 0, 0);
        for (const im of ti.ims) { im.setMatrixAt(ti.i, m); im.instanceMatrix.needsUpdate = true; }
        this.treeIndex.delete(ev.id);
      }
    } else if (ev.t === 'age') {
      this.roads.relay(); // dirt tracks are paved as a people advances
      // Buildings change appearance with their owner's age.
      for (const [id, g] of this.buildingViews) {
        const b = this.game.entities.get(id);
        if (b && b.owner === ev.player) { this.scene.remove(g); this.buildingViews.delete(id); }
      }
    } else if (ev.t === 'birth' && ev.player === this.game.humanId) {
      this.floaters.push({ x: ev.x, y: ev.y, text: '💗', t: 0 });
    } else if (ev.t === 'grown' && ev.player === this.game.humanId) {
      this.floaters.push({ x: ev.x, y: ev.y, text: '✨', t: 0 });
    } else if (ev.t === 'signal' && !this.game.hostile(ev.player, this.game.humanId)) {
      for (let i = 0; i < 3; i++) setTimeout(() => this.ping(ev.x, ev.y, 0x8ad0ff), i * 250);
    } else if (ev.t === 'quake') {
      if (Math.hypot(ev.x - this.cx, ev.y - this.cy) < this.dist) this.shake = 5;
      for (let i = 0; i < 5; i++) this.ping(ev.x + (Math.random() - 0.5) * 6, ev.y + (Math.random() - 0.5) * 6, 0xc8a070);
    } else if (ev.t === 'plague') {
      for (let i = 0; i < 4; i++) this.ping(ev.x + (Math.random() - 0.5) * 4, ev.y + (Math.random() - 0.5) * 4, 0x9ad04a);
    } else if (ev.t === 'fire' || ev.t === 'blight') {
      for (let i = 0; i < 5; i++) this.ping(ev.x + (Math.random() - 0.5) * 5, ev.y + (Math.random() - 0.5) * 5, ev.t === 'fire' ? 0xff7a2a : 0x8a7a3a);
    }
  }

  ping(x: number, y: number, color: number): void {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 20), new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, this.scenery.heightAt(x, y) + 0.06, y);
    m.renderOrder = 50;
    this.scene.add(m);
    this.pings.push({ mesh: m, t: 0 });
  }

  /** Circle showing where a calamity will land. */
  setAreaMarker(a: { x: number; y: number; r: number } | null): void {
    this.area.visible = !!a;
    if (a) { this.area.position.set(a.x, this.scenery.heightAt(a.x, a.y) + 0.06, a.y); this.area.scale.setScalar(a.r); }
  }

  setGhost(type: string | null, cx = 0, cy = 0, ok = true): void {
    if (!type) {
      if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; this.ghostType = ''; }
      return;
    }
    if (this.ghostType !== type || this.ghostOk !== ok) {
      if (this.ghost) this.scene.remove(this.ghost);
      const s = BUILDINGS[type].size;
      this.ghost = new THREE.Group();
      const model = makeBuilding(type, 0xffffff, this.game.players[this.game.humanId].age, this.game.players[this.game.humanId].civ);
      const gm = new THREE.MeshBasicMaterial({ color: ok ? 0x7dff8a : 0xff5a4a, transparent: true, opacity: 0.55, depthWrite: false });
      model.traverse((o) => { if (o instanceof THREE.Mesh) { o.material = gm; o.castShadow = false; } });
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: ok ? 0x3dff5a : 0xff3020, transparent: true, opacity: 0.3, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = 0.04;
      this.ghost.add(model, pad);
      this.scene.add(this.ghost);
      this.ghostType = type;
      this.ghostOk = ok;
    }
    const s = BUILDINGS[type].size;
    this.ghost!.position.set(cx + s / 2, this.scenery.heightAt(cx + s / 2, cy + s / 2), cy + s / 2);
  }

  private syncUnit(u: Unit, alpha: number, dt: number): void {
    let v = this.unitViews.get(u.id);
    const job = u.type === 'villager' ? this.jobOf(u) : '';
    // A village woman dresses as her town lives: covered where it is pious, laced low where it is decadent.
    const virtue = this.game.players[u.owner].virtue ?? 0, wear = u.type !== 'villager' || u.gender !== 'f' ? 0 : virtue >= 30 ? 1 : virtue <= -70 ? 3 : virtue <= -30 ? 2 : 0;
    let turned: number | null = null;
    const afoot = drawnReal(u.def.cls), real = peopleReady() && afoot;
    const ridden = peopleReady() && (u.def.cls === 'cavalry' || u.def.cls === 'beast' || u.def.cls === 'siege');
    // Wolves, deer and hounds are each one animal, drawn whole from the real figure.
    const animal: BeastKind | null = u.type === 'wolf' ? 'wolf' : u.type === 'hound' ? 'husky' : u.type === 'deer' ? (u.id % 3 === 0 ? 'stag' : 'deer') : null;
    const wild = !!animal && beastReady(animal);
    if (v && (v.type !== u.type || (v.job !== job && !v.real) || v.wear !== wear || real !== !!v.real || (ridden && !v.riders) || (wild && !v.wildlife) || (ridden && !v.beasts && beastReady('horse') && beastReady('wolf') && beastReady('camel') && beastReady('elephant')))) {
      // Re-equipped by an upgrade, or set to a new trade: swap the model.
      turned = v.g.rotation.y;
      this.scene.remove(v.g);
      v = undefined;
    }
    if (!v) {
      ofPeople(this.game.players[u.owner].civ);
      // The leader is dressed as whoever made them chose; everyone else by their kind.
      const lead = u.hero ? this.game.heroOf(u.owner) : null;
      const fit = real ? outfitFor(u.type, lead ? lead.female : u.gender === 'f', this.game.players[u.owner].color, lookOf(this.game.players[u.owner].civ, u.id), u.id, wear, { cls: u.def.cls, age: u.def.age, civ: this.game.players[u.owner].civ }) : null;
      const made = fit ? makePerson(lead ? leaderOutfit(fit, lead.female, lead.look) : fit) : null;
      const creature = wild ? makeBeast(animal!, u.type === 'deer' ? 0.62 : u.type === 'wolf' ? 0.42 : 0.33, u.id, u.type === 'hound' ? 0x7a5a3a : null) : null;
      v = { g: made?.g ?? creature?.g ?? (afoot ? new THREE.Group() : makeUnit(u.type, this.game.players[u.owner].color, u.gender, u.id, job, wear)), phase: (u.id * 1.7) % 6.28, legs: [], type: u.type, work: 0, job, wear, hp: u.hp, flesh: u.def.cls !== 'siege' && !u.def.naval, cls: u.def.cls, naval: !!u.def.naval };
      if (turned !== null) v.g.rotation.y = turned;
      if (creature) { v.beasts = [creature]; v.wildlife = true; }
      v.real = made?.real;
      v.g.traverse((o) => { if (o.userData.leg !== undefined) v!.legs.push(o); });
      if (ridden) this.mount(u, v);
      if (ridden && !creature) this.steeds(u, v);
      v.g.rotation.order = 'YXZ'; // so leaning forward and rocking are in the unit's own frame, whichever way it faces
      this.unitViews.set(u.id, v);
      this.scene.add(v.g);
    }
    const g = v.g;
    g.visible = this.isVisible(u);
    if (u.hp !== v.hp) this.wound(u, v);
    if (!g.visible) return;
    const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
    const swing = u.attackAnim > 0 ? Math.sin((u.attackAnim / 0.35) * Math.PI) : 0;
    const mounted = u.def.cls === 'cavalry' || u.def.cls === 'beast';
    const size = 1;
    let bob = 0, pitch = 0, roll = 0, breathe = 1;
    if (u.def.naval) {
      // Afloat: she rides the swell that is drawn under her, lifting to each crest, pitching and rolling with its slope.
      const sw = (dx: number, dz: number): number => this.scenery.swellAt(x + dx, y + dz, this.clock);
      const fx = Math.sin(g.rotation.y), fz = Math.cos(g.rotation.y), here = sw(0, 0);
      bob = -0.05 + here * 0.07;
      pitch = (sw(fx * 0.6, fz * 0.6) - sw(-fx * 0.6, -fz * 0.6)) * -0.09;
      roll = (sw(fz * 0.4, -fx * 0.4) - sw(-fz * 0.4, fx * 0.4)) * 0.11;
    } else if (u.moving) {
      v.phase += dt * u.def.speed * 5;
      bob = v.real || v.wildlife ? 0 : mounted ? (0.5 - 0.5 * Math.cos(v.phase * 2)) * 0.05 : Math.abs(Math.sin(v.phase)) * 0.06;
      pitch = v.wildlife ? 0 : mounted ? Math.sin(v.phase * 2) * 0.06 : v.real ? 0 : 0.07; // riders rock at the gallop; walkers lean into their stride
      roll = mounted || v.real || v.wildlife ? 0 : Math.sin(v.phase) * 0.05;
    } else {
      breathe = 1 + Math.sin(this.clock * 2.2 + v.phase) * 0.012; // standing, they still breathe
    }
    // A blow is struck with the whole body: a lunge forward and back.
    const lunge = u.def.naval || u.def.cls === 'siege' || v.real || v.wildlife ? 0 : swing * 0.14;
    pitch += u.def.naval || u.def.cls === 'siege' || v.real || v.wildlife ? 0 : u.def.cls === 'cavalry' ? -swing * 0.3 : swing * 0.16; // a horse rears to the blow
    g.position.set(x + Math.sin(g.rotation.y) * lunge, bob + this.scenery.heightAt(x, y), y + Math.cos(g.rotation.y) * lunge);
    g.scale.set(size, size * breathe, size);
    g.rotation.x += (pitch - g.rotation.x) * Math.min(1, dt * 14);
    g.rotation.z += (roll - g.rotation.z) * Math.min(1, dt * 14);
    // A soldier come to a work camp for his people faces its gate while he stands there.
    const gateMan = !u.moving && u.attackAnim <= 0 ? this.campScenes.at(u.id) : undefined;
    let d = (gateMan ? gateMan.yaw : u.facing) - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 12);
    for (const b of v.beasts ?? []) this.poseBeast(u, b, dt);
    for (const r of v.riders ?? []) this.poseReal(u, r.p, '', dt, 1, g.rotation.y, true, r.astride);
    if (v.real) {
      v.job = job;
      this.poseReal(u, v.real, job, dt, size, g.rotation.y);
    }
    // A Slaver's prisoner walks behind him on a rope, stripped to a loincloth.
    if (u.captive && !v.led && peopleReady()) {
      ofPeople(this.game.players[u.captive.from]?.civ ?? ''); // a captive is still one of the people they were taken from
      const cseed = (u.captive.name.length * 7 + u.captive.age) | 0;
      const creal = makePerson(roleOutfit('captive', u.captive.gender === 'f', 0, lookOf(this.game.players[u.captive.from]?.civ ?? '', cseed), cseed))!;
      const cg = creal.g;
      cg.position.set(-0.05, 0, -0.62);
      cg.rotation.y = 0.15;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.55, 4).rotateX(Math.PI / 2), mat(0x8a7250, 0, true));
      rope.position.set(0.04, 0.6, -0.33);
      rope.rotation.x = 0.18;
      g.add(cg, rope);
      v.led = { g: cg, rope, real: creal.real };
    } else if (!u.captive && v.led) { g.remove(v.led.g, v.led.rope); v.led = undefined; }
    if (v.led) {
      // Led at the captor's pace, head down.
      const lp = v.led.real;
      if (u.moving) play(lp, u.def.speed < 1.25 ? 'Walk_Loop' : 'Jog_Fwd_Loop', Math.max(0.75, Math.min(1.6, u.def.speed / (u.def.speed < 1.25 ? 0.78 : 1.78)))); else play(lp, 'Idle_Loop', 1);
      lp.mixer.update(dt);
      const hd = lp.bones.get('DEF-head');
      if (hd) hd.rotation.x += 0.35;
    }
    for (const l of v.legs) {
      // Four legs at a trot: each swings from the shoulder or hip and folds half way down as it comes forward.
      const ph = v.phase + (l.userData.leg as number), knee = l.userData.knee as THREE.Object3D | undefined;
      l.rotation.x = u.moving ? Math.sin(ph) * 0.6 : l.rotation.x * 0.8;
      if (knee) knee.rotation.x = u.moving ? Math.max(0, -Math.cos(ph)) * 1.0 : knee.rotation.x * 0.8;
    }
    // Wheels turn with the ground covered; oars are pulled together; pennants and sails stir.
    if (g.userData.spin === undefined) {
      const spin: THREE.Object3D[] = [], oars: THREE.Object3D[] = [], pens: THREE.Object3D[] = [];
      g.traverse((o) => { if (o.userData.wheel) spin.push(o); else if (o.userData.oar) oars.push(o); else if (o.userData.pennant) pens.push(o); });
      g.userData.spin = spin; g.userData.oars = oars; g.userData.pens = pens;
    }
    if (u.moving) for (const w of g.userData.spin as THREE.Object3D[]) w.rotation.x += (dt * u.def.speed) / (w.userData.wheel as number);
    for (const o of g.userData.oars as THREE.Object3D[]) {
      const ph = this.clock * 3.2, s = o.userData.oar as number;
      o.rotation.y += ((u.moving ? Math.sin(ph) * 0.5 * s : 0) - o.rotation.y) * Math.min(1, dt * 8);
      o.rotation.z += ((u.moving ? Math.max(0, Math.cos(ph)) * 0.3 * s : 0.25 * s) - o.rotation.z) * Math.min(1, dt * 8);
    }
    for (const pn of g.userData.pens as THREE.Object3D[]) pn.rotation.y = Math.sin(this.clock * 5 + v.phase) * 0.35;
    const nod = g.userData.nod as THREE.Object3D | undefined, tail = g.userData.tail as THREE.Object3D | undefined;
    // The head nods with the stride, or dips now and then while standing; the tail streams or flicks.
    if (nod) nod.rotation.x += ((u.moving ? 0.1 + Math.sin(v.phase * 2 + 0.8) * 0.1 : Math.max(0, Math.sin(this.clock * 0.5 + v.phase) - 0.7) * 1.6) - swing * 0.35 - nod.rotation.x) * Math.min(1, dt * 8);
    if (tail) { tail.rotation.x = u.moving ? -0.7 + Math.sin(v.phase * 2) * 0.15 : 0; tail.rotation.z = Math.sin(this.clock * (u.moving ? 6 : 2.3) + v.phase) * (u.moving ? 0.12 : 0.3); }
    // The rider rises and sits to the stride, a beat behind the horse.
    if (v.seat) { v.seat.position.y = v.seatY! + (u.moving ? Math.max(0, Math.sin(v.phase * 2 - 0.9)) * 0.035 : 0); v.seat.rotation.x = u.moving ? 0.12 : 0; }
    const arm = g.userData.arm as THREE.Object3D | undefined;
    if (arm) {
      arm.rotation.x = u.type === 'catapult' ? swing * 1.2 : -swing * 1.3 + (u.moving ? Math.sin(v.phase) * 0.3 : 0);
    }
    // A troop ship shows who is aboard.
    const aboard = g.userData.aboard as THREE.Group[] | undefined;
    if (aboard) { const n = u.cargo?.length ?? 0; for (let i = 0; i < aboard.length; i++) aboard[i].visible = i < n; }
    // An engine or a ship that has taken a beating burns, and smokes worse the nearer she is to going.
    if (v.cls === 'siege' || v.naval) {
      const hurt = u.hp < u.maxHp * 0.5;
      let fire = g.userData.fire as THREE.Mesh | undefined;
      if (hurt && !fire) {
        fire = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.85 }));
        (fire.material as THREE.Material).userData.outlineParameters = { visible: false };
        fire.position.set(0.1, v.naval ? 0.55 : 0.75, -0.15);
        g.add(fire);
        g.userData.fire = fire;
      }
      if (fire) {
        fire.visible = hurt;
        const k = 0.8 + (1 - u.hp / (u.maxHp * 0.5)) * 1.3;
        fire.scale.set(k, k * (0.85 + Math.sin(this.clock * 17 + u.id) * 0.25), k);
        const slot = Math.floor(this.clock * (u.hp < u.maxHp * 0.25 ? 3 : 1.4) + u.id);
        if (hurt && g.userData.smokeSlot !== slot) { g.userData.smokeSlot = slot; this.cloud(g.position.x + (Math.random() - 0.5) * 0.2, g.position.y + 1.0, g.position.z + (Math.random() - 0.5) * 0.2, 0x3e3a38, 0); }
      }
    }
    // Powder smoke and a flash at each muzzle as she fires.
    const muzzles = g.userData.muzzles as number[][] | undefined;
    if (muzzles?.length && u.attackAnim > 0 && !(g.userData.firing as boolean)) {
      g.updateMatrixWorld(true);
      for (const m of muzzles) { const at = this.v3.set(m[0], m[1], m[2]); g.localToWorld(at); this.puff(at.x, at.y, at.z); }
    }
    g.userData.firing = u.attackAnim > 0;
    // A ship under way throws a bow wave and leaves a wake.
    const wake = g.userData.wake as THREE.Mesh | undefined;
    if (wake) { const wm = wake.material as THREE.MeshBasicMaterial; wm.opacity += ((u.moving ? 0.42 + Math.sin(this.clock * 5 + v.phase) * 0.1 : 0) - wm.opacity) * Math.min(1, dt * 3); wake.visible = wm.opacity > 0.02; }
    // A gun or a bolt-thrower kicks back as it looses, and runs out again.
    const rec = g.userData.recoil as THREE.Object3D | undefined;
    if (rec) { rec.userData.z0 ??= rec.position.z; rec.position.z = (rec.userData.z0 as number) - swing * 0.16; }
    const ramLog = g.userData.ram as THREE.Object3D | undefined;
    if (ramLog) ramLog.position.z = u.attackAnim > 0 ? Math.sin((u.attackAnim / 0.35) * Math.PI) * 0.35 : 0;
    const carry = g.userData.carry as THREE.Mesh | undefined;
    if (carry) {
      carry.visible = u.carryAmt > 0;
      if (carry.visible) carry.material = mat(RES_COLOR[u.carryType], 0, true);
    }
    const glow = g.userData.glow as THREE.Mesh | undefined;
    if (glow) glow.scale.setScalar(u.healTarget ? 1.3 + Math.sin(this.clock * 10) * 0.4 : 1);
  }

  /** A unit has died: how it falls depends on what it was. */
  private fall(v: UnitView): void {
    const g = v.g, at = g.position;
    if (v.real) {
      this.mark(v, 3);
      // They fall to one side or the other, and not all square to the way they faced.
      const way = Math.floor(v.phase * 100);
      if (way % 2) g.scale.x = -Math.abs(g.scale.x);
      g.rotation.y += ((way % 7) - 3) * 0.22;
    }
    const flame = g.userData.fire as THREE.Object3D | undefined;
    if (flame) flame.removeFromParent(); // the fire goes out with her; it is not a piece to be thrown
    // The crew of an engine or a ship are thrown clear as she goes: whole men, not a scatter of parts.
    const crew = (g.userData.crew as THREE.Group[] | undefined) ?? [];
    for (const c of crew) {
      if (!c.visible) { c.removeFromParent(); continue; } // a place on deck no one was standing in
      c.updateMatrixWorld(true);
      this.throwPiece(c, at, 1, 0.75);
      if (!v.naval) { const p = c.getWorldPosition(this.v3); this.spray(p.x, p.y + 0.3, p.z, 5, true); }
    }
    g.userData.crew = [];
    if (v.cls === 'siege') {
      // An engine flies apart like a small building.
      this.spray(at.x, at.y + 0.5, at.z, 14, false);
      this.collapse(g);
      return;
    }
    if (v.naval) {
      // A ship breaks up: her masts, yards and sails come down around her and the sea boils where she was.
      g.updateMatrixWorld(true);
      const aloft: THREE.Mesh[] = [], p = new THREE.Vector3();
      g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.getWorldPosition(p).y > at.y + 0.55) aloft.push(m); });
      for (const m of aloft) this.throwPiece(m, at, 1.6, 0.45);
      const wake = g.userData.wake as THREE.Object3D | undefined;
      if (wake) wake.visible = false;
      for (let i = 0; i < 6; i++) this.cloud(at.x + (Math.random() - 0.5) * 1.2, at.y + 0.1, at.z + (Math.random() - 0.5) * 1.2, 0xf4f8fa, -i * 0.08);
    }
    if (v.flesh) { this.spray(at.x, at.y + 0.5, at.z, 16, true); this.stain(at.x, at.z, v.cls === 'beast' || v.cls === 'cavalry' ? 0.6 : 0.4, 3.5); }
    else this.spray(at.x, at.y + 0.4, at.z, 12, false);
    // The torch goes out with its bearer.
    for (const [id, by] of this.torchBy) if (by && (by === v.real || v.riders?.some((r) => r.p === by))) { dropTorch(by); this.torchBy.delete(id); }
    this.dying.push({ g, t: 0, v });
  }

  /** Drops of blood (or chips of wood) thrown up from a blow. */
  private spray(x: number, y: number, z: number, n: number, blood: boolean): void {
    if (blood && !this.gore) return;
    for (let i = 0; i < n && this.drops.length < 220; i++) {
      const m = new THREE.Mesh(this.dropGeo, blood ? this.bloodMat : this.chipMat);
      m.material.userData.outlineParameters = { visible: false };
      m.position.set(x, y, z);
      m.scale.setScalar(0.6 + Math.random() * 0.9);
      const a = Math.random() * Math.PI * 2, s = 0.4 + Math.random() * 1.6;
      this.scene.add(m);
      this.drops.push({ m, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 1 + Math.random() * 2.6, blood });
    }
  }

  /** A mark on the ground: a spatter where a drop lands, a pool spreading under a body. It fades in time. */
  private stain(x: number, z: number, size: number, grow = 0): void {
    if (!this.gore) return;
    if (this.stains.length > 260) { const old = this.stains.shift()!; this.scene.remove(old.m); (old.m.material as THREE.Material).dispose(); }
    const mt = new THREE.MeshBasicMaterial({ color: BLOOD, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mt.userData.outlineParameters = { visible: false };
    const m = new THREE.Mesh(this.stainGeo, mt);
    m.position.set(x, this.scenery.heightAt(x, z) + 0.04, z);
    m.rotation.y = Math.random() * 6;
    m.scale.set(grow ? 0.05 : size * (0.7 + Math.random() * 0.6), 1, grow ? 0.05 : size * (0.5 + Math.random() * 0.5));
    m.renderOrder = 4;
    m.userData.size = size;
    this.scene.add(m);
    this.stains.push({ m, t: 0, grow, life: grow ? 40 : 22 });
  }

  private stepGore(dt: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i], p = d.m.position;
      d.vy -= 9 * dt;
      p.x += d.vx * dt; p.y += d.vy * dt; p.z += d.vz * dt;
      if (p.y <= this.scenery.heightAt(p.x, p.z) + 0.03) {
        if (d.blood && Math.random() < 0.6) this.stain(p.x, p.z, 0.04 + Math.random() * 0.06);
        this.scene.remove(d.m);
        this.drops.splice(i, 1);
      }
    }
    for (let i = this.stains.length - 1; i >= 0; i--) {
      const s = this.stains[i];
      s.t += dt;
      if (s.grow && s.t < s.grow) { const k = (s.t / s.grow) * (s.m.userData.size as number); s.m.scale.set(k, 1, k * 0.8); }
      (s.m.material as THREE.MeshBasicMaterial).opacity = 0.85 * Math.min(1, (s.life - s.t) / 6);
      if (s.t > s.life) { this.scene.remove(s.m); (s.m.material as THREE.Material).dispose(); this.stains.splice(i, 1); }
    }
  }

  /**
   * Wounds show. A blow draws blood. Below two thirds strength a fighter has lost a shield or a hat and
   * their clothes are torn; below one third the rest of their gear is gone and they are bloodied.
   */
  private wound(u: Unit, v: UnitView): void {
    const g = v.g, lost = v.hp - u.hp;
    if (lost > 0.5 && g.visible) this.spray(g.position.x, g.position.y + (v.real ? 0.55 : 0.7), g.position.z, Math.min(6, 1 + Math.round((lost / u.maxHp) * 22)), v.flesh);
    v.hp = u.hp;
    if (v.real && lost > 0.5) v.real.flinch = 0.45;
    // Wounds show on the figure, and on any riders or crew: cuts and blood, torn clothes, gear knocked to the ground.
    const hurt = u.hp <= 0 ? 3 : u.hp < u.maxHp * 0.33 ? 2 : u.hp < u.maxHp * 0.66 ? 1 : 0;
    this.mark(v, hurt);
  }

  /** Bring the wounds drawn on a unit's people to a stage, throwing down whatever gear that knocks off. */
  private mark(v: UnitView, hurt: number): void {
    const g = v.g;
    for (const p of [v.real, ...(v.riders ?? []).map((r) => r.p)]) {
      if (!p || p.hurt === hurt) continue;
      const off = wounds(p, hurt, this.gore);
      // Gear they have back is no longer lying on the ground.
      for (const piece of p.gear.flat()) {
        const lying = this.dropped.get(piece);
        if (!lying || !piece.visible) continue;
        this.scene.remove(lying);
        const at = this.rubble.findIndex((r) => r.m === lying);
        if (at >= 0) this.rubble.splice(at, 1);
        this.dropped.delete(piece);
      }
      for (const piece of off) {
        if (!g.visible || !piece.parent) continue;
        // The piece itself stays on the figure, hidden, to be put back if they are healed; a copy of it falls.
        const copy = piece.clone();
        piece.parent.add(copy);
        copy.visible = true;
        copy.updateMatrixWorld(true);
        this.throwPiece(copy, g.position, 1, 0.5);
        this.dropped.set(piece, copy);
      }
    }
  }

  /** The trade a villager is plying, from the order in hand. Idle or merely walking, they wear their own clothes. */
  private jobOf(u: Unit): Job {
    const o = u.order;
    if (!o) return '';
    if (o.t === 'build') return 'build';
    if (o.t === 'attack') { const e = this.game.entities.get(o.id); return e && e.kind === 'unit' && e.owner === this.game.wild ? 'hunt' : ''; }
    if (o.t !== 'gather') return '';
    const e = this.game.entities.get(o.id);
    if (!e) return o.res === 'wood' ? 'wood' : o.res === 'food' ? 'forage' : 'mine';
    if (e.kind === 'building') return 'farm';
    return e.type === 'tree' ? 'wood' : e.type === 'carcass' ? 'hunt' : e.type === 'berries' ? 'forage' : e.type === 'fish' ? '' : 'mine';
  }

  /** Milkmaids and patrons at the tavern, monks and nuns at the church: those inside are shown standing at the front. */
  /**
   * A work camp's day. Its women are kept in the workroom at the querns; its men go out from the bunkhouse to break
   * stone in the yard and back in again; any Slavers posted there stand guard. At dusk everyone is walked to the
   * bunkhouse and shut in, a lamp shows at its window, and the yard is empty until dawn.
   */
  private syncCamp(b: Building, g: THREE.Group, shown: boolean): void {
    const spots = g.userData.camp as { bunk: number[]; work: number[][]; heap: number[][]; post: number[][]; k: number; ox: number; oz: number } | undefined;
    if (!spots) return;
    const held = b.captives ?? [], guards = b.staff?.length ?? 0, key = held.map((c) => c.gender).join('') + ':' + guards;
    const at = (p: number[]): [number, number] => [b.x + spots.ox + p[0] * spots.k, b.y + spots.oz + p[1] * spots.k];
    let cv = this.campViews.get(b.id);
    if (cv && cv.key !== key) { this.scene.remove(cv.g); cv = undefined; this.campViews.delete(b.id); }
    if (!cv && peopleReady() && (held.length || guards)) {
      const grp = new THREE.Group(), figs: CampFig[] = [], door = at(spots.bunk);
      held.slice(0, 10).forEach((c, i) => {
        ofPeople(this.game.players[c.from]?.civ ?? '');
        const cs = (c.name.length * 7 + c.age + i) | 0;
        const made = makePerson(roleOutfit('captive', c.gender === 'f', 0, lookOf(this.game.players[c.from]?.civ ?? '', cs), cs))!;
        const fig = made.g;
        fig.scale.multiplyScalar(0.88 * spots.k);
        fig.rotation.order = 'YXZ';
        fig.position.set(door[0], 0, door[1]);
        grp.add(fig);
        figs.push({ g: fig, real: made.real, woman: c.gender === 'f', guard: false, i, goal: 'out', wait: i * 0.9, in: true });
      });
      const color = this.game.players[b.owner].color;
      for (let i = 0; i < guards; i++) {
        ofPeople(this.game.players[b.owner].civ);
        const gp = this.game.players[b.owner];
        const gmade = makePerson(outfitFor('slaver', false, color, lookOf(gp.civ, b.id + i * 13), b.id + i * 13, 0, { cls: 'infantry', age: 1 }))!;
        const fig = gmade.g, [x, z] = at(spots.post[i % spots.post.length]);
        fig.scale.multiplyScalar(0.9 * spots.k);
        fig.position.set(x, this.scenery.heightAt(x, z) + (i % spots.post.length === 0 ? 0 : 0), z);
        fig.rotation.y = Math.PI / 4 + i * 1.7;
        grp.add(fig);
        figs.push({ g: fig, real: gmade.real, woman: false, guard: true, i, goal: 'out', wait: 0, in: false });
      }
      cv = { key, g: grp, figs };
      this.campViews.set(b.id, cv);
      this.scene.add(grp);
    }
    const night = this.nightAmt > 0.5, lamp = g.userData.nightLamp as THREE.Object3D | undefined;
    if (lamp) lamp.visible = night && held.length > 0;
    if (!cv) return;
    cv.g.visible = shown;
    if (!shown) return;
    const dt = Math.min(0.1, this.frameDt), door = at(spots.bunk);
    for (const f of cv.figs) {
      if (f.guard) { if (f.real) { play(f.real, 'Idle_Loop', 1); f.real.mixer.update(dt); } continue; }
      // Where this one should be now: shut in at night; by day a woman at her place in the workroom, a man at the stone or on his way back in.
      const place = f.woman ? at(spots.work[f.i % spots.work.length]) : at(spots.heap[f.i % spots.heap.length]);
      const goIn = night || (!f.woman && f.goal === 'in');
      const target = goIn ? door : place;
      if (f.in) {
        // Inside. By day a man comes out again after a short while, and a woman at dawn.
        if (!night && (f.wait -= dt) <= 0) { f.in = false; f.goal = 'out'; f.g.position.set(door[0], 0, door[1]); }
        f.g.visible = false;
        continue;
      }
      f.g.visible = true;
      const dx = target[0] - f.g.position.x, dz = target[1] - f.g.position.z, d = Math.hypot(dx, dz);
      let pose = 'idle';
      if (d > 0.06) {
        const step = Math.min(d, dt * 0.55 * (night ? 1.3 : 1));
        f.g.position.x += (dx / d) * step; f.g.position.z += (dz / d) * step;
        const want = Math.atan2(dx, dz), turn = Math.atan2(Math.sin(want - f.g.rotation.y), Math.cos(want - f.g.rotation.y));
        f.g.rotation.y += turn * Math.min(1, dt * 8);
        pose = 'walk';
      } else if (goIn) {
        f.in = true; f.wait = 2.5 + (f.i % 3); f.goal = 'out';
        f.g.visible = false;
        continue;
      } else if (f.woman) {
        // At the quern: bent to it, turning the stone.
        f.g.rotation.y += Math.atan2(Math.sin(-Math.PI / 2 - f.g.rotation.y), Math.cos(-Math.PI / 2 - f.g.rotation.y)) * Math.min(1, dt * 6);
        pose = 'reach';
      } else {
        // At the heap: a spell of breaking stone, then back inside with it.
        pose = 'work';
        if (f.goal === 'out') { f.goal = 'work'; f.wait = 7 + (f.i % 4) * 1.5; }
        if ((f.wait -= dt) <= 0) f.goal = 'in';
      }
      f.g.position.y = this.scenery.heightAt(f.g.position.x, f.g.position.z);
      if (f.real) {
        // The same day's round on the real figure: walking, bent to the quern, breaking stone with a pick.
        hold(f.real, pose === 'work' ? 'pick' : '');
        play(f.real, pose === 'walk' ? 'Walk_Loop' : pose === 'reach' ? 'Interact' : pose === 'work' ? 'Sword_Attack' : 'Idle_Loop', pose === 'walk' ? 0.9 : 1);
        f.real.mixer.update(dt);
        const hd = f.real.bones.get('DEF-head');
        if (hd && pose !== 'work') hd.rotation.x += 0.3;
      }
    }
  }

  /** One soft puff that swells, drifts up and fades: spray, foam, smoke. */
  private cloud(x: number, y: number, z: number, color: number, delay: number): void {
    const mt = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
    mt.userData.outlineParameters = { visible: false };
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mt);
    m.position.set(x, y, z);
    this.scene.add(m);
    this.dust.push({ m, t: delay });
  }
  /** A burst of powder smoke with a flash at its heart, where a gun has just gone off. */
  private puff(x: number, y: number, z: number): void {
    for (let i = 0; i < 3; i++) {
      const mt = new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffd070 : 0xd8d4cc, transparent: true, opacity: i === 0 ? 0.95 : 0.6, depthWrite: false });
      mt.userData.outlineParameters = { visible: false };
      const m = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.1 : 0.16, 8, 6), mt);
      m.position.set(x + (Math.random() - 0.5) * 0.12 * i, y + i * 0.05, z + (Math.random() - 0.5) * 0.12 * i);
      this.scene.add(m);
      this.dust.push({ m, t: i === 0 ? 1.25 : -i * 0.04 }); // the flash is over almost at once; the smoke hangs
    }
  }

  /** A small heart drifts up from a spot and fades: the sign of a tryst going on behind a door. */
  private heart(x: number, y: number, z: number): void {
    if (!this.heartGeo) {
      const sh = new THREE.Shape();
      sh.moveTo(0, -0.1); sh.bezierCurveTo(-0.16, 0.02, -0.1, 0.14, 0, 0.06); sh.bezierCurveTo(0.1, 0.14, 0.16, 0.02, 0, -0.1);
      this.heartGeo = new THREE.ShapeGeometry(sh, 6);
    }
    const mt = new THREE.MeshBasicMaterial({ color: 0xff4a7a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, fog: false });
    mt.userData.outlineParameters = { visible: false };
    const m = new THREE.Mesh(this.heartGeo, mt);
    m.position.set(x, y, z);
    m.renderOrder = 80;
    this.scene.add(m);
    this.hearts.push({ m, t: 0, sway: Math.random() * 6.28 });
  }
  private stepHearts(dt: number): void {
    // Where they come from: a staffed tavern, and houses where a man and a woman are both at home, in a town that has let itself go.
    for (const b of this.game.buildings) {
      if (!b.complete || (b.type !== 'tavern' && b.type !== 'house')) continue;
      const virtue = this.game.players[b.owner].virtue ?? 0;
      if (virtue > -30) continue;
      const busy = b.type === 'tavern' ? (b.staff?.length ?? 0) >= 2 : b.residents.m !== 0 && b.residents.f !== 0;
      const g = this.buildingViews.get(b.id);
      if (!busy || !g?.visible) continue;
      const every = (b.type === 'tavern' ? 2.2 : 5.5) * (virtue <= -70 ? 0.6 : 1), slot = Math.floor((this.clock + b.id * 1.37) / every);
      if (g.userData.heartSlot === slot) continue;
      const first = g.userData.heartSlot === undefined;
      g.userData.heartSlot = slot;
      // Not every beat: it comes in spells, with quiet between.
      if (!first && ((Math.sin(slot * 12.9898 + b.id) * 43758.5453) % 1 + 1) % 1 < (b.type === 'tavern' ? 0.8 : 0.5)) this.heart(b.x + (Math.random() - 0.5) * b.size * 0.5, g.position.y + (b.type === 'tavern' ? 1.6 : 1.1), b.y + (Math.random() - 0.3) * b.size * 0.4);
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      h.t += dt;
      h.m.position.y += dt * 0.55;
      h.m.position.x += Math.sin(h.t * 3 + h.sway) * dt * 0.12;
      h.m.quaternion.copy(this.camera.quaternion);
      h.m.scale.setScalar(0.8 + Math.min(1, h.t * 3) * 0.9);
      (h.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - h.t / 2.4));
      if (h.t > 2.4) { this.scene.remove(h.m); (h.m.material as THREE.Material).dispose(); this.hearts.splice(i, 1); }
    }
  }

  private syncStaff(b: Building, shown: boolean, lean: '' | 'holy' | 'low'): void {
    let women = 0, men = 0;
    for (const id of b.staff ?? []) { const s = this.game.entities.get(id) as Unit | undefined; if (s) { if (s.gender === 'f') women++; else men++; } }
    const key = `${women}:${men}:${lean}`;
    let sv = this.staffViews.get(b.id);
    if (sv && sv.key !== key) { this.scene.remove(sv.g); sv = undefined; this.staffViews.delete(b.id); }
    if (!sv && peopleReady() && women + men > 0) {
      const g = new THREE.Group(), tav = b.type === 'tavern', half = b.size / 2, figs: { g: THREE.Group; role: string; seed: number; real: RealPerson }[] = [];
      for (let i = 0; i < women + men; i++) {
        const f = i < women;
        const role = tav ? (f ? 'milkmaid' : 'patron') : f ? 'nun' : 'monk';
        ofPeople(this.game.players[b.owner].civ);
        const pl = this.game.players[b.owner];
        const made = makePerson(roleOutfit(role as 'monk' | 'nun' | 'milkmaid' | 'patron', f, pl.color, lookOf(pl.civ, b.id + i * 7), b.id + i * 7, lean))!;
        const fig = made.g;
        // Along the front and round the near corner, where the camera sees them.
        const k = i - (women + men - 1) / 2;
        const x = i % 2 ? half - 0.12 : k * 0.42 + 0.3, z = i % 2 ? k * 0.42 + 0.2 : half - 0.12;
        fig.position.set(b.x + x, this.scenery.heightAt(b.x + x, b.y + z), b.y + z);
        fig.rotation.y = Math.PI / 4 + Math.sin(b.id + i * 3.1) * 0.5;
        // In a town that has let itself go, the first maid and the first patron are found in each other's arms round the side.
        if (tav && lean === 'low' && women > 0 && men > 0 && (i === 0 || i === women)) {
          const sx = b.x - half - 0.22, sz = b.y + half * 0.35, side = i === 0 ? -1 : 1;
          fig.position.set(sx, this.scenery.heightAt(sx, sz), sz + side * 0.15);
          fig.rotation.set(0.04, side < 0 ? 0 : Math.PI, 0);
          fig.userData.pair = true;
        }
        g.add(fig);
        figs.push({ g: fig, role, seed: (b.id * 1.3 + i * 2.1) % 6.28, real: made.real });
      }
      sv = { key, g, figs };
      this.staffViews.set(b.id, sv);
      this.scene.add(g);
    }
    if (!sv) return;
    sv.g.visible = shown;
    if (!shown) return;
    // They are not statues: patrons drink and cheer, the maid serves, monks and nuns bow at their prayers.
    const rowdy = lean === 'low' ? 0.55 : lean === 'holy' ? 0.08 : 0.3;
    for (const f of sv.figs) {
      const t = this.clock + f.seed * 3, beat = Math.floor(t / 2.6), busy = ((Math.sin(beat * 12.9898 + f.seed) * 43758.5453) % 1 + 1) % 1 < rowdy;
      // Patrons talk, and cheer when the mood takes them; the maid serves; monks and nuns stand at their prayers.
      const clip = f.g.userData.pair ? 'Idle_Loop' : f.role === 'patron' ? (busy ? 'Dance_Loop' : 'Idle_Talking_Loop') : f.role === 'milkmaid' ? (busy ? 'Interact' : 'Idle_Loop') : busy || lean === 'holy' ? 'Spell_Simple_Idle_Loop' : 'Idle_Loop';
      play(f.real, clip, 1);
      f.real.mixer.update(Math.min(0.1, this.frameDt));
      if (f.g.userData.pair) embrace(f.real, f.g.rotation.y, f.role === 'milkmaid');
    }
  }

  private models: RealPerson[] = [];
  /**
   * Stands a row of figures at a spot, each in the outfit given, facing the camera: a way to look at clothes without
   * playing for them. Each entry overrides the plain villager's dress. Returns where each stands.
   */
  wardrobe(list: (Partial<Outfit> & { civ?: string })[], x: number, y: number, gap = 0.85): { x: number; y: number }[] {
    const at: { x: number; y: number }[] = [];
    list.forEach((over, i) => {
      const base = outfitFor('villager', !!over.female, over.top ?? this.game.players[this.game.humanId].color, lookOf(over.civ ?? this.game.players[this.game.humanId].civ, 31 + i * 17), 31 + i * 17, 0);
      const made = makePerson({ ...base, ...over });
      if (!made) return;
      // A row across the screen: along the line at right angles to the way the camera looks.
      const px = x + Math.cos(YAW) * (i - (list.length - 1) / 2) * gap, py = y - Math.sin(YAW) * (i - (list.length - 1) / 2) * gap;
      made.g.position.set(px, this.scenery.heightAt(px, py), py);
      made.g.rotation.y = YAW;
      this.scene.add(made.g);
      this.models.push(made.real);
      at.push({ x: px, y: py });
    });
    return at;
  }

  /**
   * Chooses the recorded motion for what someone is doing. Walking and running are played at the pace the unit really
   * moves, so feet do not skate; a blow, a shot or a spell is played through once from the moment it is loosed; a hit
   * makes them flinch; bows and guns are levelled over whatever else is playing.
   */
  private poseReal(u: Unit, p: RealPerson, job: Job, dt: number, size: number, yaw: number, mounted = false, seated = false): void {
    // The figure's own stride covers about 0.78 of a tile a second at a walk and 1.78 at a run, at full size.
    const pace = u.def.speed / size;
    const move = (): void => (mounted ? play(p, 'Idle_Loop', 1.4) : pace < 1.25 ? play(p, 'Walk_Loop', Math.max(0.7, Math.min(1.7, pace / 0.78))) : play(p, 'Jog_Fwd_Loop', Math.max(0.75, Math.min(1.6, pace / 1.78))));
    p.flinch = Math.max(0, p.flinch - dt);
    let aim = 0;
    if (p.soldier) {
      const striking = u.attackAnim > 0;
      const thrust = p.weapon === 'spear' || p.weapon === 'pike' || p.weapon === 'javelin' || p.weapon === 'bill' || p.weapon === 'sling' || p.weapon === 'grenade';
      const clip = p.weapon === 'staff' ? 'Spell_Simple_Shoot' : thrust ? 'Punch_Cross' : 'Sword_Attack', rate = p.weapon === 'staff' ? 1.2 : 1.5;
      if (striking && !p.struck) { p.strike = p.aim ? 0.7 : lasts(p, clip) / rate; p.now = ''; }
      p.struck = striking;
      p.strike -= dt;
      if (p.aim) {
        // Shot: the weapon stays levelled while there is someone to shoot at, and comes down to move.
        aim = p.strike > 0 ? 1 : u.order?.t === 'attack' && !u.moving ? 0.85 : 0;
        if (u.moving && p.strike <= 0) move(); else play(p, 'Idle_Loop', 1);
      } else if (p.strike > 0) play(p, clip, rate, true);
      else if (p.flinch > 0) play(p, 'Hit_Chest', 1.3, true);
      else if (u.moving) move();
      else if (this.campScenes.at(u.id)?.working) play(p, p.weapon === 'spear' || p.weapon === 'pike' ? 'Punch_Cross' : 'Sword_Attack', 0.9); // hacking at the gate
      else play(p, u.order?.t === 'attack' && (p.weapon === 'sword' || p.weapon === 'club' || p.weapon === 'axe') ? 'Sword_Idle' : 'Idle_Loop', 1);
    } else {
      hold(p, job === 'wood' ? 'hatchet' : job === 'mine' ? 'pick' : job === 'build' ? 'hammer' : job === 'farm' ? 'hoe' : '');
      bear(p, u.carryAmt > 0 && u.moving ? (u.carryType === 'wood' ? 'logs' : 'sack') : '');
      if (u.attackAnim > 0 && !u.moving) {
        if (job === 'wood' || job === 'mine') play(p, 'Sword_Attack', 1.1);
        else if (job === 'build') play(p, 'Fixing_Kneeling', 1);
        else if (job === 'farm' || job === 'forage' || job === 'hunt') play(p, 'PickUp_Table', 1);
        else play(p, mounted ? 'Interact' : 'Punch_Jab', 1.2); // a crew works its engine; a villager with nothing in hand uses his fists
      } else if (p.flinch > 0) play(p, 'Hit_Chest', 1.3, true);
      else if (u.moving) move();
      // Standing about, some of them pass the time of day.
      else play(p, (Math.floor(this.clock / 7) + u.id) % 4 === 0 ? 'Idle_Talking_Loop' : 'Idle_Loop', 1);
    }
    p.mixer.update(dt);
    level(p, yaw, aim, dt);
    if (seated) astride(p, yaw);
    // After dark, one figure of a unit that carries a torch holds it up, if it has a hand free.
    if (this.nightAmt > 0.02 || this.torchBy.has(u.id)) {
      let by = this.torchBy.get(u.id);
      if (by === undefined && this.game.isMilitary(u) && !u.def.naval && carriesTorch(u.id, !!u.hero)) this.torchBy.set(u.id, (by = canCarryTorch(p) && (!mounted || seated) ? p : null));
      if (by === p) carryTorch(p, yaw, this.nightAmt > 0.02 ? 1 : 0, dt);
    }
  }

  /** The gait of an animal: standing, walking or at the gallop as the unit moves, and its bite or kick when it strikes. */
  private poseBeast(u: Unit, b: Beast, dt: number): void {
    const striking = u.attackAnim > 0 && !!this.game.entities.get(u.id);
    // Only an animal that fights with its own body plays an attack: a horse leaves the fighting to its rider.
    const fights = b.kind === 'wolf' || b.kind === 'husky' || b.kind === 'bear' || b.kind === 'elephant' || b.kind === 'mammoth';
    if (fights && striking && !b.struck) { b.strike = 0.6; b.now = ''; }
    b.struck = striking;
    b.strike -= dt;
    if (fights && b.strike > 0) gait(b, 'Attack', 1.6, true);
    else if (u.moving) (u.def.speed < 1.5 || b.kind === 'elephant' || b.kind === 'mammoth' ? gait(b, 'Walk', Math.max(0.7, u.def.speed / 1.1)) : gait(b, 'Gallop', Math.max(0.7, Math.min(1.6, u.def.speed / 3.2))));
    // A deer left alone puts its head down to graze from time to time.
    else gait(b, (b.kind === 'deer' || b.kind === 'stag') && (Math.floor(this.clock / 6) + u.id) % 3 === 0 ? 'Eating' : (Math.floor(this.clock / 9) + u.id) % 4 === 0 ? 'Idle_2' : 'Idle', 1);
    b.mixer.update(dt);
  }

  /** Put real animals in the place of the block horses and wolves that riders sit on and chariots are drawn by. */
  private steeds(u: Unit, v: UnitView): void {
    const at = new Map<THREE.Object3D, string>();
    v.g.traverse((o) => { if (o.userData.steed && o.parent) at.set(o.parent, o.userData.steed as string); });
    if (!at.size) { v.beasts = []; return; }
    for (const kind of at.values()) if (!beastReady(kind as BeastKind)) return; // not arrived yet: keep the blocks for now
    v.beasts = [];
    let i = 0;
    for (const [parent, kind] of at) {
      const back = kind === 'wolf' ? 0.5 : kind === 'camel' ? 0.9 : kind === 'elephant' ? 1.08 : kind === 'mammoth' ? 1.12 : kind === 'bear' ? 0.62 : 0.7;
      const b = makeBeast(kind as BeastKind, back, u.id + i++, kind === 'wolf' ? 0x4a4a52 : null);
      if (!b) continue;
      for (const c of parent.children) if (c.userData.steed) c.visible = false;
      // A camel's rider sits higher than a horseman, behind the hump.
      if (kind === 'camel' && v.seat) { v.seatY = v.seat.userData.seatY = (v.seat.userData.seat0 ??= v.seat.userData.seatY as number) + 0.47; v.seat.position.z = -0.3; }
      // The saddle cloth goes up with him.
      if (kind === 'camel') for (const c of parent.children) if (!c.userData.steed && !c.userData.biped && !c.userData.lifted) { c.userData.lifted = true; c.position.y += 0.22; }
      // The old mount was built about its own middle with its back near 0.76 up: sit the new one to match.
      b.g.position.set(0, 0, 0.06);
      parent.add(b.g);
      v.beasts.push(b);
    }
  }

  /** Put real figures in the place of the block riders and drivers of a mount or a car. */
  private mount(u: Unit, v: UnitView): void {
    const seats: THREE.Object3D[] = [];
    v.g.traverse((o) => { if (o !== v.g && o.userData.biped) seats.push(o); if (o.userData.mark) o.visible = false; }); // the real riders are told apart by their own dress
    v.riders = [];
    const pl = this.game.players[u.owner];
    seats.forEach((seat, i) => {
      const made = makePerson(outfitFor(u.type, false, pl.color, lookOf(pl.civ, u.id + i * 5), u.id + i * 5, 0, { cls: u.def.cls, age: u.def.age, naval: !!u.def.naval, civ: pl.civ }));
      if (!made) return;
      for (const c of seat.children) c.visible = false; // the block figure and its gear give way
      seat.add(made.g);
      made.g.position.y = seat.userData.stands ? 0 : -0.07;
      if (!seat.userData.stands && u.def.cls !== 'siege') { v.seat = seat; v.seatY = seat.userData.seatY ??= seat.position.y; }
      v.riders!.push({ p: made.real, astride: !seat.userData.stands });
    });
  }

  /** A building that falls comes apart: every piece is thrown clear, tumbles, settles and sinks away. */
  private collapse(g: THREE.Group): void {
    g.updateMatrixWorld(true);
    const parts: THREE.Mesh[] = [];
    for (const o of (g.userData.lit as THREE.Object3D[] | undefined) ?? []) o.removeFromParent(); // its lights go out with it
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible && o.parent?.visible !== false) parts.push(o as THREE.Mesh); });
    const centre = g.position, box = new THREE.Box3().setFromObject(g), top = Math.max(0.5, box.max.y - centre.y);
    for (const m of parts) this.throwPiece(m, centre, top);
    this.scene.remove(g);
    const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    for (let i = 0; i < 7; i++) {
      const mt = new THREE.MeshBasicMaterial({ color: 0xb8ac98, transparent: true, opacity: 0.55, depthWrite: false });
      mt.userData.outlineParameters = { visible: false };
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mt);
      m.position.set(centre.x + (Math.random() - 0.5) * size, centre.y + 0.3 + Math.random() * 0.6, centre.z + (Math.random() - 0.5) * size);
      this.scene.add(m);
      this.dust.push({ m, t: -i * 0.05 });
    }
    if (Math.hypot(centre.x - this.cx, centre.z - this.cy) < this.dist) this.shake = Math.max(this.shake, 0.35);
  }

  private throwPiece(m: THREE.Object3D, centre: THREE.Vector3, top: number, force = 1): void {
    const p = this.v3;
    this.scene.attach(m);
    m.getWorldPosition(p);
    const dx = p.x - centre.x, dz = p.z - centre.z, d = Math.hypot(dx, dz) || 1, push = (0.6 + Math.random() * 1.8) * force;
    const high = Math.min(1, Math.max(0, (p.y - centre.y) / top));
    this.rubble.push({
      m, vx: (dx / d) * push + (Math.random() - 0.5), vz: (dz / d) * push + (Math.random() - 0.5), vy: (0.5 + Math.random() * 2.5) * force,
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(7),
      // The foot gives way first and the top comes down after it.
      t: 0, wait: high * 0.35 + Math.random() * 0.1, ground: this.scenery.heightAt(p.x, p.z), rest: false,
    });
  }

  /**
   * Damage shows as it is done: as a building's strength falls past two thirds and then one third,
   * more of its pieces are knocked off and fall, well before the whole of it comes down.
   */
  private shed(g: THREE.Group, stage: number): void {
    g.updateMatrixWorld(true);
    const keep = new Set<unknown>([g.userData.fire, g.userData.resM, g.userData.resF]);
    const parts: THREE.Mesh[] = [];
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh && !keep.has(o) && o.parent?.visible !== false) parts.push(o as THREE.Mesh); });
    if (g.userData.whole === undefined) g.userData.whole = parts.length;
    const want = Math.round((g.userData.whole as number) * (stage === 2 ? 0.4 : 0.16)) - ((g.userData.whole as number) - parts.length);
    const box = new THREE.Box3().setFromObject(g), top = Math.max(0.5, box.max.y - g.position.y);
    // Small pieces and high ones go first: tiles, beams, chimneys, battlements. The great walls stand to the end.
    const size = new THREE.Vector3(), at = new THREE.Vector3();
    const score = (m: THREE.Mesh): number => { m.geometry.computeBoundingBox(); m.geometry.boundingBox!.getSize(size); m.getWorldPosition(at); return size.x * size.y * size.z * 3 - (at.y - g.position.y) / top + ((m.id * 2654435761) >>> 0) / 4294967296 * 0.9; };
    parts.sort((a, b) => score(a) - score(b));
    for (const m of parts.slice(0, Math.max(0, want))) { if (g.visible) this.throwPiece(m, g.position, top); else m.removeFromParent(); }
  }

  private stepRubble(dt: number): void {
    for (let i = this.rubble.length - 1; i >= 0; i--) {
      const r = this.rubble[i];
      if ((r.t += dt) < r.wait) continue;
      const m = r.m;
      if (!r.rest) {
        r.vy -= 14 * dt;
        m.position.x += r.vx * dt; m.position.y += r.vy * dt; m.position.z += r.vz * dt;
        m.rotation.x += r.spin.x * dt; m.rotation.y += r.spin.y * dt; m.rotation.z += r.spin.z * dt;
        if (m.position.y < r.ground + 0.08) {
          m.position.y = r.ground + 0.08;
          if (Math.abs(r.vy) < 1.6) r.rest = true;
          r.vy = -r.vy * 0.32; r.vx *= 0.55; r.vz *= 0.55; r.spin.multiplyScalar(0.5);
        }
      } else if (r.t > 3.2) m.position.y -= dt * 0.25;
      if (r.t > 5) { this.scene.remove(m); this.rubble.splice(i, 1); }
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.t += dt;
      d.m.visible = d.t > 0;
      d.m.scale.setScalar(0.6 + Math.max(0, d.t) * 1.6);
      d.m.position.y += dt * 0.35;
      (d.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 * (1 - d.t / 1.6));
      if (d.t > 1.6) { this.scene.remove(d.m); this.dust.splice(i, 1); }
    }
  }

  /**
   * Walls join up: each wall tile shows an arm toward every neighbouring wall, gate or tower, a gate turns
   * to stand across its wall, and the heavier post shows only at ends, corners and junctions.
   */
  private linkWalls(): void {
    const N = this.game.size, at = new Set<number>();
    for (const b of this.game.buildings) if (b.def.wall || b.type === 'tower') at.add(Math.floor(b.y) * N + Math.floor(b.x));
    if (!at.size) return;
    for (const b of this.game.buildings) {
      if (!b.def.wall) continue;
      const g = this.buildingViews.get(b.id);
      if (!g) continue;
      const cx = Math.floor(b.x), cy = Math.floor(b.y), on = WALL_DIRS.map(([dx, dz]) => at.has((cy + dz) * N + cx + dx));
      if (g.userData.gate) { g.rotation.y = (on[2] || on[6]) && !on[0] && !on[4] ? Math.PI / 2 : 0; continue; }
      const arms = g.userData.arms as THREE.Group[] | undefined;
      if (!arms) continue;
      // A diagonal arm only where no square neighbour already carries the wall round that corner.
      for (const i of [1, 3, 5, 7]) on[i] = on[i] && !on[i - 1] && !on[(i + 1) % 8];
      const count = on.filter(Boolean).length;
      if (count === 0) on[0] = on[4] = true; // a lone piece stands as a short length, not a post
      arms.forEach((a, i) => { a.visible = on[i]; });
      (g.userData.pier as THREE.Object3D).visible = !(count === 2 && on.some((v, i) => v && on[(i + 4) % 8]));
    }
  }

  private syncBuilding(b: Building): void {
    let g = this.buildingViews.get(b.id);
    // A church or a tavern shows how its town leans, and is rebuilt when that changes.
    const lean = b.type === 'temple' || b.type === 'tavern' || b.type === 'house' ? leaningOf(this.game.players[b.owner].virtue ?? 0) : '';
    const hurt = !b.complete ? 0 : b.hp < b.maxHp * 0.33 ? 2 : b.hp < b.maxHp * 0.66 ? 1 : 0;
    // Rebuilt whole when it is repaired, or when the town's leaning changes.
    if (g && (g.userData.lean !== lean || hurt < ((g.userData.hurt as number) ?? 0))) { if (g.userData.site) this.scene.remove(g.userData.site as THREE.Object3D); this.scene.remove(g); g = undefined; }
    if (!g) {
      this.scenery.clearAt(b.x, b.y, b.size / 2 + 0.2);
      g = makeBuilding(b.type, this.game.players[b.owner].color, this.game.players[b.owner].age, this.game.players[b.owner].civ, lean, (b.id * 7 + 3) % 97); // the same plot always gets the same house
      g.userData.lean = lean;
      // A building sits on the lowest corner of its plot, so no wall hangs in the air.
      const k = b.size / 2 - 0.1, hh = this.scenery.heightAt.bind(this.scenery);
      g.position.set(b.x, Math.min(hh(b.x, b.y), hh(b.x - k, b.y - k), hh(b.x + k, b.y - k), hh(b.x - k, b.y + k), hh(b.x + k, b.y + k)), b.y);
      this.buildingViews.set(b.id, g);
      this.scene.add(g);
      if (!b.def.wall && b.type !== 'farm') this.lights(g, b);
    }
    // Lit by night: the lamp at the door and the pool of light it throws come up at dusk and gutter a little.
    const lit = g.userData.lit as THREE.Object3D[] | undefined;
    if (lit) {
      const on = b.complete ? this.nightAmt : 0, flick = 0.86 + 0.14 * Math.sin(this.clock * 7 + b.id * 1.7) * Math.sin(this.clock * 3.1 + b.id);
      for (const o of lit) { o.visible = on > 0.02; ((o as THREE.Mesh).material as THREE.Material).opacity = on * flick * (o.userData.k as number); }
    }
    g.visible = this.isVisible(b);
    if (b.def.staff) this.syncStaff(b, g.visible && b.complete, lean);
    if (b.def.camp) this.syncCamp(b, g, g.visible && b.complete);
    if (hurt > ((g.userData.hurt as number) ?? 0)) this.shed(g, hurt);
    g.userData.hurt = hurt;
    // A building going up rises out of its footings inside a scaffold of poles, which comes down when it is done.
    let site = g.userData.site as THREE.Group | undefined;
    if (!b.complete) {
      if (g.userData.tall === undefined) { g.userData.baseY = g.position.y; g.userData.tall = new THREE.Box3().setFromObject(g).max.y - g.position.y; }
      const tall = g.userData.tall as number;
      if (!site) {
        site = new THREE.Group();
        const pole = mat(0x8a6a44), h = Math.min(tall, 2.6) + 0.25, r = b.size / 2 - 0.06;
        const footing = new THREE.Mesh(new THREE.BoxGeometry(b.size * 0.96, 0.08, b.size * 0.96), mat(0x7a6850));
        footing.position.y = 0.04; footing.receiveShadow = true; site.add(footing);
        if (!b.def.wall && b.type !== 'farm') {
          for (const [x, z] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 5), pole); m.position.set(x, h / 2, z); m.castShadow = true; site.add(m); }
          for (const y of [h * 0.45, h * 0.9]) for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2 * r, 0.04, 0.04), pole); m.position.set(k === 0 ? 0 : k === 1 ? r : k === 2 ? 0 : -r, y, k === 0 ? -r : k === 1 ? 0 : k === 2 ? r : 0); m.rotation.y = k % 2 ? Math.PI / 2 : 0; site.add(m); }
          for (let k = 0; k < 2; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.4 * r, 0.035, 0.035), pole); m.position.set(0, h * 0.45, k ? r : -r); m.rotation.z = k ? 0.42 : -0.42; site.add(m); }
        }
        site.position.set(g.position.x, g.userData.baseY as number, g.position.z);
        this.scene.add(site);
        g.userData.site = site;
      }
      site.visible = g.visible;
      g.position.y = (g.userData.baseY as number) - (1 - b.progress) * tall * 0.96;
    } else if (site) {
      this.scene.remove(site);
      g.userData.site = undefined;
      g.position.y = g.userData.baseY as number;
    }
    // Badly damaged buildings burn.
    const burning = (b.complete && b.hp < b.maxHp * 0.5) || b.burnT > 0;
    let fire = g.userData.fire as THREE.Mesh | undefined;
    if (burning && !fire) {
      fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.85 }));
      fire.position.set(b.size * 0.15, b.type === 'farm' ? 0.5 : b.size * 0.35 + 0.9, -b.size * 0.1);
      g.add(fire);
      g.userData.fire = fire;
    }
    if (fire) {
      fire.visible = burning;
      const k = 0.8 + (1 - b.hp / (b.maxHp * 0.5)) * 1.4;
      fire.scale.set(k, k * (0.85 + Math.sin(this.clock * 17 + b.id) * 0.25), k);
    }
    if (b.type === 'house') {
      (g.userData.resM as THREE.Mesh).visible = b.residents.m !== 0;
      (g.userData.resF as THREE.Mesh).visible = b.residents.f !== 0;
    }
  }

  private syncResource(r: ResourceNode): void {
    if (r.type === 'tree' || this.resViews.has(r.id)) return;
    const g = makeResource(r.type, r.id);
    g.position.set(r.x, this.scenery.heightAt(r.x, r.y), r.y);
    this.resViews.set(r.id, g);
    this.scene.add(g);
  }

  private ring(i: number): THREE.Mesh {
    while (this.rings.length <= i) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.rings.push(m);
    }
    return this.rings[i];
  }

  frame(alpha: number, dt: number, selection: number[]): void {
    this.frameDt = dt;
    const game = this.game;
    this.clock += dt;
    if (this.shake > 0) this.shake -= dt;
    this.placeCamera();
    for (const u of game.units) this.syncUnit(u, alpha, dt);
    for (const b of game.buildings) this.syncBuilding(b);
    if ((this.wallTick = (this.wallTick + 1) % 12) === 0) this.linkWalls();
    for (const r of game.resources) this.syncResource(r);
    this.lightNight();
    this.campScenes.update(this.game, dt, {
      chips: (x, y, z, n) => this.spray(x, y, z, n, false),
      dust: (x, y, z, delay) => this.cloud(x, y, z, 0xb8a888, delay),
      sign: (x, y, text) => { this.floaters.push({ x, y, text, t: 0 }); },
      height: (x, y) => this.scenery.heightAt(x, y),
      seen: (b) => !!this.buildingViews.get(b.id)?.visible,
    });
    this.updateFog(dt);
    this.scenery.update(this.clock, 1 - this.nightAmt, this.weather.amount);
    for (const m of this.models) m.mixer.update(dt);
    if (!this.still) this.life.update(dt, this.clock, 1 - this.nightAmt, this.weather.amount, this.cx, this.cy);
    // Smoke from the hearths of lived-in houses and the town's hall, thicker in the cold and after dark.
    if ((this.hearthT -= dt) <= 0 && !this.still) {
      this.hearthT = game.climate === 'snow' || this.nightAmt > 0.5 ? 0.35 : 0.6;
      const homes = game.buildings.filter((b) => b.complete && (b.type === 'towncenter' || (b.type === 'house' && (b.residents.m !== 0 || b.residents.f !== 0))) && Math.abs(b.x - this.cx) < 18 && Math.abs(b.y - this.cy) < 16 && (this.noFog || game.vis[Math.floor(b.y) * game.size + Math.floor(b.x)] === 2));
      const b = homes[Math.floor(Math.random() * homes.length)];
      if (b) this.cloud(b.x + b.size * 0.18 + (Math.random() - 0.5) * 0.1, this.scenery.heightAt(b.x, b.y) + (b.type === 'house' ? 1.25 : 2.3), b.y - b.size * 0.12, 0xb8b4ae, 0);
    }

    // Selection rings.
    let n = 0;
    this.rally.visible = false;
    for (const id of selection) {
      const e = game.entities.get(id);
      if (!e) continue;
      const m = this.ring(n++);
      m.visible = true;
      const col = e.owner === game.humanId ? 0x8dff8a : e.owner < 0 || e.owner === game.wild ? 0xffe27a : game.hostile(e.owner, game.humanId) ? 0xff6a5a : 0x8ad0ff;
      (m.material as THREE.MeshBasicMaterial).color.setHex(col);
      if (e.kind === 'unit') {
        const v = this.unitViews.get(id);
        m.position.set(v ? v.g.position.x : e.x, this.scenery.heightAt(e.x, e.y) + 0.07, v ? v.g.position.z : e.y);
        m.scale.setScalar(e.def.radius + 0.18);
      } else {
        m.position.set(e.x, this.scenery.heightAt(e.x, e.y) + 0.07, e.y);
        m.scale.setScalar(e.size * 0.72);
        if (e.kind === 'building' && e.hasRally && e.owner === game.humanId) {
          this.rally.visible = true;
          this.rally.position.set(e.rallyX, this.scenery.heightAt(e.rallyX, e.rallyY), e.rallyY);
        }
      }
    }
    for (let i = n; i < this.rings.length; i++) this.rings[i].visible = false;

    // Projectiles: arrows fly point first, stones and boulders tumble, and each ends in dust, a puff or a splash.
    const ps = game.projectiles;
    this.shotTick++;
    for (const p of ps) {
      let sv = this.shots.get(p);
      if (!sv) { sv = { g: makeShot(p.kind), kind: p.kind, tx: p.tx, ty: p.ty, seen: 0, spin: Math.random() * 6 }; this.scene.add(sv.g); this.shots.set(p, sv); }
      sv.seen = this.shotTick; sv.tx = p.tx; sv.ty = p.ty;
      const m = sv.g;
      const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
      const t = Math.min(1, Math.hypot(p.x - p.sx, p.y - p.sy) / total);
      const arc = p.kind === 'boulder' ? total * 0.3 : p.kind === 'shot' ? total * 0.02 : p.kind === 'stone' ? total * 0.14 : total * 0.08;
      const gh = this.scenery.heightAt(p.sx, p.sy) * (1 - t) + this.scenery.heightAt(p.tx, p.ty) * t;
      m.position.set(p.x, gh + 0.8 + Math.sin(t * Math.PI) * arc, p.y);
      if (p.kind === 'arrow') m.lookAt(p.tx, this.scenery.heightAt(p.tx, p.ty) + 0.8 + Math.cos(t * Math.PI) * arc * -2, p.ty);
      else if (p.kind !== 'shot') m.rotation.set(sv.spin + this.clock * 7, sv.spin * 2 + this.clock * 4, 0);
      m.visible = this.noFog || game.vis[Math.floor(p.y) * game.size + Math.floor(p.x)] === 2;
    }
    for (const [p, sv] of this.shots) {
      if (sv.seen === this.shotTick) continue;
      // It has landed.
      if (sv.g.visible && sv.kind !== 'arrow') {
        const N = game.size, cx = Math.min(N - 1, Math.max(0, Math.floor(sv.tx))), cy = Math.min(N - 1, Math.max(0, Math.floor(sv.ty)));
        const wet = game.terrain[cy * N + cx] === 1, gy = this.scenery.heightAt(sv.tx, sv.ty), n = sv.kind === 'boulder' ? 4 : sv.kind === 'shot' ? 2 : 1;
        for (let i = 0; i < n; i++) this.cloud(sv.tx + (Math.random() - 0.5) * 0.5 * (n - 1), gy + 0.15, sv.ty + (Math.random() - 0.5) * 0.5 * (n - 1), wet ? 0xf4f8fa : sv.kind === 'shot' ? 0x8a8680 : 0xb8ac98, -i * 0.05);
        if (sv.kind === 'boulder' && Math.hypot(sv.tx - this.cx, sv.ty - this.cy) < this.dist) this.shake = Math.max(this.shake, 0.18);
      }
      this.scene.remove(sv.g);
      this.shots.delete(p);
    }

    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i];
      p.t += dt;
      p.mesh.scale.setScalar(1 + p.t * 2.5);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - p.t / 0.6;
      if (p.t > 0.6) { this.scene.remove(p.mesh); this.pings.splice(i, 1); }
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t += dt;
      if (d.v.wildlife && d.v.beasts?.length) {
        // The animal's own fall.
        gait(d.v.beasts[0], 'Death', 1, true);
        d.v.beasts[0].mixer.update(dt);
        d.g.rotation.x = d.g.rotation.z = 0;
        if (d.t > 6) d.g.position.y -= dt * 0.12;
        if (d.t > 9) { this.scene.remove(d.g); this.dying.splice(i, 1); }
      } else if (d.v.real) {
        // The recorded fall, then the body lies a while and sinks into the ground.
        // One recorded fall, made several: quicker or slower, mirrored, and ending in one of three sprawls.
        const way = Math.floor(d.v.phase * 100);
        play(d.v.real, 'Death01', 0.85 + (way % 5) * 0.09, true);
        d.v.real.mixer.update(dt);
        sprawl(d.v.real, way % 3, Math.min(1, Math.max(0, (d.t - 0.5) / 0.9)));
        d.g.rotation.x = d.g.rotation.z = 0;
        if (d.t > 7) d.g.position.y -= dt * 0.12;
        if (d.t > 10) { this.scene.remove(d.g); this.dying.splice(i, 1); }
      } else if (d.v.naval) {
        // Her hull rolls on its beam ends, settles by the stern and goes down in a welter of foam.
        const side = d.v.phase > 3 ? 1 : -1;
        d.g.rotation.x += (-0.55 - d.g.rotation.x) * Math.min(1, dt * 0.9);
        d.g.rotation.z += (side * 0.95 - d.g.rotation.z) * Math.min(1, dt * 0.8);
        d.g.position.y -= dt * (0.03 + d.t * 0.055);
        if (d.t < 4.5 && Math.floor(d.t * 3) !== Math.floor((d.t - dt) * 3)) this.cloud(d.g.position.x + (Math.random() - 0.5) * 0.9, this.scenery.heightAt(d.g.position.x, d.g.position.z) + 0.08, d.g.position.z + (Math.random() - 0.5) * 0.9, 0xf4f8fa, 0);
        if (d.t > 6.5) { this.scene.remove(d.g); this.dying.splice(i, 1); }
      } else {
        // Beasts and riders go over on their side, kick once, and lie.
        d.g.rotation.x = 0;
        const k = Math.min(1, d.t / 0.4);
        d.g.rotation.z = (k * k * (3 - 2 * k)) * (Math.PI / 2) * (d.v.phase > 3 ? 1 : -1) + (d.t > 0.4 && d.t < 0.9 ? Math.sin((d.t - 0.4) * 25) * 0.05 : 0);
        for (const l of d.v.legs) l.rotation.x = d.t < 1.2 ? Math.sin(d.t * 18 + (l.userData.leg as number)) * 0.5 * (1 - d.t / 1.2) : 0;
        if (d.t > 6) d.g.position.y -= dt * 0.15;
        if (d.t > 9) { this.scene.remove(d.g); this.dying.splice(i, 1); }
      }
    }
    this.stepGore(dt);
    for (let i = this.floaters.length - 1; i >= 0; i--) if ((this.floaters[i].t += dt) > 2) this.floaters.splice(i, 1);

    this.stepRubble(dt);
    this.stepHearts(dt);
    this.roads.update((b) => this.isVisible(b));
    this.weather.update(dt, this.clock, this.cx, this.cy, this.game);
    if (this.ink) {
      // Only what is made of the drawn materials takes an outline; the ground, water, rings and fog never do.
      if (this.inked++ % 12 === 0) this.scene.traverse((o) => {
        const mt = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (mt) for (const x of Array.isArray(mt) ? mt : [mt]) if (!x.userData.outlineParameters) x.userData.outlineParameters = { visible: false };
      });
      this.ink.render(this.scene, this.camera);
    } else this.gl.render(this.scene, this.camera);
  }
}
