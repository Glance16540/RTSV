// DOM heads-up display: resources, selection info, command card, minimap and messages.

import {
  ABILITIES, AGES, CIVS, BIRTH_COST, BUILD_PAGES, BUILDINGS, Cost, MORALE_MAX_HOUSES, MORALE_PER_HOUSE, RES_ICON, RES_TYPES, ResType, TRADE, VILLAGER_TRAITS,
  TECHS, UNITS, costText,
} from '../sim/data';
import { CAMP_BIRTH, CAPTIVE_VIRTUE, CAPTIVE_WORK, MERC_TYPES, MERC_WAGE, PATRON_FOOD, PATRON_MUSTER, CLERGY_BIRTH, CLERGY_VIRTUE, Choice, DILEMMAS, MAID_DISTRACTION, MAID_GOLD, MAID_VIRTUE, STAFF_CAP, creedOf } from '../sim/creed';
import { Building, Entity, GameEvent, Stance, Unit } from '../sim/game';
import { T_DIRT, T_WATER } from '../sim/map';
import { ico } from './assets';
import { LOCALS } from '../sim/campaign';
import { LEADERS, LeaderEvent } from '../sim/leaders';
import type { App } from './main';
import { playLine, speechHtml } from './voice';
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
const NODE_NAME: Record<string, string> = { tree: 'Tree', berries: 'Berry Bush', gold: 'Gold Mine', stone: 'Stone Quarry', carcass: 'Deer Carcass', fish: 'Fish Shoal' };
const RI = (r: ResType) => ico(r, RES_ICON[r]);
const MAN = () => ico('villager_m', '👨‍🌾');
const WOMAN = () => ico('villager_f', '👩‍🌾');
const NODE_ICON: Record<string, string> = { tree: '🌲', berries: '🫐', gold: '🪙', stone: '🪨', carcass: '🍖', fish: '🐟' };

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
  private dilemmaShown: string | null = null;
  private buildPage = 0;
  private guideSig = '';
  private guideOff = false;

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

    try { this.guideOff = localStorage.getItem('rtsv-guide-off') === '1'; } catch { /* storage unavailable */ }
    $('guide').addEventListener('pointerdown', (e) => {
      if (!(e.target as HTMLElement).closest('button')) return;
      this.guideOff = true;
      try { localStorage.setItem('rtsv-guide-off', '1'); } catch { /* storage unavailable */ }
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
      if (e.button === 2) this.app.input.commandAt(p.x, p.y, null, false);
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

  toast(text: string, cls = '', html = false): void {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    if (html) el.innerHTML = text;
    else el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 5) box.firstChild!.remove();
    const stay = cls.includes('leader') ? 6500 : 3500;
    setTimeout(() => el.classList.add('fade'), stay);
    setTimeout(() => el.remove(), stay + 800);
  }

  private alertSaid = -100;

  /** The player's own leader speaks to them. */
  advisorSay(event: LeaderEvent): void {
    const civ = this.app.game.players[this.app.pid].civ;
    if (!LEADERS[civ]) return;
    const s = { civ, event, index: Math.floor(Math.random() * LEADERS[civ].lines[event].length) };
    this.toast(speechHtml(s), 'leader', true);
    playLine(s);
  }

  /** A rival leader says something: shown as a banner, and spoken once the line has been recorded. */
  leaderSay(player: number, event: LeaderEvent): void {
    const { game, pid } = this.app;
    const p = game.players[player];
    const l = p && LEADERS[p.civ];
    // Local tribes and reserve armies are not led by anyone with a name.
    if (!l || !p.isAI || p.neutral || !game.hostile(player, pid) || p.name === LOCALS.name || p.name.endsWith(' reserve')) return;
    const s = { civ: p.civ, event, index: Math.floor(Math.random() * l.lines[event].length) };
    this.toast(speechHtml(s), 'leader', true);
    playLine(s);
  }

  handle(ev: GameEvent): void {
    const { game, pid } = this.app;
    if (ev.t === 'msg' && ev.player === pid) this.toast(ev.text);
    else if (ev.t === 'age') {
      if (ev.player === pid) { this.toast(`You have advanced to the ${AGES[game.players[pid].age].name}!`, 'big'); this.advisorSay('p_ageup'); }
      else { this.toast(`${game.players[ev.player].name} has advanced to the ${AGES[game.players[ev.player].age].name}.`); this.leaderSay(ev.player, 'ageup'); }
    } else if (ev.t === 'alert' && ev.player === pid) {
      this.toast('⚠️ You are under attack! (Space to look)', 'warn');
      // Your leader does not shout about every skirmish.
      if (game.time - this.alertSaid > 60 && !game.field) { this.alertSaid = game.time; this.advisorSay('p_alert'); }
      this.alerts.push({ x: ev.x, y: ev.y, t: 0 });
      this.app.lastAlert = { x: ev.x, y: ev.y };
    } else if (ev.t === 'birth' && ev.player === pid) this.toast('👶 A child is born.');
    else if (ev.t === 'defeated' && ev.player !== pid) { this.toast(`${game.players[ev.player].name} has been destroyed.`, 'big'); this.leaderSay(ev.player, 'eliminated'); }
    else if (ev.t === 'defeated') this.toast(ev.player === pid ? 'Your settlement has fallen. Your ally fights on.' : `${game.players[ev.player].name} has been destroyed.`, 'big');
    else if (ev.t === 'signal' && ev.player !== pid && !game.hostile(ev.player, pid)) this.toast(`📣 ${game.players[ev.player].name} calls for you.`);
    else if (ev.t === 'oldage' && ev.player === pid) this.toast(`🕯️ ${ev.name} has died of old age.`);
    else if (ev.t === 'creed' && ev.player === pid) {
      const c = creedOf(game.players[pid].virtue);
      this.toast(`${c.icon} Your people are now ${c.name}. ${c.desc}`, 'big');
    } else if (ev.t === 'wonder') {
      if (ev.player !== pid) this.leaderSay(ev.player, 'wonder');
      this.toast(ev.player === pid ? '🗿 Your Wonder is complete. Defend it for five minutes to win!' : `🗿 ${game.players[ev.player].name} has built a Wonder. Destroy it within five minutes!`, ev.player === pid ? 'big' : 'big warn');
    } else if (ev.t === 'gameover') {
      const win = !game.hostile(ev.winner, pid); // an ally's victory is yours too
      $('end-title').textContent = win ? 'Victory' : 'Defeat';
      const byWonder = game.wonderLeft(ev.winner) === 0;
      $('end-text').textContent = win ? (byWonder ? 'Your Wonder has stood the test. The world acknowledges your people.' : 'Your enemy lies in ruins. Your people will tell this story for ages.')
        : byWonder ? `${game.players[ev.winner].name}'s Wonder stood too long.` : 'Your settlement has fallen.';
      const civ = game.players[pid].civ;
      const last = { civ, event: (win ? 'p_win' : 'p_loss') as LeaderEvent, index: Math.floor(Math.random() * 2) };
      $('end-stats').innerHTML = (LEADERS[civ] ? speechHtml(last) : '') + this.summary();
      playLine(last);
      $('end').classList.remove('hidden');
    }
  }

  /** End-of-game chart and table: how each player's fortunes went. */
  private summary(): string {
    const game = this.app.game;
    const ps = game.players.filter((q) => !q.neutral);
    const top = Math.max(1, ...ps.flatMap((q) => q.history));
    const n = Math.max(2, ...ps.map((q) => q.history.length));
    const lines = ps.map((q) => {
      const pts = q.history.map((v, i) => `${((i / (n - 1)) * 600).toFixed(1)},${(124 - (v / top) * 116).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${hex(q.color)}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }).join('');
    const rows = ps.map((q) => `<tr><td style="color:${hex(q.color)}">■ ${q.name}</td><td>${game.score(q.id)}</td><td>${AGES[q.age].name}</td>
      <td>${q.stats.gathered}</td><td>${q.stats.born}</td><td>${q.stats.trained}</td><td>${q.stats.kills}</td><td>${q.stats.lost}</td><td>${q.stats.razed}</td></tr>`).join('');
    return `<svg viewBox="0 0 600 130" preserveAspectRatio="none" role="img" aria-label="Score over time">${lines}</svg>
      <table><tr><th></th><th>Score</th><th>Age</th><th>Gathered</th><th>Born</th><th>Trained</th><th>Kills</th><th>Losses</th><th>Razed</th></tr>${rows}</table>`;
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
        for (const type of BUILD_PAGES[this.buildPage]) {
          const d = BUILDINGS[type];
          out.push({
            id: 'b:' + type, icon: ico(type, d.icon), name: 'Build ' + d.name, desc: d.desc, cost: d.cost,
            locked: d.age > p.age ? `Requires the ${AGES[d.age].name}.` : game.creedBar(pid, d) ?? undefined,
            active: this.app.placing === type,
            act: () => { this.app.select(this.app.sel); this.app.placing = type; },
          });
        }
        while (out.length < 13) out.push({ id: '', icon: '', name: '', desc: '', act: () => {} });
        out.push({
          id: 'page' + this.buildPage, icon: this.buildPage ? ico('page_settlement', '🏘️') : ico('page_military', '⚔️'),
          name: this.buildPage ? 'Settlement buildings' : 'Military buildings', desc: 'Show the other page of the build menu.',
          act: () => { this.buildPage = 1 - this.buildPage; this.app.select(this.app.sel); },
        });
      } else {
        out.push({
          id: 'atk', icon: ico('attackmove', '⚔️'), name: 'Attack-move', desc: 'Click a location: units march there and fight anything they meet on the way.',
          active: this.app.attackMode, act: () => { this.app.select(this.app.sel); this.app.attackMode = true; },
        });
        out.push({
          id: 'patrol', icon: ico('patrol', '🔁'), name: 'Patrol', desc: 'Click a location: units walk back and forth between here and there, attacking anything they meet.',
          active: this.app.patrolMode, act: () => { this.app.select(this.app.sel); this.app.patrolMode = true; },
        });
        if (units.some((u) => u.cargo?.length)) {
          out.push({
            id: 'unload', icon: ico('unload', '⏏️'), name: 'Put ashore', desc: 'Everyone aboard lands on the shore beside the ship.',
            act: () => { game.cmdUnload(pid, ids); },
          });
        }
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
      if (!units.every((u) => u.type === 'villager')) {
        while (out.length < 5) out.push({ id: '', icon: '', name: '', desc: '', act: () => {} });
        const stances: [Stance, string, string, string][] = [
          ['aggressive', '🔥', 'Aggressive', 'Chase any enemy that comes into view.'],
          ['defensive', '🛡️', 'Defensive', 'Fight enemies that come near, but do not chase far.'],
          ['hold', '⚓', 'Hold ground', 'Stay put and only strike enemies within reach.'],
        ];
        for (const [st, icon, name, desc] of stances) {
          out.push({ id: 'st:' + st, icon: ico('stance_' + st, icon), name: 'Stance: ' + name, desc, active: units.every((u) => u.stance === st), act: () => game.cmdStance(pid, ids, st) });
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

    if (b.type === 'tavern' && b.complete) {
      for (const base of MERC_TYPES) {
        const type = game.trainedAs(pid, base), d = UNITS[type];
        if (UNITS[base].age > p.age) continue;
        out.push({
          id: 'hire:' + base, icon: ico(type, d.icon), name: `Hire a ${d.name}`, cost: { gold: game.hireCost(pid, base) },
          locked: b.staff?.length ? undefined : 'Someone must be in the tavern to send word.',
          desc: `A sword for hire: gold only, and he is here at once. He wants ${(MERC_WAGE * 60).toFixed(1)} gold a minute after that, and walks away when the gold runs out.<br><span class="stat">❤ ${d.hp} · ⚔ ${d.atk} · 🛡 ${d.armor}${d.range > 1 ? ` · range ${d.range}` : ''} · pop ${d.pop}</span>`,
          act: () => { game.cmdHire(pid, b.id, base); },
        });
      }
    }
    // Upgraded types are trained in place of the ones they replaced, so list each result once.
    for (const type of [...new Set(b.def.trains.map((t) => game.trainedAs(pid, t)))]) {
      const d = UNITS[type];
      if (d.civ && d.civ !== p.civ) continue; // another people's unit
      const locked = d.age > p.age ? `Requires the ${AGES[d.age].name}.` : game.creedBar(pid, d) ?? undefined;
      if (type === 'villager') {
        out.push({ id: 't:vm', icon: MAN(), name: 'Train Villager (man)', desc: d.desc, cost: d.cost, locked, act: () => game.cmdTrain(pid, least().id, type, 'm') });
        out.push({ id: 't:vf', icon: WOMAN(), name: 'Train Villager (woman)', desc: d.desc, cost: d.cost, locked, act: () => game.cmdTrain(pid, least().id, type, 'f') });
      } else {
        out.push({
          id: 't:' + type, icon: ico(type, d.icon), name: 'Train ' + d.name, cost: game.unitCost(pid, type), locked,
          desc: `${d.desc}<br><span class="stat">❤ ${d.hp} · ⚔ ${d.atk} · 🛡 ${d.armor}${d.range > 1 ? ` · range ${d.range}` : ''} · pop ${d.pop}</span>`,
          act: () => game.cmdTrain(pid, least().id, type),
        });
      }
    }
    for (const id of b.def.techs) {
      const t = TECHS[id];
      if (p.techs.has(id) || p.pending.has(id)) continue;
      const locked = t.age > p.age ? `Requires the ${AGES[t.age].name}.` : t.requires && !p.techs.has(t.requires) ? `Requires ${TECHS[t.requires].name}.` : undefined;
      out.push({ id: 'r:' + id, icon: ico(id, t.icon), name: 'Research ' + t.name, desc: t.desc, cost: game.techCost(pid, id), locked, act: () => game.cmdResearch(pid, b.id, id) });
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
    if (b.type === 'towncenter') {
      out.push({
        id: 'bell' + p.bell, icon: p.bell ? ico('bell_clear', '🕊️') : ico('bell', '🔔'), name: p.bell ? 'All clear' : 'Ring the town bell',
        desc: p.bell ? 'Villagers leave their shelters and go back to work.'
          : 'Villagers run to shelter in Town Centers and Watch Towers, where they cannot be hurt and help shoot arrows.',
        act: () => { game.cmdBell(pid, !p.bell); sfx.play('alert'); },
      });
    }
    if (b.type === 'market') {
      for (const dir of ['sell', 'buy'] as const) {
        for (const r of ['food', 'wood', 'stone'] as ResType[]) {
          const rate = TRADE[r]!;
          out.push(dir === 'sell'
            ? { id: 'sell' + r, icon: RI(r) + '→', name: `Sell 100 ${r}`, desc: `Receive ${RI('gold')}${Math.round(rate.sell * game.creed(pid).trade)}.`, cost: { [r]: 100 }, act: () => game.cmdTrade(pid, b.id, r, 'sell') }
            : { id: 'buy' + r, icon: '→' + RI(r), name: `Buy 100 ${r}`, desc: `Receive ${RI(r)}100.`, cost: { gold: rate.buy }, act: () => game.cmdTrade(pid, b.id, r, 'buy') });
        }
        out.push({ id: '', icon: '', name: '', desc: '', act: () => {} }, { id: '', icon: '', name: '', desc: '', act: () => {} });
      }
      const ally = game.allies(pid)[0];
      if (ally) {
        for (const r of RES_TYPES) {
          out.push({ id: 'give' + r, icon: RI(r) + '🤝', name: `Send 100 ${r} to ${ally.name}`, desc: 'A gift to your ally. Nothing comes back.', cost: { [r]: 100 }, act: () => game.cmdTribute(pid, ally.id, r) });
        }
      }
    }
    if (b.def.staff && same.some((s) => s.staff?.length)) {
      out.push({ id: 'unstaff1', icon: ico('unstaff', '🚶'), name: 'Send one back to work', desc: 'A stationed villager comes out and can be given other work.', act: () => { game.cmdUnstaff(pid, b.id); } });
      out.push({ id: 'unstaffall', icon: ico('unstaffall', '🚪'), name: 'Send everyone out', desc: 'All the villagers stationed here come out.', act: () => { for (const s of same) game.cmdUnstaff(pid, s.id, true); } });
    }
    if (b.def.shelter && same.some((s) => s.sheltered.length)) {
      out.push({
        id: 'release', icon: ico('release', '🚪'), name: 'Send everyone out', desc: 'Units inside come back out.',
        act: () => { for (const s of same) game.cmdRelease(pid, s.id); },
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
    const tag = mine ? '' : ` <span style="color:${hex(owner.color)}">(${owner.name}${owner.neutral || game.hostile(e.owner, pid) ? '' : ', ally'})</span>`;
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
      if (e.captive) extra += `<div class="hint">⛓️ Leading ${e.captive.name} to a Work Camp</div>`;
      else if (d.slaver) extra += '<div class="hint">Right-click an enemy villager to seize him.</div>';
      if (e.merc) extra += `<div class="hint">💰 Mercenary: ${(MERC_WAGE * 60).toFixed(1)} gold a minute, or he leaves</div>`;
      if (d.carry) extra += `<div class="${e.cargo?.length ? 'good' : 'hint'}">Aboard: ${e.cargo?.length ?? 0}/${d.carry} — right-click the ship with land units to board</div>`;
      if (d.mana) extra += `<div>Faith ${Math.floor(e.mana)} / ${d.mana}</div>${this.bar(e.mana / d.mana, 'faith')}`;
      if (e.plagueT > 0) extra += '<div class="warn">☠️ Plagued — a Shaman can cure it</div>';
      const morale = game.moraleAt(e.owner, e.x, e.y);
      if (morale > 0) extra += `<div class="good">🏠 Home morale: takes ${Math.round(morale * 100)}% less damage</div>`;
      if (!d.aura && d.atk > 0 && game.auraAt(e.owner, e.x, e.y) > 1) extra += '<div class="good">👑 Inspired by the Warlord: +25% damage</div>';
      if (d.atk > 0 && game.weakenAt(e.owner, e.x, e.y) < 1) extra += '<div class="warn">📜 Unnerved by an enemy Strategist: −20% damage</div>';
      if (d.frenzy) extra += `<div>🪓 Frenzy: striking ${Math.round((1 / (0.45 + 0.55 * (e.hp / e.maxHp)) - 1) * 100)}% faster</div>`;
      for (const tr of [e.trait2, e.trait]) if (tr) extra = `<div class="good">${VILLAGER_TRAITS[tr].icon} ${VILLAGER_TRAITS[tr].name}: ${VILLAGER_TRAITS[tr].desc}</div>` + extra;
      if (e.lifespan > 0 && e.growT <= 0 && game.aging) {
        const years = Math.floor(16 + (e.age / e.lifespan) * 54);
        extra += game.isElder(e) ? `<div class="hint">🧓 Elder, ${years} years old: works and walks more slowly</div>` : `<div class="hint">${years} years old</div>`;
      }
      const role = (e.growT > 0 ? 'Child' : d.name) + (e.gender ? ` ${GENDER[e.gender]}` : '');
      const name = e.name ? `${e.name}${e.family ? ' ' + e.family : ''} <small>${role}</small>` : role;
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
        const nameOf = (id: number) => { const u = game.entities.get(id); return u && u.kind === 'unit' ? u.name + (u.trait ? ' ' + VILLAGER_TRAITS[u.trait].icon : '') + (u.trait2 ? VILLAGER_TRAITS[u.trait2].icon : '') : ''; };
        body += `<div class="family"><span class="${r.m ? 'in m' : ''}">♂ ${nameOf(r.m) || 'empty'}</span><span class="${r.f ? 'in f' : ''}">♀ ${nameOf(r.f) || 'empty'}</span></div>`;
        if (b.family) body += `<div>The ${b.family} family${game.renown(b) ? ` · renown ${'★'.repeat(game.renown(b))}: +${game.renown(b)} room, children ${game.renown(b) * 10}% sooner` : ''}</div>`;
        if (r.m && r.f) {
          body += b.birthsPaused ? '<div>Not raising children (paused)</div>'
            : `<div>Raising a child${b.children ? ` · ${b.children} raised` : ''}</div>${this.bar(b.birthProgress, 'love')}` +
              (b.birthBlocked ? `<div class="warn">${owner.pop >= owner.popCap ? 'Need more houses!' : 'Need food!'}</div>` : '');
        } else body += '<div class="hint">Needs a man and a woman to raise children.</div>';
      }
      if (b.type === 'towncenter') {
        body += `<div class="${b.morale ? 'good' : 'hint'}">🏠 Houses nearby: ${b.morale}/${MORALE_MAX_HOUSES} — defenders take ${Math.round(b.morale * MORALE_PER_HOUSE * 100)}% less damage</div>`;
      }
      if (b.def.shelter) body += `<div class="${b.sheltered.length ? 'good' : 'hint'}">🔔 Inside: ${b.sheltered.length}/${b.def.shelter} — Alt+right-click to send units in</div>`;
      if (b.def.camp) {
        const n = b.captives?.length ?? 0;
        body += `<div class="${n ? 'good' : 'hint'}">⛓️ Captives: ${n}/${b.def.camp}${n ? ` <small>(${b.captives!.map((c) => c.name).join(', ')})</small>` : ' — send Slavers after enemy villagers'}</div>` +
          `<div class="hint">Each captive makes the whole town gather ${(CAPTIVE_WORK * 100).toFixed(0)}% faster and adds ${CAPTIVE_VIRTUE} decadence a minute. The camp turns out a new villager about every ${Math.round(CAMP_BIRTH / Math.max(1, n))} seconds. If it falls, they go home.</div>`;
      }
      if (b.def.staff) {
        const tav = b.type === 'tavern';
        const who = (b.staff ?? []).map((id) => game.entities.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit');
        const men = who.filter((u) => u.gender === 'm').length, women = who.length - men;
        const count = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
        const roll = tav ? `${count(women, 'milkmaid', 'milkmaids')}, ${count(men, 'patron', 'patrons')}` : `${count(men, 'monk', 'monks')}, ${count(women, 'nun', 'nuns')}`;
        body += `<div class="${who.length ? 'good' : 'hint'}">${tav ? '🍺' : '🙏'} ${roll} <small>(${who.length}/${b.def.staff})</small> — right-click with villagers to station them</div>` +
          `<div class="hint">${tav
            ? `A milkmaid brings in ${(MAID_GOLD * 60).toFixed(0)} gold a minute. A patron eats and drinks ${(PATRON_FOOD * 60).toFixed(0)} food a minute, but soldiers are trained ${(PATRON_MUSTER * 100).toFixed(0)}% faster for each one. Each adds ${MAID_VIRTUE} decadence a minute and slows all gathering by ${(MAID_DISTRACTION * 100).toFixed(1)}%, and their own house raises no children meanwhile. In a worldly town, plague can break out here.`
            : `Each adds ${CLERGY_VIRTUE} piety a minute and brings the town's children ${(CLERGY_BIRTH * 100).toFixed(0)}% sooner. They leave their own house when they enter.`} Up to ${STAFF_CAP} count in all.</div>`;
      }
      if (b.type === 'farm') body += `<div class="hint">${b.workerId ? 'Being farmed' : 'Needs a farmer'}</div>`;
    }
    return `<div class="head"><span class="icon">${ico(b.type, b.def.icon)}</span><div><b>${b.def.name}</b>${tag}${hp}</div></div>${body}`;
  }

  // ---- First steps guide ----

  private updateGuide(): void {
    if (this.app.game.field) { $('guide').classList.add('hidden'); return; } // nothing to teach in a field battle
    if (this.app.mission) {
      // A mission shows its own objectives in place of the first-steps tips.
      const st = this.app.missionStatus;
      const sig = 'm' + (st ? st.objectives.map((o) => o.text + o.done).join('|') : '') + this.app.paused;
      if (sig === this.guideSig) return;
      this.guideSig = sig;
      const el = $('guide');
      el.classList.toggle('hidden', !st || this.app.paused);
      if (st) el.innerHTML = `<h4>${this.app.mission.name}</h4>` + st.objectives.map((o) => `<div class="${o.done ? 'done' : 'now'}">${o.done ? '✓' : '○'} ${o.text}</div>`).join('');
      return;
    }
    const { game, pid } = this.app;
    const p = game.players[pid];
    const mine = game.buildings.filter((b) => b.owner === pid);
    const units = game.units.filter((u) => u.owner === pid);
    const steps: [string, string, boolean][] = [
      ['Put your villagers to work', 'Drag a box around them, then right-click berries or trees.', units.some((u) => u.order?.t === 'gather') || game.time > 240],
      ['Build a House', 'Select a villager, press Q, then click a spot near the Town Center.', mine.some((b) => b.type === 'house' && b.complete)],
      ['Start a family', 'Select the house and press Q, or right-click it with a man and a woman.', mine.some((b) => b.residents.m && b.residents.f)],
      ['Grow to 10 people', 'Train villagers at the Town Center (H) and let your families raise children.', p.pop >= 10],
      ['Raise an army', 'Villager → Military buildings (V) → Barracks, then train three soldiers.', units.filter((u) => game.isMilitary(u)).length >= 3],
      ['Advance to the Bronze Age', 'Select the Town Center (H) and press T once you have the food and wood.', p.age >= 1],
      ['Destroy your rivals', 'Scout with soldiers, then select your army, press Q and click their base.', game.winner === pid],
    ];
    const i = steps.findIndex((s) => !s[2]);
    const show = !this.guideOff && i >= 0 && !this.app.paused;
    const sig = show ? String(i) : '';
    if (sig === this.guideSig) return;
    this.guideSig = sig;
    const el = $('guide');
    el.classList.toggle('hidden', !show);
    if (!show) return;
    el.innerHTML = `<h4>First steps ${i + 1}/${steps.length}<button title="Hide these tips">✕</button></h4>` +
      (i > 0 ? `<div class="done">✓ ${steps[i - 1][0]}</div>` : '') +
      `<div class="now"><b>${steps[i][0]}</b><small>${steps[i][1]}</small></div>`;
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
    const NODE: Record<string, number> = { tree: 0x2c5a2a, berries: 0xd0507a, gold: 0xf2c230, stone: 0xb0b0b0, carcass: 0xd0507a, fish: 0xd8eef8 };
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
    for (const u of game.units) if (u.owner === pid && u.type === 'villager' && !u.order && u.growT <= 0 && !u.inside) idle++;
    const tc = game.buildings.find((b) => b.owner === pid && b.queue[0]?.kind === 'age');
    const aging = tc ? ` → ${AGES[p.age + 1].name} ${Math.floor((tc.queue[0].t / tc.queue[0].time) * 100)}%` : '';
    // A standing Wonder is everyone's business: show whose it is and how long is left.
    let wonder = '';
    for (const q of game.players) {
      const left = q.neutral ? -1 : game.wonderLeft(q.id);
      if (left >= 0) wonder += ` · 🗿 ${q.id === pid ? 'Your' : q.name + "'s"} Wonder ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    }
    const mins = Math.floor(game.time / 60), secs = Math.floor(game.time % 60);
    const top = [
      RES_TYPES.map((r) => `<span title="${r}">${RI(r)} ${Math.floor(p.res[r])}</span>`).join('') +
        `<span title="Population" class="${p.pop >= p.popCap ? 'warn' : ''}">${ico('population', '👥')} ${p.pop}/${p.popCap}</span>`,
      `${CIVS[p.civ].icon} ${CIVS[p.civ].name} · ` + AGES[p.age].name + aging + wonder + (game.field ? '' : ` · <span class="creed" title="${this.creedTip(p.virtue)}">${creedOf(p.virtue).icon} ${creedOf(p.virtue).name}</span>`),
      String(idle),
      `${mins}:${String(secs).padStart(2, '0')}`,
      this.app.paused ? '▶' : '⏸',
      this.app.speed + '×',
    ];
    this.showDilemma(p.dilemma);
    const sig = top.join('#');
    if (sig !== this.topSig) {
      this.topSig = sig;
      $('res').innerHTML = top[0];
      $('age').innerHTML = top[1];
      $('idle').innerHTML = `🧑‍🌾 <b>${top[2]}</b> idle`;
      $('idle').classList.toggle('dim', idle === 0);
      $('clock').textContent = top[3];
      $('pause').textContent = top[4];
      $('speed').textContent = top[5];
    }

    this.updateCard();
    this.updateGuide();
    const info = this.infoHtml();
    if (info !== this.infoSig) { this.infoSig = info; $('info').innerHTML = info; }

    for (let i = this.alerts.length - 1; i >= 0; i--) if ((this.alerts[i].t += dt) > 6) this.alerts.splice(i, 1);
    if ((this.miniT -= dt) <= 0) { this.miniT = 0.12; this.drawMinimap(); }
  }
  private creedTip(virtue: number): string {
    const c = creedOf(virtue);
    const where = virtue > 0 ? `Piety ${Math.round(virtue)}` : virtue < 0 ? `Decadence ${Math.round(-virtue)}` : 'In balance';
    const p = this.app.game.players[this.app.pid];
    return `${where} of 100 (${p.clergy} in the church, ${p.maids} in the tavern${p.captives ? `, ${p.captives} captives` : ''}). ${c.desc}` + (c.boons.length ? ` Boons: ${c.boons.join('; ')}. Banes: ${c.banes.join('; ')}.` : ' No boons or banes.');
  }

  /** Put the dilemma awaiting the player's answer on screen, or take it away once answered. */
  private showDilemma(id: string | null): void {
    if (id === this.dilemmaShown) return;
    this.dilemmaShown = id;
    const el = $('dilemma');
    const d = DILEMMAS.find((x) => x.id === id);
    el.classList.toggle('hidden', !d);
    if (!d) return;
    const { game, pid } = this.app;
    const terms = (c: Choice) => {
      const parts = RES_TYPES.filter((r) => c.res[r]).map((r) => `${c.res[r]! > 0 ? '+' : '−'}${Math.abs(c.res[r]!)} ${RI(r)}`);
      parts.push(c.virtue > 0 ? `🙏 piety +${c.virtue}` : `🎭 decadence +${-c.virtue}`);
      return parts.join(' · ');
    };
    el.innerHTML = `<h3>${d.title}</h3><p>${d.text}</p>` +
      (['a', 'b'] as const).map((k) => `<button data-k="${k}"><b>${d[k].label}</b><small>${terms(d[k])}</small></button>`).join('') +
      `<p class="hint">How you answer moves your people towards piety or decadence. Each has its boons and banes: hover over ${creedOf(game.players[pid].virtue).icon} at the top.</p>`;
    el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      game.cmdDecide(pid, (b as HTMLElement).dataset.k as 'a' | 'b');
      sfx.play('order');
    }));
    sfx.play('alert');
  }
}
