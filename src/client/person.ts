// People drawn from a real human figure with a skeleton and recorded motion, in place of the figures assembled
// from blocks. The body and its motions are the Universal Animation Library mannequin by Quaternius (CC0; see
// public/models/people/SOURCE.txt). It comes bare and grey. Here it is given a man's or a woman's shape, painted
// (skin, cloth, mail) by which bone moves each part, and dressed in separate pieces: skirts and tunics that hang
// from the hips and swing with the legs, hair, a face, helmets, breastplates, shields, weapons and tools.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** How tall a man stands in the game's units; the model is 1.83 of its own. */
const SCALE = 1.02 / 1.83;

interface Marks { head: THREE.Box3; /** The middle of the flesh each bone carries: the line a limb is thickened about. */ mid: Map<string, THREE.Vector3> }
let source: { scene: THREE.Object3D; clips: Map<string, THREE.AnimationClip>; marks: Marks } | null = null;
let failed = false;
const waiting: (() => void)[] = [];

/** Starts fetching the figure. `then` runs once it can be used. */
export function loadPeople(then?: () => void): void {
  if (source) { then?.(); return; }
  if (then) waiting.push(then);
  if (waiting.length > 1 || failed) return;
  new GLTFLoader().load(`${import.meta.env.BASE_URL}models/people/human.json`, (g) => {
    const clips = new Map<string, THREE.AnimationClip>();
    for (const c of g.animations) {
      // The figure is moved over the ground by the game, not by the recording.
      // And only the turning of each joint is taken from it (with the rise and fall of the hips), so the bones'
      // lengths and places are free to be set per person: narrow shoulders, small hands and so on.
      c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'DEF-hips.position');
      clips.set(c.name, c);
    }
    // Where the head is, to fit hair, a face and helmets to it.
    const head = new THREE.Box3(), p = new THREE.Vector3(), sums = new Map<string, { v: THREE.Vector3; n: number }>();
    g.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const pos = m.geometry.getAttribute('position'), si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight');
      const hi = m.skeleton.bones.findIndex((b) => b.name === 'DEF-head');
      for (let i = 0; i < pos.count; i++) for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k), bi = si.getComponent(i, k);
        if (bi === hi && w > 0.9) head.expandByPoint(p.fromBufferAttribute(pos, i));
        if (w > 0.6) { const name = m.skeleton.bones[bi].name; let t = sums.get(name); if (!t) sums.set(name, (t = { v: new THREE.Vector3(), n: 0 })); t.v.add(p.fromBufferAttribute(pos, i)); t.n++; }
      }
    });
    const mid = new Map<string, THREE.Vector3>();
    for (const [name, t] of sums) mid.set(name, t.v.divideScalar(t.n));
    source = { scene: g.scene, clips, marks: { head, mid } };
    for (const w of waiting.splice(0)) w();
  }, undefined, () => { failed = true; });
}
export const peopleReady = (): boolean => !!source;

export interface RealPerson {
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  now: string;
  body: THREE.Object3D;
  bones: Map<string, THREE.Object3D>;
  /** Each bone as this person stands at rest, with their own proportions. */
  rest: Map<string, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>;
  palm: THREE.Vector3;
  tool: THREE.Object3D | null;
  toolKind: string;
  /** Seconds of a blow still to play, and whether a blow was under way last frame. */
  strike: number;
  struck: boolean;
  soldier: boolean;
}

/** What someone wears and carries. */
export interface Outfit {
  female: boolean;
  /** Build: 0 slight, 1 average, 2 heavy; and the chest, 0 small to 2 full (a woman's bust, a man's breadth). */
  girth: 0 | 1 | 2; chest: 0 | 1 | 2;
  skin: number; hair: number; seed: number;
  /** Cloth on the body and arms; `mail` paints them as ring mail instead. */
  top: number; mail?: boolean; sleeves: 'bare' | 'short' | 'long';
  /** 0 a closed collar, 1 open at the throat, 2 cut low. */
  neck: 0 | 1 | 2;
  legs: number;
  /** The skirt of a tunic or a dress: how far down it hangs, and its colour. */
  skirt: 'none' | 'short' | 'long'; skirtColor: number;
  hairStyle: 'short' | 'long' | 'bun' | 'covered';
  beard: boolean;
  helmet: '' | 'leather' | 'bronze' | 'iron' | 'kettle';
  plate: boolean;
  shield: number | null;
  weapon: '' | 'club' | 'spear' | 'sword' | 'pike';
}

const UNITS_DRAWN = new Set(['villager', 'clubman', 'spearman', 'swordsman', 'pikeman']);
/** Is this kind of unit drawn from the real figure yet? */
export const drawnReal = (type: string): boolean => UNITS_DRAWN.has(type);

/** The dress of each unit drawn this way. `wear` is how a village woman's town dresses her: 1 covered, 2 and 3 freer. */
export function outfitFor(type: string, female: boolean, color: number, look: { skin: number; hair: number }, seed: number, wear: number): Outfit {
  const s = Math.abs(seed | 0);
  const pick = (k: number): 0 | 1 | 2 => ([1, 0, 1, 2, 1, 1, 2, 0, 1][(s >> k) % 9] as 0 | 1 | 2);
  const fighter = type !== 'villager';
  const base: Outfit = { female, girth: fighter ? (Math.max(1, pick(2)) as 1 | 2) : pick(2), chest: fighter ? 2 : pick(5), skin: look.skin, hair: look.hair, seed: s, top: color, sleeves: 'short', neck: 0, legs: [0x6a5238, 0x54483c, 0x7a6a4c, 0x4a4238][s % 4], skirt: 'short', skirtColor: color, hairStyle: 'short', beard: !female && s % 3 === 0, helmet: '', plate: false, shield: null, weapon: '' };
  if (type === 'villager') {
    if (!female) return { ...base, sleeves: s % 3 === 1 ? 'long' : 'short', neck: 1 };
    return { ...base, skirt: 'long', legs: 0xd8cdb8, sleeves: wear === 1 ? 'long' : wear >= 2 ? 'bare' : 'short', neck: wear === 3 ? 2 : wear === 2 ? 1 : 0, hairStyle: wear === 1 ? 'covered' : s % 2 ? 'long' : 'bun' };
  }
  if (type === 'clubman') return { ...base, top: 0x8a6a48, sleeves: 'bare', neck: 1, legs: look.skin, weapon: 'club', beard: s % 2 === 0 };
  if (type === 'spearman') return { ...base, top: 0x7a5232, sleeves: 'short', helmet: 'bronze', shield: color, weapon: 'spear' };
  if (type === 'swordsman') return { ...base, mail: true, sleeves: 'long', helmet: 'iron', shield: color, weapon: 'sword' };
  return { ...base, mail: true, sleeves: 'long', helmet: 'kettle', plate: true, weapon: 'pike' };
}

const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
const drape = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
cloth.userData.outlineParameters = drape.userData.outlineParameters = { visible: false };
const solids = new Map<string, THREE.MeshStandardMaterial>();
function solid(color: number, metal = 0): THREE.MeshStandardMaterial {
  const key = color + '|' + metal;
  let m = solids.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.45 : 0.9, metalness: metal ? 0.3 : 0 }); // little metalness: with no sky to mirror, true metal draws black
    m.userData.outlineParameters = { visible: false };
    solids.set(key, m);
  }
  return m;
}
const geos = new Map<string, THREE.BufferGeometry>();
const geo = (key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry => { let g = geos.get(key); if (!g) geos.set(key, (g = make())); return g; };
function part(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}
const bump = (v: number, at: number, wide: number): number => Math.max(0, 1 - ((v - at) / wide) ** 2);

const painted = new Map<string, THREE.BufferGeometry[]>();
/** Shape one piece of the body as a man's or a woman's, and colour it by which bone moves each point. */
function paint(src: THREE.BufferGeometry, bones: string[], o: Outfit): THREE.BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  const col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const skin = new THREE.Color(o.skin), hair = new THREE.Color(o.hair), top = new THREE.Color(o.mail ? 0x8a8f96 : o.top), legs = new THREE.Color(o.legs);
  const boot = new THREE.Color(0x4a3222), belt = new THREE.Color(0x3a2616), lip = skin.clone().lerp(new THREE.Color(0xb04a48), 0.45);
  const mids = source!.marks.mid, headMid = source!.marks.head.getCenter(new THREE.Vector3()).y, headHalf = source!.marks.head.getSize(new THREE.Vector3()).y / 2;
  const collar = o.neck === 2 ? 1.34 : o.neck === 1 ? 1.42 : 1.5; // how high the cloth comes on the chest
  for (let i = 0; i < pos.count; i++) {
    // The bone with the most say over this point.
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const bone = bones[best] ?? '';
    let x = pos.getX(i), z = pos.getZ(i);
    const y = pos.getY(i);
    let ny = y;
    const fat = [-0.07, 0, 0.13][o.girth]; // how much thicker than the bare figure
    if (/spine|hips/.test(bone) || (/thigh/.test(bone) && y > 0.8)) {
      if (o.female) {
        // A woman's trunk: a smaller ribcage, drawn well in at the waist, wide at the hip, fuller at the breast.
        const waist = bump(y, 1.13, 0.16), hip = bump(y, 0.9, 0.2), ribs = Math.min(1, Math.max(0, (y - 1.18) / 0.12));
        x *= 1 - waist * 0.2 + hip * 0.14 - ribs * 0.1; z *= 1 - waist * 0.14 + hip * 0.1 - ribs * 0.06;
        if (z > 0.02) z += [0.022, 0.04, 0.06][o.chest] * bump(y, 1.33, 0.085) * bump(Math.abs(x), 0.07, 0.078);
      } else {
        // A man's: from narrow to deep-chested and broad across the back.
        const k = 0.04 + [-0.04, 0.02, 0.08][o.chest] * bump(y, 1.36, 0.2);
        x *= 1 + k; z *= 1 + k * 1.2;
      }
      // Weight is carried round the middle, and most in front.
      x *= 1 + fat * 0.8; z *= 1 + fat * 0.8;
      if (z > 0 && fat > 0) z += fat * 0.45 * bump(y, 1.1, 0.2) * bump(x, 0, 0.2);
    } else if (/upper_arm|forearm|thigh|shin/.test(bone)) {
      // Limbs thicken about their own middle line: arms lie along x at rest, legs stand along y.
      const m = mids.get(bone), k = 1 + fat * (/forearm|shin/.test(bone) ? 0.55 : 0.9) + (o.female ? (/arm/.test(bone) ? -0.16 : /shin/.test(bone) ? -0.08 : 0.04) : /upper_arm/.test(bone) ? 0.05 + [-0.03, 0.02, 0.07][o.chest] : 0.03);
      if (m && /arm/.test(bone)) { ny = m.y + (y - m.y) * k; z = m.z + (z - m.z) * k; }
      else if (m) { x = m.x + (x - m.x) * k; z = m.z + (z - m.z) * k; }
    } else if (/neck/.test(bone)) { const k = 1 + fat * 0.6 + (o.female ? -0.14 : 0.08); x *= k; z *= k; }
    else if (/shoulder/.test(bone)) x *= o.female ? 0.88 : 1.03;
    else if (/head/.test(bone)) {
      // The jaw: tapered to a small chin on a woman, square on a man.
      const t = Math.min(1, Math.max(0, (headMid - y) / headHalf));
      x *= o.female ? 1 - t * 0.16 : 1 + t * 0.05;
      if (o.female && z > 0) z *= 1 - t * 0.05;
    }
    pos.setXYZ(i, x, ny, z);
    let mailed = false;
    if (/head/.test(bone)) c.copy(y > 1.72 || (z < 0.0 && y > 1.6) ? hair : o.female && z > 0.06 && y > 1.615 && y < 1.632 && Math.abs(x) < 0.025 ? lip : skin);
    else if (/neck/.test(bone)) c.copy(skin);
    else if (/hand|thumb|f_/.test(bone)) c.copy(skin);
    else if (/forearm/.test(bone)) { c.copy(o.sleeves === 'long' ? top : skin); mailed = o.sleeves === 'long'; }
    else if (/upper_arm/.test(bone)) { c.copy(o.sleeves === 'bare' ? skin : top); mailed = o.sleeves !== 'bare'; }
    else if (/spine|hips|shoulder/.test(bone)) {
      // The neckline dips in the middle of the chest and shows skin above it.
      const bare = y > collar + Math.min(0.1, Math.abs(x) * 0.9) && z > -0.02 && !/shoulder/.test(bone);
      c.copy(bare ? skin : y > 1.0 && y < 1.05 ? belt : top);
      mailed = !bare;
    }
    else if (/thigh/.test(bone)) c.copy(legs);
    else if (/shin/.test(bone)) c.copy(y < 0.26 ? boot : legs);
    else if (/foot|toe/.test(bone)) c.copy(boot);
    else c.copy(top);
    // Cloth is not one flat colour, and mail glints ring by ring.
    const h = (((i * 2654435761) >>> 0) % 100) / 100, n = o.mail && mailed ? 0.78 + h * 0.44 : 0.94 + h * 0.12;
    col[i * 3] = c.r * n; col[i * 3 + 1] = c.g * n; col[i * 3 + 2] = c.b * n;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A skirt hung from the hips: the top of it moves with the hips, and each side further down swings with the thigh
 * behind it, so it parts and closes as the legs stride.
 */
function skirt(body: THREE.SkinnedMesh, long: boolean, female: boolean, color: number, girth: number, apron: boolean): THREE.SkinnedMesh {
  const linen = new THREE.Color(0xe2d8c0);
  const wide = 1 + [-0.06, 0, 0.13][girth];
  const names = body.skeleton.bones.map((b) => b.name);
  const hips = names.indexOf('DEF-hips'), tl = names.indexOf('DEF-thighL'), tr = names.indexOf('DEF-thighR');
  const top = 1.06, hem = long ? 0.13 : 0.68, rings = long ? 9 : 5, seg = 18;
  const P: number[] = [], C: number[] = [], SI: number[] = [], SW: number[] = [], I: number[] = [];
  const base = new THREE.Color(color), trim = base.clone().multiplyScalar(0.68);
  for (let r = 0; r <= rings; r++) {
    const f = r / rings, y = top + (hem - top) * f;
    // Close at the waist, over the hips, then flaring to the hem.
    const hipK = bump(y, 0.9, 0.2) * Math.min(1, f * (long ? 9 : 5)); // the waistband sits close; the cloth stands off below it
    const rx = (female ? 0.118 : 0.156) + hipK * (female ? 0.115 : 0.055) + f * (long ? 0.15 : 0.035), rz = (female ? 0.1 : 0.112) + hipK * 0.06 + f * (long ? 0.15 : 0.03);
    const leg = Math.min(1, Math.max(0, (0.98 - y) / 0.22)) * (long ? 0.6 : 0.85); // how much of this ring the legs carry
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2, fold = 1 + (long ? Math.sin(a * 7) * 0.035 * f : 0);
      const x = Math.cos(a) * rx * fold * wide, z = 0.012 + Math.sin(a) * rz * fold * wide * (Math.sin(a) > 0 && girth === 2 ? 1.28 : 1);
      P.push(x, y, z);
      const c = apron && Math.sin(a) > 0.62 && r > 0 && r < rings - 1 ? linen : r === rings ? trim : base, n = 0.92 + ((s * 7 + r * 3) % 5) * 0.03;
      C.push(c.r * n, c.g * n, c.b * n);
      const wl = Math.min(1, Math.max(0, 0.5 + x / 0.14));
      SI.push(hips, tl, tr, 0); SW.push(1 - leg, leg * wl, leg * (1 - wl), 0);
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) {
    const a = r * seg + s, b = r * seg + ((s + 1) % seg), c2 = a + seg, d = b + seg;
    I.push(a, c2, b, b, c2, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  g.setIndex(I);
  g.computeVertexNormals();
  const m = new THREE.SkinnedMesh(g, drape);
  m.bind(body.skeleton, body.bindMatrix);
  m.castShadow = true;
  m.frustumCulled = false;
  return m;
}

/** Things held in the right hand. Each is made lying along +z from the grip, which is how a hanging hand holds it. */
function held(kind: string): THREE.Object3D | null {
  const g = new THREE.Group();
  const wood = solid(0x7a5a36), iron = solid(0x9a9ea6, 0.7);
  const rod = (len: number, r: number, from: number, m: THREE.Material) => part(geo(`rod${len}|${r}`, () => new THREE.CylinderGeometry(r, r, len, 6).rotateX(Math.PI / 2)), m, 0, 0, from + len / 2);
  const block = (w: number, h: number, d: number, z: number, m: THREE.Material, y = 0) => part(geo(`blk${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), m, 0, y, z);
  if (kind === 'axe') g.add(rod(0.62, 0.014, -0.1, wood), block(0.02, 0.16, 0.1, 0.46, iron, -0.05));
  else if (kind === 'pick') g.add(rod(0.64, 0.014, -0.1, wood), block(0.03, 0.36, 0.035, 0.52, iron));
  else if (kind === 'hammer') g.add(rod(0.4, 0.013, -0.08, wood), block(0.07, 0.12, 0.07, 0.3, iron));
  else if (kind === 'hoe') g.add(rod(0.9, 0.013, -0.2, wood), block(0.11, 0.1, 0.015, 0.7, iron, -0.05));
  else if (kind === 'club') g.add(part(geo('club', () => new THREE.CylinderGeometry(0.05, 0.018, 0.66, 7).rotateX(-Math.PI / 2)), solid(0x6a4a2c), 0, 0, 0.25));
  else if (kind === 'sword') g.add(rod(0.14, 0.014, -0.07, solid(0x4a3222)), block(0.14, 0.02, 0.025, 0.08, solid(0xb08a3a, 0.7)), block(0.045, 0.01, 0.62, 0.4, solid(0xc8ccd4, 0.85)));
  else if (kind === 'spear' || kind === 'pike') {
    const len = kind === 'pike' ? 2.5 : 1.7;
    g.add(rod(len, 0.013, -len * 0.3, wood), part(geo('spearhead', () => new THREE.ConeGeometry(0.03, 0.2, 5).rotateX(Math.PI / 2)), iron, 0, 0, len * 0.7 + 0.1));
  } else return null;
  return g;
}

/** A dressed figure, or null if the model has not arrived (or could not be fetched). */
export function makePerson(o: Outfit): { g: THREE.Group; real: RealPerson } | null {
  if (!source) return null;
  const body = cloneSkinned(source.scene);
  body.updateMatrixWorld(true);
  const key = [o.female, o.girth, o.chest, o.skin, o.hair, o.top, o.mail, o.sleeves, o.neck, o.legs].join('|');
  let n = 0;
  const meshes: THREE.SkinnedMesh[] = [];
  const bones = new Map<string, THREE.Object3D>();
  body.traverse((b) => {
    if (b.name.startsWith('DEF-')) bones.set(b.name, b);
    const m = b as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    meshes.push(m);
    let set = painted.get(key);
    if (!set) painted.set(key, (set = []));
    set[n] ??= paint(m.geometry, m.skeleton.bones.map((q) => q.name), o);
    m.geometry = set[n++];
    m.material = cloth;
    m.castShadow = true;
    m.frustumCulled = false; // its bounds are the rest pose's, not where the motion has taken it
  });
  if (!meshes.length) return null;
  // A piece made in the figure's own space, standing with arms out, is handed to the bone that will carry it.
  const fit = (bone: string, piece: THREE.Object3D): void => {
    const b = bones.get(bone.replace(/\./g, '')); // the loader drops the dots from bone names
    if (!b) return;
    piece.updateMatrixWorld(true);
    b.attach(piece);
  };
  const at = (bone: string): THREE.Vector3 => bones.get(bone.replace(/\./g, ''))?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();

  // ---- proportions set on the skeleton itself: where the shoulders sit, the size of hands, feet and head ----
  {
    const out = o.female ? -0.045 : [0, 0.014, 0.03][o.chest], w = new THREE.Vector3();
    for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
      const b = bones.get('DEF-upper_arm' + side);
      if (b?.parent) { b.getWorldPosition(w); w.x += sign * out; b.parent.worldToLocal(w); b.position.copy(w); }
      bones.get('DEF-hand' + side)?.scale.multiplyScalar(o.female ? 0.86 : 1.04);
      bones.get('DEF-foot' + side)?.scale.multiplyScalar(o.female ? 0.9 : 1.03);
    }
    bones.get('DEF-head')?.scale.multiplyScalar(o.female ? 0.96 : 1.02);
    body.updateMatrixWorld(true);
  }
  const mine = new Map<string, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
  body.traverse((b) => { if ((b as THREE.Bone).isBone) mine.set(b.name, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }); });

  if (o.skirt !== 'none') meshes[0].parent!.add(skirt(meshes[0], o.skirt === 'long', o.female, o.skirtColor, o.girth, o.female && o.neck < 2));

  // ---- the head: a face, hair, and whatever is worn on it ----
  const hb = source.marks.head, hc = hb.getCenter(new THREE.Vector3()), hr = hb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const head = new THREE.Group();
  const eye = geo('eye', () => new THREE.SphereGeometry(0.011, 6, 5)), dark = solid(0x1c1612), hairM = solid(o.hair);
  for (const sx of [-1, 1]) {
    const e = part(eye, dark, sx * hr.x * (o.female ? 0.36 : 0.4), hc.y + hr.y * 0.12, hb.max.z - hr.z * 0.2);
    if (o.female) e.scale.set(1.35, 1.2, 1);
    head.add(e);
    const brow = part(geo('brow', () => new THREE.BoxGeometry(0.036, 0.007, 0.012)), hairM, sx * hr.x * 0.4, hc.y + hr.y * 0.3, hb.max.z - hr.z * 0.19);
    brow.rotation.z = sx * -0.12;
    head.add(brow);
  }
  const dome = geo('dome', () => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const crown = (m: THREE.Material, k: number, lift = 0): THREE.Mesh => {
    const d = part(dome, m, 0, hc.y + hr.y * 0.22 + lift, hc.z - hr.z * 0.08);
    d.scale.set(hr.x * k, hr.y * 0.84 * k, hr.z * 1.04 * k);
    d.rotation.x = -0.22; // set back off the brow
    return d;
  };
  if (!o.helmet && o.hairStyle !== 'covered') head.add(crown(hairM, o.female ? 1.16 : 1.08));
  if (o.female && !o.helmet) {
    if (o.hairStyle === 'long') {
      // Worn loose down the back.
      const fall = part(geo('fall', () => new THREE.SphereGeometry(1, 10, 8)), hairM, 0, hc.y - hr.y * 0.75, hc.z - hr.z * 0.72);
      fall.scale.set(hr.x * 1.12, hr.y * 1.7, hr.z * 0.5);
      head.add(fall);
    } else if (o.hairStyle === 'bun') {
      head.add(part(geo('bun', () => new THREE.SphereGeometry(0.052, 9, 7)), hairM, 0, hc.y + hr.y * 0.35, hc.z - hr.z * 1.05));
    } else {
      // A linen coif over the hair, with its tail on the neck.
      const linen = solid(0xe6dcc4);
      head.add(crown(linen, 1.12));
      const tail = part(geo('fall', () => new THREE.SphereGeometry(1, 10, 8)), linen, 0, hc.y - hr.y * 0.45, hc.z - hr.z * 0.7);
      tail.scale.set(hr.x * 1.02, hr.y * 1.0, hr.z * 0.45);
      head.add(tail);
    }
  }
  if (o.beard) {
    const b = part(geo('beard', () => new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55)), hairM, 0, hc.y - hr.y * 0.42, hc.z + hr.z * 0.3);
    b.scale.set(hr.x * 0.86, hr.y * 0.62, hr.z * 0.72);
    head.add(b);
  }
  if (o.helmet) {
    const metal = o.helmet === 'leather' ? solid(0x6a4a2c) : o.helmet === 'bronze' ? solid(0xb08a3a, 0.75) : solid(0x9a9ea6, 0.8);
    head.add(crown(metal, 1.16, hr.y * 0.05));
    if (o.helmet === 'kettle') {
      // A wide brim all round.
      const brim = part(geo('brim', () => new THREE.CylinderGeometry(0.17, 0.19, 0.016, 16)), metal, 0, hc.y + hr.y * 0.3, hc.z - hr.z * 0.05);
      brim.rotation.x = -0.12;
      head.add(brim);
    } else if (o.helmet === 'iron') {
      head.add(part(geo('nasal', () => new THREE.BoxGeometry(0.02, 0.1, 0.014)), metal, 0, hc.y + hr.y * 0.12, hb.max.z - hr.z * 0.02));
    } else if (o.helmet === 'bronze') {
      // A crest fore and aft.
      const crest = part(geo('crest', () => new THREE.BoxGeometry(0.022, 0.07, 0.24)), solid(o.skirtColor), 0, hc.y + hr.y * 1.06, hc.z - hr.z * 0.15);
      crest.rotation.x = -0.2;
      head.add(crest);
      for (const sx of [-1, 1]) head.add(part(geo('cheek', () => new THREE.BoxGeometry(0.012, 0.09, 0.07)), metal, sx * hr.x * 1.08, hc.y - hr.y * 0.2, hc.z + hr.z * 0.25));
    }
  }
  fit('DEF-head', head);

  // ---- plate: a breast-and-back and a pair of pauldrons ----
  if (o.plate) {
    const steel = solid(0xa6aab2, 0.85), p2 = at('DEF-spine.002'), p3 = at('DEF-spine.003');
    const cuirass = part(geo('cuirass', () => new THREE.SphereGeometry(1, 14, 10)), steel, 0, (p2.y + p3.y) / 2 + 0.05, 0.012);
    const gk = 1 + [-0.05, 0.02, 0.13][o.girth];
    cuirass.scale.set(0.2 * gk, 0.21, 0.155 * gk);
    fit('DEF-spine.002', cuirass);
    for (const side of ['L', 'R']) {
      const s = at(`DEF-upper_arm.${side}`);
      fit(`DEF-upper_arm.${side}`, part(geo('pauldron', () => new THREE.SphereGeometry(0.085, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.6)), steel, s.x * 1.04, s.y - 0.01, s.z));
    }
  }
  // ---- a shield on the left forearm: its face is up while the arm is out, so it faces outward when the arm hangs ----
  if (o.shield !== null) {
    const e = at('DEF-forearm.L'), h = at('DEF-hand.L');
    const sh = new THREE.Group();
    sh.add(part(geo('shield', () => new THREE.CylinderGeometry(0.27, 0.27, 0.025, 18)), solid(o.shield)));
    sh.add(part(geo('rim', () => new THREE.TorusGeometry(0.27, 0.014, 5, 18).rotateX(Math.PI / 2)), solid(0x8a8e94, 0.7)));
    sh.add(part(geo('boss', () => new THREE.SphereGeometry(0.06, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2)), solid(0x9a9ea6, 0.8), 0, 0.01, 0));
    sh.position.set((e.x + h.x) / 2, e.y + 0.065, e.z);
    fit('DEF-forearm.L', sh);
  }

  const wrist = at('DEF-hand.R');
  const real: RealPerson = { mixer: new THREE.AnimationMixer(body), actions: new Map(), now: 'Idle_Loop', body, bones, rest: mine, palm: new THREE.Vector3(wrist.x - 0.075, wrist.y - 0.02, wrist.z), tool: null, toolKind: '', strike: 0, struck: false, soldier: !!o.weapon };
  for (const [name, clip] of source.clips) real.actions.set(name, real.mixer.clipAction(clip));
  if (o.weapon) hold(real, o.weapon);

  body.scale.setScalar(SCALE * (o.female ? 0.91 : 1.01) * (0.97 + (o.seed % 7) * 0.01)); // people are not all one height
  const g = new THREE.Group();
  g.add(body);
  real.actions.get('Idle_Loop')!.play();
  real.mixer.update((o.seed % 40) / 10); // not all breathing in step
  return { g, real };
}

/** Move to another motion, blending out of the one playing. `once` plays it through and holds the last pose. */
export function play(p: RealPerson, name: string, speed = 1, once = false): void {
  const next = p.actions.get(name);
  if (!next) return;
  next.timeScale = speed;
  if (p.now === name && next.isRunning()) return;
  const prev = p.actions.get(p.now);
  next.reset();
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = once;
  next.play();
  if (prev && prev !== next) prev.crossFadeTo(next, 0.18, false);
  p.now = name;
}
/** How long a motion lasts, in seconds. */
export const lasts = (p: RealPerson, name: string): number => p.actions.get(name)?.getClip().duration ?? 1;

/**
 * Put something in the right hand, or take it away with ''. A thing can only be fitted to the hand while the figure
 * stands at rest with its arms out, so the skeleton is put back there for the moment it takes.
 */
export function hold(p: RealPerson, kind: string): void {
  if (p.toolKind === kind) return;
  p.tool?.removeFromParent();
  p.tool = held(kind);
  p.toolKind = kind;
  if (!p.tool) return;
  p.mixer.stopAllAction();
  p.body.traverse((o) => { const r = p.rest.get(o.name); if (r && (o as THREE.Bone).isBone) { o.position.copy(r.p); o.quaternion.copy(r.q); o.scale.copy(r.s); } });
  // The body's own space is the figure's space whatever the unit's place or size in the world.
  p.body.add(p.tool);
  p.tool.position.copy(p.palm);
  p.tool.rotation.y = Math.PI; // at rest the palm faces back, so what it grips points behind until turned
  p.body.updateWorldMatrix(true, true);
  p.bones.get('DEF-handR')?.attach(p.tool);
  const a = p.actions.get(p.now);
  if (a) { a.reset(); a.play(); }
}
