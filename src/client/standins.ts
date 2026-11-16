// Stand-ins for buildings that have no model of their own yet (docs/DESIGN.md, "Buildings and research that answer
// the systems"). A new building is drawn as an existing one, scaled and tinted, until its real model is made in
// models.ts. A session that adds a building puts it here from a client file of its own:
//
//   STANDINS.watchhouse = { as: 'tower', scale: 0.8, tint: 0xc9b27a };
//
// and names it in the villagers' build menu with `inBuildMenu`. The renderer asks `shapeOf` for the model to make
// and `dress` to finish it. Nothing here is rules: the sim does not import it.
import * as THREE from 'three';
import { BUILD_PAGES } from '../sim/data';

export interface StandIn { /** The building whose model is borrowed. */ as: string; /** Its size against that model's (1: the same). */ scale?: number; /** A colour laid over it. */ tint?: number }
export const STANDINS: Record<string, StandIn> = {};

/** The building type whose model stands for this one: itself, if it has a model of its own. */
export const shapeOf = (type: string): string => STANDINS[type]?.as ?? type;
/** Finish a model made for `shapeOf(type)`: scaled and tinted as its stand-in says. A building with its own model is left as it is. */
export function dress<T extends THREE.Object3D>(type: string, model: T): T {
  const s = STANDINS[type];
  if (!s) return model;
  if (s.scale) model.scale.multiplyScalar(s.scale);
  if (s.tint !== undefined) {
    const tint = new THREE.Color(s.tint);
    model.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const tinted = (m: THREE.Material): THREE.Material => { const k = m.clone() as THREE.Material & { color?: THREE.Color }; k.color?.lerp(tint, 0.45); return k; };
      o.material = Array.isArray(o.material) ? o.material.map(tinted) : tinted(o.material); // its own copy: the borrowed model's materials are shared
    });
  }
  return model;
}
/** Put a building in the villagers' build menu: page 0 is the settlement, page 1 the military. Once only. */
export function inBuildMenu(type: string, page: 0 | 1): void {
  if (!BUILD_PAGES.some((p) => p.includes(type))) BUILD_PAGES[page].push(type);
}
