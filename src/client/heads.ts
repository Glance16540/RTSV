// Sculpted heads. The figure the game animates (see person.ts) comes with a blank mannequin's head. These are the
// heads of the Universal Base Characters by Quaternius (CC0; see public/models/people/SOURCE.txt), cut out by
// scripts/heads.py: a man's and a woman's, each with a modelled face, ears, eyes and eyebrows, and a beard. Their
// skin is a picture of light, shade and blush only, multiplied here by whatever colour the person's skin is, so
// one head serves every people.
import * as THREE from 'three';

interface Piece { p: number[]; n: number[]; i: number[]; uv?: number[] }
/** One head, in the kit's own space: metres, +y up, +z the way the face looks. */
export interface Sculpt { skin: Piece; eyes: Piece; brows: Piece; /** The top of the skull. */ crown: number; /** The height of the eyes, and how far forward they stand. */ eyeY: number; eyeZ: number; half: number }

/** The heads of hair there are: two short cuts fitted to the man's head, and a short cut, long hair and buns fitted to the woman's. */
export type HairCut = 'parted' | 'buzzed' | 'buzzedF' | 'long' | 'buns';
let kit: { m: Sculpt; f: Sculpt; beard: Piece; hair: Record<HairCut, Piece> } | null = null;
const hairs = new Map<string, THREE.Material>();
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
    ...['head_m', 'head_f', 'eye', 'hair_1', 'hair_2'].map((k) => loader.loadAsync(`${base}${k}.webp`).then((t) => { t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; pics.set(k, t); })),
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
 * A head for one person: its skin in their colour, eyes, brows and hair in the colour of their hair, and a beard if
 * they wear one. `cut` is how the hair is worn, or null for none (under a helmet or a hood). Returned in the kit's
 * space with the measures needed to set it on a figure, or null if the heads never came.
 */
export function sculptedHead(female: boolean, skin: number, hair: number, beard: boolean, cut: HairCut | null): { g: THREE.Group; fig: Sculpt } | null {
  if (!kit) return null;
  const tag = female ? 'f' : 'm', fig = kit[tag], key = tag + skin;
  let sm = skins.get(key);
  // The picture is the face at half strength over its own average, so twice the person's colour gives it back in that colour.
  if (!sm) skins.set(key, (sm = new THREE.MeshStandardMaterial({ map: pics.get('head_' + tag), color: new THREE.Color(skin).multiply(new THREE.Color(2.2, 2.08, 2.0)), roughness: 0.85 })));
  eyeMat ??= new THREE.MeshStandardMaterial({ map: pics.get('eye'), roughness: 0.25 });
  // Hair is the same: a picture of the strands in light and shade, under the person's own colour. There are two sheets of it.
  const strands = (sheet: 1 | 2): THREE.Material => {
    const k = sheet + '|' + hair;
    let m = hairs.get(k);
    if (!m) hairs.set(k, (m = new THREE.MeshStandardMaterial({ map: pics.get('hair_' + sheet), color: new THREE.Color(hair).multiplyScalar(2), roughness: 0.8, side: THREE.DoubleSide })));
    return m;
  };
  const g = new THREE.Group();
  const add = (k: string, piece: Piece, m: THREE.Material): void => { const mesh = new THREE.Mesh(geo(k, piece), m); mesh.castShadow = true; g.add(mesh); };
  add('skin' + tag, fig.skin, sm);
  add('eyes' + tag, fig.eyes, eyeMat);
  add('brows' + tag, fig.brows, strands(female ? 2 : 1));
  if (beard && !female) add('beard', kit.beard, strands(1));
  if (cut) add('hair' + cut, kit.hair[cut], strands(cut === 'long' || cut === 'buns' ? 2 : 1));
  return { g, fig };
}
