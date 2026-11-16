// Stand-ins for buildings that have no model of their own yet: an existing building's shape, scaled and tinted,
// until the portrait session makes the real ones. models.ts is not touched; the renderer asks here first.
// Each job adds its own lines under a comment naming it.
import * as THREE from 'three';
import { makeBuilding } from './models';
import { BUILDINGS } from '../sim/data';

/** `as`: the building whose shape stands in; `tall`: how much taller; `tint`: a colour the walls are drawn toward. */
export interface StandIn { as: string; tall?: number; tint?: number }

export const STANDINS: Record<string, StandIn> = {
  // Food and health (the food-health job).
  granary: { as: 'storehouse', tall: 1.35, tint: 0xd9b45a }, // a tall barn, the colour of grain
  mill: { as: 'house', tall: 1.6, tint: 0xb8a07a }, // a tall narrow house of weathered wood
  well: { as: 'tower', tall: 0.25, tint: 0x8fa6b8 }, // a low round of stone, a little blue
  infirmary: { as: 'temple', tall: 0.8, tint: 0xe8e2d4 }, // a low pale house of care
};

/** A building's look: its own model, or its stand-in scaled to its footprint, made taller and tinted. */
export function lookOfBuilding(type: string, color: number, age: number, civ = '', leaning: '' | 'holy' | 'low' = '', seed?: number): THREE.Group {
  const s = STANDINS[type];
  if (!s || !BUILDINGS[s.as]) return makeBuilding(type, color, age, civ, leaning, seed);
  const g = makeBuilding(s.as, color, age, civ, leaning, seed);
  const k = (BUILDINGS[type]?.size ?? BUILDINGS[s.as].size) / BUILDINGS[s.as].size;
  g.scale.set(g.scale.x * k, g.scale.y * k * (s.tall ?? 1), g.scale.z * k);
  if (s.tint !== undefined) {
    const to = new THREE.Color(s.tint), team = new THREE.Color(color);
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const tinted = (m: THREE.Material): THREE.Material => {
        const c = (m as THREE.MeshStandardMaterial).color;
        if (!c || c.equals(team)) return m; // the owner's colour stays plain
        const n = m.clone() as THREE.MeshStandardMaterial; // materials are shared between buildings: tint a copy
        n.color.lerp(to, 0.4);
        return n;
      };
      o.material = Array.isArray(o.material) ? o.material.map(tinted) : tinted(o.material);
    });
  }
  return g;
}
