// Trees and bushes built the way they grow: a trunk that flares at the root and forks, boughs, and leaves in
// clusters that are darker underneath and inside than on top. Each kind is one merged shape for the trunk and one
// for the leaves, so a whole forest is still a handful of draws.

import * as THREE from 'three';

/** Collects triangles with a shade per corner. */
class Shape {
  pos: number[] = [];
  col: number[] = [];
  /** Add a geometry, shading each corner by `tone(x, y, z, ny)` where `ny` is how far its face looks up. */
  add(g: THREE.BufferGeometry, tone: (x: number, y: number, z: number, ny: number) => number): this {
    const n = g.index ? g.toNonIndexed() : g;
    n.computeVertexNormals();
    const p = n.getAttribute('position'), nm = n.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = tone(x, y, z, nm.getY(i));
      this.pos.push(x, y, z);
      this.col.push(t, t, t);
    }
    return this;
  }
  tri(a: number[], b: number[], c: number[], ta: number, tb = ta, tc = ta): void {
    this.pos.push(...a, ...b, ...c);
    this.col.push(ta, ta, ta, tb, tb, tb, tc, tc, tc);
  }
  done(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

const rnd = (seed: number): (() => number) => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };

/** A limb from one point to another, thicker at the first. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, sides = 6): THREE.BufferGeometry {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** A cluster of leaves: a lumpy ball, faceted, so light breaks over it. */
function clump(x: number, y: number, z: number, r: number, squash: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.getAttribute('position'), k = rnd(seed);
  const bump: number[] = [];
  for (let i = 0; i < 40; i++) bump.push(0.78 + k() * 0.44);
  for (let i = 0; i < p.count; i++) {
    // The same corner must move the same way in every face that shares it, or the ball tears.
    const hx = Math.round(p.getX(i) * 31 / r), hy = Math.round(p.getY(i) * 17 / r), hz = Math.round(p.getZ(i) * 23 / r);
    const b = bump[Math.abs(hx * 7 + hy * 13 + hz * 5) % 40];
    p.setXYZ(i, p.getX(i) * b, p.getY(i) * b * squash, p.getZ(i) * b);
  }
  g.rotateY(seed * 1.7);
  g.translate(x, y, z);
  return g;
}

export interface Tree { trunk: THREE.BufferGeometry; leaf: THREE.BufferGeometry; snow?: THREE.BufferGeometry }

const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const bark = (lo: number) => (_x: number, y: number): number => lo + Math.min(1, y) * 0.25;
/** Leaves: light on top and outside, dark underneath and near the trunk. */
const leafTone = (cy: number, h: number) => (x: number, y: number, z: number, ny: number): number =>
  Math.max(0.42, Math.min(1.25, 0.74 + ((y - cy) / h) * 0.34 + ny * 0.14 + Math.min(0.12, Math.hypot(x, z) * 0.16)));

/** A spreading broadleaf: short bole, three boughs, a domed crown of many clusters. */
export function oak(seed: number): Tree {
  const k = rnd(seed), t = new Shape(), l = new Shape();
  const top = V((k() - 0.5) * 0.08, 0.62, (k() - 0.5) * 0.08);
  t.add(limb(V(0, -0.05, 0), V(0, 0.12, 0), 0.17, 0.1, 7), bark(0.8)); // the flare at the root
  t.add(limb(V(0, 0.1, 0), top, 0.1, 0.075, 7), bark(0.8));
  const ends: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + k(), e = V(top.x + Math.cos(a) * 0.3, 0.98 + k() * 0.14, top.z + Math.sin(a) * 0.3);
    t.add(limb(top, e, 0.06, 0.03, 5), bark(0.8));
    ends.push(e);
  }
  t.add(limb(top, V(top.x, 1.2, top.z), 0.06, 0.03, 5), bark(0.8));
  const tone = leafTone(1.15, 1.1);
  l.add(clump(top.x, 1.42, top.z, 0.36, 0.85, seed + 1), tone);
  ends.forEach((e, i) => {
    l.add(clump(e.x * 1.25, e.y + 0.08, e.z * 1.25, 0.31 + k() * 0.06, 0.8, seed + 3 + i), tone);
    // A smaller cluster between this bough and the next, lower down.
    const n = ends[(i + 1) % 3];
    l.add(clump((e.x + n.x) * 0.75, 0.98 + k() * 0.1, (e.z + n.z) * 0.75, 0.24 + k() * 0.05, 0.75, seed + 9 + i), tone);
  });
  return { trunk: t.done(), leaf: l.done() };
}

/** A slim, tall tree with a pale stem and a narrow, airy crown. */
export function birch(seed: number): Tree {
  const k = rnd(seed), t = new Shape(), l = new Shape();
  const lean = (k() - 0.5) * 0.12, top = V(lean, 1.45, (k() - 0.5) * 0.1);
  // Pale bark, banded dark.
  t.add(limb(V(0, -0.04, 0), top, 0.07, 0.025, 6), (_x, y) => (Math.sin(y * 31) > 0.72 ? 0.45 : 1));
  const tone = leafTone(1.25, 1.2);
  for (let i = 0; i < 5; i++) {
    const y = 0.85 + i * 0.2, a = i * 2.4 + k() * 2, r = 0.2 - i * 0.012 + k() * 0.04, out = i === 4 ? 0 : 0.14;
    const cx = lean * (y / 1.45) + Math.cos(a) * out, cz = Math.sin(a) * out;
    if (i < 4) t.add(limb(V(lean * (y / 1.45), y - 0.12, 0), V(cx, y, cz), 0.022, 0.012, 4), () => 0.9);
    l.add(clump(cx, y + 0.04, cz, r, 1.15, seed + i * 3), tone);
  }
  return { trunk: t.done(), leaf: l.done() };
}

/** A fir: a straight stem and tiers of boughs that droop at the tips, each tier smaller than the one below. */
export function fir(seed: number): Tree {
  const k = rnd(seed), t = new Shape(), l = new Shape(), s = new Shape();
  t.add(limb(V(0, -0.04, 0), V(0, 1.75, 0), 0.085, 0.015, 6), bark(0.75));
  const tiers = 5;
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1), y0 = 0.36 + f * 1.0, R = 0.56 - f * 0.4, h = 0.5 - f * 0.12, n = 9, turn = k() * 6.28;
    const apex = [0, y0 + h, 0], hub = [0, y0 + 0.07, 0];
    const ring: number[][] = [];
    for (let j = 0; j < n * 2; j++) {
      const a = turn + (j / (n * 2)) * 6.28, tip = j % 2 === 0, r = R * (tip ? 1 + k() * 0.12 : 0.62);
      ring.push([Math.cos(a) * r, y0 - (tip ? 0.07 + k() * 0.05 : -0.03), Math.sin(a) * r]);
    }
    for (let j = 0; j < n * 2; j++) {
      const a = ring[j], b = ring[(j + 1) % (n * 2)], ta = j % 2 === 0 ? 1.08 : 0.72, tb = j % 2 === 0 ? 0.72 : 1.08;
      l.tri(apex, b, a, 0.9, tb, ta); // upper side: tips catch the light
      l.tri(hub, a, b, 0.42, 0.5, 0.5); // underside, in shadow
      // Snow lies on the upper side, short of the tips.
      const in2 = (p: number[]): number[] => [p[0] * 0.8, p[1] + 0.035 + (apex[1] - p[1]) * 0.12, p[2] * 0.8];
      s.tri([apex[0], apex[1] + 0.02, apex[2]], in2(b), in2(a), 1, 0.92, 0.92);
    }
  }
  return { trunk: t.done(), leaf: l.done(), snow: s.done() };
}

/** A palm: a ringed stem that leans and curves, a head of arching fronds, a few dates under it. */
export function palm(seed: number): Tree {
  const k = rnd(seed), t = new Shape(), l = new Shape();
  const lean = 0.25 + k() * 0.25, dir = k() * 6.28, segs = 7, H = 1.55;
  let prev = V(0, -0.04, 0);
  for (let i = 1; i <= segs; i++) {
    const f = i / segs, p = V(Math.cos(dir) * lean * f * f, H * f, Math.sin(dir) * lean * f * f);
    t.add(limb(prev, p, 0.075 - f * 0.025 + (i === 1 ? 0.03 : 0), 0.072 - f * 0.027, 6), () => (i % 2 ? 0.95 : 0.72));
    prev = p;
  }
  const head = prev;
  for (let i = 0; i < 4; i++) t.add(new THREE.SphereGeometry(0.035, 5, 4).translate(head.x + Math.cos(i * 1.6) * 0.06, head.y - 0.05, head.z + Math.sin(i * 1.6) * 0.06), () => 0.5);
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * 6.28 + k() * 0.4, len = 0.62 + k() * 0.2, rise = 0.16 + k() * 0.14, steps = 5;
    const ax = Math.cos(a), az = Math.sin(a), sx = -az, sz = ax;
    let pc = [head.x, head.y, head.z], pw = 0.015;
    for (let j = 1; j <= steps; j++) {
      const f = j / steps, w = Math.sin(f * 3.0 + 0.25) * 0.085;
      const c = [head.x + ax * len * f, head.y + Math.sin(f * 2.5) * rise - f * f * 0.34, head.z + az * len * f];
      const a0 = [pc[0] + sx * pw, pc[1] - pw * 0.5, pc[2] + sz * pw], a1 = [pc[0] - sx * pw, pc[1] - pw * 0.5, pc[2] - sz * pw];
      const b0 = [c[0] + sx * w, c[1] - w * 0.6, c[2] + sz * w], b1 = [c[0] - sx * w, c[1] - w * 0.6, c[2] - sz * w];
      const lit = 1.1 - f * 0.25, dim = 0.6;
      // Two blades meeting at the rib, seen from above and from below.
      l.tri(pc, a0, b0, lit); l.tri(pc, b0, c, lit); l.tri(pc, b1, a1, lit - 0.12); l.tri(pc, c, b1, lit - 0.12);
      l.tri(pc, b0, a0, dim); l.tri(pc, c, b0, dim); l.tri(pc, a1, b1, dim); l.tri(pc, b1, c, dim);
      pc = c; pw = w;
    }
  }
  return { trunk: t.done(), leaf: l.done() };
}

/** An acacia: a forked, leaning stem under a wide flat crown. */
export function acacia(seed: number): Tree {
  const k = rnd(seed), t = new Shape(), l = new Shape();
  const fork = V((k() - 0.5) * 0.2, 0.55, (k() - 0.5) * 0.2);
  t.add(limb(V(0, -0.04, 0), fork, 0.09, 0.06, 6), bark(0.8));
  const tone = leafTone(1.2, 0.5);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.28 + k() * 1.2, e = V(fork.x + Math.cos(a) * 0.42, 1.08 + k() * 0.1, fork.z + Math.sin(a) * 0.42);
    t.add(limb(fork, e, 0.05, 0.022, 5), bark(0.8));
    l.add(clump(e.x, e.y + 0.07, e.z, 0.36 + k() * 0.06, 0.32, seed + i), tone);
    l.add(clump(e.x * 0.4 + Math.cos(a + 1) * 0.2, e.y + 0.1, e.z * 0.4 + Math.sin(a + 1) * 0.2, 0.28, 0.3, seed + 5 + i), tone);
  }
  return { trunk: t.done(), leaf: l.done() };
}

/** A bush: three or four clusters of leaves grown together, low to the ground. */
export function bush(seed: number): THREE.BufferGeometry {
  const k = rnd(seed), l = new Shape(), tone = leafTone(0.12, 0.3);
  l.add(clump(0, 0.13, 0, 0.17, 0.85, seed), tone);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + k(); l.add(clump(Math.cos(a) * 0.14, 0.08 + k() * 0.04, Math.sin(a) * 0.14, 0.11 + k() * 0.04, 0.8, seed + 2 + i), tone); }
  return l.done();
}
