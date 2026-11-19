// The markets' caravans on the campaign map (src/sim/caravans.ts): each caravan on the road is a little train of pack beasts
// under its people's colour, camels where its home is desert or steppe and mules elsewhere, walking its road from town to
// town and back while the season stands. And the line on a town's panel that says what its Market's caravan is about.
import * as THREE from 'three';
import type { Campaign } from '../sim/campaign';
import { biomeOf } from '../sim/campaignbase';
import type { Caravan } from '../sim/caravans';
import { caravansOf, partnerOf } from '../sim/caravans';
import { standsAt } from '../sim/studies';

/** A caravan as the map walks it: its piece, the road's points in the map's units, and where along it it starts. */
export interface Walker { g: THREE.Group; pts: [number, number][]; ph: number; /** One way only, from the first point to the last and over again (a convoy, convoydraw.ts), not out and back. */ one?: boolean }

const box = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);
const BODY = box(0.9, 0.42, 0.36), HEAD = box(0.26, 0.22, 0.2), NECK = box(0.16, 0.42, 0.14), LEG = box(0.09, 0.42, 0.09), PACK = box(0.6, 0.3, 0.5), HUMP = box(0.32, 0.22, 0.3);
const mats = new Map<number, THREE.MeshLambertMaterial>();
const mat = (color: number): THREE.MeshLambertMaterial => { let m = mats.get(color); if (!m) mats.set(color, (m = new THREE.MeshLambertMaterial({ color }))); return m; };

/** One beast with its load: a camel (a hump, a long neck) or a mule, with a pack in its people's colour. */
function beast(camel: boolean, color: number): THREE.Group {
  const g = new THREE.Group(), hide = mat(camel ? 0xc49a5a : 0x6a5040);
  const body = new THREE.Mesh(BODY, hide); body.position.y = 0.62; g.add(body);
  const neck = new THREE.Mesh(NECK, hide); neck.position.set(0.48, camel ? 0.95 : 0.82, 0); neck.rotation.z = camel ? -0.5 : -0.9; g.add(neck);
  const head = new THREE.Mesh(HEAD, hide); head.position.set(camel ? 0.66 : 0.62, camel ? 1.18 : 0.98, 0); g.add(head);
  for (const [x, z] of [[0.32, 0.12], [0.32, -0.12], [-0.32, 0.12], [-0.32, -0.12]]) { const l = new THREE.Mesh(LEG, hide); l.position.set(x, 0.21, z); g.add(l); }
  if (camel) { const hump = new THREE.Mesh(HUMP, hide); hump.position.set(-0.05, 0.9, 0); g.add(hump); }
  const pack = new THREE.Mesh(PACK, mat(color)); pack.position.set(camel ? -0.3 : 0, camel ? 1.0 : 0.95, 0); g.add(pack);
  return g;
}

/** How big a caravan stands on the map: about a house's height, as the towns' own pieces are. */
export const CARAVAN_SIZE = 0.3;

/** A caravan's piece: three beasts nose to tail, facing along +z, so that it can be turned to its road. */
export function caravanTrain(color: number, camel: boolean): THREE.Group {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const b = beast(camel, color); b.rotation.y = -Math.PI / 2; b.position.z = -k * 1.15; g.add(b); }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  g.scale.setScalar(CARAVAN_SIZE);
  return g;
}

/** A caravan on the road, ready to walk: its piece and its road through the lands' towns. */
export function walkerFor(c: Campaign, x: Caravan): Walker {
  const home = biomeOf(c, x.to), camel = home === 'desert' || home === 'steppe';
  const pts = x.road.map((id) => [c.territories[id].x, c.territories[id].y] as [number, number]);
  return { g: caravanTrain(c.factions[x.owner]?.color ?? 0x806040, camel), pts, ph: (x.id * 0.618) % 1 };
}

/** Where a walker is now: out along its road and back, a lap in `lap` seconds, standing on the ground `place` gives. */
export function walk(w: Walker, now: number, place: (x: number, y: number) => [number, number, number], lap = 40): void {
  const seg = w.pts.slice(1).map((p, i) => Math.hypot(p[0] - w.pts[i][0], p[1] - w.pts[i][1])), L = seg.reduce((a, b) => a + b, 0);
  if (!L) { const [X, Y, Z] = place(w.pts[0][0], w.pts[0][1]); w.g.position.set(X, Y, Z); return; }
  const k = ((now / lap + w.ph) % 1) * (w.one ? 1 : 2), back = k > 1;
  let s = (back ? 2 - k : k) * L, i = 0;
  while (i < seg.length - 1 && s > seg[i]) s -= seg[i++];
  const [ax, ay] = w.pts[i], [bx, by] = w.pts[i + 1], f = seg[i] ? s / seg[i] : 0;
  const x = ax + (bx - ax) * f, y = ay + (by - ay) * f, [X, Y, Z] = place(x, y);
  w.g.position.set(X, Y, Z);
  w.g.rotation.y = Math.atan2(back ? ax - bx : bx - ax, back ? ay - by : by - ay);
}

/** The line on a town's panel about its Market's trade, or '' where it has no Market standing. */
export function marketLine(c: Campaign, tid: number): string {
  if (!standsAt(c, tid, 'market')) return '';
  const t = c.territories[tid], p = partnerOf(c, tid);
  if (!p) return '<div class="hint">🐪 Market: there is no other market within reach by road to trade with, so no caravan goes out.</div>';
  const out = caravansOf(c, t.owner).find((x) => x.to === tid);
  const to = c.territories[p.at].name, lands = p.road.length - 1;
  return `<div>🐪 Market: trades with ${to}, ${lands} ${lands === 1 ? 'land' : 'lands'} by road.${out ? ` Its caravan is on the road, and should bring home ${out.cargo.gold} gold.` : ''}</div>`;
}
