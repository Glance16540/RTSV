// Sculpted heads. The figure the game animates (see person.ts) comes with a blank mannequin's head. These are the
// heads of the Universal Base Characters by Quaternius (CC0; see public/models/people/SOURCE.txt), cut out by
// scripts/heads.py: a man's and a woman's, each with a modelled face, ears, eyes and eyebrows, and a beard. Their
// skin is a picture of light, shade and blush only, multiplied here by whatever colour the person's skin is, so
// one head serves every people.
import * as THREE from 'three';

interface Piece { p: number[]; n: number[]; i: number[]; uv?: number[] }
/** One head, in the kit's own space: metres, +y up, +z the way the face looks. */
export interface Sculpt { skin: Piece; eyes: Piece; brows: Piece; /** The top of the skull. */ crown: number; /** The height of the eyes, and how far forward they stand. */ eyeY: number; eyeZ: number; half: number }

let kit: { m: Sculpt; f: Sculpt; beard: Piece } | null = null;
let asked = false, settled = false;
const waiting: (() => void)[] = [];
const pics = new Map<string, THREE.Texture>();
const geos = new Map<string, THREE.BufferGeometry>();
const skins = new Map<string, THREE.Material>();
let eyeMat: THREE.Material | null = null;

/** Starts fetching the heads. `then` runs when they are here, or when it is plain they are not coming. */
export function loadHeads(then: () => void): void {
  if (settled) { then(); return; }
  waiting.push(then);
  if (asked) return;
  asked = true;
  const base = `${import.meta.env.BASE_URL}models/people/`;
  const done = (): void => { settled = true; for (const w of waiting.splice(0)) w(); };
  // The pictures are waited for too, so nobody is ever drawn with a blank black head.
  const loader = new THREE.TextureLoader();
  Promise.all([
    fetch(base + 'heads.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('no heads')))),
    ...['head_m', 'head_f', 'eye'].map((k) => loader.loadAsync(`${base}${k}.webp`).then((t) => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; pics.set(k, t); })),
  ]).then(([j]) => { kit = j; done(); }).catch(done);
}
export const headsReady = (): boolean => !!kit;

function geo(key: string, piece: Piece): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(piece.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(piece.n, 3));
    if (piece.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(piece.uv, 2));
    g.setIndex(piece.i);
    geos.set(key, g);
  }
  return g;
}

/**
 * A head for one person: its skin in their colour, eyes, brows in the colour of their hair, and a beard if they
 * wear one. Returned in the kit's space with the measures needed to set it on a figure, or null if the heads never came.
 */
export function sculptedHead(female: boolean, skin: number, hair: THREE.Material, beard: boolean): { g: THREE.Group; fig: Sculpt } | null {
  if (!kit) return null;
  const tag = female ? 'f' : 'm', fig = kit[tag], key = tag + skin;
  let sm = skins.get(key);
  // The picture is the face at half strength over its own average, so twice the person's colour gives it back in that colour.
  if (!sm) skins.set(key, (sm = new THREE.MeshStandardMaterial({ map: pics.get('head_' + tag), color: new THREE.Color(skin).multiply(new THREE.Color(2.2, 2.08, 2.0)), roughness: 0.85 })));
  eyeMat ??= new THREE.MeshStandardMaterial({ map: pics.get('eye'), roughness: 0.25 });
  const g = new THREE.Group();
  const add = (k: string, piece: Piece, m: THREE.Material): void => { const mesh = new THREE.Mesh(geo(k, piece), m); mesh.castShadow = true; g.add(mesh); };
  add('skin' + tag, fig.skin, sm);
  add('eyes' + tag, fig.eyes, eyeMat);
  add('brows' + tag, fig.brows, hair);
  if (beard && !female) add('beard', kit.beard, hair);
  return { g, fig };
}
