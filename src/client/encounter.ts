// Meeting them face to face (docs/DESIGN.md, the owner's word): a window over the map with the ones met as living
// figures, and the choices beside them. Who stands there, and how they are dressed, is src/sim/encounter.ts; the
// figures are the game's own people (person.ts), idling in a small three.js view of the window's own. The map stays
// behind it. Nothing here changes the campaign: the choices are the ones the map already offers.
//
// No child is ever shown. A captive is shown seated and covered, in plain long clothes.

import * as THREE from 'three';
import type { Campaign } from '../sim/campaign';
import { CIV_COLOR, UNITS } from '../sim/data';
import { BANDS } from '../sim/threats';
import { Figure, askerOf, awaiting, bandLineup, heldOf, wordKey } from '../sim/encounter';
import { Intrigue, choicesFor, choose, fullName, standing } from '../sim/intrigue';
import '../sim/courtstory';
import { lookOf } from './models';
import { Outfit, loadPeople, makePerson, outfitFor, play, RealPerson } from './person';

/** A choice beside the figures: its words, what it does, and why it cannot be taken now, if it cannot. */
export type EncounterChoice = [label: string, act: () => void, bar?: string];
export interface Meeting { title: string; text: string; figures: Figure[]; choices: EncounterChoice[] }

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const W = 520, H = 400;
const BAND_CLOTH = 0x4a3a30, PLAIN = 0x7a6a54, GOLD = 0xd8b040;

/** How a figure goes dressed: as a soldier of its kind, or as one of the plain people. */
function outfitOf(f: Figure): Outfit {
  const look = lookOf(f.civ, f.seed), color = f.civ ? CIV_COLOR[f.civ] ?? PLAIN : BAND_CLOTH;
  const u = f.dress === 'villager' || f.dress === 'noble' || f.dress === 'envoy' ? undefined : UNITS[f.dress];
  if (u) return outfitFor(f.dress, f.female, color, look, f.seed, 0, { cls: u.cls === 'hero' ? 'hero' : 'infantry', age: u.age ?? 1 });
  // The plain people: covered, as the town that keeps itself most covered dresses its people (wear 1).
  const plain = f.dress === 'villager', base = outfitFor('villager', f.female, plain ? PLAIN : color, look, f.seed, 1);
  const covered: Outfit = { ...base, sleeves: 'long', neck: 0, apron: null, ...(f.female ? { skirt: 'long', hairStyle: f.role === 'captive' ? 'covered' : 'bun', hat: '' } : {}) };
  if (f.role === 'captive') return { ...covered, top: 0xb8ab94, skirtColor: 0xb8ab94, legs: 0x8a7a64, cloak: null, barefoot: false };
  if (f.dress === 'noble') return { ...covered, skirt: 'long', cloak: color, trim: GOLD, mantle: !f.female, hat: f.female ? '' : 'cap', hatColor: 0x2a2228, girth: 1 };
  if (f.dress === 'envoy') return { ...covered, skirt: 'long', cloak: color, trim: GOLD, hat: 'hood', hatColor: color };
  return { ...covered, top: 0x8a6e4e, skirtColor: 0x8a6e4e };
}

/** Where each figure stands: the leader or the one asking in front, his men in a curve behind, captives seated to one side at the back. */
function place(figs: Figure[]): { x: number; z: number; yaw: number }[] {
  const men = figs.filter((f) => f.role === 'man').length;
  let m = 0, k = 0;
  return figs.map((f) => {
    if (f.role === 'leader' || f.role === 'asker') return { x: 0, z: 0.55, yaw: 0 };
    if (f.role === 'man') {
      const i = m++, side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const x = (men === 1 ? 0.45 : side * (0.42 + row * 0.38)), z = -0.05 - row * 0.32 - (i % 2) * 0.05;
      return { x, z, yaw: -x * 0.25 };
    }
    const i = k++;
    return { x: 0.95 + i * 0.3, z: -0.55 - i * 0.18, yaw: -0.6 };
  });
}

let open: { close: () => void } | null = null;
/** Close the window, if one is open. */
export const closeEncounter = (): void => { open?.close(); };

/**
 * Open the window over the map. Each choice closes it before it acts. Returns false where the figures cannot be drawn
 * (no WebGL): the caller then puts the same choices as it always did.
 */
export function openEncounter(m: Meeting): boolean {
  closeEncounter();
  const root = document.createElement('div');
  root.className = 'screen encounter';
  root.innerHTML = `<div class="sheet enc-sheet">
    <div class="enc-view"><canvas width="${W}" height="${H}"></canvas></div>
    <div class="enc-side"><h1>${m.title}</h1><p class="lead">${m.text}</p><div class="levels enc-choices"></div></div>
  </div>`;
  const canvas = root.querySelector('canvas')!;
  let gl: THREE.WebGLRenderer | null = null;
  try { gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return false; }
  document.body.appendChild(root);
  const row = root.querySelector('.enc-choices')!;
  let alive = true;
  const close = (): void => { if (!alive) return; alive = false; gl?.dispose(); root.remove(); if (open?.close === close) open = null; };
  open = { close };
  for (const [label, act, bar] of m.choices) {
    const b = document.createElement('button');
    b.textContent = label;
    if (bar) { b.disabled = true; b.title = bar; }
    b.addEventListener('click', () => { close(); act(); });
    row.appendChild(b);
  }

  // ---- the figures, standing on a patch of ground in the evening light ----
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  const wide = m.figures.length > 1;
  // Close enough to see faces and gear: the whole band from near at hand, or the one asking from the knees up.
  cam.position.set(wide ? 0.22 : 0.05, wide ? 0.95 : 0.72, wide ? 3.3 : 1.7); cam.lookAt(wide ? 0.22 : 0, wide ? 0.5 : 0.6, wide ? -0.25 : 0.55);
  // Lit like a portrait: a warm key from the front and side casting soft shadows, a cool fill from the other side, and a rim from behind.
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a302a, 0.45));
  const key = new THREE.DirectionalLight(0xffe2bc, 2.6); key.position.set(-1.6, 3.2, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 10 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.7); fill.position.set(2.2, 1.4, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff0d8, 1.8); rim.position.set(0.6, 2.4, -3); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(wide ? 2.6 : 1.1, 64), new THREE.MeshStandardMaterial({ color: 0x6a5a3e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(wide ? 0.3 : 0, 0, wide ? -0.3 : 0.5); ground.receiveShadow = true; scene.add(ground);
  // As sharp as the screen allows, and never less than twice over.
  gl.setPixelRatio(Math.min(3, Math.max(2, window.devicePixelRatio || 1))); gl.setSize(W, H, false); gl.toneMapping = THREE.NeutralToneMapping;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const people: RealPerson[] = [];
  const stand = (): void => {
    if (!alive) return;
    const at = place(m.figures);
    m.figures.forEach((f, i) => {
      const made = makePerson(outfitOf(f));
      if (!made) return;
      made.g.position.set(at[i].x, 0, at[i].z); made.g.rotation.y = at[i].yaw;
      made.g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
      scene.add(made.g);
      people.push(made.real);
      play(made.real, f.pose === 'talk' ? 'Idle_Talking_Loop' : f.pose === 'ready' ? 'Idle_Loop' : f.pose === 'sit' ? 'Sitting_Idle_Loop' : 'Idle_Loop', 0.8 + ((f.seed % 7) / 30));
      made.real.mixer.update((f.seed % 13) / 5); // not all in step
    });
  };
  let last = performance.now();
  const frame = (now: number): void => {
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (const p of people) p.mixer.update(dt);
    gl!.render(scene, cam);
    requestAnimationFrame(frame);
  };
  loadPeople(stand);
  requestAnimationFrame(frame);
  return true;
}

/** An army meets a band: its leader in front, some of his men, and those it holds; the choices are the map's own. */
export function meetBand(c: Campaign, prompt: { title: string; text: string }, choices: EncounterChoice[]): boolean {
  const b = (c.bands ?? []).find((x) => x.id === c.pending?.band);
  if (!b) return false;
  const held = heldOf(b), kind = BANDS[b.kind];
  const holds = held.men + held.women ? `They hold ${held.women ? `${held.women} ${held.women === 1 ? 'woman' : 'women'}` : ''}${held.men && held.women ? ' and ' : ''}${held.men ? `${held.men} ${held.men === 1 ? 'man' : 'men'}` : ''}.` : 'They hold nobody.';
  const text = `<span class="enc-who">${kind.icon} <b>${esc(b.name[0].toUpperCase() + b.name.slice(1))}</b>, ${esc(kind.name.toLowerCase())} of strength ${b.strength}. ${holds}</span>${prompt.text}`;
  return openEncounter({ title: prompt.title, text, figures: bandLineup(c, b), choices });
}

/** Stories already put to the player face to face in this sitting, so each comes up once at each pass. */
const met = new Set<string>();
/** A story that waits on the player's word and has not yet been put to them face to face. */
export const storyToMeet = (c: Campaign): Intrigue | undefined => (c.phase === 'player' ? awaiting(c).find((it) => !met.has(wordKey(it) + (it.asked ? ':asked' : ''))) : undefined);

const ASKER: Record<string, string> = { suitor: 'A suitor', rival: 'An envoy', plot: 'A plotter found out', thief: 'A thief brought for judgement' };
/** Put a story to the player face to face: the one asking, what it stands at, and its choices; or decide later on the land's panel. */
export function meetStory(c: Campaign, it: Intrigue, done: () => void): boolean {
  const asker = askerOf(c, it);
  if (!asker) return false;
  met.add(wordKey(it) + (it.asked ? ':asked' : ''));
  const who = it.kind === 'suitor' ? `${it.cast?.suitor ?? 'A son of a rival house'}, of the house of ${it.cast?.king ?? 'a rival'}`
    : it.kind === 'rival' ? `An envoy of ${it.cast?.king ?? 'the rival'}, of the ${c.factions[it.rival ?? 0]?.name ?? 'rival people'}`
    : it.kind === 'plot' ? it.nobles?.[it.culprit]?.title ?? 'A noble'
    : it.thief ? `${fullName(it.thief)} the ${it.thief.trade}` : 'The thief';
  const choices: EncounterChoice[] = choicesFor(c, it).filter((k) => k.id !== 'watch' && k.id !== 'unwatch')
    .map((k) => [k.label, () => { choose(c, it.id, k.id); done(); }, k.bar]);
  choices.push(['Decide later', done]);
  return openEncounter({ title: ASKER[it.kind] ?? 'Someone to see you', text: `<span class="enc-who"><b>${esc(who)}</b></span>${esc(standing(c, it))}`, figures: [asker], choices });
}
