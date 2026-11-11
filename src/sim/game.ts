// Core simulation. No rendering or DOM access in here so it can run headless.

import {
  AGES, BIRTH_COST, BIRTH_TIME, BUILDINGS, BuildingDef, Cost, GATHER_RATE, MORALE_MAX_HOUSES,
  MORALE_PER_HOUSE, MORALE_RADIUS, Mods, POP_LIMIT, RESOURCE_AMOUNT, RESOURCE_KIND, RES_TYPES,
  ResType, TECHS, UNITS, UnitDef, ArmorClass, baseMods,
} from './data';
import { generateMap, MapSpec, mulberry32, NodeType, T_WATER } from './map';
import { Pathfinder, rectDist } from './path';

export const DT = 1 / 20;
const HASH = 4; // spatial hash bucket size in tiles
const REACH = 0.8; // interaction distance for gathering / building

export type Gender = 'm' | 'f';

interface Base {
  id: number;
  type: string;
  owner: number; // -1 for neutral
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead: boolean;
}

export type Order =
  | { t: 'move'; x: number; y: number; started?: boolean; tries?: number }
  | { t: 'attackMove'; x: number; y: number; started?: boolean; tries?: number }
  | { t: 'attack'; id: number; then?: Order | null; auto?: boolean; ox?: number; oy?: number }
  | { t: 'gather'; id: number; res: ResType; phase: 'go' | 'return'; nx: number; ny: number; dropId: number; fails: number }
  | { t: 'build'; id: number; then?: Order | null }
  | { t: 'movein'; id: number; then?: Order | null };

export interface Unit extends Base {
  kind: 'unit';
  def: UnitDef;
  px: number; // previous position, for render interpolation
  py: number;
  facing: number;
  gender: Gender | null;
  order: Order | null;
  path: number[] | null;
  pathI: number;
  pathFor: number; // entity id the current path leads to
  pathPartial: boolean;
  goalX: number;
  goalY: number;
  repathT: number;
  cooldown: number;
  scanT: number;
  carryType: ResType;
  carryAmt: number;
  gatherT: number;
  homeId: number;
  moving: boolean;
  anchored: boolean; // working in place: not pushed by other units
  attackAnim: number; // counts down after each swing, for rendering
  healTarget: number;
}

export interface QueueItem {
  kind: 'unit' | 'tech' | 'age';
  id: string;
  gender?: Gender;
  t: number;
  time: number;
  cost: Cost;
  blocked?: boolean; // waiting for population room
}

export interface Building extends Base {
  kind: 'building';
  def: BuildingDef;
  cx: number;
  cy: number;
  size: number;
  progress: number;
  complete: boolean;
  queue: QueueItem[];
  rallyX: number;
  rallyY: number;
  rallyId: number;
  hasRally: boolean;
  residents: { m: number; f: number };
  birthProgress: number;
  birthBlocked: boolean;
  birthsPaused: boolean;
  children: number; // villagers this house has raised
  cooldown: number;
  scanT: number;
  workerId: number;
  morale: number; // town centers: number of houses nearby (capped)
  seen: boolean; // has the human player ever seen this building
}

export interface ResourceNode extends Base {
  kind: 'resource';
  type: NodeType;
  resType: ResType;
  amount: number;
  cx: number;
  cy: number;
  size: number;
}

export type Entity = Unit | Building | ResourceNode;

export interface Projectile {
  x: number; y: number;
  sx: number; sy: number;
  tx: number; ty: number;
  targetId: number;
  speed: number;
  owner: number;
  atk: number;
  aura: number;
  cls: ArmorClass;
  bonus?: Partial<Record<ArmorClass, number>>;
  splash: number;
  kind: 'arrow' | 'stone' | 'boulder';
  done: boolean;
}

export interface Player {
  id: number;
  name: string;
  color: number;
  isAI: boolean;
  res: Record<ResType, number>;
  age: number;
  agingUp: boolean;
  pop: number;
  popCap: number;
  mods: Mods;
  techs: Set<string>;
  pending: Set<string>;
  defeated: boolean;
  lastAttacked: { x: number; y: number; t: number } | null;
  alertT: number;
}

export type GameEvent =
  | { t: 'msg'; player: number; text: string }
  | { t: 'remove'; id: number }
  | { t: 'birth'; player: number; x: number; y: number }
  | { t: 'age'; player: number }
  | { t: 'alert'; player: number; x: number; y: number }
  | { t: 'gameover'; winner: number };

export interface PlayerSetup { name: string; color: number; isAI: boolean }

export class Game {
  size: number;
  terrain: Uint8Array;
  blocked: Uint8Array; // impassable cells
  occupied: Uint8Array; // cells that cannot be built on
  pf: Pathfinder;
  spec: MapSpec;
  players: Player[] = [];
  entities = new Map<number, Entity>();
  units: Unit[] = [];
  buildings: Building[] = [];
  resources: ResourceNode[] = [];
  projectiles: Projectile[] = [];
  events: GameEvent[] = [];
  time = 0;
  tick = 0;
  winner = -1;
  /** Fog of war for the human player: 0 unexplored, 1 explored, 2 visible. */
  vis: Uint8Array;
  humanId = 0;
  rng: () => number;
  private nextId = 1;
  private hash: Unit[][] = [];
  private hashN: number;
  private heroes: Unit[][] = [];
  private tcs: Building[][] = [];

  constructor(seed: number, setups: PlayerSetup[], size = 96) {
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.spec = generateMap(seed, size);
    this.size = size;
    this.terrain = this.spec.terrain;
    this.blocked = new Uint8Array(size * size);
    this.occupied = new Uint8Array(size * size);
    this.vis = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) if (this.terrain[i] === T_WATER) { this.blocked[i] = 1; this.occupied[i] = 1; }
    this.pf = new Pathfinder(size, this.blocked);
    this.hashN = Math.ceil(size / HASH);
    for (let i = 0; i < this.hashN * this.hashN; i++) this.hash.push([]);

    for (const n of this.spec.nodes) this.addResource(n.type, n.cx, n.cy);

    setups.forEach((s, i) => {
      this.players.push({
        id: i, name: s.name, color: s.color, isAI: s.isAI,
        res: { food: 200, wood: 200, gold: 100, stone: 100 },
        age: 0, agingUp: false, pop: 0, popCap: 0, mods: baseMods(), techs: new Set(), pending: new Set(),
        defeated: false, lastAttacked: null, alertT: -100,
      });
      this.heroes.push([]);
      this.tcs.push([]);
      const st = this.spec.starts[i];
      this.spawnBuilding('towncenter', i, st.x - 2, st.y - 2, true);
      const dir = i === 0 ? 1 : -1;
      this.spawnUnit('villager', i, st.x - 1.5, st.y + 3.5 * dir, 'm');
      this.spawnUnit('villager', i, st.x - 0.5, st.y + 3.5 * dir, 'f');
      this.spawnUnit('villager', i, st.x + 0.5, st.y + 3.5 * dir, 'm');
      this.spawnUnit('villager', i, st.x + 1.5, st.y + 3.5 * dir, 'f');
    });
    this.upkeep();
    this.updateVision();
  }

  // ------------------------------------------------------------------
  // Entity creation / removal
  // ------------------------------------------------------------------

  private addResource(type: NodeType, cx: number, cy: number): ResourceNode {
    const size = type === 'gold' || type === 'stone' ? 2 : 1;
    const r: ResourceNode = {
      id: this.nextId++, kind: 'resource', type, owner: -1, x: cx + size / 2, y: cy + size / 2,
      hp: 1, maxHp: 1, dead: false, resType: RESOURCE_KIND[type], amount: RESOURCE_AMOUNT[type], cx, cy, size,
    };
    this.entities.set(r.id, r);
    this.resources.push(r);
    this.setCells(cx, cy, size, 1, true);
    return r;
  }

  spawnUnit(type: string, owner: number, x: number, y: number, gender?: Gender): Unit {
    const def = UNITS[type];
    const u: Unit = {
      id: this.nextId++, kind: 'unit', type, def, owner, x, y, px: x, py: y, hp: def.hp, maxHp: def.hp, dead: false,
      facing: 0, gender: type === 'villager' ? gender ?? (this.rng() < 0.5 ? 'm' : 'f') : null,
      order: null, path: null, pathI: 0, pathFor: 0, pathPartial: false, goalX: 0, goalY: 0, repathT: 0,
      cooldown: 0, scanT: this.rng() * 0.4, carryType: 'food', carryAmt: 0, gatherT: 0, homeId: 0,
      moving: false, anchored: false, attackAnim: 0, healTarget: 0,
    };
    this.entities.set(u.id, u);
    this.units.push(u);
    this.players[owner].pop += def.pop;
    return u;
  }

  spawnBuilding(type: string, owner: number, cx: number, cy: number, complete: boolean): Building {
    const def = BUILDINGS[type];
    const b: Building = {
      id: this.nextId++, kind: 'building', type, def, owner, cx, cy, size: def.size,
      x: cx + def.size / 2, y: cy + def.size / 2, hp: complete ? def.hp : 1, maxHp: def.hp, dead: false,
      progress: complete ? 1 : 0, complete, queue: [], rallyX: 0, rallyY: 0, rallyId: 0, hasRally: false,
      residents: { m: 0, f: 0 }, birthProgress: 0, birthBlocked: false, birthsPaused: false, children: 0, cooldown: 0, scanT: 0, workerId: 0,
      morale: 0, seen: owner === this.humanId,
    };
    this.entities.set(b.id, b);
    this.buildings.push(b);
    this.setCells(cx, cy, def.size, 1, !def.walkable);
    return b;
  }

  private setCells(cx: number, cy: number, size: number, v: number, block: boolean): void {
    for (let y = cy; y < cy + size; y++)
      for (let x = cx; x < cx + size; x++) {
        this.occupied[y * this.size + x] = v;
        if (block) this.blocked[y * this.size + x] = v;
      }
  }

  private kill(e: Entity): void {
    if (e.dead) return;
    e.dead = true;
    this.entities.delete(e.id);
    this.events.push({ t: 'remove', id: e.id });
    if (e.kind === 'unit') {
      this.units.splice(this.units.indexOf(e), 1);
      this.players[e.owner].pop -= e.def.pop;
      const home = this.entities.get(e.homeId);
      if (home && home.kind === 'building') {
        if (home.residents.m === e.id) home.residents.m = 0;
        if (home.residents.f === e.id) home.residents.f = 0;
      }
    } else if (e.kind === 'building') {
      this.buildings.splice(this.buildings.indexOf(e), 1);
      this.setCells(e.cx, e.cy, e.size, 0, true);
      for (const id of [e.residents.m, e.residents.f]) {
        const r = this.entities.get(id);
        if (r && r.kind === 'unit') r.homeId = 0;
      }
      const p = this.players[e.owner];
      for (const q of e.queue) {
        if (q.kind === 'tech') p.pending.delete(q.id);
        if (q.kind === 'age') p.agingUp = false;
      }
      this.upkeep();
    } else {
      this.resources.splice(this.resources.indexOf(e), 1);
      this.setCells(e.cx, e.cy, e.size, 0, true);
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  canAfford(p: Player, c: Cost): boolean {
    return RES_TYPES.every((r) => p.res[r] >= (c[r] ?? 0));
  }
  private pay(p: Player, c: Cost): void {
    for (const r of RES_TYPES) p.res[r] -= c[r] ?? 0;
  }
  private refund(p: Player, c: Cost): void {
    for (const r of RES_TYPES) p.res[r] += c[r] ?? 0;
  }
  private msg(player: number, text: string): void {
    this.events.push({ t: 'msg', player, text });
  }

  /** Distance from a unit to the edge of another entity. */
  dist(u: Unit, e: Entity): number {
    if (e.kind === 'unit') return Math.max(0, Math.hypot(e.x - u.x, e.y - u.y) - e.def.radius);
    const h = e.size / 2;
    return rectDist(u.x, u.y, e.x - h, e.y - h, e.x + h, e.y + h);
  }

  isMilitary(u: Unit): boolean {
    return u.def.cls !== 'villager' && u.def.cls !== 'support';
  }

  canPlace(type: string, cx: number, cy: number, forHuman = false): boolean {
    const s = BUILDINGS[type].size;
    if (cx < 1 || cy < 1 || cx + s > this.size - 1 || cy + s > this.size - 1) return false;
    for (let y = cy; y < cy + s; y++)
      for (let x = cx; x < cx + s; x++) {
        const i = y * this.size + x;
        if (this.occupied[i]) return false;
        if (forHuman && this.vis[i] === 0) return false;
      }
    return true;
  }

  countUnits(owner: number, type: string): number {
    let n = 0;
    for (const u of this.units) if (u.owner === owner && u.type === type) n++;
    for (const b of this.buildings) if (b.owner === owner) for (const q of b.queue) if (q.kind === 'unit' && q.id === type) n++;
    return n;
  }

  /** Damage reduction (0..0.25) for a unit standing near its own town center and houses. */
  moraleAt(owner: number, x: number, y: number): number {
    let best = 0;
    for (const tc of this.tcs[owner]) {
      if (tc.morale > best && Math.hypot(tc.x - x, tc.y - y) <= MORALE_RADIUS) best = tc.morale;
    }
    return best * MORALE_PER_HOUSE;
  }

  /** Attack multiplier from a friendly hero nearby. */
  auraAt(owner: number, x: number, y: number): number {
    let best = 1;
    for (const h of this.heroes[owner]) {
      if (Math.hypot(h.x - x, h.y - y) <= (h.def.auraRange ?? 0)) best = Math.max(best, h.def.aura ?? 1);
    }
    return best;
  }

  private unitsNear(x: number, y: number, r: number, out: Unit[]): Unit[] {
    out.length = 0;
    const x0 = Math.max(0, Math.floor((x - r) / HASH)), x1 = Math.min(this.hashN - 1, Math.floor((x + r) / HASH));
    const y0 = Math.max(0, Math.floor((y - r) / HASH)), y1 = Math.min(this.hashN - 1, Math.floor((y + r) / HASH));
    for (let hy = y0; hy <= y1; hy++)
      for (let hx = x0; hx <= x1; hx++) {
        const bucket = this.hash[hy * this.hashN + hx];
        for (let i = 0; i < bucket.length; i++) {
          const u = bucket[i];
          if (!u.dead && Math.abs(u.x - x) <= r && Math.abs(u.y - y) <= r) out.push(u);
        }
      }
    return out;
  }

  private scratch: Unit[] = [];

  private findEnemy(owner: number, x: number, y: number, radius: number, minRange = 0): Entity | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const v of this.unitsNear(x, y, radius, this.scratch)) {
      if (v.owner === owner) continue;
      const d = Math.hypot(v.x - x, v.y - y);
      if (d > radius || d < minRange) continue;
      // Prefer things that fight back over villagers.
      const score = d + (v.def.cls === 'villager' ? 3 : 0);
      if (score < bestD) { bestD = score; best = v; }
    }
    if (best) return best;
    for (const b of this.buildings) {
      if (b.owner === owner) continue;
      const h = b.size / 2;
      const d = rectDist(x, y, b.x - h, b.y - h, b.x + h, b.y + h);
      if (d > radius || d < minRange) continue;
      const score = d + (b.def.atk ? 0 : 2);
      if (score < bestD) { bestD = score; best = b; }
    }
    return best;
  }

  nearestDropoff(u: Unit): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (b.owner !== u.owner || !b.complete || !b.def.dropoff) continue;
      const d = this.dist(u, b);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  private exposed(r: ResourceNode): boolean {
    for (let y = r.cy - 1; y <= r.cy + r.size; y++)
      for (let x = r.cx - 1; x <= r.cx + r.size; x++) if (!this.pf.isBlocked(x, y)) return true;
    return false;
  }

  /** Find another source of the same resource close to a point. */
  findResourceNear(x: number, y: number, res: ResType, owner: number, radius = 14, exclude = 0): Entity | null {
    let best: Entity | null = null;
    let bestD = radius;
    for (const r of this.resources) {
      if (r.resType !== res || r.id === exclude) continue;
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < bestD && this.exposed(r)) { bestD = d; best = r; }
    }
    if (!best && res === 'food') {
      for (const b of this.buildings) {
        if (b.type !== 'farm' || b.owner !== owner || !b.complete || b.workerId || b.id === exclude) continue;
        const d = Math.hypot(b.x - x, b.y - y);
        if (d < bestD) { bestD = d; best = b; }
      }
    }
    return best;
  }

  // ------------------------------------------------------------------
  // Commands (used by both the UI and the AI)
  // ------------------------------------------------------------------

  private ownUnits(ids: number[], owner: number): Unit[] {
    const out: Unit[] = [];
    for (const id of ids) {
      const e = this.entities.get(id);
      if (e && e.kind === 'unit' && e.owner === owner) out.push(e);
    }
    return out;
  }

  private setOrder(u: Unit, o: Order | null): void {
    u.order = o;
    u.path = null;
    u.pathFor = 0;
  }

  cmdMove(owner: number, ids: number[], x: number, y: number, attackMove = false): void {
    const us = this.ownUnits(ids, owner);
    const side = Math.ceil(Math.sqrt(us.length));
    us.forEach((u, i) => {
      const ox = us.length > 1 ? ((i % side) - (side - 1) / 2) * 0.85 : 0;
      const oy = us.length > 1 ? (Math.floor(i / side) - (side - 1) / 2) * 0.85 : 0;
      const tx = Math.min(this.size - 1.5, Math.max(1.5, x + ox));
      const ty = Math.min(this.size - 1.5, Math.max(1.5, y + oy));
      this.setOrder(u, attackMove && u.def.atk > 0 ? { t: 'attackMove', x: tx, y: ty } : { t: 'move', x: tx, y: ty });
    });
  }

  cmdStop(owner: number, ids: number[]): void {
    for (const u of this.ownUnits(ids, owner)) this.setOrder(u, null);
  }

  /** Context-sensitive order: attack, gather, build, repair, move in... */
  cmdTarget(owner: number, ids: number[], targetId: number): void {
    const t = this.entities.get(targetId);
    if (!t) return;
    const us = this.ownUnits(ids, owner);
    // A house only takes one man and one woman; do not march the whole selection inside.
    const slots = { m: false, f: false };
    for (const u of us) {
      const villager = u.type === 'villager';
      if (t.kind === 'resource') {
        if (villager) this.orderGather(u, t);
        else this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      } else if (t.owner !== owner) {
        if (u.def.atk > 0) this.setOrder(u, { t: 'attack', id: t.id });
        else this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      } else if (t.kind === 'building' && villager) {
        if (!t.complete || t.hp < t.maxHp) this.setOrder(u, { t: 'build', id: t.id, then: this.job(u) });
        else if (t.type === 'farm') this.orderGather(u, t);
        else if (t.type === 'house') {
          const g = u.gender!;
          if (!t.residents[g] && !slots[g] && u.homeId !== t.id) {
            slots[g] = true;
            this.setOrder(u, { t: 'movein', id: t.id, then: this.job(u) });
          } else if (us.length === 1) {
            this.msg(owner, u.homeId === t.id ? 'This villager already lives here.' : `This house already has a ${g === 'm' ? 'man' : 'woman'}.`);
          }
        } else if (t.def.dropoff && u.carryAmt > 0) {
          this.setOrder(u, { t: 'gather', id: 0, res: u.carryType, phase: 'return', nx: u.x, ny: u.y, dropId: t.id, fails: 0 });
        } else this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      } else {
        this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      }
    }
  }

  /** The gathering job a villager should go back to after an errand. */
  private job(u: Unit): Order | null {
    const o = u.order;
    if (!o) return null;
    if (o.t === 'gather') return o.id ? o : null;
    if (o.t === 'build' || o.t === 'movein') return o.then ?? null;
    return null;
  }

  private orderGather(u: Unit, t: Entity): void {
    const res: ResType = t.kind === 'resource' ? t.resType : 'food';
    if (u.carryType !== res) { u.carryAmt = 0; u.carryType = res; }
    this.setOrder(u, { t: 'gather', id: t.id, res, phase: 'go', nx: t.x, ny: t.y, dropId: 0, fails: 0 });
  }

  cmdPlace(owner: number, type: string, cx: number, cy: number, builderIds: number[]): Building | null {
    const p = this.players[owner];
    const def = BUILDINGS[type];
    if (!def || def.age > p.age) return null;
    if (!this.canPlace(type, cx, cy, owner === this.humanId && !p.isAI)) { this.msg(owner, 'Cannot build there.'); return null; }
    if (!this.canAfford(p, def.cost)) { this.msg(owner, `Not enough resources for ${def.name}.`); return null; }
    this.pay(p, def.cost);
    const b = this.spawnBuilding(type, owner, cx, cy, false);
    for (const u of this.ownUnits(builderIds, owner)) if (u.type === 'villager') this.setOrder(u, { t: 'build', id: b.id, then: this.job(u) });
    return b;
  }

  cmdTrain(owner: number, bid: number, type: string, gender?: Gender): boolean {
    const b = this.entities.get(bid);
    const p = this.players[owner];
    const def = UNITS[type];
    if (!b || b.kind !== 'building' || b.owner !== owner || !b.complete || !def || !b.def.trains.includes(type)) return false;
    if (def.age > p.age) { this.msg(owner, `Requires the ${AGES[def.age].name}.`); return false; }
    if (b.queue.length >= 8) { this.msg(owner, 'Queue is full.'); return false; }
    if (def.limit && this.countUnits(owner, type) >= def.limit) { this.msg(owner, `You can only have ${def.limit} ${def.name}.`); return false; }
    if (!this.canAfford(p, def.cost)) { this.msg(owner, `Not enough resources for ${def.name}.`); return false; }
    if (type === 'villager' && !gender) {
      let m = 0, f = 0;
      for (const u of this.units) if (u.owner === owner && u.type === 'villager') u.gender === 'm' ? m++ : f++;
      for (const ob of this.buildings) if (ob.owner === owner) for (const q of ob.queue) if (q.gender) q.gender === 'm' ? m++ : f++;
      gender = m <= f ? 'm' : 'f';
    }
    this.pay(p, def.cost);
    b.queue.push({ kind: 'unit', id: type, gender, t: 0, time: def.time, cost: def.cost });
    return true;
  }

  techAvailable(p: Player, id: string): boolean {
    const t = TECHS[id];
    return !!t && !p.techs.has(id) && !p.pending.has(id) && t.age <= p.age && (!t.requires || p.techs.has(t.requires));
  }

  cmdResearch(owner: number, bid: number, id: string): boolean {
    const b = this.entities.get(bid);
    const p = this.players[owner];
    const t = TECHS[id];
    if (!b || b.kind !== 'building' || b.owner !== owner || !b.complete || !t || !b.def.techs.includes(id)) return false;
    if (!this.techAvailable(p, id)) { this.msg(owner, 'Not available yet.'); return false; }
    if (b.queue.length >= 8) { this.msg(owner, 'Queue is full.'); return false; }
    if (!this.canAfford(p, t.cost)) { this.msg(owner, `Not enough resources for ${t.name}.`); return false; }
    this.pay(p, t.cost);
    p.pending.add(id);
    b.queue.push({ kind: 'tech', id, t: 0, time: t.time, cost: t.cost });
    return true;
  }

  cmdAgeUp(owner: number, bid: number): boolean {
    const b = this.entities.get(bid);
    const p = this.players[owner];
    if (!b || b.kind !== 'building' || b.owner !== owner || !b.complete || b.type !== 'towncenter') return false;
    if (p.age >= AGES.length - 1 || p.agingUp) return false;
    const next = AGES[p.age + 1];
    if (!this.canAfford(p, next.cost)) { this.msg(owner, `Not enough resources to reach the ${next.name}.`); return false; }
    this.pay(p, next.cost);
    p.agingUp = true;
    b.queue.push({ kind: 'age', id: String(p.age + 1), t: 0, time: next.time, cost: next.cost });
    return true;
  }

  cmdCancel(owner: number, bid: number, index: number): void {
    const b = this.entities.get(bid);
    if (!b || b.kind !== 'building' || b.owner !== owner || !b.queue[index]) return;
    const p = this.players[owner];
    const [q] = b.queue.splice(index, 1);
    this.refund(p, q.cost);
    if (q.kind === 'tech') p.pending.delete(q.id);
    if (q.kind === 'age') p.agingUp = false;
  }

  cmdRally(owner: number, bid: number, x: number, y: number, targetId = 0): void {
    const b = this.entities.get(bid);
    if (!b || b.kind !== 'building' || b.owner !== owner) return;
    b.hasRally = true;
    b.rallyX = x;
    b.rallyY = y;
    b.rallyId = targetId;
  }

  cmdDelete(owner: number, ids: number[]): void {
    for (const id of ids) {
      const e = this.entities.get(id);
      if (!e || e.owner !== owner) continue;
      if (e.kind === 'building') for (let i = e.queue.length - 1; i >= 0; i--) this.cmdCancel(owner, e.id, i);
      this.kill(e);
    }
  }

  /** Ask the nearest homeless man / woman to move into a house. Returns how many were called. */
  cmdAutoResidents(owner: number, houseId: number): number {
    const h = this.entities.get(houseId);
    if (!h || h.kind !== 'building' || h.type !== 'house' || h.owner !== owner || !h.complete) return 0;
    let called = 0;
    for (const g of ['m', 'f'] as Gender[]) {
      if (h.residents[g]) continue;
      let coming = false;
      let best: Unit | null = null;
      let bestD = Infinity;
      for (const u of this.units) {
        if (u.owner !== owner || u.type !== 'villager' || u.gender !== g) continue;
        if (u.order && u.order.t === 'movein') { if (u.order.id === h.id) coming = true; continue; }
        if (u.homeId) continue;
        const d = this.dist(u, h);
        if (d < bestD) { bestD = d; best = u; }
      }
      if (!coming && best) {
        this.setOrder(best, { t: 'movein', id: h.id, then: this.job(best) });
        called++;
      }
    }
    return called;
  }

  cmdEvict(owner: number, houseId: number): void {
    const h = this.entities.get(houseId);
    if (!h || h.kind !== 'building' || h.owner !== owner) return;
    for (const g of ['m', 'f'] as Gender[]) {
      const r = this.entities.get(h.residents[g]);
      if (r && r.kind === 'unit') r.homeId = 0;
      h.residents[g] = 0;
    }
    h.birthProgress = 0;
  }

  cmdPauseBirths(owner: number, houseId: number, paused: boolean): void {
    const h = this.entities.get(houseId);
    if (h && h.kind === 'building' && h.owner === owner) h.birthsPaused = paused;
  }

  /** Seconds a house needs for its next child. Each child takes a little longer than the last. */
  birthTime(b: Building): number {
    return (BIRTH_TIME * Math.min(3, 1 + 0.2 * b.children)) / this.players[b.owner].mods.birth;
  }

  // ------------------------------------------------------------------
  // Simulation step
  // ------------------------------------------------------------------

  step(): void {
    if (this.winner >= 0) return;
    this.tick++;
    this.time += DT;

    for (const bucket of this.hash) bucket.length = 0;
    for (const h of this.heroes) h.length = 0;
    for (const u of this.units) {
      const hx = Math.min(this.hashN - 1, Math.max(0, Math.floor(u.x / HASH)));
      const hy = Math.min(this.hashN - 1, Math.max(0, Math.floor(u.y / HASH)));
      this.hash[hy * this.hashN + hx].push(u);
      if (u.def.aura) this.heroes[u.owner].push(u);
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u && !u.dead) this.updateUnit(u);
    }
    this.separate();
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (b && !b.dead) this.updateBuilding(b);
    }
    this.updateProjectiles();

    if (this.tick % 4 === 0) this.updateVision();
    if (this.tick % 20 === 0) {
      this.upkeep();
      this.checkVictory();
    }
  }

  /** Recompute population caps, morale and other slow-changing state. */
  private upkeep(): void {
    for (const p of this.players) {
      p.popCap = 0;
      this.tcs[p.id].length = 0;
    }
    for (const b of this.buildings) {
      if (!b.complete) continue;
      const p = this.players[b.owner];
      p.popCap += b.def.pop + (b.type === 'house' ? p.mods.housePop : 0);
      if (b.type === 'towncenter') this.tcs[b.owner].push(b);
    }
    for (const p of this.players) {
      p.popCap = Math.min(POP_LIMIT, p.popCap);
      for (const tc of this.tcs[p.id]) {
        let n = 0;
        for (const b of this.buildings)
          if (b.owner === p.id && b.type === 'house' && b.complete && Math.hypot(b.x - tc.x, b.y - tc.y) <= MORALE_RADIUS) n++;
        tc.morale = Math.min(MORALE_MAX_HOUSES, n);
      }
    }
  }

  private checkVictory(): void {
    const alive = new Set<number>();
    for (const b of this.buildings) alive.add(b.owner);
    for (const p of this.players) {
      if (!p.defeated && !alive.has(p.id)) {
        p.defeated = true;
        for (const u of this.units.filter((u) => u.owner === p.id)) this.kill(u);
      }
    }
    const left = this.players.filter((p) => !p.defeated);
    if (left.length === 1 && this.players.length > 1) {
      this.winner = left[0].id;
      this.events.push({ t: 'gameover', winner: this.winner });
    }
  }

  private updateVision(): void {
    const N = this.size, vis = this.vis;
    for (let i = 0; i < vis.length; i++) if (vis[i] === 2) vis[i] = 1;
    const stamp = (x: number, y: number, r: number) => {
      const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(N - 1, Math.floor(x + r));
      const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(N - 1, Math.floor(y + r));
      const r2 = r * r;
      for (let cy = y0; cy <= y1; cy++)
        for (let cx = x0; cx <= x1; cx++) {
          const dx = cx + 0.5 - x, dy = cy + 0.5 - y;
          if (dx * dx + dy * dy <= r2) vis[cy * N + cx] = 2;
        }
    };
    for (const u of this.units) if (u.owner === this.humanId) stamp(u.x, u.y, u.def.sight);
    for (const b of this.buildings) if (b.owner === this.humanId) stamp(b.x, b.y, (b.complete ? b.def.sight : 2) + b.size / 2);
    for (const b of this.buildings) {
      if (!b.seen && vis[Math.floor(b.y) * N + Math.floor(b.x)] === 2) b.seen = true;
    }
  }

  // ---- Units ----

  private moveAlong(u: Unit): 'done' | 'moving' | 'blocked' {
    if (!u.path) return 'done';
    let step = u.def.speed * DT;
    const ox = u.x, oy = u.y;
    while (step > 0 && u.pathI < u.path.length) {
      const tx = u.path[u.pathI], ty = u.path[u.pathI + 1];
      const dx = tx - u.x, dy = ty - u.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-4) u.facing = Math.atan2(dx, dy);
      if (d <= step) { u.x = tx; u.y = ty; u.pathI += 2; step -= d; }
      else { u.x += (dx / d) * step; u.y += (dy / d) * step; step = 0; }
    }
    // A building may have been placed across the path since it was computed.
    const N = this.size;
    if (this.blocked[Math.floor(u.y) * N + Math.floor(u.x)] && !this.blocked[Math.floor(oy) * N + Math.floor(ox)]) {
      u.x = ox; u.y = oy;
      u.path = null;
      return 'blocked';
    }
    u.moving = true;
    if (u.pathI >= u.path.length) { u.path = null; return 'done'; }
    return 'moving';
  }

  /** Walk towards an entity until within reach of it. */
  private approach(u: Unit, t: Entity, reach: number): 'there' | 'moving' | 'fail' {
    if (this.dist(u, t) <= reach) { u.path = null; u.pathFor = 0; return 'there'; }
    u.repathT -= DT;
    const drifted = t.kind === 'unit' && Math.abs(t.x - u.goalX) + Math.abs(t.y - u.goalY) > 1 && u.repathT <= 0;
    if (u.pathFor !== t.id || drifted) {
      const h = t.kind === 'unit' ? 0 : t.size / 2;
      const res = this.pf.find(u.x, u.y, t.x - h, t.y - h, t.x + h, t.y + h, Math.max(0.71, reach - 0.4));
      u.path = res.path;
      u.pathI = 0;
      u.pathFor = t.id;
      u.pathPartial = res.partial;
      u.goalX = t.x;
      u.goalY = t.y;
      u.repathT = 0.4;
    }
    const r = this.moveAlong(u);
    if (r === 'blocked') { u.pathFor = 0; return 'moving'; }
    if (r === 'done') {
      if (this.dist(u, t) <= reach) { u.pathFor = 0; return 'there'; }
      if (t.kind === 'unit' && !u.pathPartial) { u.pathFor = 0; return 'moving'; } // target moved: repath
      u.pathFor = 0;
      return 'fail';
    }
    return 'moving';
  }

  private walkTo(u: Unit, o: { x: number; y: number; started?: boolean; tries?: number }): boolean {
    if (!u.path) {
      if (o.started) return true;
      o.started = true;
      const p = this.pf.nearestFree(o.x, o.y);
      const res = this.pf.find(u.x, u.y, p.x, p.y, p.x, p.y, 0.71);
      const path = res.path;
      if (!res.partial) {
        const n = path.length;
        const lx = n ? path[n - 2] : u.x, ly = n ? path[n - 1] : u.y;
        if (this.pf.lineClear(lx, ly, p.x, p.y)) path.push(p.x, p.y);
      }
      if (!path.length) return true;
      u.path = path;
      u.pathI = 0;
      u.pathFor = 0;
    }
    const r = this.moveAlong(u);
    if (r === 'blocked') {
      o.started = false;
      o.tries = (o.tries ?? 0) + 1;
      return o.tries > 3;
    }
    return r === 'done';
  }

  private updateUnit(u: Unit): void {
    u.px = u.x;
    u.py = u.y;
    u.moving = false;
    u.anchored = false;
    if (u.cooldown > 0) u.cooldown -= DT;
    if (u.attackAnim > 0) u.attackAnim -= DT;
    if (u.def.heal) this.updateHealer(u);
    if (u.def.aura && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 1.5 * DT); // heroes slowly regenerate

    const o = u.order;
    if (!o) {
      if (this.blocked[Math.floor(u.y) * this.size + Math.floor(u.x)]) {
        const p = this.pf.nearestFree(u.x, u.y);
        this.setOrder(u, { t: 'move', x: p.x, y: p.y });
        return;
      }
      if (u.def.atk > 0 && this.isMilitary(u)) {
        u.scanT -= DT;
        if (u.scanT <= 0) {
          u.scanT = 0.4;
          const e = this.findEnemy(u.owner, u.x, u.y, u.def.sight, u.def.minRange);
          if (e) this.setOrder(u, { t: 'attack', id: e.id, auto: true, ox: u.x, oy: u.y });
        }
      }
      return;
    }

    switch (o.t) {
      case 'move':
        if (this.walkTo(u, o)) this.setOrder(u, null);
        break;

      case 'attackMove': {
        u.scanT -= DT;
        if (u.scanT <= 0) {
          u.scanT = 0.4;
          const e = this.findEnemy(u.owner, u.x, u.y, u.def.sight, u.def.minRange);
          if (e) {
            o.started = false;
            this.setOrder(u, { t: 'attack', id: e.id, then: o });
            break;
          }
        }
        if (this.walkTo(u, o)) this.setOrder(u, null);
        break;
      }

      case 'attack': {
        const t = this.entities.get(o.id);
        if (!t || t.dead || t.owner === u.owner || t.kind === 'resource') { this.setOrder(u, o.then ?? null); break; }
        if (o.auto && Math.hypot(u.x - o.ox!, u.y - o.oy!) > 11) { this.setOrder(u, { t: 'move', x: o.ox!, y: o.oy! }); break; }
        const d = this.dist(u, t);
        if (u.def.minRange && d < u.def.minRange) {
          // Too close to fire. Auto-acquired targets are dropped so another can be picked.
          if (o.auto || o.then) this.setOrder(u, o.then ?? null);
          break;
        }
        const r = this.approach(u, t, u.def.range + 0.3);
        if (r === 'there') {
          u.anchored = true;
          u.facing = Math.atan2(t.x - u.x, t.y - u.y);
          if (u.cooldown <= 0) this.strike(u, t);
        } else if (r === 'fail') this.setOrder(u, o.then ?? null);
        break;
      }

      case 'gather':
        this.updateGather(u, o);
        break;

      case 'build': {
        const b = this.entities.get(o.id);
        if (!b || b.kind !== 'building' || b.dead || b.owner !== u.owner) { this.setOrder(u, o.then ?? null); break; }
        if (b.complete && b.hp >= b.maxHp) {
          if (b.type === 'farm' && !b.workerId) { this.orderGather(u, b); break; }
          let next: Building | null = null;
          let nd = 14;
          for (const ob of this.buildings) {
            if (ob.owner !== u.owner || ob.complete) continue;
            const d = this.dist(u, ob);
            if (d < nd) { nd = d; next = ob; }
          }
          this.setOrder(u, next ? { t: 'build', id: next.id, then: o.then } : o.then ?? null);
          break;
        }
        const r = this.approach(u, b, REACH);
        if (r === 'there') {
          u.anchored = true;
          u.facing = Math.atan2(b.x - u.x, b.y - u.y);
          u.attackAnim = 0.3;
          if (!b.complete) {
            b.progress += DT / b.def.time;
            b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * DT) / b.def.time);
            if (b.progress >= 1) {
              b.progress = 1;
              b.complete = true;
              this.upkeep();
            }
          } else {
            b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * DT) / (b.def.time * 1.5));
          }
        } else if (r === 'fail') this.setOrder(u, null);
        break;
      }

      case 'movein': {
        const h = this.entities.get(o.id);
        if (!h || h.kind !== 'building' || h.dead || h.owner !== u.owner || !u.gender) { this.setOrder(u, o.then ?? null); break; }
        const r = this.approach(u, h, REACH);
        if (r === 'there') {
          if (h.complete && !h.residents[u.gender]) {
            const old = this.entities.get(u.homeId);
            if (old && old.kind === 'building') { old.residents[u.gender] = 0; old.birthProgress = 0; }
            h.residents[u.gender] = u.id;
            u.homeId = h.id;
          }
          this.setOrder(u, o.then ?? null);
        } else if (r === 'fail') this.setOrder(u, o.then ?? null);
        break;
      }
    }
  }

  private updateGather(u: Unit, o: Extract<Order, { t: 'gather' }>): void {
    const p = this.players[u.owner];
    if (o.phase === 'return') {
      let d = this.entities.get(o.dropId);
      if (!d || d.kind !== 'building' || d.dead || !d.complete) {
        d = this.nearestDropoff(u) ?? undefined;
        if (!d) { this.setOrder(u, null); return; }
        o.dropId = d.id;
      }
      const r = this.approach(u, d, REACH);
      if (r === 'there') {
        p.res[u.carryType] += u.carryAmt;
        u.carryAmt = 0;
        o.phase = 'go';
        if (!o.id) this.setOrder(u, null); // was only asked to drop off
      } else if (r === 'fail') this.setOrder(u, null);
      return;
    }

    let t = this.entities.get(o.id);
    const valid = (e: Entity | undefined): e is Entity =>
      !!e && !e.dead && (e.kind === 'resource' ||
        (e.kind === 'building' && e.type === 'farm' && e.owner === u.owner && e.complete && (!e.workerId || e.workerId === u.id)));
    if (!valid(t)) {
      t = this.findResourceNear(o.nx, o.ny, o.res, u.owner) ?? undefined;
      if (!valid(t)) {
        if (u.carryAmt > 0 && this.nearestDropoff(u)) { o.phase = 'return'; o.id = 0; o.dropId = 0; }
        else this.setOrder(u, null);
        return;
      }
      o.id = t.id;
      o.nx = t.x;
      o.ny = t.y;
      u.pathFor = 0;
    }
    if (t.kind === 'building') t.workerId = u.id;

    const r = this.approach(u, t, REACH);
    if (r === 'fail') {
      // Unreachable (e.g. a tree deep inside a forest): try something closer to where we ended up.
      o.fails++;
      const alt = o.fails <= 3 ? this.findResourceNear(u.x, u.y, o.res, u.owner, 14, t.id) : null;
      if (!alt) { this.setOrder(u, null); return; }
      if (t.kind === 'building') t.workerId = 0;
      o.id = alt.id;
      o.nx = alt.x;
      o.ny = alt.y;
      return;
    }
    if (r !== 'there') return;

    o.fails = 0;
    u.anchored = true;
    u.facing = Math.atan2(t.x - u.x, t.y - u.y);
    u.attackAnim = 0.3;
    u.gatherT += DT * GATHER_RATE[t.type] * p.mods.gather;
    while (u.gatherT >= 1) {
      u.gatherT -= 1;
      u.carryAmt++;
      if (t.kind === 'resource') {
        t.amount--;
        if (t.amount <= 0) { this.kill(t); break; }
      }
    }
    if (u.carryAmt >= p.mods.carry) {
      o.phase = 'return';
      o.dropId = 0;
      u.pathFor = 0;
    }
  }

  private updateHealer(u: Unit): void {
    u.scanT -= DT;
    let t = this.entities.get(u.healTarget);
    if (u.scanT <= 0 || !t || t.dead) {
      u.scanT = 0.5;
      let best: Unit | null = null;
      let worst = 1;
      for (const v of this.unitsNear(u.x, u.y, u.def.range, this.scratch)) {
        if (v.owner !== u.owner || v === u || v.hp >= v.maxHp) continue;
        if (Math.hypot(v.x - u.x, v.y - u.y) > u.def.range) continue;
        const f = v.hp / v.maxHp;
        if (f < worst) { worst = f; best = v; }
      }
      if (!best && u.hp < u.maxHp) best = u;
      u.healTarget = best ? best.id : 0;
      t = best ?? undefined;
    }
    if (t && t.kind === 'unit') {
      t.hp = Math.min(t.maxHp, t.hp + u.def.heal! * this.players[u.owner].mods.heal * DT);
      if (t.hp >= t.maxHp) u.healTarget = 0;
    }
  }

  private separate(): void {
    const near: Unit[] = [];
    const N = this.size;
    for (const u of this.units) {
      if (u.anchored) continue;
      let px = 0, py = 0;
      for (const v of this.unitsNear(u.x, u.y, 1.5, near)) {
        if (v === u) continue;
        const min = u.def.radius + v.def.radius;
        let dx = u.x - v.x, dy = u.y - v.y;
        const d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 1e-3) { const a = (u.id * 2.399) % 6.283; dx = Math.cos(a); dy = Math.sin(a); }
        else { dx /= d; dy /= d; }
        const w = (min - d) * (v.anchored ? 1 : 0.5);
        px += dx * w;
        py += dy * w;
      }
      if (px === 0 && py === 0) continue;
      const m = Math.hypot(px, py);
      const cap = 0.06;
      if (m > cap) { px = (px / m) * cap; py = (py / m) * cap; }
      const nx = u.x + px, ny = u.y + py;
      if (nx < 0.5 || ny < 0.5 || nx > N - 0.5 || ny > N - 0.5) continue;
      if (this.blocked[Math.floor(ny) * N + Math.floor(nx)]) continue;
      u.x = nx;
      u.y = ny;
    }
  }

  // ---- Combat ----

  private strike(u: Unit, t: Entity): void {
    const p = this.players[u.owner];
    u.cooldown = u.def.cooldown;
    u.attackAnim = 0.35;
    const atk = u.def.atk + (this.isMilitary(u) ? p.mods.atk : 0);
    const aura = u.def.aura ? 1 : this.auraAt(u.owner, u.x, u.y);
    if (u.def.projectile) {
      this.projectiles.push({
        x: u.x, y: u.y, sx: u.x, sy: u.y, tx: t.x, ty: t.y, targetId: t.id,
        speed: u.def.projectile === 'boulder' ? 7 : 13, owner: u.owner, atk, aura, cls: u.def.cls,
        bonus: u.def.bonus, splash: u.def.splash ?? 0, kind: u.def.projectile, done: false,
      });
    } else {
      this.hit(u.owner, atk, aura, u.def.cls, u.def.bonus, t, 1);
      if (u.def.splash) {
        for (const v of this.unitsNear(t.x, t.y, u.def.splash, this.scratch.slice())) {
          if (v.owner !== u.owner && v !== t && Math.hypot(v.x - t.x, v.y - t.y) <= u.def.splash) {
            this.hit(u.owner, atk, aura, u.def.cls, u.def.bonus, v, 0.5);
          }
        }
      }
    }
  }

  private hit(owner: number, atk: number, aura: number, cls: ArmorClass, bonus: UnitDef['bonus'], t: Entity, scale: number): void {
    if (t.dead || t.kind === 'resource') return;
    const tp = this.players[t.owner];
    const tcls: ArmorClass = t.kind === 'unit' ? t.def.cls : 'building';
    let mult = bonus?.[tcls] ?? 1;
    // Arrows and sling stones barely scratch walls.
    if (tcls === 'building' && (cls === 'ranged' || cls === 'building')) mult *= 0.35;
    let armor = 0;
    let morale = 0;
    if (t.kind === 'unit') {
      armor = t.def.armor + (this.isMilitary(t) ? tp.mods.armor : 0);
      morale = this.moraleAt(t.owner, t.x, t.y);
    } else armor = 1;
    const dmg = Math.max(1, atk * mult * aura - armor) * (1 - morale) * scale;
    t.hp -= dmg;
    tp.lastAttacked = { x: t.x, y: t.y, t: this.time };
    if (this.time - tp.alertT > 12) {
      tp.alertT = this.time;
      this.events.push({ t: 'alert', player: t.owner, x: t.x, y: t.y });
    }
    if (t.hp <= 0) this.kill(t);
  }

  private updateProjectiles(): void {
    const ps = this.projectiles;
    for (const p of ps) {
      const t = this.entities.get(p.targetId);
      if (t && p.kind !== 'boulder') { p.tx = t.x; p.ty = t.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * DT;
      if (d > step) { p.x += (dx / d) * step; p.y += (dy / d) * step; continue; }
      p.x = p.tx;
      p.y = p.ty;
      p.done = true;
      if (p.splash > 0) {
        for (const v of this.unitsNear(p.x, p.y, p.splash, this.scratch.slice())) {
          if (v.owner !== p.owner && Math.hypot(v.x - p.x, v.y - p.y) <= p.splash) this.hit(p.owner, p.atk, p.aura, p.cls, p.bonus, v, 1);
        }
        for (const b of this.buildings.slice()) {
          const h = b.size / 2;
          if (b.owner !== p.owner && rectDist(p.x, p.y, b.x - h, b.y - h, b.x + h, b.y + h) <= p.splash * 0.5) {
            this.hit(p.owner, p.atk, p.aura, p.cls, p.bonus, b, 1);
          }
        }
      } else if (t && !t.dead) this.hit(p.owner, p.atk, p.aura, p.cls, p.bonus, t, 1);
    }
    if (ps.some((p) => p.done)) this.projectiles = ps.filter((p) => !p.done);
  }

  // ---- Buildings ----

  /** Free cell next to a building, closest to a desired point. */
  private exitSpot(b: Building, tx: number, ty: number): { x: number; y: number } {
    let best = { x: b.x, y: b.y + b.size / 2 + 0.5 };
    let bestD = Infinity;
    for (let y = b.cy - 1; y <= b.cy + b.size; y++)
      for (let x = b.cx - 1; x <= b.cx + b.size; x++) {
        if (x >= b.cx && x < b.cx + b.size && y >= b.cy && y < b.cy + b.size) continue;
        if (this.pf.isBlocked(x, y)) continue;
        const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
        if (d < bestD) { bestD = d; best = { x: x + 0.5, y: y + 0.5 }; }
      }
    return bestD === Infinity ? this.pf.nearestFree(best.x, best.y) : best;
  }

  private spawnFrom(b: Building, type: string, gender?: Gender): Unit {
    const tx = b.hasRally ? b.rallyX : b.x;
    const ty = b.hasRally ? b.rallyY : b.y + b.size;
    const s = this.exitSpot(b, tx, ty);
    const u = this.spawnUnit(type, b.owner, s.x, s.y, gender);
    if (b.hasRally) {
      const t = this.entities.get(b.rallyId);
      if (t && !t.dead) this.cmdTarget(b.owner, [u.id], t.id);
      else this.cmdMove(b.owner, [u.id], b.rallyX, b.rallyY);
    }
    return u;
  }

  private updateBuilding(b: Building): void {
    if (!b.complete) return;
    const p = this.players[b.owner];

    const q = b.queue[0];
    if (q) {
      if (q.t < q.time) q.t += DT;
      if (q.t >= q.time) {
        if (q.kind === 'unit') {
          const def = UNITS[q.id];
          if (p.pop + def.pop <= p.popCap) {
            b.queue.shift();
            this.spawnFrom(b, q.id, q.gender);
          } else q.blocked = true;
        } else if (q.kind === 'tech') {
          b.queue.shift();
          p.pending.delete(q.id);
          p.techs.add(q.id);
          TECHS[q.id].apply(p.mods);
          this.msg(b.owner, `${TECHS[q.id].name} researched.`);
          this.upkeep();
        } else {
          b.queue.shift();
          p.age = Number(q.id);
          p.agingUp = false;
          this.events.push({ t: 'age', player: b.owner });
        }
      }
    }

    if (b.type === 'house') {
      for (const g of ['m', 'f'] as Gender[]) {
        const r = this.entities.get(b.residents[g]);
        if (b.residents[g] && (!r || r.dead || r.owner !== b.owner)) b.residents[g] = 0;
      }
      if (b.residents.m && b.residents.f && !b.birthsPaused) {
        if (b.birthProgress < 1) b.birthProgress = Math.min(1, b.birthProgress + DT / this.birthTime(b));
        if (b.birthProgress >= 1) {
          if (p.pop + 1 <= p.popCap && p.res.food >= BIRTH_COST) {
            p.res.food -= BIRTH_COST;
            b.birthProgress = 0;
            b.birthBlocked = false;
            b.children++;
            const child = this.spawnFrom(b, 'villager');
            if (!b.hasRally) {
              // Children take up the trade of one of their parents.
              const parents = [b.residents.m, b.residents.f].map((id) => this.entities.get(id) as Unit);
              if (this.rng() < 0.5) parents.reverse();
              for (const par of parents) {
                const job = this.job(par);
                const src = job && job.t === 'gather' ? this.entities.get(job.id) : null;
                if (src && !(src.kind === 'building' && src.type === 'farm')) { this.cmdTarget(b.owner, [child.id], src.id); break; }
              }
            }
            this.events.push({ t: 'birth', player: b.owner, x: child.x, y: child.y });
          } else b.birthBlocked = true;
        }
      } else if (b.birthProgress > 0 && !b.birthsPaused) b.birthProgress = Math.max(0, b.birthProgress - DT / 20);
    } else if (b.type === 'farm' && b.workerId) {
      const w = this.entities.get(b.workerId);
      if (!w || w.kind !== 'unit' || !w.order || w.order.t !== 'gather' || w.order.id !== b.id) b.workerId = 0;
    }

    if (b.def.atk) {
      if (b.cooldown > 0) b.cooldown -= DT;
      b.scanT -= DT;
      if (b.cooldown <= 0 && b.scanT <= 0) {
        b.scanT = 0.3;
        const range = b.def.range! + b.size / 2;
        let best: Unit | null = null;
        let bestD = range;
        for (const v of this.unitsNear(b.x, b.y, range, this.scratch)) {
          const d = Math.hypot(v.x - b.x, v.y - b.y);
          if (v.owner !== b.owner && d < bestD) { bestD = d; best = v; }
        }
        if (best) {
          b.cooldown = b.def.cooldown!;
          this.projectiles.push({
            x: b.x, y: b.y, sx: b.x, sy: b.y, tx: best.x, ty: best.y, targetId: best.id, speed: 13, owner: b.owner,
            atk: b.def.atk + p.mods.towerAtk, aura: 1, cls: 'building', splash: 0, kind: 'arrow', done: false,
          });
        }
      }
    }
  }
}
