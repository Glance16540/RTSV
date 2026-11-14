// Light after dark that falls on what stands near it. Each building already shows a lamp and paints a warm
// pool on the ground; here the nearest of those lamps, and the torches some soldiers carry, are given real
// light, so walls, people and trees beside them are lit on the side that faces the flame.
//
// Real lights cost on every surface drawn, so there is a fixed, small number of them, and they are handed each
// frame to the flames nearest the middle of the view. Every other flame keeps its painted glow and no more.

import * as THREE from 'three';

/** How many real lights there are. Fixed, so that nothing has to be rebuilt as they move from flame to flame. */
export const NIGHT_LIGHTS = 6;
const REACH = 6.5;

export interface Flame { x: number; y: number; z: number; /** A seed for its guttering. */ id: number; /** A torch is dimmer than a lamp by a door. */ torch?: boolean }

/** Whether this soldier is one who carries a torch: the leader, and about one in three of the rest. */
export const carriesTorch = (id: number, leader: boolean): boolean => leader || id % 3 === 0;

/** The flames that get real light: the nearest to the middle of the view, lamps and torches alike. */
export function nearestFlames<T extends { x: number; z: number }>(flames: T[], cx: number, cz: number, n = NIGHT_LIGHTS): T[] {
  if (flames.length <= n) return flames;
  return flames.map((f) => ({ f, d: (f.x - cx) ** 2 + (f.z - cz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.f);
}

export class NightLights {
  private pool: THREE.PointLight[] = [];
  private torches = new Map<number, { flame: THREE.Sprite; pool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; seen: number }>();
  private poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private frameNo = 0;
  private on = true;

  constructor(private scene: THREE.Scene, private glow: THREE.Texture) {
    for (let i = 0; i < NIGHT_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffa85a, 0, REACH, 1.5);
      l.castShadow = false;
      this.pool.push(l);
      scene.add(l);
    }
  }

  /**
   * `night` is 0 by day to 1 in full dark. `lamps` are the lit lamps in view; `torches` the torch-bearers in view,
   * each at the height of the flame. With `real` off (the player's setting) the flames are still drawn but cast nothing.
   */
  update(night: number, clock: number, cx: number, cz: number, lamps: Flame[], torches: Flame[], real: boolean): void {
    this.frameNo++;
    // Lights that are switched off are taken out of the reckoning altogether, which is where the saving is.
    const want = real && night > 0.02;
    if (want !== this.on) { this.on = want; for (const l of this.pool) l.visible = want; }
    if (want) {
      const lit = nearestFlames([...lamps, ...torches], cx, cz);
      this.pool.forEach((l, i) => {
        const f = lit[i];
        if (!f) { l.intensity = 0; return; }
        const flick = 0.85 + 0.15 * Math.sin(clock * 9 + f.id * 1.3) * Math.sin(clock * 4.3 + f.id);
        l.position.set(f.x, f.y, f.z);
        l.intensity = night * flick * (f.torch ? 4.5 : 7);
      });
    }
    // A torch is a flame at the bearer's shoulder and the glow it throws at their feet.
    for (const t of night > 0.02 ? torches : []) {
      let v = this.torches.get(t.id);
      if (!v) {
        const mat = (color: number): { map: THREE.Texture; color: number; transparent: true; opacity: number; blending: THREE.Blending; depthWrite: false; fog: false } =>
          ({ map: this.glow, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
        const flame = new THREE.Sprite(new THREE.SpriteMaterial(mat(0xffc468)));
        const pool = new THREE.Mesh(this.poolGeo, new THREE.MeshBasicMaterial(mat(0xff9a48)));
        flame.material.userData.outlineParameters = { visible: false };
        pool.material.userData.outlineParameters = { visible: false };
        flame.scale.setScalar(0.42);
        pool.scale.setScalar(3.4);
        pool.renderOrder = 3;
        this.scene.add(flame, pool);
        this.torches.set(t.id, (v = { flame, pool, seen: 0 }));
      }
      v.seen = this.frameNo;
      const flick = 0.8 + 0.2 * Math.sin(clock * 11 + t.id * 2.1) * Math.sin(clock * 5.7 + t.id);
      v.flame.position.set(t.x, t.y, t.z);
      v.pool.position.set(t.x, t.y - 1.0, t.z);
      v.flame.material.opacity = night * flick;
      v.pool.material.opacity = night * flick * 0.34;
    }
    for (const [id, v] of this.torches) if (v.seen !== this.frameNo) { this.scene.remove(v.flame, v.pool); v.flame.material.dispose(); v.pool.material.dispose(); this.torches.delete(id); }
  }
}
