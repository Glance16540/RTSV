// Mouse and keyboard: camera control, selection, orders and building placement.

import { BUILDINGS } from '../sim/data';
import { Entity, Unit } from '../sim/game';
import { SLOT_KEYS } from './hud';
import { ABILITIES } from '../sim/data';
import type { App } from './main';
import { sfx } from './sfx';

export class Input {
  private keys = new Set<string>();
  private mx = 0;
  private my = 0;
  private inside = false;
  private drag: { x0: number; y0: number; active: boolean } | null = null;
  private pan: { x: number; y: number } | null = null;
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastClick = { t: 0, id: 0 };
  private lastGroup = { t: 0, n: -1 };
  private groups: number[][] = [];

  constructor(private app: App) {
    const canvas = app.r.canvas;
    this.overlay = document.getElementById('overlay') as HTMLCanvasElement;
    this.ctx = this.overlay.getContext('2d')!;
    const fit = () => {
      this.overlay.width = window.innerWidth * devicePixelRatio;
      this.overlay.height = window.innerHeight * devicePixelRatio;
    };
    fit();
    window.addEventListener('resize', fit);

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => {
      this.mx = e.clientX;
      this.my = e.clientY;
      this.inside = true;
      if (this.pan) {
        const a = this.app.r.groundAt(this.pan.x, this.pan.y), b = this.app.r.groundAt(e.clientX, e.clientY);
        if (a && b) { this.app.r.cx += a.x - b.x; this.app.r.cy += a.y - b.y; this.app.r.clampCamera(); }
        this.pan = { x: e.clientX, y: e.clientY };
      }
      if (this.drag && Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0) > 6) this.drag.active = true;
    });
    window.addEventListener('pointerup', (e) => this.up(e));
    document.addEventListener('pointerleave', () => { this.inside = false; });
    window.addEventListener('blur', () => { this.inside = false; this.keys.clear(); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.app.r.dist *= e.deltaY > 0 ? 1.1 : 1 / 1.1;
      this.app.r.clampCamera();
    }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
  }

  // ---- Picking ----

  private pick(x: number, y: number): Entity | null {
    const { game, r } = this.app;
    const ppt = r.pixelsPerTile();
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const u of game.units) {
      if (!r.isVisible(u)) continue;
      const s = r.project(u.x, u.y, u.def.radius + 0.25);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < Math.max(12, ppt * (u.def.radius + 0.3)) && d < bestD) { bestD = d; best = u; }
    }
    if (best) return best;
    // Test the ray at roof height first so clicking the top of a building works.
    for (const h of [1, 0]) {
      const p = r.groundAt(x, y, h);
      if (!p) continue;
      for (const b of game.buildings) {
        const half = b.size / 2;
        if (r.isVisible(b) && Math.abs(p.x - b.x) <= half && Math.abs(p.y - b.y) <= half) return b;
      }
    }
    for (const h of [0.6, 0]) {
      const p = r.groundAt(x, y, h);
      if (!p) continue;
      for (const n of game.resources) {
        const half = n.size / 2 + 0.1;
        if (r.isVisible(n) && Math.abs(p.x - n.x) <= half && Math.abs(p.y - n.y) <= half) return n;
      }
    }
    return null;
  }

  private placeCell(type: string): { cx: number; cy: number } | null {
    const p = this.app.r.groundAt(this.mx, this.my);
    if (!p) return null;
    const s = BUILDINGS[type].size;
    return { cx: Math.round(p.x - s / 2), cy: Math.round(p.y - s / 2) };
  }

  // ---- Mouse ----

  private down(e: PointerEvent): void {
    const app = this.app;
    if (e.button === 1) { this.pan = { x: e.clientX, y: e.clientY }; e.preventDefault(); return; }
    if (e.button === 2) {
      if (app.placing || app.attackMode || app.casting) { app.select(app.sel); return; }
      const p = app.r.groundAt(e.clientX, e.clientY);
      if (p) this.commandAt(p.x, p.y, this.pick(e.clientX, e.clientY), e.shiftKey);
      return;
    }
    if (e.button !== 0) return;
    if (app.placing) {
      const c = this.placeCell(app.placing);
      if (c) {
        const built = app.game.cmdPlace(app.pid, app.placing, c.cx, c.cy, app.sel);
        if (built) sfx.play('place');
        if (built && !e.shiftKey) app.placing = null;
      }
      return;
    }
    if (app.casting) {
      const p = app.r.groundAt(e.clientX, e.clientY);
      if (p && app.game.cmdCast(app.pid, app.sel, app.casting, p.x, p.y)) {
        app.r.ping(p.x, p.y, 0xb48cff);
        sfx.play('order');
      }
      app.casting = null;
      return;
    }
    if (app.attackMode) {
      const p = app.r.groundAt(e.clientX, e.clientY);
      if (p) {
        sfx.play('order');
        app.game.cmdMove(app.pid, app.sel, p.x, p.y, true);
        app.r.ping(p.x, p.y, 0xff5a4a);
      }
      app.attackMode = false;
      return;
    }
    this.drag = { x0: e.clientX, y0: e.clientY, active: false };
  }

  private up(e: PointerEvent): void {
    if (e.button === 1) this.pan = null;
    if (e.button !== 0 || !this.drag) return;
    const app = this.app, game = app.game, d = this.drag;
    this.drag = null;
    const add = e.shiftKey ? app.sel.slice() : [];
    if (d.active) {
      const x0 = Math.min(d.x0, e.clientX), x1 = Math.max(d.x0, e.clientX);
      const y0 = Math.min(d.y0, e.clientY), y1 = Math.max(d.y0, e.clientY);
      const inBox = game.units.filter((u) => {
        if (u.owner !== app.pid) return false;
        const s = app.r.project(u.x, u.y, 0.4);
        return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
      });
      // Prefer soldiers when a box holds both soldiers and villagers.
      const army = inBox.filter((u) => u.type !== 'villager');
      const pickd = army.length ? army : inBox;
      if (pickd.length) { app.select([...new Set([...add, ...pickd.map((u) => u.id)])]); sfx.play('select'); }
      return;
    }
    const hit = this.pick(e.clientX, e.clientY);
    if (!hit) { if (!e.shiftKey) app.select([]); return; }
    const now = performance.now();
    if (hit.owner === app.pid && this.lastClick.id === hit.id && now - this.lastClick.t < 350) {
      // Double-click: select everything of this type on screen.
      const w = window.innerWidth, h = window.innerHeight;
      const list: Entity[] = hit.kind === 'unit' ? game.units : game.buildings;
      app.select(list.filter((o) => {
        if (o.owner !== app.pid || o.type !== hit.type) return false;
        const s = app.r.project(o.x, o.y);
        return s.x >= 0 && s.x <= w && s.y >= 0 && s.y <= h;
      }).map((o) => o.id));
    } else if (e.shiftKey && hit.owner === app.pid) {
      app.select(add.includes(hit.id) ? add.filter((id) => id !== hit.id) : [...add, hit.id]);
    } else app.select([hit.id]);
    if (hit.owner === app.pid) sfx.play('select');
    this.lastClick = { t: now, id: hit.id };
  }

  /** Right-click order at a world position (also used by the minimap). */
  commandAt(x: number, y: number, target: Entity | null, _shift: boolean): void {
    const { game, pid, sel, r } = this.app;
    const ents = sel.map((id) => game.entities.get(id)).filter((e): e is Entity => !!e && e.owner === pid);
    if (!ents.length) return;
    const units = ents.filter((e): e is Unit => e.kind === 'unit').map((u) => u.id);
    sfx.play('order');
    if (units.length) {
      if (target && !units.includes(target.id)) {
        game.cmdTarget(pid, units, target.id);
        r.ping(target.x, target.y, target.owner >= 0 && target.owner !== pid ? 0xff5a4a : 0xffe27a);
      } else {
        game.cmdMove(pid, units, x, y);
        r.ping(x, y, 0x8dff8a);
      }
    } else {
      for (const b of ents) if (b.kind === 'building') game.cmdRally(pid, b.id, x, y, target ? target.id : 0);
      r.ping(x, y, 0xffd34a);
    }
  }

  // ---- Keyboard ----

  private key(e: KeyboardEvent): void {
    const app = this.app;
    if (e.ctrlKey && !/^[0-9]$/.test(e.key)) return;
    if (e.metaKey || e.altKey) return;
    this.keys.add(e.key);
    const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (/^[0-9]$/.test(k)) {
      const n = Number(k);
      if (e.ctrlKey) { this.groups[n] = app.sel.slice(); app.hud.toast(`Group ${n} set.`); }
      else if (this.groups[n]?.length) {
        app.select(this.groups[n]);
        const now = performance.now();
        if (this.lastGroup.n === n && now - this.lastGroup.t < 400) app.centerOnSelection();
        this.lastGroup = { t: now, n };
      }
      e.preventDefault();
      return;
    }
    const slot = SLOT_KEYS.indexOf(k);
    if (slot >= 0 && !e.repeat) { app.hud.press(slot); return; }
    switch (k) {
      case 'Escape':
        if (app.placing || app.attackMode || app.casting) app.select(app.sel);
        else app.select([]);
        break;
      case 'Delete':
        app.game.cmdDelete(app.pid, app.sel);
        break;
      case 'H': {
        const tc = app.game.buildings.find((b) => b.owner === app.pid && b.type === 'towncenter');
        if (tc) { app.select([tc.id]); app.centerOnSelection(); }
        break;
      }
      case '.':
      case 'Tab':
        app.nextIdle();
        e.preventDefault();
        break;
      case ' ':
        app.centerOnSelection();
        e.preventDefault();
        break;
      case 'P':
        app.togglePause();
        break;
      case 'M':
        app.hud.toggleMute();
        break;
    }
  }

  // ---- Per frame ----

  update(dt: number): void {
    const app = this.app, r = app.r;
    let dx = 0, dy = 0;
    if (this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('ArrowUp')) dy += 1;
    if (this.keys.has('ArrowDown')) dy -= 1;
    if (this.inside && !this.pan && !this.drag?.active && document.hasFocus()) {
      const m = 4, w = window.innerWidth, h = window.innerHeight;
      if (this.mx <= m) dx -= 1;
      if (this.mx >= w - m) dx += 1;
      if (this.my <= m) dy += 1;
      if (this.my >= h - m) dy -= 1;
    }
    if (dx || dy) r.moveCamera(dx * r.dist * dt * 0.9, dy * r.dist * dt * 0.9);

    if (app.placing) {
      const c = this.placeCell(app.placing);
      if (c) r.setGhost(app.placing, c.cx, c.cy, app.game.canPlace(app.placing, c.cx, c.cy, true));
    } else r.setGhost(null);
    r.canvas.style.cursor = app.placing ? 'copy' : app.attackMode || app.casting ? 'crosshair' : 'default';
    const cast = app.casting ? r.groundAt(this.mx, this.my) : null;
    r.setAreaMarker(cast ? { x: cast.x, y: cast.y, r: ABILITIES[app.casting!].radius } : null);
  }

  /** 2D overlay: health bars, drag rectangle and floating icons. Call after the 3D frame. */
  draw(): void {
    const { game, r, sel, pid } = this.app;
    const ctx = this.ctx, dpr = devicePixelRatio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const ppt = r.pixelsPerTile();
    const selected = new Set(sel);
    const bar = (e: Entity, h: number, w: number) => {
      const s = r.project(e.x, e.y, h);
      const f = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(s.x - w / 2 - 1, s.y - 1, w + 2, 6);
      ctx.fillStyle = f > 0.6 ? '#57d657' : f > 0.3 ? '#e8c53a' : '#e2503c';
      ctx.fillRect(s.x - w / 2, s.y, w * f, 4);
    };
    for (const u of game.units) {
      if ((u.hp < u.maxHp || selected.has(u.id)) && r.isVisible(u)) bar(u, u.type === 'mammoth' ? 2.1 : 1.15, Math.max(22, ppt * u.def.radius * 2.2));
    }
    for (const b of game.buildings) {
      if ((b.hp < b.maxHp || selected.has(b.id)) && r.isVisible(b)) bar(b, b.type === 'farm' ? 0.6 : b.size * 0.5 + 1.2, ppt * b.size * 0.7);
    }
    // Hearts over houses where a family is raising a child.
    ctx.font = `${Math.max(11, ppt * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    for (const b of game.buildings) {
      if (b.owner !== pid || b.type !== 'house' || !b.residents.m || !b.residents.f || b.birthsPaused) continue;
      const s = r.project(b.x, b.y, 1.9);
      ctx.globalAlpha = 0.55 + 0.45 * b.birthProgress;
      ctx.fillText(b.birthBlocked ? '💤' : '💗', s.x, s.y);
    }
    for (const u of game.units) {
      if (u.plagueT <= 0 || !r.isVisible(u)) continue;
      const s = r.project(u.x, u.y, 1.5);
      ctx.globalAlpha = 0.9;
      ctx.fillText('☠️', s.x, s.y);
    }
    ctx.font = '22px sans-serif';
    for (const f of r.floaters) {
      const s = r.project(f.x, f.y, 1 + f.t * 0.8);
      ctx.globalAlpha = Math.min(1, 2 - f.t);
      ctx.fillText(f.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    if (this.drag?.active) {
      ctx.strokeStyle = '#9dff9a';
      ctx.fillStyle = 'rgba(120,255,120,0.12)';
      ctx.lineWidth = 1;
      const w = this.mx - this.drag.x0, h = this.my - this.drag.y0;
      ctx.fillRect(this.drag.x0, this.drag.y0, w, h);
      ctx.strokeRect(this.drag.x0 + 0.5, this.drag.y0 + 0.5, w, h);
    }
  }
}
