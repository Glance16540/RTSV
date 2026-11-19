// Trees that move in the wind, and crowns that read as leaves (docs/systems-board, "Land and wildlife": trees did not
// sway and their leaves were faceted masses).
//
// Both are done in the shaders of the instanced trees (renderer.ts buildTrees), so they cost no draw calls and no work
// on the CPU beyond two numbers a frame:
//   - sway: each tree leans and springs back, the crown more than the bole and the top most of all, in one wind from
//     one quarter of the sky, each tree a little out of step with its neighbours. The weather makes it stronger: a
//     storm bends the crowns. The shadow sways with the tree (its depth material is moved the same way).
//   - crowns: the faceted masses of leaves are dappled with a fine pattern of light and dark clusters, laid in world
//     space so it does not swim as the camera moves, and the facets' hard edges are softened toward the leaf colour.
import * as THREE from 'three';

/** What every swaying tree reads each frame: the time, and how strong the wind is (0 still air, 1 a storm). */
export const WIND = { time: { value: 0 }, strength: { value: 0.25 } };

/** Set the wind for this frame: `weather` is how far the weather has come in (0 to 1). */
export function windNow(clock: number, weather: number): void {
  WIND.time.value = clock;
  WIND.strength.value = 0.22 + Math.min(1, Math.max(0, weather)) * 0.78;
}

// The sway, in the tree's own space: the wind's direction is turned into it, so every tree bends the same way whatever
// way it was set. Heights in the tree's own units: the kit's trees stand about 1.6 high.
const SWAY = /* glsl */ `
  {
    vec3 tw = normalize(transpose(mat3(instanceMatrix)) * vec3(0.8, 0.0, 0.6));
    float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.29;
    float h = max(transformed.y - 0.25, 0.0);
    float gust = 0.55 + 0.45 * sin(uWindTime * 0.31 + ph * 0.2);
    float s = (sin(uWindTime * 1.4 + ph) * 0.7 + sin(uWindTime * 2.9 + ph * 1.7) * 0.3) * gust;
    float bend = uWind * h * h * 0.06 * aSway;
    transformed += tw * (s * bend + bend * 0.5 * uWind);
    transformed.y -= abs(s) * bend * 0.15 * h;
  }
`;

const PREFIX = /* glsl */ `uniform float uWindTime;\nuniform float uWind;\nattribute float aSway;\n`;

/** Make a tree material sway (and, for leaves, dapple). Returns the material, changed in place. */
export function swaying<T extends THREE.Material>(m: T, leaves = false): T {
  const before = m.onBeforeCompile;
  m.onBeforeCompile = (sh, gl) => {
    before?.call(m, sh, gl);
    sh.uniforms.uWindTime = WIND.time; sh.uniforms.uWind = WIND.strength;
    sh.vertexShader = PREFIX + (leaves ? 'varying vec3 vLeafAt;\n' : '') + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n#ifdef USE_INSTANCING\n${SWAY}\n#endif`);
    if (leaves) {
      sh.vertexShader = sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vLeafAt = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
      // A world-space dapple of leaf clusters: two scales of soft value noise, darker in the hollows.
      sh.fragmentShader = 'varying vec3 vLeafAt;\n' + LEAF_NOISE + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n  {\n    float n = leafNoise(vLeafAt * 7.0) * 0.62 + leafNoise(vLeafAt * 17.0) * 0.38;\n    diffuseColor.rgb *= 0.66 + 0.68 * n;\n  }`);
    }
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + (leaves ? '|sway-leaf' : '|sway');
  return m;
}

const LEAF_NOISE = /* glsl */ `
float leafHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float leafNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(leafHash(i), leafHash(i + vec3(1, 0, 0)), f.x), mix(leafHash(i + vec3(0, 1, 0)), leafHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(leafHash(i + vec3(0, 0, 1)), leafHash(i + vec3(1, 0, 1)), f.x), mix(leafHash(i + vec3(0, 1, 1)), leafHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`;

/**
 * Mark a tree's geometry as one that sways. Only marked geometry moves: everything else has no such attribute, which
 * reads as 0. That is how the inked edges move with the tree: the outline pass (three's OutlineEffect) draws every
 * mesh with one shader of its own, which is given the same sway here, and it moves only what is marked.
 */
export function swayable(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.getAttribute('aSway')) g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(1), 1));
  return g;
}
// The outline pass's shader sways what is marked, as the tree's own does.
const outline = THREE.ShaderMaterial.prototype.onBeforeCompile;
THREE.ShaderMaterial.prototype.onBeforeCompile = function (this: THREE.ShaderMaterial, sh, gl) {
  outline.call(this, sh, gl);
  if (this.type !== 'OutlineEffect' || sh.vertexShader.includes('uWindTime')) return;
  sh.uniforms.uWindTime = WIND.time; sh.uniforms.uWind = WIND.strength;
  sh.vertexShader = PREFIX + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n#ifdef USE_INSTANCING\n${SWAY}\n#endif`);
};

const depthM = new Map<string, THREE.MeshDepthMaterial>();
/** The shadow of a swaying tree: the same sway in the depth pass, so the shadow moves with the crown. */
export function swayingShadow(): THREE.MeshDepthMaterial {
  let m = depthM.get('d');
  if (!m) depthM.set('d', (m = swaying(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }))));
  return m;
}
