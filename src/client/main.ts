import { AIController } from '../sim/ai';
import { DT, Game } from '../sim/game';
import { Hud } from './hud';
import { Input } from './input';
import { Renderer } from './renderer';
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
  }

  centerOnSelection(): void {
    const e = this.game.entities.get(this.sel[0]);
    if (e) { this.r.cx = e.x; this.r.cy = e.y; }
  }

  nextIdle(): void {
    const idle = this.game.units.filter((u) => u.owner === this.pid && u.type === 'villager' && !u.order);
    if (!idle.length) return;
    const u = idle[this.idleI++ % idle.length];
    this.select([u.id]);
    this.centerOnSelection();
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
const app = new App(seed);
(window as unknown as { app: App }).app = app;

document.getElementById('start-btn')!.addEventListener('click', () => {
  document.getElementById('start')!.classList.add('hidden');
  document.getElementById('start-btn')!.textContent = 'Resume';
  app.paused = false;
});
document.getElementById('again-btn')!.addEventListener('click', () => location.reload());
