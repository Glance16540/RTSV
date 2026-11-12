// Weather: rain over green country and steppe, snowfall in the north, dust blowing across the desert.
// It comes and goes on its own, dimming the sun and thickening the haze while it lasts. It is seen
// only: nothing in the match depends on it. `?weather=rain|snow|dust|clear` holds one kind.

import * as THREE from 'three';
import { Climate } from '../sim/map';

type Kind = 'clear' | 'rain' | 'snow' | 'dust';
const SPAN = 46, TALL = 20;

export class Weather {
  /** How heavy the weather is now, 0 (clear) to 1. The renderer dims the light and thickens the haze by it. */
  amount = 0;
  kind: Kind = 'clear';
  private want = 0;
  private until = 0;
  private held: Kind | null;
  private rain: THREE.LineSegments;
  private flakes: THREE.Points;
  private seeds: Float32Array;
  private n = 1400;

  constructor(scene: THREE.Object3D, private climate: Climate) {
    const ask = new URLSearchParams(location.search).get('weather');
    this.held = ask === 'rain' || ask === 'snow' || ask === 'dust' || ask === 'clear' ? ask : null;
    this.seeds = new Float32Array(this.n * 4);
    for (let i = 0; i < this.n * 4; i++) this.seeds[i] = Math.random();
    const off = { visible: false };
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 6), 3));
    const rm = new THREE.LineBasicMaterial({ color: 0xc8d8ee, transparent: true, opacity: 0, depthWrite: false, fog: false });
    rm.userData.outlineParameters = off;
    this.rain = new THREE.LineSegments(rg, rm);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    const fm = new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0, depthWrite: false, fog: false, map: Weather.dot() });
    fm.userData.outlineParameters = off;
    this.flakes = new THREE.Points(fg, fm);
    for (const o of [this.rain, this.flakes]) { o.frustumCulled = false; o.renderOrder = 90; o.visible = false; scene.add(o); }
    // A skirmish opens under a clear sky; the first weather is a while off.
    this.until = this.held ? 0 : 50 + Math.random() * 60;
  }

  private static dot(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!, grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  /** The colour the haze takes in this weather. */
  tint(out: THREE.Color): THREE.Color {
    return out.set(this.kind === 'dust' ? 0xc8a878 : this.kind === 'snow' ? 0xd0d8e4 : 0x7c8894);
  }

  update(dt: number, clock: number, cx: number, cy: number): void {
    if ((this.until -= dt) <= 0) {
      const wet: Kind = this.climate === 'snow' ? 'snow' : this.climate === 'desert' ? 'dust' : 'rain';
      if (this.held) { this.kind = this.held === 'clear' ? this.kind : this.held; this.want = this.held === 'clear' ? 0 : 1; this.until = 1e9; }
      else if (this.want > 0) { this.want = 0; this.until = 90 + Math.random() * 150; } // it passes
      else { this.kind = wet; this.want = 0.5 + Math.random() * 0.5; this.until = 45 + Math.random() * 60; }
    }
    this.amount += Math.sign(this.want - this.amount) * Math.min(Math.abs(this.want - this.amount), dt / 9);
    const a = this.amount, rain = this.kind === 'rain';
    this.rain.visible = rain && a > 0.01;
    this.flakes.visible = !rain && this.kind !== 'clear' && a > 0.01;
    if (a <= 0.01) return;
    const s = this.seeds, shown = Math.round(this.n * Math.min(1, 0.25 + a));
    const wrap = (v: number, span: number): number => ((v % span) + span) % span;
    if (rain) {
      const p = this.rain.geometry.attributes.position as THREE.BufferAttribute, arr = p.array as Float32Array;
      (this.rain.material as THREE.LineBasicMaterial).opacity = 0.55 * a;
      this.rain.geometry.setDrawRange(0, shown * 2);
      for (let i = 0; i < shown; i++) {
        // Each drop falls its own column, slanted by the wind, and comes round again at the top.
        const y = TALL - wrap(clock * (20 + s[i * 4 + 3] * 8) + s[i * 4 + 1] * TALL, TALL);
        const x = cx - SPAN / 2 + wrap(s[i * 4] * SPAN + (TALL - y) * 0.22 - cx, SPAN), z = cy - SPAN / 2 + wrap(s[i * 4 + 2] * SPAN - cy, SPAN);
        arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = z;
        arr[i * 6 + 3] = x + 0.13; arr[i * 6 + 4] = y - 0.6; arr[i * 6 + 5] = z;
      }
      p.needsUpdate = true;
      return;
    }
    const dust = this.kind === 'dust';
    const p = this.flakes.geometry.attributes.position as THREE.BufferAttribute, arr = p.array as Float32Array, m = this.flakes.material as THREE.PointsMaterial;
    m.opacity = (dust ? 0.5 : 0.9) * a;
    m.color.set(dust ? 0xd8b888 : 0xffffff);
    m.size = dust ? 0.45 : 0.36;
    this.flakes.geometry.setDrawRange(0, shown);
    for (let i = 0; i < shown; i++) {
      const fall = dust ? 0.6 : 1.6 + s[i * 4 + 3], drift = dust ? 9 + s[i * 4 + 3] * 6 : 0.8;
      const y = (dust ? 5 : TALL) - wrap(clock * fall + s[i * 4 + 1] * TALL, dust ? 5 : TALL);
      arr[i * 3] = cx - SPAN / 2 + wrap(s[i * 4] * SPAN + clock * drift + Math.sin(clock * 1.3 + i) * 0.4 - cx, SPAN);
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = cy - SPAN / 2 + wrap(s[i * 4 + 2] * SPAN + Math.cos(clock * 1.1 + i * 2) * 0.4 - cy, SPAN);
    }
    p.needsUpdate = true;
  }
}
