// Core simulation. No rendering or DOM access in here so it can run headless.

import {
  ABILITIES, AGES, CIVS, CIV_IDS, ELDER_AT, LIFESPAN, RENOWN_CHILDREN, TRADE, WONDER_TIME, VILLAGER_TRAITS, NAMES_M, NAMES_F, FAMILY_NAMES, BIRTH_COST, BIRTH_TIME, GROW_TIME, BUILDINGS, BuildingDef, Cost, GATHER_RATE, MORALE_MAX_HOUSES,
  MORALE_PER_HOUSE, MORALE_RADIUS, Mods, POP_LIMIT, RESOURCE_AMOUNT, RESOURCE_KIND, RES_TYPES,
  ResType, TECHS, UNITS, UnitDef, ArmorClass, baseMods,
} from './data';
import { generateMap, MapSpec, NodeType, T_WATER } from './map';
import { CLERGY_BIRTH, CLERGY_VIRTUE, Creed, DILEMMAS, LEANING, MAID_DISTRACTION, MAID_GOLD, MAID_VIRTUE, STAFF_CAP, creedOf } from './creed';
import { Pathfinder, rectDist } from './path';

export const DT = 1 / 20;
/** Bump when saved games from older builds can no longer be loaded. */
export const SAVE_VERSION = 11;
const HASH = 4; // spatial hash bucket size in tiles
const REACH = 0.8; // interaction distance for gathering / building

export type Gender = 'm' | 'f';
/** How far a unit will go after enemies it spots: anywhere, a few steps, or not at all. */
export type Stance = 'aggressive' | 'defensive' | 'hold';
const LEASH: Record<Stance, number> = { aggressive: 11, defensive: 4, hold: 0.6 };

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
  | { t: 'patrol'; x: number; y: number; ax: number; ay: number; bx: number; by: number; started?: boolean; tries?: number }
  | { t: 'attack'; id: number; then?: Order | null; auto?: boolean; ox?: number; oy?: number }
  | { t: 'gather'; id: number; res: ResType; phase: 'go' | 'return'; nx: number; ny: number; dropId: number; fails: number }
  | { t: 'build'; id: number; then?: Order | null }
  | { t: 'movein'; id: number; then?: Order | null }
  | { t: 'shelter'; id: number; then?: Order | null }
  | { t: 'board'; id: number }
  | { t: 'staff'; id: number }
  | { t: 'unload'; x: number; y: number; started?: boolean; tries?: number }
  | { t: 'cast'; ability: string; x: number; y: number; started?: boolean; tries?: number };

export interface Unit extends Base {
  kind: 'unit';
  def: UnitDef;
  px: number; // previous position, for render interpolation
  py: number;
  facing: number;
  gender: Gender | null;
  order: Order | null;
  queue: Order[]; // orders to carry out after the current one (shift-click)
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
  stance: Stance;
  chargeD: number; // tiles run since the last blow, for charging units
  name: string; // villagers have names
  family: string; // family a villager was born into, if any
  trait: string; // key of VILLAGER_TRAITS, or ''
  trait2: string; // a second trait, for the lucky
  age: number; // seconds lived as an adult
  lifespan: number; // seconds of adult life this villager will have
  growT: number; // seconds until a child becomes a working adult (0 for adults)
  bornAt: number; // house a child was born in
  plagueT: number; // seconds of plague remaining
  mana: number;
  homeX: number; // where a wild animal lives
  homeY: number;
  inside: number; // building this unit is sheltering in, or ship it is aboard
  cargo?: number[]; // a transport ship's passengers
  resume: Order | null; // job to return to after sheltering
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
  family: string; // name of the family living in a house
  children: number; // villagers this house has raised
  cooldown: number;
  scanT: number;
  workerId: number;
  doneAt: number; // game time construction finished (0 if not yet)
  burnT: number; // seconds of fire left after a flame attack
  sheltered: number[]; // villagers hiding inside
  staff?: number[]; // villagers stationed here to work: clergy or tavern maids
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
  kind: 'arrow' | 'stone' | 'boulder' | 'shot';
  done: boolean;
}

export interface Stats { gathered: number; trained: number; born: number; kills: number; lost: number; razed: number; buildingsLost: number }
const newStats = (): Stats => ({ gathered: 0, trained: 0, born: 0, kills: 0, lost: 0, razed: 0, buildingsLost: 0 });

export interface Player {
  id: number;
  name: string;
  color: number;
  isAI: boolean;
  team: number;
  civ: string;
  res: Record<ResType, number>;
  /** Unit types that have been re-equipped: training the key now produces the value. */
  upgrades: Record<string, string>;
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
  stats: Stats;
  /** Score sampled every 30 seconds, for the end-of-game chart. */
  history: number[];
  /** The wildlife "player": never wins, loses or builds. */
  neutral: boolean;
  bell: boolean;
  /** Piety against decadence, -100 to 100. */
  virtue: number;
  /** Villagers stationed in churches and in taverns, counted once a second. */
  clergy: number;
  maids: number;
  /** A dilemma waiting for an answer (its id), when the next is due, and how many have been put. */
  dilemma: string | null;
  dilemmaT: number;
  dilemmas: number;
  /** A call for allies to gather at a point. */
  signal: { x: number; y: number; t: number } | null;
  /** Building this player's army is marching on, so allies can join in (AI players). */
  attackTarget: number;
}

export type GameEvent =
  | { t: 'msg'; player: number; text: string }
  | { t: 'remove'; id: number; unit: boolean; x: number; y: number }
  | { t: 'grown'; player: number; x: number; y: number }
  | { t: 'quake'; x: number; y: number }
  | { t: 'plague'; x: number; y: number }
  | { t: 'birth'; player: number; x: number; y: number }
  | { t: 'age'; player: number }
  | { t: 'alert'; player: number; x: number; y: number }
  | { t: 'defeated'; player: number }
  | { t: 'wonder'; player: number }
  | { t: 'dilemma'; player: number; id: string }
  | { t: 'creed'; player: number; creed: string }
  | { t: 'oldage'; player: number; name: string }
  | { t: 'signal'; player: number; x: number; y: number }
  | { t: 'gameover'; winner: number };

export interface PlayerSetup {
  name: string;
  color: number;
  isAI: boolean;
  /** Players with the same team number are allies. Defaults to everyone for themselves. */
  team?: number;
  /** Civilisation id. Defaults to a different one for each player. */
  civ?: string;
  /** Head start, used by Conquest battles: extra soldiers, extra of every resource, a later age. */
  /** `armed`: the side already has every weapon upgrade of its starting age. */
  bonus?: { units?: Record<string, number>; res?: number; age?: number; buildings?: string[]; atk?: number; armed?: boolean };
}

export class Game {
  size: number;
  terrain: Uint8Array;
  blocked: Uint8Array; // impassable cells
  occupied: Uint8Array; // cells that cannot be built on
  /** The pathfinder for whoever is being moved right now: `landPf` except while a ship is updated. */
  pf: Pathfinder;
  landPf!: Pathfinder;
  seaPf!: Pathfinder;
  spec: MapSpec;
  players: Player[] = [];
  entities = new Map<number, Entity>();
  units: Unit[] = [];
  buildings: Building[] = [];
  resources: ResourceNode[] = [];
  projectiles: Projectile[] = [];
  quakes: { x: number; y: number; r: number; t: number; owner: number }[] = [];
  events: GameEvent[] = [];
  time = 0;
  tick = 0;
  winner = -1;
  /** Fog of war for the human player: 0 unexplored, 1 explored, 2 visible. */
  vis: Uint8Array;
  humanId = 0;
  /** Villagers grow old and die. Turned off for short Conquest battles. */
  aging = true;
  /** Progress of a scripted mission, if one is being played: which, a counter, and ids it is tracking. */
  scenario: { id: string; n: number; ids: number[] } | null = null;
  /** Player id that owns wild animals. */
  wild = -1;
  /** Seeded generator whose state is saved with the game, so a loaded game plays out identically. */
  rngState = 0;
  rng = (): number => {
    let t = (this.rngState = (this.rngState + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  private nextId = 1;
  /** Route searches left this tick. Spreading them out stops a big army order causing a hitch. */
  private pathBudget = 0;
  private hash: Unit[][] = [];
  private hashN: number;
  private heroes: Unit[][] = [];
  private strategists: Unit[] = [];
  private tcs: Building[][] = [];

  /**
   * @param field A field battle: no towns or villagers, just each side's army. A side is beaten
   *   when it has no soldiers left.
   */
  constructor(public seed: number, public setups: PlayerSetup[], size = 96, public field = false, public sea = false) {
    this.rngState = (seed ^ 0x9e3779b9) >>> 0;
    this.spec = generateMap(seed, size, setups.length, sea);
    this.size = size;
    this.terrain = this.spec.terrain;
    this.blocked = new Uint8Array(size * size);
    this.occupied = new Uint8Array(size * size);
    this.vis = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) if (this.terrain[i] === T_WATER) { this.blocked[i] = 1; this.occupied[i] = 1; }
    this.pf = this.landPf = new Pathfinder(size, this.blocked);
    // Ships see the world the other way round: water is open, everything else is solid.
    const seaBlocked = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) seaBlocked[i] = this.terrain[i] === T_WATER ? 0 : 1;
    this.seaPf = new Pathfinder(size, seaBlocked);
    this.hashN = Math.ceil(size / HASH);
    for (let i = 0; i < this.hashN * this.hashN; i++) this.hash.push([]);

    for (const n of this.spec.nodes) this.addResource(n.type, n.cx, n.cy);

    setups.forEach((s, i) => {
      this.players.push({
        id: i, name: s.name, color: s.color, isAI: s.isAI, team: s.team ?? i, civ: s.civ && CIVS[s.civ] ? s.civ : CIV_IDS[i % CIV_IDS.length],
        res: { food: 200, wood: 200, gold: 100, stone: 100 },
        upgrades: {}, age: 0, agingUp: false, pop: 0, popCap: 0, mods: baseMods(), techs: new Set(), pending: new Set(),
        defeated: false, lastAttacked: null, alertT: -100, neutral: false, bell: false, virtue: 0, clergy: 0, maids: 0, dilemma: null, dilemmaT: 180, dilemmas: 0, signal: null, attackTarget: 0, stats: newStats(), history: [],
      });
      CIVS[this.players[i].civ].apply(this.players[i].mods);
      this.heroes.push([]);
      this.tcs.push([]);
      const st = this.spec.starts[i];
      const dir = st.y < size / 2 ? 1 : -1; // villagers start on the side facing the middle
      if (!field) {
        this.spawnBuilding('towncenter', i, st.x - 2, st.y - 2, true);
        this.spawnUnit('villager', i, st.x - 1.5, st.y + 3.5 * dir, 'm');
        this.spawnUnit('villager', i, st.x - 0.5, st.y + 3.5 * dir, 'f');
        this.spawnUnit('villager', i, st.x + 0.5, st.y + 3.5 * dir, 'm');
        this.spawnUnit('villager', i, st.x + 1.5, st.y + 3.5 * dir, 'f');
      }
      // The founders are not all the same age, so they do not all die in the same minute.
      for (const u of this.units) if (u.owner === i) u.age = this.rng() * 240;
      if (s.bonus) {
        const p = this.players[i];
        p.age = s.bonus.age ?? 0;
        p.mods.atk += s.bonus.atk ?? 0; // veterans hit harder
        if (s.bonus.armed) {
          for (const t of Object.values(TECHS)) if (t.upgrade && t.age <= p.age) { p.techs.add(t.id); p.upgrades[t.upgrade[0]] = t.upgrade[1]; }
        }
        for (const r of RES_TYPES) p.res[r] += s.bonus.res ?? 0;
        // Defensive works stand at the corners of the town.
        (s.bonus.buildings ?? []).forEach((type, j) => {
          const cx = st.x + (j % 2 ? -6 : 4), cy = st.y + (j % 2 ? 4 : -6) * (j > 1 ? -1 : 1);
          if (this.canPlace(type, cx, cy)) this.spawnBuilding(type, i, cx, cy, true);
        });
        let k = 0;
        for (const [type, n] of Object.entries(s.bonus.units ?? {})) {
          // In a field battle the army forms up where the town would have been.
          for (let j = 0; j < n; j++, k++) this.spawnUnit(this.trainedAs(i, type), i, st.x - 3.5 + (k % 8), st.y + ((field ? -1 : 5) + Math.floor(k / 8)) * dir);
        }
      }
    });
    this.wild = this.players.length;
    this.players.push({
      id: this.wild, name: 'Wild', color: 0x8a6a48, isAI: false, team: 99, civ: '', res: { food: 0, wood: 0, gold: 0, stone: 0 },
      upgrades: {}, age: 0, agingUp: false, pop: 0, popCap: 0, mods: baseMods(), techs: new Set(), pending: new Set(),
      defeated: false, lastAttacked: null, alertT: -100, neutral: true, bell: false, virtue: 0, clergy: 0, maids: 0, dilemma: null, dilemmaT: Infinity, dilemmas: 0, signal: null, attackTarget: 0, stats: newStats(), history: [],
    });
    this.heroes.push([]);
    this.tcs.push([]);
    if (!field) for (const a of this.spec.animals) this.spawnUnit(a.type, this.wild, a.x, a.y);
    if (field) this.aging = false;
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
    if (type !== 'carcass' && type !== 'fish') this.setCells(cx, cy, size, 1, true); // a carcass can be walked over
    return r;
  }

  spawnUnit(type: string, owner: number, x: number, y: number, gender?: Gender): Unit {
    const def = UNITS[type];
    const u: Unit = {
      id: this.nextId++, kind: 'unit', type, def, owner, x, y, px: x, py: y, hp: def.hp, maxHp: def.hp, dead: false, chargeD: 0,
      facing: 0, gender: type === 'villager' ? gender ?? (this.rng() < 0.5 ? 'm' : 'f') : null,
      order: null, queue: [], path: null, pathI: 0, pathFor: 0, pathPartial: false, goalX: 0, goalY: 0, repathT: 0,
      cooldown: 0, scanT: this.rng() * 0.4, carryType: 'food', carryAmt: 0, gatherT: 0, homeId: 0,
      moving: false, anchored: false, attackAnim: 0, healTarget: 0, stance: 'aggressive', name: '', family: '', trait: '', trait2: '', age: 0, lifespan: 0, growT: 0, bornAt: 0, plagueT: 0,
      mana: (def.mana ?? 0) / 2, homeX: x, homeY: y, inside: 0, resume: null,
    };
    if (type === 'villager') {
      const names = u.gender === 'm' ? NAMES_M : NAMES_F;
      u.name = names[Math.floor(this.rng() * names.length)];
      if (this.rng() < 0.3) this.setTrait(u, Object.keys(VILLAGER_TRAITS)[Math.floor(this.rng() * 4)]);
      u.lifespan = LIFESPAN[0] + this.rng() * (LIFESPAN[1] - LIFESPAN[0]);
    }
    if (def.cls === 'siege') u.hp = u.maxHp = Math.round(def.hp * this.players[owner].mods.siegeHp);
    this.entities.set(u.id, u);
    this.units.push(u);
    this.players[owner].pop += def.pop;
    return u;
  }

  /** Give a villager a trait (or none), keeping its health in step. */
  setTrait(u: Unit, trait: string, trait2 = ''): void {
    u.trait = trait || trait2;
    u.trait2 = trait && trait2 !== trait ? trait2 : '';
    const max = Math.round(u.def.hp * (this.has(u, 'hardy') ? 1.5 : 1) * (u.growT > 0 ? 0.4 : 1));
    u.hp = (u.hp / u.maxHp) * max;
    u.maxHp = max;
  }

  has(u: Unit, trait: string): boolean {
    return u.trait === trait || u.trait2 === trait;
  }

  /** Old villagers slow down. */
  isElder(u: Unit): boolean {
    return this.aging && u.lifespan > 0 && u.age > u.lifespan * ELDER_AT;
  }

  /** A family's standing: one rank for every few children raised, up to three. */
  renown(b: Building): number {
    return Math.min(3, Math.floor(b.children / RENOWN_CHILDREN));
  }

  spawnBuilding(type: string, owner: number, cx: number, cy: number, complete: boolean): Building {
    const def = BUILDINGS[type];
    const maxHp = Math.round(def.hp * this.players[owner].mods.buildingHp);
    const b: Building = {
      id: this.nextId++, kind: 'building', type, def, owner, cx, cy, size: def.size,
      x: cx + def.size / 2, y: cy + def.size / 2, hp: complete ? maxHp : 1, maxHp, dead: false, burnT: 0,
      progress: complete ? 1 : 0, complete, queue: [], rallyX: 0, rallyY: 0, rallyId: 0, hasRally: false,
      residents: { m: 0, f: 0 }, birthProgress: 0, birthBlocked: false, birthsPaused: false, family: '', children: 0, cooldown: 0, scanT: 0, workerId: 0, sheltered: [], doneAt: 0,
      morale: 0, seen: !this.hostile(owner, this.humanId),
    };
    this.entities.set(b.id, b);
    this.buildings.push(b);
    this.setCells(cx, cy, def.size, def.gate ? 2 + this.players[owner].team : 1, !def.walkable); // gates open for the whole team
    return b;
  }

  private setCells(cx: number, cy: number, size: number, v: number, block: boolean): void {
    for (let y = cy; y < cy + size; y++)
      for (let x = cx; x < cx + size; x++) {
        this.occupied[y * this.size + x] = v ? 1 : 0;
        if (block) this.blocked[y * this.size + x] = v;
      }
  }

  private kill(e: Entity): void {
    if (e.dead) return;
    e.dead = true;
    this.entities.delete(e.id);
    this.events.push({ t: 'remove', id: e.id, unit: e.kind === 'unit', x: e.x, y: e.y });
    if (e.kind === 'unit') {
      this.units.splice(this.units.indexOf(e), 1);
      this.players[e.owner].pop -= e.def.pop;
      const shelter = this.entities.get(e.inside);
      if (shelter && shelter.kind === 'building') { shelter.sheltered = shelter.sheltered.filter((id) => id !== e.id); if (shelter.staff) shelter.staff = shelter.staff.filter((id) => id !== e.id); }
      if (shelter && shelter.kind === 'unit' && shelter.cargo) shelter.cargo = shelter.cargo.filter((id) => id !== e.id);
      // Everyone aboard a sinking ship goes down with it.
      for (const id of e.cargo ?? []) { const c = this.entities.get(id); if (c && c.kind === 'unit') { c.inside = 0; this.kill(c); } }
      if (e.type === 'deer') {
        // The hunters carve up what they killed.
        const meat = this.addResource('carcass', Math.floor(e.x), Math.floor(e.y));
        for (const u of this.units) if (u.type === 'villager' && u.order?.t === 'attack' && u.order.id === e.id) this.orderGather(u, meat);
      }
      const home = this.entities.get(e.homeId);
      if (home && home.kind === 'building') {
        if (home.residents.m === e.id) home.residents.m = 0;
        if (home.residents.f === e.id) home.residents.f = 0;
      }
    } else if (e.kind === 'building') {
      this.unstaff(e, e.staff?.length ?? 0);
      this.buildings.splice(this.buildings.indexOf(e), 1);
      this.setCells(e.cx, e.cy, e.size, 0, true);
      this.release(e);
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
      if (e.type !== 'carcass' && e.type !== 'fish') this.setCells(e.cx, e.cy, e.size, 0, true);
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

  /** True if two owners are enemies. Allies and unowned things (resources) are never hostile. */
  hostile(a: number, b: number): boolean {
    return a >= 0 && b >= 0 && this.players[a].team !== this.players[b].team;
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
    if (type === 'dock') {
      // A dock needs water along at least one side.
      let shore = false;
      for (let y = cy - 1; y <= cy + s && !shore; y++)
        for (let x = cx - 1; x <= cx + s; x++) if ((x < cx || x >= cx + s) !== (y < cy || y >= cy + s) && this.terrain[y * this.size + x] === T_WATER) { shore = true; break; }
      if (!shore) return false;
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
    return best * MORALE_PER_HOUSE * this.creed(owner).morale;
  }

  /** Damage multiplier for an attacker standing near an enemy Strategist. */
  weakenAt(owner: number, x: number, y: number): number {
    let m = 1;
    for (const s of this.strategists) {
      if (this.hostile(s.owner, owner) && Math.hypot(s.x - x, s.y - y) <= (s.def.auraRange ?? 0)) m = Math.min(m, s.def.weaken ?? 1);
    }
    return m;
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

  private findEnemy(owner: number, x: number, y: number, radius: number, minRange = 0, buildingsOnly = false, noShips = false): Entity | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const v of buildingsOnly ? [] : this.unitsNear(x, y, radius, this.scratch)) {
      if (!this.hostile(v.owner, owner) || v.def.docile || (noShips && v.def.naval)) continue;
      // Wolves and the Wildborn leave each other alone.
      if ((owner === this.wild && this.players[v.owner].civ === 'wild') || (v.owner === this.wild && this.players[owner].civ === 'wild')) continue;
      const d = Math.hypot(v.x - x, v.y - y);
      if (d > radius || d < minRange) continue;
      // Prefer things that fight back over villagers.
      const score = d + (v.def.cls === 'villager' ? 3 : 0);
      if (score < bestD) { bestD = score; best = v; }
    }
    if (best || owner === this.wild) return best;
    for (const b of this.buildings) {
      if (!this.hostile(b.owner, owner)) continue;
      const h = b.size / 2;
      const d = rectDist(x, y, b.x - h, b.y - h, b.x + h, b.y + h);
      if (d > radius || d < minRange) continue;
      // Walls are only worth attacking when nothing else is in reach.
      const score = d + (b.def.atk ? 0 : b.def.wall ? 30 : 2);
      if (score < bestD) { bestD = score; best = b; }
    }
    return best;
  }

  nearestDropoff(u: Unit): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (b.owner !== u.owner || !b.complete || !b.def.dropoff || (b.type === 'dock') !== !!u.def.naval) continue;
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
  findResourceNear(x: number, y: number, res: ResType, owner: number, radius = 14, exclude = 0, fish = false): Entity | null {
    let best: Entity | null = null;
    let bestD = radius;
    for (const r of this.resources) {
      if (r.resType !== res || r.id === exclude || (r.type === 'fish') !== fish) continue;
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < bestD && this.exposed(r)) { bestD = d; best = r; }
    }
    if (!best && res === 'food' && !fish) {
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
      if (e && e.kind === 'unit' && e.owner === owner && !e.inside) out.push(e);
    }
    return out;
  }

  private setOrder(u: Unit, o: Order | null): void {
    if (!o && u.queue.length) o = u.queue.shift()!;
    u.order = o;
    u.path = null;
    u.pathFor = 0;
  }

  /**
   * Start a command for some units. Normally it replaces what they were doing. With `queue`,
   * a busy unit keeps its current order and does the new one afterwards. Call the returned
   * function once the new orders have been set.
   */
  private command(us: Unit[], queue: boolean): () => void {
    if (!queue) {
      for (const u of us) u.queue.length = 0;
      return () => {};
    }
    const saved = us.map((u) => ({ u, o: u.order, path: u.path, pathI: u.pathI, pathFor: u.pathFor }));
    return () => {
      for (const s of saved) {
        const next = s.u.order;
        if (!s.o || next === s.o) continue;
        s.u.order = s.o;
        s.u.path = s.path;
        s.u.pathI = s.pathI;
        s.u.pathFor = s.pathFor;
        if (next && s.u.queue.length < 8) s.u.queue.push(next);
      }
    };
  }

  cmdMove(owner: number, ids: number[], x: number, y: number, attackMove = false, queue = false): void {
    const us = this.ownUnits(ids, owner);
    const done = this.command(us, queue);
    const side = Math.ceil(Math.sqrt(us.length));
    us.forEach((u, i) => {
      const ox = us.length > 1 ? ((i % side) - (side - 1) / 2) * 0.85 : 0;
      const oy = us.length > 1 ? (Math.floor(i / side) - (side - 1) / 2) * 0.85 : 0;
      const tx = Math.min(this.size - 1.5, Math.max(1.5, x + ox));
      const ty = Math.min(this.size - 1.5, Math.max(1.5, y + oy));
      this.setOrder(u, attackMove && u.def.atk > 0 ? { t: 'attackMove', x: tx, y: ty } : { t: 'move', x: tx, y: ty });
    });
    done();
  }

  /** Walk back and forth between where each unit stands and a point, attacking anything met. */
  cmdPatrol(owner: number, ids: number[], x: number, y: number): void {
    const us = this.ownUnits(ids, owner);
    const done = this.command(us, false);
    for (const u of us) {
      if (u.def.atk > 0) this.setOrder(u, { t: 'patrol', x, y, ax: u.x, ay: u.y, bx: x, by: y });
      else this.setOrder(u, { t: 'move', x, y });
    }
    done();
  }

  cmdStance(owner: number, ids: number[], stance: Stance): void {
    for (const u of this.ownUnits(ids, owner)) u.stance = stance;
  }

  cmdStop(owner: number, ids: number[]): void {
    for (const u of this.ownUnits(ids, owner)) { u.queue.length = 0; this.setOrder(u, null); }
  }

  /** Context-sensitive order: attack, gather, build, repair, move in... */
  cmdTarget(owner: number, ids: number[], targetId: number, queue = false): void {
    const t = this.entities.get(targetId);
    if (!t) return;
    const us = this.ownUnits(ids, owner);
    const done = this.command(us, queue);
    // A house only takes one man and one woman; do not march the whole selection inside.
    const slots = { m: false, f: false };
    for (const u of us) {
      const villager = u.type === 'villager' && u.growT <= 0;
      if (t.kind === 'resource') {
        if (t.type === 'fish' ? u.def.fisher : villager) this.orderGather(u, t);
        else this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      } else if (this.hostile(t.owner, owner)) {
        if (u.def.atk > 0) this.setOrder(u, { t: 'attack', id: t.id });
        else this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      } else if (t.kind === 'unit' && t.def.carry && t.owner === owner && !u.def.naval) {
        this.setOrder(u, { t: 'board', id: t.id });
      } else if (t.owner !== owner) {
        this.setOrder(u, { t: 'move', x: t.x, y: t.y }); // an ally's: just walk over
      } else if (t.kind === 'building' && villager) {
        if (!t.complete || t.hp < t.maxHp) this.setOrder(u, { t: 'build', id: t.id, then: this.job(u) });
        else if (t.type === 'farm') this.orderGather(u, t);
        else if (t.def.staff) {
          if ((t.staff?.length ?? 0) < t.def.staff) this.setOrder(u, { t: 'staff', id: t.id });
          else if (us.length === 1) this.msg(owner, `The ${t.def.name.toLowerCase()} has all the hands it can use.`);
        }
        else if (t.type === 'house') {
          const g = u.gender!;
          if (!t.residents[g] && !slots[g] && u.homeId !== t.id) {
            slots[g] = true;
            this.setOrder(u, { t: 'movein', id: t.id, then: this.job(u) });
          } else if (us.length === 1) {
            this.msg(owner, u.homeId === t.id ? 'This villager already lives here.' : `This house already has a ${g === 'm' ? 'man' : 'woman'}.`);
          }
        } else if (t.def.dropoff && t.type !== 'dock' && u.carryAmt > 0) {
          this.setOrder(u, { t: 'gather', id: 0, res: u.carryType, phase: 'return', nx: u.x, ny: u.y, dropId: t.id, fails: 0 });
        } else this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      } else if (t.kind === 'building' && t.type === 'dock' && t.complete && u.def.fisher && u.carryAmt > 0) {
        this.setOrder(u, { t: 'gather', id: 0, res: u.carryType, phase: 'return', nx: u.x, ny: u.y, dropId: t.id, fails: 0 });
      } else {
        this.setOrder(u, { t: 'move', x: t.x, y: t.y });
      }
    }
    done();
  }

  /** The gathering job a villager should go back to after an errand. */
  private job(u: Unit): Order | null {
    const o = u.order;
    if (!o) return null;
    if (o.t === 'gather') return o.id ? o : null;
    if (o.t === 'build' || o.t === 'movein' || o.t === 'shelter') return o.then ?? null;
    return null;
  }

  private orderGather(u: Unit, t: Entity): void {
    const res: ResType = t.kind === 'resource' ? t.resType : 'food';
    if (u.carryType !== res) { u.carryAmt = 0; u.carryType = res; }
    this.setOrder(u, { t: 'gather', id: t.id, res, phase: 'go', nx: t.x, ny: t.y, dropId: 0, fails: 0 });
  }

  cmdPlace(owner: number, type: string, cx: number, cy: number, builderIds: number[], queue = false): Building | null {
    const p = this.players[owner];
    const def = BUILDINGS[type];
    if (!def || def.age > p.age) return null;
    if (!this.canPlace(type, cx, cy, owner === this.humanId && !p.isAI)) { this.msg(owner, 'Cannot build there.'); return null; }
    if (!this.canAfford(p, def.cost)) { this.msg(owner, `Not enough resources for ${def.name}.`); return null; }
    this.pay(p, def.cost);
    const b = this.spawnBuilding(type, owner, cx, cy, false);
    if (type === 'dock' && !this.findResourceNear(b.x, b.y, 'food', owner, 26, 0, true)) this.msg(owner, 'There are no fish near this water: boats built here will have nothing to catch.');
    const us = this.ownUnits(builderIds, owner).filter((u) => u.type === 'villager' && u.growT <= 0);
    const done = this.command(us, queue);
    for (const u of us) this.setOrder(u, { t: 'build', id: b.id, then: queue ? null : this.job(u) });
    done();
    return b;
  }

  /** Place a run of wall segments, as many as can be afforded. Returns how many were placed. */
  cmdPlaceLine(owner: number, type: string, cells: { cx: number; cy: number }[], builderIds: number[]): number {
    const p = this.players[owner];
    const def = BUILDINGS[type];
    if (!def || def.age > p.age) return 0;
    let first: Building | null = null;
    let n = 0;
    for (const c of cells) {
      if (!this.canPlace(type, c.cx, c.cy, owner === this.humanId && !p.isAI)) continue;
      if (!this.canAfford(p, def.cost)) { this.msg(owner, `Not enough resources for ${def.name}.`); break; }
      this.pay(p, def.cost);
      first ??= this.spawnBuilding(type, owner, c.cx, c.cy, false);
      if (n++) this.spawnBuilding(type, owner, c.cx, c.cy, false);
    }
    if (first) for (const u of this.ownUnits(builderIds, owner)) if (u.type === 'villager' && u.growT <= 0) this.setOrder(u, { t: 'build', id: first.id, then: this.job(u) });
    return n;
  }

  // ------------------------------------------------------------------
  // Save / load
  // ------------------------------------------------------------------

  serialize(): string {
    return JSON.stringify({
      v: SAVE_VERSION, seed: this.seed, setups: this.setups, size: this.size, time: this.time, tick: this.tick,
      winner: this.winner, nextId: this.nextId, rngState: this.rngState, aging: this.aging, scenario: this.scenario, field: this.field, sea: this.sea, vis: Array.from(this.vis),
      players: this.players.map((p) => ({ ...p, techs: [...p.techs], pending: [...p.pending] })),
      units: this.units, buildings: this.buildings, resources: this.resources, projectiles: this.projectiles, quakes: this.quakes,
    }, (k, v) => (k === 'def' ? undefined : v));
  }

  /** Rebuild a game from `serialize()` output. Throws if the save is from an incompatible version. */
  static restore(json: string): Game {
    const d = JSON.parse(json);
    if (d.v !== SAVE_VERSION) throw new Error('Incompatible save');
    const g = new Game(d.seed, d.setups, d.size, d.field, d.sea); // regenerates the same terrain from the seed
    g.entities.clear();
    g.blocked.fill(0);
    g.occupied.fill(0);
    for (let i = 0; i < g.terrain.length; i++) if (g.terrain[i] === T_WATER) { g.blocked[i] = 1; g.occupied[i] = 1; }
    g.resources = d.resources;
    for (const r of g.resources) if (r.type !== 'carcass' && r.type !== 'fish') g.setCells(r.cx, r.cy, r.size, 1, true);
    g.buildings = d.buildings;
    for (const b of g.buildings) {
      b.def = BUILDINGS[b.type];
      g.setCells(b.cx, b.cy, b.size, b.def.gate ? 2 + d.players[b.owner].team : 1, !b.def.walkable);
    }
    g.units = d.units;
    for (const u of g.units) u.def = UNITS[u.type];
    for (const e of [...g.resources, ...g.buildings, ...g.units]) g.entities.set(e.id, e);
    g.players = d.players.map((p: Player & { techs: string[]; pending: string[] }) => ({ ...p, techs: new Set(p.techs), pending: new Set(p.pending) }));
    g.projectiles = d.projectiles;
    g.quakes = d.quakes;
    g.time = d.time;
    g.tick = d.tick;
    g.winner = d.winner;
    g.nextId = d.nextId;
    g.rngState = d.rngState;
    g.aging = d.aging;
    g.scenario = d.scenario;
    g.vis.set(d.vis);
    g.events = [];
    g.upkeep();
    return g;
  }

  cmdTrain(owner: number, bid: number, type: string, gender?: Gender): boolean {
    const b = this.entities.get(bid);
    const p = this.players[owner];
    if (!b || b.kind !== 'building' || b.owner !== owner || !b.complete || !UNITS[type] || !b.def.trains.includes(type)) return false;
    type = this.trainedAs(owner, type);
    const def = UNITS[type];
    if (def.civ && def.civ !== p.civ) return false;
    if (def.age > p.age) { this.msg(owner, `Requires the ${AGES[def.age].name}.`); return false; }
    if (b.queue.length >= 8) { this.msg(owner, 'Queue is full.'); return false; }
    if (def.limit && this.countUnits(owner, type) >= def.limit) { this.msg(owner, `You can only have ${def.limit} ${def.name}.`); return false; }
    const cost = this.unitCost(owner, type);
    if (!this.canAfford(p, cost)) { this.msg(owner, `Not enough resources for ${def.name}.`); return false; }
    if (type === 'villager' && !gender) {
      let m = 0, f = 0;
      for (const u of this.units) if (u.owner === owner && u.type === 'villager') u.gender === 'm' ? m++ : f++;
      for (const ob of this.buildings) if (ob.owner === owner) for (const q of ob.queue) if (q.gender) q.gender === 'm' ? m++ : f++;
      gender = m <= f ? 'm' : 'f';
    }
    this.pay(p, cost);
    b.queue.push({ kind: 'unit', id: type, gender, t: 0, time: def.time * (this.isMilitary({ def } as Unit) ? this.creed(owner).train : 1), cost });
    return true;
  }

  /** What a unit costs this player, after civilisation discounts. */
  unitCost(owner: number, type: string): Cost {
    const def = UNITS[type], m = this.players[owner].mods;
    const k = def.cls === 'cavalry' ? m.cavCost : def.cls === 'support' ? m.clergyCost : def.cls === 'beast' ? m.beastCost : 1;
    if (k === 1) return def.cost;
    const out: Cost = {};
    for (const r of RES_TYPES) if (def.cost[r]) out[r] = Math.round(def.cost[r]! * k);
    return out;
  }

  techCost(owner: number, id: string): Cost {
    const t = TECHS[id], k = this.players[owner].mods.techCost;
    if (k === 1) return t.cost;
    const out: Cost = {};
    for (const r of RES_TYPES) if (t.cost[r]) out[r] = Math.round(t.cost[r]! * k);
    return out;
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
    const cost = this.techCost(owner, id);
    if (!this.canAfford(p, cost)) { this.msg(owner, `Not enough resources for ${t.name}.`); return false; }
    this.pay(p, cost);
    p.pending.add(id);
    b.queue.push({ kind: 'tech', id, t: 0, time: t.time * p.mods.techTime * this.creed(owner).research, cost });
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

  /** Players on the same side as `owner` who are still in the game. */
  allies(owner: number): Player[] {
    return this.players.filter((p) => p.id !== owner && !p.neutral && !p.defeated && !this.hostile(p.id, owner));
  }

  /** Call allies to a point: their armies march there ready to fight. */
  cmdSignal(owner: number, x: number, y: number): void {
    this.players[owner].signal = { x, y, t: this.time };
    this.events.push({ t: 'signal', player: owner, x, y });
  }

  /** Send 100 of a resource to an ally. Needs a Market, like any other trade. */
  cmdTribute(owner: number, to: number, res: ResType): boolean {
    const p = this.players[owner], q = this.players[to];
    if (!q || to === owner || q.neutral || q.defeated || this.hostile(owner, to)) return false;
    if (!this.buildings.some((b) => b.owner === owner && b.type === 'market' && b.complete)) { this.msg(owner, 'You need a Market to send tribute.'); return false; }
    if (p.res[res] < 100) { this.msg(owner, `Not enough ${res} to send.`); return false; }
    p.res[res] -= 100;
    q.res[res] += 100;
    this.msg(to, `${p.name} sent you 100 ${res}.`);
    return true;
  }

  /** The creed a player's people live by. */
  creed(owner: number): Creed {
    return creedOf(this.players[owner]?.virtue ?? 0);
  }

  private shiftVirtue(owner: number, by: number): void {
    const p = this.players[owner];
    const was = this.creed(owner);
    p.virtue = Math.max(-100, Math.min(100, p.virtue + by));
    const now = this.creed(owner);
    if (now !== was) this.events.push({ t: 'creed', player: owner, creed: now.id });
  }

  /** Once a second: habits pull the scale, and now and then a dilemma is put to each people. */
  private updateCreeds(): void {
    if (this.field) return;
    for (const p of this.players) {
      if (p.id === this.wild || p.defeated || !this.tcs[p.id]?.length) continue;
      // Clergy pull a people towards piety, tavern maids the other way; the maids also earn their keep.
      p.clergy = 0;
      p.maids = 0;
      for (const b of this.buildings) if (b.owner === p.id && b.staff?.length) { if (b.type === 'tavern') p.maids += b.staff.length; else p.clergy += b.staff.length; }
      const clergy = Math.min(STAFF_CAP, p.clergy), maids = Math.min(STAFF_CAP, p.maids);
      const pull = (clergy * CLERGY_VIRTUE - maids * MAID_VIRTUE) / 60;
      if (pull) this.shiftVirtue(p.id, pull);
      if (maids) { p.res.gold += maids * MAID_GOLD; p.stats.gathered += maids * MAID_GOLD; }
      if (p.dilemma || this.time < p.dilemmaT) continue;
      // Chosen without the game's dice, so that a match plays out the same with or without them.
      const pick = (this.seed * 31 + p.id * 17 + p.dilemmas * 7) % DILEMMAS.length;
      p.dilemma = DILEMMAS[pick].id;
      p.dilemmas++;
      if (p.isAI) {
        const roll = ((this.seed * 13 + p.id * 29 + p.dilemmas * 37) % 100) / 100;
        const pious = roll < (LEANING[p.civ] ?? 0.5);
        if (!this.cmdDecide(p.id, pious ? 'a' : 'b')) this.cmdDecide(p.id, pious ? 'b' : 'a');
        if (p.dilemma) { p.dilemma = null; p.dilemmaT = this.time + 240; }
      } else this.events.push({ t: 'dilemma', player: p.id, id: p.dilemma });
    }
  }

  /** Answer the dilemma before a player: 'a' is the pious course, 'b' the worldly one. */
  cmdDecide(owner: number, choice: 'a' | 'b'): boolean {
    const p = this.players[owner];
    const d = DILEMMAS.find((x) => x.id === p?.dilemma);
    if (!d) return false;
    const c = d[choice];
    for (const r of RES_TYPES) if (p.res[r] + (c.res[r] ?? 0) < 0) { this.msg(owner, `Not enough ${r} for that.`); return false; }
    for (const r of RES_TYPES) p.res[r] += c.res[r] ?? 0;
    p.dilemma = null;
    p.dilemmaT = this.time + 240;
    this.msg(owner, c.result);
    this.shiftVirtue(owner, c.virtue);
    return true;
  }

  /** Sell 100 of a resource for gold, or buy 100 with gold, at a Market. */
  cmdTrade(owner: number, bid: number, res: ResType, dir: 'sell' | 'buy'): boolean {
    const b = this.entities.get(bid);
    const p = this.players[owner];
    const rate = TRADE[res];
    if (!b || b.kind !== 'building' || b.owner !== owner || b.type !== 'market' || !b.complete || !rate) return false;
    const cost: Cost = dir === 'sell' ? { [res]: 100 } : { gold: rate.buy };
    if (!this.canAfford(p, cost)) { this.msg(owner, dir === 'sell' ? `Not enough ${res} to sell.` : 'Not enough gold.'); return false; }
    this.pay(p, cost);
    if (dir === 'sell') p.res.gold += Math.round(rate.sell * this.creed(owner).trade);
    else p.res[res] += 100;
    this.shiftVirtue(owner, -2); // a people that haggles thinks about money
    return true;
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
        if (u.owner !== owner || u.type !== 'villager' || u.gender !== g || u.growT > 0 || u.inside) continue;
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

  /** Order prophets to call a calamity down on a point. The closest one with enough faith goes. */
  cmdCast(owner: number, ids: number[], ability: string, x: number, y: number): boolean {
    const a = ABILITIES[ability];
    if (!a) return false;
    const able = this.ownUnits(ids, owner).filter((u) => u.def.mana && u.mana >= a.cost)
      .sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y));
    if (!able.length) { this.msg(owner, `Not enough faith for ${a.name}.`); return false; }
    this.setOrder(able[0], { t: 'cast', ability, x, y });
    return true;
  }

  /** Ring the town bell: villagers run for shelter. Ring it again and they go back to work. */
  cmdBell(owner: number, on: boolean): void {
    const p = this.players[owner];
    p.bell = on;
    const shelters = this.buildings.filter((b) => b.owner === owner && b.complete && b.def.shelter);
    if (!on) {
      for (const b of shelters) this.release(b);
      for (const u of this.units) if (u.owner === owner && u.order?.t === 'shelter') this.setOrder(u, u.order.then ?? null);
      return;
    }
    const room = new Map(shelters.map((b) => [b.id, b.def.shelter! - b.sheltered.length]));
    for (const u of this.units) {
      if (u.owner !== owner || u.type !== 'villager' || u.inside) continue;
      let best: Building | null = null;
      let bestD = 40;
      for (const b of shelters) {
        const d = this.dist(u, b);
        if (room.get(b.id)! > 0 && d < bestD) { bestD = d; best = b; }
      }
      if (!best) continue;
      room.set(best.id, room.get(best.id)! - 1);
      this.setOrder(u, { t: 'shelter', id: best.id, then: this.job(u) });
    }
  }

  /** Send units into a Town Center or Watch Tower. They are safe inside and add to its arrow fire. */
  /** Put everyone aboard the given transports ashore on the land beside them. Returns how many landed. */
  cmdUnload(owner: number, ids: number[]): number {
    let landed = 0;
    for (const s of this.ownUnits(ids, owner)) landed += this.unload(s);
    return landed;
  }

  /** Sail to the water nearest a point and put everyone ashore there. */
  cmdUnloadAt(owner: number, ids: number[], x: number, y: number): void {
    for (const s of this.ownUnits(ids, owner)) if (s.cargo?.length) this.setOrder(s, { t: 'unload', x, y });
  }

  /**
   * The water cell nearest a point that has open land right beside it: somewhere a ship can
   * take on or land troops. `fromX/fromY`, if given, is water the ship must be able to sail from.
   */
  shoreSpot(x: number, y: number, radius: number, team: number, fromX?: number, fromY?: number): { wx: number; wy: number; lx: number; ly: number } | null {
    this.landPf.pass = 2 + team;
    let best: { wx: number; wy: number; lx: number; ly: number } | null = null, bd = radius;
    const N = this.size;
    for (let cy = Math.max(1, Math.floor(y - radius)); cy <= Math.min(N - 2, y + radius); cy++)
      for (let cx = Math.max(1, Math.floor(x - radius)); cx <= Math.min(N - 2, x + radius); cx++) {
        if (this.terrain[cy * N + cx] !== T_WATER) continue;
        const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
        if (d >= bd) continue;
        const land = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !this.landPf.isBlocked(cx + dx, cy + dy));
        if (!land) continue;
        if (fromX !== undefined && this.seaPf.find(fromX, fromY!, cx + 0.5, cy + 0.5, cx + 0.5, cy + 0.5, 0.71).partial) continue;
        bd = d;
        best = { wx: cx + 0.5, wy: cy + 0.5, lx: cx + land[0] + 0.5, ly: cy + land[1] + 0.5 };
      }
    return best;
  }

  private unload(s: Unit): number {
    let landed = 0;
    const owner = s.owner;
    {
      if (!s.cargo?.length) return 0;
      this.landPf.pass = 2 + this.players[owner].team;
      const spots: { x: number; y: number; d: number }[] = [];
      const cx = Math.floor(s.x), cy = Math.floor(s.y);
      for (let y = cy - 3; y <= cy + 3; y++)
        for (let x = cx - 3; x <= cx + 3; x++) {
          const d = Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y);
          if (d <= 2.6 && !this.landPf.isBlocked(x, y)) spots.push({ x: x + 0.5, y: y + 0.5, d });
        }
      if (!spots.length) { this.msg(owner, 'There is no land here to put them ashore.'); return 0; }
      spots.sort((a, b) => a.d - b.d);
      s.cargo.forEach((id, i) => {
        const u = this.entities.get(id);
        if (!u || u.kind !== 'unit') return;
        const p = spots[i % spots.length];
        u.inside = 0;
        u.x = u.px = p.x + (this.rng() - 0.5) * 0.3;
        u.y = u.py = p.y + (this.rng() - 0.5) * 0.3;
        u.path = null;
        u.pathFor = 0;
        landed++;
      });
      s.cargo = [];
    }
    return landed;
  }

  cmdShelter(owner: number, ids: number[], buildingId: number): number {
    const b = this.entities.get(buildingId);
    if (!b || b.kind !== 'building' || b.owner !== owner || !b.complete || !b.def.shelter) return 0;
    let room = b.def.shelter - b.sheltered.length;
    let n = 0;
    for (const u of this.ownUnits(ids, owner)) {
      if (u.def.cls === 'siege' || u.def.cls === 'beast' || u.def.cls === 'cavalry') continue; // too big to fit
      if (room-- <= 0) break;
      this.setOrder(u, { t: 'shelter', id: b.id, then: this.job(u) });
      n++;
    }
    if (!n) this.msg(owner, room < 0 ? 'No room inside.' : 'These units cannot go inside.');
    return n;
  }

  cmdRelease(owner: number, buildingId: number): void {
    const b = this.entities.get(buildingId);
    if (b && b.kind === 'building' && b.owner === owner) this.release(b);
  }

  /** Let everyone sheltering in a building back out. */
  private release(b: Building): void {
    for (const id of b.sheltered) {
      const u = this.entities.get(id);
      if (!u || u.kind !== 'unit') continue;
      const s = this.exitSpot(b, b.x, b.y + b.size);
      u.inside = 0;
      u.x = u.px = s.x;
      u.y = u.py = s.y;
      this.setOrder(u, u.resume);
      u.resume = null;
    }
    b.sheltered = [];
  }

  /** Send stationed villagers back out of a church or tavern: one of them, or everybody. */
  cmdUnstaff(owner: number, bid: number, all = false): number {
    const b = this.entities.get(bid);
    if (!b || b.kind !== 'building' || b.owner !== owner || !b.staff?.length) return 0;
    return this.unstaff(b, all ? b.staff.length : 1);
  }
  private unstaff(b: Building, n: number): number {
    let out = 0;
    while (n-- > 0 && b.staff?.length) {
      const u = this.entities.get(b.staff.pop()!);
      if (!u || u.kind !== 'unit') continue;
      const s = this.exitSpot(b, b.x, b.y + b.size);
      u.inside = 0;
      u.x = u.px = s.x;
      u.y = u.py = s.y;
      this.setOrder(u, null);
      out++;
    }
    return out;
  }

  cmdPauseBirths(owner: number, houseId: number, paused: boolean): void {
    const h = this.entities.get(houseId);
    if (h && h.kind === 'building' && h.owner === owner) h.birthsPaused = paused;
  }

  /** Seconds a house needs for its next child. Each child takes a little longer than the last. */
  birthTime(b: Building): number {
    return (BIRTH_TIME * Math.min(3, 1 + 0.2 * b.children)) / (this.players[b.owner].mods.birth * this.creed(b.owner).birth * (1 + CLERGY_BIRTH * Math.min(STAFF_CAP, this.players[b.owner].clergy)) * (1 + 0.1 * this.renown(b)));
  }

  // ------------------------------------------------------------------
  // Simulation step
  // ------------------------------------------------------------------

  step(): void {
    if (this.winner >= 0) return;
    this.tick++;
    this.time += DT;
    this.pathBudget = 16;

    for (const bucket of this.hash) bucket.length = 0;
    for (const h of this.heroes) h.length = 0;
    this.strategists.length = 0;
    for (const u of this.units) {
      if (u.inside) continue; // sheltered units cannot be seen, hit or bumped
      const hx = Math.min(this.hashN - 1, Math.max(0, Math.floor(u.x / HASH)));
      const hy = Math.min(this.hashN - 1, Math.max(0, Math.floor(u.y / HASH)));
      this.hash[hy * this.hashN + hx].push(u);
      if (u.def.aura) this.heroes[u.owner].push(u);
      if (u.def.weaken) this.strategists.push(u);
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u && !u.dead) this.updateUnit(u);
    }
    this.pf = this.landPf;
    this.separate();
    this.pf = this.landPf;
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (b && !b.dead) this.updateBuilding(b);
    }
    this.updateProjectiles();
    if (this.tick % 20 === 0) this.updateCreeds();
    for (const q of this.quakes) {
      q.t -= DT;
      for (const b of this.buildings.slice()) {
        const h = b.size / 2;
        if (!this.hostile(b.owner, q.owner) || rectDist(q.x, q.y, b.x - h, b.y - h, b.x + h, b.y + h) > q.r) continue;
        b.hp -= 60 * DT;
        this.players[b.owner].lastAttacked = { x: b.x, y: b.y, t: this.time };
        if (b.hp <= 0) this.kill(b);
      }
    }
    if (this.quakes.length && this.quakes[0].t <= 0) this.quakes = this.quakes.filter((q) => q.t > 0);

    if (this.tick % 4 === 0) this.updateVision();
    if (this.tick % 600 === 0) for (const p of this.players) if (!p.neutral) p.history.push(this.score(p.id));
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
      p.popCap += b.def.pop + (b.type === 'house' ? p.mods.housePop + this.renown(b) : 0);
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

  /** A rough measure of how a player is doing: people, buildings, progress and deeds. */
  score(owner: number): number {
    const p = this.players[owner];
    if (p.defeated) return 0;
    let n = p.age * 150 + p.techs.size * 25 + p.stats.kills * 4 + p.stats.razed * 15;
    for (const u of this.units) if (u.owner === owner) n += u.type === 'villager' ? 8 : 10 + u.def.pop * 6;
    for (const b of this.buildings) if (b.owner === owner && b.complete && !b.def.wall) n += 20;
    return Math.round(n);
  }

  /** Seconds until a player's Wonder wins them the game, or -1 if they have none standing. */
  wonderLeft(owner: number): number {
    let best = -1;
    for (const b of this.buildings) {
      if (b.owner !== owner || b.type !== 'wonder' || !b.complete) continue;
      const left = Math.max(0, WONDER_TIME - (this.time - b.doneAt));
      if (best < 0 || left < best) best = left;
    }
    return best;
  }

  private checkVictory(): void {
    for (const p of this.players) {
      if (!p.neutral && !p.defeated && this.wonderLeft(p.id) === 0) {
        this.winner = p.id;
        this.events.push({ t: 'gameover', winner: p.id });
        return;
      }
    }
    const alive = new Set<number>();
    if (this.field) { for (const u of this.units) if (this.isMilitary(u)) alive.add(u.owner); }
    else for (const b of this.buildings) if (!b.def.wall) alive.add(b.owner);
    for (const p of this.players) {
      if (!p.defeated && !p.neutral && !alive.has(p.id)) {
        p.defeated = true;
        this.events.push({ t: 'defeated', player: p.id });
        for (const u of this.units.filter((u) => u.owner === p.id)) this.kill(u);
        if (this.field) for (const b of this.buildings.filter((b) => b.owner === p.id)) this.kill(b);
      }
    }
    // The game ends when only one side is left standing.
    const left = this.players.filter((p) => !p.defeated && !p.neutral);
    if (left.length && left.every((p) => p.team === left[0].team) && this.players.some((p) => !p.neutral && p.team !== left[0].team)) {
      this.winner = (left.find((p) => !p.isAI) ?? left[0]).id;
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
    // Allies share what they see.
    for (const u of this.units) if (!this.hostile(u.owner, this.humanId)) stamp(u.x, u.y, u.def.sight);
    for (const b of this.buildings) if (!this.hostile(b.owner, this.humanId)) stamp(b.x, b.y, (b.complete ? b.def.sight : 2) + b.size / 2);
    for (const b of this.buildings) {
      if (!b.seen && vis[Math.floor(b.y) * N + Math.floor(b.x)] === 2) b.seen = true;
    }
  }

  // ---- Units ----

  private moveAlong(u: Unit): 'done' | 'moving' | 'blocked' {
    if (!u.path) return 'done';
    let step = u.def.speed * (this.has(u, 'swift') ? 1.2 : 1) * (this.isElder(u) ? 0.85 : 1) * (u.def.cls === 'cavalry' ? this.players[u.owner].mods.cavSpeed : 1) * DT;
    if (u.def.charge) u.chargeD += step;
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
    if (this.pf.isBlocked(Math.floor(u.x), Math.floor(u.y)) && !this.pf.isBlocked(Math.floor(ox), Math.floor(oy))) {
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
    if ((u.pathFor !== t.id || drifted) && this.pathBudget <= 0) return 'moving'; // wait for a later tick
    if (u.pathFor !== t.id || drifted) {
      this.pathBudget--;
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
      if (this.pathBudget <= 0) return false; // wait for a later tick
      this.pathBudget--;
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
    this.pf = u.def.naval ? this.seaPf : this.landPf;
    this.pf.pass = 2 + this.players[u.owner].team; // gates open for their own side only
    u.px = u.x;
    u.py = u.y;
    if (u.inside) {
      const ship = this.entities.get(u.inside);
      if (ship && ship.kind === 'unit') { u.x = ship.x; u.y = ship.y; }
      if (u.growT > 0 && (u.growT -= DT) <= 0) this.comeOfAge(u);
      return;
    }
    u.moving = false;
    u.anchored = false;
    if (u.cooldown > 0) u.cooldown -= DT;
    if (u.attackAnim > 0) u.attackAnim -= DT;
    if (u.def.heal) this.updateHealer(u);
    if (u.def.aura && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 1.5 * DT); // heroes slowly regenerate
    if (u.def.mana && u.mana < u.def.mana) u.mana = Math.min(u.def.mana, u.mana + DT * this.players[u.owner].mods.faith * this.creed(u.owner).faith);
    if (u.growT > 0 && (u.growT -= DT) <= 0) this.comeOfAge(u);
    if (this.aging && u.lifespan > 0 && u.growT <= 0 && (u.age += DT) > u.lifespan) {
      this.events.push({ t: 'oldage', player: u.owner, name: `${u.name}${u.family ? ' ' + u.family : ''}` });
      this.kill(u);
      return;
    }
    if (u.plagueT > 0) {
      u.plagueT -= DT;
      u.hp -= 2.5 * DT;
      if (u.hp <= 0) { this.kill(u); return; }
      if ((this.tick + u.id) % 20 === 0) {
        for (const v of this.unitsNear(u.x, u.y, 1.3, this.scratch)) {
          if (v.owner === u.owner && v.plagueT <= 0 && this.rng() < 0.3 && Math.hypot(v.x - u.x, v.y - u.y) <= 1.3) v.plagueT = u.plagueT * 0.8;
        }
      }
    }

    const o = u.order;
    if (!o) {
      if (this.pf.isBlocked(Math.floor(u.x), Math.floor(u.y))) {
        const p = this.pf.nearestFree(u.x, u.y);
        this.setOrder(u, { t: 'move', x: p.x, y: p.y });
        return;
      }
      if (u.def.docile) {
        // Graze: amble around the home range.
        u.scanT -= DT;
        if (u.scanT <= 0) {
          u.scanT = 4 + this.rng() * 8;
          const a = this.rng() * 6.283, r = this.rng() * 4;
          this.setOrder(u, { t: 'move', x: u.homeX + Math.cos(a) * r, y: u.homeY + Math.sin(a) * r });
        }
        return;
      }
      if (u.def.atk > 0 && this.isMilitary(u)) {
        u.scanT -= DT;
        if (u.scanT <= 0) {
          u.scanT = 0.4;
          // Units holding their ground only strike what is already within reach.
          const hold = u.stance === 'hold';
          const e = this.findEnemy(u.owner, u.x, u.y, hold ? u.def.range + 1.2 : u.def.sight, u.def.minRange, u.def.siegeOnly, !u.def.naval && u.def.range < 1.5);
          if (e && (!hold || this.dist(u, e) <= u.def.range + 0.3)) this.setOrder(u, { t: 'attack', id: e.id, auto: true, ox: u.x, oy: u.y });
        }
      }
      return;
    }

    switch (o.t) {
      case 'move':
        if (this.walkTo(u, o)) this.setOrder(u, null);
        break;

      case 'patrol':
      case 'attackMove': {
        u.scanT -= DT;
        if (u.scanT <= 0) {
          u.scanT = 0.4;
          const e = this.findEnemy(u.owner, u.x, u.y, u.def.sight, u.def.minRange, u.def.siegeOnly, !u.def.naval && u.def.range < 1.5);
          if (e) {
            o.started = false;
            this.setOrder(u, { t: 'attack', id: e.id, then: o });
            break;
          }
        }
        if (this.walkTo(u, o)) {
          if (o.t === 'patrol') {
            // Turn round and walk the beat the other way.
            const back = o.x === o.bx && o.y === o.by;
            o.x = back ? o.ax : o.bx;
            o.y = back ? o.ay : o.by;
            o.started = false;
            u.path = null;
          } else this.setOrder(u, null);
        }
        break;
      }

      case 'attack': {
        const t = this.entities.get(o.id);
        if (!t || t.dead || !this.hostile(t.owner, u.owner) || t.kind === 'resource' || (u.def.siegeOnly && t.kind === 'unit')) { this.setOrder(u, o.then ?? null); break; }
        if (o.auto && Math.hypot(u.x - o.ox!, u.y - o.oy!) > LEASH[u.stance]) { this.setOrder(u, { t: 'move', x: o.ox!, y: o.oy! }); break; }
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

      case 'unload':
        if (this.walkTo(u, o)) { this.setOrder(u, null); this.unload(u); }
        break;

      case 'staff': {
        const b = this.entities.get(o.id);
        if (!b || b.kind !== 'building' || b.dead || !b.complete || (b.staff?.length ?? 0) >= (b.def.staff ?? 0)) { this.setOrder(u, null); break; }
        const r = this.approach(u, b, REACH);
        if (r === 'there') {
          (b.staff ??= []).push(u.id);
          u.inside = b.id;
          u.carryAmt = 0;
          this.setOrder(u, null);
          u.x = u.px = b.x;
          u.y = u.py = b.y;
        } else if (r === 'fail') this.setOrder(u, null);
        break;
      }

      case 'board': {
        const s = this.entities.get(o.id);
        if (!s || s.kind !== 'unit' || s.dead || !s.def.carry) { this.setOrder(u, null); break; }
        if ((s.cargo?.length ?? 0) >= s.def.carry) { this.msg(u.owner, 'The ship is full.'); this.setOrder(u, null); break; }
        const r = this.approach(u, s, 1.5);
        if (r === 'there') {
          (s.cargo ??= []).push(u.id);
          u.inside = s.id;
          this.setOrder(u, null);
          u.path = null;
          u.x = u.px = s.x;
          u.y = u.py = s.y;
        } else if (r === 'fail') { this.msg(u.owner, 'Bring the ship to the shore first.'); this.setOrder(u, null); }
        break;
      }

      case 'shelter': {
        const b = this.entities.get(o.id);
        if (!b || b.kind !== 'building' || b.dead || b.sheltered.length >= (b.def.shelter ?? 0)) { this.setOrder(u, o.then ?? null); break; }
        const r = this.approach(u, b, REACH);
        if (r === 'there') {
          b.sheltered.push(u.id);
          u.inside = b.id;
          u.resume = o.then ?? null;
          this.setOrder(u, null);
          u.x = u.px = b.x;
          u.y = u.py = b.y;
        } else if (r === 'fail') this.setOrder(u, o.then ?? null);
        break;
      }

      case 'cast': {
        const a = ABILITIES[o.ability];
        if (Math.hypot(o.x - u.x, o.y - u.y) <= u.def.range) {
          if (u.mana >= a.cost) {
            u.mana -= a.cost;
            u.attackAnim = 0.35;
            u.facing = Math.atan2(o.x - u.x, o.y - u.y);
            if (o.ability === 'plague') {
              for (const v of this.unitsNear(o.x, o.y, a.radius, this.scratch)) {
                if (this.hostile(v.owner, u.owner) && Math.hypot(v.x - o.x, v.y - o.y) <= a.radius) v.plagueT = 20;
              }
              this.events.push({ t: 'plague', x: o.x, y: o.y });
            } else {
              this.quakes.push({ x: o.x, y: o.y, r: a.radius, t: 5, owner: u.owner });
              this.events.push({ t: 'quake', x: o.x, y: o.y });
            }
          }
          this.setOrder(u, null);
        } else if (this.walkTo(u, o)) this.setOrder(u, null);
        break;
      }

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
          const p0 = this.players[u.owner];
          if (!b.complete) {
            const work = (DT / b.def.time) * (this.has(u, 'skilled') ? 1.6 : 1) * p0.mods.build;
            b.progress += work;
            b.hp = Math.min(b.maxHp, b.hp + b.maxHp * work);
            if (b.progress >= 1) {
              b.progress = 1;
              b.complete = true;
              b.doneAt = this.time;
              if (b.type === 'wonder') this.events.push({ t: 'wonder', player: b.owner });
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

  /** A child grows up: it can now work, and takes up a parent's trade unless the house has a rally point. */
  private comeOfAge(u: Unit): void {
    u.growT = 0;
    this.setTrait(u, u.trait, u.trait2); // full adult health
    this.events.push({ t: 'grown', player: u.owner, x: u.x, y: u.y });
    if (u.order || u.inside) return;
    const home = this.entities.get(u.bornAt);
    if (!home || home.kind !== 'building') return;
    if (home.hasRally) {
      const t = this.entities.get(home.rallyId);
      if (t && !t.dead) this.cmdTarget(u.owner, [u.id], t.id);
      else this.cmdMove(u.owner, [u.id], home.rallyX, home.rallyY);
      return;
    }
    const parents = [home.residents.m, home.residents.f].map((id) => this.entities.get(id));
    if (this.rng() < 0.5) parents.reverse();
    for (const par of parents) {
      const job = par && par.kind === 'unit' ? this.job(par) : null;
      const src = job && job.t === 'gather' ? this.entities.get(job.id) : null;
      if (src && !(src.kind === 'building' && src.type === 'farm')) { this.cmdTarget(u.owner, [u.id], src.id); break; }
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
        p.stats.gathered += u.carryAmt;
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
      t = this.findResourceNear(o.nx, o.ny, o.res, u.owner, 14, 0, !!u.def.fisher) ?? undefined;
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
      const alt = o.fails <= 3 ? this.findResourceNear(u.x, u.y, o.res, u.owner, 14, t.id, !!u.def.fisher) : null;
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
    u.gatherT += DT * GATHER_RATE[t.type] * p.mods.gather * (1 - MAID_DISTRACTION * Math.min(STAFF_CAP, p.maids)) * (this.has(u, 'strong') ? 1.25 : 1) * (this.isElder(u) ? 0.75 : 1) * (t.type === 'farm' ? p.mods.farm : t.type === 'carcass' ? p.mods.hunt : t.type === 'gold' ? this.creed(u.owner).gold : 1);
    while (u.gatherT >= 1) {
      u.gatherT -= 1;
      u.carryAmt++;
      if (t.kind === 'resource') {
        t.amount--;
        if (t.amount <= 0) { this.kill(t); break; }
      }
    }
    if (u.carryAmt >= p.mods.carry * (u.def.fisher ? 2 : 1)) {
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
        if (v.owner !== u.owner || v === u || (v.hp >= v.maxHp && v.plagueT <= 0)) continue;
        if (Math.hypot(v.x - u.x, v.y - u.y) > u.def.range) continue;
        const f = v.hp / v.maxHp - (v.plagueT > 0 ? 1 : 0);
        if (f < worst) { worst = f; best = v; }
      }
      if (!best && u.hp < u.maxHp) best = u;
      u.healTarget = best ? best.id : 0;
      t = best ?? undefined;
    }
    if (t && t.kind === 'unit') {
      t.plagueT = 0;
      t.hp = Math.min(t.maxHp, t.hp + u.def.heal! * this.players[u.owner].mods.heal * this.creed(u.owner).heal * DT);
      if (t.hp >= t.maxHp) u.healTarget = 0;
    }
  }

  private separate(): void {
    const near: Unit[] = [];
    const N = this.size;
    for (const u of this.units) {
      if (u.anchored || u.inside) continue;
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
      this.pf = u.def.naval ? this.seaPf : this.landPf;
      this.pf.pass = 2 + this.players[u.owner].team;
      if (this.pf.isBlocked(Math.floor(nx), Math.floor(ny))) continue;
      u.x = nx;
      u.y = ny;
    }
  }

  // ---- Combat ----

  private strike(u: Unit, t: Entity): void {
    const p = this.players[u.owner];
    u.cooldown = u.def.cooldown * (u.def.frenzy ? 0.45 + 0.55 * (u.hp / u.maxHp) : 1);
    u.attackAnim = 0.35;
    let atk = u.def.atk + (this.isMilitary(u) ? p.mods.atk : 0);
    if (u.def.charge) { if (u.chargeD >= 3) atk *= u.def.charge; u.chargeD = 0; }
    if (u.def.homeBonus && this.moraleAt(u.owner, u.x, u.y) > 0) atk *= u.def.homeBonus;
    if (u.def.burn && t.kind === 'building') t.burnT = 8;
    if (u.def.drain) u.hp = Math.min(u.maxHp, u.hp + u.def.drain);
    const aura = (u.def.aura ? 1 : this.auraAt(u.owner, u.x, u.y)) * this.weakenAt(u.owner, u.x, u.y);
    if (u.def.projectile) {
      this.projectiles.push({
        x: u.x, y: u.y, sx: u.x, sy: u.y, tx: t.x, ty: t.y, targetId: t.id,
        speed: u.def.projectile === 'boulder' ? 7 : u.def.projectile === 'shot' ? 26 : 13, owner: u.owner, atk, aura, cls: u.def.cls,
        bonus: u.def.bonus, splash: u.def.splash ?? 0, kind: u.def.projectile, done: false,
      });
    } else {
      this.hit(u.owner, atk, aura, u.def.cls, u.def.bonus, t, 1);
      if (u.def.splash) {
        for (const v of this.unitsNear(t.x, t.y, u.def.splash, this.scratch.slice())) {
          if (this.hostile(v.owner, u.owner) && v !== t && Math.hypot(v.x - t.x, v.y - t.y) <= u.def.splash) {
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
    if (t.kind === 'unit' && t.def.rangedResist && (cls === 'ranged' || cls === 'building')) mult *= 1 - t.def.rangedResist;
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
    if (t.hp <= 0) {
      const s = this.players[owner].stats, ts = tp.stats;
      if (t.kind === 'unit') { s.kills++; ts.lost++; } else { s.razed++; ts.buildingsLost++; }
      this.kill(t);
    }
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
          if (this.hostile(v.owner, p.owner) && Math.hypot(v.x - p.x, v.y - p.y) <= p.splash) this.hit(p.owner, p.atk, p.aura, p.cls, p.bonus, v, 1);
        }
        for (const b of this.buildings.slice()) {
          const h = b.size / 2;
          if (this.hostile(b.owner, p.owner) && rectDist(p.x, p.y, b.x - h, b.y - h, b.x + h, b.y + h) <= p.splash * 0.5) {
            this.hit(p.owner, p.atk, p.aura, p.cls, p.bonus, b, 1);
          }
        }
      } else if (t && !t.dead) this.hit(p.owner, p.atk, p.aura, p.cls, p.bonus, t, 1);
    }
    if (ps.some((p) => p.done)) this.projectiles = ps.filter((p) => !p.done);
  }

  // ---- Buildings ----

  /** Turn a unit into another type, keeping its place, orders and share of health. */
  private reequip(u: Unit, type: string): void {
    const def = UNITS[type];
    this.players[u.owner].pop += def.pop - u.def.pop;
    u.hp = (u.hp / u.maxHp) * def.hp;
    u.maxHp = def.hp;
    u.type = type;
    u.def = def;
  }

  /** What training `type` produces for this player once upgrades are taken into account. */
  trainedAs(owner: number, type: string): string {
    const up = this.players[owner].upgrades;
    while (up[type]) type = up[type];
    return type;
  }

  /** Free cell next to a building, closest to a desired point. */
  private exitSpot(b: Building, tx: number, ty: number, naval = false): { x: number; y: number } {
    if (naval) { const p = this.exitSpotOn(this.seaPf, b, tx, ty); return p; }
    return this.exitSpotOn(this.landPf, b, tx, ty);
  }
  private exitSpotOn(pf: Pathfinder, b: Building, tx: number, ty: number): { x: number; y: number } {
    pf.pass = 2 + this.players[b.owner].team;
    let best = { x: b.x, y: b.y + b.size / 2 + 0.5 };
    let bestD = Infinity;
    for (let y = b.cy - 1; y <= b.cy + b.size; y++)
      for (let x = b.cx - 1; x <= b.cx + b.size; x++) {
        if (x >= b.cx && x < b.cx + b.size && y >= b.cy && y < b.cy + b.size) continue;
        if (pf.isBlocked(x, y)) continue;
        const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
        if (d < bestD) { bestD = d; best = { x: x + 0.5, y: y + 0.5 }; }
      }
    return bestD === Infinity ? pf.nearestFree(best.x, best.y) : best;
  }

  private spawnFrom(b: Building, type: string, gender?: Gender): Unit {
    const tx = b.hasRally ? b.rallyX : b.x;
    const ty = b.hasRally ? b.rallyY : b.y + b.size;
    const s = this.exitSpot(b, tx, ty, !!UNITS[type].naval);
    const u = this.spawnUnit(type, b.owner, s.x, s.y, gender);
    if (b.hasRally) {
      const t = this.entities.get(b.rallyId);
      if (t && !t.dead) this.cmdTarget(b.owner, [u.id], t.id);
      else this.cmdMove(b.owner, [u.id], b.rallyX, b.rallyY);
    }
    return u;
  }

  private updateBuilding(b: Building): void {
    if (b.burnT > 0) {
      b.burnT -= DT;
      b.hp -= 5 * DT;
      if (b.hp <= 0) { this.kill(b); return; }
    }
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
            p.stats.trained++;
          } else q.blocked = true;
        } else if (q.kind === 'tech') {
          b.queue.shift();
          p.pending.delete(q.id);
          p.techs.add(q.id);
          TECHS[q.id].apply(p.mods);
          const up = TECHS[q.id].upgrade;
          if (up) {
            p.upgrades[up[0]] = up[1];
            for (const u of this.units) if (u.owner === b.owner && u.type === up[0]) this.reequip(u, up[1]);
          }
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
            this.setOrder(child, null);
            child.growT = GROW_TIME;
            child.bornAt = b.id;
            // Children take after their parents: usually one of their traits, now and then something new.
            const mother = this.entities.get(b.residents.f) as Unit, father = this.entities.get(b.residents.m) as Unit;
            const roll = this.rng();
            const trait = roll < 0.45 ? mother.trait : roll < 0.9 ? father.trait : Object.keys(VILLAGER_TRAITS)[Math.floor(this.rng() * 4)];
            // One child in four of two gifted parents gets both gifts.
            const other = trait === mother.trait ? father.trait : mother.trait;
            const second = trait && other && other !== trait && this.rng() < 0.25 ? other : '';
            if (!b.family) b.family = FAMILY_NAMES[Math.floor(this.rng() * FAMILY_NAMES.length)];
            child.family = b.family;
            child.maxHp = child.hp = Math.round(child.def.hp * 0.4);
            this.setTrait(child, trait, second);
            p.stats.born++;
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
        const range = b.def.range! + b.size / 2 + p.mods.towerRange;
        let best: Unit | null = null;
        let bestD = range;
        for (const v of this.unitsNear(b.x, b.y, range, this.scratch)) {
          const d = Math.hypot(v.x - b.x, v.y - b.y);
          if (this.hostile(v.owner, b.owner) && !v.def.docile && d < bestD) { bestD = d; best = v; }
        }
        if (best) {
          b.cooldown = b.def.cooldown! / (1 + 0.3 * b.sheltered.length); // sheltered villagers help shoot
          this.projectiles.push({
            x: b.x, y: b.y, sx: b.x, sy: b.y, tx: best.x, ty: best.y, targetId: best.id, speed: 13, owner: b.owner,
            atk: b.def.atk + p.mods.towerAtk, aura: 1, cls: 'building', splash: 0, kind: 'arrow', done: false,
          });
        }
      }
    }
  }
}
