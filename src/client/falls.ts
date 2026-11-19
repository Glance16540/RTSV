// How the fallen go down, and how a hurt animal shows it (docs/systems-board, "War": riders never fell from their
// mounts, there was one recorded death motion, and animals showed no wounds).
//
//   - People: the recorded fall is one of four, chosen by lot when they fall: the recorded fall itself; struck in the
//     chest, down on the knees and over on the face; struck on the head and spun half round as they go down; and sagging
//     to a crouch and rolling over on the side. Each still ends in one of the sprawls (person.ts sprawl).
//   - A mounted man: by lot, either the mount goes down under him and he is pitched forward over its neck, or he is
//     struck from the saddle and falls beside it, and the mount stumbles down after him.
//   - Animals (wild beasts, mounts, and the horses that draw a car) show their hurt: below two thirds of their strength
//     they carry a mark or two on the flank (where blood is shown at all), and below one third they limp, slower and
//     dipping on one leg, with the head carried low.
// Drawing only: nothing here is a rule, and it costs nothing until someone falls or is hurt.
import * as THREE from 'three';
import type { Beast } from './beast';
import { gait } from './beast';
import { play, sprawl } from './person';
import type { RealPerson } from './person';

/** The ways a person can go down. */
export const FALLS = 4;

/** Draws set beforehand, taken first: for a staged view that shows each way in turn (window.__falls). Empty in play. */
const forced: number[] = [];
if (typeof window !== 'undefined') (window as unknown as { __falls?: number[] }).__falls = forced;
/** Draw a way to fall, by lot (out of `n`). */
export const fallLot = (n = FALLS): number => (forced.length ? forced.shift()! % n : Math.floor(Math.random() * n));
/** Draw the side they go over on, by lot: +1 or -1. */
export const sideLot = (): number => (forced.length ? (forced.shift()! ? 1 : -1) : Math.random() < 0.5 ? 1 : -1);

/** Raise a falling figure by `by` above where it fell (it is moved by the change, so the sinking after still works). */
const lift = (g: THREE.Object3D, by: number): void => { g.position.y += by - ((g.userData.fallLift as number | undefined) ?? 0); g.userData.fallLift = by; };
const ease = (k: number): number => { const t = Math.min(1, Math.max(0, k)); return t * t * (3 - 2 * t); };

/**
 * A person going down, `t` seconds in, by the `way` drawn. Moves the figure's motion and its group's lean; the caller
 * sinks and removes it as before. `side` is +1 or -1, which side they go over on.
 */
export function fallPerson(g: THREE.Object3D, p: RealPerson, way: number, t: number, dt: number, side: number): void {
  const yaw0 = (g.userData.fallYaw ??= g.rotation.y) as number;
  if (way === 1) {
    // Struck in the chest: down on the knees, then over on the face.
    play(p, t < 0.35 ? 'Hit_Chest' : 'Fixing_Kneeling', t < 0.35 ? 1.4 : 1.6, true);
    p.mixer.update(dt);
    const k = ease((t - 0.9) / 0.55);
    g.rotation.x = k * 1.42;
    g.rotation.z = 0;
    lift(g, k * 0.1 * Math.abs(g.scale.y));
    sprawl(p, 1, ease((t - 1.0) / 0.5)); // the legs laid out straight behind
    sprawl(p, 2, ease((t - 1.3) / 0.6));
  } else if (way === 2) {
    // Struck on the head: spun half round as they go down in the recorded fall.
    play(p, t < 0.25 ? 'Hit_Head' : 'Death01', t < 0.25 ? 1.5 : 1.15, true);
    p.mixer.update(dt);
    g.rotation.y = yaw0 + side * ease(t / 0.8) * 1.9;
    g.rotation.x = g.rotation.z = 0;
    sprawl(p, 1, ease((t - 0.8) / 0.8));
  } else if (way === 3) {
    // Sagging to a crouch, then rolling over on the side.
    play(p, t < 0.3 ? 'Hit_Chest' : 'Crouch_Idle_Loop', 1, false);
    p.mixer.update(dt);
    const k = ease((t - 0.8) / 0.5);
    g.rotation.x = 0;
    g.rotation.z = side * k * 1.45;
    lift(g, k * 0.12 * Math.abs(g.scale.y));
    sprawl(p, 1, ease((t - 0.9) / 0.6));
    sprawl(p, 2, ease((t - 1.1) / 0.7));
  } else {
    // The recorded fall, a little quicker or slower, and one of the sprawls.
    const lot = (g.userData.fallLot ??= Math.random()) as number;
    play(p, 'Death01', 0.85 + lot * 0.36, true);
    p.mixer.update(dt);
    sprawl(p, Math.floor(lot * 3), ease((t - 0.5) / 0.9));
    g.rotation.x = g.rotation.z = 0;
  }
}

/** A rider leaving the saddle: where he was, and where he lands. */
export interface Unseated { g: THREE.Object3D; p: RealPerson; from: THREE.Vector3; to: THREE.Vector3; yaw: number; ground: number }

/**
 * Take a mounted man out of his saddle into the world as he falls. `ahead` pitches him forward over the neck (the mount
 * went down under him); otherwise he goes off to one side. `groundAt` gives the height of the ground. Returns the rider,
 * now a child of `world`, or nothing if there is no rider astride.
 */
export function unseat(world: THREE.Object3D, mounted: THREE.Object3D, riders: { p: RealPerson; astride: boolean }[] | undefined, ahead: boolean, side: number, groundAt: (x: number, z: number) => number): Unseated | undefined {
  const r = riders?.find((x) => x.astride);
  if (!r) return undefined;
  const g = r.p.mixer.getRoot() as THREE.Object3D;
  const fig = figureOf(g, mounted);
  if (!fig) return undefined;
  mounted.updateMatrixWorld(true);
  world.attach(fig);
  const yaw = mounted.rotation.y, fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw) * side, lz = -Math.sin(yaw) * side;
  const from = fig.position.clone();
  const to = from.clone().add(ahead ? new THREE.Vector3(fx * 1.05 + lx * 0.2, 0, fz * 1.05 + lz * 0.2) : new THREE.Vector3(lx * 0.75 - fx * 0.1, 0, lz * 0.75 - fz * 0.1));
  fig.rotation.set(0, yaw + (ahead ? 0 : side * 1.2), 0);
  return { g: fig, p: r.p, from, to, yaw: fig.rotation.y, ground: groundAt(to.x, to.z) };
}
/** The figure's own group: the outermost thing under the mount that holds this motion's root. */
function figureOf(root: THREE.Object3D, mounted: THREE.Object3D): THREE.Object3D | undefined {
  let o: THREE.Object3D | null = root;
  while (o && o.parent && o.parent !== mounted && !o.parent.userData.biped) o = o.parent;
  return o && o !== mounted ? o : undefined;
}

/** The rider thrown and falling, `t` seconds in: an arc to the ground, then he lies as a fallen man. */
export function fallRider(u: Unseated, t: number, dt: number, side: number): void {
  const k = Math.min(1, t / 0.45);
  u.g.position.lerpVectors(u.from, u.to, k);
  u.g.position.y = THREE.MathUtils.lerp(u.from.y, u.ground, k * k) + Math.sin(k * Math.PI) * 0.25;
  play(u.p, 'Death01', 1.35, true);
  u.p.mixer.update(dt);
  sprawl(u.p, side > 0 ? 1 : 2, ease((t - 0.7) / 0.8));
}

/** The mount going down: its own recorded fall, `delay` seconds after the blow. Returns whether it has begun. */
export function fallMount(b: Beast, t: number, dt: number, delay: number): boolean {
  if (t < delay) { gait(b, 'Idle', 1); b.mixer.update(dt); return false; }
  gait(b, 'Death', 1.1, true);
  b.mixer.update(dt);
  return true;
}

// ---- Hurt animals ----

/** How hurt an animal is: 0 whole, 1 marked, 2 lamed. */
export const beastHurt = (hp: number, maxHp: number): number => (hp < maxHp * 0.33 ? 2 : hp < maxHp * 0.66 ? 1 : 0);

const MARK = new THREE.MeshLambertMaterial({ color: 0x5a0e10 });
const MARK_GEO = new THREE.SphereGeometry(1, 8, 6);

/** Mark an animal's flank where it was struck (only where blood is shown), one or two marks for how hurt it is. */
export function markBeast(b: Beast, hurt: number, gore: boolean): void {
  const had = (b.g.userData.marks as THREE.Mesh[] | undefined) ?? [];
  const want = gore ? Math.min(2, hurt) : 0;
  if (had.length === want) return;
  for (const m of had) m.removeFromParent();
  const marks: THREE.Mesh[] = [];
  if (want) {
    b.g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b.g), inv = b.g.matrixWorld.clone().invert();
    box.applyMatrix4(inv); // in the animal's own frame
    const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    for (let i = 0; i < want; i++) {
      const m = new THREE.Mesh(MARK_GEO, MARK);
      const s = i ? -1 : 1, r = Math.max(0.025, Math.min(size.x, size.y) * 0.09);
      m.scale.set(r * 0.25, r * (1.1 - i * 0.3), r * (1.4 - i * 0.4));
      m.position.set(mid.x + s * size.x * 0.47, box.min.y + size.y * (0.58 - i * 0.08), mid.z + size.z * (0.08 - i * 0.18));
      b.g.add(m);
      marks.push(m);
    }
  }
  b.g.userData.marks = marks;
}

/**
 * A lamed animal limps: it dips on one leg every stride, leaning to that side, and carries its head low. `whole` is an
 * animal that is the unit itself (the renderer sets its place each frame); otherwise a mount or a draught animal.
 */
export function limp(b: Beast, hurt: number, moving: boolean, clock: number, seed: number, whole: boolean): void {
  // A whole animal is set in its place each frame by the renderer; a mount sits on a place of its own, kept here.
  const base = (b.g.userData.limpBase ??= { y: b.g.position.y, z: b.g.rotation.z, x: b.g.rotation.x }) as { y: number; z: number; x: number };
  if (hurt < 2) {
    if (b.g.userData.limping && !whole) { b.g.position.y = base.y; b.g.rotation.z = base.z; b.g.rotation.x = base.x; }
    b.g.userData.limping = false;
    return;
  }
  b.g.userData.limping = true;
  const dip = Math.max(0, Math.sin(clock * (moving ? 7 : 1.2) + seed)) ** 3;
  b.g.position.y = (whole ? b.g.position.y : base.y) - dip * (moving ? 0.035 : 0.012);
  b.g.rotation.z = (whole ? 0 : base.z) + dip * (moving ? 0.07 : 0.02) * (seed % 2 ? 1 : -1);
  b.g.rotation.x = (whole ? 0 : base.x) + 0.06; // the head carried low
}
