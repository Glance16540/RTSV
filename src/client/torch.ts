// A torch carried in the hand after dark. The night's flames (`nightlight.ts`) say who carries one; here the figure
// is given the torch itself, an arm that holds it up over whatever motion is playing, and the place of its tip in
// the world, so the flame and its light can be set on it.

import * as THREE from 'three';
import { RealPerson, point } from './person';

interface Carried { torch: THREE.Group; tip: THREE.Object3D; w: number; at: THREE.Vector3; lit: boolean }
const carried = new WeakMap<RealPerson, Carried>();
const UP = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), qw = new THREE.Quaternion(), qd = new THREE.Quaternion(), sw = new THREE.Vector3();
let wood: THREE.MeshStandardMaterial | null = null, pitch: THREE.MeshStandardMaterial | null = null, shaft: THREE.BufferGeometry | null = null, head: THREE.BufferGeometry | null = null;

/** How long the torch is, and how far up it the hand grips, in the world's measure for a figure of full size. */
export const TORCH = { long: 0.3, grip: 0.09 };

/** Both hands are wanted for a bow, a crossbow or a gun, and a child carries nothing. */
export const canCarryTorch = (p: { weapon: string; child: boolean }): boolean => !p.child && p.weapon !== 'bow' && p.weapon !== 'crossbow' && p.weapon !== 'musket' && p.weapon !== 'firetube';

function make(): Carried {
  wood ??= new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 });
  pitch ??= new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 1, emissive: 0xff7a20, emissiveIntensity: 0.9 });
  wood.userData.outlineParameters = pitch.userData.outlineParameters = { visible: false };
  shaft ??= new THREE.CylinderGeometry(0.013, 0.011, TORCH.long, 6).translate(0, TORCH.long / 2 - TORCH.grip, 0);
  head ??= new THREE.CylinderGeometry(0.026, 0.018, 0.07, 7).translate(0, TORCH.long - TORCH.grip - 0.02, 0);
  const torch = new THREE.Group(), tip = new THREE.Object3D();
  const a = new THREE.Mesh(shaft, wood), b = new THREE.Mesh(head, pitch);
  a.castShadow = true;
  tip.position.y = TORCH.long - TORCH.grip + 0.06;
  torch.add(a, b, tip);
  return { torch, tip, w: 0, at: new THREE.Vector3(), lit: false };
}

/**
 * Hold a torch up in the left hand, by a share `want` (0 to 1) that is come to smoothly. `yaw` is the way the figure
 * faces. Call after the motion has been advanced and any weapon levelled. The torch stands upright in the world
 * however the hand has turned.
 */
export function carryTorch(p: RealPerson, yaw: number, want: number, dt: number): void {
  let c = carried.get(p);
  if (!c) {
    if (want <= 0) return;
    const hand = p.bones.get('DEF-handL');
    if (!hand) return;
    carried.set(p, (c = make()));
    hand.add(c.torch);
  }
  c.w += (want - c.w) * Math.min(1, dt * 5);
  c.lit = c.w > 0.3;
  if (c.torch.visible !== c.w > 0.05) c.torch.visible = c.w > 0.05;
  if (c.w <= 0.05) return;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
  // A direction given as so much forward, so much to the figure's left, so much up.
  const to = (f: number, l: number, u: number): THREE.Vector3 => dir.set(fx * f + lx * l, u, fz * f + lz * l).normalize();
  // The upper arm out to the side and a little forward, the forearm up: the flame stands beside and above the head.
  point(p.bones.get('DEF-upper_armL'), to(0.35, 0.8, -0.3), c.w);
  point(p.bones.get('DEF-forearmL'), to(0.3, 0.15, 1), c.w);
  const hand = c.torch.parent!;
  hand.updateWorldMatrix(true, false);
  hand.getWorldQuaternion(qw).invert();
  c.torch.quaternion.copy(qw.multiply(qd.setFromUnitVectors(UP, to(0.12, 0.1, 1))));
  hand.getWorldScale(sw);
  // Fitted to the figure: a small person carries a small torch.
  const k = p.body.scale.x / (1.02 / 1.83);
  c.torch.scale.set(k / sw.x, k / sw.y, k / sw.z);
  c.torch.position.set(0, 0.07, 0);
  c.torch.updateWorldMatrix(false, true);
  c.tip.getWorldPosition(c.at);
}

/** Where the flame sits: the tip of the torch in the world, or null while it is not held up. */
export const torchTip = (p: RealPerson): THREE.Vector3 | null => { const c = carried.get(p); return c?.lit ? c.at : null; };

/** Put the torch out and away at once, as when its bearer falls. */
export function dropTorch(p: RealPerson): void {
  const c = carried.get(p);
  if (c) { c.w = 0; c.lit = false; c.torch.visible = false; }
}
