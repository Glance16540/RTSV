import { AIController } from '../sim/ai';
import { CIVS, CIV_IDS, UNITS, AGES } from '../sim/data';
import { DT, Game, GameEvent, SAVE_VERSION } from '../sim/game';
import { artUrl, loadAssets } from './assets';
import { Campaign, CAMPAIGN_VERSION, battleConfig, continueAI, finishBattle, newCampaign } from '../sim/campaign';
import { Mission, MissionStatus, missionById, MISSIONS, runMission } from '../sim/scenario';
import { Hud } from './hud';
import { Overworld } from './overworld';
import { Input } from './input';
import { Renderer } from './renderer';
import { sfx } from './sfx';
import './style.css';

export class App {
  game: Game;
  r: Renderer;
  hud: Hud;
  input: Input;
  ai: AIController[] = [];
  pid = 0;
  sel: number[] = [];
  placing: string | null = null;
  attackMode = false;
  patrolMode = false;
  /** Calamity waiting for a target click. */
  casting: string | null = null;
  paused = true;
  speed = 1;
  private acc = 0;
  private last = 0;
  private idleI = 0;

  private saveT = 0;
  /** Identifies which Conquest battle a save belongs to. */
  saveTag = '';
  onGameOver: ((won: boolean) => void) | null = null;
  /** The scripted mission being played, if any, and how it stands. */
  mission: Mission | null = null;
  missionStatus: MissionStatus | null = null;

  constructor(game: Game) {
    this.game = game;
    this.mission = game.scenario ? missionById(game.scenario.id) ?? null : null;
    // A mission's enemy is scripted unless the mission says it has a mind of its own.
    for (const p of this.game.players) if (p.isAI && (!this.mission || this.mission.aiLevel !== null)) this.ai.push(new AIController(this.game, p.id));
    this.r = new Renderer(document.getElementById('game') as HTMLCanvasElement, this.game);
    this.hud = new Hud(this);
    this.input = new Input(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  select(ids: number[]): void {
    this.sel = ids;
    this.placing = null;
    this.attackMode = false;
    this.patrolMode = false;
    this.casting = null;
  }

  /** Where the last under-attack warning came from. */
  lastAlert: { x: number; y: number } | null = null;

  centerOnSelection(): void {
    const e = this.game.entities.get(this.sel[0]) ?? this.lastAlert; // nothing selected: go to the trouble
    if (e) { this.r.cx = e.x; this.r.cy = e.y; }
  }

  nextIdle(): void {
    const idle = this.game.units.filter((u) => u.owner === this.pid && u.type === 'villager' && !u.order && u.growT <= 0 && !u.inside);
    if (!idle.length) return;
    const u = idle[this.idleI++ % idle.length];
    this.select([u.id]);
    this.centerOnSelection();
  }

  private onScreen(x: number, y: number): boolean {
    const s = this.r.project(x, y);
    return s.x > 0 && s.y > 0 && s.x < window.innerWidth && s.y < window.innerHeight;
  }

  private sound(ev: GameEvent): void {
    const mine = 'player' in ev && ev.player === this.pid;
    if (ev.t === 'age' && mine) sfx.play('age');
    else if (ev.t === 'alert' && mine) sfx.play('alert');
    else if (ev.t === 'wonder') sfx.play(mine ? 'age' : 'alert');
    else if (ev.t === 'birth' && mine) sfx.play('birth');
    else if (ev.t === 'grown' && mine) sfx.play('grown');
    else if (ev.t === 'msg' && mine) sfx.play(/^(Not|Cannot|You can only|Queue|Requires)/.test(ev.text) ? 'error' : 'done');
    else if (ev.t === 'quake' && this.onScreen(ev.x, ev.y)) sfx.play('quake');
    else if (ev.t === 'plague' && this.onScreen(ev.x, ev.y)) sfx.play('plague');
    else if (ev.t === 'remove' && ev.unit && this.onScreen(ev.x, ev.y) && this.game.vis[Math.floor(ev.y) * this.game.size + Math.floor(ev.x)] === 2) sfx.play('death');
  }

  /** Store the game in this browser. Returns false if the browser refused (e.g. storage full). */
  save(announce = true): boolean {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        game: this.game.serialize(), ai: this.ai.map((a) => a.save()), cam: { x: this.r.cx, y: this.r.cy, d: this.r.dist }, tag: this.saveTag,
      }));
      if (announce) this.hud.toast('Game saved.');
      return true;
    } catch {
      if (announce) this.hud.toast('Could not save in this browser.', 'warn');
      return false;
    }
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  cycleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1;
  }

  private frame(t: number): void {
    const dt = Math.min(0.1, (t - this.last) / 1000 || 0);
    this.last = t;
    const game = this.game;
    if (!this.paused && game.winner < 0) {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= DT && steps++ < 12) {
        game.step();
        if (game.tick % 20 === 0) {
          for (const a of this.ai) a.update();
          if (this.mission) this.missionStatus = runMission(game, this.mission);
        }
        this.acc -= DT;
      }
      if (this.acc > DT) this.acc = 0;
      // Autosave every two minutes of play.
      if ((this.saveT += dt) > 120) { this.saveT = 0; this.save(false); }
    }
    for (const ev of game.events) {
      this.r.handle(ev);
      this.hud.handle(ev);
      this.sound(ev);
      if (ev.t === 'gameover') this.onGameOver?.(!game.hostile(ev.winner, this.pid));
    }
    // Weapon sounds for fights the player can see.
    for (const u of game.units) {
      if (u.attackAnim > 0.34 && u.order?.t === 'attack' && this.r.isVisible(u) && this.onScreen(u.x, u.y)) sfx.play(u.def.projectile ? 'shot' : 'hit');
    }
    game.events.length = 0;
    if (this.sel.some((id) => !game.entities.has(id))) this.sel = this.sel.filter((id) => game.entities.has(id));

    this.input.update(dt);
    this.r.frame(this.paused ? 1 : this.acc / DT, dt, this.sel);
    this.input.draw();
    this.hud.update(dt);
    requestAnimationFrame((n) => this.frame(n));
  }
}

// Changing mode (a new map, a mission, the campaign) restarts the page. The options for the next
// start are handed over in session storage so this also works where the address cannot carry a
// query string; a query string in the address is still honoured on a fresh visit.
const boot = (() => {
  try {
    const b = sessionStorage.getItem('rtsv-boot');
    sessionStorage.removeItem('rtsv-boot');
    return b;
  } catch {
    return null;
  }
})();
// With nothing in the address, a refresh returns to whatever was open (the campaign map, a mission).
const sticky = (() => { try { return sessionStorage.getItem('rtsv-mode'); } catch { return null; } })();
const params = new URLSearchParams(boot ?? (location.search || sticky || ''));
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e6) + 1;
/** skirmish: a single match. campaign: the Conquest map. battle: a Conquest battle fought in real time. */
const mode = params.has('battle') ? 'battle' : params.has('campaign') ? 'campaign' : missionById(params.get('mission') ?? '') ? 'mission' : 'skirmish';
const SAVE_KEY = mode === 'battle' ? 'rtsv-battle-save' : mode === 'mission' ? 'rtsv-mission-save' : 'rtsv-save';
const CAMPAIGN_KEY = 'rtsv-campaign';
const RESULT_KEY = 'rtsv-battle-result';
interface Saved { game: string; ai: object[]; cam: { x: number; y: number; d: number }; tag?: string }

function readSave(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as Saved | null;
    return s && JSON.parse(s.game).v === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

function readCampaign(): Campaign | null {
  try {
    const c = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null') as Campaign | null;
    return c && c.v === CAMPAIGN_VERSION ? c : null;
  } catch {
    return null;
  }
}
const writeCampaign = (c: Campaign) => { try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c)); } catch { /* storage unavailable */ } };
const go = (query: string) => {
  try {
    sessionStorage.setItem('rtsv-boot', query);
    sessionStorage.setItem('rtsv-mode', query);
    location.reload();
  } catch {
    location.href = location.pathname + query;
  }
};

loadAssets().then(() => {
  const el = (id: string) => document.getElementById(id)!;
  const startScreen = el('start');
  const rivals = [1, 2, 3].includes(Number(params.get('ai'))) ? Number(params.get('ai')) : 1;
  const size = [72, 96, 128].includes(Number(params.get('size'))) ? Number(params.get('size')) : 96;

  const campaign = mode === 'skirmish' ? null : readCampaign();
  const cfg = mode === 'battle' && campaign ? battleConfig(campaign) : null;
  if (mode === 'battle' && !cfg) { go('?campaign=1'); return; }
  const tag = cfg && campaign ? `${campaign.seed}:${campaign.turn}:${campaign.pending!.armyId}:${campaign.pending!.to}` : '';

  let saved = params.has('load') || mode === 'battle' ? readSave() : null;
  if (mode === 'battle' && saved && saved.tag !== tag) saved = null; // a save from some earlier battle
  let game: Game | null = null;
  if (saved) {
    try { game = Game.restore(saved.game); } catch { saved = null; }
  }
  // Your people are your choice; rivals take the others in turn.
  const myCiv = CIVS[params.get('civ') ?? ''] ? params.get('civ')! : CIV_IDS[0];
  const others = CIV_IDS.filter((c) => c !== myCiv);
  const civFor = (i: number) => (i === 0 ? myCiv : others[(i - 1 + seed) % others.length]);
  // Sides: every nation for itself, one rival fighting at your side, or all of them against you.
  const sides = rivals > 1 && ['ally', 'gang'].includes(params.get('teams') ?? '') ? params.get('teams')! : 'ffa';
  const team = (i: number) => (sides === 'ffa' ? i : i === 0 || (sides === 'ally' && i === 1) ? 0 : 1);
  const mission = mode === 'mission' ? missionById(params.get('mission')!)! : null;
  if (mission) {
    game = new Game(mission.seed, mission.setups, mission.size);
    mission.init(game);
  }
  // Skirmishes and campaign battles are fought over hills and mountains; `?flat=1` gives the old level ground.
  const relief = params.get('flat') !== '1';
  game ??= cfg ? new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, relief) : new Game(seed, [
    { name: 'You', color: 0x2f7bff, isAI: false },
    { name: 'Red Tribe', color: 0xe0452f, isAI: true },
    { name: 'Golden Horde', color: 0xe0b020, isAI: true },
    { name: 'Green Clan', color: 0x3aa648, isAI: true },
  ].slice(0, 1 + rivals).map((s, i) => ({ ...s, name: i === 0 ? 'You' : CIVS[civFor(i)].name, team: team(i), civ: civFor(i) })), size, false, params.get('land') === 'lake', relief);

  // The map is generated before the menu appears, so a different size means a fresh page.
  const sizeSel = el('map-size') as HTMLSelectElement;
  sizeSel.value = String(game.size);
  const landSel = el('map-land') as HTMLSelectElement;
  landSel.value = game.sea ? 'lake' : 'inland';
  const aiSel = el('rivals') as HTMLSelectElement;
  aiSel.value = String(game.players.filter((p) => p.isAI).length);
  const teamSel = el('teams') as HTMLSelectElement;
  teamSel.value = sides;
  teamSel.disabled = game.players.filter((p) => p.isAI).length < 2;
  const civSel = el('civ') as HTMLSelectElement;
  civSel.innerHTML = CIV_IDS.map((id) => `<option value="${id}">${CIVS[id].icon} ${CIVS[id].name}</option>`).join('');
  civSel.value = game.players[0].civ;
  const civ = CIVS[game.players[0].civ];
  el('civ-info').innerHTML = `<b>${civ.name}.</b> ${civ.desc} ${civ.bonuses.join('. ')}. Only they train the <b>${UNITS[civ.unique].name}</b> and, from the ${AGES[UNITS[civ.unique2].age].name}, the <b>${UNITS[civ.unique2].name}</b>.` +
    `<br><small>Rivals: ${game.players.filter((p) => p.isAI).map((p) => `${CIVS[p.civ].icon} ${p.name}`).join(', ')}</small>`;
  const regenerate = () => go(`?size=${sizeSel.value}&land=${landSel.value}&ai=${aiSel.value}&civ=${civSel.value}&teams=${Number(aiSel.value) > 1 ? teamSel.value : 'ffa'}`);
  civSel.addEventListener('change', regenerate);
  teamSel.addEventListener('change', regenerate);
  sizeSel.addEventListener('change', regenerate);
  landSel.addEventListener('change', regenerate);
  aiSel.addEventListener('change', regenerate);
  if (mode === 'skirmish' && readCampaign()) el('conquest-btn').textContent = 'Continue the campaign';
  el('conquest-btn').addEventListener('click', () => go(`?campaign=1&ai=${aiSel.value}&civ=${(el('civ') as HTMLSelectElement).value}`));

  const app = new App(game);
  app.saveTag = tag;
  if (saved) {
    app.ai.forEach((a, i) => a.load(saved!.ai[i] ?? {}));
    app.r.cx = saved.cam.x; app.r.cy = saved.cam.y; app.r.dist = saved.cam.d;
    startScreen.classList.add('started');
  } else if (mode === 'skirmish' && readSave()) {
    const cont = el('continue-btn');
    cont.classList.remove('hidden');
    cont.addEventListener('click', () => go('?load=1'));
  }
  el('save').addEventListener('pointerdown', () => app.save());
  (window as unknown as { app: App }).app = app;
  const title = artUrl('title');
  if (title) startScreen.style.backgroundImage = `linear-gradient(rgba(6,6,8,0.55), rgba(6,6,8,0.8)), url(${title})`;
  for (const btn of startScreen.querySelectorAll<HTMLButtonElement>('[data-level]')) {
    btn.addEventListener('click', () => {
      // The first click picks the difficulty; afterwards the same screen is just the help page.
      if (!startScreen.classList.contains('started')) for (const a of app.ai) a.setLevel(Number(btn.dataset.level));
      const first = !startScreen.classList.contains('started') || startScreen.classList.contains('battle');
      startScreen.classList.add('hidden', 'started');
      startScreen.classList.remove('battle');
      sfx.unlock();
      app.paused = false;
      // The rival's leader has a word as the match begins.
      const foe = app.game.players.find((p) => p.isAI && !p.neutral && app.game.hostile(p.id, app.pid) && !p.name.endsWith(' reserve'));
      if (first && app.game.time < 1) {
        app.hud.advisorSay('p_start');
        if (foe && (!app.mission || app.mission.aiLevel !== null)) setTimeout(() => app.hud.leaderSay(foe.id, 'battle'), 3500);
      }
    });
  }

  if (cfg) {
    // A Conquest battle: difficulty and armies come from the campaign, and the result goes back to it.
    if (!saved) for (const a of app.ai) a.setLevel(cfg.level);
    if (!saved) game.aging = false; // a battle is over long before anyone grows old
    startScreen.classList.add('started', 'battle');
    startScreen.querySelector('h1')!.textContent = cfg.title;
    startScreen.querySelector('.lead')!.textContent = cfg.field
      ? 'The armies have met in open country. There is nothing to build: destroy every enemy soldier. Whoever is left standing marches on.'
      : cfg.humanAttacks
        ? 'Your army has made camp. Destroy every enemy building to take this land.'
        : 'The enemy is at the gates. Destroy every enemy building to hold this land.';
    startScreen.querySelector<HTMLButtonElement>('.levels .resume')!.textContent = saved ? 'Resume the battle' : 'To battle';
    const finish = (won: boolean) => {
      // Who is still standing decides what is left of the army on the campaign map.
      const survivors: Record<string, number> = {};
      for (const u of app.game.units) if (u.owner === app.pid) survivors[u.type] = (survivors[u.type] ?? 0) + 1;
      try { localStorage.setItem(RESULT_KEY, JSON.stringify({ won, survivors })); localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
    };
    app.onGameOver = finish;
    el('again-btn').textContent = 'Return to the map';
    el('concede-btn').classList.remove('hidden');
    el('concede-btn').addEventListener('click', () => { finish(false); go('?campaign=1'); });
  }

  // ---- Options chosen before a match ----
  const agingBox = el('aging') as HTMLInputElement;
  if (mode === 'skirmish' && !saved) {
    game.aging = params.get('aging') !== '0';
    agingBox.checked = game.aging;
    agingBox.addEventListener('change', () => { app.game.aging = agingBox.checked; });
  }

  // ---- Settings kept between visits ----
  const prefs = { volume: 0.5, music: true, edge: true, scroll: 1, ...JSON.parse((() => { try { return localStorage.getItem('rtsv-prefs') ?? '{}'; } catch { return '{}'; } })()) };
  const applyPrefs = () => {
    sfx.setVolume(prefs.volume);
    sfx.music = prefs.music;
    app.input.edgeScroll = prefs.edge;
    app.input.scrollSpeed = prefs.scroll;
    try { localStorage.setItem('rtsv-prefs', JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  };
  const bind = (id: string, key: 'volume' | 'scroll' | 'music' | 'edge') => {
    const input = el(id) as HTMLInputElement;
    if (input.type === 'checkbox') input.checked = prefs[key] as boolean;
    else input.value = String(prefs[key]);
    input.addEventListener('input', () => { (prefs[key] as number | boolean) = input.type === 'checkbox' ? input.checked : Number(input.value); applyPrefs(); });
  };
  bind('pref-volume', 'volume'); bind('pref-music', 'music'); bind('pref-edge', 'edge'); bind('pref-scroll', 'scroll');
  applyPrefs();

  // ---- Missions ----
  el('missions').innerHTML = MISSIONS.map((m) => `<button data-mission="${m.id}"><b>${m.name}</b><small>${m.brief}</small></button>`).join('');
  el('missions').addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-mission]')?.dataset.mission;
    if (id) go(`?mission=${id}`);
  });
  el('missions-btn').addEventListener('click', () => el('missions').classList.toggle('hidden'));
  if (mission) {
    for (const a of app.ai) a.setLevel(mission.aiLevel ?? 1);
    app.missionStatus = mission.tick(game);
    startScreen.classList.add('started', 'battle');
    startScreen.querySelector('h1')!.textContent = mission.name;
    startScreen.querySelector('.lead')!.textContent = mission.brief;
    startScreen.querySelector<HTMLButtonElement>('.levels .resume')!.textContent = 'Begin';
    el('again-btn').textContent = 'Back to the menu';
  }

  if (mode === 'campaign') {
    let c = campaign;
    let result: string | null = null;
    try { result = localStorage.getItem(RESULT_KEY); localStorage.removeItem(RESULT_KEY); } catch { /* storage unavailable */ }
    if (c && c.pending && result) {
      const r = JSON.parse(result) as { won: boolean; survivors: Record<string, number> };
      finishBattle(c, r.won, r.survivors);
      if (c.phase === 'ai') continueAI(c);
    }
    c ??= newCampaign(seed, Math.max(2, rivals), 1, params.get('civ') ?? undefined);
    const state = c;
    startScreen.classList.add('hidden');
    new Overworld(state, {
      save: () => writeCampaign(state),
      fight: () => { writeCampaign(state); go('?battle=1'); },
      newCampaign: (r, l, civ) => { writeCampaign(newCampaign(Math.floor(Math.random() * 1e6) + 1, r, l, civ || undefined)); go('?campaign=1'); },
      exit: () => go(''),
    });
  }
});
document.getElementById('again-btn')!.addEventListener('click', () => go(mode === 'battle' ? '?campaign=1' : ''));
