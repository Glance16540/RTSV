// Roads: every building is joined to its owner's nearest town centre by a path worn into the ground,
// laid the moment the building is placed. Paths prefer ground already trodden, so they merge into streets.
// They are drawn only; nothing in the match depends on them.

import * as THREE from 'three';
import { Building, Game } from '../sim/game';
import { T_ROCK, T_WATER } from '../sim/map';
import { Scenery } from './scenery';

/** Buildings that stand in a line or out in the fields take no road of their own. */
const NO_ROAD = new Set(['palisade', 'stonewall', 'gate', 'farm', 'towncenter']);

function surface(cobbled: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d')!;
  let s = cobbled ? 91 : 17;
  const r = (): number => ((s = (s * 16807 + 11) % 2147483647) / 2147483647);
  g.fillStyle = cobbled ? '#8f8674' : '#a88a5c';
  g.fillRect(0, 0, 64, 256);
  if (cobbled) {
    for (let y = 0; y < 256; y += 13) for (let x = (y / 13) % 2 ? -6 : 0; x < 64; x += 13) {
      const v = 150 + r() * 60;
      g.fillStyle = `rgb(${v | 0},${(v - 6) | 0},${(v - 22) | 0})`;
      g.beginPath(); g.roundRect(x + 1 + r() * 2, y + 1 + r() * 2, 10, 10, 3); g.fill();
    }
  } else {
    for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.5 ? '#8a6e44' : '#c4a878'; g.globalAlpha = 0.25; g.fillRect(r() * 64, r() * 256, 2 + r() * 5, 2 + r() * 4); }
    // Two wheel ruts.
    g.globalAlpha = 0.22; g.fillStyle = '#6a5230';
    for (const x of [19, 41]) g.fillRect(x, 0, 4, 256);
  }
  // Ragged, fading edges, so the path sinks into the grass instead of ending in a line.
  g.globalAlpha = 1;
  const img = g.getImageData(0, 0, 64, 256), p = img.data;
  for (let y = 0; y < 256; y++) {
    const jag = 3 + Math.sin(y * 0.19) * 2.5 + Math.sin(y * 0.047 + 1) * 3;
    for (let x = 0; x < 64; x++) {
      const edge = Math.min(x, 63 - x) - jag;
      p[(y * 64 + x) * 4 + 3] = Math.max(0, Math.min(1, edge / 9)) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Roads {
  private N: number;
  /** How well trodden each tile is: 0 for open ground. */
  private worn: Uint8Array;
  private laid = new Map<number, THREE.Mesh>();
  private mats: THREE.Material[] = [];
  private stale = false;
  private wait = 0;

  constructor(private game: Game, private scenery: Scenery, private scene: THREE.Object3D) {
    this.N = game.size;
    this.worn = new Uint8Array(this.N * this.N);
    for (const cobbled of [false, true]) {
      const m = new THREE.MeshLambertMaterial({ map: surface(cobbled), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m.userData.outlineParameters = { visible: false };
      this.mats.push(m);
    }
  }

  /** Call when a building first appears. */
  add(b: Building): void {
    if (this.laid.has(b.id) || NO_ROAD.has(b.type) || b.def.wall) return;
    const path = this.route(b);
    if (!path) return;
    const mesh = this.ribbon(path, this.game.players[b.owner].age >= 2);
    mesh.userData.owner = b.owner;
    this.laid.set(b.id, mesh);
    this.scene.add(mesh);
  }

  /** Call when a building is gone, a town centre appears, or an age is reached: every road is laid afresh. */
  relay(): void { this.stale = true; }

  update(dt: number, shown: (b: Building) => boolean): void {
    if (this.stale && (this.wait -= dt) <= 0) {
      this.stale = false;
      this.wait = 1;
      for (const m of this.laid.values()) { this.scene.remove(m); m.geometry.dispose(); }
      this.laid.clear();
      this.worn.fill(0);
      for (const b of this.game.buildings) this.add(b);
    }
    // A rival's roads are seen only once their buildings have been.
    for (const [id, m] of this.laid) { const b = this.game.entities.get(id) as Building | undefined; m.visible = !!b && (b.owner === this.game.humanId || shown(b) || !!b.seen); }
  }

  /** The cheapest way over open ground from the building's edge to the edge of its owner's nearest town centre. */
  private route(b: Building): [number, number][] | null {
    const g = this.game, N = this.N;
    let tc: Building | null = null, best = Infinity;
    for (const o of g.buildings) if (o.type === 'towncenter' && o.owner === b.owner) { const d = Math.hypot(o.x - b.x, o.y - b.y); if (d < best) { best = d; tc = o; } }
    if (!tc || best > 40) return null;
    const open = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < N && y < N && !g.occupied[y * N + x] && g.terrain[y * N + x] !== T_WATER && g.terrain[y * N + x] !== T_ROCK;
    const ring = (o: Building): number[] => {
      const out: number[] = [];
      for (let y = o.cy - 1; y <= o.cy + o.size; y++) for (let x = o.cx - 1; x <= o.cx + o.size; x++) {
        const edge = x < o.cx || y < o.cy || x >= o.cx + o.size || y >= o.cy + o.size;
        const corner = (x < o.cx || x >= o.cx + o.size) && (y < o.cy || y >= o.cy + o.size);
        if (edge && !corner && open(x, y)) out.push(y * N + x);
      }
      return out;
    };
    const goal = new Uint8Array(N * N);
    for (const i of ring(tc)) goal[i] = 1;
    const cost = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1);
    // A small binary heap of [cost, tile].
    const heap: number[] = [];
    const push = (c: number, i: number): void => { heap.push(c, i); let k = heap.length / 2 - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p * 2] <= heap[k * 2]) break; for (const d of [0, 1]) { const t = heap[p * 2 + d]; heap[p * 2 + d] = heap[k * 2 + d]; heap[k * 2 + d] = t; } k = p; } };
    const pop = (): number => {
      const top = heap[1], n = heap.length / 2 - 1;
      heap[0] = heap[n * 2]; heap[1] = heap[n * 2 + 1]; heap.length = n * 2;
      let k = 0;
      for (;;) { let m = k; for (const c of [k * 2 + 1, k * 2 + 2]) if (c < n && heap[c * 2] < heap[m * 2]) m = c; if (m === k) break; for (const d of [0, 1]) { const t = heap[m * 2 + d]; heap[m * 2 + d] = heap[k * 2 + d]; heap[k * 2 + d] = t; } k = m; }
      return top;
    };
    for (const i of ring(b)) { cost[i] = 0; push(0, i); }
    let end = -1;
    while (heap.length) {
      const c0 = heap[0], i = pop();
      if (c0 > cost[i]) continue;
      if (goal[i]) { end = i; break; }
      const x = i % N, y = (i / N) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!open(nx, ny) || (dx && dy && (!open(nx, y) || !open(x, ny)))) continue;
        const j = ny * N + nx;
        // Trodden ground is far cheaper, so new paths run to the nearest street and follow it. Slopes cost a little.
        const step = (dx && dy ? 1.414 : 1) * (this.worn[j] ? 0.35 : 1) + Math.abs(g.heightAt(nx + 0.5, ny + 0.5) - g.heightAt(x + 0.5, y + 0.5)) * 1.5;
        if (c0 + step < cost[j]) { cost[j] = c0 + step; from[j] = i; push(c0 + step, j); }
      }
    }
    if (end < 0) return null;
    const pts: [number, number][] = [[tc.x, tc.y]];
    for (let i = end; i >= 0; i = from[i]) { pts.push([(i % N) + 0.5, ((i / N) | 0) + 0.5]); this.worn[i] = 1; }
    pts.push([b.x, b.y]);
    return pts;
  }

  /** A strip of road along the way, lying on the ground. */
  private ribbon(way: [number, number][], cobbled: boolean): THREE.Mesh {
    // Round the corners off: each pass cuts every corner a quarter of the way along both sides.
    let pts = way;
    for (let pass = 0; pass < 2; pass++) {
      const next: [number, number][] = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
      }
      next.push(pts[pts.length - 1]);
      pts = next;
    }
    const half = cobbled ? 0.5 : 0.42, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    let run = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i], [px, py] = pts[Math.max(0, i - 1)], [nx, ny] = pts[Math.min(pts.length - 1, i + 1)];
      const dx = nx - px, dy = ny - py, d = Math.hypot(dx, dy) || 1;
      if (i) run += Math.hypot(x - px, y - py);
      const ox = (-dy / d) * half, oy = (dx / d) * half;
      for (const s of [-1, 1]) {
        const vx = x + ox * s, vy = y + oy * s;
        // Lifted a hair over the higher of the centre and the edge, so the strip never dips under a facet of the ground.
        pos.push(vx, Math.max(this.scenery.heightAt(vx, vy), this.scenery.heightAt(x, y)) + 0.035, vy);
        uv.push(s < 0 ? 0 : 1, run / 2.4);
      }
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.mats[cobbled ? 1 : 0]);
    m.receiveShadow = true;
    m.renderOrder = 3;
    return m;
  }
}
