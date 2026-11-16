// The buildings that answer the systems (docs/DESIGN.md, "Buildings and research that answer the systems", the
// owner's word): the Granary, the Mill, the Well and the Bathhouse, the Infirmary and the Almshouse, the Hall of
// Judgement, the Noble's Manor, the Monastery and the Convent, the Fortress, the Watch House and the Inn. Each is
// drawn in the house style of shapes.ts: the nation's walls and roof at its age (top() gives a pitched, flat, domed,
// pagoda or tented roof as the people build), and the holy and low leanings where a building has them. They add
// themselves to shapedBuilding's makers when this module is loaded (models.ts imports it); shapedBuilding fits each
// to its plot.
import * as THREE from 'three';
import { Look, PLANK, TIMBER, banner, faithOf, sign, barrel, bx, chimney, cloth, crate, fence, framed, framing, gable, leanTo, mesh, pane, pitched, posts, registerMakers, roofMat, sack, toon, top, wallMat, walls, wobble } from './shapes';

const STONE = 0xc8c2b4, GOLD = 0xe8c860, IRON = 0x2c2c30;
const stone = (o: Look, pale = false): THREE.Material => toon(pale ? 0xe4dfd2 : o.age >= 2 ? STONE : 0xb0a68c, 'stone');
const plank = (o: Look): THREE.Material => toon(o.age === 0 ? o.wall : PLANK, 'planks');
/** Stone from the Bronze Age on, timber before it: what a people can raise. */
const body = (o: Look): THREE.Material => (o.age >= 2 ? wallMat(o) : plank(o));
/** A round stack of something on the ground: a cylinder with its painted surface wrapped round it. */
function drum(p: THREE.Object3D, r0: number, r1: number, h: number, m: THREE.Material, x: number, y: number, z: number, n = 16, wrap = 3): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r0, r1, h, n), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * wrap, uv.getY(i) * Math.max(1, h));
  return mesh(p, geo, m, x, y, z);
}
/** Battlements along a wall top, from (x0, z0) to (x1, z1). */
function merlons(p: THREE.Object3D, m: THREE.Material, x0: number, z0: number, x1: number, z1: number, y: number, step = 0.32): void {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / step)), ang = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i += 2) bx(p, 0.16, 0.18, 0.16, m, x0 + ((x1 - x0) * i) / n, y + 0.09, z0 + ((z1 - z0) * i) / n).rotation.y = ang;
}

// ---- Food ----

/** A granary: a storehouse raised off the ground on mushroom stones against damp and rats, with a ladder to its door. */
function granary(o: Look): THREE.Group {
  const g = new THREE.Group(), st = stone(o);
  for (const x of [-0.8, 0, 0.8]) for (const z of [-0.55, 0.55]) {
    drum(g, 0.08, 0.11, 0.38, st, x, 0.19, z, 8, 1);
    mesh(g, new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), st, x, 0.38, z).scale.y = 0.45;
  }
  bx(g, 2.0, 0.1, 1.4, toon(TIMBER, 'planks'), 0, 0.48, 0);
  walls(g, 1.9, 0.95, 1.3, o.age >= 3 ? wallMat(o) : plank(o), 0, 0.53);
  posts(g, o, 1.9, 0.95, 1.3, 0.53);
  top(g, o, 1.9, 1.3, 1.48, 0.85);
  bx(g, 1.92, 0.07, 1.32, toon(o.team), 0, 1.42, 0);
  pane(g, 'door', 0.4, 0.6, 0, 0.86, 0.66);
  // A ladder up to it, and sacks waiting their turn.
  for (const x of [-0.17, 0.17]) bx(g, 0.04, 0.85, 0.04, toon(TIMBER), x, 0.4, 0.95).rotation.x = -0.35;
  for (let i = 0; i < 4; i++) bx(g, 0.34, 0.03, 0.03, toon(TIMBER), 0, 0.12 + i * 0.2, 1.08 - i * 0.07);
  sack(g, 0.75, 1.0); sack(g, 0.95, 0.9, 0xbfae84); sack(g, 0.85, 1.05, 0xd8c8a0); sack(g, -0.85, 1.0, 0xbfae84);
  return g;
}

/** A mill: before the Iron Age a horse mill under a roof, the stone turned by a beast walking round; after it a tower mill with four sails. */
function mill(o: Look, seed: number): THREE.Group {
  const g = new THREE.Group(), st = stone(o);
  if (o.age < 2) {
    walls(g, 1.4, 0.8, 1.2, body(o), -0.6, 0, -0.5);
    top(g, o, 1.4, 1.2, 0.8, 0.6, -0.6, -0.5);
    pane(g, 'door', 0.4, 0.6, -0.6, 0.3, 0.11);
    // The millstones under a round roof on posts, the beam a beast is yoked to.
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mesh(g, new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), toon(TIMBER), 0.7 + Math.cos(a) * 0.62, 0.45, 0.55 + Math.sin(a) * 0.62); }
    mesh(g, new THREE.ConeGeometry(0.85, 0.45, 12), roofMat(o), 0.7, 1.12, 0.55);
    drum(g, 0.32, 0.32, 0.14, st, 0.7, 0.07, 0.55, 14, 2);
    drum(g, 0.3, 0.3, 0.12, st, 0.7, 0.2, 0.55, 14, 2);
    bx(g, 1.0, 0.06, 0.06, toon(TIMBER), 1.0, 0.45, 0.55).rotation.y = (seed % 6) * 0.5;
    sack(g, -0.1, 0.8); sack(g, 0.1, 1.0, 0xd8c8a0);
    return g;
  }
  // The tower: tapering, its cap turned to the wind, four sails of cloth on a lattice.
  drum(g, 0.62, 0.82, 2.4, st, 0, 1.2, 0, 18, 3);
  mesh(g, new THREE.CylinderGeometry(0.84, 0.84, 0.08, 18), toon(o.team), 0, 0.7, 0);
  const cap = new THREE.Group(); cap.position.set(0, 2.4, 0); g.add(cap);
  mesh(cap, new THREE.ConeGeometry(0.78, 0.8, 16), roofMat(o), 0, 0.4, 0);
  mesh(cap, new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8).rotateX(Math.PI / 2), toon(TIMBER), 0, 0.15, 0.72);
  const hub = new THREE.Group(); hub.position.set(0, 0.15, 1.02); hub.rotation.z = (seed % 4) * 0.3; cap.add(hub);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI) / 2; hub.add(arm);
    bx(arm, 0.06, 1.55, 0.05, toon(TIMBER), 0, 0.8, 0);
    const sail = bx(arm, 0.38, 1.2, 0.02, toon(0xe8dcc0, 'window'), 0.21, 0.95, -0.02); sail.castShadow = false;
  }
  pane(g, 'door', 0.4, 0.62, 0, 0.32, 0.83);
  pane(g, 'window', 0.18, 0.3, 0, 1.4, 0.73);
  sack(g, 0.7, 0.75); sack(g, 0.9, 0.55, 0xd8c8a0); sack(g, 0.55, 0.95, 0xbfae84);
  return g;
}

/** A town well: a stone ring under a roof on posts, a windlass and bucket, and a trough for the beasts. */
function well(o: Look): THREE.Group {
  const g = new THREE.Group(), st = stone(o);
  bx(g, 2.2, 0.06, 2.2, toon(0xa8a090, 'stone'), 0, 0.03, 0).castShadow = false;
  drum(g, 0.55, 0.6, 0.55, st, 0, 0.3, 0, 18, 3);
  mesh(g, new THREE.CylinderGeometry(0.46, 0.46, 0.02, 18), toon(0x24343e), 0, 0.56, 0);
  for (const x of [-0.6, 0.6]) bx(g, 0.1, 1.3, 0.1, toon(TIMBER), x, 0.65, 0);
  mesh(g, new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8).rotateZ(Math.PI / 2), toon(PLANK, 'planks'), 0, 1.05, 0);
  bx(g, 0.02, 0.4, 0.02, toon(0x6a5a44), 0.1, 0.83, 0);
  drum(g, 0.1, 0.08, 0.16, toon(PLANK, 'planks'), 0.1, 0.58, 0, 8, 1);
  if (pitched(o)) gable(g, 1.5, 1.1, 0.55, 1.3, roofMat(o), null, 0, 0, 0.1, 0.07);
  else top(g, o, 1.4, 1.1, 1.3, 0.5);
  bx(g, 1.0, 0.25, 0.32, st, 0.2, 0.13, 0.85);
  bx(g, 0.9, 0.02, 0.24, toon(0x3a6a8a), 0.2, 0.25, 0.85).castShadow = false;
  barrel(g, -0.85, 0.65, 0.8); barrel(g, -0.75, -0.75, 0.75);
  return g;
}

/** A bathhouse: a low hall of baths under a vault or the nation's roof, a furnace stack steaming, a pool open to the sky. */
function bathhouse(o: Look): THREE.Group {
  const g = new THREE.Group(), st = stone(o, o.leaning === 'holy');
  walls(g, 2.4, 1.0, 1.5, o.age >= 1 ? st : body(o), 0, 0, -0.55);
  if (pitched(o)) top(g, o, 2.4, 1.5, 1.0, 0.7, 0, -0.55);
  else mesh(g, new THREE.CylinderGeometry(0.75, 0.75, 2.4, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), roofMat(o), 0, 1.0, -0.55);
  for (const x of [-0.8, 0, 0.8]) pane(g, 'arch', 0.32, 0.6, x, 0.5, 0.21, 0, 0x6a5030);
  walls(g, 0.4, 1.9, 0.4, toon(0x8a867c, 'stone'), 1.05, 0, -1.05);
  for (let i = 0; i < 3; i++) { const puff = mesh(g, wobble(new THREE.IcosahedronGeometry(0.16 + i * 0.05, 1), 0.2, i), toon(0xf4f2ee), 1.05 + i * 0.1, 2.1 + i * 0.25, -1.05); puff.castShadow = false; }
  // The open pool, stepped round, and the bathers' benches.
  bx(g, 1.8, 0.16, 0.95, st, -0.1, 0.08, 0.75);
  bx(g, 1.55, 0.02, 0.72, toon(0x5a9ab0, '', 0x0a2a34), -0.1, 0.165, 0.75).castShadow = false;
  for (const x of [-0.95, 0.95]) bx(g, 0.12, 0.3, 0.12, st, x, 0.15, 1.2);
  bx(g, 0.6, 0.06, 0.18, toon(PLANK, 'planks'), 1.25, 0.22, 0.6);
  cloth(g, o.team, 0.5, 0.3, 0, 0.88, 0.22);
  return g;
}

// ---- Health ----

/** An infirmary: a long ward of beds behind many windows, a herb garden fenced before it, the sign of healing over the door. */
function infirmary(o: Look): THREE.Group {
  const g = new THREE.Group(), holy = o.leaning === 'holy', low = o.leaning === 'low';
  walls(g, 2.8, 0.24, 1.3, toon(0xb8b4aa, 'stone'), 0, 0, -0.45);
  walls(g, 2.7, 0.9, 1.2, wallMat(o, false), 0, 0.2, -0.45);
  posts(g, o, 2.7, 0.9, 1.2, 0.2);
  if (framed(o)) framing(g, 2.7, 0.9, 1.2, 0.2, 0, -0.45);
  top(g, o, 2.7, 1.2, 1.1, 0.75, 0, -0.45);
  if (pitched(o)) chimney(g, -0.9, 1.3, -0.6, 0.8);
  for (const x of [-1.0, -0.5, 0.5, 1.0]) pane(g, 'window', 0.26, 0.36, x, 0.7, 0.16, 0, low ? 0 : 0x6a5428);
  pane(g, 'door', 0.42, 0.72, 0, 0.56, 0.16);
  // The sign of healing on a white board, faded where the place is let go: a red cross among the peoples whose sign the
  // cross is, and among the others a healer's bowl with herbs in it.
  bx(g, 0.42, 0.42, 0.04, toon(low ? 0xa8a090 : 0xf4f0e6), 0, 1.15, 0.18);
  if (faithOf(o.civ) === 'cross') { const red = toon(low ? 0x7a4a40 : 0xc0302a); bx(g, 0.1, 0.3, 0.05, red, 0, 1.15, 0.2); bx(g, 0.3, 0.1, 0.05, red, 0, 1.15, 0.2); }
  else {
    mesh(g, new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(low ? 0x6a5a48 : 0x8a5a30), 0, 1.13, 0.22).scale.z = 0.3;
    for (const dx of [-0.06, 0, 0.06]) bx(g, 0.03, 0.14, 0.02, toon(low ? 0x6a7a4a : 0x4a9a3a), dx, 1.2, 0.22).rotation.z = dx * 4;
  }
  // The physic garden: beds of herbs in rows, a fence, and a bench in the sun.
  fence(g, -1.35, 0.35, -1.35, 1.35); fence(g, 1.35, 0.35, 1.35, 1.35); fence(g, -1.35, 1.35, -0.3, 1.35); fence(g, 0.3, 1.35, 1.35, 1.35);
  for (const [x, z] of [[-0.85, 0.7], [-0.85, 1.05], [0.85, 0.7], [0.85, 1.05]]) {
    bx(g, 0.7, 0.06, 0.22, toon(0x5a4630), x, 0.03, z).castShadow = false;
    for (let i = 0; i < 4; i++) mesh(g, new THREE.SphereGeometry(0.06, 6, 5), toon(holy ? (i % 2 ? 0x8ab04a : 0xb08ad0) : low ? 0x7a8a4a : 0x6aa040), x - 0.24 + i * 0.16, 0.09, z).castShadow = false;
  }
  bx(g, 0.6, 0.05, 0.16, toon(PLANK, 'planks'), 0, 0.24, 0.55);
  for (const x of [-0.24, 0.24]) bx(g, 0.05, 0.22, 0.14, toon(TIMBER), x, 0.11, 0.55);
  bx(g, 2.72, 0.07, 1.22, toon(o.team), 0, 1.06, -0.45);
  return g;
}

/** An almshouse: a row of small dwellings for the poor round a yard, a common pump, and a chapel bell over the gate. */
function almshouse(o: Look): THREE.Group {
  const g = new THREE.Group(), low = o.leaning === 'low';
  for (const [x, z, ry] of [[-0.9, -0.6, 0], [0, -0.6, 0], [0.9, -0.6, 0], [-1.05, 0.45, Math.PI / 2]] as const) {
    const cell = new THREE.Group(); cell.position.set(x, 0, z); cell.rotation.y = ry; g.add(cell);
    walls(cell, 0.85, 0.7, 0.8, body(o), 0, 0, 0);
    top(cell, o, 0.85, 0.8, 0.7, 0.45);
    pane(cell, 'door', 0.24, 0.48, -0.15, 0.24, 0.41);
    pane(cell, 'window', 0.18, 0.2, 0.2, 0.42, 0.41, 0, low ? 0 : 0x6a5428);
  }
  // The gatehouse with its bell, the yard, the pump.
  walls(g, 0.9, 1.1, 0.7, wallMat(o, false), 1.0, 0, 0.6);
  top(g, o, 0.9, 0.7, 1.1, 0.5, 1.0, 0.6);
  pane(g, 'arch', 0.4, 0.62, 1.0, 0.31, 0.96);
  bx(g, 0.18, 0.2, 0.18, toon(0xb08a3a, '', 0x3a2a08), 1.0, 0.9, 0.97);
  bx(g, 1.5, 0.03, 0.9, toon(0xa8a090, 'stone'), 0, 0.015, 0.25).castShadow = false;
  bx(g, 0.14, 0.6, 0.14, toon(PLANK, 'planks'), 0.05, 0.3, 0.35); bx(g, 0.35, 0.05, 0.05, toon(IRON), 0.2, 0.55, 0.35);
  bx(g, 0.4, 0.14, 0.2, stone(o), 0.05, 0.07, 0.6);
  barrel(g, -0.35, 0.6, 0.7);
  cloth(g, o.team, 0.3, 0.4, 1.0, 1.05, 0.96);
  return g;
}

// ---- Rule and law ----

/** The Hall of Judgement, the leader's seat: a great stone hall raised on steps behind a columned porch, a tower, the scales of justice over the door. */
function judgement(o: Look): THREE.Group {
  const g = new THREE.Group(), st = stone(o, true), gold = toon(GOLD, '', 0x4a3a08);
  walls(g, 3.2, 0.3, 2.6, st);
  walls(g, 3.0, 1.5, 2.2, o.age >= 1 ? st : body(o), 0, 0.3, -0.15);
  top(g, o, 3.0, 2.2, 1.8, 1.0, 0, -0.15);
  // The porch: columns, a pediment, steps up to the door.
  for (const x of [-1.2, -0.6, 0.6, 1.2]) { drum(g, 0.1, 0.12, 1.35, st, x, 0.97, 1.12, 10, 1); bx(g, 0.26, 0.08, 0.26, st, x, 1.68, 1.12); }
  bx(g, 2.8, 0.14, 0.5, st, 0, 1.78, 1.0);
  if (pitched(o)) gable(g, 2.8, 0.5, 0.45, 1.85, roofMat(o), st, 0, 1.0, 0.06, 0.07);
  for (let i = 0; i < 3; i++) bx(g, 1.6 - i * 0.15, 0.1, 0.24, st, 0, 0.05 + i * 0.1, 1.55 - i * 0.18);
  pane(g, 'door', 0.6, 1.0, 0, 0.8, 0.96);
  for (const x of [-1.0, 1.0]) pane(g, 'arch', 0.3, 0.7, x, 1.05, 0.96, 0, 0x8a6a30);
  // The scales over the door.
  bx(g, 0.04, 0.3, 0.04, gold, 0, 1.55, 1.05); bx(g, 0.4, 0.03, 0.03, gold, 0, 1.68, 1.05);
  for (const x of [-0.18, 0.18]) mesh(g, new THREE.CylinderGeometry(0.07, 0.04, 0.04, 10), gold, x, 1.56, 1.05);
  // The tower at the back, with a beacon of the owner's colour.
  walls(g, 0.9, 3.0, 0.9, st, -1.05, 0, -0.95);
  bx(g, 1.0, 0.08, 1.0, toon(o.team), -1.05, 2.4, -0.95);
  merlons(g, st, -1.5, -0.5, -0.6, -0.5, 3.0, 0.22); merlons(g, st, -1.5, -1.4, -0.6, -1.4, 3.0, 0.22);
  for (const x of [-1.4, 1.4]) banner(g, o.team, x, 0.3, 1.45, 1.4);
  cloth(g, o.team, 0.5, 0.9, 0, 2.5, 0.97);
  return g;
}

/** A noble's manor: a hall of two storeys with a wing, behind a low wall with a gate, a garden, and the lord's colours. */
function manor(o: Look): THREE.Group {
  const g = new THREE.Group(), st = stone(o);
  walls(g, 2.2, 0.9, 1.3, wallMat(o, false), -0.3, 0, -0.65);
  walls(g, 2.2, 0.85, 1.3, wallMat(o), -0.3, 0.9, -0.65);
  posts(g, o, 2.2, 0.85, 1.3, 0.9);
  if (framed(o)) framing(g, 2.2, 0.9, 1.3, 0, -0.3, -0.65);
  top(g, o, 2.2, 1.3, 1.75, 0.9, -0.3, -0.65);
  if (pitched(o)) chimney(g, 0.5, 2.0, -0.9, 0.9);
  // The wing.
  walls(g, 0.9, 1.2, 1.0, wallMat(o, false), 1.15, 0, -0.5);
  top(g, o, 0.9, 1.0, 1.2, 0.6, 1.15, -0.5);
  pane(g, 'door', 0.46, 0.8, -0.3, 0.45, 0.01);
  for (const x of [-1.0, 0.4]) { pane(g, 'window', 0.28, 0.4, x, 0.55, 0.01, 0, 0x6a5428); pane(g, 'window', 0.28, 0.4, x, 1.35, 0.01, 0, 0x6a5428); }
  pane(g, 'window', 0.26, 0.38, -0.3, 1.35, 0.01, 0, 0x6a5428);
  pane(g, 'window', 0.26, 0.36, 1.15, 0.6, 0.01, 0, 0x6a5428);
  cloth(g, o.team, 0.36, 0.55, -0.3, 1.35, 0.04);
  // The courtyard wall, its gate, a garden and a tree.
  for (const [x0, x1] of [[-1.5, -0.35], [0.35, 1.5]]) walls(g, x1 - x0, 0.4, 0.14, st, (x0 + x1) / 2, 0, 1.35);
  for (const x of [-1.5, 1.5]) walls(g, 0.14, 0.4, 1.35, st, x, 0, 0.68);
  for (const x of [-0.38, 0.38]) { walls(g, 0.18, 0.7, 0.18, st, x, 0, 1.35); mesh(g, new THREE.SphereGeometry(0.1, 8, 6), st, x, 0.78, 1.35); }
  for (const [x, z] of [[-0.95, 0.75], [0.95, 0.75]]) {
    bx(g, 0.6, 0.05, 0.5, toon(0x4a6a34), x, 0.03, z).castShadow = false;
    for (let i = 0; i < 3; i++) mesh(g, new THREE.SphereGeometry(0.07, 6, 5), toon([0xe8506a, 0xf0d040, 0xf4f0e6][i]), x - 0.18 + i * 0.18, 0.1, z).castShadow = false;
  }
  drum(g, 0.06, 0.08, 0.6, toon(TIMBER), 1.15, 0.3, 0.45, 6, 1);
  mesh(g, wobble(new THREE.IcosahedronGeometry(0.38, 1), 0.25, 3), toon(0x4e7a3a), 1.15, 0.85, 0.45);
  banner(g, o.team, -1.45, 0.4, 1.3, 1.0);
  return g;
}

// ---- Faith ----

/**
 * A monastery: a house of its people's faith (its sign on the spire: faithOf) at one side of a cloister, the cloister's arcades round a garth with a well, the brothers'
 * range behind, a bell tower. Holy, it gleams: whitened walls, gold, the garth in flower. A convent is the same house
 * kept by sisters: a smaller chapel, a walled garden, and no tower.
 */
function monastery(o: Look, seed: number, sisters = false): THREE.Group {
  const g = new THREE.Group(), holy = o.leaning === 'holy';
  const st = toon(holy ? 0xfaf6ea : o.age >= 2 ? 0xdcd6c6 : 0xc0b498, 'stone'), slate = roofMat(o), gold = toon(holy ? 0xffd860 : GOLD, '', holy ? 0x8a6a10 : 0x4a3a08);
  // The chapel along the back.
  walls(g, 2.8, 1.3, 1.0, st, 0, 0, -1.1);
  if (pitched(o)) gable(g, 1.0, 2.8, 0.7, 1.3, slate, st, 0, -1.1, 0.12).rotation.y = Math.PI / 2; else top(g, o, 2.8, 1.0, 1.3, 0.7, 0, -1.1);
  for (const x of [-0.9, 0, 0.9]) pane(g, 'arch', 0.24, 0.6, x, 0.7, -0.59, 0, holy ? 0xc09a40 : 0x4a3a18);
  // The ranges either side, low, with small windows.
  for (const s of [-1, 1]) {
    walls(g, 0.75, 0.9, 1.7, toon(o.wall, o.age === 0 ? 'planks' : 'plaster'), s * 1.05, 0, 0.35);
    top(g, o, 0.75, 1.7, 0.9, 0.45, s * 1.05, 0.35);
    for (const z of [0, 0.6]) pane(g, 'window', 0.14, 0.24, s * 0.67, 0.55, z, Math.PI / 2);
  }
  // The cloister walk round the garth: arches on columns, a lean roof.
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) drum(g, 0.05, 0.05, 0.55, st, s * 0.6, 0.28, -0.4 + i * 0.4, 6, 1);
  for (let i = 0; i < 3; i++) drum(g, 0.05, 0.05, 0.55, st, -0.4 + i * 0.4, 0.28, 0.9, 6, 1);
  for (const s of [-1, 1]) leanTo(g, slate, 0.35, 1.5, s * 0.55, 0.62, 0.25, 0);
  bx(g, 1.05, 0.04, 1.2, toon(holy ? 0x5a8a3a : 0x5a7a3a), 0, 0.02, 0.25).castShadow = false;
  if (holy) for (const [x, z, c] of [[-0.3, 0, 0xe8506a], [0.25, 0.4, 0xf0d040], [-0.2, 0.6, 0xffffff], [0.3, -0.1, 0xb08ad0]]) mesh(g, new THREE.SphereGeometry(0.07, 6, 5), toon(c), x, 0.08, z).castShadow = false;
  drum(g, 0.16, 0.18, 0.2, st, 0, 0.1, 0.25, 10, 1);
  if (sisters) {
    // The sisters' walled garden in front.
    for (const s of [-1, 1]) walls(g, 0.12, 0.45, 0.6, st, s * 0.75, 0, 1.2);
    walls(g, 1.5, 0.45, 0.12, st, 0, 0, 1.5);
    pane(g, 'arch', 0.3, 0.42, 0, 0.21, 1.57);
    mesh(g, wobble(new THREE.IcosahedronGeometry(0.22, 1), 0.25, seed), toon(0x4e7a3a), -0.45, 0.25, 1.2);
    sign(g, faithOf(o.civ), gold, 0, 1.85, -1.1);
  } else {
    // The bell tower at the chapel's end, a cross on its spire.
    walls(g, 0.7, 2.4, 0.7, st, 1.3, 0, -1.25);
    for (const [dx, dz, ry] of [[0, 0.36, 0], [0.36, 0, Math.PI / 2]]) pane(g, 'arch', 0.22, 0.36, 1.3 + dx, 2.0, -1.25 + dz, ry);
    mesh(g, new THREE.ConeGeometry(0.52, 1.0, 8), slate, 1.3, 2.9, -1.25);
    sign(g, faithOf(o.civ), gold, 1.3, 3.38, -1.25);
  }
  bx(g, 2.82, 0.07, 1.02, toon(o.team), 0, 1.24, -1.1);
  return g;
}

// ---- Order and roads ----

/** A fortress: a keep within a curtain wall and four corner towers; a stockade and a timber keep before the Bronze Age. */
function fortress(o: Look): THREE.Group {
  const g = new THREE.Group(), stoneBuilt = o.age >= 2;
  const wall = stoneBuilt ? toon(STONE, 'stone') : toon(PLANK, 'planks'), keepM = stoneBuilt ? toon(0xb8b2a4, 'stone') : toon(o.age === 0 ? o.wall : PLANK, 'planks');
  const R = 1.4, H = 1.0;
  if (stoneBuilt) {
    for (const [x0, z0, x1, z1] of [[-R, -R, R, -R], [-R, R, -0.35, R], [0.35, R, R, R], [-R, -R, -R, R], [R, -R, R, R]]) {
      const w = Math.abs(x1 - x0) || 0.22, d = Math.abs(z1 - z0) || 0.22;
      walls(g, w, H, d, wall, (x0 + x1) / 2, 0, (z0 + z1) / 2);
      merlons(g, wall, x0, z0, x1, z1, H, 0.3);
    }
    for (const x of [-R, R]) for (const z of [-R, R]) { drum(g, 0.32, 0.36, H + 0.6, wall, x, (H + 0.6) / 2, z, 14, 2); mesh(g, new THREE.ConeGeometry(0.42, 0.55, 14), roofMat(o), x, H + 0.88, z); }
    // The gatehouse.
    for (const x of [-0.42, 0.42]) walls(g, 0.3, H + 0.4, 0.4, wall, x, 0, R);
    bx(g, 1.14, 0.3, 0.4, wall, 0, H + 0.25, R);
    pane(g, 'arch', 0.5, 0.75, 0, 0.37, R + 0.21);
    merlons(g, wall, -0.55, R, 0.55, R, H + 0.4, 0.22);
  } else {
    // A stockade of sharpened stakes round the yard.
    for (let i = 0; i < 44; i++) {
      const t = i / 44, side = Math.floor(t * 4), f = t * 4 - side, k = -R + f * 2 * R;
      const [x, z] = side === 0 ? [k, -R] : side === 1 ? [R, k] : side === 2 ? [-k, R] : [-R, -k];
      if (side === 2 && Math.abs(x) < 0.3) continue;
      drum(g, 0.07, 0.07, 1.0, wall, x, 0.5, z, 6, 1); mesh(g, new THREE.ConeGeometry(0.07, 0.18, 6), wall, x, 1.09, z);
    }
    for (const x of [-0.32, 0.32]) bx(g, 0.12, 1.4, 0.12, toon(TIMBER), x, 0.7, R);
    bx(g, 0.8, 0.12, 0.14, toon(TIMBER), 0, 1.35, R);
  }
  // The keep in the middle.
  walls(g, 1.2, stoneBuilt ? 2.1 : 1.6, 1.2, keepM, 0, 0, -0.2);
  const kh = stoneBuilt ? 2.1 : 1.6;
  if (stoneBuilt) { for (const [x0, z0, x1, z1] of [[-0.6, 0.4, 0.6, 0.4], [-0.6, -0.8, 0.6, -0.8], [-0.6, -0.8, -0.6, 0.4], [0.6, -0.8, 0.6, 0.4]]) merlons(g, keepM, x0, z0, x1, z1, kh, 0.24); }
  else top(g, o, 1.2, 1.2, kh, 0.7, 0, -0.2);
  bx(g, 1.24, 0.08, 1.24, toon(o.team), 0, kh - 0.3, -0.2);
  pane(g, 'door', 0.36, 0.6, 0, 0.3, 0.41);
  for (const x of [-0.3, 0.3]) pane(g, 'window', 0.12, 0.28, x, kh - 0.6, 0.41);
  banner(g, o.team, 0, kh, -0.2, 0.7);
  crate(g, 0.28, 0.85, 0.75); barrel(g, -0.85, 0.75, 0.8); barrel(g, -0.6, 0.95, 0.7);
  return g;
}

/** A watch house: a guardroom with a lookout above it, a lantern burning, stocks before the door for the caught. */
function watchhouse(o: Look): THREE.Group {
  const g = new THREE.Group(), st = stone(o);
  walls(g, 1.5, 0.9, 1.2, o.age >= 2 ? st : body(o), -0.2, 0, -0.3);
  posts(g, o, 1.5, 0.9, 1.2);
  top(g, o, 1.5, 1.2, 0.9, 0.6, -0.2, -0.3);
  pane(g, 'door', 0.36, 0.66, -0.2, 0.33, 0.31);
  pane(g, 'window', 0.22, 0.24, -0.65, 0.6, 0.31, 0, 0x8a6a30);
  // The lookout: a square tower with an open platform and a little roof.
  walls(g, 0.6, 2.1, 0.6, o.age >= 2 ? st : plank(o), 0.75, 0, -0.55);
  bx(g, 0.9, 0.08, 0.9, toon(PLANK, 'planks'), 0.75, 2.1, -0.55);
  for (const dx of [-0.4, 0.4]) for (const dz of [-0.4, 0.4]) bx(g, 0.05, 0.6, 0.05, toon(TIMBER), 0.75 + dx, 2.4, -0.55 + dz);
  mesh(g, new THREE.ConeGeometry(0.66, 0.45, 4).rotateY(Math.PI / 4), roofMat(o), 0.75, 2.92, -0.55);
  bx(g, 0.92, 0.06, 0.92, toon(o.team), 0.75, 1.95, -0.55);
  // The lantern on its bracket, burning.
  bx(g, 0.04, 0.04, 0.3, toon(TIMBER), -0.2, 0.95, 0.45);
  bx(g, 0.12, 0.16, 0.12, toon(0xffb040, '', 0xcc6a10), -0.2, 0.85, 0.58).castShadow = false;
  // The stocks: two posts, a board with three holes.
  for (const x of [0.3, 0.9]) bx(g, 0.06, 0.5, 0.06, toon(TIMBER), x, 0.25, 0.75);
  bx(g, 0.7, 0.12, 0.06, toon(PLANK, 'planks'), 0.6, 0.34, 0.75);
  for (const x of [0.45, 0.6, 0.75]) mesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateX(Math.PI / 2), toon(0x2a2018), x, 0.34, 0.77);
  bx(g, 0.04, 0.6, 0.04, toon(TIMBER), -0.75, 0.3, 0.45); // a pike stood against the wall
  mesh(g, new THREE.ConeGeometry(0.03, 0.12, 6), toon(0xa8acb2), -0.75, 0.66, 0.45);
  return g;
}

/** An inn on the road: two storeys of rooms over a common room, a stable yard with a trough and a cart, its sign a gilt star. */
function inn(o: Look): THREE.Group {
  const g = new THREE.Group(), gaudy = o.leaning === 'low', sober = o.leaning === 'holy';
  walls(g, 2.4, 0.24, 1.5, toon(0xb8b4aa, 'stone'), -0.3, 0, -0.55);
  walls(g, 2.3, 0.9, 1.4, wallMat(o, false), -0.3, 0.2, -0.55);
  walls(g, 2.5, 0.85, 1.6, wallMat(o), -0.3, 1.1, -0.55);
  posts(g, o, 2.5, 0.85, 1.6, 1.1);
  if (framed(o)) framing(g, 2.3, 0.9, 1.4, 0.2, -0.3, -0.55);
  top(g, o, 2.5, 1.6, 1.95, 1.0, -0.3, -0.55);
  if (pitched(o)) { chimney(g, -1.1, 2.2, -0.8, 1.0); chimney(g, 0.6, 2.2, -0.8, 0.9); }
  const glow = sober ? 0x6a5428 : gaudy ? 0xc07020 : 0x8a6020;
  pane(g, 'door', 0.4, 0.7, -0.3, 0.55, 0.16);
  for (const x of [-1.0, 0.4]) pane(g, 'window', 0.3, 0.38, x, 0.7, 0.16, 0, glow);
  for (const x of [-1.15, -0.65, 0.05, 0.55]) pane(g, 'window', 0.26, 0.34, x, 1.55, 0.26, 0, glow);
  bx(g, 2.52, 0.07, 1.62, toon(o.team), -0.3, 1.08, -0.55);
  // The sign: a gilt star on a board, hung from an arm.
  bx(g, 0.05, 0.05, 0.6, toon(TIMBER), -1.6, 1.7, 0.15);
  bx(g, 0.04, 0.44, 0.44, toon(0x2a3a5a), -1.6, 1.38, 0.3);
  const star = mesh(g, new THREE.CylinderGeometry(0.15, 0.15, 0.05, 5).rotateZ(Math.PI / 2), toon(GOLD, '', 0x4a3a08), -1.58, 1.38, 0.3); star.castShadow = false;
  // The stable yard: a lean-to stall, a trough, a cart, hay.
  leanTo(g, pitched(o) ? roofMat(o) : toon(o.roofColor, 'tiles'), 0.8, 1.4, 1.35, 0.95, -0.55, 0);
  for (const z of [-1.15, 0.05]) bx(g, 0.06, 0.95, 0.06, toon(TIMBER), 1.7, 0.47, z);
  walls(g, 0.06, 0.9, 1.4, toon(PLANK, 'planks'), 1.0, 0, -0.55);
  bx(g, 0.7, 0.2, 0.24, toon(PLANK, 'planks'), 1.3, 0.12, 0.5);
  bx(g, 0.6, 0.03, 0.16, toon(0x3a6a8a), 1.3, 0.22, 0.5).castShadow = false;
  mesh(g, new THREE.CylinderGeometry(0.24, 0.24, 0.36, 12), toon(0xd0b858, 'thatch'), 1.35, 0.18, -0.25);
  const cart = new THREE.Group(); cart.position.set(0.45, 0, 0.8); cart.rotation.y = -0.4; g.add(cart);
  bx(cart, 0.7, 0.08, 0.45, toon(PLANK, 'planks'), 0, 0.3, 0);
  for (const s of [-1, 1]) mesh(cart, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12).rotateX(Math.PI / 2), toon(TIMBER), 0, 0.2, s * 0.26);
  bx(cart, 0.9, 0.04, 0.04, toon(TIMBER), 0.7, 0.28, 0.12);
  sack(cart, -0.1, 0); barrel(cart, 0.15, 0, 0.6).position.y = 0.33;
  if (!sober) { bx(g, 0.7, 0.05, 0.36, toon(PLANK, 'planks'), -1.0, 0.36, 0.6); for (const x of [-1.25, -0.75]) bx(g, 0.05, 0.36, 0.3, toon(TIMBER), x, 0.18, 0.6); }
  return g;
}

/**
 * The makers by building id. The ids are those the sessions adding each building use in data.ts; one maker may
 * answer to more than one where a building is still being named.
 */
export const CIVIC: Record<string, (o: Look, seed: number) => THREE.Group> = {
  // The food session's (ids to be agreed).
  granary, mill, well, bathhouse, infirmary, almshouse,
  // The people session's: the Hall of Judgement, the Noble's Manor, and the Monastery (a Convent where its staff are mostly women: one id, one house).
  hall: judgement, manor, monastery: (o, s) => monastery(o, s),
  // The threats session's (ids to be agreed).
  fortress, watchhouse, inn,
};
/** The Convent's look, for a monastery kept by sisters: a smaller chapel, a walled garden, no tower. */
export const convent = (o: Look, seed: number): THREE.Group => monastery(o, seed, true);
registerMakers(CIVIC);
