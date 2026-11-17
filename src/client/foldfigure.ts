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

/**
 * What of a figure's parts may not be folded: those shown and hidden while it lives. `skins` and `whole` (RealPerson's,
 * for its wounds) are brought up to date when the skinned body is folded.
 */
export interface Unfoldable { props: Map<string, THREE.Object3D>; gear: THREE.Object3D[][]; spare: THREE.Object3D | null; skins?: THREE.SkinnedMesh[]; whole?: THREE.BufferGeometry[] }

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
  return saved + foldSkins(body, real);
}

/**
 * The skinned body: the mannequin's two meshes and the cloth sewn on it (a bodice, a skirt), each a draw and a shadow.
 * All ride the one skeleton; those of one material are merged into one skinned mesh, so a figure is two of them, not four.
 * The merged shape is made once for each set of shapes and shared by every figure that has the same. And where three.js
 * would draw a skinned figure everywhere, never knowing where its motion has taken it, it is given a sphere wide enough
 * for any pose (a body's height about its middle), so a figure out of sight, or out of the sun's view for its shadow,
 * is left undrawn.
 */
const skinMerges = new Map<string, THREE.BufferGeometry>();
function foldSkins(body: THREE.Object3D, real: Unfoldable): number {
  const all: THREE.SkinnedMesh[] = [];
  body.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.visible && !Array.isArray(m.material)) all.push(m); });
  if (!all.length) return 0;
  const lead = all[0].skeleton, at = new Map(lead.bones.map((b, i) => [b, i]));
  // Every mesh must hang on the same bones in the same bind pose, or it is left alone.
  const fits = (m: THREE.SkinnedMesh): boolean => m.bindMatrix.equals(all[0].bindMatrix) && m.skeleton.bones.every((b, i) => at.has(b) && m.skeleton.boneInverses[i].equals(lead.boneInverses[at.get(b)!]));
  const groups = new Map<string, THREE.SkinnedMesh[]>();
  for (const m of all) {
    if (!fits(m)) continue;
    const k = `${(m.material as THREE.Material).uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${Object.keys(m.geometry.attributes).sort().join(',')}|${!!m.geometry.index}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(m);
  }
  let saved = 0;
  for (const list of groups.values()) {
    let mesh = list[0];
    if (list.length > 1) {
      const key = list.map((m) => `${m.geometry.uuid}:${m.skeleton.bones.map((b) => at.get(b)).join('.')}`).join('|');
      let geo = skinMerges.get(key);
      if (!geo) {
        const parts = list.map((m) => {
          const g = m.geometry.clone();
          const idx = g.getAttribute('skinIndex') as THREE.BufferAttribute;
          if (m.skeleton !== lead) for (let i = 0; i < idx.array.length; i++) (idx.array as Uint16Array)[i] = at.get(m.skeleton.bones[idx.array[i]])!;
          return g;
        });
        const merged = mergeGeometries(parts, false);
        parts.forEach((g) => g.dispose());
        if (!merged) continue;
        skinMerges.set(key, (geo = merged));
      }
      mesh = new THREE.SkinnedMesh(geo, list[0].material);
      mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow;
      mesh.userData.folded = true;
      list[0].parent!.add(mesh);
      mesh.position.copy(list[0].position); mesh.quaternion.copy(list[0].quaternion); mesh.scale.copy(list[0].scale);
      mesh.bind(lead, list[0].bindMatrix);
      for (const m of list) m.removeFromParent();
      saved += list.length - 1;
      // The wounds paint on the merged surface now (person.ts wounds: blood and torn cloth on a copy of the whole).
      if (real.skins && real.whole) {
        const had = list.some((m) => real.skins!.includes(m));
        for (const m of list) { const i = real.skins.indexOf(m); if (i >= 0) { real.skins.splice(i, 1); real.whole.splice(i, 1); } }
        if (had && geo.getAttribute('color')) { real.skins.push(mesh); real.whole.push(geo); }
      }
    }
    roomy(mesh);
  }
  return saved;
}

/** A sphere for any pose, in the skinned mesh's own space (the body's whole size about its middle), so it can be culled. */
function roomy(mesh: THREE.SkinnedMesh): void {
  const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute);
  mesh.boundingSphere = new THREE.Sphere(box.getCenter(new THREE.Vector3()), box.getSize(new THREE.Vector3()).length());
  mesh.frustumCulled = true;
}

/** Let an animal's skinned meshes be left undrawn when out of sight, as a person's are (beast.ts draws them everywhere). */
export function cullBeast(root: THREE.Object3D): void {
  root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) roomy(m); });
}
