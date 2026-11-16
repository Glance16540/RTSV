// Stand-in looks for buildings that have no model of their own yet (docs/DESIGN.md, "Buildings and research that
// answer the systems"). A new building is drawn as an existing one, scaled and tinted, until the portrait session
// makes its own model in models.ts and takes its line out of this table. Each session that adds buildings puts its
// lines in a block of its own below, under a comment naming its job; nobody touches another's lines.
import * as THREE from 'three';
import { makeBuilding } from './models';

/** A stand-in: drawn as `as`, scaled by `scale` across and `tall` upward, its walls washed toward `tint`. */
export interface StandIn { as: string; scale?: number; tall?: number; tint?: number }

export const STAND_INS: Record<string, StandIn> = {
  // ---- Rule, law, nobles and faith (the people session) ----
  hall: { as: 'temple', scale: 1, tall: 1.15, tint: 0xc9a85a }, // a Hall of Judgement: a church's frame, taller and gilded (hall.ts)
  manor: { as: 'house', scale: 1.5, tint: 0x8a5a9a }, // a Noble's Manor: a house half again as wide, washed purple (manor.ts)
  monastery: { as: 'temple', scale: 1.33, tint: 0xeee6cc }, // a Monastery or Convent: a church grown to its footprint, washed pale (monastery.ts)
  // ---- Food and health (the food-health job) ----
  granary: { as: 'storehouse', tall: 1.35, tint: 0xd9b45a }, // a tall barn, the colour of grain
  mill: { as: 'house', tall: 1.6, tint: 0xb8a07a }, // a tall narrow house of weathered wood
  well: { as: 'tower', scale: 0.5, tall: 0.5, tint: 0x8fa6b8 }, // a low round of stone, a little blue (a tower is twice its size)
  infirmary: { as: 'temple', scale: 0.67, tall: 0.8, tint: 0xe8e2d4 }, // a low pale house of care (a temple is half again its size)
  // ---- Order and roads (the order-and-roads job) ----
  watchhouse: { as: 'tower', scale: 0.8, tall: 0.75, tint: 0xd8c08a }, // a low tower in pale timber
};

/** A building's look: its own model, or its stand-in until it has one. Takes what `makeBuilding` takes. */
export function standInBuilding(...args: Parameters<typeof makeBuilding>): THREE.Group {
  const [type, ...rest] = args;
  const s = STAND_INS[type];
  if (!s) return makeBuilding(type, ...rest);
  const g = makeBuilding(s.as, ...rest);
  const k = s.scale ?? 1;
  g.scale.set(k, (s.tall ?? 1) * k, k);
  if (s.tint !== undefined) {
    const wash = new THREE.Color(s.tint);
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const one = (m: THREE.Material): THREE.Material => {
        const c = (m as THREE.MeshToonMaterial).color;
        if (!c) return m;
        const copy = m.clone() as THREE.MeshToonMaterial;
        copy.color = c.clone().lerp(wash, 0.35);
        return copy;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
  }
  return g;
}
