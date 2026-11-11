// DOM heads-up display: resources, selection info, command card, minimap and messages.

import {
  ABILITIES, AGES, BIRTH_COST, BUILD_MENU, BUILDINGS, Cost, MORALE_MAX_HOUSES, MORALE_PER_HOUSE, RES_ICON, RES_TYPES, ResType,
  TECHS, UNITS, costText,
} from '../sim/data';
import { Building, Entity, GameEvent, Unit } from '../sim/game';
import { T_DIRT, T_WATER } from '../sim/map';
import { ico } from './assets';
import type { App } from './main';
import { sfx } from './sfx';

export const SLOT_KEYS = 'QWERTASDFGZXCVB';

interface Btn {
  id: string;
  icon: string;
  name: string;
  desc: string;
  cost?: Cost;
  locked?: string; // reason the button cannot be used
  active?: boolean;
  act: () => void;
}

const $ = (id: string) => document.getElementById(id)!;
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const GENDER = { m: '♂', f: '♀' };
const NODE_NAME: Record<string, string> = { tree: 'Tree', berries: 'Berry Bush', gold: 'Gold Mine', stone: 'Stone Quarry' };
const RI = (r: ResType) => ico(r, RES_ICON[r]);
const MAN = () => ico('villager_m', '👨‍🌾');
const WOMAN = () => ico('villager_f', '👩‍🌾');
const NODE_ICON: Record<string, string> = { tree: '🌲', berries: '🫐', gold: '🪙', stone: '🪨' };

export class Hud {
  private btns: Btn[] = [];
  private cardSig = '';
  private infoSig = '';
  private topSig = '';
  private mini = $('minimap') as HTMLCanvasElement;
  private miniCtx = this.mini.getContext('2d')!;
  private miniBuf: HTMLCanvasElement;
  private miniImg: ImageData;
  private miniT = 0;
  private alerts: { x: number; y: number; t: number }[] = [];
  private hoverBtn = -1;

  constructor(private app: App) {
    const N = app.game.size;
    this.miniBuf = document.createElement('canvas');
    this.miniBuf.width = this.miniBuf.height = N;
    this.miniImg = new ImageData(N, N);

    const card = $('card');
    card.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      if (el) this.press(Number(el.dataset.i));
      e.preventDefault();
    });
    card.addEventListener('pointermove', (e) => {
      const el = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      this.hoverBtn = el ? Number(el.dataset.i) : -1;
      this.showTip();
    });
    card.addEventListener('pointerleave', () => { this.hoverBtn = -1; this.showTip(); });

    $('info').addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      const q = t.closest('[data-q]') as HTMLElement | null;
      const b = this.app.game.entities.get(this.app.sel[0]);
      if (q && b) this.app.game.cmdCancel(this.app.pid, b.id, Number(q.dataset.q));
      const pick = t.closest('[data-type]') as HTMLElement | null;
      if (pick) this.app.select(this.app.sel.filter((id) => this.app.game.entities.get(id)?.type === pick.dataset.type));
    });

    $('idle').addEventListener('pointerdown', () => this.app.nextIdle());
    $('pause').addEventListener('pointerdown', () => this.app.togglePause());
    $('speed').addEventListener('pointerdown', () => this.app.cycleSpeed());
    $('help').addEventListener('pointerdown', () => $('start').classList.toggle('hidden'));
    $('mute').addEventListener('pointerdown', () => this.toggleMute());

    const mm = (e: PointerEvent) => {
      const w = this.mini.clientWidth;
      return { x: (e.offsetX / w) * N, y: (e.offsetY / w) * N };
    };
    let dragging = false;
    this.mini.addEventListener('pointerdown', (e) => {
      const p = mm(e);
      if (e.button === 2) this.app.input.commandAt(p.x, p.y, null, e.shiftKey);
      else { dragging = true; this.mini.setPointerCapture(e.pointerId); this.app.r.cx = p.x; this.app.r.cy = p.y; this.app.r.clampCamera(); }
      e.preventDefault();
    });
    this.mini.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = mm(e);
      this.app.r.cx = p.x; this.app.r.cy = p.y; this.app.r.clampCamera();
    });
    this.mini.addEventListener('pointerup', () => { dragging = false; });
    this.mini.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toggleMute(): void {
    sfx.muted = !sfx.muted;
    $('mute').textContent = sfx.muted ? '🔇' : '🔊';
  }

  toast(text: string, cls = ''): void {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 5) box.firstChild!.remove();
    setTimeout(() => el.classList.add('fade'), 3500);
    setTimeout(() => el.remove(), 4300);
  }

  handle(ev: GameEvent): void {
    const { game, pid } = this.app;
    if (ev.t === 'msg' && ev.player === pid) this.toast(ev.text);
    else if (ev.t === 'age') {
      if (ev.player === pid) this.toast(`You have advanced to the ${AGES[game.players[pid].age].name}!`, 'big');
      else this.toast(`${game.players[ev.player].name} has advanced to the ${AGES[game.players[ev.player].age].name}.`);
    } else if (ev.t === 'alert' && ev.player === pid) {
      this.toast('⚠️ You are under attack!', 'warn');
      this.alerts.push({ x: ev.x, y: ev.y, t: 0 });
    } else if (ev.t === 'birth' && ev.player === pid) this.toast('👶 A child is born.');
    else if (ev.t === 'gameover') {
      const win = ev.winner === pid;
      $('end-title').textContent = win ? 'Victory' : 'Defeat';
      $('end-text').textContent = win ? 'Your enemy lies in ruins. Your people will tell this story for ages.' : 'Your settlement has fallen.';
      $('end').classList.remove('hidden');
    }
  }

  press(i: number): void {
    const b = this.btns[i];
    if (!b) return;
    if (b.locked) { this.toast(b.locked); return; }
    b.act();
    this.cardSig = '';
  }

  // ---- Command card ----

  private buildButtons(): Btn[] {
    const { game, pid, sel } = this.app;
    const p = game.players[pid];
    const ents = sel.map((id) => game.entities.get(id)).filter((e): e is Entity => !!e && e.owner === pid);
    if (!ents.length) return [];
    const out: Btn[] = [];
    const first = ents[0];

    if (first.kind === 'unit') {
      const units = ents.filter((e): e is Unit => e.kind === 'unit');
      const ids = units.map((u) => u.id);
      if (units.every((u) => u.type === 'villager')) {
        for (const type of BUILD_MENU) {
          const d = BUILDINGS[type];
          out.push({
            id: 'b:' + type, icon: ico(type, d.icon), name: 'Build ' + d.name, desc: d.desc, cost: d.cost,
            locked: d.age > p.age ? `Requires the ${AGES[d.age].name}.` : undefined,
            active: this.app.placing === type,
            act: () => { this.app.select(this.app.sel); this.app.placing = type; },
          });
        }
      } else {
        out.push({
          id: 'atk', icon: ico('attackmove', '⚔️'), name: 'Attack-move', desc: 'Click a location: units march there and fight anything they meet on the way.',
          active: this.app.attackMode, act: () => { this.app.select(this.app.sel); this.app.attackMode = true; },
        });
        const prophets = units.filter((u) => u.def.mana);
        if (prophets.length) {
          const faith = Math.max(...prophets.map((u) => u.mana));
          for (const a of Object.values(ABILITIES)) {
            out.push({
              id: 'c:' + a.id, icon: ico(a.id, a.icon), name: a.name, desc: `${a.desc}<br><span class="stat">Costs ${a.cost} faith.</span>`,
              locked: faith < a.cost ? `Not enough faith (${Math.floor(faith)}/${a.cost}).` : undefined,
              active: this.app.casting === a.id, act: () => { this.app.select(this.app.sel); this.app.casting = a.id; },
            });
          }
        }
      }
      while (out.length < 14) out.push({ id: '', icon: '', name: '', desc: '', act: () => {} });
      out.push({ id: 'stop', icon: ico('stop', '✋'), name: 'Stop', desc: 'Halt and forget current orders.', act: () => game.cmdStop(pid, ids) });
      return out;
    }

    if (first.kind !== 'building') return [];
    const b = first;
    if (!b.complete) return [];
    const same = ents.filter((e): e is Building => e.kind === 'building' && e.type === b.type && e.complete);
    /** Send the order to the selected building with the shortest queue. */
    const least = () => same.slice().sort((x, y) => x.queue.length - y.queue.length)[0];

    for (const type of b.def.trains) {
      const d = UNITS[type];
      const locked = d.age > p.age ? `Requires the ${AGES[d.age].name}.` : undefined;
      if (type === 'villager') {
        out.push({ id: 't:vm', icon: MAN(), name: 'Train Villager (man)', desc: d.desc, cost: d.cost, locked, act: () => game.cmdTrain(pid, least().id, type, 'm') });
        out.push({ id: 't:vf', icon: WOMAN(), name: 'Train Villager (woman)', desc: d.desc, cost: d.cost, locked, act: () => game.cmdTrain(pid, least().id, type, 'f') });
      } else {
        out.push({
          id: 't:' + type, icon: ico(type, d.icon), name: 'Train ' + d.name, cost: d.cost, locked,
          desc: `${d.desc}<br><span class="stat">❤ ${d.hp} · ⚔ ${d.atk} · 🛡 ${d.armor}${d.range > 1 ? ` · range ${d.range}` : ''} · pop ${d.pop}</span>`,
          act: () => game.cmdTrain(pid, least().id, type),
        });
      }
    }
    for (const id of b.def.techs) {
      const t = TECHS[id];
      if (p.techs.has(id) || p.pending.has(id)) continue;
      const locked = t.age > p.age ? `Requires the ${AGES[t.age].name}.` : t.requires && !p.techs.has(t.requires) ? `Requires ${TECHS[t.requires].name}.` : undefined;
      out.push({ id: 'r:' + id, icon: ico(id, t.icon), name: 'Research ' + t.name, desc: t.desc, cost: t.cost, locked, act: () => game.cmdResearch(pid, b.id, id) });
    }
    if (b.type === 'towncenter' && p.age < AGES.length - 1) {
      const next = AGES[p.age + 1];
      while (out.length < 4) out.push({ id: '', icon: '', name: '', desc: '', act: () => {} });
      out.push({
        id: 'age' + p.age, icon: ico('ageup', '⏫'), name: `Advance to the ${next.name}`, cost: next.cost,
        desc: 'Unlocks new buildings, units and technologies, and gives your settlement a new look.',
        locked: p.agingUp ? 'Already advancing.' : undefined, act: () => game.cmdAgeUp(pid, b.id),
      });
    }
    if (b.type === 'house') {
      out.push({
        id: 'couple', icon: ico('couple', '💞'), name: 'Find a couple',
        desc: 'Call the nearest homeless man and woman to move in. You can also right-click a house with a villager selected.',
        act: () => {
          let n = 0;
          for (const h of same) n += game.cmdAutoResidents(pid, h.id);
          if (!n) this.toast(same.every((h) => h.residents.m && h.residents.f) ? 'This house already has a couple.' : 'No homeless villager of the needed gender is available.');
        },
      });
      const paused = b.birthsPaused;
      out.push({
        id: 'pause' + paused, icon: paused ? ico('births_resume', '🍼') : ico('births_pause', '⏸️'), name: paused ? 'Resume raising children' : 'Stop raising children',
        desc: `Each child costs ${RI('food')}${BIRTH_COST}. Pause a family when your village is large enough.`,
        act: () => { for (const h of same) game.cmdPauseBirths(pid, h.id, !paused); },
      });
      out.push({ id: 'evict', icon: ico('evict', '🚪'), name: 'Move residents out', desc: 'Both residents become homeless and can move elsewhere.', act: () => { for (const h of same) game.cmdEvict(pid, h.id); } });
    }
    return out;
  }

  private showTip(): void {
    const tip = $('tip');
    const b = this.btns[this.hoverBtn];
    if (!b || !b.id) { tip.classList.add('hidden'); return; }
    const p = this.app.game.players[this.app.pid];
    const cost = b.cost
      ? RES_TYPES.filter((r) => b.cost![r]).map((r) => `<span class="${p.res[r] < b.cost![r]! ? 'poor' : ''}">${RI(r)}${b.cost![r]}</span>`).join(' ')
      : '';
    tip.innerHTML = `<b>${b.name}</b> <kbd>${SLOT_KEYS[this.hoverBtn]}</kbd><div class="cost">${cost}</div><div>${b.desc}</div>${b.locked ? `<div class="locked">${b.locked}</div>` : ''}`;
    tip.classList.remove('hidden');
  }

  private updateCard(): void {
    const p = this.app.game.players[this.app.pid];
    this.btns = this.buildButtons();
    const poor = (b: Btn) => !!b.cost && !this.app.game.canAfford(p, b.cost);
    const sig = this.btns.map((b) => `${b.id}${b.locked ? 'L' : ''}${b.active ? 'A' : ''}${poor(b) ? 'P' : ''}`).join('|');
    if (sig === this.cardSig) return;
    this.cardSig = sig;
    $('card').innerHTML = this.btns.map((b, i) => b.id
      ? `<button data-i="${i}" class="${b.locked ? 'locked' : ''} ${b.active ? 'active' : ''} ${poor(b) ? 'poor' : ''}"><kbd>${SLOT_KEYS[i]}</kbd><span>${b.icon}</span></button>`
      : '<i></i>').join('');
    this.showTip();
  }

  // ---- Selection info ----

  private bar(frac: number, cls = ''): string {
    return `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></div></div>`;
  }

  private infoHtml(): string {
    const { game, pid, sel } = this.app;
    const ents = sel.map((id) => game.entities.get(id)).filter((e): e is Entity => !!e);
    if (!ents.length) return '<div class="hint">Left-click or drag to select. Right-click to move, gather, build or attack.</div>';
    if (ents.length > 1) {
      const counts = new Map<string, number>();
      for (const e of ents) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      return '<div class="multi">' + [...counts].map(([type, n]) => {
        const d = UNITS[type] ?? BUILDINGS[type];
        return `<button data-type="${type}" title="${d.name}"><span>${ico(type, d.icon)}</span><b>${n}</b></button>`;
      }).join('') + '</div>';
    }
    const e = ents[0];
    if (e.kind === 'resource') {
      return `<div class="head"><span class="icon">${ico('node_' + e.type, NODE_ICON[e.type])}</span><div><b>${NODE_NAME[e.type]}</b><div>${RI(e.resType)} ${e.amount} remaining</div></div></div>`;
    }
    const owner = game.players[e.owner];
    const mine = e.owner === pid;
    const tag = mine ? '' : ` <span style="color:${hex(owner.color)}">(${owner.name})</span>`;
    const hp = `${this.bar(e.hp / e.maxHp, 'hp')}<small>${Math.ceil(e.hp)} / ${e.maxHp}</small>`;
    if (e.kind === 'unit') {
      const d = e.def;
      const mods = owner.mods;
      const mil = game.isMilitary(e);
      let extra = '';
      if (e.growT > 0) extra += `<div class="good">👶 Child — grows up in ${Math.ceil(e.growT)}s</div>`;
      else if (e.type === 'villager' && mine) {
        extra += `<div>${e.homeId ? '🏠 Lives in a house' : '⛺ Homeless — right-click a house to move in'}</div>`;
        if (e.carryAmt > 0) extra += `<div>Carrying ${RI(e.carryType)} ${e.carryAmt}</div>`;
      }
      if (d.mana) extra += `<div>Faith ${Math.floor(e.mana)} / ${d.mana}</div>${this.bar(e.mana / d.mana, 'faith')}`;
      if (e.plagueT > 0) extra += '<div class="warn">☠️ Plagued — a Shaman can cure it</div>';
      const morale = game.moraleAt(e.owner, e.x, e.y);
      if (morale > 0) extra += `<div class="good">🏠 Home morale: takes ${Math.round(morale * 100)}% less damage</div>`;
      if (!d.aura && d.atk > 0 && game.auraAt(e.owner, e.x, e.y) > 1) extra += '<div class="good">👑 Inspired by the Warlord: +25% damage</div>';
      const name = (e.growT > 0 ? 'Child' : d.name) + (e.gender ? ` ${GENDER[e.gender]}` : '');
      return `<div class="head"><span class="icon">${e.gender === 'f' ? WOMAN() : e.gender === 'm' ? MAN() : ico(e.type, d.icon)}</span><div><b>${name}</b>${tag}${hp}</div></div>
        <div class="stat">⚔ ${d.atk + (mil ? mods.atk : 0)} · 🛡 ${d.armor + (mil ? mods.armor : 0)}${d.range > 1 ? ` · range ${d.range}` : ''}${d.heal ? ` · heals ${d.heal}/s` : ''}</div>${extra}`;
    }
    const b = e;
    let body = '';
    if (!b.complete) body += `<div>Under construction</div>${this.bar(b.progress)}`;
    else if (mine) {
      if (b.queue.length) {
        body += '<div class="queue">' + b.queue.map((q, i) => {
          const icon = q.kind === 'unit' ? (q.gender === 'f' ? WOMAN() : q.gender === 'm' ? MAN() : ico(q.id, UNITS[q.id].icon)) : q.kind === 'tech' ? ico(q.id, TECHS[q.id].icon) : ico('ageup', '⏫');
          return `<button data-q="${i}" title="Click to cancel">${icon}</button>`;
        }).join('') + '</div>';
        const q = b.queue[0];
        body += this.bar(q.t / q.time) + (q.blocked ? '<div class="warn">Need more houses!</div>' : '');
      }
      if (b.type === 'house') {
        const r = b.residents;
        body += `<div class="family"><span class="${r.m ? 'in m' : ''}">♂ ${r.m ? 'Man' : 'empty'}</span><span class="${r.f ? 'in f' : ''}">♀ ${r.f ? 'Woman' : 'empty'}</span></div>`;
        if (r.m && r.f) {
          body += b.birthsPaused ? '<div>Not raising children (paused)</div>'
            : `<div>Raising a child${b.children ? ` · ${b.children} raised` : ''}</div>${this.bar(b.birthProgress, 'love')}` +
              (b.birthBlocked ? `<div class="warn">${owner.pop >= owner.popCap ? 'Need more houses!' : 'Need food!'}</div>` : '');
        } else body += '<div class="hint">Needs a man and a woman to raise children.</div>';
      }
      if (b.type === 'towncenter') {
        body += `<div class="${b.morale ? 'good' : 'hint'}">🏠 Houses nearby: ${b.morale}/${MORALE_MAX_HOUSES} — defenders take ${Math.round(b.morale * MORALE_PER_HOUSE * 100)}% less damage</div>`;
      }
      if (b.type === 'farm') body += `<div class="hint">${b.workerId ? 'Being farmed' : 'Needs a farmer'}</div>`;
    }
    return `<div class="head"><span class="icon">${ico(b.type, b.def.icon)}</span><div><b>${b.def.name}</b>${tag}${hp}</div></div>${body}`;
  }

  // ---- Minimap ----

  private drawMinimap(): void {
    const { game, pid, r } = this.app;
    const N = game.size, d = this.miniImg.data, vis = game.vis;
    const set = (i: number, c: number) => { d[i * 4] = c >> 16; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255; };
    for (let i = 0; i < N * N; i++) {
      const t = game.terrain[i];
      set(i, t === T_WATER ? 0x2f6a9c : t === T_DIRT ? 0x8a8048 : 0x5c8a40);
    }
    const NODE: Record<string, number> = { tree: 0x2c5a2a, berries: 0xd0507a, gold: 0xf2c230, stone: 0xb0b0b0 };
    for (const n of game.resources)
      for (let y = 0; y < n.size; y++) for (let x = 0; x < n.size; x++) set((n.cy + y) * N + n.cx + x, NODE[n.type]);
    for (const b of game.buildings) {
      if (b.owner !== pid && !b.seen) continue;
      const c = game.players[b.owner].color;
      for (let y = 0; y < b.size; y++) for (let x = 0; x < b.size; x++) set((b.cy + y) * N + b.cx + x, c);
    }
    for (let i = 0; i < N * N; i++) {
      if (vis[i] === 0) set(i, 0x000000);
      else if (vis[i] === 1) { d[i * 4] *= 0.55; d[i * 4 + 1] *= 0.55; d[i * 4 + 2] *= 0.55; }
    }
    for (const u of game.units) {
      const cx = Math.floor(u.x), cy = Math.floor(u.y);
      if (u.owner !== pid && vis[cy * N + cx] !== 2) continue;
      const c = u.owner === pid ? 0xffffff : game.players[u.owner].color;
      set(cy * N + cx, c);
      if (cx + 1 < N) set(cy * N + cx + 1, c);
    }
    this.miniBuf.getContext('2d')!.putImageData(this.miniImg, 0, 0);
    const ctx = this.miniCtx, W = this.mini.width, k = W / N;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.miniBuf, 0, 0, W, W);
    // Camera view outline.
    const w = window.innerWidth, h = window.innerHeight;
    const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => r.groundAt(x, y));
    if (corners.every((c) => c)) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      corners.forEach((c, i) => (i ? ctx.lineTo(c!.x * k, c!.y * k) : ctx.moveTo(c!.x * k, c!.y * k)));
      ctx.closePath();
      ctx.stroke();
    }
    for (const a of this.alerts) {
      ctx.strokeStyle = `rgba(255,60,40,${1 - a.t / 6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(a.x * k, a.y * k, 4 + ((a.t * 12) % 10), 0, 6.3);
      ctx.stroke();
    }
  }

  update(dt: number): void {
    const { game, pid } = this.app;
    const p = game.players[pid];
    let idle = 0;
    for (const u of game.units) if (u.owner === pid && u.type === 'villager' && !u.order && u.growT <= 0) idle++;
    const tc = game.buildings.find((b) => b.owner === pid && b.queue[0]?.kind === 'age');
    const aging = tc ? ` → ${AGES[p.age + 1].name} ${Math.floor((tc.queue[0].t / tc.queue[0].time) * 100)}%` : '';
    const mins = Math.floor(game.time / 60), secs = Math.floor(game.time % 60);
    const top = [
      RES_TYPES.map((r) => `<span title="${r}">${RI(r)} ${Math.floor(p.res[r])}</span>`).join('') +
        `<span title="Population" class="${p.pop >= p.popCap ? 'warn' : ''}">${ico('population', '👥')} ${p.pop}/${p.popCap}</span>`,
      AGES[p.age].name + aging,
      String(idle),
      `${mins}:${String(secs).padStart(2, '0')}`,
      this.app.paused ? '▶' : '⏸',
      this.app.speed + '×',
    ];
    const sig = top.join('#');
    if (sig !== this.topSig) {
      this.topSig = sig;
      $('res').innerHTML = top[0];
      $('age').textContent = top[1];
      $('idle').innerHTML = `🧑‍🌾 <b>${top[2]}</b> idle`;
      $('idle').classList.toggle('dim', idle === 0);
      $('clock').textContent = top[3];
      $('pause').textContent = top[4];
      $('speed').textContent = top[5];
    }

    this.updateCard();
    const info = this.infoHtml();
    if (info !== this.infoSig) { this.infoSig = info; $('info').innerHTML = info; }

    for (let i = this.alerts.length - 1; i >= 0; i--) if ((this.alerts[i].t += dt) > 6) this.alerts.splice(i, 1);
    if ((this.miniT -= dt) <= 0) { this.miniT = 0.12; this.drawMinimap(); }
  }
}
