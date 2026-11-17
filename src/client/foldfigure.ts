// Fewer draws for a figure (after bake.ts, which does the same for buildings).
//
// A person is a skinned body in four meshes and, borne on the bones, a face, hair and dress made of a dozen or more small
// rigid pieces, each in a plain colour of its own (person.ts solid): every piece is a draw, and again for the shadow.
// The pieces that are always shown ride their bone and never move on it, so those on one bone that differ only in
// colour are merged into one mesh on that bone, the colour of each piece carried on its vertices, with a material that
// is the same but for taking its colour from them. The face, all on the head, is one draw instead of fourteen.
//
// Left as they are: what is shown and hidden as the person works or is hurt (tools, loads, gear a blow knocks off, the
// hair kept under a helmet; RealPerson props, gear and spare), and everything under them; pieces hidden now; and any
// piece whose material is not a plain colour (a picture on it, a glow, see-through).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { placed } from './bake';

/** What of a figure's parts may not be folded: those shown and hidden while it lives. */
export interface Unfoldable { props: Map<string, THREE.Object3D>; gear: THREE.Object3D[][]; spare: THREE.Object3D | null }

/** The coloured-by-vertex twin of a plain material, one for each way of surface. */
const twins = new Map<string, THREE.MeshStandardMaterial>();
function twin(m: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const key = `${m.roughness}|${m.metalness}|${m.side}|${m.flatShading}`;
  let t = twins.get(key);
  if (!t) {
    t = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness, metalness: m.metalness, side: m.side, flatShading: m.flatShading });
    t.userData.outlineParameters = m.userData.outlineParameters ? { ...m.userData.outlineParameters } : undefined;
    twins.set(key, t);
  }
  return t;
}

/** Is this a plain-coloured rigid piece? */
function plain(o: THREE.Object3D): o is THREE.Mesh & { material: THREE.MeshStandardMaterial } {
  const m = o as THREE.Mesh, mt = m.material as THREE.MeshStandardMaterial;
  if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mt)) return false;
  if (!mt.isMeshStandardMaterial || mt.vertexColors || mt.transparent || mt.map || mt.normalMap || mt.bumpMap || mt.alphaMap || mt.emissiveMap) return false;
  return mt.emissive.getHex() === 0 && m.renderOrder === 0 && !m.geometry.morphAttributes.position;
}

/** Merge a figure's still pieces, bone by bone. Returns how many draws it saves. */
export function foldFigure(body: THREE.Object3D, real: Unfoldable): number {
  const keep = new Set<THREE.Object3D>();
  const hold = (o: THREE.Object3D | null): void => { o?.traverse((x) => keep.add(x)); };
  for (const t of real.props.values()) hold(t);
  for (const list of real.gear) list.forEach(hold);
  hold(real.spare);
  body.updateMatrixWorld(true);
  const groups = new Map<string, { bone: THREE.Object3D; mat: THREE.MeshStandardMaterial; cast: boolean; take: boolean; parts: THREE.Mesh[] }>();
  body.traverse((o) => {
    if (keep.has(o) || !plain(o)) return;
    let bone: THREE.Object3D | null = o.parent;
    for (let p: THREE.Object3D | null = o; p && p !== body; p = p.parent) if (!p.visible) return; // hidden now, perhaps shown later
    while (bone && !(bone as THREE.Bone).isBone) bone = bone.parent;
    if (!bone) return;
    const mat = twin(o.material), key = `${bone.uuid}|${mat.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
    let gr = groups.get(key);
    if (!gr) groups.set(key, (gr = { bone, mat, cast: o.castShadow, take: o.receiveShadow, parts: [] }));
    gr.parts.push(o);
  });
  let saved = 0;
  const toBone = new THREE.Matrix4(), rel = new THREE.Matrix4();
  for (const gr of groups.values()) {
    if (gr.parts.length < 2) continue;
    toBone.copy(gr.bone.matrixWorld).invert();
    const geos = gr.parts.map((m) => {
      const one = placed(m.geometry, rel.multiplyMatrices(toBone, m.matrixWorld));
      for (const n of Object.keys(one.attributes)) if (n !== 'position' && n !== 'normal') one.deleteAttribute(n);
      one.clearGroups();
      const c = (m.material as THREE.MeshStandardMaterial).color, k = one.getAttribute('position').count, col = new Float32Array(k * 3);
      for (let i = 0; i < k; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      one.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return one;
    });
    if (!geos.every((x) => x.getAttribute('normal'))) { geos.forEach((x) => x.dispose()); continue; }
    const merged = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, gr.mat);
    mesh.castShadow = gr.cast; mesh.receiveShadow = gr.take;
    mesh.userData.folded = true;
    gr.bone.add(mesh);
    for (const m of gr.parts) m.removeFromParent();
    saved += gr.parts.length - 1;
  }
  return saved;
}
