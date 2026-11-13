// Animals drawn from real four-legged figures with skeletons and recorded gaits: the horse under every rider, the
// wolf, the deer and the stag, and the hound. They are from the Ultimate Animated Animal Pack by Quaternius (CC0;
// see public/models/animals/SOURCE.txt). Each is stood on the ground facing forward and made one unit long when it
// arrives, so the game can size it by length and seat a rider on it.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type BeastKind = 'horse' | 'wolf' | 'deer' | 'stag' | 'husky';
const KINDS: BeastKind[] = ['horse', 'wolf', 'deer', 'stag', 'husky'];

interface Source { root: THREE.Group; clips: Map<string, THREE.AnimationClip> }
const sources = new Map<BeastKind, Source>();
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
export const beastReady = (kind: BeastKind): boolean => sources.has(kind);

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

/**
 * An animal whose spine stands `back` above the ground, standing on it and facing +z. `seed` picks a horse's coat;
 * `fur` recolours a wolf or a hound (grey wolves, black war wolves, brown hounds).
 */
export function makeBeast(kind: BeastKind, back: number, seed = 0, fur: number | null = null): Beast | null {
  const src = sources.get(kind);
  if (!src) return null;
  const root = cloneSkinned(src.root) as THREE.Group;
  const coatName = COAT_NAMES[Math.abs(seed | 0) % COAT_NAMES.length];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const swap = (mt: THREE.Material): THREE.Material => {
      if (kind === 'horse') return coat(mt, mt.name, coatName);
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
  root.scale.setScalar(back);
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
