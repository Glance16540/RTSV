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
