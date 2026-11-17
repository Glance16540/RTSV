// A town's still buildings drawn together (after bake.ts): one mesh for each material for all of them.
//
// bake.ts brings a house from 29 meshes to 11, one for each of its materials; but a grown town has dozens of houses,
// all made of the same few materials (shapes.ts toon: one material for each colour and surface, shared by everything).
// So the baked meshes of every building that is in the scene and shown are merged once more, across buildings, into one
// mesh for each material and way of taking shadow, standing in world space; the buildings' own baked meshes are hidden
// while they are in it. The set is looked at every frame and the batch is made again only when it changes: a building
// baked or unbaked (finished, hurt, falling), shown or hidden (fog of war), added or taken away. Between those it costs
// nothing. A building that moves (none do once finished) would have to unbake first.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { placed } from './bake';

interface Baked { merged: THREE.Mesh[] }

export class TownBatch {
  private meshes: THREE.Mesh[] = [];
  private hidden: THREE.Mesh[] = [];
  private sig = '';
  /** How many times the batch has been made (for tests and measures). */
  builds = 0;

  /**
   * `tile`: when given, the batch is split by squares of the ground this many across (by where each view stands), so
   * that what is out of sight is still left undrawn as a whole square, as the views would have been one by one.
   */
  constructor(private scene: THREE.Scene, private opts: { tile?: number } = {}) {}

  /** Bring the batch up to date with these buildings' views. Returns whether it was made again. */
  sync(views: Iterable<THREE.Object3D>): boolean {
    const now: THREE.Object3D[] = [];
    for (const g of views) if (g.parent && g.visible && (g.userData.baked as Baked | undefined)?.merged.length) now.push(g);
    const sig = now.map((g) => `${g.id}:${(g.userData.baked as Baked).merged[0].id}`).join(',');
    if (sig === this.sig) return false;
    this.sig = sig;
    this.clear();
    const lists = new Map<string, { mat: THREE.Material; cast: boolean; take: boolean; geos: THREE.BufferGeometry[] }>();
    for (const g of now) {
      g.updateMatrixWorld(true);
      const t = this.opts.tile, square = t ? `@${Math.floor(g.position.x / t)},${Math.floor(g.position.z / t)}` : '';
      for (const m of (g.userData.baked as Baked).merged) {
        const mat = m.material as THREE.Material, key = `${mat.uuid}:${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}${square}`;
        let l = lists.get(key);
        if (!l) lists.set(key, (l = { mat, cast: m.castShadow, take: m.receiveShadow, geos: [] }));
        l.geos.push(placed(m.geometry, m.matrixWorld));
        m.visible = false;
        this.hidden.push(m);
      }
    }
    for (const l of lists.values()) {
      const names = Object.keys(l.geos[0].attributes).filter((n) => l.geos.every((x) => x.attributes[n]?.itemSize === l.geos[0].attributes[n].itemSize));
      for (const geo of l.geos) for (const n of Object.keys(geo.attributes)) if (!names.includes(n)) geo.deleteAttribute(n);
      const one = l.geos.length === 1 ? l.geos[0] : mergeGeometries(l.geos, false);
      if (l.geos.length > 1) l.geos.forEach((x) => x.dispose());
      if (!one) continue;
      one.computeBoundingSphere();
      const mesh = new THREE.Mesh(one, l.mat);
      mesh.castShadow = l.cast; mesh.receiveShadow = l.take;
      mesh.userData.townBatch = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    this.builds++;
    return true;
  }

  /** Take the batch away and show the buildings' own baked meshes again. */
  clear(): void {
    for (const m of this.meshes) { m.removeFromParent(); m.geometry.dispose(); }
    this.meshes = [];
    for (const m of this.hidden) m.visible = true;
    this.hidden = [];
  }

  /** Forget everything (a new battle). */
  reset(): void { this.clear(); this.sig = ''; }
}
