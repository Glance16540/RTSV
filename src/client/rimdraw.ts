// The rim of true wilderness on the campaign map (src/sim/rim.ts): lands at the map's edge that nobody can settle or
// farm. They take the climate of where they lie, so the map would have painted them green, with fields round a town
// that is not there. Here a rim land is painted as the waste its name says it is, snow or desert (a barren one by its
// side of the map and its warmth), pale and bare; it has no fields, no town and no hearth-smoke (worldmap.ts leaves
// them out); and a band camped there is shown as the towns below are told of it, a ring of dark tents and its fires.
import * as THREE from 'three';
import type { Campaign, Territory } from '../sim/campaign';
import { climateAt } from '../sim/campaign';
import type { Band } from '../sim/threats';

export type Waste = 'snow' | 'desert';

/** Which waste a rim land is: by its name (rim.ts WASTES), else by its side of the map and the warmth there. */
export function wasteOf(c: Campaign, t: Territory): Waste {
  const n = t.name.toLowerCase();
  if (/frozen|white|ice|winter/.test(n)) return 'snow';
  if (/burning|sands|dry|salt/.test(n)) return 'desert';
  if (/northern/.test(n)) return 'snow';
  if (/southern/.test(n)) return 'desert';
  return climateAt(c.seed, t.x, t.y).warm > 0.5 ? 'desert' : 'snow';
}

/** How far round a rim land its waste is painted, in the map's own units (rim lands lie at least rim.ts RIM.apart from any other). */
export const RIM_PAINT = { reach: 64, edge: 0.45 };

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

/** The colour each waste is painted. */
const WASTE_RGB: Record<Waste, number[]> = { snow: [242, 246, 250], desert: [236, 212, 158] };

/**
 * The waste's ground, for the map's paint (worldmap.ts, point by point over land, so the sea floor is left as it is): a
 * function that turns a point's colour toward its rim land's waste, wholly near the land and fading out raggedly toward
 * RIM_PAINT.reach. Null where the map has no rim.
 */
export function rimTint(c: Campaign): ((px: number, py: number, col: number[]) => void) | null {
  const rims = c.territories.filter((t) => t.rim).map((t) => ({ t, rgb: WASTE_RGB[wasteOf(c, t)], k: [0, 1, 2, 3].map((n) => hash(t.id, 300 + n) * Math.PI * 2) }));
  if (!rims.length) return null;
  const R = RIM_PAINT.reach;
  return (px, py, col) => {
    for (const { t, rgb, k } of rims) {
      const dx = px - t.x, dy = py - t.y, d = Math.hypot(dx, dy);
      if (d >= R * 1.15) continue;
      const a = Math.atan2(dy, dx), wobble = 1 + 0.12 * Math.sin(a * 3 + k[0]) + 0.08 * Math.sin(a * 5 + k[1]) + 0.05 * Math.sin(a * 9 + k[2]);
      const edge = R * wobble, inner = edge * (1 - RIM_PAINT.edge);
      const w = d <= inner ? 1 : d >= edge ? 0 : 1 - (d - inner) / (edge - inner);
      if (w <= 0) continue;
      const m = w * w * (3 - 2 * w) * 0.92;
      col[0] += (rgb[0] - col[0]) * m; col[1] += (rgb[1] - col[1]) * m; col[2] += (rgb[2] - col[2]) * m;
    }
  };
}

/** Over the painted waste, drifts or dunes and a few bare stones, on land only (`landAt`), in the map's units on a 2D context. */
export function paintRim(ctx: CanvasRenderingContext2D, c: Campaign, landAt: (x: number, y: number) => boolean = () => true): number {
  let n = 0;
  for (const t of c.territories) {
    if (!t.rim) continue;
    n++;
    const snow = wasteOf(c, t) === 'snow', R = RIM_PAINT.reach;
    // Drifts or dunes: long low curves lying one way, faint, so the waste reads as country and not a blank.
    const turn = hash(t.id, 1) * Math.PI;
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(turn);
    ctx.strokeStyle = snow ? 'rgba(170,186,210,0.35)' : 'rgba(196,150,90,0.4)';
    ctx.lineWidth = snow ? 0.7 : 0.9;
    for (let k = 0; k < 22; k++) {
      const y = (hash(t.id, 10 + k) - 0.5) * R * 1.3, x = (hash(t.id, 40 + k) - 0.5) * R * 0.9, w = 8 + hash(t.id, 70 + k) * 16;
      if (x * x + y * y > (R * 0.62) ** 2) continue;
      const mx = t.x + x * Math.cos(turn) - y * Math.sin(turn), my = t.y + x * Math.sin(turn) + y * Math.cos(turn);
      if (!landAt(mx, my)) continue;
      ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - w * 0.22, x + w, y); ctx.stroke();
    }
    // A few bare stones showing through.
    ctx.fillStyle = snow ? 'rgba(120,128,140,0.45)' : 'rgba(150,104,70,0.45)';
    for (let k = 0; k < 9; k++) {
      const a = hash(t.id, 100 + k) * Math.PI * 2, d = hash(t.id, 120 + k) * R * 0.5;
      if (!landAt(t.x + Math.cos(a + turn) * d, t.y + Math.sin(a + turn) * d)) continue;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 0.9 + hash(t.id, 140 + k), 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  return n;
}

const tentM = new Map<string, THREE.MeshStandardMaterial>();
const tentOf = (hex: number): THREE.MeshStandardMaterial => { const k = String(hex); let m = tentM.get(k); if (!m) tentM.set(k, (m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, flatShading: true }))); return m; };
const fireM = new THREE.MeshBasicMaterial({ color: 0xff9a3a }), glowM = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35, depthWrite: false });
const tentG = new THREE.ConeGeometry(0.42, 0.75, 6).translate(0, 0.375, 0), fireG = new THREE.SphereGeometry(0.1, 7, 5), glowG = new THREE.SphereGeometry(0.32, 9, 7);

/**
 * A band's camp in the waste: a ring of dark hide tents, more for a stronger band, round its fires (a fire for every
 * few tents, each with a glow about it). Returns the group, in the map's world units about its own middle, and the
 * fires, for whoever makes them flicker.
 */
export function bandCamp(b: Band, waste: Waste): { group: THREE.Group; fires: THREE.Mesh[] } {
  const group = new THREE.Group(), fires: THREE.Mesh[] = [];
  const tents = Math.max(3, Math.min(9, Math.round(b.strength * 1.2))), hide = waste === 'snow' ? 0x3a2e26 : 0x5a4030;
  for (let k = 0; k < tents; k++) {
    const a = (k / tents) * Math.PI * 2 + hash(b.id, k) * 0.4, r = 1.3 + hash(b.id, 20 + k) * 0.5;
    const tent = new THREE.Mesh(tentG, tentOf(k % 3 === 0 ? 0x2a2420 : hide));
    tent.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tent.scale.setScalar(0.85 + hash(b.id, 40 + k) * 0.35);
    tent.castShadow = true; tent.receiveShadow = true;
    group.add(tent);
  }
  const blazes = Math.max(1, Math.min(3, Math.round(tents / 3)));
  for (let k = 0; k < blazes; k++) {
    const a = (k / blazes) * Math.PI * 2 + 0.6, r = blazes === 1 ? 0 : 0.55;
    const fire = new THREE.Mesh(fireG, fireM), glow = new THREE.Mesh(glowG, glowM);
    fire.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r); fire.userData.ph = b.id * 3 + k;
    glow.position.copy(fire.position); glow.userData.outlineParameters = { visible: false };
    group.add(fire, glow);
    fires.push(fire);
  }
  return { group, fires };
}
