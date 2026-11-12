// Three.js scene: terrain, fog of war, entity meshes and the RTS camera.

import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import { Building, Entity, Game, GameEvent, ResourceNode, Unit } from '../sim/game';
import { buildScenery, Scenery } from './scenery';
import { makeBuilding, makeResource, makeUnit, mat, RES_COLOR } from './models';

const PITCH = (50 * Math.PI) / 180;
const YAW = Math.PI / 4; // the map appears as a diamond, like the classic isometric RTS view
const FOV = 30;

interface UnitView { g: THREE.Group; phase: number; legs: THREE.Object3D[]; type: string }
interface Floater { x: number; y: number; text: string; t: number }
interface Ping { mesh: THREE.Mesh; t: number }

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
  private sky!: THREE.HemisphereLight;
  private fill!: THREE.DirectionalLight;
  /** How the town stands, from -1 (decadent) to 1 (righteous), eased so the light turns slowly. */
  private mood = 0;
  private veil: HTMLDivElement;
  private motes!: THREE.Points;
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
  private shake = 0;
  private dying: { g: THREE.Group; t: number }[] = [];
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
    const fill = this.fill = new THREE.DirectionalLight(0xa8c0ec, 0.9); // sky light from the shadow side, so shade is blue, not black
    fill.position.set(40, 30, -30);
    this.scene.add(fill);
    // A wash over the whole view that follows the town's standing: a golden glow, or a wine-dark closing in.
    this.veil = document.createElement('div');
    this.veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;mix-blend-mode:soft-light;transition:opacity 1s';
    canvas.after(this.veil);
    // Things in the air: golden motes in a righteous town, red sparks and smoke-glow in a decadent one.
    const mp = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { mp[i * 3] = (Math.random() - 0.5) * 60; mp[i * 3 + 1] = Math.random() * 9; mp[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffe9a8, size: 0.16, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
    this.scene.add(this.sun, this.sun.target);

    this.fogAlpha = new Float32Array(game.size * game.size).fill(1);
    this.scenery = buildScenery(game.size, game.terrain, game.spec.height);
    this.scene.add(this.scenery.group);
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
    const crownG = new THREE.IcosahedronGeometry(0.5, 1);
    crownG.scale(1, 0.85, 1);
    crownG.translate(0, 0.95, 0);
    const puffG = new THREE.IcosahedronGeometry(0.32, 0);
    puffG.translate(0.24, 1.25, 0.1);
    const leaf = () => new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const make = (g: THREE.BufferGeometry, mt: THREE.Material) => {
      const im = new THREE.InstancedMesh(g, mt, trees.length);
      im.castShadow = im.receiveShadow = true;
      this.forest.push(im);
      return im;
    };
    const trunks = make(trunkG, new THREE.MeshLambertMaterial({ color: 0x5c4028 }));
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
      const fir = h3 < 0.5 + 0.35 * Math.sin(t.x * 0.13 + t.y * 0.09);
      trunks.setMatrixAt(i, m);
      skirt.setMatrixAt(i, fir ? m : none); top.setMatrixAt(i, fir ? m : none);
      crown.setMatrixAt(i, fir ? none : m); puff.setMatrixAt(i, fir ? none : m);
      skirt.setColorAt(i, col.setHSL(0.37 + h2 * 0.04, 0.5, 0.13 + h * 0.06));
      top.setColorAt(i, col.setHSL(0.36 + h2 * 0.04, 0.5, 0.16 + h * 0.07));
      crown.setColorAt(i, col.setHSL(0.26 + h2 * 0.07, 0.62, 0.2 + h * 0.08));
      puff.setColorAt(i, col.setHSL(0.25 + h2 * 0.07, 0.64, 0.24 + h * 0.08));
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

  /**
   * The look of the world follows the player's standing: the more righteous the town, the warmer
   * and more golden the light; the more decadent, the redder, smokier and more lamplit.
   */
  private setMood(dt: number): void {
    const p = this.game.players[this.game.humanId];
    const want = Math.max(-1, Math.min(1, (p?.virtue ?? 0) / 100));
    this.mood += (want - this.mood) * Math.min(1, dt * 0.6);
    const m = this.mood, holy = Math.max(0, m), low = Math.max(0, -m);
    const mix = (base: number, warm: number, lurid: number) => new THREE.Color(base).lerp(new THREE.Color(warm), holy).lerp(new THREE.Color(lurid), low);
    this.sun.color.copy(mix(0xffe2b4, 0xffd08a, 0xffb0a0));
    this.sun.intensity = 3.0 + holy * 0.5 - low * 0.7;
    this.sky.color.copy(mix(0xd6e6ff, 0xfff0d2, 0xd0b0e0));
    this.sky.groundColor.copy(mix(0x8a7858, 0xa08a58, 0x7a5060));
    this.fill.color.copy(mix(0xa8c0ec, 0xf0d8b0, 0xd890c8));
    this.fill.intensity = 0.9 + low * 0.25;
    this.haze.color.copy(mix(0x9fb0c4, 0xe6cf9a, 0x7a4468));
    this.gl.toneMappingExposure = 1.02 + holy * 0.1 - low * 0.08;
    // The wash: gold spreading from the middle, or rose in the middle with the edges drawing dark.
    this.veil.style.background = m >= 0
      ? 'radial-gradient(ellipse at 50% 45%, #ffe2a0 0%, #ffcf80 55%, #e8a860 100%)'
      : 'radial-gradient(ellipse at 50% 55%, #ff9ab8 0%, #c04a7a 50%, #1c0616 100%)';
    this.veil.style.opacity = String(m >= 0 ? Math.min(0.55, m * 0.6) : Math.min(0.3, -m * 0.32));
    // Motes rise slowly in the light; sparks climb faster and flicker.
    const mat = this.motes.material as THREE.PointsMaterial, pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    mat.opacity = Math.min(0.85, Math.abs(m) * 1.1) * (m < 0 ? 0.7 + 0.3 * Math.sin(this.clock * 9) : 1);
    mat.color.setHex(m >= 0 ? 0xffe9a8 : 0xff5a6a);
    mat.size = m >= 0 ? 0.14 : 0.2;
    if (mat.opacity > 0.01) {
      const rise = m >= 0 ? 0.25 : 0.9;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * rise * (0.6 + (i % 5) * 0.2);
        if (y > 9) y = 0;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(this.clock * 0.7 + i) * dt * 0.25);
      }
      pos.needsUpdate = true;
      this.motes.position.set(this.cx, 0, this.cy);
    }
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
    this.haze.near = this.dist * 1.25;
    this.haze.far = this.dist * 4.6;
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
        if (u.g.visible) this.dying.push({ g: u.g, t: 0 });
        else this.scene.remove(u.g);
        this.unitViews.delete(ev.id);
      }
      const b = this.buildingViews.get(ev.id);
      if (b) { this.scene.remove(b); this.buildingViews.delete(ev.id); }
      const r = this.resViews.get(ev.id);
      if (r) { this.scene.remove(r); this.resViews.delete(ev.id); }
      const ti = this.treeIndex.get(ev.id);
      if (ti !== undefined) {
        const m = new THREE.Matrix4().makeScale(0, 0, 0);
        for (const im of this.forest) { im.setMatrixAt(ti, m); im.instanceMatrix.needsUpdate = true; }
        this.treeIndex.delete(ev.id);
      }
    } else if (ev.t === 'age') {
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
    if (v && v.type !== u.type) {
      // Re-equipped by an upgrade: swap the model.
      this.scene.remove(v.g);
      v = undefined;
    }
    if (!v) {
      v = { g: makeUnit(u.type, this.game.players[u.owner].color, u.gender, u.id), phase: (u.id * 1.7) % 6.28, legs: [], type: u.type };
      v.g.traverse((o) => { if (o.userData.leg !== undefined) v!.legs.push(o); });
      v.g.rotation.order = 'YXZ'; // so leaning forward and rocking are in the unit's own frame, whichever way it faces
      this.unitViews.set(u.id, v);
      this.scene.add(v.g);
    }
    const g = v.g;
    g.visible = this.isVisible(u);
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
      bob = Math.abs(Math.sin(v.phase)) * (mounted ? 0.09 : 0.06);
      pitch = mounted ? Math.sin(v.phase * 2) * 0.06 : 0.07; // riders rock at the gallop; walkers lean into their stride
      roll = mounted ? 0 : Math.sin(v.phase) * 0.05;
    } else {
      breathe = 1 + Math.sin(this.clock * 2.2 + v.phase) * 0.012; // standing, they still breathe
    }
    // A blow is struck with the whole body: a lunge forward and back.
    const lunge = u.def.naval || u.def.cls === 'siege' ? 0 : swing * 0.14;
    pitch += u.def.naval || u.def.cls === 'siege' ? 0 : swing * 0.16;
    g.position.set(x + Math.sin(g.rotation.y) * lunge, bob + this.scenery.heightAt(x, y), y + Math.cos(g.rotation.y) * lunge);
    g.scale.set(size, size * breathe, size);
    g.rotation.x += (pitch - g.rotation.x) * Math.min(1, dt * 14);
    g.rotation.z += (roll - g.rotation.z) * Math.min(1, dt * 14);
    let d = u.facing - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 12);
    for (const l of v.legs) l.rotation.x = u.moving ? Math.sin(v.phase + (l.userData.leg as number)) * 0.65 : l.rotation.x * 0.8;
    const arm = g.userData.arm as THREE.Object3D | undefined;
    if (arm) {
      arm.rotation.x = u.type === 'catapult' ? swing * 1.2 : -swing * 1.3 + (u.moving ? Math.sin(v.phase) * 0.3 : 0);
    }
    const ramLog = g.userData.ram as THREE.Object3D | undefined;
    if (ramLog) ramLog.position.z = u.attackAnim > 0 ? Math.sin((u.attackAnim / 0.35) * Math.PI) * 0.35 : 0;
    const carry = g.userData.carry as THREE.Mesh | undefined;
    if (carry) {
      carry.visible = u.carryAmt > 0;
      if (carry.visible) carry.material = mat(RES_COLOR[u.carryType]);
    }
    const glow = g.userData.glow as THREE.Mesh | undefined;
    if (glow) glow.scale.setScalar(u.healTarget ? 1.3 + Math.sin(this.clock * 10) * 0.4 : 1);
  }

  private syncBuilding(b: Building): void {
    let g = this.buildingViews.get(b.id);
    if (!g) {
      g = makeBuilding(b.type, this.game.players[b.owner].color, this.game.players[b.owner].age, this.game.players[b.owner].civ);
      // A building sits on the lowest corner of its plot, so no wall hangs in the air.
      const k = b.size / 2 - 0.1, hh = this.scenery.heightAt.bind(this.scenery);
      g.position.set(b.x, Math.min(hh(b.x, b.y), hh(b.x - k, b.y - k), hh(b.x + k, b.y - k), hh(b.x - k, b.y + k), hh(b.x + k, b.y + k)), b.y);
      this.buildingViews.set(b.id, g);
      this.scene.add(g);
    }
    g.visible = this.isVisible(b);
    g.scale.y = b.complete ? 1 : 0.12 + 0.88 * b.progress;
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
    for (const r of game.resources) this.syncResource(r);
    this.updateFog(dt);
    this.scenery.update(this.clock);
    this.setMood(dt);

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
      d.g.rotation.x = 0;
      d.g.rotation.z = Math.min(1, d.t / 0.35) * (Math.PI / 2);
      if (d.t > 1.2) d.g.position.y -= dt * 0.6;
      if (d.t > 2.2) { this.scene.remove(d.g); this.dying.splice(i, 1); }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) if ((this.floaters[i].t += dt) > 2) this.floaters.splice(i, 1);

    this.gl.render(this.scene, this.camera);
  }
}
