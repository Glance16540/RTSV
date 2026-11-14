// How the game opens: the loading screen, the opening words, and the main menu over the living world.

import type { App } from './main';
import { PITCH, YAW } from './renderer';
import { primerHtml } from './primer';
import { sfx } from './sfx';

const $ = (id: string) => document.getElementById(id)!;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Let the browser draw what has changed before the next piece of heavy work begins. */
const paint = () => new Promise<void>((r) => {
  const t = setTimeout(r, 80); // a hidden tab draws nothing, and must not wait for ever
  requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(t); r(); }));
});
const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const TIPS = [
  'A housed couple raises new villagers on their own, for half the food.',
  'Children cannot work. A village is only as old as its youngest family.',
  'Houses near your Town Center harden its defenders.',
  'From the Bronze Age a Warlord inspires the soldiers around them.',
  'Raiders begin as a war band with no Town Center, and settle where they choose.',
  'Open water is crossed from a Harbour.',
  'With several rivals on the map, they fight each other too.',
  'A child of two gifted parents sometimes inherits both gifts.',
  'Any people can turn out pious or decadent. It is decided by how they are ruled.',
  'Villagers grow old. A village lasts only as long as its families keep raising children.',
];

/** The loading screen. It is in the page from the first moment, and is taken away when the world is ready. */
export const loader = {
  /** Move the bar on (0 to 1) and say what is being done. */
  async step(done: number, label: string): Promise<void> {
    this.bar(done);
    $('boot-label').textContent = label;
    await paint();
  },
  bar(done: number): void {
    $('boot-fill').style.transform = `scaleX(${Math.min(1, done)})`;
  },
  tip(): void {
    $('boot-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  },
  /** Wait for a key or a click. A browser plays no sound before one, so the opening waits for it. */
  gate(): Promise<void> {
    const boot = $('boot');
    boot.classList.add('wait');
    $('boot-label').textContent = 'Press any key';
    return new Promise((resolve) => {
      const go = (): void => {
        window.removeEventListener('keydown', go);
        window.removeEventListener('pointerdown', go);
        resolve();
      };
      window.addEventListener('keydown', go);
      window.addEventListener('pointerdown', go);
    });
  },
  hide(): void {
    const boot = $('boot');
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 900);
  },
};

const OPENING = [
  'Before the kingdoms, there was the hearth.',
  'A fire, a family, and the dark beyond it.',
  'From such small lights empires rise, and fall to ruin.',
];

/** The opening words, set down a line at a time on the page that covers the screen. Any key or click passes on. */
export async function playOpening(): Promise<void> {
  const box = $('intro'), text = box.querySelector('.i-text')!;
  box.classList.remove('hidden');
  let skipped = false;
  const skip = (): void => { skipped = true; };
  // The key that answered "Press any key" is still going down; it is not a wish to skip.
  await sleep(500);
  window.addEventListener('keydown', skip);
  window.addEventListener('pointerdown', skip);
  const wait = async (ms: number): Promise<void> => { for (let t = 0; t < ms && !skipped; t += 50) await sleep(50); };
  for (const line of OPENING) {
    if (skipped) break;
    const p = document.createElement('p');
    p.textContent = line;
    text.append(p);
    await wait(2700);
  }
  await wait(1500);
  window.removeEventListener('keydown', skip);
  window.removeEventListener('pointerdown', skip);
  box.classList.add('gone');
  await sleep(skipped ? 350 : 900);
  box.remove();
}

/** The main menu. While it is up the camera circles low over the player's town, and the game waits. */
export class Title {
  active = false;
  private root = $('title');
  private panel = $('t-panel');
  private open = '';
  private t = 0;
  private last = 0;
  private home: { x: number; y: number };
  /** Seconds into the swoop back to the game's own camera, or -1 while the menu is up. */
  private leaving = -1;
  private from = { yaw: 0, pitch: 0, dist: 0, x: 0, y: 0, fog: 0 };
  private art = false;

  constructor(private app: App, art: string | null) {
    this.home = { x: app.r.cx, y: app.r.cy };
    if (art) {
      // Painted title art, when there is some, takes the place of the view over the town.
      this.art = true;
      this.root.classList.add('art');
      this.root.querySelector<HTMLElement>('.t-art')!.style.backgroundImage = `url(${art})`;
    }
    // How to play is the same page the game shows behind its help button.
    const howto = this.panel.querySelector('[data-for="howto"]')!;
    howto.append(document.querySelector('#start .cols')!.cloneNode(true));
    // The campaign has a page of its own beneath it, the same one its screen opens.
    howto.insertAdjacentHTML('beforeend', '<h2 class="primer-h">The campaign</h2>' + primerHtml());

    const menu = $('t-menu');
    menu.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (!b) return;
      sfx.play('confirm');
      if (b.dataset.panel) this.show(this.open === b.dataset.panel ? '' : b.dataset.panel);
    });
    menu.addEventListener('pointerover', (e) => {
      const b = (e.target as HTMLElement).closest('button'), from = (e.relatedTarget as HTMLElement | null)?.closest?.('button');
      if (b && b !== from) sfx.play('hover');
    });
    this.panel.querySelector('.t-close')!.addEventListener('click', () => this.show(''));
    window.addEventListener('keydown', (e) => this.key(e));
  }

  /**
   * Put the menu up. `quick` skips the slow arrival, for a return to the menu within one visit.
   * With `covered` the leaf lies over the whole screen, for the opening words, until `uncover` draws it back.
   */
  enter(quick: boolean, panel = '', covered = false): void {
    this.root.classList.toggle('full', covered);
    this.active = true;
    this.app.menu = true;
    document.body.classList.add('at-title');
    this.root.classList.remove('hidden');
    this.root.classList.toggle('quick', quick || calm);
    // The settings live on the pause page; while the menu is up they are shown here.
    const settings = $('settings') as HTMLDetailsElement;
    settings.open = true;
    this.panel.querySelector('[data-for="settings"]')!.append(settings);
    if (panel) this.show(panel);
    if (!this.art) {
      this.app.r.cine = { yaw: YAW - 0.5, pitch: 0.4 };
      this.app.r.fogScale = 0.3;
    }
    this.last = performance.now();
    requestAnimationFrame((n) => this.frame(n));
  }

  /** Draw the leaf back to the left of the screen, showing the world behind it and the menu on it. */
  uncover(): void {
    this.root.classList.remove('full');
  }

  /** Open one of the panels beside the menu, or close them with ''. */
  show(name: string): void {
    this.open = name;
    this.panel.classList.toggle('hidden', !name);
    this.root.classList.toggle('paneled', !!name);
    for (const d of this.panel.querySelectorAll<HTMLElement>('[data-for]')) d.classList.toggle('hidden', d.dataset.for !== name);
    for (const b of this.root.querySelectorAll<HTMLElement>('#t-menu [data-panel]')) b.classList.toggle('on', b.dataset.panel === name);
    this.panel.querySelector('.t-scroll')!.scrollTop = 0;
  }

  /** Play begins: the menu fades and the camera comes round to where the game looks from. */
  leave(): void {
    if (!this.active) return;
    this.active = false;
    this.app.menu = false;
    document.body.classList.remove('at-title');
    this.root.classList.add('gone');
    setTimeout(() => this.root.classList.add('hidden'), 1300);
    const settings = $('settings') as HTMLDetailsElement;
    settings.open = false;
    document.querySelector('#start .levels')!.before(settings);
    const r = this.app.r;
    if (r.cine) {
      this.from = { yaw: r.cine.yaw, pitch: r.cine.pitch, dist: r.dist, x: r.cx, y: r.cy, fog: r.fogScale };
      this.leaving = 0;
    }
  }

  private key(e: KeyboardEvent): void {
    if (!this.active || e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = (e.target as HTMLElement).matches?.('select, input');
    if (e.key === 'Escape') { if (this.open) this.show(''); return; }
    if ((e.key === 'm' || e.key === 'M') && !typing) { this.app.hud.toggleMute(); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !typing) {
      const items = [...this.root.querySelectorAll<HTMLElement>('#t-menu button:not(.hidden)')];
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : i < 0 ? 0 : -1) + items.length) % items.length].focus();
      e.preventDefault();
    }
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const r = this.app.r;
    if (this.leaving >= 0) {
      // Ease from wherever the circling camera was to the game's own view of the town.
      this.leaving += dt / 1.6;
      const k = Math.min(1, this.leaving), e = k * k * (3 - 2 * k), f = this.from;
      const turn = Math.atan2(Math.sin(YAW - f.yaw), Math.cos(YAW - f.yaw)); // the short way round
      r.cine = { yaw: f.yaw + turn * e, pitch: f.pitch + (PITCH - f.pitch) * e };
      r.dist = f.dist + (30 - f.dist) * e;
      r.cx = f.x + (this.home.x - f.x) * e;
      r.cy = f.y + (this.home.y - f.y) * e;
      r.fogScale = f.fog + (1 - f.fog) * e;
      if (k >= 1) { r.cine = null; r.fogScale = 1; return; }
    } else if (!this.active) {
      return;
    } else {
      this.t += calm ? 0 : dt;
      if (r.cine) {
        const yaw = YAW - 0.5 + this.t * 0.014;
        r.cine.yaw = yaw;
        r.cine.pitch = 0.4 + Math.sin(this.t * 0.05) * 0.04;
        r.dist = 30 + Math.sin(this.t * 0.037) * 3;
        // The menu stands on the left, so the camera looks a little to the left of the town and the town sits right of it.
        const off = Math.min(7, window.innerWidth / 220);
        r.cx = this.home.x - Math.cos(yaw) * off;
        r.cy = this.home.y + Math.sin(yaw) * off;
      }
    }
    requestAnimationFrame((n) => this.frame(n));
  }
}
