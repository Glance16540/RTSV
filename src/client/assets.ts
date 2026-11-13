// Optional generated assets (icons, 3D models, title art) dropped into public/assets.
// Anything missing falls back to the built-in emoji icon or procedural model.

import * as THREE from 'three';
import { Character, setLeaderCharacter, setLeaderPersona } from '../sim/leaders';
import { setTemperament } from '../sim/temper';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Manifest { icons: Record<string, string>; models: Record<string, string>; art: Record<string, string>; voice: Record<string, string>; music?: Record<string, string>; credits?: Record<string, string>; personas?: Record<string, string>; characters?: Record<string, Character>; portraits?: Record<string, string> }
/** Optional per-model corrections in public/assets/tweaks.json, keyed by model name. */
interface Tweak { scale?: number; yaw?: number; y?: number }

const BASE = 'assets/';
let manifest: Manifest = { icons: {}, models: {}, art: {}, voice: {} };
let tweaks: Record<string, Tweak> = {};
const models = new Map<string, { root: THREE.Object3D; size: THREE.Vector3 }>();

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadAssets(progress: (done: number) => void = () => {}): Promise<void> {
  manifest = { ...manifest, ...(await json<Partial<Manifest>>(BASE + 'manifest.json', {})) };
  // A nation whose recordings are of its second leader is led by that leader in the game.
  for (const [civ, who] of Object.entries(manifest.personas ?? {})) setLeaderPersona(civ, who === 'alt');
  for (const [civ, c] of Object.entries(manifest.characters ?? {})) { setLeaderCharacter(civ, c); setTemperament(civ, c.temper); }
  if (!Object.keys(manifest.models).length) return;
  tweaks = await json(BASE + 'tweaks.json', {});
  const loader = new GLTFLoader();
  let loaded = 0;
  const total = Object.keys(manifest.models).length;
  await Promise.all(Object.entries(manifest.models).map(async ([key, file]) => {
    try {
      const gltf = await loader.loadAsync(BASE + 'models/' + file);
      const scene = gltf.scene;
      scene.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.castShadow = o.receiveShadow = true;
        // There is no environment map, so metallic surfaces would render black.
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if ('metalness' in m) m.metalness = 0;
      });
      // Re-centre on the ground so every model can be scaled the same way.
      const box = new THREE.Box3().setFromObject(scene);
      const c = box.getCenter(new THREE.Vector3());
      scene.position.set(-c.x, -box.min.y, -c.z);
      const root = new THREE.Group();
      root.add(scene);
      models.set(key, { root, size: box.getSize(new THREE.Vector3()) });
    } catch (e) {
      console.warn(`Could not load model ${file}`, e);
    }
    progress(++loaded / total);
  }));
}

/** HTML for an icon: the generated image if present, otherwise the emoji. */
/** Which way a town leans, for anything drawn differently in a pious town and a decadent one. */
export type Leaning = '' | 'holy' | 'low';
export const leaningOf = (virtue: number): Leaning => (virtue >= 30 ? 'holy' : virtue <= -30 ? 'low' : '');
let leaning: Leaning = '';
/** The player's own town decides how their icons are drawn: wholesome when pious, gaudy or run-down when decadent. */
export function setIconLeaning(virtue: number): void { leaning = leaningOf(virtue); }

export function ico(key: string, emoji: string): string {
  const file = (leaning && manifest.icons[`${key}_${leaning}`]) || manifest.icons[key] || (key === 'villager' ? manifest.icons.villager_m : undefined);
  return file ? `<img class="ico" src="${BASE}icons/${file}" alt="" draggable="false">` : emoji;
}

/** HTML for a leader's portrait: the picture their voice actor sent, else a painted `leader_<civ>` icon, else nothing. */
export function portrait(civ: string): string {
  const own = manifest.portraits?.[civ];
  if (own) return `<img class="ico" src="${BASE}voice/${own}" alt="" draggable="false">`;
  return manifest.icons['leader_' + civ] ? ico('leader_' + civ, '') : '';
}

/** Who voiced a nation's leader, if their recordings came with a credit. */
export const voiceCredit = (civ: string): string => manifest.credits?.[civ] ?? '';

/** Recording of a leader's line, if one has been added. */
export function voiceUrl(key: string): string | null {
  const file = manifest.voice[key];
  return file ? `${BASE}voice/${file}` : null;
}

/** A piece of music dropped into public/assets/music (`theme` is the main theme), if it is there. */
export function musicUrl(key: string): string | null {
  const file = manifest.music?.[key];
  return file ? `${BASE}music/${file}` : null;
}

export function artUrl(key: string): string | null {
  const file = manifest.art[key];
  return file ? `${BASE}art/${file}` : null;
}

/**
 * A generated model scaled to `fit` tiles: by footprint for buildings, by height for units.
 * Looks for an age-specific variant first (e.g. `house_2`), then the plain name.
 */
export function generatedModel(type: string, age: number, fit: number, by: 'footprint' | 'height'): THREE.Group | null {
  const key = models.has(`${type}_${age}`) ? `${type}_${age}` : type;
  const m = models.get(key);
  if (!m) return null;
  const t = tweaks[key] ?? {};
  const g = new THREE.Group();
  const inner = m.root.clone(true);
  const span = by === 'footprint' ? Math.max(m.size.x, m.size.z) : m.size.y;
  inner.scale.setScalar((fit / (span || 1)) * (t.scale ?? 1));
  inner.rotation.y = t.yaw ?? 0;
  inner.position.y = t.y ?? 0;
  g.add(inner);
  return g;
}
