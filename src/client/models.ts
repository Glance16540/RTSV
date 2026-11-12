// Procedural low-poly models for units, buildings and resources.

import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import { Gender } from '../sim/game';
import { generatedModel } from './assets';
import { banner, boxGeo, shapedBuilding, Surface, toon } from './shapes';

/**
 * What each colour of the building in hand is made of, so its walls, roof and timbers are painted as such.
 * Empty while a unit is being made: people and beasts are plain colour.
 */
const made = new Map<number, Surface>();
export function mat(color: number, emissive = 0): THREE.MeshToonMaterial {
  return toon(color, emissive ? '' : made.get(color) ?? '', emissive);
}

const geos = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}

function add(parent: THREE.Object3D, g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, emissive = 0): THREE.Mesh {
  const m = new THREE.Mesh(g, mat(color, emissive));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, em = 0) =>
  add(p, geo(`b${w},${h},${d}`, () => boxGeo(w, h, d)), color, x, y, z, em);
/** A rounded limb or body: a capsule r thick and len long overall, standing upright. */
const cap = (p: THREE.Object3D, r: number, len: number, color: number, x = 0, y = 0, z = 0) =>
  add(p, geo(`k${r},${len}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 3, 8)), color, x, y, z);
/** A shape turned on a lathe from a profile of [radius, height] points: tunics, skirts, pots. */
const lathe = (p: THREE.Object3D, key: string, pts: number[][], color: number, x = 0, y = 0, z = 0) =>
  add(p, geo(`l${key}`, () => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 12)), color, x, y, z);
const cyl = (p: THREE.Object3D, rt: number, rb: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 8) =>
  add(p, geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), color, x, y, z);
const ball = (p: THREE.Object3D, r: number, color: number, x = 0, y = 0, z = 0, em = 0) =>
  add(p, geo(`s${r}`, () => new THREE.SphereGeometry(r, 10, 8)), color, x, y, z, em);
/** A plain four-sided pyramid aligned with the building walls. */
const pyramid = (p: THREE.Object3D, half: number, h: number, color: number, x = 0, y = 0, z = 0) => {
  const m = add(p, geo(`r${half},${h}`, () => {
    const c = new THREE.ConeGeometry(half * Math.SQRT2, h, 4).toNonIndexed();
    c.computeVertexNormals(); // flat faces so each side of the roof catches the light differently
    return c;
  }), color, x, y + h / 2, z);
  m.rotation.y = Math.PI / 4;
  return m;
};

/** How a nation roofs its buildings. */
type RoofKind = 'pitched' | 'low' | 'steep' | 'flat' | 'dome' | 'pagoda' | 'yurt';
interface Style { roof: RoofKind; walls: number[]; roofs: number[]; post?: number }
const PLAIN: Style = { roof: 'pitched', walls: [0xb89a6a, 0xa98458, 0xb3aea2, 0xd9d2c0, 0xe8e2d4], roofs: [0xc9b458, 0xb08c40, 0x7d5a40, 0xa8432f, 0x4a5874] };
/** Walls and roofs by age for each nation. Player colour still marks whose building it is. */
const STYLES: Record<string, Style> = {
  hearth: PLAIN,
  stonekin: { roof: 'low', walls: [0xc4b08c, 0xd0c0a0, 0xdcd2bc, 0xe6dfd0, 0xeeeae0], roofs: [0xb8704a, 0xb86840, 0xb55e38, 0xb05432, 0xa84a2e], post: 0xe8e2d4 },
  greece: { roof: 'low', walls: [0xd0c6ae, 0xdcd4c0, 0xe6e0d0, 0xeeeae0, 0xf4f1ea], roofs: [0xc08050, 0xbc7446, 0xb8683e, 0xb05c38, 0x9a5236], post: 0xf4f1ea },
  egypt: { roof: 'flat', walls: [0xd4b47c, 0xdabc86, 0xe0c692, 0xe6d0a0, 0xead8ae], roofs: [0xc09a5c, 0xc8a468, 0xd0ae74, 0xd8b880, 0xdcc08c], post: 0xd8a848 },
  babylon: { roof: 'flat', walls: [0xb4865a, 0xbc9064, 0xc49a6e, 0xcca47a, 0xd4ae86], roofs: [0x8a6a44, 0x7a6a50, 0x3a6a9a, 0x2f62a0, 0x2a58a0], post: 0x2f62a0 },
  dawn: { roof: 'flat', walls: [0xcabc9a, 0xd2c6a6, 0xdad0b4, 0xe2dac2, 0xe8e2d0], roofs: [0xb4a482, 0xbcae8e, 0xc4b89a, 0xccc2a8, 0xd4ccb6], post: 0xe2dac2 },
  arabs: { roof: 'dome', walls: [0xd4c298, 0xdccca6, 0xe4d6b6, 0xece2c8, 0xf2ecda], roofs: [0xc4b088, 0xcab890, 0x4a9a8c, 0x3a8c88, 0x2f8684], post: 0x3a8c88 },
  persia: { roof: 'dome', walls: [0xc4aa82, 0xccb48e, 0xd4be9c, 0xdccaac, 0xe4d6be], roofs: [0xb49464, 0xbc9e70, 0x3a78a8, 0x2f6aa8, 0x2a60a8], post: 0xd8b060 },
  forge: { roof: 'pagoda', walls: [0xb89a6a, 0xc0a474, 0xcabca4, 0xd8d0c0, 0xe2dcd0], roofs: [0x8a866c, 0x7c8470, 0x5f8f78, 0x4f9078, 0x449078], post: 0xa8322a },
  japan: { roof: 'pagoda', walls: [0xc4b088, 0xd0c09c, 0xdcd2b8, 0xe8e2d0, 0xf0ece2], roofs: [0x7a6c5e, 0x6c6258, 0x5e5a5a, 0x54565e, 0x4c5060], post: 0x5a3a28 },
  wild: { roof: 'steep', walls: [0x8a6a44, 0x82623e, 0x7c5c3a, 0x765838, 0x705436], roofs: [0x7a8448, 0x6e7842, 0x6a5c3c, 0x5a4c36, 0x4c4238] },
  england: { roof: 'steep', walls: [0xb89a6a, 0xb8a078, 0xcfc6b0, 0xd9d2c0, 0xe8e2d4], roofs: [0xc9b458, 0xb89848, 0x8a6a48, 0x6a6460, 0x565a66] },
  steppe: { roof: 'yurt', walls: [0xd4cab4, 0xd8d0bc, 0xded6c4, 0xe2dccc, 0xe8e2d4], roofs: [0xe6dec8, 0xdcd2ba, 0xd0c2a2, 0xc4ae86, 0xb89a6a] },
};
let style: Style = PLAIN;
let styleRoof = PLAIN.roofs[0];

/**
 * A roof in the fashion of whoever is building. Spires, awnings and anything in another colour
 * stay simple pyramids, so only real roofs take the nation's shape.
 */
const roof = (p: THREE.Object3D, half: number, h: number, color: number, x = 0, y = 0, z = 0): THREE.Object3D => {
  const kind = color === styleRoof && h < half * 1.5 ? style.roof : 'pitched';
  if (kind === 'pitched') return pyramid(p, half, h, color, x, y, z);
  if (kind === 'low') return pyramid(p, half * 1.04, h * 0.62, color, x, y, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  if (kind === 'steep') {
    pyramid(g, half * 1.02, h * 1.45, color);
    // Crossed beams at the peak.
    for (const r of [0.5, -0.5]) box(g, 0.05, 0.4, 0.05, DARKWOOD, 0, h * 1.45, 0).rotation.z = r;
  } else if (kind === 'flat') {
    // A roof to walk on, with a parapet and a stair hut.
    box(g, half * 2 + 0.08, 0.12, half * 2 + 0.08, color, 0, 0.06, 0);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(g, 0.2, 0.2, 0.2, color, cx * (half - 0.08), 0.22, cz * (half - 0.08));
    if (half > 0.8) box(g, half * 0.7, 0.3, half * 0.7, color, -half * 0.35, 0.27, -half * 0.35);
  } else if (kind === 'dome') {
    box(g, half * 2 + 0.06, 0.1, half * 2 + 0.06, style.walls[2], 0, 0.05, 0);
    const d = add(g, geo(`dome${half}`, () => new THREE.SphereGeometry(half * 0.82, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)), color, 0, 0.1, 0);
    d.scale.y = Math.max(0.75, Math.min(1.25, h / half));
    cyl(g, 0.02, 0.04, 0.3, 0xe8c860, 0, 0.1 + half * 0.82 * d.scale.y + 0.12, 0, 6);
  } else if (kind === 'yurt') {
    add(g, geo(`yurt${half},${h}`, () => new THREE.CylinderGeometry(half * 0.2, half * 1.12, h * 0.75, 12)), color, 0, h * 0.375, 0);
    cyl(g, half * 1.14, half * 1.14, 0.08, 0xa8432f, 0, 0.02, 0, 12);
    cyl(g, half * 0.22, half * 0.22, 0.06, 0x5a4a3a, 0, h * 0.75 + 0.02, 0, 10);
  } else {
    // Pagoda: wide eaves below, a second, steeper roof above.
    pyramid(g, half * 1.22, h * 0.42, color);
    box(g, half * 1.3, 0.16, half * 1.3, style.post ?? DARKWOOD, 0, h * 0.42 - 0.02, 0);
    pyramid(g, half * 0.78, h * 0.7, color, 0, h * 0.48, 0);
    cyl(g, 0.03, 0.05, 0.25, 0xe8c860, 0, h * 1.18 + 0.1, 0, 6);
  }
  return g;
};

const SKIN = 0xe0ac7e;
const HAIR = [0x3a2a1a, 0x5a3a1c, 0x1e1a18, 0x8a6a3a];
const WOOD = 0x7a5230;
const DARKWOOD = 0x4e3520;
const IRON = 0x9aa0a8;
const HORSE = [0x6b4a2e, 0x8a6a48, 0x3e2e24];

export const RES_COLOR: Record<string, number> = { food: 0xc0392b, wood: 0x8a5a2b, gold: 0xf2c230, stone: 0x9a9a9a };

/** A leg hinged at the hip so it can swing while walking. `side` alternates the stride. */
function leg(g: THREE.Object3D, w: number, h: number, color: number, x: number, z: number, side: number, y = 0): void {
  const hip = new THREE.Group();
  hip.position.set(x, y + h, z);
  hip.userData.leg = side;
  cap(hip, w * 0.56, h, color, 0, -h / 2, 0);
  g.add(hip);
}

/** A man's or woman's leg: thigh, a narrower shin and a boot, hinged at the hip. */
function humanLeg(g: THREE.Object3D, color: number, x: number, side: number, y: number): void {
  const hip = new THREE.Group();
  hip.position.set(x, y + 0.3, 0);
  hip.userData.leg = side;
  cap(hip, 0.058, 0.18, color, 0, -0.085, 0);
  add(hip, geo('shin', () => new THREE.CylinderGeometry(0.05, 0.036, 0.14, 8)), color, 0, -0.2, 0);
  box(hip, 0.075, 0.05, 0.14, 0x2e2218, 0, -0.275, 0.025);
  g.add(hip);
}
/** A face: two dark eyes are enough at this size to make a head read as a person. */
function face(g: THREE.Object3D, y: number, z = 0.098): void {
  for (const x of [-0.042, 0.042]) add(g, geo('eye', () => new THREE.SphereGeometry(0.015, 6, 5)), 0x1e1a18, x, y, z).castShadow = false;
}

/** A man on foot (or in the saddle, with y raised): broad in the shoulder, belted at the waist. */
function humanoid(g: THREE.Object3D, body: number, legs: number, hair: number, y = 0): void {
  if (y === 0) g.userData.biped = true;
  humanLeg(g, legs, -0.065, 0, y);
  humanLeg(g, legs, 0.065, Math.PI, y);
  // A belted tunic: flared at the hem, wide at the chest and shoulders, drawn in at the neck.
  lathe(g, 'tunic', [[0.135, 0], [0.125, 0.06], [0.108, 0.17], [0.112, 0.2], [0.142, 0.31], [0.152, 0.37], [0.1, 0.41], [0.045, 0.44]], body, 0, y + 0.24, 0).scale.z = 0.66;
  add(g, geo('belt', () => new THREE.TorusGeometry(0.112, 0.016, 5, 12).rotateX(Math.PI / 2)), 0x2e2218, 0, y + 0.43, 0).scale.z = 0.68;
  for (const x of [-0.155, 0.155]) ball(g, 0.055, body, x, y + 0.6, 0);
  cyl(g, 0.04, 0.046, 0.08, SKIN, 0, y + 0.67, 0, 8);
  // The off arm: a sleeve to the elbow, a bare forearm and a hand.
  cap(g, 0.042, 0.19, body, -0.185, y + 0.52, 0).rotation.z = -0.12;
  cap(g, 0.035, 0.17, SKIN, -0.205, y + 0.385, 0.01).rotation.z = -0.06;
  ball(g, 0.04, SKIN, -0.213, y + 0.295, 0.015);
  ball(g, 0.11, SKIN, 0, y + 0.76, 0).scale.y = 1.08;
  add(g, geo('hair', () => new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)), hair, 0, y + 0.778, -0.012);
  face(g, y + 0.765);
  for (const c of g.children) c.userData.body ??= true; // the person, as against what they wear and carry
}

/**
 * A woman in a long dress: a full skirt from the hips, a narrow waist, a fitted bodice,
 * and her hair worn long, pinned up or under a scarf.
 */
function woman(g: THREE.Object3D, dress: number, hair: number, seed: number, trim = 0xe8e2d4, bodice = dress, cut = 0): void {
  g.userData.biped = true;
  // The skirt hangs from the waist, so it swings from there.
  const skirt = new THREE.Group();
  skirt.position.y = 0.4;
  g.add(loose(skirt, 'rx', 0.3, 70, 4.5));
  lathe(skirt, 'skirt', [[0.21, 0], [0.2, 0.04], [0.155, 0.2], [0.13, 0.3], [0.086, 0.4]], dress, 0, -0.4, 0).scale.z = 0.8;
  lathe(g, 'bodice', [[0.086, 0], [0.1, 0.06], [0.116, 0.11], [0.11, 0.16], [0.118, 0.2], [0.06, 0.245], [0.036, 0.27]], cut ? SKIN : bodice, 0, 0.4, 0).scale.z = 0.6;
  for (const x of [-0.05, 0.05]) loose(ball(g, cut ? 0.056 : 0.05, bodice, x, 0.512 - cut * 0.004, 0.048), 'y', 0.07 + cut * 0.015, 150, 5.5);
  if (cut) {
    // A laced bodice worn low over a white blouse off the shoulders: `cut` 2 sits lower still.
    const top = cut > 1 ? 0.12 : 0.15;
    lathe(g, `stays${cut}`, [[0.088, 0], [0.103, 0.06], [0.122, 0.11], [0.12, top]], bodice, 0, 0.4, 0).scale.z = 0.64;
    for (const x of [-0.05, 0.05]) loose(ball(g, 0.045, SKIN, x, 0.538, 0.05), 'y', 0.07 + cut * 0.015, 150, 5.5).scale.set(1, 0.7, 0.9);
    for (const x of [-0.128, 0.128]) ball(g, 0.05, 0xf4eee0, x, 0.575, 0);
    for (let i = 0; i < 3; i++) box(g, 0.05, 0.008, 0.01, 0xf4eee0, 0, 0.42 + i * 0.03, 0.079);
  }
  add(g, geo('sash', () => new THREE.TorusGeometry(0.086, 0.014, 5, 12).rotateX(Math.PI / 2)), trim, 0, 0.405, 0).scale.z = 0.72;
  for (const x of [-0.05, 0.05]) box(g, 0.06, 0.04, 0.1, 0x2e2218, x, 0.02, 0.13);
  cyl(g, 0.033, 0.038, 0.08, SKIN, 0, 0.67, 0, 8);
  // The off arm, slimmer than a man's.
  cap(g, 0.034, 0.18, dress, -0.15, 0.53, 0).rotation.z = -0.14;
  cap(g, 0.029, 0.16, SKIN, -0.172, 0.4, 0.01).rotation.z = -0.06;
  ball(g, 0.033, SKIN, -0.18, 0.315, 0.015);
  ball(g, 0.104, SKIN, 0, 0.76, 0).scale.y = 1.06;
  face(g, 0.762, 0.092);
  add(g, geo('hairf', () => new THREE.SphereGeometry(0.115, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), seed % 3 === 2 ? trim : hair, 0, 0.775, -0.014);
  if (seed % 3 === 0) {
    // Worn long down the back, swinging from the nape.
    const fall = new THREE.Group();
    fall.position.set(0, 0.76, -0.085);
    fall.userData.joint = 'head';
    g.add(loose(fall, 'rx', 1.0, 80, 4));
    cap(fall, 0.07, 0.34, hair, 0, -0.14, 0).scale.set(1.35, 1, 0.55);
  } else if (seed % 3 === 1) loose(ball(g, 0.062, hair, 0, 0.83, -0.085), 'y', 0.03, 240, 9); // pinned up in a bun
  else {
    // A scarf, and a braid below it.
    const braid = new THREE.Group();
    braid.position.set(0, 0.72, -0.1);
    braid.userData.joint = 'head';
    g.add(loose(braid, 'rx', 1.3, 70, 3.5));
    cap(braid, 0.03, 0.26, hair, 0, -0.12, 0);
    ball(braid, 0.045, trim, 0, -0.02, 0);
  }
  for (const c of g.children) c.userData.body ??= true;
}

/** Right arm + weapon, pivoting at the shoulder so it can swing. A sleeve to the elbow if `sleeve` is given. */
function arm(g: THREE.Object3D, y = 0, sleeve = SKIN, slim = 1): THREE.Group {
  const a = new THREE.Group();
  a.position.set(0.19, y + 0.58, 0);
  cap(a, 0.042 * slim, 0.19, sleeve, 0, -0.06, 0);
  cap(a, 0.035 * slim, 0.17, SKIN, 0, -0.19, 0.008);
  ball(a, 0.04 * slim, SKIN, 0, -0.285, 0.012);
  g.add(a);
  g.userData.arm = a;
  return a;
}

function horse(g: THREE.Object3D, color: number, armor = 0): void {
  cap(g, 0.17, 0.88, color, 0, 0.56, 0).rotation.x = Math.PI / 2;
  if (armor) box(g, 0.36, 0.2, 0.6, armor, 0, 0.6, -0.02);
  const neck = cap(g, 0.1, 0.5, color, 0, 0.84, 0.4);
  neck.rotation.x = 0.5;
  cap(g, 0.085, 0.36, color, 0, 0.99, 0.6).rotation.x = Math.PI / 2 + 0.25;
  for (const x of [-0.06, 0.06]) add(g, geo('ear', () => new THREE.ConeGeometry(0.03, 0.09, 4)), color, x, 1.1, 0.5);
  box(g, 0.03, 0.26, 0.2, 0x2a1e16, 0, 0.93, 0.3).rotation.x = 0.5;
  [[-0.1, 0.3], [0.1, 0.3], [-0.1, -0.3], [0.1, -0.3]].forEach(([x, z], i) => leg(g, 0.08, 0.42, color, x, z, i % 3 ? Math.PI : 0));
  const tail = box(g, 0.06, 0.3, 0.06, 0x2a1e16, 0, 0.52, -0.44);
  tail.rotation.x = -0.4;
}

/** The joints of a figure on foot, turned by the recorded motions. */
export interface Rig { root: THREE.Group; torso: THREE.Group; head: THREE.Group; armR: THREE.Object3D; armL: THREE.Group; legs: THREE.Object3D[]; loose: Loose[]; /** Armour, hats, shields and gear that can be knocked off, the first to go first. */ gear: THREE.Object3D[] }
/**
 * Something on a figure that is not held rigid: it lags, bounces and settles on a spring as the body moves.
 * `mode` y bobs it up and down; rx and rz swing it about where it hangs.
 */
export interface Loose { o: THREE.Object3D; mode: 'y' | 'rx' | 'rz'; gain: number; k: number; c: number; d: number; v: number; rest: number }
type Spring = Pick<Loose, 'mode' | 'gain' | 'k' | 'c'>;
/** Marks a part as loose. Parts not marked are judged by where they sit: hats, things on the back, shields, weapons. */
const loose = <T extends THREE.Object3D>(o: T, mode: Loose['mode'], gain: number, k = 150, c = 6): T => { o.userData.loose = { mode, gain, k, c } as Spring; return o; };
/**
 * Gives a figure on foot its joints. The figure is built standing still, as one flat group of parts;
 * here each part is hung on the joint it belongs to (by where it sits), so the whole figure can be posed.
 */
export function rigBiped(g: THREE.Group): Rig | null {
  if (!g.userData.biped || !g.userData.arm) return null;
  g.updateMatrixWorld(true);
  const parts = [...g.children];
  const joint = (x: number, y: number, z: number, parent: THREE.Object3D): THREE.Group => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const root = joint(0, 0.3, 0, g), torso = joint(0, 0, 0, root), head = joint(0, 0.37, 0, torso), armL = joint(-0.19, 0.28, 0, torso);
  const armR = g.userData.arm as THREE.Object3D, legs: THREE.Object3D[] = [];
  g.updateMatrixWorld(true);
  const box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
  const found: Loose[] = [];
  const free = (o: THREE.Object3D, sp: Spring): void => { found.push({ o, ...sp, d: 0, v: 0, rest: 0 }); };
  for (const p of parts) {
    if (p.userData.leg !== undefined) { root.attach(p); legs.push(p); continue; }
    if (p === armR) { torso.attach(p); continue; }
    box.setFromObject(p, true); box.getCenter(c); box.getSize(s);
    const to = p.userData.joint === 'head' || c.y > 0.67 ? head : c.x < -0.14 && s.x < 0.3 && c.y < 0.67 ? armL : torso;
    to.attach(p);
    const marked = p.userData.loose as Spring | undefined;
    if (marked) free(p, marked);
    // A hat, crest or plume nods; a shield on the arm rattles; a pack, quiver or cape on the back swings.
    else if (p.userData.body) continue;
    else if (to === head && c.y > 0.84) free(p, { mode: 'y', gain: 0.03, k: 220, c: 9 });
    else if (to === armL && Math.max(s.x, s.y, s.z) > 0.2) free(p, { mode: 'rx', gain: 0.6, k: 120, c: 6 });
    else if (to === torso && c.z < -0.09 && s.y < 0.5) free(p, { mode: 'rx', gain: 0.8, k: 90, c: 5 });
  }
  // Whatever is in the weapon hand lags behind the arm and swings on after it stops.
  armR.children.forEach((w, i) => { if (i > 2 && !w.userData.loose) free(w, { mode: 'rx', gain: 0.5, k: 110, c: 5 }); else if (w.userData.loose) free(w, w.userData.loose as Spring); });
  for (const l of found) l.rest = l.mode === 'y' ? l.o.position.y : l.mode === 'rx' ? l.o.rotation.x : l.o.rotation.z;
  // The leg on the weapon side first, as the motions list it.
  legs.sort((a, b) => b.position.x - a.position.x);
  const keep = new Set<unknown>([g.userData.carry, g.userData.glow]);
  const gear = [...armL.children, ...head.children, ...torso.children].filter((p) => !p.userData.body && p !== armR && p !== head && p !== armL && !keep.has(p));
  return { root, torso, head, armR, armL, legs, loose: found, gear };
}

const UNIT_HEIGHT: Record<string, number> = {
  warchariot: 1.4, warelephant: 1.9, companion: 1.5, camelrider: 1.45, mameluke: 1.45, horsearcher: 1.45, templar: 1.5, warbear: 0.9, trebuchet: 1.6, organgun: 0.8, rider: 1.45, knight: 1.5, hussar: 1.5, lancer: 1.5, wolfrider: 1.4, chariot: 1.4, mammoth: 1.9, catapult: 1.1, bombard: 0.9, ram: 1.0, scorpion: 0.9, warlord: 1.2, hound: 0.55,
};

/** Units of the newer nations are drawn as an existing figure with a crest of their own colour. */
const MODEL_ALIAS: Record<string, [string, number]> = {
  khopesh: ['swordsman', 0xd8b46a], warchariot: ['chariot', 0xd8b46a], sapper: ['spearman', 0x8a6a4a], gateguard: ['shieldbearer', 0x3a8fa8],
  immortal: ['swordsman', 0xb03a6a], warelephant: ['mammoth', 0xb03a6a], hoplite: ['shieldbearer', 0xc8a040], companion: ['knight', 0x4a78d8],
  longbowman: ['bowman', 0x4a7a3a], billman: ['pikeman', 0xc83a3a], camelrider: ['rider', 0xd8c090], mameluke: ['horsearcher', 0x2f9a6a],
  samurai: ['swordsman', 0x2a2a34], ashigaru: ['musketeer', 0x8a2a2a],
};

/** What a villager is busy with, which decides what they wear and carry. */
export type Job = '' | 'wood' | 'farm' | 'hunt' | 'forage' | 'mine' | 'build';

/** Dresses a villager for their work: the tool in hand, and the clothes that go with the trade. */
function outfit(g: THREE.Object3D, a: THREE.Group, f: boolean, job: Job): void {
  const STRAW = 0xd8c070, LEATHER = 0x6a4a2c;
  const haft = (len: number, color = WOOD): THREE.Mesh => { const h = cyl(a, 0.014, 0.014, len, color, 0, -0.28, len / 2 - 0.08, 5); h.rotation.x = Math.PI / 2; return h; };
  const apron = (color: number): void => {
    if (f) box(g, 0.15, 0.28, 0.02, color, 0, 0.25, 0.135).rotation.x = -0.22;
    else { box(g, 0.17, 0.2, 0.02, color, 0, 0.36, 0.09).rotation.x = -0.1; box(g, 0.15, 0.14, 0.02, color, 0, 0.53, 0.1); }
  };
  const strawHat = (): void => { cyl(g, 0.2, 0.21, 0.02, STRAW, 0, 0.855, 0, 12); cyl(g, 0.1, 0.115, 0.08, STRAW, 0, 0.9, 0, 10); };
  switch (job) {
    case 'wood': {
      // A woodcutter: felling axe, leather jerkin, a cap or a kerchief.
      haft(0.46);
      box(a, 0.03, 0.12, 0.1, IRON, 0, -0.3, 0.34);
      if (f) add(g, geo('kerchief', () => new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45)), 0xa8432f, 0, 0.785, -0.012);
      else { cyl(g, 0.132, 0.118, 0.2, LEATHER, 0, 0.54, 0, 10).scale.z = 0.7; add(g, geo('cap', () => new THREE.SphereGeometry(0.124, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.42)), 0x4a6a3a, 0, 0.785, -0.008); }
      break;
    }
    case 'farm': {
      // A farmer: bib overalls (an apron on a woman), a straw hat and a hoe.
      haft(0.6);
      box(a, 0.1, 0.1, 0.02, IRON, 0, -0.33, 0.5);
      if (f) apron(0xe8e2d4);
      else {
        box(g, 0.17, 0.17, 0.02, 0x4a6488, 0, 0.53, 0.098);
        for (const x of [-0.065, 0.065]) { box(g, 0.03, 0.14, 0.02, 0x4a6488, x, 0.635, 0.085).rotation.x = -0.35; box(g, 0.03, 0.2, 0.02, 0x4a6488, x, 0.58, -0.1); }
        lathe(g, 'bibwaist', [[0.128, 0], [0.114, 0.12], [0.117, 0.17]], 0x4a6488, 0, 0.27, 0).scale.z = 0.7;
      }
      strawHat();
      break;
    }
    case 'hunt': {
      // A hunter: bow in hand, quiver on the back, a green hood and short cape.
      const bow = add(a, geo('bow', () => new THREE.TorusGeometry(0.24, 0.013, 4, 12, Math.PI)), LEATHER, 0, -0.28, 0.07);
      bow.rotation.set(0, Math.PI / 2, -Math.PI / 2);
      box(a, 0.005, 0.48, 0.005, 0xe8e2d0, 0, -0.28, 0.07);
      const q = cyl(g, 0.04, 0.035, 0.28, LEATHER, 0.07, 0.56, -0.13, 7);
      q.rotation.z = -0.4;
      for (const d of [-0.012, 0.012]) box(g, 0.012, 0.1, 0.012, 0xe8dcc0, 0.14 + d, 0.72, -0.13 + d).rotation.z = -0.4;
      add(g, geo('hood', () => new THREE.SphereGeometry(0.128, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62)), 0x3f6a36, 0, 0.775, -0.02);
      cyl(g, 0.09, 0.18, 0.13, 0x3f6a36, 0, 0.6, 0, 10).scale.z = 0.72;
      break;
    }
    case 'forage': {
      // A forager: a basket of berries on the arm, an apron.
      cyl(a, 0.085, 0.065, 0.09, 0xa8783e, 0, -0.34, 0.07, 9);
      for (const [x, z] of [[-0.03, 0.05], [0.03, 0.08], [0, 0.1]]) ball(a, 0.028, 0xc0392b, x, -0.295, z);
      apron(0xe8e2d4);
      break;
    }
    case 'mine': {
      // A miner: pick, a heavy leather apron, a close cap.
      haft(0.5);
      const head = box(a, 0.3, 0.035, 0.035, IRON, 0, -0.28, 0.42);
      head.rotation.y = 0.12;
      apron(0x4a3a2a);
      add(g, geo('mcap', () => new THREE.SphereGeometry(0.124, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45)), 0x3a2e24, 0, 0.785, -0.008);
      break;
    }
    case 'build': {
      // A builder: mallet, a tan work apron with a tool loop.
      haft(0.3);
      box(a, 0.07, 0.07, 0.12, 0x8a6238, 0, -0.28, 0.22).rotation.y = Math.PI / 2;
      apron(0xc8a878);
      box(g, 0.03, 0.09, 0.03, IRON, f ? 0.1 : 0.12, 0.38, 0.06);
      break;
    }
  }
}

/** Those who work inside the tavern and the church, shown standing by the door. */
export type StaffRole = 'milkmaid' | 'patron' | 'monk' | 'nun';
export function makeStaff(role: StaffRole, seed: number, leaning: '' | 'holy' | 'low'): THREE.Group {
  made.clear();
  const g = new THREE.Group();
  const hair = HAIR[seed % HAIR.length], GOLD = 0xe8c860;
  const mug = (p: THREE.Object3D, x: number, y: number, z: number): void => { cyl(p, 0.04, 0.035, 0.08, 0xd8a838, x, y, z, 8); cyl(p, 0.042, 0.042, 0.02, 0xfff4d8, x, y + 0.05, z, 8); };
  const robe = (color: number, fat = 1): void => {
    const r = lathe(g, 'robe', [[0.18, 0], [0.165, 0.1], [0.12, 0.4], [0.135, 0.56], [0.14, 0.6], [0.05, 0.67]], color);
    r.scale.set(fat, 1, 0.78 * fat);
    for (const x of [-0.14, 0.14]) { const s = cap(g, 0.05, 0.3, color, x * fat, 0.5, 0.05); s.rotation.set(-0.7, 0, x > 0 ? 0.3 : -0.3); }
    ball(g, 0.045, SKIN, 0, 0.44, 0.15 * fat);
    cyl(g, 0.036, 0.04, 0.07, SKIN, 0, 0.67, 0, 8);
    ball(g, 0.105, SKIN, 0, 0.76, 0);
    face(g, 0.762, 0.093);
  };
  if (role === 'milkmaid') {
    // In a pious town a plain dairymaid with her pails; otherwise a tavern maid in a laced bodice, lower-cut the more decadent the town.
    const holy = leaning === 'holy', low = leaning === 'low';
    woman(g, holy ? 0x6a7a94 : low ? 0xb02a3a : [0x3f6a4a, 0x8a4a6a, 0x4a5a8a][seed % 3], hair, holy ? 2 : seed % 2, 0xf4eee0, holy ? 0x6a7a94 : low ? 0x3a1a1e : 0x5a3424, holy ? 0 : low ? 2 : 1);
    const a = arm(g, -0.02, holy ? 0x6a7a94 : SKIN, 0.82);
    a.position.x = 0.15;
    if (holy) { for (const x of [-0.19, 0.19]) { cyl(g, 0.06, 0.05, 0.1, 0x9a6a3e, x, 0.2, 0.03, 9); cyl(g, 0.052, 0.052, 0.01, 0xf4f4f0, x, 0.25, 0.03, 9); } }
    else { a.rotation.x = -1.2; mug(a, 0, -0.33, 0.04); if (low) mug(g, -0.2, 0.33, 0.06); }
    if (!holy) box(g, 0.13, 0.2, 0.02, 0xf4eee0, 0, 0.27, 0.132).rotation.x = -0.22;
  } else if (role === 'patron') {
    const low = leaning === 'low';
    humanoid(g, [0x7a5a3a, 0x5a6a4a, 0x6a4a5a][seed % 3], 0x4a3a2a, hair);
    const a = arm(g, 0, SKIN);
    a.rotation.x = -1.1;
    if (leaning === 'holy') cyl(a, 0.07, 0.04, 0.05, 0xb08850, 0, -0.33, 0.03, 9); // a bowl of soup
    else mug(a, 0, -0.33, 0.04);
    if (low) { ball(g, 0.03, 0xc04a3a, 0, 0.745, 0.105); g.rotation.z = 0.22; cyl(g, 0.03, 0.035, 0.14, 0x3a5a2a, -0.24, 0.3, 0.05, 7); }
  } else if (role === 'monk') {
    const low = leaning === 'low';
    robe(0x5a4634, low ? 1.3 : 1);
    add(g, geo('rope', () => new THREE.TorusGeometry(0.118, 0.012, 5, 12).rotateX(Math.PI / 2)), 0xd8c8a0, 0, 0.42, 0).scale.set(low ? 1.3 : 1, 1, 0.8 * (low ? 1.3 : 1));
    add(g, geo('tonsure', () => new THREE.TorusGeometry(0.085, 0.03, 5, 12).rotateX(Math.PI / 2)), hair, 0, 0.8, -0.01);
    if (low) { cyl(g, 0.06, 0.07, 0.14, 0x8a5a3a, 0.17, 0.42, 0.14, 8); ball(g, 0.03, 0xc04a3a, 0, 0.745, 0.1); }
    else { box(g, 0.025, 0.1, 0.015, GOLD, 0, 0.56, 0.115); box(g, 0.065, 0.025, 0.015, GOLD, 0, 0.58, 0.115); }
  } else {
    robe(0x26242a);
    add(g, geo('wimple', () => new THREE.SphereGeometry(0.115, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6)), 0xf4f4f0, 0, 0.768, -0.008);
    add(g, geo('veil', () => new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.75)), 0x26242a, 0, 0.775, -0.04).scale.z = 0.85;
    cyl(g, 0.075, 0.1, 0.06, 0xf4f4f0, 0, 0.645, 0.01, 10);
    box(g, 0.022, 0.08, 0.012, GOLD, 0, 0.53, 0.11); box(g, 0.055, 0.022, 0.012, GOLD, 0, 0.545, 0.11);
  }
  return g;
}

export function makeUnit(type: string, color: number, gender: Gender | null, seed: number, job: Job = ''): THREE.Group {
  made.clear();
  const alias = MODEL_ALIAS[type];
  if (alias && !generatedModel(type, 0, 1, 'height')) {
    const g = makeUnit(alias[0], color, gender, seed, job);
    const h = UNIT_HEIGHT[alias[0]] ?? 0.95;
    // A plume and a shoulder sash mark them out from the unit they are drawn from.
    const plume = add(g, geo('plume', () => new THREE.ConeGeometry(0.07, 0.26, 5)), alias[1], 0, h + 0.14, 0, 0x101010);
    plume.castShadow = false;
    const sash = add(g, geo('sash', () => new THREE.BoxGeometry(0.36, 0.05, 0.22)), alias[1], 0, h * 0.62, 0);
    sash.rotation.z = 0.5;
    return g;
  }
  const key = type === 'villager' ? `villager_${gender}` : type;
  const gen = generatedModel(key, 0, UNIT_HEIGHT[type] ?? 0.95, 'height');
  if (gen) {
    // Generated models are not tinted, so a coloured disc underfoot shows who owns the unit.
    const disc = add(gen, geo('team', () => new THREE.CircleGeometry(1, 20)), color, 0, 0.03, 0, color);
    disc.rotation.x = -Math.PI / 2;
    disc.scale.setScalar(type === 'mammoth' ? 0.8 : type === 'villager' ? 0.3 : 0.42);
    disc.castShadow = false;
    return gen;
  }
  const g = new THREE.Group();
  const hair = HAIR[seed % HAIR.length];
  switch (type) {
    case 'villager': {
      let a: THREE.Group;
      if (gender === 'f') {
        woman(g, color, hair, job === 'farm' || job === 'forage' ? 2 : seed);
        a = arm(g, -0.02, color, 0.82);
        a.position.x = 0.15;
      } else {
        humanoid(g, color, job === 'farm' ? 0x4a6488 : job === 'mine' ? 0x3e3a36 : 0x5b4630, hair);
        a = arm(g, 0, color);
      }
      outfit(g, a, gender === 'f', job);
      const carry = box(g, 0.2, 0.2, 0.16, RES_COLOR.wood, 0, 0.5, -0.19);
      carry.visible = false;
      g.userData.carry = carry;
      break;
    }
    case 'deer': {
      const fur = 0xa8743e;
      box(g, 0.24, 0.26, 0.6, fur, 0, 0.5, 0);
      const neck = box(g, 0.12, 0.34, 0.14, fur, 0, 0.74, 0.3);
      neck.rotation.x = 0.4;
      box(g, 0.13, 0.13, 0.26, fur, 0, 0.9, 0.44);
      [[-0.08, 0.22], [0.08, 0.22], [-0.08, -0.22], [0.08, -0.22]].forEach(([x, z], i) => leg(g, 0.05, 0.4, 0x7a5228, x, z, i % 3 ? Math.PI : 0));
      box(g, 0.08, 0.1, 0.06, 0xf0e8d8, 0, 0.56, -0.32);
      if (seed % 2) for (const x of [-0.07, 0.07]) box(g, 0.03, 0.22, 0.03, 0xe8dcc0, x, 1.06, 0.36).rotation.z = x * 5;
      break;
    }
    case 'wolf': {
      const fur = 0x5c5c62;
      box(g, 0.24, 0.24, 0.66, fur, 0, 0.4, 0);
      box(g, 0.2, 0.2, 0.26, fur, 0, 0.52, 0.42);
      box(g, 0.1, 0.1, 0.16, 0x3a3a40, 0, 0.48, 0.6);
      for (const x of [-0.07, 0.07]) box(g, 0.05, 0.1, 0.04, 0x3a3a40, x, 0.66, 0.36);
      [[-0.08, 0.24], [0.08, 0.24], [-0.08, -0.24], [0.08, -0.24]].forEach(([x, z], i) => leg(g, 0.06, 0.3, 0x4a4a50, x, z, i % 3 ? Math.PI : 0));
      box(g, 0.07, 0.07, 0.34, fur, 0, 0.44, -0.46).rotation.x = 0.5;
      break;
    }
    case 'clubman': {
      humanoid(g, 0x9a7a4e, 0x6b5236, hair);
      box(g, 0.32, 0.1, 0.2, color, 0, 0.42, 0);
      const a = arm(g);
      const club = cyl(a, 0.07, 0.035, 0.5, WOOD, 0, -0.26, 0.2);
      club.rotation.x = Math.PI / 2;
      break;
    }
    case 'slinger': {
      humanoid(g, color, 0x6b5236, hair);
      const a = arm(g);
      box(a, 0.03, 0.03, 0.34, 0xd8c8a0, 0, -0.26, 0.15);
      ball(a, 0.05, 0x888888, 0, -0.26, 0.34);
      break;
    }
    case 'spearman': {
      humanoid(g, color, 0x5b4630, hair);
      const a = arm(g);
      const s = cyl(a, 0.02, 0.02, 1.3, WOOD, 0, -0.24, 0.3, 5);
      s.rotation.x = Math.PI / 2 - 0.15;
      const tip = cyl(a, 0, 0.045, 0.16, IRON, 0, -0.14, 1.0, 5);
      tip.rotation.x = Math.PI / 2 - 0.15;
      const sh = cyl(g, 0.17, 0.17, 0.04, 0x8a6a3a, -0.22, 0.46, 0.1, 10);
      sh.rotation.z = Math.PI / 2;
      break;
    }
    case 'swordsman': {
      humanoid(g, IRON, 0x54585e, 0x777c84);
      box(g, 0.31, 0.12, 0.19, color, 0, 0.5, 0);
      const a = arm(g);
      box(a, 0.04, 0.06, 0.5, 0xd0d4da, 0, -0.26, 0.28);
      const sh = cyl(g, 0.2, 0.2, 0.05, color, -0.23, 0.46, 0.08, 10);
      sh.rotation.z = Math.PI / 2;
      break;
    }
    case 'bowman':
    case 'crossbowman': {
      const cross = type === 'crossbowman';
      humanoid(g, cross ? 0x5e6a4a : 0x4f7a3a, 0x4a3a28, hair);
      box(g, 0.31, 0.08, 0.19, color, 0, 0.56, 0);
      if (cross) box(g, 0.28, 0.1, 0.24, IRON, 0, 0.82, 0);
      const a = arm(g);
      if (cross) {
        box(a, 0.05, 0.05, 0.4, DARKWOOD, 0, -0.24, 0.2);
        box(a, 0.4, 0.04, 0.04, DARKWOOD, 0, -0.24, 0.36);
      } else {
        const bow = add(a, geo('bow', () => new THREE.TorusGeometry(0.24, 0.018, 4, 10, Math.PI)), WOOD, 0, -0.24, 0.22);
        bow.rotation.set(0, Math.PI / 2, -Math.PI / 2);
      }
      box(g, 0.1, 0.3, 0.08, 0x6a4a2a, 0.06, 0.5, -0.14);
      break;
    }
    case 'musketeer': {
      humanoid(g, color, 0x3a3a40, hair);
      box(g, 0.31, 0.06, 0.19, 0xe8e2d0, 0, 0.52, 0);
      cyl(g, 0.2, 0.2, 0.03, 0x2c2c30, 0, 0.86, 0, 10);
      cyl(g, 0.11, 0.13, 0.12, 0x2c2c30, 0, 0.92, 0, 10);
      const a = arm(g);
      box(a, 0.045, 0.06, 0.85, DARKWOOD, 0, -0.24, 0.3);
      box(a, 0.03, 0.03, 0.4, 0x2c2c30, 0, -0.21, 0.62);
      break;
    }
    case 'bombard': {
      box(g, 0.5, 0.14, 0.9, WOOD, 0, 0.3, -0.1);
      for (const x of [-0.34, 0.34]) {
        const w = cyl(g, 0.3, 0.3, 0.09, DARKWOOD, x, 0.3, 0, 12);
        w.rotation.z = Math.PI / 2;
      }
      const a = new THREE.Group();
      a.position.set(0, 0.48, -0.1);
      const barrel = cyl(a, 0.13, 0.18, 1.2, 0x2c2c30, 0, 0.12, 0.35, 10);
      barrel.rotation.x = Math.PI / 2 - 0.25;
      g.add(a);
      box(g, 0.56, 0.08, 0.2, color, 0, 0.42, -0.4);
      box(g, 0.1, 0.1, 0.5, DARKWOOD, 0, 0.18, -0.75);
      break;
    }
    case 'rider':
    case 'knight': {
      const k = type === 'knight';
      horse(g, HORSE[seed % HORSE.length], k ? color : 0);
      const r = new THREE.Group();
      r.position.y = 0.42;
      r.scale.setScalar(0.92);
      humanoid(r, k ? IRON : color, k ? 0x54585e : 0x5b4630, k ? 0x777c84 : hair);
      const a = arm(r);
      if (k) {
        const l = cyl(a, 0.025, 0.025, 1.5, DARKWOOD, 0, -0.2, 0.5, 5);
        l.rotation.x = Math.PI / 2;
        box(r, 0.05, 0.2, 0.05, color, 0, 0.98, 0);
      } else {
        const s = cyl(a, 0.02, 0.02, 0.9, WOOD, 0, -0.22, 0.3, 5);
        s.rotation.x = Math.PI / 2;
      }
      g.add(r);
      g.userData.arm = a;
      break;
    }
    case 'mammoth': {
      const fur = 0x6a4a30;
      box(g, 0.85, 0.8, 1.25, fur, 0, 0.95, -0.05);
      box(g, 0.6, 0.6, 0.5, fur, 0, 1.05, 0.72);
      [[-0.28, 0.4], [0.28, 0.4], [-0.28, -0.45], [0.28, -0.45]].forEach(([x, z], i) => leg(g, 0.3, 0.6, 0x5a3e28, x, z, i % 3 ? Math.PI : 0));
      const trunk = cyl(g, 0.1, 0.06, 0.7, fur, 0, 0.62, 1.0);
      trunk.rotation.x = 0.25;
      for (const x of [-0.24, 0.24]) {
        const t = cyl(g, 0.015, 0.06, 0.7, 0xf2ead8, x, 0.72, 1.12, 6);
        t.rotation.x = -1.15;
      }
      box(g, 0.9, 0.08, 0.7, color, 0, 1.38, -0.1);
      const r = new THREE.Group();
      r.position.set(0, 1.36, -0.1);
      r.scale.setScalar(0.8);
      humanoid(r, color, 0x5b4630, hair);
      g.add(r);
      break;
    }
    case 'priest': {
      cyl(g, 0.1, 0.24, 0.62, 0x2a2a30, 0, 0.31, 0, 10);
      cyl(g, 0.2, 0.25, 0.1, color, 0, 0.06, 0, 10);
      box(g, 0.08, 0.5, 0.02, 0xf0e8d0, 0, 0.36, 0.13);
      ball(g, 0.12, SKIN, 0, 0.74, 0);
      const a = arm(g);
      cyl(a, 0.018, 0.018, 0.9, DARKWOOD, 0, 0, 0.12, 5);
      box(a, 0.03, 0.2, 0.03, 0xe8c860, 0, 0.5, 0.12);
      g.userData.glow = box(a, 0.14, 0.03, 0.03, 0xe8c860, 0, 0.52, 0.12, 0x886620);
      break;
    }
    case 'slaver': {
      humanoid(g, 0x3a2a2a, 0x2a2020, hair);
      box(g, 0.31, 0.08, 0.19, color, 0, 0.56, 0);
      box(g, 0.26, 0.1, 0.24, 0x1e1a18, 0, 0.84, 0);
      const a = arm(g);
      cyl(a, 0.015, 0.015, 0.5, 0x4a3a2a, 0, -0.3, 0.2, 5).rotation.x = 0.9;
      const ring = add(g, geo('shackle', () => new THREE.TorusGeometry(0.07, 0.018, 4, 8)), IRON, -0.14, 0.42, 0.1);
      ring.rotation.y = Math.PI / 2;
      break;
    }
    case 'shaman': {
      cyl(g, 0.1, 0.25, 0.6, 0xe8e2d0, 0, 0.3, 0, 10);
      cyl(g, 0.2, 0.26, 0.14, color, 0, 0.08, 0, 10);
      ball(g, 0.12, SKIN, 0, 0.72, 0);
      cyl(g, 0.02, 0.15, 0.24, 0x7a3a8a, 0, 0.9, 0, 8);
      const a = arm(g);
      cyl(a, 0.02, 0.02, 0.95, DARKWOOD, 0, 0.02, 0.12, 5);
      g.userData.glow = ball(a, 0.07, 0x7dffb0, 0, 0.52, 0.12, 0x2faa66);
      break;
    }
    case 'prophet': {
      cyl(g, 0.1, 0.26, 0.64, 0x3c2a5a, 0, 0.32, 0, 10);
      cyl(g, 0.21, 0.27, 0.14, color, 0, 0.08, 0, 10);
      ball(g, 0.12, SKIN, 0, 0.76, 0);
      cyl(g, 0.16, 0.14, 0.12, 0x3c2a5a, 0, 0.84, -0.02, 8);
      box(g, 0.12, 0.2, 0.06, 0xe8e2d0, 0, 0.62, 0.11);
      const a = arm(g);
      cyl(a, 0.02, 0.02, 1.1, DARKWOOD, 0, 0.06, 0.12, 5);
      ball(a, 0.09, 0xc9a4ff, 0, 0.66, 0.12, 0x6a3ad0);
      break;
    }
    case 'warlord': {
      const body = new THREE.Group();
      body.scale.setScalar(1.25);
      humanoid(body, 0x54585e, 0x3a3a40, hair);
      box(body, 0.34, 0.5, 0.04, color, 0, 0.42, -0.12);
      box(body, 0.31, 0.1, 0.19, color, 0, 0.5, 0);
      cyl(body, 0.12, 0.11, 0.07, 0xf2c230, 0, 0.87, 0, 8);
      const a = arm(body);
      box(a, 0.05, 0.08, 0.66, 0xe4e8ee, 0, -0.26, 0.36);
      g.add(body);
      g.userData.arm = a;
      const ring = add(g, geo('aura', () => new THREE.RingGeometry(0.5, 0.58, 24)), 0xf2c230, 0, 0.03, 0, 0x8a6a10);
      ring.rotation.x = -Math.PI / 2;
      ring.castShadow = false;
      break;
    }
    case 'zealot': {
      cyl(g, 0.1, 0.22, 0.5, 0xf0e8d0, 0, 0.3, 0, 10);
      box(g, 0.1, 0.3, 0.12, 0xf0e8d0, -0.07, 0.15, 0);
      box(g, 0.1, 0.3, 0.12, 0xf0e8d0, 0.07, 0.15, 0);
      box(g, 0.31, 0.1, 0.19, color, 0, 0.5, 0);
      box(g, 0.08, 0.26, 0.1, SKIN, -0.19, 0.46, 0);
      ball(g, 0.12, SKIN, 0, 0.74, 0);
      cyl(g, 0.16, 0.16, 0.02, 0xf2c230, 0, 0.9, -0.04, 12).rotation.x = Math.PI / 2;
      const a = arm(g);
      cyl(a, 0.02, 0.02, 0.6, WOOD, 0, -0.22, 0.2, 5).rotation.x = Math.PI / 2;
      ball(a, 0.08, 0xf2c230, 0, -0.22, 0.5, 0x8a6a10);
      break;
    }
    case 'wolfrider': {
      const fur = 0x4a4a52;
      box(g, 0.3, 0.3, 0.9, fur, 0, 0.5, 0);
      box(g, 0.26, 0.26, 0.34, fur, 0, 0.66, 0.56);
      box(g, 0.12, 0.12, 0.2, 0x2c2c32, 0, 0.6, 0.8);
      for (const x of [-0.09, 0.09]) box(g, 0.06, 0.12, 0.05, 0x2c2c32, x, 0.84, 0.5);
      [[-0.1, 0.32], [0.1, 0.32], [-0.1, -0.32], [0.1, -0.32]].forEach(([x, z], i) => leg(g, 0.08, 0.36, 0x3a3a42, x, z, i % 3 ? Math.PI : 0));
      box(g, 0.08, 0.08, 0.4, fur, 0, 0.56, -0.6).rotation.x = 0.5;
      const r = new THREE.Group();
      r.position.y = 0.36;
      r.scale.setScalar(0.9);
      humanoid(r, 0x7a5a38, 0x5a4028, hair);
      box(r, 0.31, 0.1, 0.19, color, 0, 0.5, 0);
      const a = arm(r);
      cyl(a, 0.02, 0.02, 0.9, WOOD, 0, -0.22, 0.3, 5).rotation.x = Math.PI / 2;
      g.add(r);
      g.userData.arm = a;
      break;
    }
    case 'shieldbearer': {
      humanoid(g, 0x8a8f96, 0x54585e, 0x777c84);
      box(g, 0.31, 0.12, 0.19, color, 0, 0.5, 0);
      box(g, 0.5, 0.72, 0.06, color, -0.05, 0.42, 0.2);
      box(g, 0.44, 0.1, 0.07, IRON, -0.05, 0.42, 0.21);
      const a = arm(g);
      box(a, 0.04, 0.05, 0.4, 0xd0d4da, 0, -0.26, 0.22);
      break;
    }
    case 'horsearcher': {
      horse(g, HORSE[(seed + 1) % HORSE.length]);
      const r = new THREE.Group();
      r.position.y = 0.42;
      r.scale.setScalar(0.92);
      humanoid(r, color, 0x5b4630, hair);
      cyl(r, 0.14, 0.1, 0.1, 0x7a5a30, 0, 0.9, 0, 8);
      const a = arm(r);
      const bow = add(a, geo('bow', () => new THREE.TorusGeometry(0.24, 0.018, 4, 10, Math.PI)), WOOD, 0, -0.24, 0.22);
      bow.rotation.set(0, Math.PI / 2, -Math.PI / 2);
      box(r, 0.1, 0.3, 0.08, 0x6a4a2a, 0.06, 0.5, -0.14);
      g.add(r);
      g.userData.arm = a;
      break;
    }
    case 'templar': {
      horse(g, 0xd8d0c0, 0xe8c860);
      const r = new THREE.Group();
      r.position.y = 0.42;
      r.scale.setScalar(0.95);
      humanoid(r, 0xf0e8d0, 0x8a7a50, hair);
      box(r, 0.32, 0.22, 0.2, 0xe8c860, 0, 0.6, 0);
      box(r, 0.2, 0.16, 0.2, IRON, 0, 0.9, 0);
      ball(r, 0.05, 0xffd060, 0, 1.02, 0, 0x886620);
      box(r, 0.33, 0.06, 0.21, color, 0, 0.5, 0);
      const a = arm(r);
      box(a, 0.04, 0.04, 0.6, IRON, 0, -0.24, 0.34);
      box(a, 0.16, 0.04, 0.04, 0xe8c860, 0, -0.24, 0.08);
      g.add(r);
      g.userData.arm = a;
      break;
    }
    case 'warbear': {
      const fur = 0x5a4030;
      box(g, 0.46, 0.44, 0.9, fur, 0, 0.5, 0);
      box(g, 0.4, 0.2, 0.4, 0x6a4c38, 0, 0.76, -0.1);
      box(g, 0.3, 0.3, 0.3, fur, 0, 0.6, 0.58);
      box(g, 0.16, 0.14, 0.16, 0x3a2a20, 0, 0.54, 0.78);
      for (const x of [-0.11, 0.11]) box(g, 0.08, 0.08, 0.05, 0x3a2a20, x, 0.78, 0.5);
      [[-0.16, 0.3], [0.16, 0.3], [-0.16, -0.3], [0.16, -0.3]].forEach(([x, z], i) => leg(g, 0.13, 0.32, 0x4a3426, x, z, i % 3 ? Math.PI : 0));
      box(g, 0.48, 0.06, 0.3, color, 0, 0.74, -0.1);
      break;
    }
    case 'herbwife': {
      woman(g, 0x5a8a4a, hair, 2, color);
      const a = arm(g, -0.02, 0x5a8a4a, 0.82);
      a.position.x = 0.15;
      box(a, 0.2, 0.14, 0.16, 0x9a7a4a, 0, -0.26, 0.14);
      g.userData.glow = ball(a, 0.06, 0x9dff90, 0, -0.16, 0.14, 0x2f8a3a);
      break;
    }
    case 'trebuchet': {
      box(g, 0.9, 0.1, 1.3, DARKWOOD, 0, 0.16, 0);
      for (const [x, z] of [[-0.45, 0.5], [0.45, 0.5], [-0.45, -0.5], [0.45, -0.5]]) { const w = cyl(g, 0.16, 0.16, 0.08, DARKWOOD, x, 0.16, z, 10); w.rotation.z = Math.PI / 2; }
      for (const x of [-0.32, 0.32]) { box(g, 0.07, 1.1, 0.07, WOOD, x, 0.7, 0.2).rotation.x = 0.3; box(g, 0.07, 1.1, 0.07, WOOD, x, 0.7, -0.2).rotation.x = -0.3; }
      box(g, 0.74, 0.07, 0.07, WOOD, 0, 1.2, 0);
      const a = new THREE.Group();
      a.position.set(0, 1.2, 0);
      box(a, 0.07, 0.07, 1.7, WOOD, 0, 0, -0.45);
      box(a, 0.3, 0.3, 0.3, 0x6a6a6a, 0, -0.2, 0.36);
      box(a, 0.04, 0.3, 0.04, 0x8a7a5a, 0, -0.15, -1.28);
      a.rotation.x = -0.5;
      g.add(a);
      g.userData.arm = a;
      box(g, 0.92, 0.06, 0.2, color, 0, 0.24, -0.5);
      break;
    }
    case 'organgun': {
      box(g, 0.6, 0.1, 0.8, DARKWOOD, 0, 0.3, -0.05);
      for (const x of [-0.36, 0.36]) { const w = cyl(g, 0.26, 0.26, 0.07, DARKWOOD, x, 0.26, 0, 12); w.rotation.z = Math.PI / 2; }
      for (let i = 0; i < 5; i++) { const b = cyl(g, 0.035, 0.035, 0.7, IRON, -0.2 + i * 0.1, 0.42, 0.2, 6); b.rotation.x = Math.PI / 2 - 0.08; }
      box(g, 0.56, 0.08, 0.1, 0x3a3a3a, 0, 0.4, -0.1);
      box(g, 0.62, 0.06, 0.2, color, 0, 0.36, -0.35);
      break;
    }
    case 'lancer': {
      horse(g, HORSE[(seed + 2) % HORSE.length]);
      const r = new THREE.Group();
      r.position.y = 0.42;
      r.scale.setScalar(0.92);
      humanoid(r, color, 0x5b4630, hair);
      cyl(r, 0.13, 0.03, 0.2, 0x8a6a3a, 0, 0.92, 0, 8);
      const a = arm(r);
      const l = cyl(a, 0.022, 0.022, 1.9, WOOD, 0, -0.2, 0.7, 5);
      l.rotation.x = Math.PI / 2;
      box(a, 0.02, 0.18, 0.3, color, 0, -0.1, 1.3);
      g.add(r);
      g.userData.arm = a;
      break;
    }
    case 'hearthguard': {
      humanoid(g, 0xa87a4e, 0x6b5236, hair);
      box(g, 0.32, 0.16, 0.2, color, 0, 0.44, 0);
      const a = arm(g);
      cyl(a, 0.02, 0.02, 0.9, WOOD, 0, -0.1, 0.2, 5).rotation.x = Math.PI / 2 - 0.9;
      ball(a, 0.07, 0xffb040, 0, 0.26, 0.5, 0xcc5500).castShadow = false;
      const sh = cyl(g, 0.18, 0.18, 0.04, 0x8a6a3a, -0.22, 0.46, 0.1, 10);
      sh.rotation.z = Math.PI / 2;
      break;
    }
    case 'firethrower': {
      humanoid(g, 0x4a4642, 0x2c2c30, 0x2c2c30);
      box(g, 0.31, 0.1, 0.19, color, 0, 0.5, 0);
      cyl(g, 0.11, 0.11, 0.34, 0x8a5a2a, 0, 0.5, -0.17, 8);
      const a = arm(g);
      cyl(a, 0.035, 0.035, 0.6, 0x2c2c30, 0, -0.24, 0.26, 6).rotation.x = Math.PI / 2;
      ball(a, 0.06, 0xff8a20, 0, -0.24, 0.6, 0xcc4400).castShadow = false;
      break;
    }
    case 'javelineer': {
      humanoid(g, 0xb08c58, 0x6b5236, hair);
      box(g, 0.31, 0.08, 0.19, color, 0, 0.56, 0);
      const a = arm(g);
      const j = cyl(a, 0.015, 0.015, 0.9, WOOD, 0, -0.1, 0.1, 5);
      j.rotation.x = Math.PI / 2 - 0.5;
      for (const x of [-0.04, 0.04]) cyl(g, 0.012, 0.012, 0.7, WOOD, x, 0.55, -0.16, 4);
      break;
    }
    case 'hound': {
      const fur = 0x8a6238;
      box(g, 0.18, 0.2, 0.5, fur, 0, 0.32, 0);
      box(g, 0.15, 0.16, 0.2, fur, 0, 0.42, 0.32);
      box(g, 0.08, 0.08, 0.14, 0x4a3420, 0, 0.38, 0.46);
      for (const x of [-0.05, 0.05]) box(g, 0.04, 0.09, 0.03, 0x4a3420, x, 0.54, 0.28);
      [[-0.06, 0.18], [0.06, 0.18], [-0.06, -0.18], [0.06, -0.18]].forEach(([x, z], i) => leg(g, 0.05, 0.24, 0x6e4c2a, x, z, i % 3 ? Math.PI : 0));
      box(g, 0.2, 0.05, 0.12, color, 0, 0.42, 0.05);
      box(g, 0.04, 0.04, 0.22, fur, 0, 0.42, -0.34).rotation.x = -0.6;
      break;
    }
    case 'chariot': {
      const h = new THREE.Group();
      h.position.z = 0.55;
      horse(h, HORSE[seed % HORSE.length]);
      g.add(h);
      box(g, 0.6, 0.08, 0.5, WOOD, 0, 0.36, -0.42);
      box(g, 0.6, 0.3, 0.05, color, 0, 0.55, -0.18);
      for (const x of [-0.3, 0.3]) box(g, 0.05, 0.3, 0.5, DARKWOOD, x, 0.55, -0.42);
      for (const x of [-0.36, 0.36]) { const w = cyl(g, 0.26, 0.26, 0.05, DARKWOOD, x, 0.26, -0.42, 12); w.rotation.z = Math.PI / 2; }
      box(g, 0.04, 0.04, 0.6, WOOD, 0, 0.42, 0.05);
      const r = new THREE.Group();
      r.position.set(0, 0.4, -0.42);
      r.scale.setScalar(0.9);
      humanoid(r, color, 0x5b4630, hair);
      const a = arm(r);
      const bow = add(a, geo('bow', () => new THREE.TorusGeometry(0.24, 0.018, 4, 10, Math.PI)), WOOD, 0, -0.24, 0.22);
      bow.rotation.set(0, Math.PI / 2, -Math.PI / 2);
      g.add(r);
      g.userData.arm = a;
      break;
    }
    case 'berserker': {
      humanoid(g, SKIN, 0x5a4028, 0xb8562a);
      box(g, 0.32, 0.1, 0.2, color, 0, 0.34, 0);
      box(g, 0.34, 0.07, 0.2, 0x5a4028, 0, 0.6, 0);
      const a = arm(g);
      cyl(a, 0.02, 0.02, 0.6, WOOD, 0, -0.22, 0.22, 5).rotation.x = Math.PI / 2;
      box(a, 0.03, 0.22, 0.18, IRON, 0, -0.22, 0.48);
      break;
    }
    case 'pikeman': {
      humanoid(g, IRON, 0x54585e, 0x777c84);
      box(g, 0.31, 0.14, 0.19, color, 0, 0.5, 0);
      cyl(g, 0.15, 0.13, 0.08, IRON, 0, 0.86, 0, 8);
      const a = arm(g);
      const s = cyl(a, 0.02, 0.02, 2.0, WOOD, 0, -0.2, 0.55, 5);
      s.rotation.x = Math.PI / 2 - 0.12;
      const tip = cyl(a, 0, 0.045, 0.2, IRON, 0, -0.07, 1.6, 5);
      tip.rotation.x = Math.PI / 2 - 0.12;
      break;
    }
    case 'grenadier': {
      humanoid(g, color, 0xe8e2d0, hair);
      box(g, 0.08, 0.34, 0.2, 0xe8e2d0, 0, 0.46, 0);
      cyl(g, 0.11, 0.13, 0.22, 0x2c2c30, 0, 0.95, 0, 8);
      const a = arm(g);
      ball(a, 0.07, 0x2c2c30, 0, -0.28, 0.06);
      box(g, 0.14, 0.16, 0.1, 0x6a4a2a, 0.12, 0.42, -0.14);
      break;
    }
    case 'fishboat':
    case 'galley':
    case 'frigate': {
      const big = type === 'frigate', war = type !== 'fishboat';
      const L = big ? 1.5 : war ? 1.25 : 0.85, W = big ? 0.5 : war ? 0.4 : 0.34;
      // Hull: a long box with a pointed bow and a raised stern.
      box(g, W, 0.16, L * 0.7, WOOD, 0, 0.1, -L * 0.06);
      const bow = add(g, geo(`bow${W}`, () => { const c = new THREE.ConeGeometry(W * 0.71, L * 0.34, 4).toNonIndexed(); c.computeVertexNormals(); return c; }), WOOD, 0, 0.1, L * 0.45);
      bow.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      bow.scale.y = 1; bow.scale.z = 0.32;
      box(g, W * 0.9, 0.12, L * 0.2, DARKWOOD, 0, 0.22, -L * 0.36);
      box(g, W + 0.04, 0.05, L * 0.7, color, 0, 0.2, -L * 0.06);
      // Mast and sail.
      const masts = big ? [-0.3, 0.3] : [0];
      for (const z of masts) {
        cyl(g, 0.03, 0.04, war ? 1.0 : 0.7, DARKWOOD, 0, (war ? 0.5 : 0.35) + 0.15, z, 6);
        box(g, war ? 0.62 : 0.4, war ? 0.5 : 0.34, 0.03, war ? 0xe8e0cc : 0xd8c8a0, 0, war ? 0.8 : 0.6, z + 0.04);
        if (war) box(g, 0.62, 0.1, 0.035, color, 0, 0.8, z + 0.045);
      }
      if (!war) { box(g, 0.2, 0.08, 0.2, 0x8a9aa8, 0.02, 0.2, -0.2); box(g, 0.03, 0.03, 0.5, DARKWOOD, 0.2, 0.25, 0.1).rotation.x = -0.5; }
      if (war && !big) for (const z of [-0.3, 0, 0.3]) for (const x of [-1, 1]) box(g, 0.34, 0.02, 0.04, DARKWOOD, x * (W / 2 + 0.14), 0.12, z).rotation.z = x * 0.35;
      if (big) for (const z of [-0.35, 0, 0.35]) for (const x of [-1, 1]) cyl(g, 0.04, 0.04, 0.16, IRON, x * (W / 2 + 0.02), 0.2, z, 6).rotation.z = Math.PI / 2;
      break;
    }
    case 'ram': {
      box(g, 0.7, 0.1, 1.3, DARKWOOD, 0, 0.3, 0);
      for (const [x, z] of [[-0.4, 0.45], [0.4, 0.45], [-0.4, -0.45], [0.4, -0.45]]) { const w = cyl(g, 0.2, 0.2, 0.08, DARKWOOD, x, 0.2, z, 10); w.rotation.z = Math.PI / 2; }
      const cover = add(g, geo('ramroof', () => { const c = new THREE.CylinderGeometry(0.5, 0.5, 1.3, 3).toNonIndexed(); c.computeVertexNormals(); return c; }), 0x7a5a38, 0, 0.72, 0);
      cover.rotation.set(Math.PI / 2, 0, 0);
      box(g, 0.74, 0.06, 0.3, color, 0, 0.5, 0);
      const a = new THREE.Group();
      a.position.set(0, 0.5, 0);
      const log = cyl(a, 0.1, 0.1, 1.5, WOOD, 0, 0, 0.25, 8);
      log.rotation.x = Math.PI / 2;
      cyl(a, 0.13, 0.13, 0.2, IRON, 0, 0, 1.02, 8).rotation.x = Math.PI / 2;
      g.add(a);
      g.userData.ram = a;
      break;
    }
    case 'scorpion': {
      box(g, 0.4, 0.1, 0.8, WOOD, 0, 0.3, -0.05);
      for (const x of [-0.28, 0.28]) { const w = cyl(g, 0.22, 0.22, 0.07, DARKWOOD, x, 0.22, -0.1, 10); w.rotation.z = Math.PI / 2; }
      box(g, 0.08, 0.3, 0.08, DARKWOOD, 0, 0.5, 0.1);
      box(g, 0.1, 0.08, 1.0, DARKWOOD, 0, 0.68, 0.15);
      box(g, 1.0, 0.05, 0.06, WOOD, 0, 0.7, 0.5);
      cyl(g, 0.015, 0.015, 0.9, IRON, 0, 0.74, 0.3, 4).rotation.x = Math.PI / 2;
      box(g, 0.3, 0.2, 0.04, color, 0, 0.5, -0.4);
      break;
    }
    case 'hussar': {
      horse(g, HORSE[(seed + 1) % HORSE.length]);
      box(g, 0.34, 0.06, 0.4, color, 0, 0.72, -0.05);
      const r = new THREE.Group();
      r.position.y = 0.42;
      r.scale.setScalar(0.92);
      humanoid(r, color, 0xe8e2d0, hair);
      cyl(r, 0.1, 0.12, 0.2, 0x7a2a2a, 0, 0.94, 0, 8);
      box(r, 0.3, 0.3, 0.04, 0x7a2a2a, 0.06, 0.5, -0.13).rotation.z = 0.3;
      const a = arm(r);
      const sabre = box(a, 0.03, 0.05, 0.6, 0xe4e8ee, 0, -0.24, 0.3);
      sabre.rotation.x = -0.2;
      g.add(r);
      g.userData.arm = a;
      break;
    }
    case 'strategist': {
      cyl(g, 0.11, 0.27, 0.66, 0xe8e2d0, 0, 0.33, 0, 10);
      cyl(g, 0.22, 0.28, 0.16, color, 0, 0.09, 0, 10);
      box(g, 0.1, 0.5, 0.3, color, 0, 0.42, 0);
      ball(g, 0.12, SKIN, 0, 0.78, 0);
      box(g, 0.14, 0.12, 0.04, 0xd8d8d8, 0, 0.7, 0.1);
      cyl(g, 0.13, 0.12, 0.06, 0xf2c230, 0, 0.9, 0, 8);
      const a = arm(g);
      cyl(a, 0.05, 0.05, 0.34, 0xf0e8d0, 0, -0.24, 0.12, 8).rotation.x = Math.PI / 2;
      const ring = add(g, geo('aura2', () => new THREE.RingGeometry(0.5, 0.56, 24)), 0x8ad0ff, 0, 0.03, 0, 0x2a6a9a);
      ring.rotation.x = -Math.PI / 2;
      ring.castShadow = false;
      break;
    }
    case 'catapult': {
      box(g, 0.6, 0.14, 1.0, WOOD, 0, 0.3, 0);
      for (const [x, z] of [[-0.36, 0.34], [0.36, 0.34], [-0.36, -0.34], [0.36, -0.34]]) {
        const w = cyl(g, 0.2, 0.2, 0.08, DARKWOOD, x, 0.2, z, 10);
        w.rotation.z = Math.PI / 2;
      }
      box(g, 0.08, 0.5, 0.08, DARKWOOD, -0.22, 0.6, 0.15);
      box(g, 0.08, 0.5, 0.08, DARKWOOD, 0.22, 0.6, 0.15);
      box(g, 0.52, 0.08, 0.08, DARKWOOD, 0, 0.84, 0.15);
      const a = new THREE.Group();
      a.position.set(0, 0.5, 0.15);
      const beam = box(a, 0.07, 0.07, 0.95, WOOD, 0, 0.2, -0.38);
      beam.rotation.x = 0.5;
      ball(a, 0.11, 0x777777, 0, 0.42, -0.8);
      g.add(a);
      g.userData.arm = a;
      box(g, 0.03, 0.5, 0.03, DARKWOOD, 0.26, 0.6, -0.45);
      box(g, 0.02, 0.16, 0.24, color, 0.26, 0.78, -0.33);
      break;
    }
  }
  return g;
}

const STONE = 0x9d9a92;

function flag(g: THREE.Object3D, color: number, x: number, y: number, z: number, h = 0.9): void {
  banner(g, color, x, y, z, Math.max(0.2, h - 0.5));
}

/**
 * @param leaning How the owner's town leans: a pious town keeps its church bright and its tavern plain;
 *   a decadent one lets the church fall to ruin and dresses the tavern in lanterns and banners.
 */
export function makeBuilding(type: string, color: number, age: number, civ = '', leaning: '' | 'holy' | 'low' = ''): THREE.Group {
  const size = BUILDINGS[type].size;
  const gen = generatedModel(type, age, size * 0.94, 'footprint');
  if (gen) {
    flag(gen, color, size / 2 - 0.15, 0, size / 2 - 0.15, 1.6);
    if (type === 'house') {
      gen.userData.resM = ball(gen, 0.14, 0x4aa3ff, -0.3, 1.9, 0, 0x2a6ac0);
      gen.userData.resF = ball(gen, 0.14, 0xff7ab8, 0.3, 1.9, 0, 0xc04a80);
    }
    return gen;
  }
  const g = new THREE.Group();
  style = STYLES[civ] ?? PLAIN;
  const wall = style.walls[age] ?? style.walls[style.walls.length - 1], rf = styleRoof = style.roofs[age] ?? style.roofs[style.roofs.length - 1];
  const post = style.post ?? (age >= 2 ? STONE : DARKWOOD);
  // What this building's colours are made of. Set before anything is drawn, the owner's colour last so it stays plain.
  made.clear();
  made.set(WOOD, 'planks'); made.set(DARKWOOD, 'planks'); made.set(STONE, 'stone'); made.set(0x8a8a84, 'stone');
  made.set(post, age >= 2 || style.post ? 'stone' : 'planks');
  made.set(wall, age === 0 ? 'planks' : age === 2 ? 'stone' : 'plaster');
  made.set(rf, style.roof === 'steep' || (style.roof === 'pitched' && age <= 1) || style.roof === 'yurt' ? 'thatch' : 'tiles');
  made.delete(color);
  const shaped = shapedBuilding(type, size, { wall, roofColor: rf, team: color, post, age, roofKind: style.roof, leaning, otherRoof: (p, half, h, x, y, z) => roof(p, half, h, rf, x, y, z) }, Math.round(Math.random() * 8));
  if (shaped) return shaped;
  switch (type) {
    case 'towncenter': {
      box(g, 3.5, 1.2, 3.5, wall, 0, 0.6, 0);
      roof(g, 2.0, 1.0, rf, 0, 1.2, 0);
      box(g, 1.3, 3.0, 1.3, wall, 0, 1.5, 0);
      box(g, 0.5, 0.4, 0.06, DARKWOOD, 0, 2.5, 0.66);
      roof(g, 0.95, 0.8, color, 0, 3.0, 0);
      for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) box(g, 0.4, 1.6, 0.4, post, x, 0.8, z);
      box(g, 0.8, 0.9, 0.1, DARKWOOD, 0, 0.45, 1.76);
      box(g, 0.9, 0.5, 0.06, color, -1.0, 0.75, 1.77);
      box(g, 0.9, 0.5, 0.06, color, 1.0, 0.75, 1.77);
      flag(g, color, 0, 3.7, 0, 1.0);
      break;
    }
    case 'house': {
      box(g, 1.5, 0.75, 1.5, wall, 0, 0.375, 0);
      roof(g, 0.92, 0.7, rf, 0, 0.75, 0);
      box(g, 0.32, 0.5, 0.06, DARKWOOD, 0, 0.25, 0.76);
      box(g, 0.2, 0.45, 0.2, STONE, 0.4, 1.15, -0.3);
      box(g, 1.54, 0.1, 1.54, color, 0, 0.7, 0);
      // Lit windows show which residents have moved in: blue for the man, pink for the woman.
      const m = box(g, 0.24, 0.22, 0.06, 0x4aa3ff, -0.45, 0.42, 0.76, 0x2a6ac0);
      const f = box(g, 0.24, 0.22, 0.06, 0xff7ab8, 0.45, 0.42, 0.76, 0xc04a80);
      m.castShadow = f.castShadow = false;
      g.userData.resM = m;
      g.userData.resF = f;
      break;
    }
    case 'storehouse': {
      box(g, 1.6, 0.8, 1.6, wall, 0, 0.4, 0);
      box(g, 1.8, 0.12, 1.8, rf, 0, 0.86, 0);
      box(g, 1.62, 0.1, 1.62, color, 0, 0.72, 0);
      box(g, 0.5, 0.6, 0.06, DARKWOOD, 0, 0.3, 0.81);
      box(g, 0.3, 0.3, 0.3, WOOD, 0.75, 0.15, 0.85);
      box(g, 0.24, 0.24, 0.24, WOOD, 0.5, 0.12, 0.92);
      break;
    }
    case 'dock': {
      // A boathouse on a plank deck, with a jetty running out and mooring posts.
      box(g, 2.8, 0.1, 2.8, WOOD, 0, 0.08, 0);
      box(g, 1.5, 0.8, 1.3, wall, -0.5, 0.5, -0.55);
      roof(g, 0.95, 0.5, rf, -0.5, 0.9, -0.55);
      box(g, 1.52, 0.1, 1.32, color, -0.5, 0.82, -0.55);
      box(g, 0.5, 0.06, 1.3, DARKWOOD, 0.9, 0.14, 0.7);
      for (const [x, z] of [[-1.3, 1.3], [1.3, 1.3], [1.3, -1.3], [-1.3, -1.3], [0.9, 1.3]]) cyl(g, 0.07, 0.07, 0.5, DARKWOOD, x, 0.25, z, 6);
      box(g, 0.4, 0.3, 0.4, 0x8a6a3a, 0.7, 0.28, -0.8);
      cyl(g, 0.16, 0.16, 0.3, 0x6a4a2a, 0.2, 0.28, 0.6, 8);
      flag(g, color, -1.1, 0.9, -1.1);
      break;
    }
    case 'farm': {
      const soil = box(g, 2.8, 0.06, 2.8, 0x6e4e2e, 0, 0.03, 0);
      soil.castShadow = false;
      for (let i = 0; i < 6; i++) box(g, 2.5, 0.2, 0.2, i % 2 ? 0xa8b848 : 0x8aa838, 0, 0.14, -1.15 + i * 0.46).castShadow = false;
      box(g, 0.05, 0.7, 0.05, DARKWOOD, 1.2, 0.35, 1.2);
      box(g, 0.4, 0.05, 0.05, DARKWOOD, 1.2, 0.55, 1.2);
      box(g, 0.16, 0.16, 0.16, color, 1.2, 0.76, 1.2);
      break;
    }
    case 'barracks': {
      box(g, 2.7, 1.0, 2.2, wall, 0, 0.5, -0.2);
      roof(g, 1.5, 0.8, rf, 0, 1.0, -0.2);
      box(g, 0.6, 0.7, 0.06, DARKWOOD, 0, 0.35, 0.91);
      for (const x of [-0.9, 0.9]) {
        const s = cyl(g, 0.25, 0.25, 0.06, color, x, 0.6, 0.92, 10);
        s.rotation.x = Math.PI / 2;
      }
      box(g, 0.8, 0.5, 0.1, WOOD, -0.9, 0.25, 1.25);
      for (const x of [-1.15, -0.9, -0.65]) box(g, 0.04, 0.8, 0.04, IRON, x, 0.5, 1.25);
      flag(g, color, 1.2, 0, 1.2, 1.5);
      break;
    }
    case 'range': {
      box(g, 2.7, 1.0, 0.9, wall, 0, 0.5, -0.9);
      box(g, 2.9, 0.12, 1.5, rf, 0, 1.08, -0.7).rotation.x = 0.15;
      for (const x of [-1.3, 1.3]) box(g, 0.12, 1.0, 0.12, DARKWOOD, x, 0.5, -0.1);
      for (const x of [-0.8, 0, 0.8]) {
        const t = cyl(g, 0.3, 0.3, 0.1, 0xf0ead8, x, 0.5, 1.15, 12);
        t.rotation.x = Math.PI / 2;
        const c = cyl(g, 0.12, 0.12, 0.12, 0xc0392b, x, 0.5, 1.16, 10);
        c.rotation.x = Math.PI / 2;
        box(g, 0.06, 0.4, 0.06, DARKWOOD, x, 0.2, 1.15);
      }
      flag(g, color, -1.25, 1.0, -1.1, 0.9);
      break;
    }
    case 'stable': {
      box(g, 2.7, 0.9, 1.5, wall, 0, 0.45, -0.6);
      roof(g, 1.5, 0.6, rf, 0, 0.9, -0.6).scale.z = 0.6;
      for (const x of [-0.8, 0, 0.8]) box(g, 0.5, 0.6, 0.06, DARKWOOD, x, 0.3, 0.16);
      for (let i = 0; i < 6; i++) {
        box(g, 0.08, 0.5, 0.08, WOOD, -1.3 + i * 0.52, 0.25, 1.3);
      }
      box(g, 2.7, 0.06, 0.06, WOOD, 0, 0.42, 1.3);
      box(g, 2.7, 0.06, 0.06, WOOD, 0, 0.22, 1.3);
      for (const x of [-1.3, 1.3]) { box(g, 0.06, 0.06, 1.1, WOOD, x, 0.42, 0.75); box(g, 0.06, 0.06, 1.1, WOOD, x, 0.22, 0.75); }
      box(g, 0.5, 0.3, 0.4, 0xd8c060, 0.8, 0.15, 0.8);
      flag(g, color, 1.25, 0.9, -1.2, 0.9);
      break;
    }
    case 'temple': {
      // A church: a long nave with a pitched roof, a square tower with a spire and a cross.
      if (leaning === 'low') {
        // Neglected: the roof fallen in, the tower broken off, ivy on stained walls, the cross askew.
        const old = 0x8a8474, ivy = 0x4a6a34;
        box(g, 2.8, 0.14, 2.8, 0x77725f, 0, 0.07, 0).castShadow = false;
        box(g, 1.5, 1.2, 0.14, old, 0.35, 0.74, -1.18);
        box(g, 0.14, 1.2, 2.3, old, -0.33, 0.74, -0.1);
        box(g, 0.14, 0.8, 1.3, old, 1.03, 0.54, -0.6);
        box(g, 0.14, 0.45, 0.8, old, 1.03, 0.36, 0.5);
        box(g, 0.6, 0.9, 0.14, old, -0.1, 0.59, 1.0);
        const beam = box(g, 0.1, 0.1, 1.9, DARKWOOD, 0.4, 0.75, -0.2); beam.rotation.set(0.5, 0.3, 0);
        const beam2 = box(g, 0.1, 0.1, 1.5, DARKWOOD, 0.1, 0.4, 0.1); beam2.rotation.set(-0.2, -0.6, 0.3);
        for (const [x, z, s] of [[0.5, 0.2, 0.3], [0.8, -0.3, 0.22], [0.2, -0.6, 0.26], [0.9, 0.9, 0.2]]) { const r = box(g, s, s * 0.7, s, old, x, 0.2, z); r.rotation.y = x * 3; }
        box(g, 0.9, 1.5, 0.9, old, -0.8, 0.89, 0.75);
        const jag = box(g, 0.5, 0.5, 0.9, old, -0.95, 1.8, 0.75); jag.rotation.z = 0.25;
        const cross = box(g, 0.06, 0.5, 0.06, 0x7a6a3a, -0.55, 1.85, 0.75); cross.rotation.z = -0.6;
        box(g, 0.3, 0.06, 0.06, 0x7a6a3a, -0.48, 1.95, 0.75).rotation.z = -0.6;
        for (const [x, y, z, w, h] of [[-0.8, 0.7, 1.22, 0.6, 0.9], [-0.42, 0.6, 0.2, 0.05, 0.9], [0.5, 0.5, -1.27, 0.8, 0.6], [1.12, 0.4, -0.6, 0.05, 0.6]]) box(g, w, h, w === 0.05 ? 0.7 : 0.05, ivy, x, y, z).castShadow = false;
        for (const [x, z] of [[0.9, 1.2], [1.2, 0.2], [-1.2, -0.9], [0.2, 1.3]]) ball(g, 0.16, ivy, x, 0.2, z).castShadow = false;
        break;
      }
      const st = leaning === 'holy' ? 0xf2eee2 : age >= 2 ? 0xcfc8b8 : 0xb0a488;
      box(g, 2.8, 0.14, 2.8, 0x8f8a7c, 0, 0.07, 0).castShadow = false;
      box(g, 1.5, 1.2, 2.3, st, 0.35, 0.74, -0.1);
      const nave = add(g, geo('naveroof', () => { const c = new THREE.CylinderGeometry(1, 1, 2.4, 3).toNonIndexed(); c.computeVertexNormals(); return c; }), rf, 0.35, 1.7, -0.1);
      nave.rotation.set(Math.PI / 2, 0, 0);
      nave.scale.set(0.95, 1, 0.75);
      box(g, 0.9, 2.3, 0.9, st, -0.8, 1.29, 0.75);
      roof(g, 0.5, 1.1, rf, -0.8, 2.44, 0.75);
      box(g, 0.06, 0.5, 0.06, 0xe8c860, -0.8, 3.75, 0.75);
      box(g, 0.3, 0.06, 0.06, 0xe8c860, -0.8, 3.85, 0.75);
      box(g, 0.4, 0.7, 0.06, DARKWOOD, 0.35, 0.49, 1.06);
      for (const z of [-0.8, -0.1, 0.6]) box(g, 0.05, 0.5, 0.26, 0xf0d890, 1.11, 0.9, z, 0x6a5010);
      box(g, 0.3, 0.3, 0.05, 0xf0d890, -0.8, 1.9, 1.21, 0x6a5010);
      box(g, 0.92, 0.08, 0.92, color, -0.8, 2.4, 0.75);
      if (leaning === 'holy') {
        // Cared for: a great gilded cross, windows lit from within, flowers along the wall.
        box(g, 0.09, 0.75, 0.09, 0xffd860, -0.8, 3.95, 0.75, 0x8a6a10);
        box(g, 0.46, 0.09, 0.09, 0xffd860, -0.8, 4.1, 0.75, 0x8a6a10);
        for (const z of [-0.8, -0.1, 0.6]) box(g, 0.06, 0.52, 0.28, 0xffe9a0, 1.115, 0.9, z, 0xc09020).castShadow = false;
        for (const [x, z, c] of [[1.25, -0.9, 0xe8506a], [1.25, -0.3, 0xf0d040], [1.25, 0.3, 0xffffff], [0.0, 1.25, 0xe8506a], [0.7, 1.25, 0xf0d040]]) ball(g, 0.11, c, x, 0.24, z).castShadow = false;
      }
      flag(g, color, 1.25, 0.14, 1.25, 1.0);
      break;
    }
    case 'blacksmith': {
      box(g, 2.5, 1.0, 2.0, wall, 0, 0.5, -0.3);
      roof(g, 1.4, 0.7, rf, 0, 1.0, -0.3);
      box(g, 0.5, 2.0, 0.5, 0x4a4642, 0.8, 1.0, -0.8);
      box(g, 0.5, 0.3, 0.3, 0x2c2c30, -0.6, 0.35, 1.1);
      box(g, 0.3, 0.2, 0.2, 0x2c2c30, -0.6, 0.1, 1.1);
      box(g, 0.6, 0.4, 0.5, 0x4a4642, 0.5, 0.2, 1.0);
      box(g, 0.4, 0.1, 0.3, 0xff7a20, 0.5, 0.42, 1.0, 0xcc4400).castShadow = false;
      box(g, 2.52, 0.1, 2.02, color, 0, 0.9, -0.3);
      break;
    }
    case 'workshop': {
      box(g, 2.6, 1.1, 2.0, wall, 0, 0.55, -0.3);
      box(g, 2.8, 0.14, 2.3, rf, 0, 1.2, -0.3).rotation.x = 0.12;
      const w = add(g, geo('wheel', () => new THREE.TorusGeometry(0.45, 0.07, 6, 14)), DARKWOOD, 0.7, 0.5, 0.9);
      w.rotation.y = 0.3;
      box(g, 0.06, 0.9, 0.06, DARKWOOD, 0.7, 0.5, 0.9);
      box(g, 1.6, 0.14, 0.14, WOOD, -0.5, 0.1, 1.1);
      box(g, 1.6, 0.14, 0.14, WOOD, -0.5, 0.24, 1.2);
      box(g, 2.62, 0.1, 2.02, color, 0, 0.95, -0.3);
      break;
    }
    case 'palisade': {
      for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        cyl(g, 0.24, 0.26, 1.0, age >= 1 ? DARKWOOD : WOOD, x, 0.5, z, 6);
        cyl(g, 0, 0.24, 0.3, 0x9a7448, x, 1.15, z, 6);
      }
      box(g, 1.02, 0.1, 1.02, color, 0, 0.7, 0);
      break;
    }
    case 'stonewall': {
      box(g, 1.0, 1.2, 1.0, STONE, 0, 0.6, 0);
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) box(g, 0.34, 0.26, 0.34, 0x8a877f, x, 1.33, z);
      box(g, 1.02, 0.1, 1.02, color, 0, 1.0, 0);
      break;
    }
    case 'gate': {
      for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(g, 0.2, 1.6, 0.2, age >= 1 ? STONE : DARKWOOD, x, 0.8, z);
      box(g, 1.04, 0.24, 1.04, DARKWOOD, 0, 1.6, 0);
      box(g, 1.06, 0.3, 0.5, color, 0, 1.3, 0);
      box(g, 0.5, 0.3, 1.06, color, 0, 1.3, 0);
      break;
    }
    case 'wonder': {
      const st = 0xd8cfb4;
      box(g, 3.8, 0.5, 3.8, st, 0, 0.25, 0);
      box(g, 3.0, 0.5, 3.0, st, 0, 0.75, 0);
      box(g, 2.2, 0.5, 2.2, st, 0, 1.25, 0);
      box(g, 1.4, 0.5, 1.4, st, 0, 1.75, 0);
      box(g, 0.5, 2.2, 0.5, 0xe8e2d0, 0, 3.1, 0);
      roof(g, 0.3, 0.6, 0xf2c230, 0, 4.2, 0);
      for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
        cyl(g, 0.14, 0.16, 1.2, 0xe8e2d0, x, 1.1, z);
        ball(g, 0.16, 0xffb040, x, 1.85, z, 0xcc5500).castShadow = false;
      }
      box(g, 0.9, 0.12, 0.8, st, 0, 0.06, 2.2);
      box(g, 0.8, 0.6, 0.06, color, 0, 0.9, 1.92);
      flag(g, color, 1.5, 0.5, 1.5, 1.6);
      break;
    }
    case 'workcamp': {
      // A stockade: a ring of sharpened stakes round a bare yard, a guard platform and a barred hut.
      box(g, 2.8, 0.06, 2.8, 0x6a5a44, 0, 0.03, 0).castShadow = false;
      for (let i = 0; i < 28; i++) {
        const side = Math.floor(i / 7), k = (i % 7) / 6 - 0.5;
        const x = side === 0 ? k * 2.7 : side === 1 ? 1.35 : side === 2 ? -k * 2.7 : -1.35;
        const z = side === 0 ? -1.35 : side === 1 ? k * 2.7 : side === 2 ? 1.35 : -k * 2.7;
        if (side === 2 && Math.abs(k) < 0.12) continue; // the gate
        cyl(g, 0.02, 0.08, 0.9 + (i % 3) * 0.08, DARKWOOD, x, 0.45, z, 5);
      }
      box(g, 1.2, 0.6, 0.9, 0x5a4a3a, -0.5, 0.33, -0.6);
      box(g, 1.3, 0.08, 1.0, 0x3e3226, -0.5, 0.67, -0.6);
      for (const x of [-0.9, -0.7, -0.5, -0.3, -0.1]) box(g, 0.03, 0.4, 0.03, IRON, x, 0.35, -0.14);
      for (const [x, z] of [[0.6, 0.3], [1.1, 0.3], [0.6, 0.8], [1.1, 0.8]]) cyl(g, 0.04, 0.04, 1.3, WOOD, x, 0.65, z, 5);
      box(g, 0.7, 0.06, 0.7, WOOD, 0.85, 1.3, 0.55);
      box(g, 0.74, 0.3, 0.05, color, 0.85, 1.48, 0.9);
      flag(g, color, 0.85, 1.3, 0.55, 0.9);
      break;
    }
    case 'tavern': {
      // A long timbered alehouse with a jettied upper floor, a sign and barrels at the door.
      box(g, 2.4, 0.9, 1.8, wall, 0, 0.45, -0.1);
      box(g, 2.6, 0.6, 2.0, 0xd8c8a0, 0, 1.2, -0.1);
      for (const x of [-1.25, -0.6, 0, 0.6, 1.25]) box(g, 0.08, 0.6, 2.02, DARKWOOD, x, 1.2, -0.1);
      box(g, 2.62, 0.08, 2.02, color, 0, 0.92, -0.1);
      const top = add(g, geo('tavroof', () => { const c = new THREE.CylinderGeometry(1.25, 1.25, 2.7, 3).toNonIndexed(); c.computeVertexNormals(); return c; }), rf, 0, 1.82, -0.1);
      top.rotation.set(0, 0, Math.PI / 2);
      top.scale.set(0.52, 1, 0.92);
      box(g, 0.3, 0.9, 0.3, 0x8a8a84, 0.9, 2.1, -0.5);
      box(g, 0.5, 0.75, 0.06, DARKWOOD, -0.5, 0.38, 0.82);
      for (const x of [0.3, 0.9]) box(g, 0.34, 0.3, 0.05, 0xf0d890, x, 0.6, 0.82, 0x6a5010);
      box(g, 0.05, 0.05, 0.5, DARKWOOD, -1.0, 1.35, 1.1);
      box(g, 0.36, 0.3, 0.04, 0xc8a040, -1.0, 1.15, 1.3);
      for (const [x, z] of [[1.15, 1.05], [0.8, 1.15], [1.0, 1.4]]) cyl(g, 0.16, 0.16, 0.34, 0x7a5230, x, 0.17, z, 8);
      if (leaning === 'low') {
        // Dressed to draw a crowd: red lanterns along the eaves, bright pennants, a great painted mug, tables outside.
        for (const x of [-1.2, -0.6, 0, 0.6, 1.2]) { box(g, 0.02, 0.18, 0.02, DARKWOOD, x, 0.82, 0.95); ball(g, 0.1, 0xff3a30, x, 0.68, 0.95, 0xcc1a10).castShadow = false; }
        for (const [x, c] of [[-1.0, 0xe83a6a], [-0.5, 0xf0c030], [0, 0xe83a6a], [0.5, 0xf0c030], [1.0, 0xe83a6a]]) { const p = box(g, 0.2, 0.26, 0.03, c, x, 1.62, 0.93); p.rotation.z = Math.PI / 4; p.castShadow = false; }
        cyl(g, 0.26, 0.22, 0.5, 0xf0c030, -1.0, 2.0, 1.3, 10);
        box(g, 0.3, 0.1, 0.3, 0xfff4d8, -1.0, 2.3, 1.3);
        for (const x of [-0.9, 0.1]) { cyl(g, 0.3, 0.3, 0.06, WOOD, x, 0.36, 1.5, 10); cyl(g, 0.05, 0.05, 0.36, DARKWOOD, x, 0.18, 1.5, 6); ball(g, 0.07, 0xf0c030, x + 0.1, 0.44, 1.5).castShadow = false; }
        box(g, 0.7, 0.02, 0.5, 0xb02a4a, -0.5, 0.02, 1.15).castShadow = false;
      } else if (leaning === 'holy') {
        // A sober house: shutters closed, no light in the windows.
        for (const x of [0.3, 0.9]) box(g, 0.36, 0.32, 0.06, DARKWOOD, x, 0.6, 0.83);
      }
      break;
    }
    case 'market': {
      box(g, 2.8, 0.1, 2.8, 0x9a8a68, 0, 0.05, 0).castShadow = false;
      const cloth = [color, 0xe8dcc0, 0xc0392b, color];
      [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([x, z], i) => {
        box(g, 0.9, 0.5, 0.7, WOOD, x, 0.3, z);
        for (const [px, pz] of [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.35], [0.45, 0.35]]) box(g, 0.06, 1.1, 0.06, DARKWOOD, x + px, 0.55, z + pz);
        roof(g, 0.62, 0.4, cloth[i], x, 1.1, z);
        box(g, 0.3, 0.2, 0.3, [0xd8c060, 0xc0392b, 0x8aa838, 0xf2c230][i], x, 0.62, z);
      });
      cyl(g, 0.3, 0.34, 0.3, STONE, 0, 0.15, 0, 10);
      flag(g, color, 0, 0.3, 0, 1.4);
      break;
    }
    case 'tower': {
      const st = age >= 2 ? STONE : wall;
      box(g, 1.2, 2.4, 1.2, st, 0, 1.2, 0);
      box(g, 1.5, 0.25, 1.5, st, 0, 2.5, 0);
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) box(g, 0.3, 0.3, 0.3, st, x, 2.77, z);
      box(g, 0.3, 0.5, 0.06, DARKWOOD, 0, 0.25, 0.61);
      box(g, 1.22, 0.14, 1.22, color, 0, 2.2, 0);
      flag(g, color, 0, 2.6, 0, 0.9);
      break;
    }
  }
  return g;
}

export function makeResource(type: string, seed: number): THREE.Group {
  made.clear();
  const g = new THREE.Group();
  const r = (k: number) => ((seed * 9301 + k * 49297) % 233280) / 233280;
  if (type === 'carcass') {
    const body = box(g, 0.3, 0.2, 0.6, 0x9a6038, 0, 0.1, 0);
    body.rotation.y = r(1) * 6;
    box(g, 0.2, 0.06, 0.3, 0xb03a30, 0.05, 0.22, 0).rotation.y = r(1) * 6;
  } else if (type === 'fish') {
    // A shoal: a ring of ripples and a few silver backs breaking the surface.
    const ring = add(g, geo('ripple', () => new THREE.TorusGeometry(0.36, 0.025, 4, 16)), 0xbfe0ee, 0, 0.03, 0);
    ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    for (let i = 0; i < 4; i++) {
      const a = r(i) * 6.28, d = 0.08 + r(i + 5) * 0.2;
      const f = ball(g, 0.08, 0xc8d4dc, Math.cos(a) * d, 0.03, Math.sin(a) * d);
      f.scale.set(0.6, 0.5, 1.6); f.rotation.y = a; f.castShadow = false;
    }
  } else if (type === 'berries') {
    const b = ball(g, 0.36, 0x3e7a34, 0, 0.26, 0);
    b.scale.y = 0.75;
    for (let i = 0; i < 6; i++) {
      const a = r(i) * 6.28;
      ball(g, 0.06, 0xd0304a, Math.cos(a) * 0.26, 0.3 + r(i + 9) * 0.18, Math.sin(a) * 0.26).castShadow = false;
    }
  } else {
    const gold = type === 'gold';
    const rock = geo('rock', () => new THREE.IcosahedronGeometry(1, 0));
    for (let i = 0; i < 6; i++) {
      const s = 0.3 + r(i) * 0.3;
      const m = add(g, rock, gold && i % 2 === 0 ? 0xf2c230 : gold ? 0xb89a48 : i % 2 ? 0x8f8f8c : 0xa8a8a2,
        (r(i + 3) - 0.5) * 1.3, s * 0.5, (r(i + 7) - 0.5) * 1.3, gold && i % 2 === 0 ? 0x5a4208 : 0);
      m.scale.set(s, s * 0.8, s);
      m.rotation.y = r(i + 11) * 6;
    }
  }
  return g;
}
