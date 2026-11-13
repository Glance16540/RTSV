// A trial of people drawn from a real human figure with a skeleton and recorded motion, in place of the figures
// assembled from blocks. The body and its motions are the Universal Animation Library mannequin by Quaternius
// (CC0; see public/models/people/SOURCE.txt). It comes bare and grey, so it is dressed here by colouring each
// part of the body by the bone that moves it: skin on head and forearms, a tunic in the player's colour to the
// thigh, breeches, boots, a belt, and hair.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** How tall a person stands in the game's units; the model is 1.83 of its own. */
const SCALE = 1.02 / 1.83;

let source: { scene: THREE.Object3D; clips: Map<string, THREE.AnimationClip> } | null = null;
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
      c.tracks = c.tracks.filter((t) => !(t.name.startsWith('root.') && t.name.endsWith('.position')));
      clips.set(c.name, c);
    }
    source = { scene: g.scene, clips };
    for (const w of waiting.splice(0)) w();
  }, undefined, () => { failed = true; });
}
export const peopleReady = (): boolean => !!source;

export interface RealPerson {
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  now: string;
  /** The right hand, for a tool. */
  hand: THREE.Object3D | null;
  tool: THREE.Object3D | null;
  toolKind: string;
}

const dressed = new Map<string, THREE.BufferGeometry[]>();
const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
cloth.userData.outlineParameters = { visible: false };

/** Colour one piece of the body by which bone moves each point of it. */
function dress(geo: THREE.BufferGeometry, bones: string[], look: { skin: number; hair: number; tunic: number; legs: number; seed: number }): THREE.BufferGeometry {
  const g = geo.clone();
  const pos = g.getAttribute('position'), si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  const col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const skin = new THREE.Color(look.skin), hair = new THREE.Color(look.hair), tunic = new THREE.Color(look.tunic), legs = new THREE.Color(look.legs);
  const boot = new THREE.Color(0x4a3222), belt = new THREE.Color(0x3a2616), trim = tunic.clone().multiplyScalar(0.7);
  const sleeves = look.seed % 3 === 0; // some wear their sleeves long
  for (let i = 0; i < pos.count; i++) {
    // The bone with the most say over this point.
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const bone = bones[best] ?? '', y = pos.getY(i), z = pos.getZ(i);
    if (/head/.test(bone)) c.copy(y > 1.7 || (z < 0.0 && y > 1.6) ? hair : skin); // hair over the crown and down the back of the head
    else if (/neck/.test(bone)) c.copy(skin);
    else if (/hand|thumb|f_/.test(bone)) c.copy(skin);
    else if (/forearm/.test(bone)) c.copy(sleeves ? tunic : skin);
    else if (/upper_arm|shoulder/.test(bone)) c.copy(tunic);
    else if (/spine|hips/.test(bone)) c.copy(y > 1.0 && y < 1.05 ? belt : y > 1.42 && Math.abs(pos.getX(i)) < 0.05 && z > 0 ? trim : tunic);
    else if (/thigh/.test(bone)) c.copy(y > 0.76 ? (y < 0.79 ? trim : tunic) : legs); // the tunic's skirt, with a darker hem
    else if (/shin/.test(bone)) c.copy(y < 0.26 ? boot : legs);
    else if (/foot|toe/.test(bone)) c.copy(boot);
    else c.copy(tunic);
    // A little unevenness, so cloth is not one flat colour.
    const n = 0.94 + (((i * 2654435761) >>> 0) % 100) / 800;
    col[i * 3] = c.r * n; col[i * 3 + 1] = c.g * n; col[i * 3 + 2] = c.b * n;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const TOOLS: Record<string, () => THREE.Object3D> = {
  axe: () => tool(0.5, [[0.1, 0.13, 0.02, 0.05, 0.42, 0]], 0x8a8e94),
  pick: () => tool(0.52, [[0.3, 0.035, 0.035, 0, 0.5, 0]], 0x7a7e84),
  hammer: () => tool(0.34, [[0.1, 0.07, 0.07, 0, 0.33, 0]], 0x6a6e74),
  hoe: () => tool(0.62, [[0.03, 0.02, 0.12, 0, 0.6, 0.06]], 0x7a7e84),
};
function tool(len: number, heads: number[][], metal: number): THREE.Object3D {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.9 }), iron = new THREE.MeshStandardMaterial({ color: metal, roughness: 0.5, metalness: 0.6 });
  wood.userData.outlineParameters = iron.userData.outlineParameters = { visible: false };
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, len, 6).translate(0, len / 2 - 0.08, 0), wood);
  g.add(haft);
  for (const [w, h, d, x, y, z] of heads) g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(x, y - 0.08, z), iron));
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

/** A dressed figure, or null if the model has not arrived (or could not be fetched). */
export function makePerson(look: { skin: number; hair: number; tunic: number; seed: number }): { g: THREE.Group; real: RealPerson } | null {
  if (!source) return null;
  const legs = [0x6a5238, 0x54483c, 0x7a6a4c, 0x4a4238][look.seed % 4];
  const body = cloneSkinned(source.scene);
  const key = `${look.skin}|${look.hair}|${look.tunic}|${legs}|${look.seed % 3}`;
  let n = 0, hand: THREE.Object3D | null = null;
  body.traverse((o) => {
    if (o.name === 'DEF-hand.R' || o.name === 'DEF-handR') hand = o;
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    let set = dressed.get(key);
    if (!set) dressed.set(key, (set = []));
    set[n] ??= dress(m.geometry, m.skeleton.bones.map((b) => b.name), { ...look, legs });
    m.geometry = set[n++];
    m.material = cloth;
    m.castShadow = true;
    m.receiveShadow = false;
    m.frustumCulled = false; // its bounds are the rest pose's, not where the motion has taken it
  });
  body.scale.setScalar(SCALE * (0.96 + (look.seed % 7) * 0.012)); // people are not all one height
  const g = new THREE.Group();
  g.add(body);
  const mixer = new THREE.AnimationMixer(body), actions = new Map<string, THREE.AnimationAction>();
  for (const [name, clip] of source.clips) actions.set(name, mixer.clipAction(clip));
  const idle = actions.get('Idle_Loop')!;
  idle.play();
  mixer.update((look.seed % 40) / 10); // not all breathing in step
  return { g, real: { mixer, actions, now: 'Idle_Loop', hand, tool: null, toolKind: '' } };
}

/** Move to another motion, blending out of the one playing. `once` plays it through and holds the last pose. */
export function play(p: RealPerson, name: string, speed = 1, once = false): void {
  const next = p.actions.get(name);
  if (!next) return;
  next.timeScale = speed;
  if (p.now === name) return;
  const prev = p.actions.get(p.now);
  next.reset();
  next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  next.clampWhenFinished = once;
  next.play();
  if (prev) prev.crossFadeTo(next, 0.18, false);
  p.now = name;
}

/** Put a tool in the right hand, or take it away with ''. */
export function hold(p: RealPerson, kind: string): void {
  if (p.toolKind === kind || !p.hand) return;
  p.tool?.removeFromParent();
  p.tool = TOOLS[kind]?.() ?? null;
  p.toolKind = kind;
  if (p.tool) {
    // The hand bone's own scale is the model's; undo the figure's scaling so the tool is the size it was made.
    p.tool.scale.setScalar(1 / SCALE * 0.5);
    p.tool.rotation.set(Math.PI / 2, 0, 0);
    p.hand.add(p.tool);
  }
}
