// The hero creator: make a nation's leader your own. Their name, whether they are a man or a woman, their calling,
// where their points go, what veterancy does for them, and how they look. What is made here is kept on this device,
// one leader per nation, and taken into every skirmish and campaign played as that nation.

import * as THREE from 'three';
import { CIVS, CIV_COLOR, UNITS } from '../sim/data';
import { HeroSpec, HERO_POINTS, MAX_RANK, RANK_NAMES, HOLY_GUARD, TYRANT_BIRTH, cleanHero, defaultHero, heroBonus } from '../sim/hero';
import { POWERS, POWER_RANKS } from '../sim/powers';
import { lookOf } from './models';
import { RealPerson, leaderOutfit, loadPeople, makePerson, outfitFor, play } from './person';

const KEY = 'rtsv-heroes';
const readAll = (): Record<string, Partial<HeroSpec>> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { return {}; } };

/** The leader someone has made for a nation, if they have made one. */
export function savedHero(civ: string): HeroSpec | undefined {
  const h = readAll()[civ];
  return h ? cleanHero(h, civ) : undefined;
}
/** Set down what a skirmish made of a people's leader: the veterancy they came away with, and their name if an heir now bears it. */
export function keepHero(civ: string, h: HeroSpec): void { keep(civ, cleanHero(h, civ)); }
function keep(civ: string, h: HeroSpec | null): void {
  const all = readAll();
  if (h) all[civ] = h; else delete all[civ];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
}

const HAIR = [0x1c1814, 0x4a3220, 0x7a5a34, 0xb08a4a, 0xd8c8a0, 0x8a3a20, 0x8a8680, 0xe6e2da];
const CLOAK = [0x8a2028, 0x2f4f8a, 0x2f6a44, 0x5a2f7a, 0xb8862a, 0x2a2a30, 0xe2dccc, 0x6a4a2a];
const HELMETS: [string, string][] = [['', 'As their calling wears'], ['none', 'Bare-headed'], ['circlet', 'A circlet'], ['leather', 'Leather cap'], ['bronze', 'Bronze helm'], ['iron', 'Iron helm'], ['kettle', 'Kettle hat']];
const css = (n: number): string => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * Open the creator for a nation's leader. `done` is told what was saved (or `null` if they were put back as written);
 * closing without saving tells it nothing.
 */
export function openHeroCreator(civ: string, done: (h: HeroSpec | null) => void): void {
  const nation = CIVS[civ];
  let h: HeroSpec = savedHero(civ) ?? defaultHero(civ);
  h.look ??= {};
  const root = document.createElement('div');
  root.className = 'screen hero-maker';
  root.innerHTML = `<div class="sheet">
    <h1>Your leader</h1>
    <p class="lead">The ${esc(nation.name)} follow one person. Make them yours: they take the field in every battle you fight as this people.</p>
    <div class="hm-cols">
      <div class="hm-view"><canvas id="hm-canvas" width="300" height="420"></canvas><div id="hm-stats"></div></div>
      <div class="hm-form">
        <label class="hm-row">Name <input id="hm-name" type="text" maxlength="40" autocomplete="off" /></label>
        <div class="hm-row"><span>They are</span><div class="hm-pick" id="hm-sex"><button type="button" data-v="m">A man</button><button type="button" data-v="f">A woman</button></div></div>
        <div class="hm-row"><span>Calling</span><div class="hm-pick" id="hm-calling"><button type="button" data-v="warlord">Warlord</button><button type="button" data-v="strategist">Strategist</button></div></div>
        <p class="hm-note" id="hm-calling-note"></p>
        <h3>Their making <small id="hm-left"></small></h3>
        <div class="hm-points" id="hm-points"></div>
        <h3>What battles teach them</h3>
        <div class="hm-pick" id="hm-bent"><button type="button" data-v="strength">Strength</button><button type="button" data-v="both">Both by turns</button><button type="button" data-v="armour">Armour</button></div>
        <p class="hm-note">Enemies felled where they stand are their deeds. Deeds raise them through five ranks, from Blooded to Legend, and each rank hardens them the way you choose here. The rank they earn in a skirmish stays with them for the next. They are flesh all the same: every blow tells, and one who falls comes back a rank the less.</p>
        <h3>What they learn <small id="hm-rank"></small></h3>
        <div id="hm-powers"></div>
        <h3>How they look</h3>
        <div class="hm-row"><span>Hair</span><div class="hm-swatches" id="hm-hair"></div></div>
        <div class="hm-row"><span>Cloak</span><div class="hm-swatches" id="hm-cloak"></div></div>
        <label class="hm-row">Head <select id="hm-helmet">${HELMETS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>
        <div class="hm-row"><span>Build</span><div class="hm-pick" id="hm-build"><button type="button" data-v="0">Slight</button><button type="button" data-v="1">Average</button><button type="button" data-v="2">Heavy</button></div></div>
        <label class="hm-row hm-check" id="hm-beard-row"><input id="hm-beard" type="checkbox" /> Bearded</label>
        <h3>What their town makes of them</h3>
        <p class="hm-note"><b>In a holy town</b> everyone of yours near them takes blows as if wearing ${HOLY_GUARD[0]} more armour (${HOLY_GUARD[1]} if the town is Righteous).<br><b>In a decadent town</b> they bind enemy villagers themselves and lead them to a Work Camp, and while they are in the field the camp's women fill the town ${TYRANT_BIRTH} times as fast.</p>
      </div>
    </div>
    <div class="levels"><button type="button" id="hm-save">Save</button><button type="button" class="secondary" id="hm-reset">As written</button><button type="button" class="secondary" id="hm-cancel">Cancel</button></div>
  </div>`;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;

  // ---- the figure, turning slowly ----
  const canvas = $<HTMLCanvasElement>('hm-canvas');
  let gl: THREE.WebGLRenderer | null = null;
  try { gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { canvas.classList.add('hidden'); }
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 300 / 420, 0.1, 50);
  cam.position.set(0, 0.62, 2.3); cam.lookAt(0, 0.44, 0);
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x5a4a58, 1.1));
  const sun = new THREE.DirectionalLight(0xffe8c8, 2.2); sun.position.set(2, 4, 3); scene.add(sun);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.47, 0.06, 32), new THREE.MeshStandardMaterial({ color: 0x8a6f48, roughness: 0.95 }));
  stand.position.y = -0.03; scene.add(stand);
  if (gl) { gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); gl.setSize(300, 420, false); gl.toneMapping = THREE.NeutralToneMapping; }
  let figure: { g: THREE.Group; real: RealPerson } | null = null, turn = 0.5, alive = true, last = performance.now();
  const dress = () => {
    if (figure) { turn = figure.g.rotation.y; scene.remove(figure.g); }
    const type = h.calling;
    const base = outfitFor(type, h.female, CIV_COLOR[civ], lookOf(civ, 7), 7, 0, { cls: 'hero', age: UNITS[type].age });
    figure = makePerson(leaderOutfit(base, h.female, h.look));
    if (!figure) return;
    figure.g.rotation.y = turn;
    scene.add(figure.g);
    play(figure.real, 'Idle_Loop', 1);
  };
  const frame = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (figure) { figure.g.rotation.y += dt * 0.5; figure.real.mixer.update(dt); }
    gl?.render(scene, cam);
    requestAnimationFrame(frame);
  };
  loadPeople(() => { if (alive) dress(); });
  requestAnimationFrame(frame);

  // ---- the form ----
  const STATS: [keyof Pick<HeroSpec, 'might' | 'guard' | 'vigour'>, string, string][] = [['might', 'Might', 'a harder blow'], ['guard', 'Guard', 'more armour'], ['vigour', 'Vigour', 'more health']];
  const left = () => HERO_POINTS - h.might - h.guard - h.vigour;
  const pick = (id: string, value: string) => { for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === value)); };
  const swatches = (id: string, list: number[], value: number | undefined) => {
    $(id).innerHTML = `<button type="button" data-v="" aria-pressed="${value == null}" title="As their people and calling have it">auto</button>` +
      list.map((c) => `<button type="button" data-v="${c}" aria-pressed="${value === c}" style="background:${css(c)}" title="${css(c)}"></button>`).join('');
  };
  const paint = () => {
    pick('hm-sex', h.female ? 'f' : 'm'); pick('hm-calling', h.calling); pick('hm-bent', h.bent); pick('hm-build', String(h.look!.build ?? ''));
    $('hm-rank').textContent = h.rank ? `${RANK_NAMES[h.rank]} already, from battles fought` : 'one power at each of three ranks';
    $('hm-powers').innerHTML = POWERS[h.calling].map((pair, t) => `<div class="hm-power"><span>${RANK_NAMES[POWER_RANKS[t]]}</span><div class="hm-pick">${pair.map((p, k) => `<button type="button" data-t="${t}" data-k="${k}" aria-pressed="${(h.powers?.[t] ?? 0) === k}">${p.name}</button>`).join('')}</div><small>${pair[h.powers?.[t] === 1 ? 1 : 0].desc}</small></div>`).join('');
    $('hm-calling-note').textContent = h.calling === 'warlord'
      ? 'Fights at the front with sword and shield. Everyone of yours fighting near them strikes a quarter harder. Raised at the Town Center from the Bronze Age.'
      : 'Stands behind the line with a staff. Enemies fighting near them strike a fifth weaker, and your wounded nearby are slowly mended. Raised at the Town Center from the Iron Age.';
    $('hm-left').textContent = left() ? `${left()} of ${HERO_POINTS} points still to spend` : `all ${HERO_POINTS} points spent`;
    $('hm-points').innerHTML = STATS.map(([k, name, what]) => `<div class="hm-stat"><b>${name}</b><small>${what}</small><button type="button" data-k="${k}" data-d="-1" ${h[k] <= 0 ? 'disabled' : ''} aria-label="Less ${name}">−</button><span class="hm-pips">${'●'.repeat(h[k])}${'○'.repeat(HERO_POINTS - h[k])}</span><button type="button" data-k="${k}" data-d="1" ${left() <= 0 ? 'disabled' : ''} aria-label="More ${name}">+</button></div>`).join('');
    swatches('hm-hair', HAIR, h.look!.hair); swatches('hm-cloak', CLOAK, h.look!.cloak);
    $('hm-beard-row').classList.toggle('hidden', h.female);
    $<HTMLInputElement>('hm-beard').checked = h.look!.beard ?? h.calling === 'warlord';
    $<HTMLSelectElement>('hm-helmet').value = h.look!.helmet ?? '';
    const d = UNITS[h.calling];
    const row = (rank: number) => { const b = heroBonus(h, rank); return `<tr><td>${RANK_NAMES[rank]}</td><td>${Math.round((d.atk + b.atk) * 10) / 10}</td><td>${Math.round((d.armor + b.armor) * 10) / 10}</td><td>${Math.round(d.hp * b.hp)}</td></tr>`; };
    $('hm-stats').innerHTML = `<table><tr><th></th><th>Attack</th><th>Armour</th><th>Health</th></tr>${row(0)}${row(Math.ceil(MAX_RANK / 2))}${row(MAX_RANK)}</table>`;
  };
  const change = (redress = true) => { paint(); if (redress) dress(); };
  const nameBox = $<HTMLInputElement>('hm-name');
  nameBox.value = h.name;
  nameBox.addEventListener('input', () => { h.name = nameBox.value; });
  const onPick = (id: string, set: (v: string) => void) => $(id).addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-v]');
    if (b) { set(b.dataset.v!); change(); }
  });
  onPick('hm-sex', (v) => { h.female = v === 'f'; });
  onPick('hm-calling', (v) => { h.calling = v === 'strategist' ? 'strategist' : 'warlord'; });
  onPick('hm-bent', (v) => { h.bent = v as HeroSpec['bent']; });
  $('hm-powers').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-t]');
    if (!b) return;
    const powers = [0, 1, 2].map((t) => h.powers?.[t] ?? 0);
    powers[Number(b.dataset.t)] = Number(b.dataset.k);
    h.powers = powers;
    change(false);
  });
  onPick('hm-build', (v) => { h.look!.build = Number(v); });
  onPick('hm-hair', (v) => { if (v) h.look!.hair = Number(v); else delete h.look!.hair; });
  onPick('hm-cloak', (v) => { if (v) h.look!.cloak = Number(v); else delete h.look!.cloak; });
  $('hm-points').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-k]');
    if (!b || b.disabled) return;
    const k = b.dataset.k as 'might' | 'guard' | 'vigour', d = Number(b.dataset.d);
    if (d > 0 && left() <= 0) return;
    h[k] = Math.max(0, h[k] + d);
    change(false);
  });
  $('hm-helmet').addEventListener('change', () => { const v = $<HTMLSelectElement>('hm-helmet').value; if (v) h.look!.helmet = v; else delete h.look!.helmet; change(); });
  $('hm-beard').addEventListener('change', () => { h.look!.beard = $<HTMLInputElement>('hm-beard').checked; change(); });
  const close = () => { alive = false; gl?.dispose(); root.remove(); };
  $('hm-cancel').addEventListener('click', close);
  $('hm-reset').addEventListener('click', () => { keep(civ, null); close(); done(null); });
  $('hm-save').addEventListener('click', () => {
    const made = cleanHero(h, civ);
    keep(civ, made);
    close();
    done(made);
  });
  paint();
}
