// A town's scars on the campaign map (src/sim/battlescars.ts): where its buildings are damaged, from a battle or a
// fire, the ground of the town is charred and dark smoke rises from it, more for the worse it was hit, until it is
// mended. The smoke rises as the hearth-smoke does (worldmap.ts moves both), only darker and from more places.
import * as THREE from 'three';

/** One puff of smoke for the map to move: worldmap.ts's own shape. */
export interface Puff { m: THREE.Mesh; x: number; y: number; z: number; ph: number }

const CHAR = new THREE.MeshBasicMaterial({ color: 0x2a221c, transparent: true, opacity: 0.5, depthWrite: false });
const SMOKE = new THREE.MeshBasicMaterial({ color: 0x3e3832, transparent: true, opacity: 0.5, depthWrite: false });
const PUFF = new THREE.SphereGeometry(0.34, 7, 5);

/**
 * The scars of a town standing at (x, y, z) on the map: `share` is how much of the town's buildings is lost (0 to 1),
 * `damaged` how many are hurt. Returns the charred ground to add and the dark puffs for the map to move.
 */
export function scarPieces(share: number, damaged: number, x: number, y: number, z: number, seed: number): { group: THREE.Group; puffs: Puff[] } {
  const group = new THREE.Group(), puffs: Puff[] = [];
  if (damaged <= 0) return { group, puffs };
  const r = 1.4 + Math.min(1, share * 2.5) * 1.6;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(r, 18), CHAR);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(x, y + 0.06, z);
  group.add(ground);
  const n = Math.min(4, 1 + Math.round(share * 6));
  for (let k = 0; k < n; k++) {
    const a = seed * 1.7 + k * 2.4, d = 0.5 + (k % 2) * 0.7;
    for (let j = 0; j < 3; j++) {
      const m = new THREE.Mesh(PUFF, SMOKE.clone());
      group.add(m);
      puffs.push({ m, x: x + Math.cos(a) * d, y: y + 1.2, z: z + Math.sin(a) * d, ph: j / 3 + k * 0.29 + seed * 0.13 });
    }
  }
  return { group, puffs };
}
