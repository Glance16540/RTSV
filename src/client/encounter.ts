// Meeting them face to face (docs/DESIGN.md, the owner's word): a window over the map with the ones met as living
// figures, and the choices beside them. Who stands there, and how they are dressed, is src/sim/encounter.ts; the
// figures are the game's own people (person.ts), idling in a small three.js view of the window's own. The map stays
// behind it. Nothing here changes the campaign: the choices are the ones the map already offers.
//
// No child is ever shown. A captive is shown seated and covered, in plain long clothes.

import { strengthOf } from '../sim/strengthwords';
import { givenNames } from '../sim/peoplenames';
import { heroFor } from '../sim/campaignbase';
import * as THREE from 'three';
import type { Campaign } from '../sim/campaign';
import { CIV_COLOR, UNITS } from '../sim/data';
import { BANDS } from '../sim/threats';
import { Figure, askerOf, awaiting, bandLineup, heldOf, wordKey } from '../sim/encounter';
import { Intrigue, choicesFor, choose, fullName, standing } from '../sim/intrigue';
import '../sim/courtstory';
import { lookOf } from './models';
import { Outfit, loadPeople, makePerson, outfitFor, play, point, RealPerson } from './person';

/** A choice beside the figures: its words, what it does, and why it cannot be taken now, if it cannot. */
export type EncounterChoice = [label: string, act: () => void, bar?: string];
export interface Meeting { title: string; text: string; figures: Figure[]; choices: EncounterChoice[] }

const esc = (s: string): string => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
const W = 520, H = 400;
const PLAIN = 0x7a6a54, GOLD = 0xd8b040, LINEN = 0xcfc3a6;
/** The colours a band's kit runs to, kind by kind: rust for raiders, iron for slavers, sea blue for pirates, the green of the woods for highwaymen, old blood for marauders. */
const KIT: Record<string, number> = { raiders: 0x8a3e26, slavers: 0x3e3c46, pirates: 0x2a5478, highwaymen: 0x4e6230, marauders: 0x6a2a24 };

/** Cloth as it was dyed: a nation's colour taken down to half its strength and darkened a little. */
function dyed(color: number): number {
  const c = new THREE.Color(color), hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return c.setHSL(hsl.h, hsl.s * 0.55, hsl.l * 0.78).getHex();
}
const GREY = 0x8a8680, DARK_HAIR = 0x3a2a1c;

/** How a figure goes dressed, by the same road the battle dresses its people (person.ts outfitFor, with their nation's look and dress). */
function outfitOf(f: Figure): Outfit {
  const look = lookOf(f.civ, f.seed), color = dyed(f.band ? KIT[f.band] ?? PLAIN : f.civ ? CIV_COLOR[f.civ] ?? PLAIN : PLAIN);
  const u = f.dress === 'villager' || f.dress === 'noble' || f.dress === 'envoy' ? undefined : UNITS[f.dress];
  if (u) {
    const o = outfitFor(f.dress, f.female, color, look, f.seed, 0, { cls: u.cls === 'hero' ? 'hero' : 'infantry', age: u.age ?? 1 });
    if (!f.band) return o;
    // A band's own kit: its colour in the hems and on the head, and its leader in a cloak of it. No fur ring at the neck,
    // which reads as a collar of rope this close; and a sword where the axe would show only its flat head.
    return { ...o, trim: color, hatColor: o.hat ? color : o.hatColor, skirtColor: color, mantle: false, weapon: o.weapon === 'axe' ? 'sword' : o.weapon, ...(f.role === 'leader' ? { cloak: color } : {}) };
  }
  // The plain people as their town dresses them (wear 1: the most covered), in their nation's dress.
  const base = outfitFor('villager', f.female, color, look, f.seed, 1, { cls: 'villager', age: 0, civ: f.civ || undefined });
  // A captive: whole plain long garments of undyed cloth.
  if (f.role === 'captive') return { ...base, top: LINEN, skirtColor: LINEN, legs: 0xa89a7e, sleeves: 'long', neck: 0, skirt: 'long', apron: null, cloak: null, mantle: false, hat: '', trim: 0x9a8a6c, ...(f.female ? { hairStyle: 'long' } : {}) };
  if (f.dress === 'noble' || f.dress === 'envoy') {
    // A man of rank: a belted tunic over dark hose, a cloak behind; his own hair, a young man's for a suitor. A woman of rank: a long gown and a circlet.
    const hair = f.dress === 'noble' && base.hair === GREY ? DARK_HAIR : base.hair;
    if (f.female) return { ...base, sleeves: 'long', neck: 0, skirt: 'long', apron: null, cloak: color, trim: GOLD, mantle: false, hairStyle: 'long', hat: 'circlet', hatColor: GOLD };
    return { ...base, hair, top: color, skirtColor: color, skirt: 'short', legs: 0x2e2824, sleeves: 'long', neck: 0, apron: null, cloak: dyed(0x5a4a3a), trim: GOLD, mantle: false, hat: '', girth: 1 };
  }
  // A townsman or townswoman, as the town dresses them, her hair worn plain.
  return { ...base, sleeves: 'long', neck: 0, ...(f.female ? { hairStyle: 'long', hat: '' } : {}) };
}

/** Where each figure stands: the leader or the one asking in front, his men in a curve behind, captives seated to one side at the back. */
function place(figs: Figure[]): { x: number; z: number; yaw: number }[] {
  const men = figs.filter((f) => f.role === 'man').length;
  let m = 0, k = 0;
  return figs.map((f) => {
    if (f.role === 'leader' || f.role === 'asker') return { x: 0, z: 0.6, yaw: 0.15 };
    if (f.role === 'man') {
      const i = m++, side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      const x = (men === 1 ? 0.5 : side * (0.5 + row * 0.42)), z = -0.35 - row * 0.4 - (i % 2) * 0.06;
      return { x, z, yaw: -x * 0.25 };
    }
    const i = k++;
    // Further back and closer together, so the third of them is still inside the frame.
    return { x: 1.0 + i * 0.24, z: -1.3 - i * 0.25, yaw: -0.6 };
  });
}

const dir = new THREE.Vector3(), turn = new THREE.Quaternion();
/** One brought before the leader stands humbly: arms down, hands together in front, head a little bowed; one of rank stands upright, hands at his sides. Over the motion that plays. */
function stoop(p: RealPerson, g: THREE.Object3D, bow: boolean): void {
  g.updateWorldMatrix(true, false); g.getWorldQuaternion(turn);
  const to = (x: number, y: number, z: number) => dir.set(x, y, z).normalize().applyQuaternion(turn);
  if (bow) {
    point(p.bones.get('DEF-upper_armL'), to(0.12, -1, 0.18), 1); point(p.bones.get('DEF-forearmL'), to(-0.75, -0.55, 0.5), 1);
    point(p.bones.get('DEF-upper_armR'), to(-0.12, -1, 0.18), 1); point(p.bones.get('DEF-forearmR'), to(0.75, -0.55, 0.5), 1);
    p.bones.get('DEF-head')?.rotateX(0.22);
  } else {
    point(p.bones.get('DEF-upper_armL'), to(0.16, -1, 0.02), 1); point(p.bones.get('DEF-forearmL'), to(0.06, -1, 0.12), 1);
    point(p.bones.get('DEF-upper_armR'), to(-0.16, -1, 0.02), 1); point(p.bones.get('DEF-forearmR'), to(-0.06, -1, 0.12), 1);
  }
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
  cam.position.set(wide ? 0.15 : 0.05, wide ? 0.9 : 0.78, wide ? 3.05 : 2.35); cam.lookAt(wide ? 0.15 : 0, wide ? 0.46 : 0.62, wide ? -0.25 : 0.6);
  // Lit like a portrait: a warm key from the front and side casting soft shadows, a cool fill from the other side, and a rim from behind.
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x3a302a, 0.45));
  const key = new THREE.DirectionalLight(0xffe2bc, 2.6); key.position.set(-1.6, 3.2, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 10 });
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.7); fill.position.set(2.2, 1.4, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff0d8, 1.8); rim.position.set(0.6, 2.4, -3); scene.add(rim);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(wide ? 2.6 : 1.1, 64), new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(wide ? 0.3 : 0, 0, wide ? -0.3 : 0.5); ground.receiveShadow = true; scene.add(ground);
  // As sharp as the screen allows, and never less than twice over.
  gl.setPixelRatio(Math.min(3, Math.max(2, window.devicePixelRatio || 1))); gl.setSize(W, H, false); gl.toneMapping = THREE.NeutralToneMapping;
  gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const people: RealPerson[] = [], turning: THREE.Object3D[] = [], humble: { p: RealPerson; g: THREE.Object3D; bow: boolean }[] = [];
  const stand = (): void => {
    if (!alive) return;
    const at = place(m.figures);
    m.figures.forEach((f, i) => {
      const made = makePerson(outfitOf(f));
      if (!made) return;
      made.g.position.set(at[i].x, 0, at[i].z); made.g.rotation.y = at[i].yaw;
      made.g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; }); // on the ground only: a figure shading itself goes muddy
      scene.add(made.g);
      people.push(made.real);
      if (!wide) turning.push(made.g);
      if (f.pose === 'humble' || f.pose === 'stand') humble.push({ p: made.real, g: made.g, bow: f.pose === 'humble' });
      play(made.real, f.pose === 'talk' ? 'Idle_Talking_Loop' : f.pose === 'ready' ? 'Idle_Loop' : f.pose === 'sit' ? 'Sitting_Idle_Loop' : 'Idle_Loop', 0.8 + ((f.seed % 7) / 30));
      made.real.mixer.update((f.seed % 13) / 5); // not all in step
    });
  };
  let last = performance.now();
  const frame = (now: number): void => {
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (const p of people) p.mixer.update(dt);
    for (const h of humble) stoop(h.p, h.g, h.bow);
    for (const g of turning) g.rotation.y = 0.15 + Math.sin(now / 4000) * 0.45; // one alone turns slowly, to be seen from either side
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
  const text = `<span class="enc-who">${kind.icon} <b>${esc(b.name[0].toUpperCase() + b.name.slice(1))}</b>, ${esc(kind.name.toLowerCase())} of ${strengthOf(b.strength)}. ${holds}</span>${prompt.text}`;
  return openEncounter({ title: prompt.title, text, figures: bandLineup(c, b), choices });
}

/** Stories already put to the player face to face in this sitting, so each comes up once at each pass. */
const met = new Set<string>();
/** A story that waits on the player's word and has not yet been put to them face to face. */
export const storyToMeet = (c: Campaign): Intrigue | undefined => (c.phase === 'player' ? awaiting(c).find((it) => !met.has(wordKey(it) + (it.asked ? ':asked' : ''))) : undefined);

/** The envoy a rival ruler sends, by a name of his own people's: the same envoy for the same story (playthrough of 21 November: the sheet named only the ruler who sent him). */
const envoyName = (c: Campaign, it: Intrigue): string => { const names = givenNames(c.factions[it.rival ?? 0]?.civ, 'm'); return names.length ? names[(it.id * 7919 + 13) % names.length] : 'An envoy'; };
const ASKER: Record<string, string> = { suitor: 'A suitor', rival: 'An envoy', plot: 'A plotter found out', thief: 'A thief brought for judgement' };
/** Put a story to the player face to face: the one asking, what it stands at, and its choices; or decide later on the land's panel. */
export function meetStory(c: Campaign, it: Intrigue, done: () => void): boolean {
  const asker = askerOf(c, it);
  if (!asker) return false;
  met.add(wordKey(it) + (it.asked ? ':asked' : ''));
  const who = it.kind === 'suitor' ? `${it.cast?.suitor ?? 'A son of a rival house'}, of the house of ${it.cast?.king ?? 'a rival'}`
    : it.kind === 'rival' ? `${envoyName(c, it)}, envoy of ${it.cast?.king ?? 'the rival'}, ${heroFor(c, it.rival ?? 0).female ? 'queen' : 'king'} of the ${c.factions[it.rival ?? 0]?.name ?? 'rival people'}`
    : it.kind === 'plot' ? it.nobles?.[it.culprit]?.title ?? 'A noble'
    : it.thief ? `${fullName(it.thief)} the ${it.thief.trade}` : 'The thief';
  const choices: EncounterChoice[] = choicesFor(c, it).filter((k) => k.id !== 'watch' && k.id !== 'unwatch')
    .map((k) => [k.label, () => { choose(c, it.id, k.id); done(); }, k.bar]);
  choices.push(['Decide later', done]);
  return openEncounter({ title: it.kind === 'rival' ? `${envoyName(c, it)}, ${heroFor(c, it.rival ?? 0).female ? 'the queen\'s' : 'the king\'s'} envoy` : ASKER[it.kind] ?? 'Someone to see you', text: `<span class="enc-who"><b>${esc(who)}</b></span>${esc(standing(c, it))}`, figures: [asker], choices });
}
