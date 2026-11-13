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

interface Marks { /** The top of the skull, and how far forward the face stands at each height below it (steps of 0.01): down the middle, and down the line of the eyes. */ crown: number; face: { mid: number; eye: number }[]; /** The trunk's half-width, and how far it stands forward and back of the middle, at each height (steps of 0.02 from 0.9). */ trunk: { w: number; f: number; b: number }[]; head: THREE.Box3; /** The middle of the flesh each bone carries: the line a limb is thickened about. */ mid: Map<string, THREE.Vector3> }
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
    // The outline of the trunk, to cut clothes that sit just outside it.
    const trunkAt: { w: number; f: number; b: number }[] = [];
    for (let i = 0; i < 34; i++) trunkAt.push({ w: 0, f: 0, b: 0 });
    g.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const pos = m.geometry.getAttribute('position'), si = m.geometry.getAttribute('skinIndex'), sw = m.geometry.getAttribute('skinWeight');
      for (let i = 0; i < pos.count; i++) {
        let best = 0, bw = -1;
        for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
        if (!/spine|hips/.test(m.skeleton.bones[best].name)) continue;
        const t = trunkAt[Math.round((pos.getY(i) - 0.9) / 0.02)];
        if (t) { t.w = Math.max(t.w, Math.abs(pos.getX(i))); t.f = Math.max(t.f, pos.getZ(i)); t.b = Math.max(t.b, -pos.getZ(i)); }
      }
    });
    let crownY = 0;
    const scan = (fn: (x: number, y: number, z: number) => void): void => g.scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isSkinnedMesh) return;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    });
    scan((_x, y) => { crownY = Math.max(crownY, y); });
    const face: { mid: number; eye: number }[] = [];
    for (let i = 0; i < 30; i++) face.push({ mid: -1, eye: -1 });
    scan((x, y, z) => {
      const f = face[Math.round((crownY - y) / 0.01)], ax = Math.abs(x);
      if (!f) return;
      if (ax < 0.018) f.mid = Math.max(f.mid, z); else if (ax > 0.022 && ax < 0.046) f.eye = Math.max(f.eye, z);
    });
    for (let i = 1; i < face.length; i++) { if (face[i].mid < 0) face[i].mid = face[i - 1].mid; if (face[i].eye < 0) face[i].eye = face[i - 1].eye; }
    // Smoothed, so the figure's separate joint pieces do not show through as ridges.
    for (let pass = 0; pass < 3; pass++) {
      const was = trunkAt.map((t) => ({ ...t }));
      for (let i = 0; i < trunkAt.length; i++) for (const k of ['w', 'f', 'b'] as const) {
        let sum = 0, n = 0;
        for (let d = -2; d <= 2; d++) { const q = was[i + d]; if (q && q[k] > 0) { const wt = 3 - Math.abs(d); sum += q[k] * wt; n += wt; } }
        if (n) trunkAt[i][k] = sum / n;
      }
    }
    const mid = new Map<string, THREE.Vector3>();
    for (const [name, t] of sums) mid.set(name, t.v.divideScalar(t.n));
    source = { scene: g.scene, clips, marks: { head, mid, trunk: trunkAt, crown: crownY, face } };
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
  /** What a villager may hold or bear, each fitted once and shown when wanted. */
  props: Map<string, THREE.Object3D>;
  toolKind: string;
  /** How ranged weapons are levelled: a bow drawn, or a gun or crossbow at the shoulder. */
  aim: '' | 'bow' | 'gun';
  aimW: number;
  /** Seconds left of flinching from a blow. */
  flinch: number;
  weapon: Weapon;
  child: boolean;
  /** Seconds of a blow still to play, and whether a blow was under way last frame. */
  strike: number;
  struck: boolean;
  soldier: boolean;
  /** For wounds: the skinned parts and their whole, unmarked surfaces; the skin colour; gear a blow can knock off. */
  skins: THREE.SkinnedMesh[];
  whole: THREE.BufferGeometry[];
  skin: number;
  gear: THREE.Object3D[][];
  /** Hair kept under a helmet, shown when the helmet is gone. */
  spare: THREE.Object3D | null;
  hurt: number;
  female: boolean;
  seed: number;
}

export type Weapon = '' | 'club' | 'spear' | 'javelin' | 'sword' | 'pike' | 'axe' | 'bill' | 'bow' | 'crossbow' | 'musket' | 'sling' | 'staff' | 'firetube' | 'grenade' | 'whip';
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
  weapon: Weapon;
  /** The colour of helmet and plate, if not steel: bronze, or lacquer. */
  metal: number | null;
  /** A child: small, with a child's large head. */
  child: boolean;
  /** No boots. */
  barefoot?: boolean;
  /** Worn on the head when there is no helmet. */
  hat: '' | 'straw' | 'hood' | 'cap' | 'turban' | 'fur' | 'circlet';
  hatColor: number;
  /** A cloak down the back, by its colour. */
  cloak: number | null;
  /** A fur collar over the shoulders. */
  mantle: boolean;
  /** An apron over the front of the skirt, by its colour. */
  apron: number | null;
  /** The colour of hems, if not a darker shade of the cloth. */
  trim: number | null;
}

/** A nation's leader as their maker dressed them: a man or a woman, and whatever of their look was chosen. */
export function leaderOutfit(o: Outfit, female: boolean, look: { hair?: number; beard?: boolean; helmet?: string; cloak?: number; build?: number } = {}): Outfit {
  const out: Outfit = { ...o, female, beard: !female && (look.beard ?? o.beard), hairStyle: female ? 'long' : o.hairStyle };
  if (look.hair != null) out.hair = look.hair;
  if (look.cloak != null) out.cloak = look.cloak;
  if (look.build === 0 || look.build === 1 || look.build === 2) out.girth = look.build;
  if (look.helmet === 'none') { out.helmet = ''; out.hat = ''; }
  else if (look.helmet === 'circlet') { out.helmet = ''; out.hat = 'circlet'; out.hatColor = 0xd8b040; }
  else if (look.helmet === 'leather' || look.helmet === 'bronze' || look.helmet === 'iron' || look.helmet === 'kettle') { out.helmet = look.helmet; out.hat = ''; out.metal = look.helmet === 'bronze' ? 0xb08a3a : null; }
  return out;
}

/** Is this kind of unit drawn from the real figure? Everyone who goes on foot is. */
export const drawnReal = (cls: string): boolean => cls === 'villager' || cls === 'infantry' || cls === 'ranged' || cls === 'support' || cls === 'hero';

const BRONZE = 0xb08a3a;

/**
 * The dress of those who are not units of their own: a captive stripped to a loincloth (and, for a woman, a band
 * across the chest), the monks and nuns of a church, and the maids and patrons of a tavern. `lean` is how the town
 * lives: 'holy', 'low', or ''.
 */
export function roleOutfit(role: 'captive' | 'monk' | 'nun' | 'milkmaid' | 'patron', female: boolean, color: number, look: { skin: number; hair: number }, seed: number, lean = ''): Outfit {
  const base = outfitFor('villager', female, color, look, seed, 0);
  const cloth = 0xd8cdb8;
  if (role === 'captive') return { ...base, top: female ? cloth : look.skin, sleeves: 'bare', neck: female ? 1 : 2, skirt: 'short', skirtColor: cloth, legs: look.skin, barefoot: true, hat: '', apron: null, hairStyle: female ? 'long' : 'short', girth: 0 };
  if (role === 'monk') return { ...base, top: 0x6a4e34, skirtColor: 0x6a4e34, skirt: 'long', sleeves: 'long', neck: 0, hat: 'hood', hatColor: 0x6a4e34, trim: 0xb8a274, beard: seed % 2 === 0 };
  if (role === 'nun') return { ...base, top: 0x2e2c30, skirtColor: 0x2e2c30, skirt: 'long', sleeves: 'long', neck: 0, hairStyle: 'covered', apron: null, legs: 0x2e2c30 };
  if (role === 'milkmaid') return { ...base, top: lean === 'low' ? 0xa03038 : 0x7a8a5a, skirt: 'long', skirtColor: cloth, sleeves: lean === 'holy' ? 'short' : 'bare', neck: lean === 'low' ? 2 : lean === 'holy' ? 0 : 1, apron: lean === 'low' ? null : 0xe2d8c0, hairStyle: lean === 'holy' ? 'bun' : 'long', trim: lean === 'low' ? 0xa03038 : null };
  return { ...base, top: [0x7a5a3a, 0x5a6a4a, 0x6a4a5a][seed % 3], skirtColor: [0x7a5a3a, 0x5a6a4a, 0x6a4a5a][seed % 3], sleeves: 'short', neck: lean === 'low' ? 2 : 1, hat: seed % 3 === 0 ? 'cap' : '', hatColor: 0x4a3a30, girth: seed % 2 ? 2 : 1 };
}
/**
 * The dress of every unit that goes on foot. `wear` is how a village woman's town dresses her: 1 covered, 2 and 3
 * freer. `age` is the age the unit belongs to, which sets how well a plain soldier is armoured.
 */
export function outfitFor(type: string, female: boolean, color: number, look: { skin: number; hair: number }, seed: number, wear: number, info: { cls: string; age: number; child?: boolean; naval?: boolean } = { cls: 'villager', age: 0 }): Outfit {
  const s = Math.abs(seed | 0);
  const pick = (k: number): 0 | 1 | 2 => ([1, 0, 1, 2, 1, 1, 2, 0, 1][(s >> k) % 9] as 0 | 1 | 2);
  const fighter = info.cls === 'infantry' || info.cls === 'hero';
  const base: Outfit = { female, girth: fighter ? (Math.max(1, pick(2)) as 1 | 2) : pick(2), chest: fighter ? 2 : pick(5), skin: look.skin, hair: look.hair, seed: s, top: color, sleeves: 'short', neck: 0, legs: [0x6a5238, 0x54483c, 0x7a6a4c, 0x4a4238][s % 4], skirt: 'short', skirtColor: color, hairStyle: 'short', beard: !female && s % 3 === 0, helmet: '', plate: false, shield: null, weapon: '', metal: null, child: false, hat: '', hatColor: 0x8a6a48, cloak: null, mantle: false, apron: null, trim: null };
  const leather = 0x7a5232, hide = 0x8a6a48, linen = 0xe8e0cc;
  if (type === 'villager') {
    if (info.child) return { ...base, child: true, girth: 0, chest: 0, beard: false, skirt: female ? 'long' : 'short', hairStyle: female ? 'long' : 'short', legs: female ? 0xd8cdb8 : base.legs };
    if (!female) return { ...base, sleeves: s % 3 === 1 ? 'long' : 'short', neck: 1, hat: s % 5 === 2 ? 'straw' : '' };
    return { ...base, skirt: 'long', apron: wear === 3 ? null : 0xe2d8c0, legs: 0xd8cdb8, sleeves: wear === 1 ? 'long' : wear >= 2 ? 'bare' : 'short', neck: wear === 3 ? 2 : wear === 2 ? 1 : 0, hairStyle: wear === 1 ? 'covered' : s % 2 ? 'long' : 'bun' };
  }
  const o: Partial<Outfit> | undefined = ({
    // ---- the plain line of foot ----
    clubman: { top: hide, sleeves: 'bare', neck: 1, legs: look.skin, weapon: 'club', beard: s % 2 === 0 },
    spearman: { top: leather, helmet: 'bronze', metal: BRONZE, shield: color, weapon: 'spear' },
    marauder: { top: 0x2e2622, sleeves: 'bare', weapon: s % 3 === 0 ? 'club' : 'axe', mantle: true, beard: s % 2 === 0, legs: 0x2a2420, girth: 2, hat: s % 4 === 0 ? 'fur' : '', hatColor: 0x3a2e24 },
    swordsman: { mail: true, sleeves: 'long', helmet: 'iron', shield: color, weapon: 'sword' },
    pikeman: { mail: true, sleeves: 'long', helmet: 'kettle', plate: true, weapon: 'pike' },
    berserker: { top: hide, sleeves: 'bare', neck: 2, mantle: true, weapon: 'axe', beard: true, girth: 2 },
    grenadier: { sleeves: 'long', hat: 'cap', hatColor: 0x2a2a30, trim: 0xd8b040, weapon: 'grenade', legs: 0xd8d0c0 },
    slaver: { top: 0x4a3a30, sleeves: 'long', hat: 'hood', hatColor: 0x3a2e28, skirtColor: 0x4a3a30, weapon: 'whip', beard: true },
    // ---- shot ----
    slinger: { top: hide, sleeves: 'bare', neck: 1, weapon: 'sling' },
    javelineer: { top: leather, sleeves: 'bare', helmet: 'leather', weapon: 'javelin' },
    bowman: { top: 0x4a6a3a, skirtColor: 0x4a6a3a, sleeves: 'long', hat: 'hood', hatColor: 0x3f5a34, weapon: 'bow', trim: color, cloak: color },
    crossbowman: { mail: true, sleeves: 'long', helmet: 'kettle', weapon: 'crossbow' },
    musketeer: { sleeves: 'long', hat: 'straw', hatColor: 0x2a2a30, trim: 0xd8b040, weapon: 'musket', legs: 0xd8d0c0, cloak: 0x2a2a30 },
    // ---- holy men and healers ----
    shaman: { top: hide, sleeves: 'bare', neck: 2, mantle: true, hat: 'fur', hatColor: 0x5a4634, skirt: 'long', skirtColor: hide, weapon: 'staff', beard: true },
    priest: { top: 0x2e2a2a, skirtColor: 0x2e2a2a, skirt: 'long', sleeves: 'long', hat: 'cap', hatColor: 0x2e2a2a, trim: linen, weapon: 'staff' },
    prophet: { top: linen, skirtColor: linen, skirt: 'long', sleeves: 'long', hat: 'hood', hatColor: 0x8a7a5a, cloak: 0x8a7a5a, weapon: 'staff', beard: true, trim: color },
    herbwife: { female: true, top: 0x4a7a4a, skirtColor: 0x4a7a4a, skirt: 'long', sleeves: 'long', hairStyle: 'covered', apron: 0xe2d8c0, weapon: 'staff', legs: 0xd8cdb8 },
    // ---- leaders ----
    warlord: { mail: true, sleeves: 'long', plate: true, helmet: 'iron', shield: color, weapon: 'sword', cloak: color, trim: 0xd8b040, girth: 2, beard: true },
    strategist: { skirt: 'long', sleeves: 'long', hat: 'cap', hatColor: 0x2a2a3a, cloak: 0x2a2a3a, trim: 0xd8b040, weapon: 'staff' },
    // ---- each nation's own ----
    hearthguard: { top: leather, helmet: 'leather', shield: color, weapon: 'spear', mantle: s % 2 === 0 },
    zealot: { top: linen, skirt: 'long', skirtColor: linen, sleeves: 'long', hat: 'hood', hatColor: linen, trim: color, weapon: 'sword', beard: true },
    shieldbearer: { mail: true, plate: true, helmet: 'bronze', metal: 0xa6aab2, shield: color, weapon: 'sword', cloak: color },
    khopesh: { top: look.skin, sleeves: 'bare', neck: 2, skirtColor: linen, hat: 'cap', hatColor: 0xd8b040, trim: 0x2f6ab0, legs: look.skin, weapon: 'sword', beard: false },
    sapper: { top: leather, helmet: 'leather', weapon: 'axe', apron: 0x4a3222 },
    gateguard: { mail: true, sleeves: 'long', helmet: 'iron', metal: BRONZE, shield: color, weapon: 'spear', skirt: 'long', beard: true },
    immortal: { top: 0x6a3a7a, skirt: 'long', skirtColor: 0x6a3a7a, sleeves: 'long', hat: 'cap', hatColor: 0xd8b040, trim: 0xd8b040, shield: color, weapon: 'spear', beard: true },
    hoplite: { plate: true, metal: BRONZE, helmet: 'bronze', shield: color, weapon: 'spear', legs: look.skin, sleeves: 'bare' },
    billman: { mail: true, sleeves: 'long', helmet: 'kettle', weapon: 'bill' },
    samurai: { plate: true, metal: 0x7a2028, helmet: 'kettle', sleeves: 'long', top: 0x2a2a30, skirtColor: color, weapon: 'sword', legs: 0x2a2a30 },
    firethrower: { top: leather, sleeves: 'long', hat: 'hood', hatColor: 0x4a3222, apron: 0x4a3222, weapon: 'firetube' },
    // ---- riders and drivers ----
    rider: { top: leather, helmet: 'leather', weapon: 'spear', skirt: 'none' },
    knight: { mail: true, sleeves: 'long', plate: true, helmet: 'iron', shield: color, weapon: 'pike', skirt: 'none', cloak: color },
    hussar: { sleeves: 'long', hat: 'fur', hatColor: 0x2a2a30, cloak: color, trim: 0xd8b040, weapon: 'sword', skirt: 'none', legs: 0xd8d0c0 },
    lancer: { top: leather, sleeves: 'long', hat: 'fur', hatColor: 0x7a3a2a, weapon: 'spear', skirt: 'none', trim: 0xc8a040 },
    horsearcher: { top: 0x8a5a34, sleeves: 'long', hat: 'fur', hatColor: 0x7a3a2a, weapon: 'bow', skirt: 'none', mantle: true },
    wolfrider: { top: hide, sleeves: 'bare', mantle: true, weapon: 'axe', skirt: 'none', beard: true },
    templar: { mail: true, sleeves: 'long', helmet: 'iron', shield: linen, weapon: 'sword', cloak: linen, skirt: 'none' },
    companion: { plate: true, metal: BRONZE, helmet: 'bronze', weapon: 'spear', sleeves: 'bare', legs: look.skin, skirt: 'none', cloak: color },
    camelrider: { top: linen, sleeves: 'long', hat: 'turban', hatColor: 0xf0ece0, weapon: 'sword', skirt: 'long', skirtColor: linen, trim: color },
    mameluke: { mail: true, sleeves: 'long', hat: 'turban', hatColor: color, weapon: 'javelin', shield: color, skirt: 'none' },
    chariot: { top: leather, sleeves: 'bare', helmet: 'leather', weapon: 'bow' },
    warchariot: { top: look.skin, sleeves: 'bare', neck: 2, skirtColor: linen, hat: 'cap', hatColor: 0xd8b040, weapon: 'spear', legs: look.skin },
    longbowman: { top: 0x4a6a3a, sleeves: 'long', hat: 'cap', hatColor: 0x4a6a3a, weapon: 'bow', trim: color },
    ashigaru: { plate: true, metal: 0x2a2a30, hat: 'straw', hatColor: 0x2a2a30, sleeves: 'long', weapon: 'musket', legs: 0x2a2a30 },
  } as Record<string, Partial<Outfit>>)[type];
  if (o) return { ...base, ...o };
  // Anyone not named above is dressed by trade and by the age they belong to.
  const tier = info.age;
  if (info.cls === 'siege') return info.naval ? { ...base, top: linen, sleeves: 'bare', neck: 1, skirt: 'none', hat: s % 2 ? 'cap' : '', hatColor: color, barefoot: true, legs: 0x6a5a48 } : { ...base, top: leather, sleeves: 'short', apron: 0x4a3222, helmet: info.age >= 3 ? 'kettle' : 'leather' };
  if (info.cls === 'cavalry' || info.cls === 'beast') return { ...base, top: leather, sleeves: 'long', helmet: info.age >= 2 ? 'iron' : 'leather', weapon: 'spear', skirt: 'none' };
  if (info.cls === 'ranged') return { ...base, top: leather, sleeves: 'long', helmet: tier >= 3 ? 'kettle' : tier >= 1 ? 'leather' : '', weapon: tier >= 4 ? 'musket' : 'bow' };
  if (info.cls === 'support') return { ...base, skirt: 'long', sleeves: 'long', hat: 'hood', hatColor: color, weapon: 'staff' };
  return { ...base, top: tier >= 2 ? base.top : leather, mail: tier >= 2, sleeves: tier >= 2 ? 'long' : 'short', plate: tier >= 3, helmet: tier >= 3 ? 'kettle' : tier >= 2 ? 'iron' : tier >= 1 ? 'bronze' : '', metal: tier === 1 ? BRONZE : null, shield: tier >= 1 && tier < 3 ? color : null, weapon: tier >= 3 ? 'pike' : tier >= 2 ? 'sword' : tier >= 1 ? 'spear' : 'club' };
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

/** How high the cloth comes on the chest at a point across it: a scoop, lowest in the middle and rising to the shoulders. */
function neckline(o: Outfit, x: number): number {
  const low = o.neck === 2 ? 1.385 : o.neck === 1 ? 1.44 : 1.51, k = Math.min(1, Math.abs(x) / 0.115);
  return low + (1.53 - low) * k * k;
}

/** How this person's trunk differs from the bare figure's at a height: across, front to back, and the belly carried in front. */
function trunk(o: Outfit, y: number): { kx: number; kz: number; belly: number } {
  const fat = [-0.07, 0, 0.13][o.girth];
  let kx = 1, kz = 1;
  if (o.female && !o.child) {
    // A smaller ribcage, drawn well in at the waist, wide at the hip.
    const waist = bump(y, 1.13, 0.16), hip = bump(y, 0.9, 0.2), ribs = Math.min(1, Math.max(0, (y - 1.18) / 0.12));
    kx = 1 - waist * 0.2 + hip * 0.14 - ribs * 0.1; kz = 1 - waist * 0.14 + hip * 0.1 - ribs * 0.06;
  } else {
    // From narrow to deep-chested and broad across the back.
    const k = 0.04 + [-0.04, 0.02, 0.08][o.chest] * bump(y, 1.36, 0.2);
    kx = 1 + k; kz = 1 + k * 1.2;
  }
  return { kx: kx * (1 + fat * 0.8), kz: kz * (1 + fat * 0.8), belly: fat > 0 ? fat * 0.45 * bump(y, 1.1, 0.2) : 0 };
}
/**
 * A woman's breast as it lies under cloth, as how far forward of the ribs a point stands: two rounded forms, each
 * fuller below its middle than above, sloping gently from the collarbone and turning under sharply, and joined
 * across the breastbone so there is no cleft cut between them.
 */
function bust(o: Outfit, x: number, y: number): number {
  if (o.child) return 0;
  const size = [0.048, 0.068, 0.09][o.chest], at = 1.325 - size * 0.22;
  const dy = (y - at) / (y < at ? 0.055 + size * 0.2 : 0.12), dx = (Math.abs(x) - 0.07) / (0.062 + size * 0.2);
  // A dome, not a peak: full across its middle and falling away at its edge.
  const round = (d2: number): number => Math.max(0, 1 - d2 * 0.42) ** 1.35;
  const each = round(dx * dx + dy * dy);
  const between = 0.4 * Math.exp(-((x / 0.07) ** 2)) * round(dy * dy);
  return size * Math.max(each, between);
}

const painted = new Map<string, THREE.BufferGeometry[]>();
/** Shape one piece of the body as a man's or a woman's, and colour it by which bone moves each point. */
function paint(src: THREE.BufferGeometry, bones: string[], o: Outfit, joints: boolean): THREE.BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  const col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const skin = new THREE.Color(o.skin), hair = new THREE.Color(o.hair), top = new THREE.Color(o.mail ? 0x8a8f96 : o.top), legs = new THREE.Color(o.legs);
  const skirtC = new THREE.Color(o.skirtColor).multiplyScalar(0.8);
  const boot = new THREE.Color(0x4a3222), belt = new THREE.Color(0x3a2616);
  const mids = source!.marks.mid, headMid = source!.marks.head.getCenter(new THREE.Vector3()).y, headHalf = source!.marks.head.getSize(new THREE.Vector3()).y / 2;
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
      const t = trunk(o, y);
      x *= t.kx; z *= t.kz;
      if (z > 0) z += t.belly * bump(x, 0, 0.2);
      // The body under the bodice follows it, a little inside, so skin at an open neck is the right shape.
      if (o.female && z > 0.02) z += bust(o, x, y) * 0.8;
      // Under the garment the body is drawn in a little, so none of it shows through the cloth.
      if (y > 1.0 && y < neckline(o, x) - 0.03) { x *= 0.94; z *= 0.93; }
    } else if (/upper_arm|forearm|thigh|shin/.test(bone)) {
      // Limbs thicken about their own middle line: arms lie along x at rest, legs stand along y.
      // The base figure's separate joint pieces are tucked just inside the limb, so an elbow or knee is not a ball.
      const m = mids.get(bone), k = (joints ? 0.93 : 1) + fat * (/forearm|shin/.test(bone) ? 0.55 : 0.9) + (o.female ? (/arm/.test(bone) ? -0.16 : /shin/.test(bone) ? -0.08 : 0.04) : /upper_arm/.test(bone) ? 0.05 + [-0.03, 0.02, 0.07][o.chest] : 0.03);
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
    if (/head/.test(bone)) c.copy(y > 1.72 || (z < 0.0 && y > 1.6) ? hair : skin);
    else if (/neck/.test(bone)) c.copy(skin);
    else if (/hand|thumb|f_/.test(bone)) c.copy(skin);
    else if (/forearm/.test(bone)) { c.copy(o.sleeves === 'long' ? top : skin); mailed = o.sleeves === 'long'; }
    else if (/upper_arm/.test(bone)) { c.copy(o.sleeves === 'bare' ? skin : top); mailed = o.sleeves !== 'bare'; }
    else if (/spine|hips|shoulder/.test(bone)) {
      // The neckline dips in the middle of the chest and shows skin above it.
      const bare = y > neckline(o, x) && z > -0.02 && (!/shoulder/.test(bone) || Math.abs(x) < 0.125);
      c.copy(bare ? skin : y > 1.0 && y < 1.05 ? belt : top);
      mailed = !bare;
    }
    else if (/thigh/.test(bone)) c.copy(o.skirt !== 'none' && y > 0.72 ? skirtC : legs); // under a skirt, the top of the leg is lost in its shadow
    else if (/shin/.test(bone)) c.copy(y < 0.26 && !o.barefoot ? boot : legs);
    else if (/foot|toe/.test(bone)) c.copy(o.barefoot ? skin : boot);
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
function skirt(body: THREE.SkinnedMesh, long: boolean, female: boolean, color: number, girth: number, apron: number | null, trimC: number | null): THREE.SkinnedMesh {
  const linen = new THREE.Color(apron ?? 0);
  const wide = 1 + [-0.06, 0, 0.13][girth];
  const names = body.skeleton.bones.map((b) => b.name);
  const hips = names.indexOf('DEF-hips'), tl = names.indexOf('DEF-thighL'), tr = names.indexOf('DEF-thighR');
  const top = 1.06, hem = long ? 0.13 : 0.68, rings = long ? 9 : 5, seg = 18;
  const P: number[] = [], C: number[] = [], SI: number[] = [], SW: number[] = [], I: number[] = [];
  const base = new THREE.Color(color), trim = trimC !== null ? new THREE.Color(trimC) : base.clone().multiplyScalar(0.68);
  for (let r = 0; r <= rings; r++) {
    const f = r / rings, y = top + (hem - top) * f;
    // Close at the waist, over the hips, then flaring to the hem.
    const hk = Math.min(1, Math.max(0, (top - y) / 0.17)), hipK = hk * hk * (3 - 2 * hk); // out over the hip, then straight down: no bell
    const rx = (female ? 0.118 : 0.156) + hipK * (female ? 0.092 : 0.055) + f * (long ? 0.085 : 0.03), rz = (female ? 0.1 : 0.112) + hipK * 0.055 + f * (long ? 0.1 : 0.028);
    const leg = Math.min(1, Math.max(0, (0.98 - y) / 0.22)) * (long ? 0.6 : 0.85); // how much of this ring the legs carry
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2, fold = 1 + (long ? Math.sin(a * 7) * 0.035 * f : 0);
      const x = Math.cos(a) * rx * fold * wide, z = 0.012 + Math.sin(a) * rz * fold * wide * (Math.sin(a) > 0 && girth === 2 ? 1.28 : 1);
      P.push(x, y, z);
      const c = apron !== null && Math.sin(a) > 0.62 && r > 0 && r < rings - 1 ? linen : r === rings ? trim : base, n = 0.92 + ((s * 7 + r * 3) % 5) * 0.03;
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

/**
 * The upper garment: a fitted shell cut just outside the trunk from the belt to the collar, finely made so its
 * curves are smooth where the bare figure's are coarse. It bends with the spine.
 */
function bodice(body: THREE.SkinnedMesh, o: Outfit, heights: number[]): THREE.SkinnedMesh {
  const names = body.skeleton.bones.map((b) => b.name), prof = source!.marks.trunk;
  const idx = [names.indexOf('DEF-hips'), names.indexOf('DEF-spine001'), names.indexOf('DEF-spine002'), names.indexOf('DEF-spine003')];
  const at = (y: number): { w: number; f: number; b: number } => {
    const k = Math.min(prof.length - 1.001, Math.max(0, (y - 0.9) / 0.02)), i = Math.floor(k), t = k - i, a = prof[i], c = prof[i + 1];
    return { w: a.w + (c.w - a.w) * t, f: a.f + (c.f - a.f) * t, b: a.b + (c.b - a.b) * t };
  };
  const rows = 30, seg = 36, y0 = 1.02, y1 = 1.535, off = 0.022;
  const P: number[] = [], C: number[] = [], SI: number[] = [], SW: number[] = [], I: number[] = [];
  const cut: boolean[] = [], rowH = (y1 - y0) / rows;
  const top = new THREE.Color(o.mail ? 0x8a8f96 : o.top), trim = o.trim !== null ? new THREE.Color(o.trim) : top.clone().multiplyScalar(0.7), belt = new THREE.Color(0x3a2616);
  for (let r = 0; r <= rows; r++) {
    const yr = y0 + ((y1 - y0) * r) / rows, pr = at(Math.min(1.46, yr)), t = trunk(o, yr);
    // Above the armpit the cloth closes in over the shoulders to the neck.
    const yoke = Math.min(1, Math.max(0, (yr - 1.45) / 0.085)), close = yoke * yoke * (3 - 2 * yoke);
    const w = (pr.w * t.kx + off) * (1 - close) + 0.066 * close, f = (pr.f * t.kz + off) * (1 - close) + 0.07 * close, b = (pr.b * t.kz + off) * (1 - close) + 0.066 * close;
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      // Squarer than a circle, as a ribcage is.
      const x = w * Math.sign(ca) * Math.abs(ca) ** 0.8;
      let z = (sa > 0 ? f : b) * Math.sign(sa) * Math.abs(sa) ** 0.8, y = yr;
      if (sa > 0) {
        z += t.belly * bump(x, 0, 0.2) * (1 - close);
        if (o.female) z += bust(o, x, y);
      }
      // The neckline: cut down in front to a curve, with nothing above it.
      const line = neckline(o, x);
      let edge = false;
      // The first row above the line is brought down to it for a clean edge; cloth higher than that is cut away.
      if (sa > 0.15 && y > line) { cut.push(yr > line + rowH); y = line; edge = true; } else cut.push(false);
      P.push(x, y, z);
      const c = yr < 1.058 ? belt : edge || (sa > 0.15 && y > line - 0.016) ? trim : top;
      const h = (((s * 131 + r * 71) * 2654435761) >>> 0) % 100 / 100, n = o.mail && c === top ? 0.78 + h * 0.44 : 0.95 + h * 0.08;
      C.push(c.r * n, c.g * n, c.b * n);
      // Each stretch of the trunk goes with the bone it lies along, eased over a hand's breadth at each joint.
      let lo = 0;
      for (let k = 1; k < 4; k++) if (yr >= heights[k]) lo = k;
      const w4 = [0, 0, 0, 0];
      const up = lo < 3 ? Math.min(1, Math.max(0, (yr - (heights[lo + 1] - 0.05)) / 0.1)) * 0.5 : 0;
      const down = lo > 0 ? Math.min(1, Math.max(0, ((heights[lo] + 0.05) - yr) / 0.1)) * 0.5 : 0;
      w4[lo] = 1 - up - down;
      if (lo < 3) w4[lo + 1] += up;
      if (lo > 0) w4[lo - 1] += down;
      SI.push(idx[0], idx[1], idx[2], idx[3]); SW.push(w4[0], w4[1], w4[2], w4[3]);
    }
  }
  for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) {
    const a = r * seg + s, b2 = r * seg + ((s + 1) % seg), c2 = a + seg, d = b2 + seg;
    if (cut[a] || cut[b2] || cut[c2] || cut[d]) continue;
    I.push(a, b2, c2, b2, d, c2);
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

/** A cloak pinned at the shoulders and hanging down the back to the calf: it follows the spine, then the hips. */
function cloak(body: THREE.SkinnedMesh, color: number, girth: number): THREE.SkinnedMesh {
  const names = body.skeleton.bones.map((b) => b.name);
  const s3 = names.indexOf('DEF-spine003'), s1 = names.indexOf('DEF-spine001'), hips = names.indexOf('DEF-hips');
  const rows = 8, seg = 10, P: number[] = [], C: number[] = [], SI: number[] = [], SW: number[] = [], I: number[] = [];
  const base = new THREE.Color(color), wide = 1 + [-0.05, 0, 0.12][girth];
  for (let r = 0; r <= rows; r++) {
    const f = r / rows, y = 1.5 - f * 1.1;
    for (let s = 0; s <= seg; s++) {
      // Round the back from shoulder to shoulder, spreading and standing further off as it falls.
      const a = Math.PI + (s / seg - 0.5) * Math.PI * 1.15, rx = (0.2 + f * 0.1) * wide, rz = (0.13 + f * 0.1) * wide;
      P.push(Math.sin(a) * rx * (1 + Math.sin(s * 2.1) * 0.03 * f), y, 0.01 + Math.cos(a) * rz);
      const n = 0.86 + ((s * 5 + r * 3) % 4) * 0.045;
      C.push(base.r * n, base.g * n, base.b * n);
      const up = Math.max(0, Math.min(1, (y - 1.25) / 0.2)), low = Math.max(0, Math.min(1, (1.05 - y) / 0.2));
      SI.push(s3, s1, hips, 0); SW.push(up, 1 - up - low, low, 0);
    }
  }
  for (let r = 0; r < rows; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1; I.push(a, c, b, b, c, d); }
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
  if (kind === 'hatchet') g.add(rod(0.62, 0.014, -0.1, wood), block(0.02, 0.16, 0.1, 0.46, iron, -0.05));
  else if (kind === 'pick') g.add(rod(0.64, 0.014, -0.1, wood), block(0.03, 0.36, 0.035, 0.52, iron));
  else if (kind === 'hammer') g.add(rod(0.4, 0.013, -0.08, wood), block(0.07, 0.12, 0.07, 0.3, iron));
  else if (kind === 'hoe') g.add(rod(0.9, 0.013, -0.2, wood), block(0.11, 0.1, 0.015, 0.7, iron, -0.05));
  else if (kind === 'club') g.add(part(geo('club', () => new THREE.CylinderGeometry(0.05, 0.018, 0.66, 7).rotateX(-Math.PI / 2)), solid(0x6a4a2c), 0, 0, 0.25));
  else if (kind === 'sword') g.add(rod(0.14, 0.014, -0.07, solid(0x4a3222)), block(0.14, 0.02, 0.025, 0.08, solid(0xb08a3a, 0.7)), block(0.045, 0.01, 0.62, 0.4, solid(0xc8ccd4, 0.85)));
  else if (kind === 'spear' || kind === 'pike') {
    const len = kind === 'pike' ? 2.5 : 1.7;
    g.add(rod(len, 0.013, -len * 0.3, wood), part(geo('spearhead', () => new THREE.ConeGeometry(0.03, 0.2, 5).rotateX(Math.PI / 2)), iron, 0, 0, len * 0.7 + 0.1));
  } else if (kind === 'javelin') g.add(rod(1.15, 0.011, -0.4, wood), part(geo('spearhead', () => new THREE.ConeGeometry(0.03, 0.2, 5).rotateX(Math.PI / 2)), iron, 0, 0, 0.83));
  else if (kind === 'axe') g.add(rod(0.95, 0.016, -0.25, wood), block(0.02, 0.26, 0.17, 0.62, iron, -0.07));
  else if (kind === 'bill') g.add(rod(2.0, 0.014, -0.6, wood), block(0.015, 0.2, 0.3, 1.32, iron, -0.06), part(geo('spearhead', () => new THREE.ConeGeometry(0.03, 0.2, 5).rotateX(Math.PI / 2)), iron, 0, 0, 1.5));
  else if (kind === 'staff') g.add(rod(1.75, 0.016, -0.95, wood), part(geo('knob', () => new THREE.SphereGeometry(0.035, 7, 5)), wood, 0, 0, 0.82));
  else if (kind === 'whip') g.add(rod(0.3, 0.014, -0.06, solid(0x3a2616)), rod(0.6, 0.006, 0.24, solid(0x3a2616)));
  else if (kind === 'grenade') g.add(part(geo('grenade', () => new THREE.SphereGeometry(0.045, 8, 6)), solid(0x2a2a2e, 0.5), 0, 0, 0.02));
  else if (kind === 'sling') g.add(rod(0.42, 0.005, 0, solid(0x8a7250)), part(geo('slingstone', () => new THREE.SphereGeometry(0.025, 6, 5)), solid(0x8a8a86), 0, 0, 0.44));
  else if (kind === 'firetube') g.add(rod(0.85, 0.03, -0.25, solid(0xb08a3a, 0.7)), part(geo('flame', () => new THREE.ConeGeometry(0.04, 0.14, 6).rotateX(Math.PI / 2)), solid(0xf08a2c), 0, 0, 0.66));
  else if (kind === 'crossbow') g.add(rod(0.6, 0.02, -0.12, wood), block(0.56, 0.02, 0.03, 0.4, iron));
  else if (kind === 'musket') g.add(rod(0.5, 0.022, -0.3, wood), rod(0.75, 0.012, 0.2, iron));
  else if (kind === 'bow') {
    // A bow stands upright in the hand: a curved stave and its string.
    const stave = part(geo('bow', () => new THREE.TorusGeometry(0.42, 0.012, 5, 14, Math.PI * 0.72).rotateZ(-Math.PI * 0.36).rotateY(Math.PI / 2)), wood, 0, 0, -0.34);
    g.add(stave, part(geo('bowstring', () => new THREE.CylinderGeometry(0.003, 0.003, 0.76, 3)), solid(0xe8e0cc), 0, 0, -0.068));
  } else return null;
  return g;
}

/** A dressed figure, or null if the model has not arrived (or could not be fetched). */
export function makePerson(o: Outfit): { g: THREE.Group; real: RealPerson } | null {
  if (!source) return null;
  const body = cloneSkinned(source.scene);
  body.updateMatrixWorld(true);
  const key = [o.female, o.child, !!o.barefoot, o.girth, o.chest, o.skirt, o.skirtColor, o.skin, o.hair, o.top, o.mail, o.sleeves, o.neck, o.legs].join('|');
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
    set[n] ??= paint(m.geometry, m.skeleton.bones.map((q) => q.name), o, (m.material as THREE.Material).name === 'M_Joints');
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
    bones.get('DEF-head')?.scale.multiplyScalar(o.female ? 1.04 : 1.07); // a touch large, so a face can be read from above
    body.updateMatrixWorld(true);
  }
  const mine = new Map<string, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
  body.traverse((b) => { if ((b as THREE.Bone).isBone) mine.set(b.name, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }); });

  meshes[0].parent!.add(bodice(meshes[0], o, [at('DEF-hips').y, at('DEF-spine.001').y, at('DEF-spine.002').y, at('DEF-spine.003').y]));
  if (o.skirt !== 'none') meshes[0].parent!.add(skirt(meshes[0], o.skirt === 'long', o.female, o.skirtColor, o.girth, o.apron, o.trim));

  // ---- the head: a face, hair, and whatever is worn on it ----
  const hb = source.marks.head, hc = hb.getCenter(new THREE.Vector3()), hr = hb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const head = new THREE.Group();
  const dark = solid(0x1c1612), hairM = solid(o.hair), skinM = solid(o.skin), skinD = solid(new THREE.Color(o.skin).multiplyScalar(0.82).getHex());
  // A face, drawn simply so that it reads as friendly from where the game is watched and is not a stare close to:
  // dark, soft almond eyes set into the head with a point of light and no white, a relaxed lid over each, low
  // easy brows, a nose that stands out, and a mouth that is one gentle curved line.
  const mk = source.marks, faceAt = (y: number, line: 'mid' | 'eye'): number => mk.face[Math.min(mk.face.length - 1, Math.max(0, Math.round((mk.crown - y) / 0.01)))][line];
  const eyeY = mk.crown - 0.118, glint = solid(0xfffaf0);
  const iris = solid(new THREE.Color([0x3a2a1a, 0x4a3a22, 0x2a4a6a, 0x3a5a3a][o.seed % 4]).multiplyScalar(0.55).getHex());
  const ez = faceAt(eyeY, 'eye');
  // A man's lid is a fine line a shade darker than his skin; the nose a touch darker than the face, since it catches the light from above.
  const lidM = solid(new THREE.Color(o.skin).multiplyScalar(0.5).getHex()), noseM = solid(new THREE.Color(o.skin).multiplyScalar(0.9).getHex());
  const sk = new THREE.Color(o.skin), rimT = Math.min(1, Math.max(0, (0.24 - (sk.r * 0.3 + sk.g * 0.6 + sk.b * 0.1)) / 0.2)), rimM = solid(sk.clone().lerp(new THREE.Color(0xe6dccc), 0.2 + rimT * 0.45).getHex());
  for (const sx of [-1, 1]) {
    const ex = sx * 0.033;
    // One dark almond with a point of light: no white to stare with, and nothing set in front of anything else to slide about as the head turns.
    const eye = part(geo('eye', () => new THREE.SphereGeometry(0.0128, 12, 8)), iris, ex, eyeY - 0.0004, ez - 0.0042);
    eye.scale.set(o.female ? 1.2 : 1.4, o.female ? 0.92 : 1.02, 0.42);
    // On dark skin a dark eye would be lost, leaving only its point of light: a pale rim round it, even all the way round, keeps it an eye.
    if (rimT > 0.4) { const rim = part(geo('eyerim', () => new THREE.SphereGeometry(0.0128, 12, 8)), rimM, ex, eyeY - 0.0004, ez - 0.0052); rim.scale.set(o.female ? 1.5 : 1.7, o.female ? 1.2 : 1.22, 0.42); head.add(rim); }
    head.add(eye, part(geo('glint', () => new THREE.SphereGeometry(0.0025, 6, 5)), glint, ex + 0.0036, eyeY + 0.003, ez + 0.0002));
    // The upper lid rests on the eye, so the look is easy; a woman's is a dark line of lashes.
    const lid = part(geo('eyelid', () => new THREE.SphereGeometry(0.0165, 10, 6)), o.female ? dark : lidM, ex, eyeY + (o.female ? 0.0096 : 0.0112), ez - 0.0034);
    lid.scale.set(1.25, o.female ? 0.11 : 0.1, 0.55);
    head.add(lid);
    const under = !!o.helmet || o.hat === 'hood' || o.hat === 'cap' || o.hat === 'fur' || o.hairStyle === 'covered'; // a brim sits low: keep the brow beneath it
    const by = eyeY + (under ? 0.022 : o.female ? 0.029 : 0.026);
    const brow = part(geo('eyebrow', () => new THREE.SphereGeometry(0.012, 10, 6)), hairM, ex, by, faceAt(by, 'eye') - 0.002);
    brow.scale.set(1.75, o.female ? 0.13 : 0.22, 0.5);
    brow.rotation.z = sx * (o.female ? -0.12 : -0.06); // the outer end a little lower: a soft arch, not a frown
    head.add(brow);
    const ear = part(geo('ear', () => new THREE.SphereGeometry(0.022, 8, 6)), skinM, sx * hr.x * 0.98, eyeY - 0.012, hc.z - hr.z * 0.05);
    ear.scale.set(0.45, 1.15, 0.8);
    head.add(ear);
  }
  // The nose runs down from between the eyes and stands out at its tip.
  const noseY = eyeY - 0.038, nz = faceAt(noseY, 'mid');
  const nose = part(geo('nose', () => new THREE.ConeGeometry(0.0135, 0.046, 9).rotateX(-0.34)), noseM, 0, noseY + 0.014, nz - 0.002);
  nose.scale.set(o.female ? 0.8 : 1.05, 1, o.female ? 0.9 : 1.15);
  head.add(nose, part(geo('nosetip', () => new THREE.SphereGeometry(0.0105, 9, 7)), noseM, 0, noseY - 0.006, nz + 0.0045));
  // The mouth: one soft line, turned up a little at the ends; a woman's a touch fuller and redder.
  const lipC = new THREE.Color(o.skin).lerp(new THREE.Color(0x7a2c30), o.female ? 0.58 : 0.5).getHex();
  const mouthY = eyeY - 0.072, mz = faceAt(mouthY, 'mid'), ARC = 0.86, MR = 0.036;
  const mouth = part(geo('smile', () => new THREE.TorusGeometry(MR, 0.0034, 6, 12, ARC).rotateZ(-Math.PI / 2 - ARC / 2)), solid(lipC), 0, mouthY + MR * Math.cos(ARC / 2) + 0.001, mz + (o.female ? -0.0012 : 0.0025)); // a man's lips stand further out on this figure, and would bury the line
  mouth.scale.set(o.female ? 0.95 : 1.08, 1, o.female ? 1.5 : 1.9);
  head.add(mouth);
  if (o.female) { const lower = part(geo('lowerlip', () => new THREE.SphereGeometry(0.011, 9, 5)), solid(lipC), 0, mouthY - 0.004, mz - 0.006); lower.scale.set(0.95, 0.3, 0.5); head.add(lower); }
  const dome = geo('dome', () => new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const crown = (m: THREE.Material, k: number, lift = 0): THREE.Mesh => {
    const d = part(dome, m, 0, hc.y + hr.y * 0.22 + lift, hc.z - hr.z * 0.08);
    d.scale.set(hr.x * k, hr.y * 0.84 * k, hr.z * 1.04 * k);
    d.rotation.x = -0.22; // set back off the brow
    return d;
  };
  if (!o.helmet && o.hairStyle !== 'covered' && o.hat !== 'hood' && o.hat !== 'cap' && o.hat !== 'fur') head.add(crown(hairM, o.female ? 1.16 : 1.08));
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
  const gearHead: THREE.Object3D[] = [], gearPlate: THREE.Object3D[] = [], gearShield: THREE.Object3D[] = [];
  let spare: THREE.Object3D | null = null;
  const h0 = head.children.length;
  if (o.helmet) {
    spare = crown(hairM, 1.08);
    spare.visible = false;
    head.add(spare);
    const metal = o.helmet === 'leather' ? solid(0x6a4a2c) : solid(o.metal ?? (o.helmet === 'bronze' ? BRONZE : 0x9a9ea6), 0.8);
    head.add(crown(metal, 1.16, hr.y * 0.05));
    if (o.helmet === 'kettle') {
      // A wide brim all round.
      const brim = part(geo('brim', () => new THREE.CylinderGeometry(0.17, 0.19, 0.016, 16)), metal, 0, hc.y + hr.y * 0.3, hc.z - hr.z * 0.05);
      brim.rotation.x = -0.12;
      head.add(brim);
    } else if (o.helmet === 'iron') {
      head.add(part(geo('nasal', () => new THREE.BoxGeometry(0.02, 0.1, 0.014)), metal, 0, hc.y + hr.y * 0.12, faceAt(eyeY - 0.02, 'mid') + 0.012));
    } else if (o.helmet === 'bronze') {
      // A crest fore and aft.
      const crest = part(geo('crest', () => new THREE.BoxGeometry(0.022, 0.07, 0.24)), solid(o.skirtColor), 0, hc.y + hr.y * 1.06, hc.z - hr.z * 0.15);
      crest.rotation.x = -0.2;
      head.add(crest);
      for (const sx of [-1, 1]) head.add(part(geo('cheek', () => new THREE.BoxGeometry(0.012, 0.09, 0.07)), metal, sx * hr.x * 1.08, hc.y - hr.y * 0.2, hc.z + hr.z * 0.25));
    }
  }
  if (o.helmet) gearHead.push(...head.children.slice(h0 + 1));
  const h1 = head.children.length;
  if (!o.helmet && o.hat) {
    const hm = solid(o.hatColor);
    if (o.hat === 'straw') {
      // A wide straw hat with a low crown.
      const straw = solid(0xd8b860);
      const brim = part(geo('strawbrim', () => new THREE.ConeGeometry(0.26, 0.07, 16, 1, true)), straw, 0, hc.y + hr.y * 0.72, hc.z - hr.z * 0.05);
      (brim.material as THREE.Material).side = THREE.DoubleSide;
      head.add(brim, part(geo('strawtop', () => new THREE.CylinderGeometry(0.075, 0.095, 0.07, 12)), straw, 0, hc.y + hr.y * 0.95, hc.z - hr.z * 0.05));
    } else if (o.hat === 'hood') {
      // A hood drawn up, open at the face, with a cape over the shoulders.
      head.add(crown(hm, 1.2, hr.y * 0.02));
      const back = part(geo('fall', () => new THREE.SphereGeometry(1, 10, 8)), hm, 0, hc.y - hr.y * 0.5, hc.z - hr.z * 0.55);
      back.scale.set(hr.x * 1.16, hr.y * 1.25, hr.z * 0.62);
      head.add(back);
      // Its sides come down past the ears to the cape.
      for (const sx of [-1, 1]) { const side = part(geo('hoodside', () => new THREE.BoxGeometry(0.02, 0.17, 0.11)), hm, sx * hr.x * 1.1, hc.y - hr.y * 0.55, hc.z - hr.z * 0.1); head.add(side); }
      const sh = at('DEF-spine.003');
      const cape = part(geo('cape', () => new THREE.CylinderGeometry(0.1, 0.33, 0.24, 14, 1, true)), hm, 0, sh.y + 0.12, 0.005);
      cape.scale.z = 0.8;
      fit('DEF-spine.003', cape);
    } else if (o.hat === 'cap') {
      head.add(crown(hm, 1.14, hr.y * 0.1));
    } else if (o.hat === 'turban') {
      const wrap = part(geo('turban', () => new THREE.SphereGeometry(1, 12, 8)), hm, 0, hc.y + hr.y * 0.62, hc.z - hr.z * 0.1);
      wrap.scale.set(hr.x * 1.42, hr.y * 0.62, hr.z * 1.4);
      head.add(wrap, part(geo('turbantail', () => new THREE.BoxGeometry(0.05, 0.2, 0.012)), hm, 0.03, hc.y - hr.y * 0.4, hc.z - hr.z * 1.05));
    } else if (o.hat === 'fur') {
      head.add(crown(hm, 1.18, hr.y * 0.12));
      const band = part(geo('furband', () => new THREE.TorusGeometry(1, 0.26, 6, 14).rotateX(Math.PI / 2)), solid(0x5a4634), 0, hc.y + hr.y * 0.42, hc.z - hr.z * 0.06);
      band.scale.set(hr.x * 1.12, hr.y * 0.75, hr.z * 1.12);
      head.add(band);
    } else {
      const ring = part(geo('circlet', () => new THREE.TorusGeometry(1, 0.07, 5, 18).rotateX(Math.PI / 2)), solid(0xd8b040, 0.6), 0, hc.y + hr.y * 0.5, hc.z - hr.z * 0.05);
      ring.scale.set(hr.x * 1.1, hr.y, hr.z * 1.12);
      ring.rotation.x = -0.15;
      head.add(ring);
    }
  }
  if (!o.helmet && (o.hat === 'straw' || o.hat === 'turban')) gearHead.push(...head.children.slice(h1));
  fit('DEF-head', head);
  if (o.mantle) {
    const sh = at('DEF-spine.003');
    const fur = part(geo('mantle', () => new THREE.TorusGeometry(0.15, 0.06, 6, 14).rotateX(Math.PI / 2)), solid(0x6a5640), 0, sh.y + 0.2, 0);
    fur.scale.set(1.25, 1, 0.85);
    fit('DEF-spine.003', fur);
  }
  if (o.cloak !== null) meshes[0].parent!.add(cloak(meshes[0], o.cloak, o.girth));

  // ---- plate: a breast-and-back and a pair of pauldrons ----
  if (o.plate) {
    const steel = solid(o.metal ?? 0xa6aab2, 0.85), p2 = at('DEF-spine.002'), p3 = at('DEF-spine.003');
    const cuirass = part(geo('cuirass', () => new THREE.SphereGeometry(1, 14, 10)), steel, 0, (p2.y + p3.y) / 2 + 0.05, 0.012);
    const gk = 1 + [-0.05, 0.02, 0.13][o.girth];
    cuirass.scale.set(0.2 * gk, 0.21, 0.155 * gk);
    fit('DEF-spine.002', cuirass);
    gearPlate.push(cuirass);
    for (const side of ['L', 'R']) {
      const s = at(`DEF-upper_arm.${side}`);
      const pd = part(geo('pauldron', () => new THREE.SphereGeometry(0.085, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.6)), steel, s.x * 1.04, s.y - 0.01, s.z);
      fit(`DEF-upper_arm.${side}`, pd);
      gearPlate.push(pd);
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
    gearShield.push(sh);
  }

  // ---- what is held and borne: each thing is fitted once, while the figure stands at rest, and shown when wanted ----
  const wristR = at('DEF-hand.R'), wristL = at('DEF-hand.L'), props = new Map<string, THREE.Object3D>();
  const grip = (kind: string, show: boolean): void => {
    const t = held(kind);
    if (!t) return;
    if (kind === 'bow') { t.position.set(wristL.x + 0.075, wristL.y - 0.02, wristL.z); fit('DEF-hand.L', t); } // upright in the left hand
    else {
      t.position.set(wristR.x - 0.075, wristR.y - 0.02, wristR.z + (kind === 'staff' ? 0.05 : 0));
      // A sword lies forward from the grip; a gun, a crossbow or a staff lies along the arm, so that it points where
      // the arm is levelled and stands upright when the arm hangs.
      t.rotation.y = kind === 'crossbow' || kind === 'musket' || kind === 'staff' || kind === 'firetube' ? -Math.PI / 2 : Math.PI;
      fit('DEF-hand.R', t);
    }
    t.visible = show;
    props.set(kind, t);
  };
  if (o.weapon) grip(o.weapon, true);
  else if (!o.child) {
    for (const k of ['hatchet', 'pick', 'hammer', 'hoe']) grip(k, false);
    // A load on the back: a sack of grain, ore or stone, or a bundle of cut wood.
    const s3 = at('DEF-spine.003');
    const sack = part(geo('sack', () => new THREE.SphereGeometry(0.15, 9, 7)), solid(0xb8a274), 0, s3.y + 0.04, -0.2);
    sack.scale.set(1.1, 1.25, 0.8);
    const logs = new THREE.Group();
    for (let k = 0; k < 3; k++) logs.add(part(geo('log', () => new THREE.CylinderGeometry(0.04, 0.04, 0.62, 6).rotateZ(Math.PI / 2)), solid(k === 1 ? 0x7a5a36 : 0x6a4c30), 0, (k === 1 ? 0.07 : 0), (k - 1) * 0.07));
    logs.position.set(0, s3.y + 0.08, -0.19);
    for (const [k, piece] of [['sack', sack], ['logs', logs]] as const) { fit('DEF-spine.003', piece); piece.visible = false; props.set(k, piece); }
  }
  if (o.child) bones.get('DEF-head')?.scale.multiplyScalar(1.28);

  const real: RealPerson = { mixer: new THREE.AnimationMixer(body), actions: new Map(), now: 'Idle_Loop', body, bones, rest: mine, palm: new THREE.Vector3(), props, toolKind: '', skins: [], whole: [], skin: o.skin, gear: [gearShield, gearHead, gearPlate].filter((l) => l.length > 0), spare, hurt: 0, female: o.female, seed: o.seed, strike: 0, struck: false, soldier: !!o.weapon, aim: o.weapon === 'bow' ? 'bow' : o.weapon === 'crossbow' || o.weapon === 'musket' || o.weapon === 'firetube' ? 'gun' : '', aimW: 0, flinch: 0, weapon: o.weapon, child: o.child };
  for (const [name, clip] of source.clips) real.actions.set(name, real.mixer.clipAction(clip));

  body.scale.setScalar(SCALE * (o.female ? 0.91 : 1.01) * (0.97 + (o.seed % 7) * 0.01)); // people are not all one height
  body.traverse((m) => { if ((m as THREE.SkinnedMesh).isSkinnedMesh && (m as THREE.SkinnedMesh).geometry.getAttribute('color')) { real.skins.push(m as THREE.SkinnedMesh); real.whole.push((m as THREE.SkinnedMesh).geometry); } });
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

/** Show one of a villager's tools in his hand, or none with ''. */
export function hold(p: RealPerson, kind: string): void {
  if (p.toolKind === kind) return;
  p.props.get(p.toolKind)?.traverse((o) => { o.visible = false; });
  const t = p.props.get(kind);
  if (t) t.traverse((o) => { o.visible = true; });
  p.toolKind = kind;
}
/** Show a load on a villager's back: 'sack', 'logs', or '' for none. */
export function bear(p: RealPerson, kind: string): void {
  for (const k of ['sack', 'logs']) { const t = p.props.get(k); if (t && t.visible !== (k === kind)) t.traverse((o) => { o.visible = k === kind; }); }
}

const UP = new THREE.Vector3(0, 1, 0), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), q3 = new THREE.Quaternion(), q4 = new THREE.Quaternion(), v1 = new THREE.Vector3(), dir = new THREE.Vector3();
/** Turn a bone so that it lies along a direction in the world, by a share `w` of the way from where the motion left it. */
function point(b: THREE.Object3D | undefined, d: THREE.Vector3, w: number): void {
  if (!b?.parent) return;
  b.updateWorldMatrix(true, false);
  b.getWorldQuaternion(q1);
  v1.copy(UP).applyQuaternion(q1).normalize(); // a bone lies along its own y
  q2.setFromUnitVectors(v1, d);
  q3.identity().slerp(q2, w).multiply(q1);
  b.parent.getWorldQuaternion(q4).invert();
  b.quaternion.copy(q4.multiply(q3));
}
/**
 * Level a ranged weapon over whatever motion is playing: a bow held out in the left hand with the right drawn back
 * to the cheek, or a gun or crossbow brought up to the shoulder. `yaw` is the way the figure faces; `want` is how
 * far to bring it up, 0 to 1. Call after the motion has been advanced.
 */
export function level(p: RealPerson, yaw: number, want: number, dt: number): void {
  p.aimW += (want - p.aimW) * Math.min(1, dt * 9);
  if (!p.aim || p.aimW < 0.02) return;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw), w = p.aimW;
  // A direction given as so much forward, so much to the figure's left, so much up.
  const to = (f: number, l: number, u: number): THREE.Vector3 => dir.set(fx * f + lx * l, u, fz * f + lz * l).normalize();
  const B = (n: string) => p.bones.get(n);
  if (p.aim === 'bow') {
    point(B('DEF-upper_armL'), to(1, 0.22, 0.02), w); point(B('DEF-forearmL'), to(1, 0.06, 0.04), w);
    // The drawing arm: elbow back and level, the hand brought forward again to the jaw.
    point(B('DEF-upper_armR'), to(-0.75, -0.55, 0.08), w); point(B('DEF-forearmR'), to(0.95, 0.25, 0.12), w);
  } else {
    point(B('DEF-upper_armR'), to(0.5, -0.25, -0.7), w); point(B('DEF-forearmR'), to(1, 0.08, 0.1), w);
    point(B('DEF-upper_armL'), to(0.75, 0.1, -0.5), w); point(B('DEF-forearmL'), to(0.8, -0.5, 0.12), w);
  }
}

const BLOOD = new THREE.Color(0x7a1010);
/**
 * Show how badly someone is hurt. 0 whole; 1 cut and bloodied, with half their gear knocked off; 2 worse, the rest
 * of the gear gone; 3 as they die. A villager's clothes tear to show the skin beneath. Blood and tears are painted
 * onto a copy of the figure's own surface, so the whole one is there to go back to when they are healed. Returns
 * the pieces of gear this change knocked off (now hidden), for the game to throw to the ground. `marks` false
 * leaves the blood and the torn clothes out.
 */
export function wounds(p: RealPerson, level: number, marks: boolean): THREE.Object3D[] {
  const was = p.hurt, off: THREE.Object3D[] = [];
  p.hurt = level;
  // Gear: a shield or a helmet first, everything by the second stage. A villager keeps his hat until he is badly hurt.
  const lose = level <= 0 ? 0 : level === 1 ? (p.soldier ? Math.ceil(p.gear.length / 2) : 0) : p.gear.length;
  p.gear.forEach((list, i) => { for (const piece of list) { if (i < lose && piece.visible && level > was) off.push(piece); piece.visible = i >= lose; } });
  if (p.spare) p.spare.visible = p.gear.some((list, i) => i < lose && list.some((q) => q.parent === p.spare!.parent));
  for (let n = 0; n < p.skins.length; n++) if (p.skins[n].geometry !== p.whole[n]) { p.skins[n].geometry.dispose(); p.skins[n].geometry = p.whole[n]; }
  if (level <= 0 || !marks || !p.skins.length) return off;
  // Where the cuts fall: points on the body between the knees and the neck, the same ones each time for this person.
  const base = p.whole[0].getAttribute('position'), box = new THREE.Box3().setFromBufferAttribute(base as THREE.BufferAttribute);
  const H = box.max.y - box.min.y, mid = (box.min.x + box.max.x) / 2;
  const rnd = (k: number): number => (((p.seed * 7919 + k * 104729) * 2654435761) >>> 0) / 4294967296;
  const cuts: THREE.Vector3[] = [], tears: THREE.Vector3[] = [], v = new THREE.Vector3();
  const wantCuts = [0, 3, 6, 9][Math.min(3, level)], wantTears = p.soldier ? 0 : [0, 2, 4, 6][Math.min(3, level)];
  for (let k = 0; k < 400 && (cuts.length < wantCuts || tears.length < wantTears); k++) {
    v.fromBufferAttribute(base, Math.floor(rnd(k) * base.count));
    const t = (v.y - box.min.y) / H, ax = Math.abs(v.x - mid) / H;
    if (t < 0.3 || t > 0.86) continue;
    // Hands and forearms are thick with points; keep most of the marks to the trunk, the upper arms and the thighs.
    if (ax > 0.3 || (ax > 0.12 && t > 0.6 && k % 3 !== 0)) continue;
    // Clothes do not tear open over the chest or the loins.
    const modest = (t > 0.64 && t < 0.82 && ax < 0.13) || (t > 0.42 && t < 0.58 && ax < 0.1);
    if (k % 2 === 0 && tears.length < wantTears && !modest) tears.push(v.clone());
    else if (cuts.length < wantCuts) cuts.push(v.clone());
  }
  const rc = H * (0.03 + 0.007 * level), rt = H * (0.055 + 0.012 * level), skin = new THREE.Color(p.skin), c = new THREE.Color();
  for (let n = 0; n < p.skins.length; n++) {
    const src = p.whole[n], g = new THREE.BufferGeometry();
    for (const name of Object.keys(src.attributes)) g.setAttribute(name, name === 'color' ? src.getAttribute(name).clone() : src.getAttribute(name));
    g.setIndex(src.getIndex());
    g.boundingBox = src.boundingBox; g.boundingSphere = src.boundingSphere;
    const pos = g.getAttribute('position'), col = g.getAttribute('color');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const rag = 0.75 + ((((i * 2654435761) >>> 0) % 1000) / 1000) * 0.5; // a ragged edge
      let torn = false, bled = 0;
      for (const q of tears) if (v.distanceTo(q) < rt * rag) { torn = true; break; }
      for (const q of cuts) { const d = v.distanceTo(q) / (rc * rag); if (d < 1) bled = Math.max(bled, d < 0.6 ? 1 : 1 - (d - 0.6) / 0.4); }
      // The middle of a tear is cut as well.
      for (const q of tears) { const d = v.distanceTo(q) / (rc * 0.7 * rag); if (d < 1) bled = Math.max(bled, 0.85); }
      if (!torn && bled === 0) continue;
      c.fromBufferAttribute(col as THREE.BufferAttribute, i);
      if (torn) c.copy(skin);
      if (bled > 0) c.lerp(BLOOD, bled);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    p.skins[n].geometry = g;
  }
  return off;
}

const along = new THREE.Vector3(), aside = new THREE.Vector3(), h1 = new THREE.Vector3(), h2 = new THREE.Vector3();
/**
 * The dead do not all lie alike. Over the recorded fall, `kind` 1 lays both legs out flat and a little apart, and
 * `kind` 2 throws one arm up past the head and the other across the body; 0 leaves the fall as recorded. `w` is how
 * far to bring it in, 0 to 1. Call after the motion has been advanced.
 */
export function sprawl(p: RealPerson, kind: number, w: number): void {
  if (kind === 0 || w <= 0) return;
  const hips = p.bones.get('DEF-hips'), head = p.bones.get('DEF-head');
  if (!hips || !head) return;
  hips.updateWorldMatrix(true, false); head.updateWorldMatrix(true, false);
  along.copy(head.getWorldPosition(h1)).sub(hips.getWorldPosition(h2)).setY(0);
  if (along.lengthSq() < 1e-6) return;
  along.normalize();
  aside.set(along.z, 0, -along.x);
  const to = (f: number, l: number, u: number): THREE.Vector3 => dir.set(along.x * f + aside.x * l, u, along.z * f + aside.z * l).normalize();
  if (kind === 1) {
    for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
      point(p.bones.get('DEF-thigh' + side), to(-1, sign * 0.28, -0.03), w);
      point(p.bones.get('DEF-shin' + side), to(-1, sign * 0.2, 0), w);
    }
  } else {
    point(p.bones.get('DEF-upper_armL'), to(0.8, 0.55, 0), w); point(p.bones.get('DEF-forearmL'), to(1, 0.1, 0.02), w);
    point(p.bones.get('DEF-upper_armR'), to(-0.5, -0.7, 0.1), w); point(p.bones.get('DEF-forearmR'), to(-0.2, 0.9, 0.25), w);
  }
}

/** Put a figure's arms round someone standing close in front of them: `high` round the neck, otherwise round the waist. Call after the motion has been advanced. */
export function embrace(p: RealPerson, yaw: number, high: boolean): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw), up = high ? 0.32 : -0.42;
  const to = (f: number, l: number, u: number): THREE.Vector3 => dir.set(fx * f + lx * l, u, fz * f + lz * l).normalize();
  for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
    point(p.bones.get('DEF-upper_arm' + side), to(0.85, sign * 0.34, up), 1);
    point(p.bones.get('DEF-forearm' + side), to(0.55, sign * -0.8, up * 0.4 + 0.05), 1);
  }
}

/** Seat a figure astride: thighs out round the animal's barrel and forward, shins hanging. Call after the motion has been advanced. */
export function astride(p: RealPerson, yaw: number): void {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
  const to = (f: number, l: number, u: number): THREE.Vector3 => dir.set(fx * f + lx * l, u, fz * f + lz * l).normalize();
  for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
    point(p.bones.get('DEF-thigh' + side), to(0.5, sign * 0.62, -0.6), 1);
    point(p.bones.get('DEF-shin' + side), to(-0.12, sign * 0.1, -1), 1);
  }
}
