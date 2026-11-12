// Conquest map screen: draws the territories and lets the player run their turn.

import { CIVS, CIV_IDS } from '../sim/data';
import { LEADERS, Speech } from '../sim/leaders';
import { playLine, speechHtml } from './voice';
import {
  Army, CAMPAIGN_EDGE, COMPANIES, Campaign, LOCALS, TRUCE_COST, ALLIANCE_COST, DOMINION_TURNS, canAlly, offerAlliance, reach, reach as reachOf, SEA_LANDING, canGift, sendGift, GIFT_COST, MAX_FAVOR, dominionNeed, landOf, answerDemand, atTruce, heroCost, homeEdge, offerTruce, MAP_H, MAP_W, SITES, traitOf, MAX_VETERAN, armyAt, armySize, armyStrength, build, canBuild, canRaise,
  canSummonHero, continueAI, defence, endTurn, income, moveArmy, raise, resolvePending, slots, summonHero, territoryAt, battleConfig, territoryIncome, companyCost, siteCost, winChance, BEATS,
} from '../sim/campaign';

export interface OverworldHooks {
  save(): void;
  /** Leave for the real-time battle described by `campaign.pending`. */
  fight(): void;
  newCampaign(rivals: number, level: number, civ: string): void;
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
  private speaking: Speech | null = null;
  private speakT = 0;

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
      if (kind === 'truce') offerTruce(this.c, Number(id));
      if (kind === 'ally') offerAlliance(this.c, Number(id));
      if (kind === 'gift') sendGift(this.c, Number(id));
      this.changed();
    });
    $('ow-end').addEventListener('click', () => {
      endTurn(this.c);
      this.changed();
    });
    $('ow-exit').addEventListener('click', () => hooks.exit());
    $('ow-new').addEventListener('click', () => this.askNew());
    $('ow-speech').addEventListener('click', () => { this.speakT = 0; this.nextSpeech(); });
    $('overworld').classList.remove('hidden');
    this.changed();
  }

  /** Show the next thing a leader has said, once the last has had its moment. */
  private nextSpeech(): void {
    if (Date.now() < this.speakT) return;
    // An answer to something the player just did comes before any introductions still waiting.
    const q = this.c.speech;
    const at = Math.max(0, q.findIndex((x) => x.event !== 'intro'));
    const s = q.splice(at, 1)[0];
    if (!s) return;
    this.speaking = s;
    this.speakT = Date.now() + 4500;
    $('ow-speech').innerHTML = speechHtml(s);
    playLine(s);
    this.hooks.save();
    if (this.c.speech.length) setTimeout(() => this.nextSpeech(), 4600);
  }

  /** Something changed: save, redraw, and deal with any battle or ending that is now due. */
  private changed(): void {
    this.nextSpeech();
    this.hooks.save();
    this.render();
    const c = this.c;
    if (c.phase === 'over') {
      this.dialog(c.winner === 0 ? 'The land is yours' : 'Your people are conquered',
        c.winner === 0 ? (c.factions.filter((f) => f.alive).length > 1 ? `You hold most of the land and no one can challenge you. It took ${c.turn} turns.` : `Every rival has fallen. It took ${c.turn} turns.`) : `${c.factions[c.winner]?.name ?? 'Your rivals'} now rule the map.`,
        [['New campaign', () => this.askNew()], ['Main menu', () => this.hooks.exit()]]);
    } else if (c.demand) this.askDemand();
    else if (c.pending) this.askBattle();
    else $('ow-dialog').classList.add('hidden');
  }

  private click(tid: number): void {
    const c = this.c;
    if (c.phase !== 'player' || c.pending) return;
    const army = armyAt(c, this.sel);
    if (army && army.owner === 0 && !army.moved && tid !== this.sel && reach(c, this.sel).includes(tid)) {
      const march = () => {
        moveArmy(c, army.id, tid);
        if (!c.pending) this.sel = tid; // marched into friendly land
        this.changed();
      };
      const owner = c.territories[tid].owner;
      if (atTruce(c, 0, owner)) {
        this.dialog(`Break your ${c.ally === owner ? 'alliance' : 'truce'} with ${c.factions[owner].name}?`, `Marching on their land ends the ${c.ally === owner ? 'alliance' : 'truce'} at once. No rival will agree to another with an oathbreaker.`,
          [['March anyway', march], ['Keep the peace', () => this.changed()]]);
      } else march();
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
      (attacking ? `Your strength of ${p.aStr} against ${foeName}'s defence of ${p.dStr}.` : `${foeName} marches with a strength of ${p.aStr} against your defence of ${p.dStr}.`) +
        (p.sea ? ` ${attacking ? 'Your troops land' : 'They land'} from the sea, at ${Math.round(SEA_LANDING * 100)}% of their strength.` : '') +
        (battleConfig(c)!.setups.length > 2 ? ' Armies from neighbouring land will join the battle.' : '') + ' A field battle is the two armies alone and is over in minutes; a siege battle has towns to build and takes much longer.' + ` Auto-resolving, you would win about ${Math.round((attacking ? winChance(p.aStr, p.dStr, homeEdge(c, p.attacker)) : 1 - winChance(p.aStr, p.dStr, homeEdge(c, p.attacker))) * 100)} times in 100.`,
      [['Field battle', () => { p.mode = 'field'; this.hooks.fight(); }], ['Siege battle', () => { p.mode = 'siege'; this.hooks.fight(); }], ['Auto-resolve', settle],
        // An attack can still be called off; a defence cannot be declined.
        ...(attacking ? [['Call it off', () => { c.pending = null; this.changed(); }] as [string, () => void]] : [])]);
  }

  private askDemand(): void {
    const c = this.c, d = c.demand!;
    const fac = c.factions[d.from];
    const answer = (pay: boolean) => {
      answerDemand(c, pay);
      if (c.phase === 'ai') continueAI(c);
      this.changed();
    };
    const canPay = c.factions[0].supplies >= d.amount;
    this.dialog(`${LEADERS[fac.civ].name} demands tribute`,
      `${fac.name} want ${d.amount} supplies. Pay, and they will leave you alone for four turns. Refuse, and they will come for you at once if they think they can win.` + (canPay ? '' : ' You do not have enough to pay.'),
      [...(canPay ? [[`Pay ${d.amount} supplies`, () => answer(true)] as [string, () => void]] : []), ['Refuse', () => answer(false)]]);
  }

  private askNew(): void {
    const el = $('ow-dialog');
    el.innerHTML = `<div class="sheet small"><h1>New campaign</h1><p class="lead">A new world, new rivals. This replaces the campaign in progress.</p>
      <label class="mapsize">Rivals <select id="ow-rivals"><option>1</option><option selected>2</option><option>3</option></select></label>
      <label class="mapsize">Your people <select id="ow-civ"><option value="">Surprise me</option>${CIV_IDS.map((id) => `<option value="${id}">${CIVS[id].icon} ${CIVS[id].name}</option>`).join('')}</select></label>
      <label class="mapsize">Difficulty <select id="ow-level"><option value="0">Easy</option><option value="1" selected>Normal</option><option value="2">Hard</option></select></label>
      <div class="levels"><button id="ow-go">Begin</button><button id="ow-cancel">Cancel</button></div></div>`;
    el.classList.remove('hidden');
    $('ow-go').addEventListener('click', () => this.hooks.newCampaign(Number(($('ow-rivals') as HTMLSelectElement).value), Number(($('ow-level') as HTMLSelectElement).value), ($('ow-civ') as HTMLSelectElement).value));
    $('ow-cancel').addEventListener('click', () => this.changed());
    const edge = document.createElement('p');
    edge.className = 'lead';
    edge.style.fontSize = '13px';
    el.querySelector('.levels')!.before(edge);
    const civSel = $('ow-civ') as HTMLSelectElement;
    const show = () => { edge.textContent = civSel.value ? `${CIVS[civSel.value].name}: ${CAMPAIGN_EDGE[civSel.value]}` : ''; };
    civSel.addEventListener('change', show);
    show();
  }

  // ---- Drawing ----

  private render(): void {
    const c = this.c, ctx = this.ctx, cell = this.cell;
    const army = armyAt(c, this.sel);
    const canMarch = c.phase === 'player' && !!army && army.owner === 0 && !army.moved;
    const reach = new Set(canMarch ? reachOf(c, this.sel) : []);
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
      const marks = (t.buildings.includes('fortress') ? '🏰' : '') + (t.trait ? traitOf(t.trait)!.icon : '');
      if (marks) { ctx.font = '15px serif'; ctx.fillText(marks, t.x + 40, t.y - 10); }
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
      '<div class="ow-factions">' + c.factions.map((f) => `<span style="color:${css(f.color)}${f.alive ? '' : ';text-decoration:line-through'}">■ ${f.id === 0 ? CIVS[f.civ].name + ' (you)' : f.name} ${c.territories.filter((x) => x.owner === f.id).length}${f.isAI ? ` <small>${LEADERS[f.civ].name}${c.ally === f.id ? ' 🤝' : atTruce(c, 0, f.id) ? ' 🕊️' : ''}</small>` : ''}</span>`).join('') + '</div>' +
      `<div class="hint">${CIVS[me.civ].icon} ${CAMPAIGN_EDGE[me.civ]}</div>` +
      `<div class="hint">👑 Win by taking every land, or by holding ${dominionNeed(c)} of ${c.territories.length} for ${DOMINION_TURNS} turns <small>(you hold ${landOf(c, 0)})</small>.` +
      (c.dominion.f >= 0 ? ` <b class="${c.dominion.f === 0 ? 'good' : 'bad'}">${c.dominion.f === 0 ? 'You have' : c.factions[c.dominion.f].name + ' have'} held it for ${c.dominion.turns}.</b>` : '') + '</div>' +
      (c.request && c.ally >= 0 ? `<div class="hint">📣 ${c.factions[c.ally].name} ask you to take land from ${c.factions[c.request.foe].name} before turn ${c.request.until}.</div>` : '');
    const troops = (army: Army) => Object.entries(army.units).map(([k, n]) => `${COMPANIES[k].icon} ${n} ${COMPANIES[k].name.toLowerCase()}`).join(' · ') + (army.hero ? ' · ♛ Warlord' : '') + (army.vet ? ` · veterans ${'★'.repeat(army.vet)}${'☆'.repeat(MAX_VETERAN - army.vet)}` : '');
    $('ow-sel').innerHTML = `<h3>${t.name}${t.capital >= 0 ? ' ★' : ''}</h3>
      <div style="color:${css(owner.color)}">${owner.name}</div>
      <div>Income ${territoryIncome(t, t.owner >= 0 ? c.factions[t.owner].civ : '')} · Defence ${defence(c, t.id)}</div>
      ${t.trait ? `<div class="good">${traitOf(t.trait)!.icon} ${traitOf(t.trait)!.name}: ${traitOf(t.trait)!.desc}</div>` : ''}
      <div>${t.buildings.map((b) => `${SITES[b].icon} ${SITES[b].name}`).join(' · ') || 'No buildings'} <small>(${t.buildings.length}/${slots(t)})</small></div>
      ${a ? `<div class="ow-army"><b>Army, strength ${armyStrength(a)}</b>${a.moved && a.owner === 0 ? ' <small>has moved</small>' : ''}<br>${troops(a)}</div>` : t.owner < 0 ? `<div>${t.militia} bands of local warriors</div>` : ''}
      <div class="hint">${canMarch ? 'Click a neighbouring territory to march there.' : t.owner === 0 ? '' : 'Select one of your armies to march on this land.'}</div>`;
    const btn = (act: string, label: string, cost: number, ok: boolean, tip = '') => `<button data-act="${act}" title="${tip}" ${ok && c.phase === 'player' ? '' : 'disabled'}>${label} <small>${cost}</small></button>`;
    let html = '';
    if (t.owner === 0) {
      for (const [k, d] of Object.entries(COMPANIES)) if (t.buildings.includes(d.needs)) html += btn('raise:' + k, `${d.icon} Raise ${d.name.toLowerCase()}`, companyCost(t, k, me.civ), canRaise(c, 0, t.id, k), `Strength ${d.str}. Strong against ${BEATS[k]}.`);
      if (t.capital === 0 && !me.heroAlive) html += btn('hero', '♛ Summon a new Warlord', heroCost(me.civ), canSummonHero(c, 0, t.id), 'Needs an army in your capital');
      if (t.buildings.length < slots(t)) for (const [k, d] of Object.entries(SITES)) if (!t.buildings.includes(k) && (k !== 'harbour' || t.trait === 'coast')) html += btn('build:' + k, `${d.icon} Build ${d.name}`, siteCost(t, k, me.civ), canBuild(c, 0, t.id, k), d.desc);
    } else if (t.owner > 0 && c.factions[t.owner].alive) {
      const truce = c.truces.find((x) => x.with === t.owner);
      if (c.ally === t.owner) html += `<div class="hint">🤝 ${c.factions[t.owner].name} are your allies. Their armies next to a battle of yours fight in it, and yours in theirs.</div>`;
      else if (truce) {
        html += `<div class="hint">🕊️ At truce with ${c.factions[t.owner].name} until turn ${truce.until}.</div>`;
        if (c.ally < 0 && c.factions.filter((f) => f.alive).length >= 3) html += btn('ally:' + t.owner, `🤝 Offer ${LEADERS[c.factions[t.owner].civ].name} an alliance`, ALLIANCE_COST, canAlly(c, t.owner), c.honor < 0 ? 'They know you broke your word.' : 'Paid only if they accept. Lasts until one of you breaks it or only you two remain.');
      }
      else html += btn('truce:' + t.owner, `🕊️ Offer ${LEADERS[c.factions[t.owner].civ].name} a truce`, TRUCE_COST, me.supplies >= TRUCE_COST && c.factions[t.owner].refused !== c.turn, c.factions[t.owner].refused === c.turn ? 'They have given their answer for this turn.' : c.honor < 0 ? 'They know you broke your word.' : 'Paid only if they accept. Lasts six turns.');
    }
    if (t.owner > 0 && c.factions[t.owner].alive) {
      const fav = c.factions[t.owner].favor ?? 0;
      html += btn('gift:' + t.owner, `🎁 Send ${c.factions[t.owner].name} supplies`, GIFT_COST, canGift(c, t.owner), c.ally === t.owner ? 'Your ally can spend them on troops.' : 'Earns goodwill: they will be readier to agree to a truce or an alliance.');
      if (fav) html += `<div class="hint">Goodwill ${'●'.repeat(fav)}${'○'.repeat(MAX_FAVOR - fav)}</div>`;
    }
    $('ow-actions').innerHTML = html;
    ($('ow-end') as HTMLButtonElement).disabled = c.phase !== 'player' || !!c.pending || !!c.demand;
    $('ow-log').innerHTML = c.log.slice(-7).reverse().map((l) => `<div>${l}</div>`).join('');
  }
}
