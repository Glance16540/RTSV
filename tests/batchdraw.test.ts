// Drawing a town in fewer draws (src/client/bake.ts, townbatch.ts, foldfigure.ts): the same shapes, the same colours, in
// the same places, and everything that must still move or hide left alone.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bake, placed, unbake } from '../src/client/bake';
import { TownBatch } from '../src/client/townbatch';
import { cullBeast, foldFigure } from '../src/client/foldfigure';

const red = new THREE.MeshStandardMaterial({ color: 0xaa2020 }), grey = new THREE.MeshStandardMaterial({ color: 0x808080 });
const box = (mat: THREE.Material, x: number, y = 0): THREE.Mesh => { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); m.position.set(x, y, 0); return m; };
/** Every visible mesh's triangles, as world-space corner points, sorted, with its material's colour. */
function seen(root: THREE.Object3D): string[] {
  root.updateMatrixWorld(true);
  const out: string[] = [], v = new THREE.Vector3(), c = new THREE.Color();
  root.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, pos = g.getAttribute('position'), col = g.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      c.copy((m.material as THREE.MeshStandardMaterial).color);
      if (col) c.multiply(new THREE.Color().fromBufferAttribute(col as THREE.BufferAttribute, i));
      out.push(`${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}:${c.getHexString()}`);
    }
  });
  return out.sort();
}
const draws = (root: THREE.Object3D): number => { let n = 0; root.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };

describe('bake', () => {
  it('merges a building by material into the same shapes, and unbake gives the parts back', () => {
    const g = new THREE.Group(); g.position.set(5, 0, 2); g.rotation.y = 0.7;
    g.add(box(red, 0), box(red, 2), box(grey, 0, 1), box(grey, 2, 1), box(grey, 4, 1));
    const before = seen(g);
    expect(bake(g)).toBe(3);
    expect(draws(g)).toBe(2);
    expect(seen(g)).toEqual(before);
    unbake(g);
    expect(draws(g)).toBe(5);
    expect(g.children.length).toBe(5);
  });

  it('leaves alone what the view keeps a hand on, and what is hidden', () => {
    const g = new THREE.Group(), lamp = box(red, 0), off = box(red, 2);
    off.visible = false;
    g.add(lamp, off, box(red, 4), box(red, 6));
    g.userData.lamp = lamp;
    bake(g);
    expect(lamp.visible).toBe(true);
    expect(off.visible).toBe(false);
    expect(draws(g)).toBe(2); // the lamp, and the two others merged
  });

  it('turns a mirrored part\'s faces round so it is drawn the same way out', () => {
    const geo = new THREE.BoxGeometry(1, 1, 1), m = new THREE.Matrix4().makeScale(-1, 1, 1);
    const a = geo.toNonIndexed().getAttribute('position'), b = placed(geo, m).getAttribute('position');
    // The first triangle's second and third corners swap places after the mirror.
    expect(b.getX(1)).toBeCloseTo(-a.getX(2)); expect(b.getX(2)).toBeCloseTo(-a.getX(1));
  });
});

describe('TownBatch', () => {
  it('draws the baked buildings together, and makes the batch again only when the set changes', () => {
    const scene = new THREE.Scene(), views: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) { const g = new THREE.Group(); g.position.x = i * 10; g.add(box(red, 0), box(red, 2), box(grey, 0, 1), box(grey, 2, 1)); scene.add(g); bake(g); views.push(g); }
    const before = seen(scene), batch = new TownBatch(scene);
    expect(batch.sync(views)).toBe(true);
    expect(draws(scene)).toBe(2);
    expect(seen(scene)).toEqual(before);
    expect(batch.sync(views)).toBe(false);
    views[1].visible = false; // under the fog
    expect(batch.sync(views)).toBe(true);
    expect(draws(scene)).toBe(2);
    unbake(views[0]); // hurt
    batch.sync(views);
    expect(draws(scene)).toBe(2 + 4);
    batch.reset();
    views[1].visible = true;
    expect(draws(scene)).toBe(4 + 2 + 2);
  });
});

describe('resources (bake all, TownBatch by squares)', () => {
  it('takes over a lone mesh with `all`, so a heap of one material each is batched whole', () => {
    const g = new THREE.Group(); g.add(box(red, 0), box(grey, 1));
    expect(bake(g)).toBe(0);
    expect(g.userData.baked).toBeUndefined();
    bake(g, { all: true });
    expect((g.userData.baked as { merged: THREE.Mesh[] }).merged.length).toBe(2);
    expect(draws(g)).toBe(2);
  });

  it('splits the batch by squares of ground, so what is out of sight can still be left undrawn', () => {
    const scene = new THREE.Scene(), views: THREE.Group[] = [];
    for (const x of [1, 5, 40, 90]) { const g = new THREE.Group(); g.position.x = x; g.add(box(red, 0)); scene.add(g); bake(g, { all: true }); views.push(g); }
    const before = seen(scene);
    new TownBatch(scene, { tile: 32 }).sync(views);
    expect(draws(scene)).toBe(3); // 1 and 5 share a square; 40 and 90 have one each
    expect(seen(scene)).toEqual(before);
  });

  it('makes the batch again when a heap is used up', () => {
    const scene = new THREE.Scene(), views = new Map<number, THREE.Group>();
    for (const x of [1, 5]) { const g = new THREE.Group(); g.position.x = x; g.add(box(red, 0), box(grey, 0, 1)); scene.add(g); bake(g, { all: true }); views.set(x, g); }
    const one = seen(views.get(1)!), batch = new TownBatch(scene, { tile: 32 });
    batch.sync(views.values());
    scene.remove(views.get(5)!); views.delete(5);
    expect(batch.sync(views.values())).toBe(true);
    expect(seen(scene)).toEqual(one);
  });
});

describe('foldFigure', () => {
  it('merges the still pieces on each bone into one coloured by vertex, and leaves what is shown and hidden', () => {
    const body = new THREE.Group(), head = new THREE.Bone(), hand = new THREE.Bone();
    head.position.y = 2; head.scale.setScalar(0.6); hand.position.x = 1;
    body.add(head, hand);
    const face = new THREE.Group(); face.position.z = 0.1; head.add(face);
    face.add(box(red, 0), box(grey, 0.3), box(new THREE.MeshStandardMaterial({ color: 0x203050 }), -0.3));
    const tool = box(grey, 0), helmet = box(red, 0, 0.5), spare = box(grey, 0, 0.4);
    hand.add(tool); head.add(helmet, spare); spare.visible = false;
    const before = seen(body);
    expect(foldFigure(body, { props: new Map([['hoe', tool]]), gear: [[helmet]], spare })).toBe(2);
    expect(seen(body)).toEqual(before);
    expect(draws(body)).toBe(3); // the face, the tool, the helmet
    expect(tool.parent).toBe(hand); expect(helmet.parent).toBe(head); expect(spare.parent).toBe(head);
    // The merged face rides the head bone: it moves with it.
    head.rotation.z = 1; const turned = seen(body);
    expect(turned).not.toEqual(before);
  });
});

describe('foldFigure, the skinned body', () => {
  /** A two-bone rig with three skinned meshes on it: two of one material (one bound through a skeleton of its own over the same bones), one of another. */
  function rig() {
    const body = new THREE.Group(), root = new THREE.Bone(), arm = new THREE.Bone();
    arm.position.y = 1; root.add(arm); body.add(root);
    body.updateMatrixWorld(true);
    const skel = new THREE.Skeleton([root, arm]), other = new THREE.Skeleton([arm, root]); // the same bones, in another order
    const skin = (mat: THREE.Material, s: THREE.Skeleton, bone: number, x: number): THREE.SkinnedMesh => {
      const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(x, 1, 0), n = geo.getAttribute('position').count;
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? bone : 0)), 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(0.5), 3));
      const m = new THREE.SkinnedMesh(geo, mat); body.add(m); m.bind(s); return m;
    };
    const a = skin(red, skel, 1, 0), b = skin(red, other, 0, 1), c = skin(grey, skel, 1, 2); // b's bone 0 is the arm
    return { body, arm, a, b, c };
  }
  /** Where every vertex of the skinned meshes is drawn, posed. */
  const posed = (root: THREE.Object3D): string[] => {
    root.updateMatrixWorld(true);
    const out: string[] = [], v = new THREE.Vector3();
    root.traverseVisible((o) => { const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh || !m.parent) return; m.skeleton.update(); const n = m.geometry.getAttribute('position').count; for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); out.push(`${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`); } });
    return out.sort();
  };

  it('merges those of one material on the same bones into one, posed the same, and hands the wounds the merged surface', () => {
    const { body, arm, a, b, c } = rig();
    const real = { props: new Map(), gear: [], spare: null, skins: [a, b, c], whole: [a.geometry, b.geometry, c.geometry] };
    arm.rotation.z = 0.8;
    const before = posed(body);
    expect(foldFigure(body, real)).toBe(1);
    const skins: THREE.SkinnedMesh[] = []; body.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh); });
    expect(skins.length).toBe(2);
    expect(posed(body)).toEqual(before);
    expect(real.skins.length).toBe(2);
    expect(real.skins).toContain(c);
    expect(real.whole).toEqual(real.skins.map((m) => m.geometry));
    // It can be culled now, with room for any pose.
    for (const m of skins) { expect(m.frustumCulled).toBe(true); expect(m.boundingSphere!.radius).toBeGreaterThan(0.5); }
  });

  it('shares the merged shape between figures made alike', () => {
    const one = rig(), two = rig();
    two.a.geometry = one.a.geometry; two.b.geometry = one.b.geometry;
    const real = () => ({ props: new Map(), gear: [], spare: null });
    foldFigure(one.body, real()); foldFigure(two.body, real());
    const merged = (r: THREE.Object3D) => { let g: THREE.BufferGeometry | null = null; r.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.userData.folded) g = (o as THREE.SkinnedMesh).geometry; }); return g; };
    expect(merged(one.body)).not.toBeNull();
    expect(merged(two.body)).toBe(merged(one.body));
  });

  it('lets an animal be culled', () => {
    const { body } = rig();
    cullBeast(body);
    body.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) expect(o.frustumCulled).toBe(true); });
  });
});
