// Conquest map screen: draws the territories and lets the player run their turn.

import {
  Army, COMPANIES, Campaign, HERO_COST, LOCALS, MAP_H, MAP_W, SITES, armyAt, armySize, armyStrength, build, canBuild, canRaise,
  canSummonHero, continueAI, defence, endTurn, income, moveArmy, raise, resolvePending, slots, summonHero, territoryAt, territoryIncome,
} from '../sim/campaign';

export interface OverworldHooks {
  save(): void;
  /** Leave for the real-time battle described by `campaign.pending`. */
  fight(): void;
  newCampaign(rivals: number, level: number): void;
  exit(): void;
}

const PAPER = [205, 186, 140];
const rgb = (c: number) => [c >> 16, (c >> 8) & 255, c & 255];
const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
const $ = (id: string) => document.getElementById(id)!;

export class Overworld {
  private ctx: CanvasRenderingContext2D;
  private cell: Uint8Array;
  private sel: number;

  constructor(private c: Campaign, private hooks: OverworldHooks) {
    const canvas = $('ow-canvas') as HTMLCanvasElement;
    this.ctx = canvas.getContext('2d')!;
    this.cell = new Uint8Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) this.cell[y * MAP_W + x] = territoryAt(c.territories, x, y);
    this.sel = c.territories.find((t) => t.capital === 0)?.id ?? 0;

    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * MAP_W), y = Math.floor(((e.clientY - r.top) / r.height) * MAP_H);
      if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) this.click(this.cell[y * MAP_W + x]);
    });
    $('ow-actions').addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || this.c.phase !== 'player') return;
      const [kind, id] = act.split(':');
      if (kind === 'raise') raise(this.c, 0, this.sel, id);
      if (kind === 'build') build(this.c, 0, this.sel, id);
      if (kind === 'hero') summonHero(this.c, 0, this.sel);
      this.changed();
    });
    $('ow-end').addEventListener('click', () => {
      endTurn(this.c);
      this.changed();
    });
    $('ow-exit').addEventListener('click', () => hooks.exit());
    $('ow-new').addEventListener('click', () => this.askNew());
    $('overworld').classList.remove('hidden');
    this.changed();
  }

  /** Something changed: save, redraw, and deal with any battle or ending that is now due. */
  private changed(): void {
    this.hooks.save();
    this.render();
    const c = this.c;
    if (c.phase === 'over') {
      this.dialog(c.winner === 0 ? 'The land is yours' : 'Your people are conquered',
        c.winner === 0 ? `Every rival has fallen. It took ${c.turn} turns.` : `${c.factions[c.winner]?.name ?? 'Your rivals'} now rule the map.`,
        [['New campaign', () => this.askNew()], ['Main menu', () => this.hooks.exit()]]);
    } else if (c.pending) this.askBattle();
    else $('ow-dialog').classList.add('hidden');
  }

  private click(tid: number): void {
    const c = this.c;
    if (c.phase !== 'player' || c.pending) return;
    const army = armyAt(c, this.sel);
    if (army && army.owner === 0 && !army.moved && tid !== this.sel && c.territories[this.sel].adj.includes(tid)) {
      moveArmy(c, army.id, tid);
      if (!c.pending) this.sel = tid; // marched into friendly land
      this.changed();
      return;
    }
    this.sel = tid;
    this.render();
  }

  private dialog(title: string, text: string, buttons: [string, () => void][]): void {
    const el = $('ow-dialog');
    el.innerHTML = `<div class="sheet small"><h1>${title}</h1><p class="lead">${text}</p><div class="levels"></div></div>`;
    const row = el.querySelector('.levels')!;
    for (const [label, fn] of buttons) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      row.appendChild(b);
    }
    el.classList.remove('hidden');
  }

  private askBattle(): void {
    const c = this.c, p = c.pending!;
    const t = c.territories[p.to];
    const attacking = p.attacker === 0;
    const foe = attacking ? p.defender : p.attacker;
    const foeName = foe < 0 ? LOCALS.name : c.factions[foe].name;
    const settle = () => {
      resolvePending(c, 'auto');
      if (c.phase === 'ai') continueAI(c);
      this.changed();
    };
    this.dialog(attacking ? `Attack ${t.name}?` : `${t.name} is under attack!`,
      attacking ? `Your strength of ${p.aStr} against ${foeName}'s defence of ${p.dStr}.` : `${foeName} marches with a strength of ${p.aStr} against your defence of ${p.dStr}.`,
      [['Fight the battle', () => this.hooks.fight()], ['Auto-resolve', settle],
        // An attack can still be called off; a defence cannot be declined.
        ...(attacking ? [['Call it off', () => { c.pending = null; this.changed(); }] as [string, () => void]] : [])]);
  }

  private askNew(): void {
    const el = $('ow-dialog');
    el.innerHTML = `<div class="sheet small"><h1>New campaign</h1><p class="lead">This replaces the campaign in progress.</p>
      <label class="mapsize">Rivals <select id="ow-rivals"><option>1</option><option selected>2</option><option>3</option></select></label>
      <label class="mapsize">Difficulty <select id="ow-level"><option value="0">Easy</option><option value="1" selected>Normal</option><option value="2">Hard</option></select></label>
      <div class="levels"><button id="ow-go">Begin</button><button id="ow-cancel">Cancel</button></div></div>`;
    el.classList.remove('hidden');
    $('ow-go').addEventListener('click', () => this.hooks.newCampaign(Number(($('ow-rivals') as HTMLSelectElement).value), Number(($('ow-level') as HTMLSelectElement).value)));
    $('ow-cancel').addEventListener('click', () => this.changed());
  }

  // ---- Drawing ----

  private render(): void {
    const c = this.c, ctx = this.ctx, cell = this.cell;
    const army = armyAt(c, this.sel);
    const canMarch = c.phase === 'player' && !!army && army.owner === 0 && !army.moved;
    const reach = new Set(canMarch ? c.territories[this.sel].adj : []);
    const img = ctx.createImageData(MAP_W, MAP_H);
    const tint = c.territories.map((t) => {
      const base = t.owner < 0 ? PAPER : rgb(c.factions[t.owner].color).map((v, i) => v * 0.5 + PAPER[i] * 0.5);
      const lift = t.id === this.sel ? 34 : reach.has(t.id) ? 16 : 0;
      return base.map((v) => Math.min(255, v + lift));
    });
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x, t = cell[i];
        const right = x + 2 < MAP_W ? cell[i + 2] : t, down = y + 2 < MAP_H ? cell[i + 2 * MAP_W] : t;
        const edge = right !== t || down !== t;
        const frontier = edge && (c.territories[right].owner !== c.territories[t].owner || c.territories[down].owner !== c.territories[t].owner);
        const grain = ((x * 7919 + y * 104729) % 13) - 6;
        const k = frontier ? 0.35 : edge ? 0.7 : 1;
        const o = i * 4;
        img.data[o] = tint[t][0] * k + grain;
        img.data[o + 1] = tint[t][1] * k + grain;
        img.data[o + 2] = tint[t][2] * k + grain;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    ctx.textAlign = 'center';
    for (const t of c.territories) {
      if (reach.has(t.id)) {
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = t.owner === 0 ? '#ffffff' : '#7a1c10';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 44, 0, 6.3);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.font = '600 16px Georgia, serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(245,235,205,0.85)';
      ctx.strokeText(t.name, t.x, t.y - 26);
      ctx.fillStyle = '#2a2014';
      ctx.fillText(t.name, t.x, t.y - 26);
      // A pip for each building slot, a mark on fortified land, and a star for a capital.
      const n0 = slots(t);
      for (let d = 0; d < n0; d++) {
        ctx.fillStyle = d < t.buildings.length ? '#3a2c18' : 'rgba(58,44,24,0.22)';
        ctx.fillRect(t.x - n0 * 6 + 1 + d * 12, t.y - 18, 9, 5);
      }
      if (t.buildings.includes('fortress')) { ctx.font = '17px serif'; ctx.fillText('🏰', t.x + 34, t.y - 10); }
      if (t.capital >= 0) { ctx.font = '20px serif'; ctx.fillStyle = '#f6d860'; ctx.strokeStyle = '#3a2c18'; ctx.lineWidth = 3; ctx.strokeText('★', t.x - 30, t.y - 9); ctx.fillText('★', t.x - 30, t.y - 9); }
      const a = armyAt(c, t.id);
      const n = a ? armySize(a) : t.owner < 0 ? t.militia : 0;
      if (!n) continue;
      const col = a ? c.factions[a.owner].color : LOCALS.color;
      ctx.globalAlpha = a && a.moved && c.phase === 'player' ? 0.6 : 1;
      ctx.beginPath();
      ctx.arc(t.x, t.y + 12, a ? 19 : 14, 0, 6.3);
      ctx.fillStyle = css(col);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = a ? '#fff8e0' : '#5a4a30';
      ctx.stroke();
      ctx.font = `700 ${a ? 18 : 14}px system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText(String(n), t.x, t.y + (a ? 18 : 17));
      if (a && a.hero) { ctx.font = '18px serif'; ctx.fillStyle = '#f6d860'; ctx.strokeStyle = '#3a2c18'; ctx.lineWidth = 3; ctx.strokeText('♛', t.x + 20, t.y + 4); ctx.fillText('♛', t.x + 20, t.y + 4); }
      ctx.globalAlpha = 1;
    }
    this.renderSide(canMarch);
  }

  private renderSide(canMarch: boolean): void {
    const c = this.c, me = c.factions[0];
    const t = c.territories[this.sel];
    const a = armyAt(c, this.sel);
    const owner = t.owner < 0 ? LOCALS : c.factions[t.owner];
    $('ow-status').innerHTML = `<b>Turn ${c.turn}</b> · Supplies <b>${me.supplies}</b> <small>(+${income(c, 0)} each turn)</small>` +
      '<div class="ow-factions">' + c.factions.map((f) => `<span style="color:${css(f.color)}${f.alive ? '' : ';text-decoration:line-through'}">■ ${f.name} ${c.territories.filter((x) => x.owner === f.id).length}</span>`).join('') + '</div>';
    const troops = (army: Army) => Object.entries(army.units).map(([k, n]) => `${COMPANIES[k].icon} ${n} ${COMPANIES[k].name.toLowerCase()}`).join(' · ') + (army.hero ? ' · ♛ Warlord' : '');
    $('ow-sel').innerHTML = `<h3>${t.name}${t.capital >= 0 ? ' ★' : ''}</h3>
      <div style="color:${css(owner.color)}">${owner.name}</div>
      <div>Income ${territoryIncome(t)} · Defence ${defence(c, t.id)}</div>
      <div>${t.buildings.map((b) => `${SITES[b].icon} ${SITES[b].name}`).join(' · ') || 'No buildings'} <small>(${t.buildings.length}/${slots(t)})</small></div>
      ${a ? `<div class="ow-army"><b>Army, strength ${armyStrength(a)}</b>${a.moved && a.owner === 0 ? ' <small>has moved</small>' : ''}<br>${troops(a)}</div>` : t.owner < 0 ? `<div>${t.militia} bands of local warriors</div>` : ''}
      <div class="hint">${canMarch ? 'Click a neighbouring territory to march there.' : t.owner === 0 ? '' : 'Select one of your armies to march on this land.'}</div>`;
    const btn = (act: string, label: string, cost: number, ok: boolean, tip = '') => `<button data-act="${act}" title="${tip}" ${ok && c.phase === 'player' ? '' : 'disabled'}>${label} <small>${cost}</small></button>`;
    let html = '';
    if (t.owner === 0) {
      for (const [k, d] of Object.entries(COMPANIES)) if (t.buildings.includes(d.needs)) html += btn('raise:' + k, `${d.icon} Raise ${d.name.toLowerCase()}`, d.cost, canRaise(c, 0, t.id, k), `Strength ${d.str}`);
      if (t.capital === 0 && !me.heroAlive) html += btn('hero', '♛ Summon a new Warlord', HERO_COST, canSummonHero(c, 0, t.id), 'Needs an army in your capital');
      if (t.buildings.length < slots(t)) for (const [k, d] of Object.entries(SITES)) if (!t.buildings.includes(k)) html += btn('build:' + k, `${d.icon} Build ${d.name}`, d.cost, canBuild(c, 0, t.id, k), d.desc);
    }
    $('ow-actions').innerHTML = html;
    ($('ow-end') as HTMLButtonElement).disabled = c.phase !== 'player' || !!c.pending;
    $('ow-log').innerHTML = c.log.slice(-7).reverse().map((l) => `<div>${l}</div>`).join('');
  }
}
