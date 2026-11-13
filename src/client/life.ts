// The world going about its own business: birds overhead, butterflies over the grass, fireflies after dark,
// rabbits that bolt when someone comes near, fish breaking the surface, tumbleweed on the wind, pollen and dust
// in the air. None of it is part of the game's rules; it is only drawn.

import * as THREE from 'three';
import { Climate, T_GRASS, T_MARSH, T_SAND, T_SNOW, T_WATER } from '../sim/map';

interface World {
  size: number;
  terrain: Uint8Array;
  occupied: Uint8Array;
  climate: Climate;
  vis: Uint8Array;
  units: { x: number; y: number; dead?: boolean }[];
}
interface Bird { g: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; shadow: THREE.Mesh; ox: number; oz: number; phase: number }
interface Flock { birds: Bird[]; x: number; y: number; h: number; dir: number; turn: number; speed: number; circle: { x: number; y: number; r: number } | null; a: number; flap: number }
interface Flutter { g: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; hx: number; hy: number; t: number; k: number }
interface Hopper { g: THREE.Group; x: number; y: number; tx: number; ty: number; t: number; wait: number; hop: number; face: number; scared: number }
interface Weed { m: THREE.Mesh; x: number; y: number; t: number; s: number }
interface Leap { fish: THREE.Mesh; ring: THREE.Mesh; x: number; y: number; t: number; dir: number }

const plain = (color: number, opts: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial => {
  const m = new THREE.MeshBasicMaterial({ color, ...opts });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const lit = (color: number): THREE.MeshLambertMaterial => {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
  m.userData.outlineParameters = { visible: false };
  return m;
};
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export class Life {
  private group = new THREE.Group();
  private flocks: Flock[] = [];
  private flutters: Flutter[] = [];
  private hoppers: Hopper[] = [];
  private weeds: Weed[] = [];
  private leaps: Leap[] = [];
  private leapT = 2;
  private scareT = 0;
  private flies: THREE.Points | null = null;
  private flyHome: Float32Array = new Float32Array(0);
  private motes: THREE.Points;
  private moteMat: THREE.PointsMaterial;
  private hasWater = false;
  /** Set false to draw the whole map (no fog of war). */
  fogged = true;

  constructor(scene: THREE.Scene, private world: World, private heightAt: (x: number, y: number) => number) {
    scene.add(this.group);
    const N = world.size, c = world.climate;
    for (let i = 0; i < N * N; i += 7) if (world.terrain[i] === T_WATER) { this.hasWater = true; break; }

    // ---- birds ----
    // Songbirds cross the country in loose flocks; gulls wheel over water; in the desert, vultures circle high.
    const wingG = new THREE.BufferGeometry();
    wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.06, 0, 0, -0.06, 0.3, 0, -0.02], 3));
    wingG.computeVertexNormals();
    const bodyG = new THREE.ConeGeometry(0.035, 0.2, 5).rotateX(Math.PI / 2);
    const shadowG = new THREE.CircleGeometry(0.12, 8).rotateX(-Math.PI / 2);
    const shadowM = plain(0x000000, { transparent: true, opacity: 0.16, depthWrite: false });
    const flock = (n: number, color: number, size: number, h: number, speed: number, circle: Flock['circle']): void => {
      const m = plain(color, { side: THREE.DoubleSide });
      const f: Flock = { birds: [], x: rnd(0, N), y: rnd(0, N), h, dir: rnd(0, 6.28), turn: 0, speed, circle, a: rnd(0, 6.28), flap: circle ? 3 : 9 };
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(bodyG, m));
        const l = new THREE.Mesh(wingG, m), r = new THREE.Mesh(wingG, m);
        r.scale.x = -1;
        g.add(l, r);
        g.scale.setScalar(size * rnd(0.85, 1.15));
        const shadow = new THREE.Mesh(shadowG, shadowM);
        shadow.scale.setScalar(size);
        shadow.renderOrder = 2;
        this.group.add(g, shadow);
        // A ragged V behind the leader.
        const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
        f.birds.push({ g, l, r, shadow, ox: side * row * 0.55 + rnd(-0.15, 0.15), oz: -row * 0.5 + rnd(-0.15, 0.15), phase: rnd(0, 6.28) });
      }
      this.flocks.push(f);
    };
    const dark = c === 'snow' ? 0x30343a : 0x2c2a28;
    for (let i = 0; i < Math.max(3, Math.round(N / 24)); i++) flock(3 + Math.floor(Math.random() * 5), dark, 1, rnd(4.5, 6.5), rnd(2.6, 3.6), null);
    if (this.hasWater) {
      // Gulls keep to the water.
      for (let k = 0; k < 3; k++) {
        for (let tries = 0; tries < 60; tries++) {
          const x = rnd(4, N - 4), y = rnd(4, N - 4);
          if (world.terrain[Math.floor(y) * N + Math.floor(x)] === T_WATER) { flock(3, 0xf2f2ee, 1.1, rnd(3.5, 5), 2.2, { x, y, r: rnd(2.5, 5) }); break; }
        }
      }
    }
    if (c === 'desert' || c === 'steppe') for (let k = 0; k < 2; k++) flock(c === 'desert' ? 3 : 1, 0x1c1a18, 1.9, 8, 1.5, { x: rnd(10, N - 10), y: rnd(10, N - 10), r: rnd(4, 7) });

    // ---- butterflies: green and steppe country, by day ----
    if (c !== 'snow' && c !== 'desert') {
      const wing = new THREE.PlaneGeometry(0.07, 0.09).translate(0.035, 0, 0).rotateX(-Math.PI / 2);
      const hues = [0xffffff, 0xf7d84a, 0xf08a2c, 0x7fb8f0, 0xf4a0c0];
      for (let i = 0; i < 26; i++) {
        const m = plain(hues[i % hues.length], { side: THREE.DoubleSide });
        const g = new THREE.Group(), l = new THREE.Mesh(wing, m), r = new THREE.Mesh(wing, m);
        r.scale.x = -1;
        g.add(l, r);
        g.visible = false;
        this.group.add(g);
        this.flutters.push({ g, l, r, hx: -99, hy: -99, t: rnd(0, 50), k: rnd(0.7, 1.4) });
      }
      // ---- fireflies: the same country, by night ----
      const n = 70, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      this.flyHome = new Float32Array(n * 3).fill(-99);
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      fg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const fm = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      fm.userData.outlineParameters = { visible: false };
      this.flies = new THREE.Points(fg, fm);
      this.flies.frustumCulled = false;
      this.group.add(this.flies);
    }

    // ---- rabbits and hares ----
    if (c !== 'desert') {
      const fur = c === 'snow' ? 0xf0f2f4 : c === 'steppe' ? 0xb89a6c : 0x9a7e5e;
      const fm = lit(fur), tm = lit(0xffffff), em = lit(c === 'snow' ? 0xd8dadc : 0x7a6248);
      const body = new THREE.SphereGeometry(0.07, 7, 5), head = new THREE.SphereGeometry(0.045, 6, 5), ear = new THREE.ConeGeometry(0.014, 0.08, 4), tail = new THREE.SphereGeometry(0.022, 5, 4);
      for (let i = 0; i < 10; i++) {
        const g = new THREE.Group();
        const b = new THREE.Mesh(body, fm); b.scale.set(0.8, 0.85, 1.25); b.position.y = 0.065;
        const h = new THREE.Mesh(head, fm); h.position.set(0, 0.11, 0.085);
        const e1 = new THREE.Mesh(ear, em); e1.position.set(0.018, 0.17, 0.07); e1.rotation.x = -0.25;
        const e2 = new THREE.Mesh(ear, em); e2.position.set(-0.018, 0.17, 0.07); e2.rotation.x = -0.25;
        const t = new THREE.Mesh(tail, tm); t.position.set(0, 0.07, -0.085);
        g.add(b, h, e1, e2, t);
        b.castShadow = true;
        g.visible = false;
        this.group.add(g);
        this.hoppers.push({ g, x: -99, y: -99, tx: 0, ty: 0, t: 0, wait: rnd(0, 3), hop: 0, face: 0, scared: 0 });
      }
    }

    // ---- tumbleweed ----
    if (c === 'desert' || c === 'steppe') {
      const wg = new THREE.IcosahedronGeometry(0.13, 1);
      const wm = new THREE.MeshBasicMaterial({ color: 0x8a6e44, wireframe: true });
      wm.userData.outlineParameters = { visible: false };
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(wg, wm);
        m.visible = false;
        this.group.add(m);
        this.weeds.push({ m, x: -99, y: -99, t: rnd(0, 9), s: rnd(0.8, 1.4) });
      }
    }

    // ---- what hangs in the air: pollen and seed in green country, dust in dry ----
    {
      const n = 90, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-14, 14); pos[i * 3 + 1] = rnd(0.2, 2.6); pos[i * 3 + 2] = rnd(-14, 14); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.moteMat = new THREE.PointsMaterial({ size: 0.045, color: c === 'desert' || c === 'steppe' ? 0xe8d4a8 : c === 'snow' ? 0xffffff : 0xfff6c8, transparent: true, opacity: 0.6, depthWrite: false });
      this.moteMat.userData.outlineParameters = { visible: false };
      this.motes = new THREE.Points(g, this.moteMat);
      this.motes.frustumCulled = false;
      this.group.add(this.motes);
    }
  }

  private kind(x: number, y: number): number {
    const N = this.world.size;
    return x < 0 || y < 0 || x >= N || y >= N ? T_WATER : this.world.terrain[Math.floor(y) * N + Math.floor(x)];
  }
  private seen(x: number, y: number): boolean {
    const N = this.world.size;
    if (x < 0 || y < 0 || x >= N || y >= N) return false;
    return !this.fogged || this.world.vis[Math.floor(y) * N + Math.floor(x)] > 0;
  }
  /** Somewhere of the wanted kind near the middle of the view, or null. */
  private spot(cx: number, cy: number, reach: number, ok: (t: number) => boolean, free = false): { x: number; y: number } | null {
    const N = this.world.size;
    for (let k = 0; k < 8; k++) {
      const x = cx + rnd(-reach, reach), y = cy + rnd(-reach, reach);
      if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1) continue;
      const i = Math.floor(y) * N + Math.floor(x);
      if (ok(this.world.terrain[i]) && (!free || !this.world.occupied[i])) return { x, y };
    }
    return null;
  }

  /** `day` is 1 in daylight to 0 at night; `foul` is how hard it is raining or snowing, 0 to 1. `(cx, cy)` is where the camera looks. */
  update(dt: number, clock: number, day: number, foul: number, cx: number, cy: number): void {
    const N = this.world.size;
    const out = day > 0.35 && foul < 0.5; // birds and butterflies keep to fair daylight

    // ---- birds ----
    for (const f of this.flocks) {
      if (f.circle) {
        f.a += (dt * f.speed) / f.circle.r;
        f.x = f.circle.x + Math.cos(f.a) * f.circle.r;
        f.y = f.circle.y + Math.sin(f.a) * f.circle.r;
        f.dir = f.a + Math.PI / 2;
      } else {
        f.turn += (Math.random() - 0.5) * dt * 0.8;
        f.turn *= 1 - dt * 0.5;
        // Turn back toward the land when over the edge.
        if (f.x < -6 || f.y < -6 || f.x > N + 6 || f.y > N + 6) {
          const want = Math.atan2(N / 2 - f.y, N / 2 - f.x);
          f.dir += Math.atan2(Math.sin(want - f.dir), Math.cos(want - f.dir)) * dt * 0.8;
        } else f.dir += f.turn * dt;
        f.x += Math.cos(f.dir) * f.speed * dt;
        f.y += Math.sin(f.dir) * f.speed * dt;
      }
      const cs = Math.cos(f.dir), sn = Math.sin(f.dir);
      f.birds.forEach((b, i) => {
        // Each bird's place in the flock, turned to the heading.
        const spread = f.circle ? 2.2 : 1;
        const lx = b.ox * spread, lz = b.oz * spread + (f.circle ? i * -1.6 : 0);
        const x = f.x + cs * lz - sn * lx, y = f.y + sn * lz + cs * lx;
        const show = out && this.seen(x, y);
        b.g.visible = b.shadow.visible = show;
        if (!show) return;
        const bob = Math.sin(clock * 1.3 + b.phase) * 0.15;
        b.g.position.set(x, f.h + bob, y);
        b.g.rotation.y = -f.dir + Math.PI / 2;
        // Soarers hold their wings out and tip them; flappers beat.
        const w = f.circle ? 0.12 + Math.sin(clock * f.flap + b.phase) * 0.12 : Math.sin(clock * f.flap + b.phase) * 0.75;
        b.l.rotation.z = w; b.r.rotation.z = -w;
        b.g.rotation.z = f.circle ? -0.3 : 0;
        b.shadow.position.set(x - (f.h + bob) * 0.55, this.heightAt(x - f.h * 0.55, y + f.h * 0.3) + 0.05, y + (f.h + bob) * 0.3);
      });
    }

    // ---- butterflies ----
    for (const b of this.flutters) {
      b.t += dt * b.k;
      if (Math.abs(b.hx - cx) > 13 || Math.abs(b.hy - cy) > 13 || this.kind(b.hx, b.hy) !== T_GRASS) {
        const s = this.spot(cx, cy, 11, (t) => t === T_GRASS);
        if (s) { b.hx = s.x; b.hy = s.y; } else { b.g.visible = false; continue; }
      }
      const x = b.hx + Math.sin(b.t * 0.7) * 0.7 + Math.sin(b.t * 1.9) * 0.2, y = b.hy + Math.cos(b.t * 0.5) * 0.7 + Math.sin(b.t * 2.3) * 0.2;
      b.g.visible = out && this.seen(x, y);
      if (!b.g.visible) continue;
      b.g.position.set(x, this.heightAt(x, y) + 0.3 + Math.sin(b.t * 3.1) * 0.12, y);
      b.g.rotation.y = b.t * 0.9;
      const w = Math.abs(Math.sin(b.t * 14)) * 1.2;
      b.l.rotation.z = w; b.r.rotation.z = -w;
    }

    // ---- fireflies ----
    if (this.flies) {
      const glow = Math.max(0, 1 - day * 2.2) * (1 - foul);
      this.flies.visible = glow > 0.02;
      if (this.flies.visible) {
        const pos = this.flies.geometry.getAttribute('position') as THREE.BufferAttribute, col = this.flies.geometry.getAttribute('color') as THREE.BufferAttribute, home = this.flyHome;
        for (let i = 0; i < pos.count; i++) {
          let hx = home[i * 3], hy = home[i * 3 + 2];
          if (Math.abs(hx - cx) > 14 || Math.abs(hy - cy) > 14) {
            const s = this.spot(cx, cy, 12, (t) => t === T_GRASS || t === T_MARSH);
            if (!s) { col.setXYZ(i, 0, 0, 0); continue; }
            hx = home[i * 3] = s.x; hy = home[i * 3 + 2] = s.y; home[i * 3 + 1] = rnd(0.2, 0.9);
          }
          const t = clock * 0.5 + i * 1.7;
          const x = hx + Math.sin(t) * 0.5 + Math.sin(t * 2.3 + i) * 0.2, y = hy + Math.cos(t * 0.8) * 0.5;
          pos.setXYZ(i, x, this.heightAt(x, y) + home[i * 3 + 1] + Math.sin(t * 1.7) * 0.1, y);
          // Each one lights in its own slow rhythm.
          const on = this.seen(x, y) ? Math.max(0, Math.sin(clock * (1.1 + (i % 5) * 0.23) + i * 2.1)) ** 1.5 * glow : 0;
          col.setXYZ(i, 0.85 * on, 1.0 * on, 0.35 * on);
        }
        pos.needsUpdate = col.needsUpdate = true;
      }
    }

    // ---- rabbits ----
    this.scareT -= dt;
    const look = this.scareT <= 0;
    if (look) this.scareT = 0.3;
    const grassy = (t: number) => t === T_GRASS || (this.world.climate === 'snow' && t === T_SNOW);
    for (const h of this.hoppers) {
      if (Math.abs(h.x - cx) > 15 || Math.abs(h.y - cy) > 15) {
        // Out of sight: turn up again somewhere at the edge of the view.
        const s = this.spot(cx, cy, 13, grassy, true);
        if (!s || (Math.abs(s.x - cx) < 6 && Math.abs(s.y - cy) < 6)) { h.g.visible = false; continue; }
        h.x = h.tx = s.x; h.y = h.ty = s.y; h.wait = rnd(0.5, 3); h.hop = 0;
      }
      if (look) {
        // Anyone within a few paces sends it bolting the other way.
        for (const u of this.world.units) {
          if (u.dead) continue;
          const dx = h.x - u.x, dy = h.y - u.y, d2 = dx * dx + dy * dy;
          if (d2 < 5 && d2 > 0.0001) {
            const d = Math.sqrt(d2), tx = h.x + (dx / d) * 2.2 + rnd(-0.6, 0.6), ty = h.y + (dy / d) * 2.2 + rnd(-0.6, 0.6);
            if (grassy(this.kind(tx, ty)) && !this.world.occupied[Math.floor(ty) * N + Math.floor(tx)]) { h.tx = tx; h.ty = ty; h.wait = 0; h.scared = 1.5; }
            break;
          }
        }
      }
      h.scared = Math.max(0, h.scared - dt);
      const dx = h.tx - h.x, dy = h.ty - h.y, d = Math.hypot(dx, dy);
      if (d < 0.05) {
        h.hop = 0;
        h.wait -= dt;
        if (h.wait <= 0) {
          const tx = h.x + rnd(-1.6, 1.6), ty = h.y + rnd(-1.6, 1.6);
          if (tx > 1 && ty > 1 && tx < N - 1 && ty < N - 1 && grassy(this.kind(tx, ty)) && !this.world.occupied[Math.floor(ty) * N + Math.floor(tx)]) { h.tx = tx; h.ty = ty; }
          h.wait = rnd(1, 5);
        }
      } else {
        const sp = (h.scared > 0 ? 3.4 : 1.3) * dt;
        h.x += (dx / d) * Math.min(d, sp); h.y += (dy / d) * Math.min(d, sp);
        h.hop += dt * (h.scared > 0 ? 16 : 9);
        h.face = Math.atan2(dx, dy);
      }
      h.g.visible = this.seen(h.x, h.y) && foul < 0.7;
      if (!h.g.visible) continue;
      const up = Math.abs(Math.sin(h.hop)) * 0.09;
      h.g.position.set(h.x, this.heightAt(h.x, h.y) + up, h.y);
      h.g.rotation.y = h.face;
      h.g.rotation.x = d < 0.05 ? 0 : -Math.cos(h.hop * 2) * 0.25;
    }

    // ---- tumbleweed, rolling east on the wind ----
    for (const w of this.weeds) {
      w.t += dt;
      const here = this.kind(w.x, w.y);
      if (Math.abs(w.x - cx) > 16 || Math.abs(w.y - cy) > 14 || here === T_WATER || this.world.occupied[Math.floor(w.y) * N + Math.floor(w.x)]) {
        const s = this.spot(cx - 13, cy, 3, (t) => t === T_SAND || t === T_GRASS, true);
        if (!s) { w.m.visible = false; continue; }
        w.x = s.x; w.y = s.y + rnd(-9, 9);
      }
      const gust = 1.6 + Math.sin(w.t * 0.7 + w.s * 9) * 1.1;
      w.x += gust * dt * w.s; w.y += Math.sin(w.t * 0.4 + w.s * 5) * 0.3 * dt;
      w.m.visible = this.seen(w.x, w.y);
      w.m.position.set(w.x, this.heightAt(w.x, w.y) + 0.13 * w.s + Math.abs(Math.sin(w.t * 3.2)) * 0.12, w.y);
      w.m.rotation.z -= gust * dt * 5; w.m.rotation.x += dt;
      w.m.scale.setScalar(w.s);
    }

    // ---- fish breaking the surface ----
    if (this.hasWater) {
      this.leapT -= dt;
      if (this.leapT <= 0 && foul < 0.8) {
        this.leapT = rnd(1.5, 5);
        const s = this.spot(cx, cy, 13, (t) => t === T_WATER);
        // Only in open water: every tile around must be water too.
        if (s && this.seen(s.x, s.y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => this.kind(s.x + dx, s.y + dy) === T_WATER)) {
          const fish = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 5).scale(0.45, 0.6, 1.8), lit(0xb8c6d0));
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 4, 18).rotateX(Math.PI / 2), plain(0xe8f4f8, { transparent: true, opacity: 0.7, depthWrite: false }));
          ring.position.set(s.x, -0.05, s.y);
          ring.renderOrder = 3;
          this.group.add(fish, ring);
          this.leaps.push({ fish, ring, x: s.x, y: s.y, t: 0, dir: rnd(0, 6.28) });
        }
      }
      for (let i = this.leaps.length - 1; i >= 0; i--) {
        const l = this.leaps[i];
        l.t += dt;
        const k = l.t / 0.7; // the leap itself
        l.fish.visible = k < 1;
        if (k < 1) {
          l.fish.position.set(l.x + Math.sin(l.dir) * k * 0.5, -0.08 + Math.sin(k * Math.PI) * 0.32, l.y + Math.cos(l.dir) * k * 0.5);
          l.fish.rotation.set(-(0.5 - k) * 2.4, l.dir, 0, 'YXZ');
        }
        // Rings where it left the water and where it came back.
        const rk = l.t / 1.8;
        l.ring.scale.setScalar(1 + rk * 4);
        (l.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - rk);
        if (k > 0.9 && l.ring.userData.moved !== true) { l.ring.userData.moved = true; }
        if (rk >= 1) {
          this.group.remove(l.fish, l.ring);
          l.fish.geometry.dispose(); l.ring.geometry.dispose();
          this.leaps.splice(i, 1);
        }
      }
    }

    // ---- motes in the air, carried on the wind and kept about the camera ----
    {
      const pos = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
      const wind = this.world.climate === 'desert' || this.world.climate === 'steppe' ? 1.4 : 0.35;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + (wind + Math.sin(clock * 0.6 + i) * 0.2) * dt, y = pos.getY(i) + Math.sin(clock * 0.9 + i * 1.3) * 0.12 * dt, z = pos.getZ(i) + Math.cos(clock * 0.5 + i * 0.7) * 0.15 * dt;
        if (x > 14) x -= 28;
        if (z > 14) z -= 28; else if (z < -14) z += 28;
        pos.setXYZ(i, x, Math.min(2.8, Math.max(0.15, y)), z);
      }
      pos.needsUpdate = true;
      this.motes.position.set(cx, 0, cy);
      this.moteMat.opacity = 0.55 * Math.max(0, day - 0.2) * (1 - foul);
      this.motes.visible = this.moteMat.opacity > 0.02;
    }
  }
}
