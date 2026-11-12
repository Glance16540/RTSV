// Roads, drawn. The match itself lays them (see layRoad in sim/game.ts): every building is joined to its
// owner's nearest town centre the moment it is placed, and units move faster along them.

import * as THREE from 'three';
import { Building, Game } from '../sim/game';
import { Scenery } from './scenery';


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
  private laid = new Map<number, THREE.Mesh>();
  private mats: THREE.Material[] = [];
  private seen = -1;

  constructor(private game: Game, private scenery: Scenery, private scene: THREE.Object3D) {
    for (const cobbled of [false, true]) {
      const m = new THREE.MeshLambertMaterial({ map: surface(cobbled), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      m.userData.outlineParameters = { visible: false };
      this.mats.push(m);
    }
  }

  /** Call when an age is reached: dirt tracks are paved. */
  relay(): void { this.seen = -1; }

  update(shown: (b: Building) => boolean): void {
    const g = this.game, N = g.size;
    if (this.seen !== g.roadVersion) {
      this.seen = g.roadVersion;
      for (const m of this.laid.values()) { this.scene.remove(m); m.geometry.dispose(); }
      this.laid.clear();
      for (const [id, cells] of g.roadOf) {
        const b = g.entities.get(id) as Building | undefined, tc = g.entities.get(cells[0]) as Building | undefined;
        if (!b || !tc) continue;
        const way: [number, number][] = [[tc.x, tc.y]];
        for (let k = 1; k < cells.length; k++) way.push([(cells[k] % N) + 0.5, ((cells[k] / N) | 0) + 0.5]);
        way.push([b.x, b.y]);
        const mesh = this.ribbon(way, g.players[b.owner].age >= 2);
        this.laid.set(id, mesh);
        this.scene.add(mesh);
      }
    }
    // A rival's roads are seen only once their buildings have been.
    for (const [id, m] of this.laid) { const b = g.entities.get(id) as Building | undefined; m.visible = !!b && (b.owner === g.humanId || shown(b) || !!b.seen); }
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
