// The great buildings of Mali and Kush, drawn as their own (they borrowed the Abbasids' mosque and Egypt's pyramid).
//
// On the field each is the people's Wonder (makeBuilding in models.ts asks here first); on the campaign map each is the
// great building of their towns (worldmap.ts, keeps 'sahel' and 'meroe'). Shapes only: nothing here is a rule.
//   - Mali: a great mosque of mud brick in the Sahel manner: a long prayer hall behind a towering east front of three
//     tapering towers, each crowned with a cone and an egg, buttresses rising in ranks above the parapet, and rows of
//     wooden beams standing out of the walls as the masons' scaffolding.
//   - Kush: the pyramids of Meroë: steep and narrow, close together on a rise of sand, each with its chapel at its foot
//     behind a little gate of two pylons.
import * as THREE from 'three';
import { banner, bx, mesh, toon } from './shapes';

const MUD = 0xb88656, MUD_DARK = 0x9a6c42, MUD_LIGHT = 0xc89668, BEAM = 0x5a3e28, EGG = 0xf2ece0;
const SAND = 0xd8bc84, SANDSTONE = 0xc8a070, SANDSTONE_DARK = 0xa8804e, GOLD = 0xd8b040;

/** A square tower that narrows as it rises, set square to the walls, standing on y0. */
function taper(p: THREE.Object3D, bottom: number, top: number, h: number, m: THREE.Material, x: number, y0: number, z: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(top * Math.SQRT2, bottom * Math.SQRT2, h, 4).rotateY(Math.PI / 4);
  return mesh(p, geo, m, x, y0 + h / 2, z);
}
/** A cone standing on y0. */
const cone = (p: THREE.Object3D, r: number, h: number, m: THREE.Material, x: number, y0: number, z: number, seg = 8): THREE.Mesh => mesh(p, new THREE.ConeGeometry(r, h, seg), m, x, y0 + h / 2, z);

/** Mali's great mosque, about 3.8 tiles square, its east front toward +z. */
export function sahelMosque(team: number): THREE.Group {
  const g = new THREE.Group();
  const mud = toon(MUD, 'plaster'), dark = toon(MUD_DARK, 'plaster'), light = toon(MUD_LIGHT, 'plaster'), beam = toon(BEAM, 'planks'), egg = toon(EGG);
  bx(g, 3.8, 0.28, 3.7, dark, 0, 0.14, 0); // the raised platform it stands on
  bx(g, 3.3, 1.35, 2.7, mud, 0, 0.28 + 0.675, -0.3); // the prayer hall
  bx(g, 3.36, 0.1, 2.76, dark, 0, 1.68, -0.3); // its roofline
  const base = 0.28, front = 1.05;
  // The east front: three great towers and the wall between.
  bx(g, 3.3, 1.9, 0.36, light, 0, base + 0.95, front);
  const towers: [number, number, number][] = [[-1.15, 2.25, 0.42], [0, 2.75, 0.5], [1.15, 2.25, 0.42]];
  for (const [x, h, w] of towers) {
    taper(g, w, w * 0.62, h, light, x, base, front + 0.06);
    cone(g, w * 0.5, 0.42, mud, x, base + h, front + 0.06);
    mesh(g, new THREE.SphereGeometry(0.09, 8, 6).scale(1, 1.3, 1), egg, x, base + h + 0.48, front + 0.06); // an ostrich egg at the top
    // The beams of the scaffolding stand out of every face, rank above rank.
    for (const y of [0.65, 1.25, 1.85].filter((y) => y < h - 0.2)) {
      const at = w * (1 - (0.38 * y) / h);
      for (const q of [-0.5, 0, 0.5]) {
        bx(g, 0.05, 0.05, 0.3, beam, x + q * at, base + y, front + 0.06 + at + 0.08);
        bx(g, 0.3, 0.05, 0.05, beam, x - at - 0.08, base + y, front + 0.06 + q * at);
        bx(g, 0.3, 0.05, 0.05, beam, x + at + 0.08, base + y, front + 0.06 + q * at);
      }
    }
  }
  // The door, deep in the middle tower.
  bx(g, 0.34, 0.62, 0.06, toon(0x3a2616, 'door'), 0, base + 0.31, front + 0.56);
  // Buttresses: ranks of pinnacles along the front and down both flanks, each rising above the wall with a cone.
  const pinnacle = (x: number, z: number, h: number): void => { taper(g, 0.11, 0.07, h, mud, x, base, z); cone(g, 0.08, 0.2, mud, x, base + h, z, 6); };
  for (const x of [-1.6, -0.6, 0.6, 1.6]) pinnacle(x, front + 0.2, 2.15);
  for (let i = 0; i < 6; i++) {
    const z = -1.55 + i * 0.48;
    for (const s of [-1, 1]) {
      pinnacle(s * 1.68, z, 1.75);
      bx(g, 0.26, 0.05, 0.05, beam, s * 1.78, base + 0.9, z + 0.24); // a beam between each
    }
  }
  for (const x of [-1.2, -0.4, 0.4, 1.2]) pinnacle(x, -1.68, 1.75); // the west wall
  banner(g, team, 1.65, 1.68, -1.5, 0.9);
  return g;
}

/** Kush's pyramids of Meroë, about 3.8 tiles square, their chapels toward +z. */
export function meroePyramids(team: number): THREE.Group {
  const g = new THREE.Group();
  const sand = toon(SAND, 'plaster'), stone = toon(SANDSTONE, 'stone'), dark = toon(SANDSTONE_DARK, 'stone'), gold = toon(GOLD);
  mesh(g, new THREE.CylinderGeometry(1.95, 2.05, 0.18, 14), sand, 0, 0.09, 0); // a low rise of sand
  /** A steep narrow pyramid `half` wide each way and `h` high, its chapel and gate on the +z side. */
  const pyramid = (x: number, z: number, half: number, h: number, chapel: boolean): void => {
    mesh(g, new THREE.ConeGeometry(half * Math.SQRT2, h, 4).rotateY(Math.PI / 4), stone, x, 0.18 + h / 2, z);
    // The dressed edges, where the stone was cut true: a little darker.
    for (const y of [0.3, 0.7].map((k) => k * h)) { const w = half * (1 - y / h) * 2 + 0.02; bx(g, w, 0.04, w, dark, x, 0.18 + y, z); }
    mesh(g, new THREE.ConeGeometry(0.06, 0.14, 4).rotateY(Math.PI / 4), gold, x, 0.18 + h - 0.02, z); // a gilded cap
    if (!chapel) return;
    const cz = z + half + 0.32, cw = half * 0.9;
    bx(g, cw, 0.5, 0.6, stone, x, 0.18 + 0.25, cz); // the chapel at its foot
    bx(g, cw + 0.06, 0.06, 0.66, dark, x, 0.18 + 0.53, cz);
    for (const s of [-1, 1]) taper(g, cw * 0.28, cw * 0.2, 0.72, stone, x + s * cw * 0.34, 0.18, cz + 0.36); // the two pylons of its gate
    bx(g, cw * 0.36, 0.42, 0.04, toon(0x3a2616, 'door'), x, 0.18 + 0.21, cz + 0.42);
    bx(g, cw * 0.4, 0.08, 0.08, toon(team), x, 0.18 + 0.66, cz + 0.4); // the lintel, in the people's colour
  };
  pyramid(-0.55, -0.55, 0.78, 3.0, true);
  pyramid(0.95, -0.95, 0.52, 2.1, true);
  pyramid(1.15, 0.65, 0.42, 1.7, true);
  pyramid(-1.3, 0.85, 0.36, 1.4, false);
  banner(g, team, -1.65, 0.18, -1.55, 0.9);
  return g;
}

/** A people's own great building on the field, where they have one drawn here; null for every other. */
export function greatWork(type: string, civ: string, team: number): THREE.Group | null {
  if (type !== 'wonder') return null;
  return civ === 'mali' ? sahelMosque(team) : civ === 'kush' ? meroePyramids(team) : null;
}
