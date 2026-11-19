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
/** Eye colours: the kit's own brown, a darker brown, grey-blue, green and hazel. Null leaves the picture as it came. */
const EYES: (number | null)[] = [null, 0x3a2414, 0x5f7f9a, 0x5a7a48, 0x7a6230, null, 0x3a2414];
const eyeMats = new Map<number, THREE.Material>();
/** The eye's picture with its iris turned to another colour: wherever the picture has colour, that colour is replaced, light for light. */
function eyes(k: number): THREE.Material {
  let m = eyeMats.get(k);
  if (m) return m;
  let map = pics.get('eye')!;
  const tone = EYES[k], img = map.image as HTMLImageElement | undefined;
  if (tone != null && img && typeof document !== 'undefined') {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const x = cv.getContext('2d');
    if (x) {
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, cv.width, cv.height), a = d.data, t = new THREE.Color(tone), tl = Math.max(0.05, (t.r + t.g + t.b) / 3);
      for (let i = 0; i < a.length; i += 4) {
        const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
        if (sat < 0.25) continue; // the white of the eye, the pupil and the glint are left alone
        const l = ((r + g + b) / 3 / 0.3) * 0.5, w = Math.min(1, (sat - 0.25) / 0.2);
        a[i] = 255 * Math.min(1, r + (Math.min(1, (t.r / tl) * l) - r) * w); a[i + 1] = 255 * Math.min(1, g + (Math.min(1, (t.g / tl) * l) - g) * w); a[i + 2] = 255 * Math.min(1, b + (Math.min(1, (t.b / tl) * l) - b) * w);
      }
      x.putImageData(d, 0, 0);
      map = new THREE.CanvasTexture(cv);
      map.flipY = false; map.colorSpace = THREE.SRGBColorSpace;
    }
  }
  eyeMats.set(k, (m = new THREE.MeshStandardMaterial({ map, roughness: 0.25 })));
  return m;
}

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

/**
 * The casts of face there are. One sculpted face would make every man a twin of every other, so the lower face is
 * reshaped a little for each cast: how wide the jaw is, how long the chin, how far the nose stands out and how broad it is.
 */
const CASTS: { jaw: number; chin: number; nose: number; wide: number; cheek?: number }[] = [
  { jaw: 0, chin: 0, nose: 0, wide: 0 },
  { jaw: -0.085, chin: 0.007, nose: 0.003, wide: -0.1 },
  { jaw: 0.075, chin: -0.004, nose: 0.001, wide: 0.16 },
  { jaw: -0.03, chin: 0.003, nose: 0.007, wide: 0.05 },
  { jaw: 0.045, chin: 0.006, nose: -0.002, wide: -0.06 },
];
export const FACE_CASTS = CASTS.length;
const ease = (a: number, b: number, v: number): number => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Reshape one piece of a head (its skin, or the beard that lies on it) to a cast of face. */
function recast(p: number[], fig: Sculpt, c: (typeof CASTS)[number]): Float32Array {
  const out = new Float32Array(p);
  for (let i = 0; i < out.length; i += 3) {
    let x = out[i], y = out[i + 1], z = out[i + 2];
    const front = ease(fig.eyeZ - 0.09, fig.eyeZ - 0.03, z);
    x *= 1 + c.jaw * ease(fig.eyeY - 0.035, fig.eyeY - 0.1, y) * (0.4 + 0.6 * front);
    y -= c.chin * ease(fig.eyeY - 0.08, fig.eyeY - 0.13, y) * front;
    const nose = Math.exp(-((x / 0.024) ** 2 + ((y - (fig.eyeY - 0.04)) / 0.032) ** 2)) * ease(fig.eyeZ - 0.02, fig.eyeZ + 0.012, z);
    z += c.nose * nose; x *= 1 + c.wide * nose;
    if (c.cheek) { const puff = Math.exp(-(((Math.abs(x) - 0.042) / 0.022) ** 2 + ((y - (fig.eyeY - 0.05)) / 0.03) ** 2)) * front; x += Math.sign(x) * c.cheek * puff; z += c.cheek * 0.7 * puff; }
    out[i] = x; out[i + 1] = y; out[i + 2] = z;
  }
  return out;
}

/**
 * The upper face is cast separately, so that the two together make many faces from one: how far apart the eyes are
 * set and how large they are, how broad the cheekbones, how heavy the ridge of the brow, and the brows themselves,
 * higher or lower, arched or level, heavy or fine.
 */
const UPPERS: { set: number; cheek: number; ridge: number; eye: number; up: number; tilt: number; thick: number }[] = [
  { set: 0, cheek: 0, ridge: 0, eye: 1, up: 0, tilt: 0, thick: 1 },
  { set: 0.0026, cheek: 0.055, ridge: 0.003, eye: 0.93, up: -0.0016, tilt: -0.07, thick: 1.3 },
  { set: -0.0022, cheek: -0.045, ridge: -0.0012, eye: 1.08, up: 0.0022, tilt: 0.06, thick: 0.72 },
  { set: 0.0012, cheek: 0.075, ridge: 0, eye: 1.02, up: 0.0012, tilt: 0.11, thick: 0.9 },
  { set: -0.0012, cheek: -0.02, ridge: 0.0022, eye: 0.96, up: -0.001, tilt: -0.035, thick: 1.12 },
];
/** Recast the upper face of one piece of a head: its skin, its eyes or its brows, each moved by the same rule so they stay together. */
function upper(out: Float32Array, fig: Sculpt, u: (typeof UPPERS)[number], kind: 'skin' | 'eyes' | 'brows'): Float32Array {
  let mx = 0, my = 0, mz = 0, lo = Infinity, hi = -Infinity;
  for (let i = 0; i < out.length; i += 3) {
    let x = out[i]; const y = out[i + 1]; let z = out[i + 2];
    const side = Math.sign(x) || 1, ax = Math.abs(x), front = ease(fig.eyeZ - 0.09, fig.eyeZ - 0.03, z);
    x += side * u.set * Math.exp(-(((ax - 0.033) / 0.03) ** 2 + ((y - fig.eyeY) / 0.028) ** 2)) * front;
    x *= 1 + u.cheek * Math.exp(-(((y - (fig.eyeY - 0.028)) / 0.028) ** 2)) * ease(0.02, 0.06, ax) * front;
    if (kind !== 'eyes') z += u.ridge * Math.exp(-(((y - (fig.eyeY + 0.02)) / 0.014) ** 2)) * front;
    out[i] = x; out[i + 2] = z;
    mx += Math.abs(x); my += y; mz += z; lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  const n = out.length / 3; mx /= n; my /= n; mz /= n;
  if (kind === 'eyes') for (let i = 0; i < out.length; i += 3) {
    const side = Math.sign(out[i]) || 1;
    out[i] = side * mx + (out[i] - side * mx) * u.eye; out[i + 1] = my + (out[i + 1] - my) * u.eye; out[i + 2] = mz + (out[i + 2] - mz) * u.eye - (u.eye - 1) * 0.012;
  }
  if (kind === 'brows') { const mid = (lo + hi) / 2; for (let i = 0; i < out.length; i += 3) out[i + 1] = mid + (out[i + 1] - mid) * u.thick + u.up + u.tilt * (Math.abs(out[i]) - 0.035); }
  return out;
}

/**
 * The build of a head, under the casts above: one sculpted head per sex made every face plainly kin, however its
 * jaw, nose and brows were recast. So each head is first given a build, the whole of it moved together (skin, eyes,
 * brows, beard and hair, so that the hair still fits): an even head as the kit has it, a broad one, a narrow one, a
 * long one and a round one. Which builds a people runs to is its own (`BUILDS_OF`); which of them a person has is by lot.
 */
const BUILDS: { wide: number; jaw: number; long: number; top: number; deep: number }[] = [
  { wide: 0, jaw: 0, long: 0, top: 0, deep: 0 }, // even
  { wide: 0.14, jaw: 0.13, long: -0.06, top: -0.03, deep: 0.04 }, // broad, square in the jaw
  { wide: -0.13, jaw: -0.07, long: 0.07, top: 0.03, deep: -0.02 }, // narrow
  { wide: -0.06, jaw: -0.04, long: 0.18, top: 0.05, deep: 0.05 }, // long
  { wide: 0.11, jaw: -0.05, long: -0.12, top: -0.02, deep: 0.07 }, // round
];
export const HEAD_BUILDS = BUILDS.length;
/** How often each people's heads take each build (even, broad, narrow, long, round); a people not here takes each alike. */
const BUILDS_OF: Record<string, number[]> = {
  hearth: [3, 3, 1, 2, 1], england: [2, 1, 3, 3, 1], stonekin: [3, 3, 1, 1, 2], greece: [3, 1, 2, 3, 1], dawn: [2, 1, 3, 3, 1],
  arabs: [2, 1, 3, 3, 1], mali: [2, 3, 1, 3, 1], egypt: [2, 1, 3, 3, 1], kush: [2, 2, 2, 3, 1], babylon: [3, 3, 1, 1, 2],
  persia: [3, 1, 2, 3, 1], japan: [3, 1, 1, 1, 4], forge: [3, 1, 1, 1, 4], steppe: [2, 3, 1, 0, 4], wild: [2, 4, 1, 3, 0],
};
/** A person's build, by their people and by lot. */
export function buildOf(civ: string | undefined, seed: number): number {
  const w = BUILDS_OF[civ ?? ''] ?? BUILDS.map(() => 1), sum = w.reduce((a, b) => a + b, 0);
  let r = (Math.abs(Math.imul(seed ^ 0x5bd1e995, 0x27d4eb2d) >> 9) % 1000) / 1000 * sum;
  for (let i = 0; i < w.length; i++) { if ((r -= w[i]) < 0) return i; }
  return 0;
}
/** Give a piece of a head its build: every piece by the same rule, by height alone, so they stay together. */
function built(out: Float32Array, fig: Sculpt, b: (typeof BUILDS)[number]): Float32Array {
  const cz = fig.eyeZ - 0.09;
  for (let i = 0; i < out.length; i += 3) {
    const y = out[i + 1], low = ease(fig.eyeY + 0.02, fig.eyeY - 0.1, y);
    out[i] *= 1 + b.wide * (0.45 + 0.55 * low) + b.jaw * low * low;
    out[i + 1] = fig.eyeY + (y - fig.eyeY) * (1 + (y < fig.eyeY ? b.long : b.top));
    out[i + 2] = cz + (out[i + 2] - cz) * (1 + b.deep);
  }
  return out;
}
/** Years on a grown face (0 young, 1 in middle life, 2 older): the jowls a little fuller and lower, the nose a little longer. Never a child's. */
function aged(out: Float32Array, fig: Sculpt, years: number): Float32Array {
  if (!years) return out;
  for (let i = 0; i < out.length; i += 3) {
    const x = out[i], y = out[i + 1], z = out[i + 2], front = ease(fig.eyeZ - 0.09, fig.eyeZ - 0.03, z);
    const jowl = Math.exp(-(((Math.abs(x) - 0.04) / 0.022) ** 2 + ((y - (fig.eyeY - 0.105)) / 0.022) ** 2)) * front;
    out[i] += Math.sign(x) * 0.005 * years * jowl; out[i + 1] -= 0.004 * years * jowl;
    const nose = Math.exp(-((x / 0.02) ** 2 + ((y - (fig.eyeY - 0.045)) / 0.03) ** 2)) * ease(fig.eyeZ - 0.02, fig.eyeZ + 0.012, z);
    out[i + 1] -= 0.0018 * years * nose; out[i + 2] += 0.0012 * years * nose;
  }
  return out;
}

/**
 * A head for one person: its skin in their colour, eyes, brows and hair in the colour of their hair, and a beard if
 * they wear one. `cut` is how the hair is worn, or null for none (under a helmet or a hood). Returned in the kit's
 * space with the measures needed to set it on a figure, or null if the heads never came.
 */
function geo(key: string, piece: Piece, shaped?: Float32Array): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(shaped ?? piece.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(piece.n, 3));
    if (piece.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(piece.uv, 2));
    g.setIndex(piece.i);
    geos.set(key, g);
  }
  return g;
}

export function sculptedHead(female: boolean, skin: number, hair: number, beard: boolean, cut: HairCut | null, seed = 0, opts: { civ?: string } = {}): { g: THREE.Group; fig: Sculpt } | null {
  if (!kit) return null;
  const tag = female ? 'f' : 'm', fig = kit[tag], key = tag + skin;
  let sm = skins.get(key);
  // The picture is the face at half strength over its own average, so twice the person's colour gives it back in that colour.
  if (!sm) skins.set(key, (sm = new THREE.MeshStandardMaterial({ map: pics.get('head_' + tag), color: new THREE.Color(skin).multiply(new THREE.Color(2.2, 2.08, 2.0)), roughness: 0.85 })));
  const cast = Math.abs(seed >> 3) % CASTS.length, shape = CASTS[cast];
  // The upper face goes by other figures of the same number, so that it does not march in step with the lower.
  const up = Math.abs(seed * 13 + 5) % UPPERS.length, brow = UPPERS[up];
  // The build of the whole head, by the person's people and by lot; and the years on it, by lot, among the grown.
  const bi = buildOf(opts.civ, seed), build = BUILDS[bi], years = Math.abs(seed >> 11) % 3;
  // Hair is the same: a picture of the strands in light and shade, under the person's own colour. There are two sheets of it.
  const strands = (sheet: 1 | 2): THREE.Material => {
    const k = sheet + '|' + hair;
    let m = hairs.get(k);
    if (!m) hairs.set(k, (m = new THREE.MeshStandardMaterial({ map: pics.get('hair_' + sheet), color: new THREE.Color(hair).multiplyScalar(2), roughness: 0.8, side: THREE.DoubleSide })));
    return m;
  };
  const g = new THREE.Group();
  const add = (k: string, piece: Piece, m: THREE.Material, kind: 'hair' | 'skin' | 'eyes' | 'brows' | 'beard'): void => {
    const lower = kind === 'skin' || kind === 'beard';
    const key = kind === 'hair' ? `${k}|b${bi}` : `${k}|${tag}${lower ? cast : ''}u${kind === 'beard' ? 0 : up}b${bi}${lower ? `a${years}` : ''}`;
    let shaped: Float32Array | undefined;
    if (!geos.has(key)) {
      shaped = lower && cast ? recast(piece.p, fig, shape) : new Float32Array(piece.p);
      if (lower) aged(shaped, fig, years);
      if (kind !== 'beard' && kind !== 'hair' && up) upper(shaped, fig, brow, kind);
      if (bi) built(shaped, fig, build);
    }
    const mesh = new THREE.Mesh(geo(key, piece, shaped), m);
    mesh.castShadow = true; g.add(mesh);
  };
  add('skin' + tag, fig.skin, sm, 'skin');
  add('eyes' + tag, fig.eyes, eyes(Math.abs(seed) % EYES.length), 'eyes'); add('brows' + tag, fig.brows, strands(female ? 2 : 1), 'brows');
  if (beard && !female) add('beard', kit.beard, strands(1), 'beard');
  if (cut) add('hair' + cut + tag, kit.hair[cut], strands(cut === 'long' || cut === 'buns' ? 2 : 1), 'hair');
  return { g, fig };
}
