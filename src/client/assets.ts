// Optional generated assets (icons, 3D models, title art) dropped into public/assets.
// Anything missing falls back to the built-in emoji icon or procedural model.

import * as THREE from 'three';
import { setLeaderPersona } from '../sim/leaders';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Manifest { icons: Record<string, string>; models: Record<string, string>; art: Record<string, string>; voice: Record<string, string>; credits?: Record<string, string>; personas?: Record<string, string> }
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

export async function loadAssets(): Promise<void> {
  manifest = { ...manifest, ...(await json<Partial<Manifest>>(BASE + 'manifest.json', {})) };
  // A nation whose recordings are of its second leader is led by that leader in the game.
  for (const [civ, who] of Object.entries(manifest.personas ?? {})) setLeaderPersona(civ, who === 'alt');
  if (!Object.keys(manifest.models).length) return;
  tweaks = await json(BASE + 'tweaks.json', {});
  const loader = new GLTFLoader();
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
  }));
}

/** HTML for an icon: the generated image if present, otherwise the emoji. */
export function ico(key: string, emoji: string): string {
  const file = manifest.icons[key] ?? (key === 'villager' ? manifest.icons.villager_m : undefined);
  return file ? `<img class="ico" src="${BASE}icons/${file}" alt="" draggable="false">` : emoji;
}

/** Who voiced a nation's leader, if their recordings came with a credit. */
export const voiceCredit = (civ: string): string => manifest.credits?.[civ] ?? '';

/** Recording of a leader's line, if one has been added. */
export function voiceUrl(key: string): string | null {
  const file = manifest.voice[key];
  return file ? `${BASE}voice/${file}` : null;
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
