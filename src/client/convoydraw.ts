// Convoys on the campaign map (src/sim/convoys.ts): food, goods or people sent between a people's own towns, a season
// on the road. Drawn as the markets' caravans are (caravandraw.ts), a little train of pack mules under the people's
// colour, walking one way along its road from the town it left towards the town it is bound for while the season
// stands, and over again; a family moving or settlers going out are drawn the same. Where the road crosses a sea lane
// (two lands with no border between them, joined by water) the train is put aboard a small boat for that leg, a hull
// with a mast and a sail in the people's colour, and walks again once it is ashore.
import * as THREE from 'three';
import type { Campaign } from '../sim/campaign';
import type { Convoy } from '../sim/convoys';
import { CARAVAN_SIZE, Walker, caravanTrain } from './caravandraw';

const mats = new Map<number, THREE.MeshLambertMaterial>();
const mat = (color: number): THREE.MeshLambertMaterial => { let m = mats.get(color); if (!m) mats.set(color, (m = new THREE.MeshLambertMaterial({ color }))); return m; };
const HULL = new THREE.BoxGeometry(0.9, 0.34, 2.6), BOW = new THREE.ConeGeometry(0.45, 0.9, 4), MAST = new THREE.CylinderGeometry(0.05, 0.06, 1.9, 6), SAIL = new THREE.BoxGeometry(1.2, 1.1, 0.04), LOAD = new THREE.BoxGeometry(0.6, 0.3, 0.8);

/** A small boat for the sea legs, facing along +z as the train does, at the train's scale. */
export function convoyBoat(color: number): THREE.Group {
  const g = new THREE.Group(), wood = mat(0x6a4a2c);
  const hull = new THREE.Mesh(HULL, wood); hull.position.y = 0.17; g.add(hull);
  const bow = new THREE.Mesh(BOW, wood); bow.rotation.set(Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, 0.38); bow.position.set(0, 0.17, 1.72); g.add(bow);
  const mast = new THREE.Mesh(MAST, wood); mast.position.set(0, 1.2, 0.2); g.add(mast);
  const sail = new THREE.Mesh(SAIL, mat(color)); sail.position.set(0, 1.35, 0.26); g.add(sail);
  const load = new THREE.Mesh(LOAD, mat(0x8a6a44)); load.position.set(0, 0.48, -0.7); g.add(load);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  g.scale.setScalar(CARAVAN_SIZE);
  g.visible = false;
  return g;
}

/** Which legs of a road go by sea: between two lands with no border, joined by a sea lane. */
export function seaLegs(c: Campaign, road: readonly number[]): boolean[] {
  return road.slice(1).map((b, i) => {
    const a = road[i];
    return !c.territories[a]?.adj.includes(b) && (c.lanes ?? []).some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  });
}

/** A convoy on the road, ready to walk: its piece and its road, one way, with a boat for any leg by sea. */
export function convoyWalker(c: Campaign, x: Convoy): Walker {
  const pts = x.road.map((id) => [c.territories[id].x, c.territories[id].y] as [number, number]);
  const color = c.factions[x.owner]?.color ?? 0x806040, train = caravanTrain(color, false), sea = seaLegs(c, x.road);
  if (!sea.some(Boolean)) return { g: train, pts, ph: (x.id * 0.382) % 1, one: true };
  const g = new THREE.Group(), boat = convoyBoat(color);
  g.add(train, boat);
  return { g, pts, ph: (x.id * 0.382) % 1, one: true, sea, boat, train };
}
/** Every convoy on the road, as walkers. */
export const convoyWalkers = (c: Campaign): Walker[] => (c.convoys ?? []).filter((x) => x.road.length > 1).map((x) => convoyWalker(c, x));
