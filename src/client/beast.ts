// Animals drawn from real four-legged figures with skeletons and recorded gaits: the horse under every rider, the
// wolf, the deer and the stag, and the hound. They are from the Ultimate Animated Animal Pack by Quaternius (CC0;
// see public/models/animals/SOURCE.txt). Each is stood on the ground facing forward and made one unit long when it
// arrives, so the game can size it by length and seat a rider on it.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type BeastKind = 'horse' | 'wolf' | 'deer' | 'stag' | 'husky' | 'camel' | 'elephant' | 'mammoth' | 'bear';
/** The figures that are fetched. The camel, the elephant, the mammoth and the bear are each made over from one of them. */
type SourceKind = 'horse' | 'wolf' | 'deer' | 'stag' | 'husky' | 'alpaca' | 'bull';
const KINDS: SourceKind[] = ['horse', 'wolf', 'deer', 'stag', 'husky', 'alpaca', 'bull'];
const FROM: Partial<Record<BeastKind, SourceKind>> = { camel: 'alpaca', elephant: 'bull', mammoth: 'bull', bear: 'wolf' };
const sourceOf = (kind: BeastKind): SourceKind => FROM[kind] ?? (kind as SourceKind);

interface Source { root: THREE.Group; clips: Map<string, THREE.AnimationClip> }
const sources = new Map<SourceKind, Source>();
let asked = false;

/** Starts fetching the animals. Each can be used as soon as it has arrived. */
export function loadBeasts(): void {
  if (asked) return;
  asked = true;
  for (const kind of KINDS) {
    new GLTFLoader().load(`${import.meta.env.BASE_URL}models/animals/${kind}.json`, (g) => {
      const scene = g.scene;
      scene.updateMatrixWorld(true);
      // Which way it faces: from the middle of the body toward the head.
      let head: THREE.Object3D | null = null, torso: THREE.Object3D | null = null;
      scene.traverse((o) => { if (o.name === 'Head') head = o; if (o.name === 'Torso') torso = o; });
      scene.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.frustumCulled = false;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mt of mats) mt.userData.outlineParameters = { visible: false };
      });
      // Measured by its bones, which are where the animal really is whatever space its skin was made in.
      const box = new THREE.Box3(), bp = new THREE.Vector3();
      scene.traverse((o) => { if ((o as THREE.Bone).isBone) box.expandByPoint(o.getWorldPosition(bp)); });
      const c = box.getCenter(new THREE.Vector3()), hp = (head as THREE.Object3D | null)?.getWorldPosition(new THREE.Vector3()) ?? c.clone().add(new THREE.Vector3(0, 0, 1));
      const yaw = Math.atan2(hp.x - c.x, hp.z - c.z); // turn by -yaw to face +z
      const ty = (torso as THREE.Object3D | null)?.getWorldPosition(new THREE.Vector3()).y ?? box.max.y * 0.6;
      // Made so that its spine stands one unit above the ground: the game sizes it by the height of its back.
      const k = 1 / Math.max(1e-6, ty - box.min.y);
      const inner = new THREE.Group();
      inner.add(scene);
      scene.position.set(-c.x, -box.min.y, -c.z);
      const root = new THREE.Group();
      root.add(inner);
      inner.rotation.y = -yaw;
      inner.scale.setScalar(k);
      const clips = new Map<string, THREE.AnimationClip>();
      for (const clip of g.animations) clips.set(clip.name, clip);
      sources.set(kind, { root, clips });
    });
  }
}
export const beastReady = (kind: BeastKind): boolean => sources.has(sourceOf(kind));

export interface Beast { g: THREE.Group; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; now: string; kind: BeastKind; strike: number; struck: boolean }

/** Coats: the body colour and its lighter and darker shades. */
const COATS: Record<string, [number, number, number, number]> = {
  bay: [0x6a3c1c, 0x8a5428, 0x4a2a14, 0x18140f],
  chestnut: [0x8a4a22, 0xa86432, 0x643418, 0x6a3a1c],
  black: [0x26221f, 0x3a3430, 0x1a1715, 0x121010],
  grey: [0x8e8c88, 0xb0aea8, 0x6a6864, 0x4a4844],
  white: [0xd8d2c6, 0xece8de, 0xb4aea2, 0xc8c2b6],
  dun: [0xa88a58, 0xc4a670, 0x7a6440, 0x2a2018],
};
const COAT_NAMES = Object.keys(COATS);
const tinted = new Map<string, THREE.Material>();
function coat(mt: THREE.Material, name: string, coatName: string): THREE.Material {
  const slot = name === 'Main' ? 0 : name === 'Main_Light' ? 1 : name === 'Main_Dark' ? 2 : name === 'Hair' ? 3 : -1;
  if (slot < 0) return mt;
  const key = name + '|' + coatName;
  let out = tinted.get(key);
  if (!out) {
    out = mt.clone();
    (out as THREE.MeshStandardMaterial).color.setHex(COATS[coatName][slot as 0 | 1 | 2 | 3]);
    out.userData.outlineParameters = { visible: false };
    tinted.set(key, out);
  }
  return out;
}

/** The colours of the animals that are made over from another. A part given -1 is not drawn. */
const PAINT: Partial<Record<BeastKind, Record<string, number>>> = {
  elephant: { Main: 0x7c7770, Main_Light: 0x8e8880, Muzzle: 0x6c6760, Hooves: 0x5a554e, Horns: -1 },
  mammoth: { Main: 0x5a3c26, Main_Light: 0x74502f, Muzzle: 0x4a3220, Hooves: 0x3a2a1c, Horns: -1 },
  bear: { Main: 0x4e3626, Main_Light: 0x6a4a32 },
  camel: { Main: 0xc09a62, Main_Light: 0xd4b47e, Main_Dark: 0x9a7a4a, Muzzle: 0x8a6a48, Hooves: 0x5a4630 },
};

const partMats = new Map<number, THREE.MeshStandardMaterial>();
function partMat(hex: number): THREE.MeshStandardMaterial {
  let m = partMats.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 });
    m.userData.outlineParameters = { visible: false };
    partMats.set(hex, m);
  }
  return m;
}
const partGeos = new Map<string, THREE.BufferGeometry>();
/** A curved, tapering limb through the given points: a trunk or a tusk. */
function taper(key: string, pts: [number, number, number][], r0: number, r1: number): THREE.BufferGeometry {
  let g = partGeos.get(key);
  if (g) return g;
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const segs = 14, around = 8;
  g = new THREE.TubeGeometry(curve, segs, r0, around, false);
  const pos = g.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const c = curve.getPointAt(i / segs), k = (r0 + (r1 - r0) * (i / segs)) / r0;
    for (let j = 0; j <= around; j++) {
      const n = i * (around + 1) + j;
      v.fromBufferAttribute(pos, n).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(n, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  partGeos.set(key, g);
  return g;
}
const ballGeo = (): THREE.BufferGeometry => { let g = partGeos.get('ball'); if (!g) partGeos.set('ball', (g = new THREE.SphereGeometry(1, 14, 10))); return g; };

/**
 * Turn the figure it was cloned from into another animal: the bull into an elephant or a mammoth (thick legs, trunk,
 * tusks, great ears), the alpaca into a camel (a hump, longer legs), the wolf into a bear (broad, heavy-limbed, no
 * tail). Parts are placed in the animal's own space, where its spine is one unit up and it faces +z, and then hung
 * from the bone they should move with.
 */
function makeOver(root: THREE.Group, kind: 'camel' | 'elephant' | 'mammoth' | 'bear'): void {
  const bones = new Map<string, THREE.Object3D>();
  root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.set(o.name.replace(/[._]/g, ''), o); });
  const sc = (name: string, x: number, y = x, z = x): void => { bones.get(name)?.scale.set(x, y, z); };
  const both = (name: string, x: number, y = x, z = x): void => { sc(name + 'L', x, y, z); sc(name + 'R', x, y, z); };
  if (kind === 'elephant' || kind === 'mammoth') {
    both('FrontUpperLeg', 1.7, 1, 1.7);
    both('BackLeg', 1.5, 1, 1.5);
    sc('Tail1', 0.45, 0.75, 0.45);
    root.scale.set(1.08, 1.12, 0.86);
  } else if (kind === 'bear') {
    both('FrontUpperLeg', 1.7, 1, 1.7);
    both('BackLeg', 1.6, 1, 1.6);
    sc('Tail1', 0.1);
    both('Ear1', 0.55);
    sc('Head', 1.3);
    sc('Neck1', 1.25, 1, 1.25);
    root.scale.set(1.45, 1.12, 0.95);
  } else {
    both('Ear1', 0.45);
    both('FrontUpperLeg', 0.85, 1, 0.85);
    both('BackLeg', 0.85, 1, 0.85);
    root.scale.set(0.9, 1, 1.12);
  }
  root.updateMatrixWorld(true);
  const head = bones.get('Head'), torso = bones.get('Torso2') ?? bones.get('Torso');
  if (!head || !torso) return;
  const h = head.getWorldPosition(new THREE.Vector3()).divide(root.scale), t = torso.getWorldPosition(new THREE.Vector3()).divide(root.scale);
  const hang = (bone: THREE.Object3D, m: THREE.Mesh): THREE.Mesh => { m.castShadow = true; m.frustumCulled = false; root.add(m); root.updateMatrixWorld(true); bone.attach(m); return m; };
  const ball = (bone: THREE.Object3D, hex: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rz = 0): THREE.Mesh => {
    const m = new THREE.Mesh(ballGeo(), partMat(hex));
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(0, ry, rz);
    return hang(bone, m);
  };
  if (kind === 'camel') {
    ball(torso, 0xc09a62, 0, t.y + 0.2, t.z + 0.1, 0.19, 0.3, 0.26);
    return;
  }
  if (kind === 'bear') return;
  const P = PAINT[kind]!, skin = P.Main, m = kind === 'mammoth';
  // The trunk, from the brow down to the knees, curling forward at the tip.
  const trunk = new THREE.Mesh(taper('trunk', [[0, 0.08, 0.2], [0, -0.1, 0.36], [0, -0.38, 0.42], [0, -0.62, 0.4], [0, -0.78, 0.46]], 0.13, 0.045), partMat(skin));
  trunk.position.copy(h);
  hang(head, trunk);
  // The dome of the skull, and the ears.
  ball(head, skin, h.x, h.y + 0.12, h.z + 0.06, 0.24, m ? 0.3 : 0.24, 0.26);
  for (const s of [-1, 1]) ball(head, P.Main_Light, h.x + s * 0.3, h.y + 0.02, h.z - 0.04, m ? 0.16 : 0.3, m ? 0.2 : 0.34, 0.035, s * -0.55, s * 0.12);
  // The tusks.
  for (const s of [-1, 1]) {
    const pts: [number, number, number][] = m
      ? [[s * 0.12, -0.12, 0.26], [s * 0.2, -0.42, 0.46], [s * 0.22, -0.5, 0.74], [s * 0.12, -0.3, 0.94], [s * 0.02, -0.08, 0.92]]
      : [[s * 0.12, -0.12, 0.26], [s * 0.16, -0.32, 0.42], [s * 0.17, -0.38, 0.62], [s * 0.15, -0.34, 0.76]];
    const tusk = new THREE.Mesh(taper((m ? 'mtusk' : 'tusk') + s, pts, m ? 0.05 : 0.04, 0.012), partMat(0xf0e8d4));
    tusk.position.copy(h);
    hang(head, tusk);
  }
  // A mammoth carries a hump of fat and hair over the shoulders.
  if (m) ball(torso, P.Main, 0, t.y + 0.14, t.z + 0.1, 0.3, 0.26, 0.36);
}

/**
 * An animal whose spine stands `back` above the ground, standing on it and facing +z. `seed` picks a horse's coat;
 * `fur` recolours a wolf or a hound (grey wolves, black war wolves, brown hounds).
 */
export function makeBeast(kind: BeastKind, back: number, seed = 0, fur: number | null = null): Beast | null {
  const src = sources.get(sourceOf(kind));
  if (!src) return null;
  const paint = PAINT[kind];
  const root = cloneSkinned(src.root) as THREE.Group;
  const coatName = COAT_NAMES[Math.abs(seed | 0) % COAT_NAMES.length];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const swap = (mt: THREE.Material): THREE.Material => {
      if (kind === 'horse') return coat(mt, mt.name, coatName);
      if (paint) {
        const hex = paint[mt.name];
        if (hex === undefined) return mt;
        const key = kind + '|' + mt.name;
        let out = tinted.get(key);
        if (!out) {
          out = mt.clone();
          if (hex < 0) out.visible = false; else (out as THREE.MeshStandardMaterial).color.setHex(hex);
          out.userData.outlineParameters = { visible: false };
          tinted.set(key, out);
        }
        return out;
      }
      if (fur === null) return mt;
      const key = kind + '|' + mt.name + '|' + fur;
      let out = tinted.get(key);
      if (!out) {
        out = mt.clone();
        const c = (out as THREE.MeshStandardMaterial).color;
        // Keep each part's own lightness against the others, on the new colour.
        const l = (c.r + c.g + c.b) / 3;
        if (l > 0.02 && l < 0.45) c.setHex(fur).multiplyScalar(0.55 + l * 2.2);
        out.userData.outlineParameters = { visible: false };
        tinted.set(key, out);
      }
      return out;
    };
    m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
  });
  if (kind === 'camel' || kind === 'elephant' || kind === 'mammoth' || kind === 'bear') makeOver(root, kind);
  root.scale.multiplyScalar(back);
  const g = new THREE.Group();
  g.add(root);
  const mixer = new THREE.AnimationMixer(root), actions = new Map<string, THREE.AnimationAction>();
  for (const [name, clip] of src.clips) actions.set(name, mixer.clipAction(clip));
  actions.get('Idle')?.play();
  mixer.update((Math.abs(seed) % 30) / 10);
  return { g, mixer, actions, now: 'Idle', kind, strike: 0, struck: false };
}

/** Move to another motion, blending out of the one playing. */
export function gait(b: Beast, name: string, speed = 1, once = false): void {
  const next = b.actions.get(name) ?? b.actions.get(name === 'Attack' ? 'Attack_Headbutt' : 'Idle');
  if (!next) return;
  next.timeScale = speed;
  if (b.now === name && next.isRunning()) return;
  const prev = b.actions.get(b.now) ?? b.actions.get(b.now === 'Attack' ? 'Attack_Headbutt' : '');
  next.reset();
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = once;
  next.play();
  if (prev && prev !== next) prev.crossFadeTo(next, 0.2, false);
  b.now = name;
}
