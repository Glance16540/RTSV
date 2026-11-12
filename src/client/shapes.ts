// The drawn look: banded shade with an ink outline, hand-painted surfaces, and buildings with real shapes
// (pitched roofs with eaves, timber framing, round towers) in place of plain blocks.

import * as THREE from 'three';

/** Three bands of light, so shade falls in flat steps like a print. */
export const RAMP = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
RAMP.needsUpdate = true;
/** Read by the outline pass: anything made with these materials gets an ink edge. */
export const INK = { visible: true, thickness: 0.0075, color: [0.13, 0.09, 0.06], alpha: 1 };

type Draw = (g: CanvasRenderingContext2D, r: () => number) => void;
function canvasTex(w: number, h: number, draw: Draw): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  let s = w * 31 + h;
  draw(c.getContext('2d')!, () => ((s = (s * 16807 + 11) % 2147483647) / 2147483647));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const grey = (v: number): string => `rgb(${v | 0},${v | 0},${v | 0})`;
function speckle(g: CanvasRenderingContext2D, r: () => number, n: number): void {
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? '#6a6458' : '#ffffff'; g.globalAlpha = 0.04 + r() * 0.1; const s = 2 + r() * 10; g.fillRect(r() * 256, r() * 256, s, s * (0.4 + r())); }
  g.globalAlpha = 1;
}
/** Surfaces are painted pale, so a building's own colour tints them. */
const PAINT: Record<string, Draw> = {
  plaster: (g, r) => { g.fillStyle = '#f2eee6'; g.fillRect(0, 0, 256, 256); speckle(g, r, 500); },
  stone: (g, r) => {
    g.fillStyle = grey(130); g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let x = (row % 2) * -20; x < 256;) { const w = 34 + r() * 30; g.fillStyle = grey(196 + r() * 56); g.fillRect(x + 2, row * 32 + 2, w - 4, 28); x += w; }
    speckle(g, r, 300);
  },
  thatch: (g, r) => {
    g.fillStyle = grey(222); g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { const v = r(); g.strokeStyle = v < 0.5 ? grey(150) : v < 0.8 ? grey(255) : grey(118); g.globalAlpha = 0.5; g.lineWidth = 1 + r() * 1.5; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y + 14 + r() * 26); g.stroke(); }
    g.globalAlpha = 0.3; g.fillStyle = grey(90); for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 5); g.globalAlpha = 1;
  },
  tiles: (g, r) => {
    g.fillStyle = grey(84); g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) for (let i = -1; i < 11; i++) { g.fillStyle = grey(176 + r() * 79); const x = i * 26 + (row % 2) * 13; g.beginPath(); g.roundRect(x + 1, row * 32 + 1, 24, 34, [0, 0, 9, 9]); g.fill(); }
  },
  planks: (g, r) => {
    for (let x = 0; x < 256; x += 32) { g.fillStyle = grey(196 + r() * 56); g.fillRect(x, 0, 31, 256); g.fillStyle = grey(96); g.fillRect(x + 31, 0, 1, 256); }
    for (let i = 0; i < 260; i++) { g.strokeStyle = r() < 0.5 ? grey(120) : grey(255); g.globalAlpha = 0.3; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + 20 + r() * 40); g.stroke(); }
    g.globalAlpha = 1;
  },
  window: (g) => {
    g.fillStyle = '#4e3520'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#2a3a48'; g.fillRect(24, 16, 208, 224);
    g.strokeStyle = '#c8b070'; g.lineWidth = 4; for (let i = -256; i < 256; i += 36) { g.beginPath(); g.moveTo(24 + i, 16); g.lineTo(24 + i + 224, 240); g.moveTo(232 - i, 16); g.lineTo(232 - i - 224, 240); g.stroke(); }
    g.fillStyle = '#4e3520'; g.fillRect(0, 0, 24, 256); g.fillRect(232, 0, 24, 256); g.fillRect(0, 0, 256, 16); g.fillRect(0, 240, 256, 16); g.fillRect(118, 0, 20, 256);
  },
  arch: (g) => {
    g.fillStyle = '#8a8474'; g.fillRect(0, 0, 256, 256);
    const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#f0c860'); grd.addColorStop(0.5, '#4a78b0'); grd.addColorStop(1, '#8a3040');
    g.fillStyle = grd; g.beginPath(); g.moveTo(40, 244); g.lineTo(40, 92); g.quadraticCurveTo(40, 16, 128, 12); g.quadraticCurveTo(216, 16, 216, 92); g.lineTo(216, 244); g.closePath(); g.fill();
    g.strokeStyle = '#2a2420'; g.lineWidth = 10; g.stroke(); g.beginPath(); g.moveTo(128, 12); g.lineTo(128, 244); g.moveTo(40, 120); g.lineTo(216, 120); g.moveTo(40, 184); g.lineTo(216, 184); g.stroke();
  },
  door: (g) => { g.fillStyle = '#6a4828'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#3a2616'; for (let x = 60; x < 256; x += 64) g.fillRect(x, 0, 8, 256); g.fillStyle = '#2a2a2e'; g.fillRect(0, 48, 256, 14); g.fillRect(0, 186, 256, 14); g.beginPath(); g.arc(208, 132, 12, 0, 7); g.fill(); },
};
export type Surface = keyof typeof PAINT | '';
const texes = new Map<string, THREE.Texture>();
function surface(key: string): THREE.Texture {
  let t = texes.get(key);
  if (!t) { t = canvasTex(256, 256, PAINT[key]); texes.set(key, t); }
  return t;
}

const toons = new Map<string, THREE.MeshToonMaterial>();
/** The one material everything standing in the world is made of. */
export function toon(color: number, tex: Surface = '', emissive = 0): THREE.MeshToonMaterial {
  const key = `${color}:${tex}:${emissive}`;
  let m = toons.get(key);
  if (!m) {
    const map = tex ? surface(tex) : null;
    m = new THREE.MeshToonMaterial({ color, emissive, map, gradientMap: RAMP, emissiveMap: emissive && map ? map : null });
    m.userData.outlineParameters = INK;
    toons.set(key, m);
  }
  return m;
}

/** Bends a shape a little out of true, so crowns and thatch do not look machined. */
export function wobble(geo: THREE.BufferGeometry, amt: number, seed: number): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 7.1 + seed) * Math.cos(y * 6.3 + seed * 2) * Math.sin(z * 8.7 + seed * 3);
    pos.setXYZ(i, x * (1 + n * amt), y * (1 + n * amt * 0.6), z * (1 + n * amt));
  }
  geo.computeVertexNormals();
  return geo;
}

/** A box whose painted surface keeps one scale whatever the box's size: bricks do not stretch on a long wall. */
export function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, pos.getX(i) / 1.4, pos.getZ(i) / 1.4);
    else uv.setXY(i, (Math.abs(nor.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i)) / 1.4, pos.getY(i) / 1.4);
  }
  return g;
}

// ---------------------------------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------------------------------
const TIMBER = 0x5a3e28;
const mesh = (p: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  p.add(o);
  return o;
};
const bx = (p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => mesh(p, boxGeo(w, h, d), m, x, y, z);
/** Walls standing on y0. */
const walls = (p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x = 0, y0 = 0, z = 0): THREE.Mesh => bx(p, w, h, d, m, x, y0 + h / 2, z);

/** A pitched roof with overhanging eaves, its ridge along z. */
function gable(p: THREE.Object3D, w: number, d: number, rise: number, y: number, roofMat: THREE.Material, endMat: THREE.Material | null, x = 0, z = 0, over = 0.18, thick = 0.09): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  const half = w / 2, len = Math.hypot(half, rise) + over, ang = Math.atan2(rise, half);
  for (const s of [-1, 1]) {
    const geo = new THREE.BoxGeometry(len, thick, d + over * 2);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getZ(i) / 1.3, pos.getX(i) * s / 1.3);
    // The slab's upper edge meets the ridge; the lower edge hangs past the wall.
    const m = mesh(g, geo, roofMat, s * (len / 2) * Math.cos(ang), rise - (len / 2) * Math.sin(ang) + thick / 2, 0);
    m.rotation.z = -s * ang;
  }
  bx(g, 0.1, 0.1, d + over * 2 + 0.04, toon(TIMBER), 0, rise + thick * 0.8, 0);
  if (endMat) for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(-half, 0); sh.lineTo(half, 0); sh.lineTo(0, rise); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.4, uv.getY(i) / 1.4);
    const m = mesh(g, geo, endMat, 0, 0, s * d / 2);
    if (s < 0) m.rotation.y = Math.PI;
    bx(g, 0.06, rise * 0.9, 0.04, toon(TIMBER), 0, rise * 0.45, s * (d / 2 + 0.01));
  }
  return g;
}
/** Timber framing around a storey: corner posts, sills and plates, and braces. */
function framing(p: THREE.Object3D, w: number, h: number, d: number, y0: number, x = 0, z = 0): void {
  const t = 0.07, m = toon(TIMBER);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, t, h, t, m, x + sx * (w / 2), y0 + h / 2, z + sz * (d / 2));
  for (const yy of [y0 + t / 2, y0 + h - t / 2]) {
    for (const sz of [-1, 1]) bx(p, w + t, t, t, m, x, yy, z + sz * d / 2);
    for (const sx of [-1, 1]) bx(p, t, t, d + t, m, x + sx * w / 2, yy, z);
  }
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) bx(p, t * 0.8, h * 0.62, t * 0.6, m, x + sx * (w / 2 - h * 0.2), y0 + h * 0.3, z + sz * (d / 2 + 0.005)).rotation.z = sx * 0.62;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(p, t * 0.6, h * 0.62, t * 0.8, m, x + sx * (w / 2 + 0.005), y0 + h * 0.3, z + sz * (d / 2 - h * 0.2)).rotation.x = -sz * 0.62;
}
/** A door or window set on a wall. `glow` lights it from within. */
function pane(p: THREE.Object3D, kind: 'window' | 'arch' | 'door', w: number, h: number, x: number, y: number, z: number, ry = 0, glow = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, 0.04);
  const o = mesh(p, geo, toon(0xffffff, kind, glow), x, y, z);
  o.rotation.y = ry;
  return o;
}
function chimney(p: THREE.Object3D, x: number, y: number, z: number, h = 0.7): void {
  const st = toon(0xb8b4aa, 'stone');
  walls(p, 0.3, h, 0.3, st, x, y, z);
  bx(p, 0.38, 0.07, 0.38, st, x, y + h, z);
}
export function barrel(p: THREE.Object3D, x: number, z: number, s = 1): void {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.scale.setScalar(s); p.add(g);
  const wood = toon(0x9a6a3e, 'planks');
  mesh(g, new THREE.LatheGeometry([[0.13, 0], [0.17, 0.12], [0.18, 0.2], [0.17, 0.28], [0.13, 0.4]].map(([a, b]) => new THREE.Vector2(a, b)), 12), wood);
  mesh(g, new THREE.CircleGeometry(0.13, 12).rotateX(-Math.PI / 2), wood, 0, 0.4, 0);
  for (const y of [0.08, 0.32]) mesh(g, new THREE.TorusGeometry(0.165, 0.012, 5, 14).rotateX(Math.PI / 2), toon(0x3a3a40), 0, y, 0);
}
/** A pole with a cloth in the owner's colour, hanging with a ripple in it. */
export function banner(p: THREE.Object3D, team: number, x: number, y: number, z: number, h = 0.8): void {
  mesh(p, new THREE.CylinderGeometry(0.02, 0.025, h + 0.5, 6), toon(TIMBER), x, y + (h + 0.5) / 2, z);
  const geo = new THREE.BoxGeometry(0.55, 0.36, 0.02, 8, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + Math.sin(pos.getX(i) * 9) * 0.04);
  geo.computeVertexNormals();
  mesh(p, geo, toon(team, '', new THREE.Color(team).multiplyScalar(0.25).getHex()), x + 0.29, y + h + 0.28, z);
}
const cloth = (p: THREE.Object3D, team: number, w: number, h: number, x: number, y: number, z: number): THREE.Mesh => bx(p, w, h, 0.02, toon(team, '', new THREE.Color(team).multiplyScalar(0.25).getHex()), x, y, z);

// ---------------------------------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------------------------------
export interface Look {
  /** Wall and roof colours of the nation at this age, and the owner's colour. */
  wall: number; roofColor: number; team: number; post: number; age: number;
  roofKind: 'pitched' | 'low' | 'steep' | 'flat' | 'dome' | 'pagoda' | 'yurt';
  leaning: '' | 'holy' | 'low';
  /** Roofs that are not pitched (domes, pagodas, flat roofs with a parapet, felt tents) are drawn by the caller. */
  otherRoof: (p: THREE.Object3D, half: number, h: number, x: number, y: number, z: number) => THREE.Object3D;
}
const pitched = (o: Look): boolean => o.roofKind === 'pitched' || o.roofKind === 'low' || o.roofKind === 'steep';
const roofMat = (o: Look): THREE.Material => toon(o.roofColor, o.roofKind === 'steep' || (o.roofKind === 'pitched' && o.age <= 1) ? 'thatch' : 'tiles');
const wallMat = (o: Look, upper = true): THREE.Material => (o.age === 0 ? toon(o.wall, 'planks') : !upper && o.age >= 2 ? toon(0xc8c2b4, 'stone') : toon(o.wall, 'plaster'));
const framed = (o: Look): boolean => (o.roofKind === 'pitched' || o.roofKind === 'steep') && o.age >= 1;
/** Roofs a body w wide (x) and d deep (z) whose walls end at y. The ridge runs along the longer side. */
function top(g: THREE.Object3D, o: Look, w: number, d: number, y: number, rise: number, x = 0, z = 0): void {
  if (!pitched(o)) {
    const half = Math.min(w, d) / 2;
    const r = o.otherRoof(g, half, rise, x, y, z);
    if (w > d) r.scale.x *= w / d; else r.scale.z *= d / w;
    return;
  }
  const k = o.roofKind === 'low' ? 0.6 : o.roofKind === 'steep' ? 1.35 : 1;
  const thatch = o.roofKind === 'steep' || o.age <= 1;
  if (w >= d) {
    const turn = new THREE.Group();
    turn.rotation.y = Math.PI / 2; turn.position.set(x, 0, z); g.add(turn);
    gable(turn, d, w, rise * k, y, roofMat(o), wallMat(o), 0, 0, thatch ? 0.24 : 0.18, thatch ? 0.16 : 0.09);
  } else gable(g, w, d, rise * k, y, roofMat(o), wallMat(o), x, z, thatch ? 0.24 : 0.18, thatch ? 0.16 : 0.09);
}
function posts(g: THREE.Object3D, o: Look, w: number, h: number, d: number, y0 = 0): void {
  if (framed(o)) framing(g, w, h, d, y0);
  else if (o.age >= 1) for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(g, 0.14, h, 0.14, toon(o.post, 'plaster'), sx * w / 2, y0 + h / 2, sz * d / 2);
}

function house(o: Look, seed: number): THREE.Group {
  const g = new THREE.Group();
  walls(g, 1.9, 0.2, 1.5, toon(0xb8b4aa, 'stone'));
  walls(g, 1.8, 0.95, 1.4, wallMat(o), 0, 0.18);
  posts(g, o, 1.8, 0.95, 1.4, 0.18);
  top(g, o, 1.8, 1.4, 1.13, 0.85);
  if (pitched(o)) chimney(g, 0.55, 1.3, -0.3, 0.8);
  pane(g, 'door', 0.36, 0.66, 0, 0.53, 0.71);
  bx(g, 0.5, 0.06, 0.24, toon(0xb8b4aa, 'stone'), 0, 0.03, 0.86);
  bx(g, 0.5, 0.05, 0.2, toon(o.team), 0, 0.92, 0.8).rotation.x = 0.35;
  // Lit windows show which residents have moved in: blue for the man, pink for the woman.
  const m = bx(g, 0.28, 0.3, 0.05, toon(0x4aa3ff, '', 0x2a6ac0), -0.55, 0.7, 0.71);
  const f = bx(g, 0.28, 0.3, 0.05, toon(0xff7ab8, '', 0xc04a80), 0.55, 0.7, 0.71);
  m.castShadow = f.castShadow = false;
  g.userData.resM = m; g.userData.resF = f;
  for (const z of [0.1, -0.4]) pane(g, 'window', 0.3, 0.38, 0.91, 0.72, z, Math.PI / 2);
  if (seed % 2) for (let i = 0; i < 5; i++) mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6).rotateX(Math.PI / 2), toon(TIMBER), -1.08, 0.06 + Math.floor(i / 3) * 0.1, 0.2 + (i % 3) * 0.11 + Math.floor(i / 3) * 0.05);
  else barrel(g, -1.1, 0.3, 0.8);
  return g;
}
function hall(o: Look): THREE.Group {
  const g = new THREE.Group();
  const st = toon(0xc8c2b4, 'stone');
  walls(g, 3.3, 0.3, 2.7, st);
  walls(g, 3.1, 1.0, 2.5, wallMat(o, false), 0, 0.25);
  walls(g, 3.3, 1.0, 2.7, wallMat(o), 0, 1.25);
  posts(g, o, 3.3, 1.0, 2.7, 1.25);
  if (framed(o)) for (const x of [-0.55, 0.55]) for (const z of [1.35, -1.35]) bx(g, 0.07, 1.0, 0.07, toon(TIMBER), x, 1.75, z);
  top(g, o, 3.3, 2.7, 2.25, 1.3);
  if (pitched(o)) {
    // A front gable over the door and a bell turret on the ridge.
    const k = o.roofKind === 'low' ? 0.6 : o.roofKind === 'steep' ? 1.35 : 1;
    gable(g, 1.5, 1.0, 0.8 * k, 2.25, roofMat(o), wallMat(o), 0, 1.0, 0.14);
    walls(g, 0.6, 0.6, 0.6, toon(0x9a6a3e, 'planks'), 0, 2.25 + 1.3 * k - 0.15, 0);
    mesh(g, new THREE.ConeGeometry(0.56, 0.8, 4).rotateY(Math.PI / 4), toon(o.team), 0, 2.25 + 1.3 * k + 0.85, 0);
    mesh(g, new THREE.SphereGeometry(0.06, 8, 6), toon(0xe8c860, '', 0x6a5010), 0, 2.25 + 1.3 * k + 1.3, 0);
    pane(g, 'window', 0.34, 0.42, 0, 2.5, 1.52);
  }
  pane(g, 'door', 0.7, 0.95, 0, 0.75, 1.27);
  for (const x of [-1.1, 1.1]) { pane(g, 'window', 0.34, 0.5, x, 0.85, 1.27); pane(g, 'window', 0.34, 0.5, x, 1.78, 1.37, 0, 0x8a6a30); }
  for (const z of [-0.7, 0.4]) { pane(g, 'window', 0.34, 0.5, 1.67, 1.78, z, Math.PI / 2, 0x8a6a30); pane(g, 'window', 0.34, 0.5, 1.57, 0.85, z, Math.PI / 2); }
  for (let i = 0; i < 3; i++) bx(g, 1.3 - i * 0.16, 0.1, 0.22, st, 0, 0.05 + i * 0.1, 1.75 - i * 0.2);
  cloth(g, o.team, 0.42, 0.7, 0, 1.75, 1.4);
  banner(g, o.team, -1.5, 0, 1.6, 1.6); banner(g, o.team, 1.5, 0, 1.6, 1.6);
  barrel(g, 1.25, 1.6); barrel(g, 1.6, 1.75, 0.85);
  return g;
}
function church(o: Look): THREE.Group {
  const g = new THREE.Group();
  const holy = o.leaning === 'holy';
  const st = toon(holy ? 0xfaf6ea : o.age >= 2 ? 0xdcd6c6 : 0xc0b498, 'stone'), slate = toon(o.roofColor, 'tiles'), gold = toon(holy ? 0xffd860 : 0xe8c860, '', holy ? 0x8a6a10 : 0x4a3a08);
  const lit = holy ? 0xc09a40 : 0x4a3a18;
  walls(g, 1.5, 1.5, 2.5, st, 0.3, 0, -0.1);
  gable(g, 1.5, 2.5, 1.0, 1.5, slate, st, 0.3, -0.1, 0.12);
  // The apse at the east end, buttresses, tall coloured glass.
  mesh(g, new THREE.CylinderGeometry(0.62, 0.62, 1.3, 14, 1, false, Math.PI / 2, Math.PI), st, 0.3, 0.65, -1.35);
  mesh(g, new THREE.ConeGeometry(0.68, 0.55, 14, 1, false, Math.PI / 2, Math.PI), slate, 0.3, 1.57, -1.35);
  for (const z of [-0.95, -0.25, 0.45]) {
    for (const s of [-1, 1]) bx(g, 0.16, 1.2, 0.2, st, 0.3 + s * 0.8, 0.6, z + 0.36).rotation.z = -s * 0.08;
    pane(g, 'arch', 0.3, 0.8, 1.06, 0.85, z, Math.PI / 2, lit); pane(g, 'arch', 0.3, 0.8, -0.46, 0.85, z, Math.PI / 2, lit);
  }
  // Tower and spire.
  walls(g, 1.0, 2.6, 1.0, st, 0.3, 0, 1.45);
  bx(g, 1.1, 0.08, 1.1, toon(o.team), 0.3, 2.6, 1.45);
  for (const [dx, dz, ry] of [[0, 0.51, 0], [0.51, 0, Math.PI / 2], [-0.51, 0, Math.PI / 2], [0, -0.51, 0]]) pane(g, 'arch', 0.28, 0.5, 0.3 + dx, 2.1, 1.45 + dz, ry);
  mesh(g, new THREE.ConeGeometry(0.72, 1.7, 8), slate, 0.3, 3.5, 1.45);
  const cs = holy ? 1.5 : 1;
  bx(g, 0.05 * cs, 0.5 * cs, 0.05 * cs, gold, 0.3, 4.35 + 0.25 * cs, 1.45); bx(g, 0.28 * cs, 0.05 * cs, 0.05 * cs, gold, 0.3, 4.35 + 0.33 * cs, 1.45);
  pane(g, 'door', 0.46, 0.8, 0.3, 0.42, 1.96);
  bx(g, 0.7, 0.06, 0.3, st, 0.3, 0.03, 2.1);
  for (const [x, z] of [[-1.0, 0.6], [-1.15, 0.0], [-0.95, -0.6]]) bx(g, 0.16, 0.26, 0.05, toon(0xb8b4aa, 'stone'), x, 0.13, z).rotation.y = x * 2;
  if (holy) for (const [x, z, c] of [[1.25, -0.9, 0xe8506a], [1.25, -0.3, 0xf0d040], [1.25, 0.3, 0xffffff], [-0.6, 1.2, 0xe8506a], [-0.75, 0.2, 0xf0d040], [1.2, 0.9, 0xffffff]]) mesh(g, new THREE.SphereGeometry(0.1, 8, 6), toon(c), x, 0.1, z).castShadow = false;
  banner(g, o.team, 1.3, 0, 1.9, 1.0);
  return g;
}
function tavern(o: Look): THREE.Group {
  const g = new THREE.Group();
  const gaudy = o.leaning === 'low', sober = o.leaning === 'holy';
  walls(g, 2.5, 0.24, 1.7, toon(0xb8b4aa, 'stone'));
  walls(g, 2.4, 0.95, 1.6, wallMat(o, false), 0, 0.2);
  walls(g, 2.6, 0.85, 1.8, wallMat(o), 0, 1.15);
  posts(g, o, 2.6, 0.85, 1.8, 1.15);
  if (framed(o)) framing(g, 2.4, 0.95, 1.6, 0.2);
  top(g, o, 2.6, 1.8, 2.0, 1.0);
  if (pitched(o)) chimney(g, -0.8, 2.2, -0.3, 1.0);
  // A porch roof on posts.
  bx(g, 1.5, 0.06, 0.7, pitched(o) ? roofMat(o) : toon(o.team), 0.4, 1.12, 1.15).rotation.x = 0.3;
  for (const x of [-0.3, 1.1]) mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), toon(TIMBER), x, 0.5, 1.42);
  pane(g, 'door', 0.4, 0.7, 0.4, 0.57, 0.81);
  const glow = sober ? 0 : gaudy ? 0xc07020 : 0x7a5020;
  for (const x of [-0.7, 1.0]) pane(g, 'window', 0.32, 0.4, x, 0.75, 0.81, 0, glow);
  for (const x of [-0.7, 0.2, 1.0]) pane(g, 'window', 0.3, 0.38, x, 1.6, 0.91, 0, glow);
  if (sober) { for (const x of [-0.7, 1.0]) bx(g, 0.36, 0.44, 0.05, toon(TIMBER, 'planks'), x, 0.75, 0.83); for (const x of [-0.7, 0.2, 1.0]) bx(g, 0.34, 0.42, 0.05, toon(TIMBER, 'planks'), x, 1.6, 0.93); }
  // The sign: an arm and a painted board with a mug on it.
  bx(g, 0.05, 0.05, 0.7, toon(TIMBER), -1.3, 1.75, 1.2);
  bx(g, 0.04, 0.42, 0.42, toon(0xe8c048), -1.3, 1.42, 1.3);
  mesh(g, new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8).rotateZ(Math.PI / 2), toon(0xfff4d8), -1.3, 1.42, 1.3).scale.x = 0.4;
  barrel(g, 1.5, 1.05); barrel(g, 1.85, 0.85); barrel(g, 1.62, 0.6, 0.9);
  bx(g, 2.62, 0.07, 1.82, toon(o.team), 0, 1.13, 0);
  if (!sober) {
    // A table and benches outside.
    bx(g, 0.8, 0.05, 0.4, toon(0x9a6a3e, 'planks'), -0.8, 0.36, 1.6);
    for (const x of [-1.1, -0.5]) bx(g, 0.05, 0.36, 0.3, toon(TIMBER), x, 0.18, 1.6);
    for (const z of [1.28, 1.92]) bx(g, 0.8, 0.04, 0.14, toon(0x9a6a3e, 'planks'), -0.8, 0.2, z);
  }
  if (gaudy) {
    // Dressed to draw a crowd: red lanterns along the eaves, bright pennants, a great painted mug, more tables.
    for (const x of [-1.2, -0.6, 0, 0.6, 1.2]) { bx(g, 0.02, 0.2, 0.02, toon(TIMBER), x, 1.9, 0.98); mesh(g, new THREE.SphereGeometry(0.1, 10, 8), toon(0xff3a30, '', 0xcc1a10), x, 1.76, 0.98).castShadow = false; }
    for (const [x, c] of [[-1.0, 0xe83a6a], [-0.5, 0xf0c030], [0, 0xe83a6a], [0.5, 0xf0c030], [1.0, 0xe83a6a]]) { const p = bx(g, 0.2, 0.26, 0.03, toon(c, '', new THREE.Color(c).multiplyScalar(0.3).getHex()), x, 1.3, 0.93); p.rotation.z = Math.PI / 4; p.castShadow = false; }
    mesh(g, new THREE.CylinderGeometry(0.3, 0.26, 0.6, 12), toon(0xf0c030, '', 0x6a5010), -1.3, 2.25, 1.3);
    mesh(g, new THREE.CylinderGeometry(0.33, 0.33, 0.14, 12), toon(0xfff4d8), -1.3, 2.6, 1.3);
    mesh(g, new THREE.TorusGeometry(0.16, 0.04, 6, 10, Math.PI).rotateZ(-Math.PI / 2), toon(0xf0c030), -1.3, 2.25, 1.6).rotation.y = Math.PI / 2;
    bx(g, 0.7, 0.4, 0.4, toon(0x9a6a3e, 'planks'), 0.3, 0.2, 1.9);
    for (const x of [0.1, 0.5]) mesh(g, new THREE.CylinderGeometry(0.06, 0.05, 0.12, 8), toon(0xf0c030), x, 0.46, 1.9);
    bx(g, 0.8, 0.02, 0.5, toon(0xb02a4a), 0.4, 0.02, 1.2).castShadow = false;
  }
  return g;
}
function barracks(o: Look): THREE.Group {
  const g = new THREE.Group();
  const wm = o.age >= 2 ? toon(0xc8c2b4, 'stone') : toon(o.age === 0 ? o.wall : 0x9a6a3e, 'planks');
  walls(g, 2.6, 1.1, 1.5, wm, 0, 0, -0.5);
  top(g, o, 2.6, 1.5, 1.1, 0.8, 0, -0.5);
  pane(g, 'door', 0.6, 0.8, 0, 0.42, 0.27);
  cloth(g, o.team, 0.4, 0.55, 0, 1.2, 0.3);
  bx(g, 2.62, 0.08, 1.52, toon(o.team), 0, 1.02, -0.5);
  // The yard: a palisade in early ages, a low stone wall later.
  const stake = (x: number, z: number): void => {
    if (o.age >= 2) { bx(g, 0.17, 0.5, 0.17, toon(0xb8b4aa, 'stone'), x, 0.25, z); return; }
    mesh(g, new THREE.CylinderGeometry(0.06, 0.07, 0.62, 6), toon(TIMBER), x, 0.31, z);
    mesh(g, new THREE.ConeGeometry(0.06, 0.14, 6), toon(TIMBER), x, 0.69, z);
  };
  for (let x = -1.5; x <= 1.5; x += 0.15) if (Math.abs(x) > 0.3) stake(x, 1.7);
  for (let z = 0.3; z < 1.7; z += 0.15) { stake(-1.5, z); stake(1.5, z); }
  // A rack of spears and a straw target.
  bx(g, 0.7, 0.04, 0.04, toon(TIMBER), 0.9, 0.5, 0.9);
  for (const x of [0.6, 1.2]) bx(g, 0.04, 0.5, 0.04, toon(TIMBER), x, 0.25, 0.9);
  for (const x of [0.7, 0.9, 1.1]) { mesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), toon(TIMBER), x, 0.45, 0.84).rotation.x = 0.2; mesh(g, new THREE.ConeGeometry(0.03, 0.1, 5), toon(0xc8ccd4), x, 0.93, 0.74); }
  mesh(g, new THREE.CylinderGeometry(0.22, 0.22, 0.1, 14).rotateX(Math.PI / 2), toon(0xd8c070, 'thatch'), -0.9, 0.5, 1.1);
  mesh(g, new THREE.CylinderGeometry(0.08, 0.08, 0.11, 10).rotateX(Math.PI / 2), toon(0xb03a30), -0.9, 0.5, 1.1);
  bx(g, 0.04, 0.5, 0.04, toon(TIMBER), -0.9, 0.2, 1.05);
  banner(g, o.team, -1.5, 0, 1.7, 1.2);
  return g;
}
function tower(o: Look): THREE.Group {
  const g = new THREE.Group();
  const st = o.age >= 2 ? toon(0xc8c2b4, 'stone') : toon(o.age === 0 ? o.wall : 0x9a6a3e, 'planks');
  const body = new THREE.CylinderGeometry(0.62, 0.74, 2.4, 20);
  const uv = body.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.7);
  mesh(g, body, st, 0, 1.2, 0);
  mesh(g, new THREE.CylinderGeometry(0.78, 0.62, 0.22, 20), st, 0, 2.5, 0);
  mesh(g, new THREE.CylinderGeometry(0.78, 0.78, 0.2, 20), st, 0, 2.7, 0);
  mesh(g, new THREE.CylinderGeometry(0.76, 0.76, 0.08, 20), toon(o.team), 0, 2.36, 0);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; bx(g, 0.2, 0.22, 0.12, st, Math.cos(a) * 0.72, 2.9, Math.sin(a) * 0.72).rotation.y = -a + Math.PI / 2; }
  if (pitched(o) || o.roofKind === 'yurt') {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), toon(TIMBER), Math.cos(a) * 0.55, 3.05, Math.sin(a) * 0.55); }
    mesh(g, new THREE.ConeGeometry(0.86, o.roofKind === 'low' ? 0.5 : 0.75, 20), roofMat(o), 0, o.roofKind === 'low' ? 3.57 : 3.7, 0);
    banner(g, o.team, 0, 3.9, 0, 0.3);
  } else banner(g, o.team, 0, 2.8, 0, 0.9);
  pane(g, 'door', 0.34, 0.6, 0, 0.3, 0.73);
  pane(g, 'window', 0.14, 0.36, 0, 1.5, 0.68);
  return g;
}

const MAKERS: Record<string, (o: Look, seed: number) => THREE.Group> = { towncenter: hall, house, temple: church, tavern, barracks, tower };
/** A hand-shaped building, sized to fit `size` tiles, or null where there is none yet (or the old one is kept). */
export function shapedBuilding(type: string, size: number, o: Look, seed: number): THREE.Group | null {
  const make = MAKERS[type];
  if (!make || (type === 'temple' && o.leaning === 'low')) return null;
  const inner = make(o, seed);
  const box = new THREE.Box3().setFromObject(inner), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  const k = Math.min(1.2, (size * 0.97) / Math.max(s.x, s.z));
  inner.position.set(-c.x * k, 0, -c.z * k);
  inner.scale.setScalar(k);
  const g = new THREE.Group();
  g.add(inner);
  g.userData = inner.userData;
  return g;
}
