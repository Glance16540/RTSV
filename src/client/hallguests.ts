// The people who stand at the hall in a court visit, drawn (src/sim/hallguests.ts says who they are): a rival's envoy and a
// suitor in the dress of their own people, and the daughter, when she has been asked, in the dress of the town's women,
// walking to the hall from a house of the town. Each has their name over them. They stand before the hall's door facing
// it, and are taken away when the sim no longer has them there (the answer given). Figures only: nothing here is a unit.
import * as THREE from 'three';
import type { Building, Game } from '../sim/game';
import { HallGuest, hallGuests } from '../sim/hallguests';
import { lookOf, ofPeople } from './models';
import { RealPerson, makePerson, outfitFor, peopleReady, play } from './person';

interface Figure { g: THREE.Group; real: RealPerson; label: THREE.Sprite; walk?: { from: THREE.Vector3; to: THREE.Vector3; t: number; time: number } }

/** Where each of them stands before the door, along the front of the hall, as a share of its width. */
const PLACE: Record<HallGuest['role'], number> = { envoy: -0.55, suitor: -0.05, daughter: 0.45, captain: 0.15 };
/** How fast the daughter walks to the hall, in tiles a second. */
const WALK = 1.3;

const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) % 100000; };

/** A name over a figure: dark letters on a pale slip, as the map's names are. */
function nameSprite(text: string): THREE.Sprite {
  const cv = document.createElement('canvas'), x = cv.getContext('2d')!;
  cv.width = 512; cv.height = 64;
  x.font = 'italic 600 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = Math.min(500, x.measureText(text).width + 28);
  x.fillStyle = 'rgba(244,234,206,0.9)'; x.fillRect(256 - w / 2, 10, w, 44);
  x.strokeStyle = 'rgba(58,42,22,0.8)'; x.lineWidth = 2; x.strokeRect(256 - w / 2, 10, w, 44);
  x.fillStyle = '#2a1c0c'; x.fillText(text, 256, 33, 490);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.33, 1); s.renderOrder = 6;
  s.material.userData.outlineParameters = { visible: false };
  return s;
}

export class HallFigures {
  private figs = new Map<string, Figure>();
  constructor(private scene: THREE.Scene) {}

  /** Bring the figures at every side's hall up to date with what stands there (hallguests.ts), and move and breathe them. */
  sync(game: Game, dt: number, heightAt: (x: number, y: number) => number): void {
    const want: { key: string; w: HallGuest; hall: Building; pid: number }[] = [];
    game.players.forEach((_, pid) => {
      const hall = game.buildings.find((b) => b.owner === pid && !b.dead && b.type === 'towncenter');
      if (hall) for (const w of hallGuests(game, pid)) want.push({ key: `${pid}:${w.key}`, w, hall, pid });
    });
    for (const [key, f] of this.figs) if (!want.some((x) => x.key === key)) this.drop(key, f);
    if (!peopleReady()) return;
    for (const { key, w, hall, pid } of want) {
      let f = this.figs.get(key);
      const half = hall.size / 2, frontY = hall.y + half + 1.1;
      const to = new THREE.Vector3(hall.x + PLACE[w.role] * hall.size, 0, frontY);
      to.y = heightAt(to.x, to.z);
      if (!f) {
        const seed = hash(key), color = w.role === 'daughter' ? game.players[pid].color : 0x6a5a48;
        ofPeople(w.civ);
        const made = makePerson(outfitFor('villager', w.female, color, lookOf(w.civ, seed), seed, 0, { cls: 'villager', age: 0, civ: w.civ }));
        if (!made) continue;
        f = { g: made.g, real: made.real, label: nameSprite(w.name) };
        f.g.add(f.label);
        f.label.position.set(0, 1.4 / Math.max(0.01, made.g.scale.y), 0);
        // The daughter comes from a house of the town; the guests are waiting there already.
        const house = w.role === 'daughter' ? game.buildings.filter((b) => b.owner === pid && !b.dead && b.type === 'house').sort((a, b) => Math.hypot(a.x - hall.x, a.y - hall.y) - Math.hypot(b.x - hall.x, b.y - hall.y))[0] : undefined;
        if (house) {
          const from = new THREE.Vector3(house.x, 0, house.y + house.size / 2 + 0.4);
          from.y = heightAt(from.x, from.z);
          f.walk = { from, to: to.clone(), t: 0, time: Math.max(0.5, from.distanceTo(to) / WALK) };
          f.g.position.copy(from);
          play(f.real, 'Walk_Loop', 1);
        } else {
          f.g.position.copy(to);
          play(f.real, 'Idle_Loop', 1);
        }
        this.scene.add(f.g);
        this.figs.set(key, f);
      }
      if (f.walk) {
        const k = Math.min(1, (f.walk.t += dt) / f.walk.time);
        f.g.position.lerpVectors(f.walk.from, f.walk.to, k);
        f.g.position.y = heightAt(f.g.position.x, f.g.position.z);
        f.g.rotation.y = Math.atan2(f.walk.to.x - f.walk.from.x, f.walk.to.z - f.walk.from.z);
        if (k >= 1) { f.walk = undefined; play(f.real, 'Idle_Loop', 1); }
      } else f.g.rotation.y = Math.PI; // facing the hall's door
      f.real.mixer.update(dt);
    }
  }

  /** Take everyone away (a new field). */
  clear(): void { for (const [key, f] of this.figs) this.drop(key, f); }

  private drop(key: string, f: Figure): void {
    this.scene.remove(f.g);
    f.label.material.map?.dispose(); f.label.material.dispose();
    this.figs.delete(key);
  }
}
