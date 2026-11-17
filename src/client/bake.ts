// Fewer draws for a building that stands still (the playtest session's frame-cost measure: a grown town's buildings in
// view cost some 65–70 draw calls each, a house being 29 meshes of 11 materials).
//
// A building is made of many small meshes, and every one is a draw of its own (and again for the shadow and the ink
// outline). Once it is finished and nothing about it is moving, its meshes are merged, one mesh for each material,
// into the same group, and the parts are hidden: the same shapes, the same materials, in the same places, drawn in a
// handful of draws. The parts stay in the group: anything that needs them (a building shedding pieces as it is hurt,
// falling, being rebuilt) calls `unbake` first and has them back exactly as they were.
//
// Left as they are: whatever the building's view keeps a hand on in its userData (lamps, a wall's arms, a gate, the
// people working in it, a fire), and everything under it; meshes already hidden; skinned, instanced and see-through
// meshes, and those drawn in an order of their own.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Baked { merged: THREE.Mesh[]; parts: THREE.Mesh[] }

/** Everything the view keeps a hand on in its userData, and all under it. */
function held(g: THREE.Object3D): Set<THREE.Object3D> {
  const out = new Set<THREE.Object3D>();
  const take = (v: unknown): void => {
    if (v instanceof THREE.Object3D) v.traverse((o) => out.add(o));
    else if (Array.isArray(v)) v.forEach(take);
  };
  for (const v of Object.values(g.userData)) take(v);
  return out;
}

/** May this mesh be merged with others of its material? */
function still(m: THREE.Mesh, keep: Set<THREE.Object3D>, g: THREE.Object3D): boolean {
  if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh || keep.has(m)) return false;
  if (Array.isArray(m.material) || m.material.transparent || m.renderOrder !== 0 || m.geometry.morphAttributes.position) return false;
  for (let o: THREE.Object3D | null = m; o && o !== g; o = o.parent) if (!o.visible) return false; // hidden now, perhaps shown later
  return true;
}

/**
 * A part's shape put into another space by `m`, without an index. Where `m` mirrors (a part scaled by a negative amount),
 * three.js would have turned the part's faces round when drawing it; a merged copy is not drawn so, so its triangles are
 * turned round here instead.
 */
export function placed(geo: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const out = geo.index ? geo.toNonIndexed() : geo.clone();
  out.applyMatrix4(m);
  if (m.determinant() < 0) for (const a of Object.values(out.attributes) as THREE.BufferAttribute[]) {
    const n = a.itemSize, arr = a.array;
    for (let i = 0; i + 2 < a.count; i += 3) for (let k = 0; k < n; k++) { const t = arr[(i + 1) * n + k]; arr[(i + 1) * n + k] = arr[(i + 2) * n + k]; arr[(i + 2) * n + k] = t; }
  }
  return out;
}

/** The merge key: a material, and how the mesh takes and casts shadow. */
const keyOf = (m: THREE.Mesh): string => `${(m.material as THREE.Material).uuid}:${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}`;

/**
 * Merge a still building's meshes, one for each material. Returns how many draws it saves (0 if there was nothing to
 * merge, or it is baked already).
 */
export function bake(g: THREE.Object3D): number {
  if (g.userData.baked) return 0;
  g.updateMatrixWorld(true);
  const keep = held(g), toLocal = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const groups = new Map<string, THREE.Mesh[]>();
  g.traverse((o) => { const m = o as THREE.Mesh; if (still(m, keep, g)) { const k = keyOf(m); (groups.get(k) ?? groups.set(k, []).get(k)!).push(m); } });
  const merged: THREE.Mesh[] = [], parts: THREE.Mesh[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Each part's shape, put where it stands in the building, with only the attributes all of them have.
    const geos = list.map((m) => placed(m.geometry, new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld)));
    const names = Object.keys(geos[0].attributes).filter((n) => geos.every((x) => x.attributes[n] && x.attributes[n].itemSize === geos[0].attributes[n].itemSize));
    for (const geo of geos) { for (const n of Object.keys(geo.attributes)) if (!names.includes(n)) geo.deleteAttribute(n); geo.clearGroups(); }
    const one = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (!one) continue;
    const mesh = new THREE.Mesh(one, list[0].material);
    mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
    mesh.userData.baked = true;
    g.add(mesh);
    merged.push(mesh);
    for (const m of list) { m.visible = false; parts.push(m); }
  }
  if (!merged.length) return 0;
  const done: Baked = { merged, parts };
  g.userData.baked = done;
  return parts.length - merged.length;
}

/** Put a baked building back as its parts, exactly as they were. */
export function unbake(g: THREE.Object3D): void {
  const b = g.userData.baked as Baked | undefined;
  if (!b) return;
  for (const m of b.merged) { m.removeFromParent(); m.geometry.dispose(); }
  for (const m of b.parts) m.visible = true;
  delete g.userData.baked;
}
