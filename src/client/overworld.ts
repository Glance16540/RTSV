// Conquest map screen: draws the territories and lets the player run their turn.

import { creedOf } from '../sim/creed';
import { PLACES, WORLD_EVENTS } from '../sim/story';
import { AGES, CIVS, CIV_IDS, styleOf } from '../sim/data';
import { Speech, leaderOf } from '../sim/leaders';
import { playLine, speechHtml } from './voice';
import { WorldMap } from './worldmap';
import {
  EVENTS, WEATHER, eventsAt, frontsOf, weatherAt,
  Army, FAITH, faithOf, virtueOf, placeAt, placesOf, worldNow, taleNow, taleText, canAnswer, answerTale, hireOff, virtueDrift, BARRIERS, BIOMES, biomeOf, CAMPAIGN_EDGE, COMPANIES, Campaign, LOCALS, TRUCE_COST, ALLIANCE_COST, DOMINION_TURNS, canAlly, offerAlliance, ageCost, truceCost, giftCost, AGE_COST, AGE_EDGE, ageOf, canAdvance, advanceAge, reach, reach as reachOf, SEA_LANDING, canGift, sendGift, GIFT_COST, MAX_FAVOR, dominionNeed, landOf, answerDemand, atTruce, heroCost, homeEdge, offerTruce, MAP_H, MAP_W, SITES, traitOf, MAX_VETERAN, armyAt, armySize, armyStrength, build, canBuild, canRaise,
  canSummonHero, continueAI, defence, endTurn, income, moveArmy, raise, resolvePending, slots, summonHero, territoryAt, battleConfig, territoryIncome, companyCost, siteCost, winChance, BEATS,
  WORLD_SHAPES, worldOf, lanesOf, onSea,
} from '../sim/campaign';

export interface OverworldHooks {
  save(): void;
  /** Leave for the real-time battle described by `campaign.pending`. */
  fight(): void;
  newCampaign(rivals: number, level: number, civ: string): void;
  exit(): void;
}

const PAPER = [205, 186, 140];
let lastTicker = 0;
let lastMap: WorldMap | null = null;
const rgb = (c: number) => [c >> 16, (c >> 8) & 255, c & 255];
const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
const $ = (id: string) => document.getElementById(id)!;

export class Overworld {
  private ctx: CanvasRenderingContext2D;
  private cell: Uint8Array;
  /** How far each point of the map lies from the nearest border, in points, up to a limit. */
  private edge: Float32Array;
  /** The map as painted this turn, kept so the weather can be drawn over it again and again. */
  private sheet: HTMLCanvasElement;
  /** Where the signs for hills, woods, fields and sea are inked, worked out once from the lie of each land. */
  private glyphs: { kind: string; x: number; y: number; s: number }[] = [];
  private ticker = 0;
  /** The map in three dimensions, when the machine can draw it; otherwise the flat chart is shown. */
  private map3d: WorldMap | null = null;
  private sel: number;
  private speaking: Speech | null = null;
  private speakT = 0;

  constructor(private c: Campaign, private hooks: OverworldHooks) {
    const canvas = $('ow-canvas') as HTMLCanvasElement;
    this.ctx = canvas.getContext('2d')!;
    this.cell = new Uint8Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) this.cell[y * MAP_W + x] = territoryAt(c.territories, x, y);
    this.sel = c.territories.find((t) => t.capital === 0)?.id ?? 0;
    this.sheet = document.createElement('canvas');
    this.sheet.width = MAP_W; this.sheet.height = MAP_H;
    // Distance to the nearest border, by two sweeps over the map.
    const E = (this.edge = new Float32Array(MAP_W * MAP_H).fill(40)), cl = this.cell;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if ((x + 1 < MAP_W && cl[i + 1] !== cl[i]) || (y + 1 < MAP_H && cl[i + MAP_W] !== cl[i]) || (x > 0 && cl[i - 1] !== cl[i]) || (y > 0 && cl[i - MAP_W] !== cl[i])) E[i] = 0;
    }
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const i = y * MAP_W + x; if (x > 0) E[i] = Math.min(E[i], E[i - 1] + 1); if (y > 0) E[i] = Math.min(E[i], E[i - MAP_W] + 1); }
    for (let y = MAP_H - 1; y >= 0; y--) for (let x = MAP_W - 1; x >= 0; x--) { const i = y * MAP_W + x; if (x + 1 < MAP_W) E[i] = Math.min(E[i], E[i + 1] + 1); if (y + 1 < MAP_H) E[i] = Math.min(E[i], E[i + MAP_W] + 1); }
    // Each land gets the signs of its country, scattered clear of its name and its army.
    for (const t of c.territories) {
      let h = (t.seed * 2654435761) >>> 0;
      const r = (): number => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
      const north = t.y < MAP_H * 0.3;
      const kinds = t.trait === 'hills' ? ['peak', 'peak', 'peak', 'peak', 'peak', north ? 'fir' : 'tree'] : t.trait === 'gold' ? ['peak', 'peak', 'peak', 'ore', 'ore'] : t.trait === 'fertile' ? ['field', 'field', 'field', 'field', 'tree', 'tree'] : t.trait === 'horses' ? ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'tree'] : t.trait === 'coast' ? ['wave', 'wave', 'wave', 'wave', 'wave', 'tree'] : north ? ['fir', 'fir', 'fir', 'fir', 'fir', 'grass'] : ['tree', 'tree', 'tree', 'tree', 'grass', 'grass'];
      const placed: { x: number; y: number }[] = [];
      for (let k = 0, tries = 0; k < kinds.length * 2 && tries < 700; tries++) {
        const a = r() * 6.283, d = 46 + r() * 110, x = Math.round(t.x + Math.cos(a) * d), y = Math.round(t.y + Math.sin(a) * d * 0.8);
        if (x < 22 || y < 22 || x >= MAP_W - 22 || y >= MAP_H - 22 || (x > MAP_W - 110 && y > MAP_H - 110)) continue;
        const i = y * MAP_W + x;
        if (cl[i] !== t.id || E[i] < 11 || (Math.abs(x - t.x) < 62 && y > t.y - 46 && y < t.y + 40)) continue;
        if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 24)) continue;
        placed.push({ x, y });
        this.glyphs.push({ kind: kinds[k % kinds.length], x, y, s: 1.15 + r() * 0.45 });
        k++;
      }
    }
    this.glyphs.sort((p, q) => p.y - q.y);
    // The weather moves while the map is being looked at.
    window.clearInterval(lastTicker); // a map made earlier stops drawing
    lastMap?.dispose();
    lastMap = null;
    if (new URLSearchParams(location.search).get('map') !== '2d') {
      try {
        const host = canvas.parentElement!;
        this.map3d = lastMap = new WorldMap(host, c, this.cell, this.edge, (tid) => this.click(tid));
        host.classList.add('ow-3d');
        canvas.style.display = 'none';
      } catch { this.map3d = null; } // no 3D here: the flat chart will do
    }
    if (!this.map3d) { canvas.style.display = ''; canvas.parentElement!.classList.remove('ow-3d'); }
    lastTicker = this.ticker = window.setInterval(() => { if (!this.map3d && $('overworld').offsetParent !== null && !document.hidden) this.frame(); }, 90);

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
      if (kind === 'age') advanceAge(this.c, 0);
      this.changed();
    });
    $('ow-end').addEventListener('click', () => {
      endTurn(this.c);
      this.changed();
    });
    $('ow-exit').addEventListener('click', () => hooks.exit());
    $('ow-new').addEventListener('click', () => this.askNew());
    $('ow-chronicle').addEventListener('click', () => this.showChronicle());
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
    else if (c.tale && c.phase === 'player' && taleNow(c)) this.askTale();
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

  /** A tale is put to the player: two answers, the pious and the worldly, each with its price. */
  private askTale(): void {
    const c = this.c, tale = taleNow(c)!;
    const price = (k: 'a' | 'b') => {
      const ch = tale[k];
      const parts = [ch.supplies ? `${ch.supplies > 0 ? '+' : ''}${ch.supplies} supplies` : '', ch.virtue > 0 ? `piety +${ch.virtue}` : `decadence +${-ch.virtue}`, ch.company ? 'a company of infantry' : ''].filter(Boolean);
      return `${taleText(c, ch.label)} (${parts.join(', ')})`;
    };
    const answer = (k: 'a' | 'b') => { answerTale(c, k); this.changed(); };
    this.dialog(tale.title, taleText(c, tale.text) + (canAnswer(c, 'a') && canAnswer(c, 'b') ? '' : ' You have not the supplies for every answer.'),
      [...(['a', 'b'] as const).filter((k) => canAnswer(c, k)).map((k) => [price(k), () => answer(k)] as [string, () => void]),
        ['Let it settle itself', () => { c.tale = null; this.changed(); }]]);
  }

  /** The story so far, oldest first. */
  private showChronicle(): void {
    const c = this.c;
    const lines = (c.chronicle ?? []).map((l) => `<div><small>Turn ${l.turn}.</small> ${l.text}</div>`).join('');
    const places = placesOf(c).map((p) => { const t = c.territories[p.at]; return `<div>${PLACES[p.kind].icon} <b>${p.name[0].toUpperCase() + p.name.slice(1)}</b>, in ${t.name} <small>(${t.owner < 0 ? 'the local tribes' : t.owner === 0 ? 'yours' : c.factions[t.owner].name})</small>. ${p.legend}</div>`; }).join('');
    this.dialog('The chronicle', `<span class="ow-chronicle">${lines || 'Nothing is written yet.'}<h3>Places of note</h3>${places}</span>`, [['Close', () => this.changed()]]);
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
    this.dialog(`${leaderOf(fac.civ)!.name} demands tribute`,
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
    const c = this.c;
    const army = armyAt(c, this.sel);
    const canMarch = c.phase === 'player' && !!army && army.owner === 0 && !army.moved;
    const reach = new Set(canMarch ? reachOf(c, this.sel) : []);
    if (this.map3d) this.map3d.sync(c, this.sel, reach);
    else { this.paint(reach, false); this.frame(); }
    this.renderSide(canMarch);
  }

  /**
   * The map as it stands this turn, drawn once onto a sheet of its own: parchment, each people's land washed in
   * its colour along the borders, hills and woods and fields inked in, roads between neighbours, towns, armies as
   * standards, and a mark where something has happened. The weather is drawn over it afresh many times a second.
   */
  private paint(reach: Set<number>, bare = false): void {
    const c = this.c, ctx = this.sheet.getContext('2d')!, cell = this.cell, edge = this.edge;
    const img = ctx.createImageData(MAP_W, MAP_H);
    // Marauders' land is washed black.
    const wash = c.territories.map((t) => (t.owner < 0 ? (t.horde ? [34, 28, 26] : null) : rgb(c.factions[t.owner].color)));
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = y * MAP_W + x, t = cell[i], e = edge[i];
        // Old paper: mottled, grained, and browned toward the edges of the sheet.
        const blot = Math.sin(x * 0.011 + Math.sin(y * 0.017) * 2.1) * Math.cos(y * 0.013 + Math.sin(x * 0.009) * 1.7) * 9 + Math.sin(x * 0.045 + y * 0.031) * 3;
        const grain = ((x * 7919 + y * 104729) % 11) - 5;
        const rim = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y), burn = rim < 46 ? (1 - rim / 46) ** 2 * 46 : 0;
        let r = PAPER[0] + blot + grain - burn, g = PAPER[1] + blot + grain - burn * 1.05, b = PAPER[2] + blot * 0.8 + grain - burn * 1.1;
        // A people's colour, laid on like a wash: strong along its borders and thinning inland.
        const w = wash[t];
        if (w) { const a = 0.13 + 0.5 * Math.max(0, 1 - e / 20) + (t === this.sel ? 0.12 : 0); r += (w[0] - r) * a; g += (w[1] - g) * a; b += (w[2] - b) * a; }
        else if (t === this.sel) { r += 14; g += 14; b += 10; }
        if (reach.has(t)) { r += 12; g += 12; b += 8; }
        // Borders in ink: a firm line between peoples, a broken one between lands of the same people.
        if (e < 1.5) {
          const right = x + 1 < MAP_W ? cell[i + 1] : t, down = y + 1 < MAP_H ? cell[i + MAP_W] : t, left = x > 0 ? cell[i - 1] : t, up = y > 0 ? cell[i - MAP_W] : t;
          const o = c.territories[t].owner, frontier = [right, down, left, up].some((n) => c.territories[n].owner !== o);
          const k = frontier ? 0.38 : ((x + y) % 7 < 4 ? 0.72 : 1);
          r *= k; g *= k; b *= k;
        }
        const p = i * 4;
        img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const INK = '#3a2a16';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Roads between neighbouring lands: a dotted track from one to the next.
    ctx.strokeStyle = 'rgba(90,60,30,0.5)'; ctx.lineWidth = 1.6; ctx.setLineDash([2, 6]);
    for (const t of c.territories) for (const n of t.adj) if (n > t.id) {
      const u = c.territories[n], mx = (t.x + u.x) / 2 + (t.y - u.y) * 0.08, my = (t.y + u.y) / 2 + (u.x - t.x) * 0.08;
      ctx.beginPath(); ctx.moveTo(t.x + (u.x - t.x) * 0.24, t.y + 10 + (u.y - t.y) * 0.24); ctx.quadraticCurveTo(mx, my + 10, u.x + (t.x - u.x) * 0.24, u.y + 10 + (t.y - u.y) * 0.24); ctx.stroke();
    }
    ctx.setLineDash([]);

    // The lie of the land, inked in: mountains, woods, fields, grass, waves.
    // In three dimensions the mountains, woods and sea are really there; only what lies flat is painted.
    for (const g of this.glyphs) if (!bare || g.kind === 'field' || g.kind === 'grass' || g.kind === 'ore') this.glyph(ctx, g.kind, g.x, g.y, g.s * (bare ? 1.3 : 1));
    if (bare) return;

    // The sheet's own furniture: a ruled frame, a compass rose, and the year.
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(7, 7, MAP_W - 14, MAP_H - 14);
    ctx.lineWidth = 1; ctx.strokeRect(13, 13, MAP_W - 26, MAP_H - 26);
    this.compass(ctx, MAP_W - 62, MAP_H - 62, 30);
    ctx.textAlign = 'center';

    for (const t of c.territories) {
      if (reach.has(t.id)) {
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = t.owner === 0 ? '#fff8e0' : '#7a1c10';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(t.x, t.y, 44, 0, 6.3); ctx.stroke();
        ctx.setLineDash([]);
      }
      // The name, lettered as on an old chart.
      ctx.font = `italic 600 ${t.capital >= 0 ? 17 : 15}px Georgia, 'Times New Roman', serif`;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(236,222,186,0.9)';
      const name = t.capital >= 0 ? t.name.toUpperCase() : t.name;
      ctx.strokeText(name, t.x, t.y - 27);
      ctx.fillStyle = '#2a1c0c'; ctx.fillText(name, t.x, t.y - 27);
      // A pip for each building slot.
      const n0 = slots(t);
      for (let d = 0; d < n0; d++) {
        ctx.fillStyle = d < t.buildings.length ? '#3a2c18' : 'rgba(58,44,24,0.22)';
        ctx.fillRect(t.x - n0 * 6 + 1 + d * 12, t.y - 19, 9, 4);
      }
      // A town for a capital, a keep where the land is fortified, an anchor at a harbour.
      if (t.capital >= 0) this.town(ctx, t.x - 46, t.y + 30, css(c.factions[t.capital].color), true);
      else if (t.buildings.includes('fortress')) this.town(ctx, t.x - 40, t.y + 26, t.owner >= 0 ? css(c.factions[t.owner].color) : '#8a7a5a', false);
      if (t.capital >= 0 && t.buildings.includes('fortress')) { ctx.font = '13px serif'; ctx.fillText('🏰', t.x - 46, t.y + 46); }
      if (t.buildings.includes('harbour')) { ctx.font = '15px serif'; ctx.fillText('⚓', t.x + 40, t.y - 8); }
      // Weather over it, and anything that has happened here, each on its own small seal.
      const seals: [string, string][] = [];
      const sky = weatherAt(c, t.id);
      if (sky) seals.push([WEATHER[sky].icon, '#dfe6ee']);
      const place = placeAt(c, t.id);
      if (place) seals.push([PLACES[place.kind].icon, '#e6dcc0']);
      for (const e of eventsAt(c, t.id).slice(0, 2)) seals.push([EVENTS[e.kind].icon, e.kind === 'unrest' || e.kind === 'revolt' || e.kind === 'fever' || e.kind === 'raiders' || e.kind === 'hard' || e.kind === 'horde' || e.kind === 'taken' || e.kind === 'overrun' ? '#e8c0b0' : '#f0e2a8']);
      seals.forEach(([icon, paper], k) => {
        const sx = t.x + 40 + (k % 2) * 4, sy = t.y + 12 + k * 24;
        ctx.beginPath(); ctx.arc(sx, sy, 12, 0, 6.3); ctx.fillStyle = paper; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.font = '14px serif'; ctx.fillStyle = '#000'; ctx.fillText(icon, sx, sy + 5);
      });
      const a = armyAt(c, t.id);
      const n = a ? armySize(a) : t.owner < 0 ? t.militia : 0;
      if (!n) continue;
      ctx.globalAlpha = a && a.moved && c.phase === 'player' ? 0.6 : 1;
      this.standard(ctx, t.x, t.y + 12, css(a ? c.factions[a.owner].color : LOCALS.color), n, !!a, !!a?.hero);
      ctx.globalAlpha = 1;
    }
    // The year, on a scroll at the head of the sheet.
    ctx.font = "italic 600 15px Georgia, 'Times New Roman', serif";
    const label = `Turn ${c.turn}`;
    const lw = ctx.measureText(label).width + 26;
    ctx.fillStyle = 'rgba(232,216,176,0.92)'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(24, 22, lw, 26, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1c0c'; ctx.textAlign = 'left'; ctx.fillText(label, 37, 40); ctx.textAlign = 'center';
  }

  /** One frame of the map: the sheet as painted, with the weather moving over it and the live events beating. */
  private frame(): void {
    const c = this.c, ctx = this.ctx, now = performance.now() / 1000;
    ctx.drawImage(this.sheet, 0, 0);
    // What is still to be decided draws the eye: a ring that swells and fades.
    for (const e of c.events ?? []) {
      if (e.until < c.turn || (e.kind !== 'unrest' && e.kind !== 'hoard')) continue;
      const t = c.territories[e.at], k = (now * 0.7) % 1;
      ctx.beginPath(); ctx.arc(t.x, t.y + 4, 30 + k * 26, 0, 6.3);
      ctx.strokeStyle = e.kind === 'unrest' ? `rgba(150,30,20,${0.7 * (1 - k)})` : `rgba(190,140,20,${0.75 * (1 - k)})`;
      ctx.lineWidth = 3; ctx.stroke();
    }
    for (const [i, f] of frontsOf(c).entries()) {
      const drift = Math.sin(now * 0.25 + i * 2.1) * 6, cx = f.x + drift, cy = f.y + Math.cos(now * 0.2 + i) * 3;
      // What falls from it, over the land it covers.
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, f.r, 0, 6.3); ctx.clip();
      const n = Math.round(f.r * 0.9);
      for (let k = 0; k < n; k++) {
        const h1 = ((k * 7919 + i * 131) % 1000) / 1000, h2 = ((k * 104729 + i * 977) % 1000) / 1000;
        const px = cx - f.r + h1 * f.r * 2;
        if (f.kind === 'rain') {
          const py = cy - f.r + ((h2 + now * 1.3) % 1) * f.r * 2;
          ctx.strokeStyle = 'rgba(60,80,120,0.5)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 3, py + 9); ctx.stroke();
        } else if (f.kind === 'snow') {
          const py = cy - f.r + ((h2 + now * 0.22) % 1) * f.r * 2;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.beginPath(); ctx.arc(px + Math.sin(now * 1.5 + k) * 3, py, 1.6, 0, 6.3); ctx.fill();
        } else {
          const qx = cx - f.r + ((h1 + now * 0.35) % 1) * f.r * 2, py = cy - f.r + h2 * f.r * 2;
          ctx.strokeStyle = 'rgba(150,110,60,0.45)'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(qx, py); ctx.quadraticCurveTo(qx + 9, py - 3, qx + 18, py); ctx.stroke();
        }
      }
      ctx.restore();
      // The cloud itself: a bank of soft lobes, with its shadow on the land.
      const tone = f.kind === 'rain' ? [120, 130, 150] : f.kind === 'snow' ? [236, 240, 246] : [176, 140, 92];
      for (let k = 0; k < 9; k++) {
        const a = k * 0.7 + i, rx = cx + Math.cos(a) * f.r * 0.5 * ((k % 3) / 2.4 + 0.25), ry = cy + Math.sin(a * 1.3) * f.r * 0.32 - f.r * 0.1, rr = f.r * (0.34 + (k % 4) * 0.07);
        const gr = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
        gr.addColorStop(0, `rgba(${tone[0]},${tone[1]},${tone[2]},0.24)`); gr.addColorStop(1, `rgba(${tone[0]},${tone[1]},${tone[2]},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 6.3); ctx.fill();
      }
    }
  }

  /** A small inked sign for a kind of country. */
  private glyph(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, s: number): void {
    const INK = '#3a2a16';
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    if (kind === 'peak') {
      // A mountain: lit on one side, hatched on the other, snow on its head.
      ctx.beginPath(); ctx.moveTo(x - 11 * s, y + 8 * s); ctx.lineTo(x, y - 10 * s); ctx.lineTo(x + 11 * s, y + 8 * s); ctx.closePath();
      ctx.fillStyle = 'rgba(214,196,150,0.95)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y - 10 * s); ctx.lineTo(x + 11 * s, y + 8 * s); ctx.lineTo(x + 2 * s, y + 8 * s); ctx.lineTo(x + 3 * s, y - 1 * s); ctx.closePath();
      ctx.fillStyle = 'rgba(96,72,44,0.55)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 11 * s, y + 8 * s); ctx.lineTo(x, y - 10 * s); ctx.lineTo(x + 11 * s, y + 8 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3.2 * s, y - 4.5 * s); ctx.lineTo(x, y - 10 * s); ctx.lineTo(x + 3.2 * s, y - 4.5 * s); ctx.lineTo(x + 1 * s, y - 6 * s); ctx.lineTo(x - 1 * s, y - 4 * s); ctx.closePath();
      ctx.fillStyle = 'rgba(250,248,240,0.95)'; ctx.fill();
    } else if (kind === 'tree') {
      ctx.beginPath(); ctx.moveTo(x, y + 6 * s); ctx.lineTo(x, y + 1 * s); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - 2 * s, 4.6 * s, 0, 6.3); ctx.fillStyle = 'rgba(96,116,60,0.85)'; ctx.fill(); ctx.stroke();
    } else if (kind === 'fir') {
      ctx.beginPath(); ctx.moveTo(x, y - 8 * s); ctx.lineTo(x + 4.5 * s, y + 4 * s); ctx.lineTo(x - 4.5 * s, y + 4 * s); ctx.closePath();
      ctx.fillStyle = 'rgba(70,98,62,0.88)'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + 4 * s); ctx.lineTo(x, y + 7 * s); ctx.stroke();
    } else if (kind === 'field') {
      // A ploughed strip: a slanted patch with its furrows.
      ctx.beginPath(); ctx.moveTo(x - 9 * s, y + 4 * s); ctx.lineTo(x - 5 * s, y - 4 * s); ctx.lineTo(x + 9 * s, y - 4 * s); ctx.lineTo(x + 5 * s, y + 4 * s); ctx.closePath();
      ctx.fillStyle = 'rgba(206,176,86,0.75)'; ctx.fill(); ctx.stroke();
      ctx.lineWidth = 0.8;
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x - 7 * s + k * 4.5 * s + 2 * s, y + 4 * s); ctx.lineTo(x - 3 * s + k * 4.5 * s + 2 * s, y - 4 * s); ctx.stroke(); }
    } else if (kind === 'grass') {
      for (const d of [-3, 0, 3]) { ctx.beginPath(); ctx.moveTo(x + d * s, y + 3 * s); ctx.quadraticCurveTo(x + d * s * 1.2, y - 1 * s, x + d * s * 1.9, y - 4 * s); ctx.stroke(); }
    } else if (kind === 'wave') {
      ctx.strokeStyle = 'rgba(40,80,120,0.75)';
      ctx.beginPath(); ctx.moveTo(x - 9 * s, y); ctx.quadraticCurveTo(x - 4.5 * s, y - 5 * s, x, y); ctx.quadraticCurveTo(x + 4.5 * s, y + 5 * s, x + 9 * s, y); ctx.stroke();
    } else if (kind === 'ore') {
      ctx.fillStyle = '#d8a020';
      for (const [dx, dy] of [[-3, 1], [2, -2], [3, 3]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 2.1 * s, 0, 6.3); ctx.fill(); ctx.stroke(); }
    }
  }

  /** A walled town with a banner (a capital), or a single keep (fortified land). */
  private town(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, great: boolean): void {
    ctx.strokeStyle = '#3a2a16'; ctx.lineWidth = 1.4; ctx.fillStyle = '#e4d6b0';
    const tower = (tx: number, w: number, h: number): void => {
      ctx.beginPath(); ctx.rect(tx - w / 2, y - h, w, h); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx - w / 2 - 1.5, y - h); ctx.lineTo(tx, y - h - w * 0.9); ctx.lineTo(tx + w / 2 + 1.5, y - h); ctx.closePath();
      ctx.fillStyle = '#9a4a34'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e4d6b0';
    };
    if (great) {
      ctx.beginPath(); ctx.rect(x - 11, y - 8, 22, 8); ctx.fill(); ctx.stroke();
      tower(x - 11, 7, 13); tower(x + 11, 7, 13); tower(x, 9, 18);
      ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x, y - 36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(x + 10, y - 33); ctx.lineTo(x, y - 30); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    } else tower(x, 9, 14);
  }

  /** An army on the map: a standard on a pole over a shield that carries its numbers. */
  private standard(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, n: number, army: boolean, hero: boolean): void {
    const w = army ? 15 : 11, h = army ? 19 : 14;
    ctx.strokeStyle = '#2a1c0c'; ctx.lineWidth = 2;
    if (army) {
      ctx.beginPath(); ctx.moveTo(x + w - 2, y + 6); ctx.lineTo(x + w - 2, y - 30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w - 2, y - 30); ctx.lineTo(x + w + 16, y - 26); ctx.lineTo(x + w + 9, y - 22); ctx.lineTo(x + w + 16, y - 18); ctx.lineTo(x + w - 2, y - 16); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
    }
    // The shield: flat at the head, drawn to a point below.
    ctx.beginPath(); ctx.moveTo(x - w, y - h * 0.6); ctx.lineTo(x + w, y - h * 0.6); ctx.lineTo(x + w, y + h * 0.1); ctx.quadraticCurveTo(x + w * 0.9, y + h * 0.75, x, y + h); ctx.quadraticCurveTo(x - w * 0.9, y + h * 0.75, x - w, y + h * 0.1); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = army ? '#fff4d8' : '#5a4a30'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#2a1c0c'; ctx.stroke();
    ctx.font = `700 ${army ? 17 : 13}px Georgia, serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.strokeText(String(n), x, y + (army ? 7 : 5));
    ctx.fillStyle = '#fff'; ctx.fillText(String(n), x, y + (army ? 7 : 5));
    if (hero) { ctx.font = '17px serif'; ctx.fillStyle = '#f6d860'; ctx.strokeStyle = '#3a2c18'; ctx.lineWidth = 3; ctx.strokeText('♛', x - w - 6, y - 8); ctx.fillText('♛', x - w - 6, y - 8); }
  }

  /** A compass rose. */
  private compass(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#3a2a16'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 6.3); ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, len = k % 2 ? r * 0.55 : r, wd = k % 2 ? r * 0.1 : r * 0.16;
      ctx.beginPath(); ctx.moveTo(Math.sin(a) * len, -Math.cos(a) * len); ctx.lineTo(Math.cos(a) * wd, Math.sin(a) * wd); ctx.lineTo(-Math.cos(a) * wd, -Math.sin(a) * wd); ctx.closePath();
      ctx.fillStyle = k === 0 ? '#8a2a1a' : k % 2 ? '#c8b488' : '#3a2a16'; ctx.fill(); ctx.stroke();
    }
    ctx.font = "600 13px Georgia, serif"; ctx.fillStyle = '#2a1c0c'; ctx.textAlign = 'center'; ctx.fillText('N', 0, -r - 5);
    ctx.restore();
  }

  private renderSide(canMarch: boolean): void {
    const c = this.c, me = c.factions[0];
    const t = c.territories[this.sel];
    const a = armyAt(c, this.sel);
    const owner = t.owner < 0 ? LOCALS : c.factions[t.owner];
    $('ow-status').innerHTML = `<b>Turn ${c.turn}</b> · Supplies <b>${me.supplies}</b> <small>(+${income(c, 0)} each turn)</small>` +
      '<div class="ow-factions">' + c.factions.map((f) => `<span style="color:${css(f.color)}${f.alive ? '' : ';text-decoration:line-through'}">■ ${f.id === 0 ? CIVS[f.civ].name + ' (you)' : f.name} ${c.territories.filter((x) => x.owner === f.id).length}${ageOf(c, f.id) ? ` <small>${AGES[ageOf(c, f.id)].name}</small>` : ''}${f.alive && creedOf(virtueOf(c, f.id)).id !== 'temperate' ? ` <small title="${creedOf(virtueOf(c, f.id)).name}. ${FAITH[creedOf(virtueOf(c, f.id)).id].desc}">${creedOf(virtueOf(c, f.id)).icon}</small>` : ''}${f.isAI ? ` <small>${leaderOf(f.civ)!.name}${c.ally === f.id ? ' 🤝' : atTruce(c, 0, f.id) ? ' 🕊️' : ''}</small>` : ''}</span>`).join('') + '</div>' +
      `<div class="hint">${CIVS[me.civ].icon} ${CAMPAIGN_EDGE[me.civ]}</div>` +
      `<div class="hint">${creedOf(virtueOf(c, 0)).icon} Your people are <b>${creedOf(virtueOf(c, 0)).name}</b> <small>(${virtueOf(c, 0) > 0 ? 'piety ' + virtueOf(c, 0) : virtueOf(c, 0) < 0 ? 'decadence ' + -virtueOf(c, 0) : 'in the middle'}${virtueDrift(c, 0) ? `, ${virtueDrift(c, 0) > 0 ? 'growing more pious' : 'growing more decadent'} by ${Math.abs(virtueDrift(c, 0))} a turn` : ''})</small>. ${FAITH[creedOf(virtueOf(c, 0)).id].desc} Your towns begin each battle as they stand here.</div>` +
      (worldNow(c) ? `<div class="hint">${WORLD_EVENTS[worldNow(c) as keyof typeof WORLD_EVENTS].icon} <b>${WORLD_EVENTS[worldNow(c) as keyof typeof WORLD_EVENTS].name}.</b> ${WORLD_EVENTS[worldNow(c) as keyof typeof WORLD_EVENTS].desc} <small>(${c.world!.until - c.turn + 1} turns left)</small></div>` : '') +
      `<div class="hint">🌍 ${WORLD_SHAPES[worldOf(c.seed).shape]}; ${worldOf(c.seed).temper}.</div>` +
      `<div class="hint">👑 Win by taking every land, or by holding ${dominionNeed(c)} of ${c.territories.length} for ${DOMINION_TURNS} turns <small>(you hold ${landOf(c, 0)})</small>.` +
      (c.dominion.f >= 0 ? ` <b class="${c.dominion.f === 0 ? 'good' : 'bad'}">${c.dominion.f === 0 ? 'You have' : c.factions[c.dominion.f].name + ' have'} held it for ${c.dominion.turns}.</b>` : '') + '</div>' +
      (c.request && c.ally >= 0 ? `<div class="hint">📣 ${c.factions[c.ally].name} ask you to take land from ${c.factions[c.request.foe].name} before turn ${c.request.until}.</div>` : '');
    const troops = (army: Army) => Object.entries(army.units).map(([k, n]) => `${COMPANIES[k].icon} ${n} ${COMPANIES[k].name.toLowerCase()}`).join(' · ') + (army.hero ? ' · ♛ Warlord' : '') + (army.vet ? ` · veterans ${'★'.repeat(army.vet)}${'☆'.repeat(MAX_VETERAN - army.vet)}` : '');
    $('ow-sel').innerHTML = `<h3>${t.name}${t.capital >= 0 ? ' ★' : ''}</h3>
      <div style="color:${css(owner.color)}">${owner.name}</div>
      <div>Income ${territoryIncome(t, t.owner >= 0 ? c.factions[t.owner].civ : '') + (t.owner >= 0 && t.buildings.includes('tavern') ? faithOf(c, t.owner).tavern : 0)} · Defence ${defence(c, t.id)}</div>
      <div class="hint">${BIOMES[biomeOf(c, t.id)].icon} ${BIOMES[biomeOf(c, t.id)].name}: ${BIOMES[biomeOf(c, t.id)].desc}</div>
      ${lanesOf(c, t.id).map((n) => `<div class="hint">⛵ Sea crossing to ${c.territories[n].name}${t.buildings.includes('harbour') ? '' : t.owner === 0 ? ': build a Harbour here to make it' : ': made from a Harbour'}.</div>`).join('')}
      ${(c.barriers ?? []).filter((w) => w.a === t.id || w.b === t.id).map((w) => `<div class="hint">${BARRIERS[w.kind].icon} No march to ${c.territories[w.a === t.id ? w.b : w.a].name}: ${BARRIERS[w.kind].by} lie${w.kind === 'mountains' ? '' : 's'} between.</div>`).join('')}
      ${t.trait ? `<div class="good">${traitOf(t.trait)!.icon} ${traitOf(t.trait)!.name}: ${traitOf(t.trait)!.desc}</div>` : ''}
      ${placeAt(c, t.id) ? `<div class="hint">${PLACES[placeAt(c, t.id)!.kind].icon} <b>${placeAt(c, t.id)!.name[0].toUpperCase() + placeAt(c, t.id)!.name.slice(1)}.</b> ${placeAt(c, t.id)!.legend} <i>${PLACES[placeAt(c, t.id)!.kind].desc}</i></div>` : ''}
      ${t.horde && t.owner < 0 ? `<div class="bad">🏴 <b>Marauders hold this land.</b> ${EVENTS.horde.desc}</div>` : ''}
      ${t.taken ? `<div class="bad">⛓️ Women carried off from here: ${t.taken} supply less each turn until the marauders' camp next door is broken.</div>` : ''}
      ${weatherAt(c, t.id) ? `<div class="bad">${WEATHER[weatherAt(c, t.id) as 'rain'].icon} ${WEATHER[weatherAt(c, t.id) as 'rain'].name}: ${WEATHER[weatherAt(c, t.id) as 'rain'].desc}</div>` : ''}
      ${eventsAt(c, t.id).map((e) => `<div class="hint">${EVENTS[e.kind].icon} <b>${EVENTS[e.kind].name}</b>${e.until > c.turn ? ` <small>(${e.until - c.turn + 1} turns left)</small>` : e.kind === 'unrest' || e.kind === 'hoard' ? ' <small>(comes to a head next turn)</small>' : ''}: ${EVENTS[e.kind].desc}</div>`).join('')}
      ${t.trait === 'coast' && t.owner === 0 && c.territories.some((x) => x.owner > 0 && x.buildings.includes('harbour') && !atTruce(c, 0, x.owner)) ? `<div class="bad">⚓ Within reach of ${[...new Set(c.territories.filter((x) => x.owner > 0 && x.buildings.includes('harbour') && !atTruce(c, 0, x.owner)).map((x) => c.factions[x.owner].name))].join(' and ')} by sea.</div>` : ''}
      <div>${t.buildings.map((b) => `${SITES[b].icon} ${SITES[b].name}`).join(' · ') || 'No buildings'} <small>(${t.buildings.length}/${slots(t)})</small></div>
      ${t.town?.b.length ? `<div class="hint">🏘️ A town of ${t.town.b.length} building${t.town.b.length > 1 ? 's' : ''} stands on this ground from the last battle${t.town.b.some((b) => b[3] !== undefined && b[4] === undefined) ? `, ${t.town.b.filter((b) => b[3] !== undefined && b[4] === undefined).length} of them damaged and being mended, a tenth each turn` : ''}${t.town.b.some((b) => b[4] !== undefined) ? `, ${t.town.b.filter((b) => b[4] !== undefined).length} left unfinished` : ''}${t.owner >= 0 && !styleOf(c.factions[t.owner].civ).raid && !t.town.b.some((b) => b[0] === 'towncenter') ? '. Its Town Center was razed and has not been raised again' : ''}. Whoever holds the land fights from it as it stands.</div>` : t.owner === 0 && t.buildings.some((b) => b !== 'fortress') ? '<div class="hint">🏘️ What is built here stands in the town when this land is fought over, and what you build in a siege you win stays.</div>' : ''}
      ${t.ground && t.ground.gone.length + t.ground.left.length ? '<div class="hint">🪓 This ground has been worked: wood felled, berries picked or stone dug. None of it comes back.</div>' : ''}
      ${a ? `<div class="ow-army"><b>Army, strength ${armyStrength(a)}</b>${a.moved && a.owner === 0 ? ' <small>has moved</small>' : ''}<br>${troops(a)}</div>` : t.owner < 0 ? `<div>${t.militia} bands of local warriors</div>` : ''}
      <div class="hint">${canMarch ? 'Click a neighbouring territory to march there.' : t.owner === 0 ? '' : 'Select one of your armies to march on this land.'}</div>`;
    const btn = (act: string, label: string, cost: number, ok: boolean, tip = '') => `<button data-act="${act}" title="${tip}" ${ok && c.phase === 'player' ? '' : 'disabled'}>${label} <small>${cost}</small></button>`;
    let html = '';
    if (t.owner === 0) {
      for (const [k, d] of Object.entries(COMPANIES)) if (t.buildings.includes(d.needs)) html += btn('raise:' + k, `${d.icon} Raise ${d.name.toLowerCase()}`, companyCost(t, k, me.civ, hireOff(c, 0, t.id)), canRaise(c, 0, t.id, k), `Strength ${d.str}. Strong against ${BEATS[k]}.`);
      if (ageOf(c, 0) < AGE_COST.length) html += btn('age', `⏳ Advance to the ${AGES[ageOf(c, 0) + 1].name}`, ageCost(c, 0), canAdvance(c, 0), `All your armies grow ${Math.round(AGE_EDGE * 100)}% stronger, and your battles begin in that age with its weapons.`);
      if (t.capital === 0 && !me.heroAlive) html += btn('hero', '♛ Summon a new Warlord', heroCost(me.civ), canSummonHero(c, 0, t.id), 'Needs an army in your capital');
      if (t.buildings.length < slots(t)) for (const [k, d] of Object.entries(SITES)) if (!t.buildings.includes(k) && (k !== 'harbour' || onSea(c, t.id))) html += btn('build:' + k, `${d.icon} Build ${d.name}`, siteCost(t, k, me.civ), canBuild(c, 0, t.id, k), d.desc);
    } else if (t.owner > 0 && c.factions[t.owner].alive) {
      const truce = c.truces.find((x) => x.with === t.owner);
      if (c.ally === t.owner) html += `<div class="hint">🤝 ${c.factions[t.owner].name} are your allies. Their armies next to a battle of yours fight in it, and yours in theirs.</div>`;
      else if (truce) {
        html += `<div class="hint">🕊️ At truce with ${c.factions[t.owner].name} until turn ${truce.until}.</div>`;
        if (c.ally < 0 && c.factions.filter((f) => f.alive).length >= 3) html += btn('ally:' + t.owner, `🤝 Offer ${leaderOf(c.factions[t.owner].civ)!.name} an alliance`, ALLIANCE_COST, canAlly(c, t.owner), c.honor < 0 ? 'They know you broke your word.' : 'Paid only if they accept. Lasts until one of you breaks it or only you two remain.');
      }
      else html += btn('truce:' + t.owner, `🕊️ Offer ${leaderOf(c.factions[t.owner].civ)!.name} a truce`, truceCost(me.civ), me.supplies >= truceCost(me.civ) && c.factions[t.owner].refused !== c.turn, c.factions[t.owner].refused === c.turn ? 'They have given their answer for this turn.' : c.honor < 0 ? 'They know you broke your word.' : 'Paid only if they accept. Lasts six turns.');
    }
    if (t.owner > 0 && c.factions[t.owner].alive) {
      const fav = c.factions[t.owner].favor ?? 0;
      html += btn('gift:' + t.owner, `🎁 Send ${c.factions[t.owner].name} supplies`, giftCost(me.civ), canGift(c, t.owner), c.ally === t.owner ? 'Your ally can spend them on troops.' : 'Earns goodwill: they will be readier to agree to a truce or an alliance.');
      if (fav) html += `<div class="hint">Goodwill ${'●'.repeat(fav)}${'○'.repeat(MAX_FAVOR - fav)}</div>`;
    }
    $('ow-actions').innerHTML = html;
    ($('ow-end') as HTMLButtonElement).disabled = c.phase !== 'player' || !!c.pending || !!c.demand;
    $('ow-log').innerHTML = c.log.slice(-7).reverse().map((l) => `<div>${l}</div>`).join('');
  }
}
