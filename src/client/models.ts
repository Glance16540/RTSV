// Procedural low-poly models for units, buildings and resources.

import * as THREE from 'three';
import { BUILDINGS } from '../sim/data';
import { Gender } from '../sim/game';
import { generatedModel } from './assets';

const mats = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: number, emissive = 0): THREE.MeshLambertMaterial {
  const key = `${color}:${emissive}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive });
    mats.set(key, m);
  }
  return m;
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
  add(p, geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), color, x, y, z, em);
const cyl = (p: THREE.Object3D, rt: number, rb: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 8) =>
  add(p, geo(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), color, x, y, z);
const ball = (p: THREE.Object3D, r: number, color: number, x = 0, y = 0, z = 0, em = 0) =>
  add(p, geo(`s${r}`, () => new THREE.SphereGeometry(r, 10, 8)), color, x, y, z, em);
/** Four-sided pyramid roof aligned with the building walls. */
const roof = (p: THREE.Object3D, half: number, h: number, color: number, x = 0, y = 0, z = 0) => {
  const m = add(p, geo(`r${half},${h}`, () => {
    const c = new THREE.ConeGeometry(half * Math.SQRT2, h, 4).toNonIndexed();
    c.computeVertexNormals(); // flat faces so each side of the roof catches the light differently
    return c;
  }), color, x, y + h / 2, z);
  m.rotation.y = Math.PI / 4;
  return m;
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
  box(hip, w, h, w * 1.15, color, 0, -h / 2, 0);
  g.add(hip);
}

function humanoid(g: THREE.Object3D, body: number, legs: number, hair: number, y = 0): void {
  leg(g, 0.1, 0.3, legs, -0.07, 0, 0, y);
  leg(g, 0.1, 0.3, legs, 0.07, 0, Math.PI, y);
  box(g, 0.3, 0.32, 0.18, body, 0, y + 0.46, 0);
  box(g, 0.08, 0.28, 0.1, SKIN, -0.19, y + 0.46, 0);
  ball(g, 0.12, SKIN, 0, y + 0.74, 0);
  const h = ball(g, 0.125, hair, 0, y + 0.78, -0.02);
  h.scale.set(1, 0.7, 1);
}

/** Right arm + weapon, pivoting at the shoulder so it can swing. */
function arm(g: THREE.Object3D, y = 0): THREE.Group {
  const a = new THREE.Group();
  a.position.set(0.19, y + 0.58, 0);
  box(a, 0.08, 0.28, 0.1, SKIN, 0, -0.12, 0);
  g.add(a);
  g.userData.arm = a;
  return a;
}

function horse(g: THREE.Object3D, color: number, armor = 0): void {
  box(g, 0.3, 0.3, 0.8, color, 0, 0.55, 0);
  if (armor) box(g, 0.34, 0.2, 0.6, armor, 0, 0.56, -0.02);
  const neck = box(g, 0.16, 0.4, 0.2, color, 0, 0.82, 0.4);
  neck.rotation.x = 0.5;
  box(g, 0.15, 0.16, 0.32, color, 0, 0.98, 0.58);
  [[-0.1, 0.3], [0.1, 0.3], [-0.1, -0.3], [0.1, -0.3]].forEach(([x, z], i) => leg(g, 0.08, 0.42, color, x, z, i % 3 ? Math.PI : 0));
  const tail = box(g, 0.06, 0.3, 0.06, 0x2a1e16, 0, 0.52, -0.44);
  tail.rotation.x = -0.4;
}

const UNIT_HEIGHT: Record<string, number> = {
  rider: 1.45, knight: 1.5, hussar: 1.5, chariot: 1.4, mammoth: 1.9, catapult: 1.1, bombard: 0.9, ram: 1.0, scorpion: 0.9, warlord: 1.2, hound: 0.55,
};

export function makeUnit(type: string, color: number, gender: Gender | null, seed: number): THREE.Group {
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
      if (gender === 'f') {
        cyl(g, 0.09, 0.24, 0.56, color, 0, 0.28, 0, 10);
        box(g, 0.07, 0.24, 0.09, SKIN, -0.17, 0.46, 0);
        const a = arm(g, -0.04);
        a.position.x = 0.17;
        ball(g, 0.12, SKIN, 0, 0.7, 0);
        ball(g, 0.135, hair, 0, 0.73, -0.035);
        box(g, 0.2, 0.26, 0.07, hair, 0, 0.56, -0.11);
      } else {
        humanoid(g, color, 0x5b4630, hair);
        arm(g);
      }
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

const WALL = [0xb89a6a, 0xa98458, 0xb3aea2, 0xd9d2c0, 0xe8e2d4];
const ROOF = [0xc9b458, 0xb08c40, 0x7d5a40, 0xa8432f, 0x4a5874];
const STONE = 0x9d9a92;

function flag(g: THREE.Object3D, color: number, x: number, y: number, z: number, h = 0.9): void {
  box(g, 0.05, h, 0.05, DARKWOOD, x, y + h / 2, z);
  box(g, 0.03, 0.26, 0.42, color, x, y + h - 0.15, z + 0.23);
}

export function makeBuilding(type: string, color: number, age: number): THREE.Group {
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
  const wall = WALL[age], rf = ROOF[age];
  switch (type) {
    case 'towncenter': {
      box(g, 3.5, 1.2, 3.5, wall, 0, 0.6, 0);
      roof(g, 2.0, 1.0, rf, 0, 1.2, 0);
      box(g, 1.3, 3.0, 1.3, wall, 0, 1.5, 0);
      box(g, 0.5, 0.4, 0.06, DARKWOOD, 0, 2.5, 0.66);
      roof(g, 0.95, 0.8, color, 0, 3.0, 0);
      for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) box(g, 0.4, 1.6, 0.4, age >= 2 ? STONE : DARKWOOD, x, 0.8, z);
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
      const st = age >= 2 ? 0xcfc8b8 : 0xb0a488;
      box(g, 2.8, 0.4, 2.8, st, 0, 0.2, 0);
      box(g, 2.2, 0.4, 2.2, st, 0, 0.6, 0);
      box(g, 1.6, 0.5, 1.6, st, 0, 1.05, 0);
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) cyl(g, 0.1, 0.1, 0.7, 0xe8e2d0, x, 1.65, z);
      box(g, 1.6, 0.14, 1.6, rf, 0, 2.05, 0);
      ball(g, 0.2, 0xffb040, 0, 1.5, 0, 0xcc5500).castShadow = false;
      box(g, 0.5, 0.35, 0.06, color, 0, 0.62, 1.12);
      box(g, 0.6, 0.12, 0.8, st, 0, 0.06, 1.7);
      box(g, 0.6, 0.12, 0.5, st, 0, 0.18, 1.55);
      flag(g, color, -1.3, 0.4, 1.3, 1.0);
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
  const g = new THREE.Group();
  const r = (k: number) => ((seed * 9301 + k * 49297) % 233280) / 233280;
  if (type === 'carcass') {
    const body = box(g, 0.3, 0.2, 0.6, 0x9a6038, 0, 0.1, 0);
    body.rotation.y = r(1) * 6;
    box(g, 0.2, 0.06, 0.3, 0xb03a30, 0.05, 0.22, 0).rotation.y = r(1) * 6;
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
