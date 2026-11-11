import { AIController } from '../sim/ai';
import { DT, Game, GameEvent } from '../sim/game';
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

  constructor(seed: number) {
    this.game = new Game(seed, [
      { name: 'You', color: 0x2f7bff, isAI: false },
      { name: 'Red Tribe', color: 0xe0452f, isAI: true },
    ]);
    this.ai.push(new AIController(this.game, 1));
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
loadAssets().then(() => {
  const app = new App(seed);
  (window as unknown as { app: App }).app = app;
  const title = artUrl('title');
  if (title) document.getElementById('start')!.style.backgroundImage = `linear-gradient(rgba(6,6,8,0.55), rgba(6,6,8,0.8)), url(${title})`;
  const startScreen = document.getElementById('start')!;
  for (const btn of startScreen.querySelectorAll<HTMLButtonElement>('[data-level]')) {
    btn.addEventListener('click', () => {
      // The first click picks the difficulty; afterwards the same screen is just the help page.
      if (!startScreen.classList.contains('started')) app.ai[0].setLevel(Number(btn.dataset.level));
      startScreen.classList.add('hidden', 'started');
      sfx.unlock();
      app.paused = false;
    });
  }
});
document.getElementById('again-btn')!.addEventListener('click', () => location.reload());
