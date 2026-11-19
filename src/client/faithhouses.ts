// Each people's house of faith, drawn as its own people build it (src/sim/faithhouse.ts says which and what it is
// called). The rules know one building, the church ('temple'); only its look changes from people to people:
//   - a Church for the Franks and the English (shapes.ts church, with its ruin where the town has let it go);
//   - a domed Mosque and minaret for the Abbasids, a mud-brick Mosque in the Sahel manner for Mali;
//   - a Temple of the gods for Greece and Rome: columns all round, a pediment, the cella within;
//   - a Temple of the Nile for Egypt and Kush: a pylon gate, a hall of columns behind, obelisks at the door;
//   - a Ziggurat Shrine for Babylon: stepped terraces of brick, a stair, the god's shrine on top;
//   - a Fire Temple for Persia: a domed square open on four arches round the sacred fire;
//   - a Shrine for Japan: a torii gate, a raised hall under a sweeping roof;
//   - an Ancestral Hall for China: a hall on a stone platform under a double hipped roof, red columns;
//   - a Sacred Cairn for the steppe: a heap of stones with a pole and blue scarves, the horse tethered by it;
//   - a Hof for the North: a timber hall with crossed gable-beams and carved posts;
//   - a Temple for the Tribes of the Judges: a stone house in a walled court, two bronze pillars at its porch, the altar
//     before it;
//   - a Sacred Grove for anyone else.
// A holy town keeps its house bright, with flowers; a decadent town lets it go (weeds, a fallen stone, the sign askew).
import * as THREE from 'three';
import { houseKind, type HouseKind } from '../sim/faithhouse';
import { Look, TIMBER, banner, bx, church, faithOf, gable, mesh, pane, registerMakers, sign, toon, walls, wobble } from './shapes';

type Draw = (o: Look, k: Kit) => THREE.Group;
/** What every house is drawn with: its people's stone, the town's temper. */
interface Kit { low: boolean; holy: boolean; stone: THREE.Material; gold: THREE.Material }

const kit = (o: Look, stone: number): Kit => {
  const low = o.leaning === 'low', holy = o.leaning === 'holy';
  const c = new THREE.Color(stone);
  if (low) c.multiplyScalar(0.78); else if (holy) c.lerp(new THREE.Color(0xffffff), 0.25);
  return { low, holy, stone: toon(c.getHex(), 'stone'), gold: toon(holy ? 0xffd860 : low ? 0x7a6a3a : 0xe8c860, '', holy ? 0x8a6a10 : 0) };
};
const cyl = (p: THREE.Object3D, r: number, h: number, m: THREE.Material, x: number, y0: number, z: number, seg = 10, top = r): THREE.Mesh => mesh(p, new THREE.CylinderGeometry(top, r, h, seg), m, x, y0 + h / 2, z);
const cone = (p: THREE.Object3D, r: number, h: number, m: THREE.Material, x: number, y0: number, z: number, seg = 8, ry = 0): THREE.Mesh => { const o = mesh(p, new THREE.ConeGeometry(r, h, seg), m, x, y0 + h / 2, z); o.rotation.y = ry; return o; };
const dome = (p: THREE.Object3D, r: number, m: THREE.Material, x: number, y0: number, z: number, tall = 1): THREE.Mesh => mesh(p, new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, tall, 1), m, x, y0, z);
/** A square tower that narrows as it rises, standing on y0. */
const taper = (p: THREE.Object3D, bottom: number, top: number, h: number, m: THREE.Material, x: number, y0: number, z: number): THREE.Mesh => mesh(p, new THREE.CylinderGeometry(top * Math.SQRT2, bottom * Math.SQRT2, h, 4).rotateY(Math.PI / 4), m, x, y0 + h / 2, z);
/** A four-sided roof w by d, h high, standing on y0, its eaves out past the walls. */
const hip = (p: THREE.Object3D, w: number, d: number, h: number, m: THREE.Material, x: number, y0: number, z: number): THREE.Mesh => mesh(p, new THREE.ConeGeometry(Math.SQRT1_2, h, 4).rotateY(Math.PI / 4).scale(w, 1, d), m, x, y0 + h / 2, z);

/** The town's temper on its house: flowers before a holy one; weeds, a fallen stone and the sign askew at a neglected one. */
function temper(g: THREE.Group, k: Kit, o: Look, signAt?: [number, number, number, number]): void {
  if (signAt) {
    const [x, y, z, s] = signAt, holder = new THREE.Group();
    holder.position.set(x, y, z); if (k.low) holder.rotation.z = -0.55;
    g.add(holder);
    sign(holder, faithOf(o.civ), k.gold, 0, 0, 0, s * (k.holy ? 1.3 : 1));
  }
  if (k.holy) for (const [x, z, c] of [[1.3, 1.3, 0xe8506a], [-1.3, 1.3, 0xf0d040], [1.35, 0.4, 0xffffff], [-1.35, 0.5, 0xe8506a], [0.9, 1.45, 0xf0d040]]) mesh(g, new THREE.SphereGeometry(0.1, 8, 6), toon(c), x, 0.1, z).castShadow = false;
  if (k.low) {
    const weed = toon(0x4a6a34);
    for (const [x, z] of [[1.2, 1.2], [-1.25, 0.9], [1.3, -0.8], [-1.1, -1.2], [0.4, 1.4]]) mesh(g, wobble(new THREE.IcosahedronGeometry(0.17, 1), 0.3, x * 7), weed, x, 0.12, z).castShadow = false;
    bx(g, 0.34, 0.24, 0.3, k.stone, 1.15, 0.12, 0.6).rotation.set(0.3, 0.7, 0.2); // a stone fallen from it
  }
}

const mosque: Draw = (o, k) => {
  const g = new THREE.Group(), white = k.stone, dark = toon(k.low ? 0x6a5a48 : 0xb89c6c, 'stone');
  walls(g, 2.4, 1.1, 2.0, white, 0, 0, -0.2);
  bx(g, 2.5, 0.1, 2.1, dark, 0, 1.15, -0.2);
  cyl(g, 0.72, 0.3, white, 0, 1.15, -0.2, 16);
  dome(g, 0.72, toon(k.low ? 0x4a6a6a : 0x3a8a8a, 'tiles'), 0, 1.45, -0.2, 1.2);
  for (const x of [-0.7, 0, 0.7]) pane(g, 'arch', 0.36, 0.7, x, 0.5, 0.82);
  // The minaret, its balcony and its cap.
  cyl(g, 0.17, 2.9, white, 1.25, 0, 0.9, 10, 0.14);
  cyl(g, 0.24, 0.08, dark, 1.25, 2.2, 0.9, 10);
  dome(g, 0.15, toon(0x3a8a8a, 'tiles'), 1.25, 2.9, 0.9, 1.6);
  temper(g, k, o, [0, 2.3, -0.2, 1.0]);
  return g;
};

const sahel: Draw = (o, k) => {
  const g = new THREE.Group(), mud = k.stone, beam = toon(TIMBER, 'planks'), egg = toon(0xf2ece0);
  walls(g, 2.4, 1.2, 2.1, mud, 0, 0, -0.3);
  // One great tower on the east front, crowned with a cone and an egg, beams standing out of it.
  taper(g, 0.5, 0.32, 2.4, mud, 0, 0, 0.95);
  cone(g, 0.26, 0.4, mud, 0, 2.4, 0.95, 4, Math.PI / 4);
  mesh(g, new THREE.SphereGeometry(0.08, 8, 6).scale(1, 1.3, 1), egg, 0, 2.86, 0.95);
  for (const y of [0.7, 1.3, 1.9]) for (const q of [-0.22, 0.22]) bx(g, 0.05, 0.05, 0.3, beam, q, y, 0.95 + 0.5 - y * 0.07 + 0.12);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const z = -1.25 + i * 0.6; taper(g, 0.1, 0.06, 1.55, mud, s * 1.22, 0, z); cone(g, 0.07, 0.18, mud, s * 1.22, 1.55, z, 4, Math.PI / 4); bx(g, 0.26, 0.05, 0.05, beam, s * 1.32, 0.85, z + 0.3); }
  pane(g, 'door', 0.36, 0.6, 0, 0.3, 1.47);
  temper(g, k, o, [0.9, 1.2, -1.1, 0.9]);
  return g;
};

const classical: Draw = (o, k) => {
  const g = new THREE.Group(), marble = k.stone, roof = toon(o.roofColor, 'tiles');
  for (const [w, d, y] of [[2.9, 2.5, 0], [2.7, 2.3, 0.14], [2.5, 2.1, 0.28]]) bx(g, w, 0.14, d, marble, 0, y + 0.07, -0.1); // the steps
  walls(g, 1.5, 1.3, 1.4, toon(k.low ? 0x9a9484 : 0xe8e0cc, 'plaster'), 0, 0.42, -0.1); // the cella
  for (let i = 0; i < 6; i++) for (const z of [-1.0, 0.8]) cyl(g, 0.09, 1.3, marble, -1.1 + i * 0.44, 0.42, z, 10, 0.08); // columns all round
  for (let i = 1; i < 4; i++) for (const x of [-1.1, 1.1]) cyl(g, 0.09, 1.3, marble, x, 0.42, -1.0 + i * 0.45, 10, 0.08);
  bx(g, 2.5, 0.16, 2.1, marble, 0, 1.8, -0.1); // the entablature
  gable(g, 2.5, 2.1, 0.5, 1.88, roof, marble, 0, -0.1, 0.08, 0.06); // its ridge front to back: a pediment over the door
  pane(g, 'door', 0.4, 0.75, 0, 0.8, 0.61);
  temper(g, k, o, [0, 2.45, 0.95, 0.9]);
  return g;
};

const nile: Draw = (o, k) => {
  const g = new THREE.Group(), st = k.stone, paint = toon(k.low ? 0x5a6a7a : 0x3a6aa8);
  // The pylon gate: two great sloping towers, the door between.
  for (const s of [-1, 1]) taper(g, 0.5, 0.36, 1.9, st, s * 0.68, 0, 0.95);
  bx(g, 0.5, 1.3, 0.5, st, 0, 0.65, 0.95);
  bx(g, 2.4, 0.08, 0.06, paint, 0, 1.55, 1.24);
  pane(g, 'door', 0.32, 0.7, 0, 0.35, 1.21);
  // The hall of columns behind, under a flat roof.
  walls(g, 2.0, 1.2, 1.6, st, 0, 0, -0.4);
  for (let i = 0; i < 4; i++) cyl(g, 0.11, 1.0, st, -0.75 + i * 0.5, 0, 0.45, 8, 0.13);
  bx(g, 2.1, 0.1, 1.7, st, 0, 1.25, -0.4);
  for (const s of [-1, 1]) { taper(g, 0.09, 0.05, 1.4, st, s * 1.25, 0, 1.4); cone(g, 0.07, 0.12, k.gold, s * 1.25, 1.4, 1.4, 4, Math.PI / 4); } // obelisks
  temper(g, k, o, [0, 1.3, -0.4, 0.9]);
  return g;
};

const ziggurat: Draw = (o, k) => {
  const g = new THREE.Group(), brick = k.stone, glaze = toon(k.low ? 0x4a5a70 : 0x3a66a8, 'tiles');
  for (const [w, y, h] of [[2.8, 0, 0.6], [2.1, 0.6, 0.55], [1.4, 1.15, 0.5]] as const) { walls(g, w, h, w * 0.9, brick, 0, y, -0.1); bx(g, w + 0.04, 0.05, w * 0.9 + 0.04, glaze, 0, y + h, -0.1); }
  walls(g, 0.7, 0.5, 0.6, glaze, 0, 1.65, -0.1); // the god's shrine on top
  bx(g, 0.76, 0.06, 0.66, k.gold, 0, 2.18, -0.1);
  bx(g, 0.5, 0.06, 1.7, brick, 0, 0.82, 1.0).rotation.x = -0.62; // the great stair
  temper(g, k, o, [0, 2.21, -0.1, 0.9]);
  return g;
};

const firetemple: Draw = (o, k) => {
  const g = new THREE.Group(), st = k.stone;
  bx(g, 2.6, 0.2, 2.6, st, 0, 0.1, 0);
  // Four piers with arches between, open on every side, under a dome.
  for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) walls(g, 0.5, 1.3, 0.5, st, x, 0.2, z);
  for (const [w, d, x, z] of [[2.2, 0.5, 0, -0.85], [2.2, 0.5, 0, 0.85], [0.5, 2.2, -0.85, 0], [0.5, 2.2, 0.85, 0]]) bx(g, w, 0.3, d, st, x, 1.65, z);
  bx(g, 2.2, 0.08, 2.2, st, 0, 1.84, 0);
  dome(g, 0.9, st, 0, 1.88, 0, 0.8);
  // The sacred fire on its altar within.
  cyl(g, 0.2, 0.5, st, 0, 0.2, 0, 8, 0.15);
  if (!k.low) { const f = cone(g, 0.15, 0.4, toon(0xff9030, '', 0xcc5010), 0, 0.7, 0); f.castShadow = false; }
  temper(g, k, o, [0, 2.58, 0, 1.0]);
  return g;
};

const shrine: Draw = (o, k) => {
  const g = new THREE.Group(), wood = toon(k.low ? 0x6a5040 : 0xeae0cc, 'planks'), red = toon(k.low ? 0x6a3a30 : 0xc83a2a), roof = toon(k.low ? 0x4a4038 : 0x5a4a3a, 'thatch');
  bx(g, 2.0, 0.3, 1.8, k.stone, 0, 0.15, -0.4);
  walls(g, 1.5, 0.9, 1.3, wood, 0, 0.3, -0.4);
  for (const [x, z] of [[-0.75, 0.25], [0.75, 0.25], [-0.75, -1.05], [0.75, -1.05]]) cyl(g, 0.06, 0.9, red, x, 0.3, z, 8);
  hip(g, 2.3, 2.0, 0.85, roof, 0, 1.18, -0.4);
  bx(g, 0.08, 0.3, 1.0, roof, 0, 2.0, -0.4); // the ridge
  for (const z of [-0.8, 0]) { bx(g, 0.06, 0.06, 0.4, wood, -0.12, 2.15, z).rotation.z = 0.5; bx(g, 0.06, 0.06, 0.4, wood, 0.12, 2.15, z).rotation.z = -0.5; }
  // The torii before it.
  for (const s of [-1, 1]) cyl(g, 0.06, 1.3, red, s * 0.55, 0, 1.3, 8);
  bx(g, 1.5, 0.1, 0.12, red, 0, 1.32, 1.3); bx(g, 1.2, 0.07, 0.08, red, 0, 1.12, 1.3);
  temper(g, k, o, [0, 1.37, 1.3, 0.6]); // its sign on the torii
  return g;
};

const ancestral: Draw = (o, k) => {
  const g = new THREE.Group(), red = toon(k.low ? 0x5a3028 : 0xa8322a), roof = toon(k.low ? 0x2a2e30 : 0x3f4a4c, 'tiles'), wall = toon(k.low ? 0x8a8070 : 0xd8cfc0, 'plaster');
  bx(g, 2.8, 0.3, 2.3, k.stone, 0, 0.15, -0.1);
  bx(g, 0.8, 0.12, 0.5, k.stone, 0, 0.06, 1.2); // the steps
  walls(g, 2.0, 1.0, 1.4, wall, 0, 0.3, -0.2);
  for (let i = 0; i < 5; i++) cyl(g, 0.07, 1.0, red, -1.1 + i * 0.55, 0.3, 0.75, 8);
  hip(g, 2.8, 2.1, 0.45, roof, 0, 1.3, -0.1);
  walls(g, 1.4, 0.35, 0.9, wall, 0, 1.6, -0.15);
  hip(g, 2.0, 1.4, 0.45, roof, 0, 1.92, -0.15);
  pane(g, 'door', 0.5, 0.75, 0, 0.68, 0.51);
  bx(g, 0.6, 0.18, 0.04, toon(0x2a1a10), 0, 1.15, 0.52); // the board with the house's name
  temper(g, k, o);
  return g;
};

const cairn: Draw = (o, k) => {
  const g = new THREE.Group(), rock = k.stone, blue = toon(k.low ? 0x5a6a80 : 0x3a7ad0);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4, r = 0.75 - (i / 26) * 0.6, y = (i / 26) * 1.05;
    mesh(g, wobble(new THREE.IcosahedronGeometry(0.22 - i * 0.004, 0), 0.25, i), rock, Math.cos(a) * r, y + 0.12, Math.sin(a) * r);
  }
  cyl(g, 0.04, 2.4, toon(TIMBER, 'planks'), 0, 0.6, 0, 6);
  for (let i = 0; i < 6; i++) { const s = bx(g, 0.05, 0.55, 0.12, i % 2 ? blue : toon(0xf0ece0), Math.cos(i) * 0.12, 2.2 - i * 0.12, Math.sin(i) * 0.12); s.rotation.z = 0.5 + i * 0.4; s.rotation.y = i; } // the scarves tied to it
  for (const [x, z] of [[1.0, 0.4], [-1.0, 0.5], [0.2, -1.1]]) mesh(g, wobble(new THREE.IcosahedronGeometry(0.16, 0), 0.2, x * 3), rock, x, 0.1, z); // offerings of stone round it
  cyl(g, 0.03, 0.8, toon(TIMBER, 'planks'), 1.2, 0, 1.0, 5); // the post the horse is tied to
  temper(g, k, o);
  return g;
};

const hof: Draw = (o, k) => {
  const g = new THREE.Group(), wood = toon(k.low ? 0x4a3420 : 0x7a5a3a, 'planks'), dark = toon(0x3a2818, 'planks'), roof = toon(k.low ? 0x4a5030 : 0x6f7a44, 'thatch');
  walls(g, 1.6, 0.8, 2.6, wood, 0, 0, -0.1);
  gable(g, 1.9, 2.8, 1.1, 0.8, roof, wood, 0, -0.1, 0.14, 0.12);
  for (const z of [-1.45, 1.25]) for (const s of [-1, 1]) { const b = bx(g, 0.07, 0.75, 0.07, dark, s * 0.18, 2.05, z); b.rotation.z = s * 0.55; } // crossed gable-beams, carved as beasts' heads
  pane(g, 'door', 0.4, 0.62, 0, 0.31, 1.21);
  for (const s of [-1, 1]) { cyl(g, 0.06, 1.1, dark, s * 0.45, 0, 1.45, 6); cone(g, 0.08, 0.2, k.gold, s * 0.45, 1.1, 1.45, 6); } // carved posts at the door
  temper(g, k, o);
  return g;
};

const tabernacle: Draw = (o, k) => {
  const g = new THREE.Group(), st = k.stone, bronze = toon(k.low ? 0x5a4a30 : 0xb08a3a);
  // The court's low wall, the temple within, two bronze pillars at its porch and the altar before it.
  for (const [w, d, x, z] of [[2.9, 0.12, 0, -1.4], [0.12, 2.8, -1.4, 0], [0.12, 2.8, 1.4, 0], [1.0, 0.12, -0.95, 1.4], [1.0, 0.12, 0.95, 1.4]]) walls(g, w, 0.35, d, st, x, 0, z);
  walls(g, 1.3, 1.5, 1.6, st, 0, 0, -0.5);
  bx(g, 1.4, 0.1, 1.7, st, 0, 1.55, -0.5);
  for (const s of [-1, 1]) { cyl(g, 0.09, 1.2, bronze, s * 0.42, 0, 0.45, 10); mesh(g, new THREE.SphereGeometry(0.13, 10, 6), bronze, s * 0.42, 1.28, 0.45); }
  pane(g, 'door', 0.4, 0.75, 0, 0.38, 0.31);
  walls(g, 0.55, 0.4, 0.55, st, 0, 0, 0.95); // the altar
  for (const [x, z] of [[-0.26, 0.69], [0.26, 0.69], [-0.26, 1.21], [0.26, 1.21]]) cone(g, 0.04, 0.1, bronze, x, 0.4, z, 4);
  temper(g, k, o, [0, 1.6, -0.5, 0.9]);
  return g;
};

const grove: Draw = (o, k) => {
  const g = new THREE.Group(), leaf = toon(k.low ? 0x4a5a34 : 0x4a7a3a), bark = toon(TIMBER, 'planks');
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, x = Math.cos(a) * 1.05, z = Math.sin(a) * 1.05; cyl(g, 0.08, 0.9, bark, x, 0, z, 6); mesh(g, wobble(new THREE.IcosahedronGeometry(0.45, 1), 0.2, i), leaf, x, 1.2, z); }
  walls(g, 0.5, 0.45, 0.4, k.stone, 0, 0, 0); // the stone at its heart
  temper(g, k, o);
  return g;
};

const DRAW: Record<HouseKind, Draw | null> = { church: null, mosque, sahel, classical, nile, ziggurat, firetemple, shrine, ancestral, cairn, hof, tabernacle, grove };
const STONE: Record<HouseKind, number> = { church: 0xdcd6c6, mosque: 0xeadcb8, sahel: 0xb88656, classical: 0xece6d6, nile: 0xd8bf8a, ziggurat: 0xc8a878, firetemple: 0xd6c4a0, shrine: 0x9a968c, ancestral: 0xa8a49a, cairn: 0x8a8478, hof: 0x8a8478, tabernacle: 0xd8cca8, grove: 0x9a948a };

/** The people's house of faith for this look (Look.civ), in place of the one church everyone had. */
export function faithHouse(o: Look): THREE.Group {
  const kind = houseKind(o.civ), draw = DRAW[kind];
  if (!draw) return church(o);
  const g = draw(o, kit(o, STONE[kind]));
  banner(g, o.team, 1.3, 0, 1.9, 1.0);
  return g;
}

registerMakers({ temple: faithHouse });
