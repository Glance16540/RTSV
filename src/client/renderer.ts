// Three.js scene: terrain, fog of war, entity meshes and the RTS camera.

import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import { Building, Entity, Game, GameEvent, ResourceNode, Unit } from '../sim/game';
import { buildScenery, Scenery } from './scenery';
import { Job, makeBuilding, makeResource, makeStaff, makeUnit, mat, RES_COLOR, Rig, rigBiped } from './models';
import MOTIONS from './motions.json';
import { leaningOf } from './assets';
import { Roads } from './roads';
import { Weather } from './weather';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { INK, RAMP, WALL_DIRS, wobble } from './shapes';

const PITCH = (50 * Math.PI) / 180;
const YAW = Math.PI / 4; // the map appears as a diamond, like the classic isometric RTS view
const FOV = 30;

interface UnitView { g: THREE.Group; phase: number; legs: THREE.Object3D[]; type: string; rig: Rig | null; work: number; job: Job; wear: number; hp: number; hurt: number; flesh: boolean; cls: string; naval: boolean; /** A rider in the saddle, and the height they sit at. */ seat?: THREE.Object3D; seatY?: number }
/** A drop of blood in the air, or a chip of wood from an engine or a hull. */
interface Drop { m: THREE.Mesh; vx: number; vy: number; vz: number; blood: boolean }
interface Stain { m: THREE.Mesh; t: number; grow: number; life: number }
interface Dying { g: THREE.Group; t: number; v: UnitView; clip: string; dropped: boolean }
const BLOOD = 0x7a0c10;
/** Recorded motions (walking, working, striking…), as turns of a figure's few joints. See scripts/motions.cjs. */
const motions = MOTIONS as unknown as Record<string, { dur: number; frames: number[][] }>;
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
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
  floaters: Floater[] = [];

  private sun: THREE.DirectionalLight;
  private unitViews = new Map<number, UnitView>();
  private buildingViews = new Map<number, THREE.Group>();
  private resViews = new Map<number, THREE.Group>();
  private treeIndex = new Map<number, number>();
  /** Every instanced part of the forest; a felled tree is hidden in each. */
  private forest: THREE.InstancedMesh[] = [];
  private scenery!: Scenery;
  private haze = new THREE.Fog(0x9fb0c4, 60, 160);
  private fogTex!: THREE.DataTexture;
  private fogAlpha: Float32Array;
  private rings: THREE.Mesh[] = [];
  private shots: THREE.Mesh[] = [];
  private pings: Ping[] = [];
  private ghost: THREE.Group | null = null;
  private ghostType = '';
  private ghostOk = true;
  private rally: THREE.Group;
  private ray = new THREE.Raycaster();
  private v3 = new THREE.Vector3();
  private clock = 0;
  private wallTick = -1;
  /** `?fog=0`: the whole map is shown, for looking at the game rather than playing it. */
  private noFog = new URLSearchParams(location.search).get('fog') === '0';
  /** `?motion=0`: figures are not given joints and move the old simple way. */
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
  private roads!: Roads;
  private weather!: Weather;
  private sky!: THREE.HemisphereLight;
  private tintC = new THREE.Color();
  private staffViews = new Map<number, { key: string; g: THREE.Group; figs: { g: THREE.Group; rig: Rig | null; role: string; seed: number; lean0: number }[] }>();
  private dust: Dust[] = [];
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
    this.scenery = buildScenery(game.size, game.terrain, game.spec.height, game.climate);
    this.scene.add(this.scenery.group);
    this.roads = new Roads(game, this.scenery, this.scene);
    this.weather = new Weather(this.scene, game.climate);
    this.buildTrees();
    this.buildFog();

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
    const trunkG = new THREE.CylinderGeometry(0.06, 0.11, 0.6, 6);
    trunkG.translate(0, 0.3, 0);
    const skirtG = new THREE.ConeGeometry(0.5, 0.9, 7);
    skirtG.translate(0, 0.8, 0);
    const topG = new THREE.ConeGeometry(0.34, 0.85, 7);
    topG.translate(0, 1.4, 0);
    wobble(skirtG, 0.14, 1); wobble(topG, 0.14, 2);
    const crownG = wobble(new THREE.IcosahedronGeometry(0.52, 2), 0.2, 3);
    crownG.scale(1, 0.85, 1);
    crownG.translate(0, 0.95, 0);
    const puffG = wobble(new THREE.IcosahedronGeometry(0.34, 2), 0.2, 5);
    puffG.translate(0.24, 1.25, 0.1);
    const inked = (color: number): THREE.Material => { const mt = new THREE.MeshToonMaterial({ color, gradientMap: RAMP }); mt.userData.outlineParameters = INK; return mt; };
    const leaf = () => inked(0xa4a4a4);
    const make = (g: THREE.BufferGeometry, mt: THREE.Material) => {
      const im = new THREE.InstancedMesh(g, mt, trees.length);
      im.castShadow = im.receiveShadow = true;
      this.forest.push(im);
      return im;
    };
    const trunks = make(trunkG, inked(0x5c4028));
    const skirt = make(skirtG, leaf()), top = make(topG, leaf()), crown = make(crownG, leaf()), puff = make(puffG, leaf());
    const m = new THREE.Matrix4(), none = new THREE.Matrix4().makeScale(0, 0, 0), q = new THREE.Quaternion(), col = new THREE.Color();
    trees.forEach((t, i) => {
      const h = ((t.id * 2654435761) >>> 0) / 4294967296;
      const h2 = ((t.id * 40503) % 1000) / 1000;
      const h3 = ((t.id * 7919) % 1000) / 1000;
      const sc = 0.85 + h * 0.5;
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, h * 6.28);
      const tx = t.x + (h2 - 0.5) * 0.3, tz = t.y + (h - 0.5) * 0.3;
      m.compose(new THREE.Vector3(tx, this.scenery.heightAt(tx, tz), tz), q, new THREE.Vector3(sc, sc * (0.9 + h2 * 0.3), sc));
      // Stands of fir with broadleaves among them, more of one or the other from grove to grove.
      const fir = this.game.climate === 'desert' ? false : this.game.climate === 'snow' ? h3 < 0.85 : h3 < 0.5 + 0.35 * Math.sin(t.x * 0.13 + t.y * 0.09);
      trunks.setMatrixAt(i, m);
      skirt.setMatrixAt(i, fir ? m : none); top.setMatrixAt(i, fir ? m : none);
      crown.setMatrixAt(i, fir ? none : m); puff.setMatrixAt(i, fir ? none : m);
      // Woods take the colour of the country: snow on the boughs in the cold, dusty olive in the dry.
      const cl = this.game.climate;
      if (cl === 'snow') {
        skirt.setColorAt(i, col.setHSL(0.4, 0.3, 0.22 + h * 0.06));
        top.setColorAt(i, col.setHSL(0.55, 0.12, 0.8 + h * 0.1));
        crown.setColorAt(i, col.setHSL(0.5, 0.1, 0.62 + h * 0.1));
        puff.setColorAt(i, col.setHSL(0.55, 0.12, 0.86));
      } else {
        const dry = cl === 'desert' ? 1 : cl === 'steppe' ? 0.6 : 0;
        skirt.setColorAt(i, col.setHSL(0.37 - dry * 0.1 + h2 * 0.04, 0.5 - dry * 0.15, 0.13 + h * 0.06 + dry * 0.05));
        top.setColorAt(i, col.setHSL(0.36 - dry * 0.1 + h2 * 0.04, 0.5 - dry * 0.15, 0.16 + h * 0.07 + dry * 0.05));
        crown.setColorAt(i, col.setHSL(0.26 - dry * 0.08 + h2 * 0.07, 0.62 - dry * 0.25, 0.2 + h * 0.08 + dry * 0.04));
        puff.setColorAt(i, col.setHSL(0.25 - dry * 0.08 + h2 * 0.07, 0.64 - dry * 0.25, 0.24 + h * 0.08 + dry * 0.04));
      }
      this.treeIndex.set(t.id, i);
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
    for (let i = 0; i < vis.length; i++) {
      const target = vis[i] === 2 ? 0 : vis[i] === 1 ? 0.45 : 1;
      a[i] += (target - a[i]) * k;
      d[i * 4 + 3] = a[i] * 255;
    }
    this.fogTex.needsUpdate = true;
  }

  // ---- Camera ----

  moveCamera(dxScreen: number, dyScreen: number): void {
    // Screen right is (+x, -z) and screen up is (-x, -z) on the ground for a 45 degree yaw.
    const k = Math.SQRT1_2;
    this.cx += (dxScreen - dyScreen) * k;
    this.cy += (-dxScreen - dyScreen) * k;
    this.clampCamera();
  }

  clampCamera(): void {
    const N = this.game.size;
    this.cx = Math.min(N, Math.max(0, this.cx));
    this.cy = Math.min(N, Math.max(0, this.cy));
    this.dist = Math.min(75, Math.max(14, this.dist));
  }

  private placeCamera(): void {
    const h = Math.cos(PITCH) * this.dist;
    this.camera.position.set(this.cx + h * Math.sin(YAW), Math.sin(PITCH) * this.dist, this.cy + h * Math.cos(YAW));
    const sh = this.shake > 0 ? Math.min(1, this.shake) * 0.12 : 0;
    this.camera.position.x += Math.sin(this.clock * 61) * sh;
    this.camera.position.y += Math.sin(this.clock * 47) * sh;
    this.camera.lookAt(this.cx, 0, this.cy);
    this.camera.updateMatrixWorld();
    const r = this.dist * 0.72;
    this.sun.position.set(this.cx - 38, 44, this.cy + 20);
    // Haze thickens toward the far edge of the view, and thins out when the camera is close in.
    // Weather draws the haze in, greys it, and takes the edge off the sun.
    const w = this.weather.amount;
    this.haze.near = this.dist * (1.25 - w * 0.75);
    this.haze.far = this.dist * (4.6 - w * 2.5);
    this.haze.color.set(0x9fb0c4).lerp(this.weather.tint(this.tintC), w);
    this.sun.intensity = 3.0 * (1 - w * 0.6);
    this.sky.intensity = 1.55 * (1 - w * 0.18);
    this.sun.target.position.set(this.cx, 0, this.cy);
    const sc = this.sun.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 160;
    sc.updateProjectionMatrix();
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
      if (b) { if (b.userData.site) this.scene.remove(b.userData.site as THREE.Object3D); if (b.visible && !b.userData.site) this.collapse(b); else this.scene.remove(b); this.buildingViews.delete(ev.id); const sv = this.staffViews.get(ev.id); if (sv) { this.scene.remove(sv.g); this.staffViews.delete(ev.id); } }
      const r = this.resViews.get(ev.id);
      if (r) { this.scene.remove(r); this.resViews.delete(ev.id); }
      const ti = this.treeIndex.get(ev.id);
      if (ti !== undefined) {
        const m = new THREE.Matrix4().makeScale(0, 0, 0);
        for (const im of this.forest) { im.setMatrixAt(ti, m); im.instanceMatrix.needsUpdate = true; }
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
      this.floaters.push({ x: ev.x, y: ev.y, text: '👶', t: 0 });
    } else if (ev.t === 'grown' && ev.player === this.game.humanId) {
      this.floaters.push({ x: ev.x, y: ev.y, text: '✨', t: 0 });
    } else if (ev.t === 'signal' && !this.game.hostile(ev.player, this.game.humanId)) {
      for (let i = 0; i < 3; i++) setTimeout(() => this.ping(ev.x, ev.y, 0x8ad0ff), i * 250);
    } else if (ev.t === 'quake') {
      if (Math.hypot(ev.x - this.cx, ev.y - this.cy) < this.dist) this.shake = 5;
      for (let i = 0; i < 5; i++) this.ping(ev.x + (Math.random() - 0.5) * 6, ev.y + (Math.random() - 0.5) * 6, 0xc8a070);
    } else if (ev.t === 'plague') {
      for (let i = 0; i < 4; i++) this.ping(ev.x + (Math.random() - 0.5) * 4, ev.y + (Math.random() - 0.5) * 4, 0x9ad04a);
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
    // Healed back past a stage, they are made whole again: gear restored, clothes mended.
    const mended = !!v && !!v.rig && v.hurt > (u.hp < u.maxHp * 0.33 ? 2 : u.hp < u.maxHp * 0.66 ? 1 : 0);
    if (v && (v.type !== u.type || v.job !== job || v.wear !== wear || mended)) {
      // Re-equipped by an upgrade, or set to a new trade: swap the model.
      turned = v.g.rotation.y;
      this.scene.remove(v.g);
      v = undefined;
    }
    if (!v) {
      v = { g: makeUnit(u.type, this.game.players[u.owner].color, u.gender, u.id, job, wear), phase: (u.id * 1.7) % 6.28, legs: [], type: u.type, rig: null, work: 0, job, wear, hp: u.hp, hurt: 0, flesh: u.def.cls !== 'siege' && !u.def.naval, cls: u.def.cls, naval: !!u.def.naval };
      if (turned !== null) v.g.rotation.y = turned;
      v.rig = this.still ? null : rigBiped(v.g);
      v.g.traverse((o) => {
        if (o.userData.leg === undefined) return;
        // A rider's legs are not walked: they sit astride, knees out and feet forward.
        const seat = o.parent && o.parent !== v!.g && o.parent.userData.biped ? o.parent : null;
        if (seat?.userData.stands) return;
        if (seat) { o.rotation.set(-0.75, 0, o.position.x > 0 ? 0.5 : -0.5); v!.seat = seat; v!.seatY = seat.userData.seatY ??= seat.position.y; }
        else v!.legs.push(o);
      });
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
    const size = u.growT > 0 ? 0.62 : 1;
    let bob = 0, pitch = 0, roll = 0, breathe = 1;
    if (u.def.naval) {
      // Afloat: riding the swell, rolling a little.
      bob = -0.05 + Math.sin(this.clock * 1.4 + v.phase) * 0.035;
      roll = Math.sin(this.clock * 1.1 + v.phase) * 0.05;
      pitch = Math.sin(this.clock * 0.9 + v.phase * 2) * 0.03;
    } else if (u.moving) {
      v.phase += dt * u.def.speed * 5;
      bob = v.rig ? 0 : mounted ? (0.5 - 0.5 * Math.cos(v.phase * 2)) * 0.05 : Math.abs(Math.sin(v.phase)) * 0.06;
      pitch = mounted ? Math.sin(v.phase * 2) * 0.06 : 0.07; // riders rock at the gallop; walkers lean into their stride
      roll = mounted || v.rig ? 0 : Math.sin(v.phase) * 0.05;
    } else {
      breathe = 1 + Math.sin(this.clock * 2.2 + v.phase) * 0.012; // standing, they still breathe
    }
    // A blow is struck with the whole body: a lunge forward and back.
    const lunge = u.def.naval || u.def.cls === 'siege' ? 0 : swing * 0.14;
    pitch += u.def.naval || u.def.cls === 'siege' ? 0 : u.def.cls === 'cavalry' ? -swing * 0.3 : swing * 0.16; // a horse rears to the blow
    g.position.set(x + Math.sin(g.rotation.y) * lunge, bob + this.scenery.heightAt(x, y), y + Math.cos(g.rotation.y) * lunge);
    g.scale.set(size, size * breathe, size);
    g.rotation.x += (pitch - g.rotation.x) * Math.min(1, dt * 14);
    g.rotation.z += (roll - g.rotation.z) * Math.min(1, dt * 14);
    let d = u.facing - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 12);
    if (v.rig) { this.pose(u, v, dt); }
    else for (const l of v.legs) {
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
    if (arm && !v.rig) {
      arm.rotation.x = u.type === 'catapult' ? swing * 1.2 : -swing * 1.3 + (u.moving ? Math.sin(v.phase) * 0.3 : 0);
    }
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
    if (v.cls === 'siege') {
      // An engine flies apart like a small building.
      this.spray(at.x, at.y + 0.5, at.z, 14, false);
      this.collapse(g);
      return;
    }
    if (v.flesh) { this.spray(at.x, at.y + 0.5, at.z, 16, true); this.stain(at.x, at.z, v.cls === 'beast' || v.cls === 'cavalry' ? 0.6 : 0.4, 3.5); }
    else this.spray(at.x, at.y + 0.4, at.z, 12, false);
    if (v.type === 'villager') this.tear(v, 3);
    this.dying.push({ g, t: 0, v, clip: (v.phase * 7) % 2 > 1 ? 'death1' : 'death2', dropped: false });
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
    if (lost > 0.5 && g.visible) this.spray(g.position.x, g.position.y + (v.rig ? 0.55 : 0.7), g.position.z, Math.min(6, 1 + Math.round((lost / u.maxHp) * 22)), v.flesh);
    v.hp = u.hp;
    const hurt = u.hp < u.maxHp * 0.33 ? 2 : u.hp < u.maxHp * 0.66 ? 1 : 0;
    if (hurt <= v.hurt || !v.rig) { if (!v.rig) v.hurt = hurt; return; }
    const rig = v.rig;
    g.updateMatrixWorld(true);
    if (u.type !== 'villager') {
      // A fighter's armour and gear are knocked off: about half of it at the first stage, all of it at the second.
      const on = rig.gear.filter((p) => p.parent && p.parent !== this.scene);
      for (const p of on.slice(0, hurt === 2 ? on.length : Math.ceil(on.length / 2))) { if (g.visible) this.throwPiece(p, g.position, 1, 0.5); else p.removeFromParent(); }
    }
    this.tear(v, hurt);
    v.hurt = hurt;
  }

  /**
   * Torn clothes and cuts. Nothing falls to the ground: cloth that is gone simply shows the skin beneath.
   * Fighters are mostly cut and bloodied; villagers' clothes tear, and at level 3 (in death) are in rags.
   */
  private tear(v: UnitView, level: number): void {
    const rig = v.rig;
    if (!rig || !this.gore) return;
    const SKIN = 0xe0ac7e, villager = v.type === 'villager';
    const seed = Math.round(v.phase * 1000) + level * 7, r = (k: number): number => (((seed + k * 97) * 2654435761) >>> 0) / 4294967296;
    const n = villager ? [0, 3, 5, 9][level] : [0, 3, 5, 5][level];
    for (let k = 0; k < n; k++) {
      const skin = villager ? k % 4 !== 3 : k % 2 === 0 && level < 2;
      const big = villager ? 1.5 + level * 0.25 : 1;
      const front = r(k) > 0.35 ? 1 : -1;
      const patch = new THREE.Mesh(new THREE.BoxGeometry((0.035 + r(k + 9) * 0.05) * big, (0.03 + r(k + 5) * 0.07) * big, 0.012), mat(skin ? SKIN : BLOOD, 0, true));
      patch.position.set((r(k + 1) - 0.5) * 0.17, 0.08 + r(k + 2) * 0.3, front * (0.094 - Math.abs(r(k + 1) - 0.5) * 0.05));
      patch.rotation.z = (r(k + 3) - 0.5) * 1.4;
      rig.torso.add(patch);
    }
    if (!villager || level < 2) return;
    // A sleeve torn away, then both; in rags, a skirt split to the thigh or a tunic open across the chest.
    const bare = (o: THREE.Object3D): void => o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh && m.userData.body !== undefined || (m.isMesh && m.parent === rig.armR)) m.material = mat(SKIN, 0, true); });
    if (rig.armR.children[0]) bare(rig.armR.children[0]);
    if (level < 3) return;
    for (const c of rig.armL.children) if (c.userData.body) bare(c);
    const skirt = rig.torso.children.find((c) => (c.userData.loose as { mode?: string } | undefined)?.mode === 'rx' && (c as THREE.Group).isGroup && c.position.y > -0.05 && c.position.y < 0.2);
    if (skirt) {
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.26, 0.012), mat(SKIN, 0, true));
      slit.position.set(r(40) > 0.5 ? 0.07 : -0.07, -0.26, 0.118);
      slit.rotation.x = -0.24;
      skirt.add(slit);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(SKIN, 0, true));
      sh.position.set(r(41) > 0.5 ? 0.1 : -0.1, 0.305, 0.01);
      rig.torso.add(sh);
    } else {
      const open = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.012), mat(SKIN, 0, true));
      open.position.set(0, 0.24, 0.1);
      open.rotation.z = (r(42) - 0.5) * 0.5;
      rig.torso.add(open);
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
  private syncStaff(b: Building, shown: boolean, lean: '' | 'holy' | 'low'): void {
    let women = 0, men = 0;
    for (const id of b.staff ?? []) { const s = this.game.entities.get(id) as Unit | undefined; if (s) { if (s.gender === 'f') women++; else men++; } }
    const key = `${women}:${men}:${lean}`;
    let sv = this.staffViews.get(b.id);
    if (sv && sv.key !== key) { this.scene.remove(sv.g); sv = undefined; this.staffViews.delete(b.id); }
    if (!sv && women + men > 0) {
      const g = new THREE.Group(), tav = b.type === 'tavern', half = b.size / 2, figs: { g: THREE.Group; rig: Rig | null; role: string; seed: number; lean0: number }[] = [];
      for (let i = 0; i < women + men; i++) {
        const f = i < women;
        const role = tav ? (f ? 'milkmaid' : 'patron') : f ? 'nun' : 'monk';
        const fig = makeStaff(role, b.id + i * 7, lean);
        // Along the front and round the near corner, where the camera sees them.
        const k = i - (women + men - 1) / 2;
        const x = i % 2 ? half - 0.12 : k * 0.42 + 0.3, z = i % 2 ? k * 0.42 + 0.2 : half - 0.12;
        fig.position.set(b.x + x, this.scenery.heightAt(b.x + x, b.y + z), b.y + z);
        fig.rotation.y = Math.PI / 4 + Math.sin(b.id + i * 3.1) * 0.5;
        fig.scale.setScalar(0.92);
        g.add(fig);
        figs.push({ g: fig, rig: this.still ? null : rigBiped(fig), role, seed: (b.id * 1.3 + i * 2.1) % 6.28, lean0: fig.rotation.z });
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
      if (f.rig) {
        const name = !busy ? 'idle' : f.role === 'patron' ? 'cheer' : 'reach';
        this.setPose(f.rig, name, busy ? (t % 2.6) / 2.6 : t / motions.idle.dur, 0.12);
        if (f.role === 'patron' && lean === 'low') f.g.rotation.z = f.lean0 + Math.sin(t * 1.3) * 0.08; // unsteady on his feet
      } else {
        f.g.rotation.x = busy || lean === 'holy' ? Math.max(0, Math.sin(t * 0.8)) * 0.28 : Math.sin(t * 0.9) * 0.03;
      }
    }
  }

  /** Sets a figure's joints from the recorded motion that fits what it is doing. */
  private pose(u: Unit, v: UnitView, dt: number): void {
    const rig = v.rig!;
    let name = 'idle', t = (this.clock + v.phase) / motions.idle.dur;
    if (u.attackAnim > 0) {
      name = u.type === 'villager' ? 'work' : u.def.range >= 3 ? 'shoot' : /spear|pike|lancer|hoplite|javelin|bill/.test(u.type) ? 'stab' : u.healTarget ? 'cast' : 'strike';
      // The blow lands in the middle of the recorded swing; play that part across the time the blow takes.
      t = 0.2 + (1 - Math.min(1, u.attackAnim / 0.35)) * 0.5;
      v.work = 0.5;
    } else if (u.moving) {
      name = u.def.speed > 1.25 ? 'run' : 'walk';
      t = v.phase / (Math.PI * 2);
    } else if (u.healTarget) {
      name = 'cast';
      t = this.clock / motions.cast.dur;
    } else if ((v.work -= dt) > 0 && u.type === 'villager') {
      // Between strokes a worker draws back for the next one instead of dropping to rest.
      name = 'work';
      t = 0.15;
    }
    this.setPose(rig, name, t, Math.min(1, dt * 16));
    this.swing(u, v, name === 'run', dt);
  }

  /** Turns the joints toward frame `t` (0 to 1, wrapping) of a recorded motion. `ease` lets one motion flow into the next. */
  private setPose(rig: Rig, name: string, t: number, ease: number): void {
    const m = motions[name], n = m.frames.length;
    const f = (((t % 1) + 1) % 1) * n, i = Math.floor(f) % n, k = f - Math.floor(f);
    const a = m.frames[i], b = m.frames[(i + 1) % n];
    const turn = (o: THREE.Object3D, at: number): void => {
      qa.set(a[at], a[at + 1], a[at + 2], a[at + 3]);
      qb.set(b[at], b[at + 1], b[at + 2], b[at + 3]);
      o.quaternion.slerp(qa.slerp(qb, k), ease);
    };
    rig.root.position.y += (0.3 * (1 + (a[0] + (b[0] - a[0]) * k) * 0.8) - rig.root.position.y) * ease;
    turn(rig.root, 1); turn(rig.torso, 5); turn(rig.head, 9);
    turn(rig.armR, 13); turn(rig.elbows[0], 17); turn(rig.armL, 21); turn(rig.elbows[1], 25);
    if (rig.legs[0]) { turn(rig.legs[0], 29); turn(rig.knees[0], 33); }
    if (rig.legs[1]) { turn(rig.legs[1], 37); turn(rig.knees[1], 41); }
  }

  /** Loose things on the body take each footfall and each blow, and go on swinging after. */
  private swing(u: Unit, v: UnitView, running: boolean, dt: number): void {
    const rig = v.rig!;
    const jolt = (u.moving ? Math.sin(v.phase * 2) * (running ? 34 : 26) : 0) + (u.attackAnim > 0 ? Math.cos((u.attackAnim / 0.35) * Math.PI) * 22 : 0);
    const steps = Math.max(1, Math.ceil(Math.min(dt, 0.1) / 0.012)), h = Math.min(dt, 0.1) / steps;
    for (const l of rig.loose) {
      for (let s = 0; s < steps; s++) { l.v += (-l.k * l.d - l.c * l.v + jolt * l.gain) * h; l.d += l.v * h; }
      const lim = l.mode === 'y' ? 0.035 : 0.7;
      if (l.d > lim) { l.d = lim; l.v = 0; } else if (l.d < -lim) { l.d = -lim; l.v = 0; }
      if (l.mode === 'y') l.o.position.y = l.rest + l.d; else if (l.mode === 'rx') l.o.rotation.x = l.rest + l.d; else l.o.rotation.z = l.rest + l.d;
    }
  }

  /** A building that falls comes apart: every piece is thrown clear, tumbles, settles and sinks away. */
  private collapse(g: THREE.Group): void {
    g.updateMatrixWorld(true);
    const parts: THREE.Mesh[] = [];
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
      g = makeBuilding(b.type, this.game.players[b.owner].color, this.game.players[b.owner].age, this.game.players[b.owner].civ, lean, (b.id * 7 + 3) % 97); // the same plot always gets the same house
      g.userData.lean = lean;
      // A building sits on the lowest corner of its plot, so no wall hangs in the air.
      const k = b.size / 2 - 0.1, hh = this.scenery.heightAt.bind(this.scenery);
      g.position.set(b.x, Math.min(hh(b.x, b.y), hh(b.x - k, b.y - k), hh(b.x + k, b.y - k), hh(b.x - k, b.y + k), hh(b.x + k, b.y + k)), b.y);
      this.buildingViews.set(b.id, g);
      this.scene.add(g);
    }
    g.visible = this.isVisible(b);
    if (b.def.staff) this.syncStaff(b, g.visible && b.complete, lean);
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
    const game = this.game;
    this.clock += dt;
    if (this.shake > 0) this.shake -= dt;
    this.placeCamera();
    for (const u of game.units) this.syncUnit(u, alpha, dt);
    for (const b of game.buildings) this.syncBuilding(b);
    if ((this.wallTick = (this.wallTick + 1) % 12) === 0) this.linkWalls();
    for (const r of game.resources) this.syncResource(r);
    this.updateFog(dt);
    this.scenery.update(this.clock);

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

    // Projectiles.
    const ps = game.projectiles;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!this.shots[i]) {
        this.shots[i] = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), mat(0x3a2a1a));
        this.scene.add(this.shots[i]);
      }
      const m = this.shots[i];
      const total = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 1;
      const t = Math.min(1, Math.hypot(p.x - p.sx, p.y - p.sy) / total);
      const arc = p.kind === 'boulder' ? total * 0.3 : p.kind === 'shot' ? 0 : total * 0.08;
      const big = p.kind === 'boulder' ? 5 : p.kind === 'stone' ? 2 : p.kind === 'shot' ? 1.4 : 1;
      m.scale.set(big, big, p.kind === 'arrow' ? 1 : 0.1 * big);
      const gh = this.scenery.heightAt(p.sx, p.sy) * (1 - t) + this.scenery.heightAt(p.tx, p.ty) * t;
      m.position.set(p.x, gh + 0.8 + Math.sin(t * Math.PI) * arc, p.y);
      m.lookAt(p.tx, this.scenery.heightAt(p.tx, p.ty) + 0.8 + Math.cos(t * Math.PI) * arc * -2, p.ty);
      m.visible = game.vis[Math.floor(p.y) * game.size + Math.floor(p.x)] === 2;
    }
    for (let i = ps.length; i < this.shots.length; i++) this.shots[i].visible = false;

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
      const rig = d.v.rig;
      if (rig) {
        // Struck down: the recorded fall, weapon and shield dropping from the hands, then the body lies a while.
        const m = motions[d.clip];
        this.setPose(rig, d.clip, Math.min(0.999, d.t / m.dur) * (1 - 1 / m.frames.length), Math.min(1, dt * 18));
        if (!d.dropped && d.t > 0.25) {
          d.dropped = true;
          d.g.updateMatrixWorld(true);
          for (const w of [...rig.held, ...rig.gear.filter((p) => p.parent === rig.armL || p.parent === rig.elbows[1])]) this.throwPiece(w, d.g.position, 1, 0.5);
        }
        if (d.t > 7) d.g.position.y -= dt * 0.12;
        if (d.t > 10) { this.scene.remove(d.g); this.dying.splice(i, 1); }
      } else if (d.v.naval) {
        // A ship settles by the stern and goes down.
        d.g.rotation.x += (-0.5 - d.g.rotation.x) * Math.min(1, dt * 1.5);
        d.g.rotation.z += (0.25 - d.g.rotation.z) * Math.min(1, dt * 1.5);
        d.g.position.y -= dt * (0.12 + d.t * 0.12);
        if (d.t > 4) { this.scene.remove(d.g); this.dying.splice(i, 1); }
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
