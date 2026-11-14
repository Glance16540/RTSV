import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { canCarryTorch, carryTorch, dropTorch, torchTip } from '../src/client/torch';
import type { RealPerson } from '../src/client/person';

/** The left arm of a figure and no more: shoulder, forearm and hand, hanging at the side. */
function figure(weapon = 'sword'): RealPerson {
  const body = new THREE.Group(), arm = new THREE.Bone(), fore = new THREE.Bone(), hand = new THREE.Bone();
  body.scale.setScalar(1.02 / 1.83);
  arm.position.set(0.2, 1.45, 0); arm.rotation.z = Math.PI; // a bone lies along its own y: this one points down
  fore.position.y = 0.3; hand.position.y = 0.28;
  body.add(arm); arm.add(fore); fore.add(hand);
  body.updateMatrixWorld(true);
  return { body, bones: new Map<string, THREE.Object3D>([['DEF-upper_armL', arm], ['DEF-forearmL', fore], ['DEF-handL', hand]]), weapon, child: false } as unknown as RealPerson;
}

describe('a torch in the hand', () => {
  it('is not for those who need both hands, nor for a child', () => {
    for (const w of ['bow', 'crossbow', 'musket', 'firetube']) expect(canCarryTorch({ weapon: w, child: false }), w).toBe(false);
    for (const w of ['sword', 'spear', 'pike', 'club', '']) expect(canCarryTorch({ weapon: w, child: false }), w).toBe(true);
    expect(canCarryTorch({ weapon: 'sword', child: true })).toBe(false);
  });
  it('is held up above the shoulder, upright, with its tip where the flame goes', () => {
    const p = figure();
    expect(torchTip(p)).toBe(null);
    for (let i = 0; i < 40; i++) carryTorch(p, 0.7, 1, 0.05);
    const tip = torchTip(p)!, hand = p.bones.get('DEF-handL')!.getWorldPosition(new THREE.Vector3());
    // The hand has come up from the hip to above the shoulder, and the tip stands over the hand.
    expect(hand.y).toBeGreaterThan(1.45 * (1.02 / 1.83));
    expect(tip.y - hand.y).toBeGreaterThan(0.15);
    expect(Math.hypot(tip.x - hand.x, tip.z - hand.z)).toBeLessThan(0.12);
  });
  it('comes down by day and goes out when dropped', () => {
    const p = figure();
    for (let i = 0; i < 40; i++) carryTorch(p, 0, 1, 0.05);
    expect(torchTip(p)).not.toBe(null);
    for (let i = 0; i < 40; i++) carryTorch(p, 0, 0, 0.05);
    expect(torchTip(p)).toBe(null);
    for (let i = 0; i < 40; i++) carryTorch(p, 0, 1, 0.05);
    dropTorch(p);
    expect(torchTip(p)).toBe(null);
    expect(p.bones.get('DEF-handL')!.children[0].visible).toBe(false);
  });
});
