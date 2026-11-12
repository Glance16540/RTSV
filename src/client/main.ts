import { AIController } from '../sim/ai';
import { DT, Game, GameEvent, SAVE_VERSION } from '../sim/game';
import { artUrl, loadAssets } from './assets';
import { Hud } from './hud';
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
  /** Calamity waiting for a target click. */
  casting: string | null = null;
  paused = true;
  speed = 1;
  private acc = 0;
  private last = 0;
  private idleI = 0;

  private saveT = 0;

  constructor(game: Game) {
    this.game = game;
    for (const p of this.game.players) if (p.isAI) this.ai.push(new AIController(this.game, p.id));
    this.r = new Renderer(document.getElementById('game') as HTMLCanvasElement, this.game);
    this.hud = new Hud(this);
    this.input = new Input(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  select(ids: number[]): void {
    this.sel = ids;
    this.placing = null;
    this.attackMode = false;
    this.casting = null;
  }

  centerOnSelection(): void {
    const e = this.game.entities.get(this.sel[0]);
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
        game: this.game.serialize(), ai: this.ai.map((a) => a.save()), cam: { x: this.r.cx, y: this.r.cy, d: this.r.dist },
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
        if (game.tick % 20 === 0) for (const a of this.ai) a.update();
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

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e6) + 1;
const SAVE_KEY = 'rtsv-save';
interface Saved { game: string; ai: object[]; cam: { x: number; y: number; d: number } }

function readSave(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as Saved | null;
    return s && JSON.parse(s.game).v === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}

loadAssets().then(() => {
  let saved = params.has('load') ? readSave() : null;
  let game: Game | null = null;
  if (saved) {
    try { game = Game.restore(saved.game); } catch { saved = null; }
  }
  const rivals = [1, 2, 3].includes(Number(params.get('ai'))) ? Number(params.get('ai')) : 1;
  const size = [72, 96, 128].includes(Number(params.get('size'))) ? Number(params.get('size')) : 96;
  game ??= new Game(seed, [
    { name: 'You', color: 0x2f7bff, isAI: false },
    { name: 'Red Tribe', color: 0xe0452f, isAI: true },
    { name: 'Golden Horde', color: 0xe0b020, isAI: true },
    { name: 'Green Clan', color: 0x3aa648, isAI: true },
  ].slice(0, 1 + rivals), size);
  // The map is generated before the menu appears, so a different size means a fresh page.
  const sizeSel = document.getElementById('map-size') as HTMLSelectElement;
  sizeSel.value = String(game.size);
  const aiSel = document.getElementById('rivals') as HTMLSelectElement;
  aiSel.value = String(game.players.filter((p) => p.isAI).length);
  const regenerate = () => { location.search = `?size=${sizeSel.value}&ai=${aiSel.value}`; };
  sizeSel.addEventListener('change', regenerate);
  aiSel.addEventListener('change', regenerate);
  const app = new App(game);
  if (saved) {
    app.ai.forEach((a, i) => a.load(saved!.ai[i] ?? {}));
    app.r.cx = saved.cam.x; app.r.cy = saved.cam.y; app.r.dist = saved.cam.d;
    document.getElementById('start')!.classList.add('started');
  } else if (readSave()) {
    const cont = document.getElementById('continue-btn')!;
    cont.classList.remove('hidden');
    cont.addEventListener('click', () => { location.search = '?load=1'; });
  }
  document.getElementById('save')!.addEventListener('pointerdown', () => app.save());
  (window as unknown as { app: App }).app = app;
  const title = artUrl('title');
  if (title) document.getElementById('start')!.style.backgroundImage = `linear-gradient(rgba(6,6,8,0.55), rgba(6,6,8,0.8)), url(${title})`;
  const startScreen = document.getElementById('start')!;
  for (const btn of startScreen.querySelectorAll<HTMLButtonElement>('[data-level]')) {
    btn.addEventListener('click', () => {
      // The first click picks the difficulty; afterwards the same screen is just the help page.
      if (!startScreen.classList.contains('started')) for (const a of app.ai) a.setLevel(Number(btn.dataset.level));
      startScreen.classList.add('hidden', 'started');
      sfx.unlock();
      app.paused = false;
    });
  }
});
document.getElementById('again-btn')!.addEventListener('click', () => { location.href = location.pathname; });
