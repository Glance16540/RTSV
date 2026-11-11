// Computer opponent. Plays by the same rules and commands as a human (but ignores fog of war).

import { ABILITIES, AGES, BUILDINGS, ResType, TECHS, UNITS } from './data';
import { Building, Entity, Game, Unit } from './game';

const VILLAGER_TARGET = [16, 26, 34, 40];
const AGE_VILLAGERS = [12, 18, 24];
const ARMY_TARGET = [4, 10, 18, 26];
const ARMY_MIX: string[][] = [
  ['clubman', 'clubman', 'slinger'],
  ['spearman', 'bowman', 'rider', 'bowman', 'spearman', 'mammoth', 'shaman'],
  ['swordsman', 'bowman', 'rider', 'prophet', 'swordsman', 'catapult', 'mammoth', 'shaman'],
  ['swordsman', 'crossbowman', 'knight', 'prophet', 'crossbowman', 'catapult', 'knight', 'shaman'],
];
const BUILD_ORDER: { type: string; age: number; villagers: number; count: number }[] = [
  { type: 'barracks', age: 0, villagers: 8, count: 1 },
  { type: 'storehouse', age: 0, villagers: 10, count: 1 },
  { type: 'range', age: 1, villagers: 0, count: 1 },
  { type: 'stable', age: 1, villagers: 0, count: 1 },
  { type: 'blacksmith', age: 1, villagers: 0, count: 1 },
  { type: 'temple', age: 1, villagers: 0, count: 1 },
  { type: 'tower', age: 1, villagers: 0, count: 2 },
  { type: 'workshop', age: 2, villagers: 0, count: 1 },
  { type: 'barracks', age: 2, villagers: 0, count: 2 },
];

export class AIController {
  level = 1;
  private state: 'build' | 'attack' = 'build';
  private mixI = 0;
  private attackT = 0;
  private rebalanceT = 0;
  /** Seconds before the first attack may launch. */
  firstAttack = 420;
  /** Multiplier on how large an army the AI wants. */
  armyScale = 1;

  constructor(private game: Game, private pid: number) {}

  /** 0 easy, 1 normal, 2 hard. */
  setLevel(level: number): void {
    this.level = level;
    this.firstAttack = [660, 420, 270][level];
    this.armyScale = [0.65, 1, 1.3][level];
    this.game.players[this.pid].mods.gather += [-0.2, 0, 0.2][level];
  }

  /** Called once per simulated second. */
  update(): void {
    const g = this.game, pid = this.pid;
    const p = g.players[pid];
    if (p.defeated) return;

    const villagers: Unit[] = [], army: Unit[] = [];
    for (const u of g.units) {
      if (u.owner !== pid) continue;
      if (u.type === 'villager') { if (u.growT <= 0) villagers.push(u); }
      else army.push(u);
    }
    const mine = g.buildings.filter((b) => b.owner === pid);
    const count = (type: string) => mine.filter((b) => b.type === type).length;
    const tc = mine.find((b) => b.type === 'towncenter' && b.complete) ?? mine.find((b) => b.type === 'towncenter');
    const home = tc ?? mine[0];
    if (!home) return;
    const underAttack = p.lastAttacked && g.time - p.lastAttacked.t < 6 && Math.hypot(p.lastAttacked.x - home.x, p.lastAttacked.y - home.y) < 28;

    // Town bell: hide the villagers while raiders are in the village.
    const raiders = underAttack ? g.units.filter((u) => u.owner !== pid && u.owner !== g.wild && u.def.atk > 3 && Math.hypot(u.x - home.x, u.y - home.y) < 13).length : 0;
    if (!p.bell && raiders >= 3) g.cmdBell(pid, true);
    else if (p.bell && (!p.lastAttacked || g.time - p.lastAttacked.t > 10)) g.cmdBell(pid, false);

    // ---- Economy ----
    const wantAge = p.age < AGES.length - 1 && !p.agingUp && villagers.length >= AGE_VILLAGERS[p.age] && count('barracks') > 0;
    const saving = wantAge && !underAttack;

    if (tc && tc.complete && villagers.length < VILLAGER_TARGET[p.age] && tc.queue.length < 2 && !(saving && villagers.length >= AGE_VILLAGERS[p.age] + 2)) {
      g.cmdTrain(pid, tc.id, 'villager');
    }
    if (wantAge && tc && tc.complete && g.canAfford(p, AGES[p.age + 1].cost)) g.cmdAgeUp(pid, tc.id);

    const building = mine.filter((b) => !b.complete);
    const builders = new Set<number>();
    for (const v of villagers) if (v.order?.t === 'build') builders.add(v.order.id);
    for (const b of building) {
      if (!builders.has(b.id)) {
        const v = this.pickBuilder(villagers, b.x, b.y);
        if (v) g.cmdTarget(pid, [v.id], b.id);
      }
    }

    // Houses: keep population headroom, and fill them with couples.
    const housesBuilding = building.filter((b) => b.type === 'house').length;
    if (p.popCap - p.pop < 5 && p.popCap < 150 && housesBuilding < (p.age > 0 ? 2 : 1)) this.build('house', home, villagers, 5, 13);
    const enough = villagers.length >= VILLAGER_TARGET[p.age];
    for (const h of mine) {
      if (h.type !== 'house' || !h.complete) continue;
      if (!h.residents.m || !h.residents.f) g.cmdAutoResidents(pid, h.id);
      // Families keep growing on their own, so tell them when the village is big enough.
      h.birthsPaused = enough || (saving && p.res.food < AGES[p.age + 1].cost.food!);
    }

    // Other buildings, one at a time.
    if (!building.some((b) => b.type !== 'house' && b.type !== 'farm')) {
      for (const step of BUILD_ORDER) {
        if (step.age > p.age || villagers.length < step.villagers || count(step.type) >= step.count) continue;
        if (saving && step.type !== 'barracks') continue;
        if (g.canAfford(p, BUILDINGS[step.type].cost)) this.build(step.type, home, villagers, 7, 18);
        break;
      }
    }

    this.assignWorkers(villagers, mine, home);

    // Technologies.
    if (!saving) {
      for (const b of mine) {
        if (!b.complete || b.queue.length) continue;
        for (const id of b.def.techs) {
          const t = TECHS[id];
          if (g.techAvailable(p, id) && g.canAfford(p, { food: (t.cost.food ?? 0) + 150, wood: (t.cost.wood ?? 0) + 100, gold: t.cost.gold, stone: t.cost.stone })) {
            g.cmdResearch(pid, b.id, id);
            break;
          }
        }
      }
    }

    // ---- Military ----
    const fighters = army.filter((u) => u.def.atk > 0);
    const armyTarget = Math.round(ARMY_TARGET[p.age] * this.armyScale);
    this.castCalamities(army);
    if ((!saving || underAttack) && army.length < armyTarget + (underAttack ? 6 : 0)) {
      const mix = ARMY_MIX[p.age];
      for (let k = 0; k < mix.length; k++) {
        const type = mix[(this.mixI + k) % mix.length];
        const def = UNITS[type];
        const src = mine.find((b) => b.complete && b.def.trains.includes(type) && b.queue.length < 2);
        if (!src || !g.canAfford(p, def.cost)) continue;
        if (type === 'shaman' && g.countUnits(pid, 'shaman') >= 2) continue;
        if (type === 'prophet' && g.countUnits(pid, 'prophet') >= 1) continue;
        if (g.cmdTrain(pid, src.id, type)) { this.mixI = (this.mixI + k + 1) % mix.length; break; }
      }
      if (p.age >= 1 && tc && tc.complete && !saving && g.countUnits(pid, 'warlord') === 0 && g.canAfford(p, UNITS.warlord.cost)) {
        g.cmdTrain(pid, tc.id, 'warlord');
      }
    }

    if (underAttack && this.state === 'build') {
      const idle = army.filter((u) => !u.order || u.order.t === 'move');
      if (idle.length) g.cmdMove(pid, idle.map((u) => u.id), p.lastAttacked!.x, p.lastAttacked!.y, true);
    }

    const attackSize = Math.max(4, Math.floor(armyTarget * 0.8));
    if (this.state === 'build') {
      if (fighters.length >= attackSize && g.time > this.firstAttack && !underAttack) {
        this.state = 'attack';
        this.attackT = 0;
      } else {
        // Keep idle troops gathered in front of the base.
        const mid = g.size / 2;
        const d = Math.hypot(mid - home.x, mid - home.y) || 1;
        const rx = home.x + ((mid - home.x) / d) * 9, ry = home.y + ((mid - home.y) / d) * 9;
        const stray = army.filter((u) => !u.order && Math.hypot(u.x - rx, u.y - ry) > 6);
        if (stray.length) g.cmdMove(pid, stray.map((u) => u.id), rx, ry, false);
      }
    } else {
      if (fighters.length < 3) this.state = 'build';
      else if ((this.attackT -= 1) <= 0) {
        this.attackT = 5;
        const target = this.pickTarget(home);
        if (target) {
          const idle = army.filter((u) => !u.order);
          if (idle.length) g.cmdMove(pid, idle.map((u) => u.id), target.x, target.y, true);
        }
      }
    }
  }

  /** Prophets strike clumps of enemy troops with plague and enemy buildings with earthquakes. */
  private castCalamities(army: Unit[]): void {
    const g = this.game;
    for (const u of army) {
      if (!u.def.mana || u.order?.t === 'cast') continue;
      if (u.mana >= ABILITIES.plague.cost) {
        const near = g.units.filter((v) => v.owner !== this.pid && v.owner !== g.wild && v.plagueT <= 0 && Math.hypot(v.x - u.x, v.y - u.y) < 11);
        if (near.length >= 3) { g.cmdCast(this.pid, [u.id], 'plague', near[0].x, near[0].y); continue; }
      }
      if (u.mana >= ABILITIES.quake.cost) {
        const b = g.buildings.find((v) => v.owner !== this.pid && Math.hypot(v.x - u.x, v.y - u.y) < 11);
        if (b) g.cmdCast(this.pid, [u.id], 'quake', b.x, b.y);
      }
    }
  }

  /** State to store in a saved game. */
  save(): object {
    return { level: this.level, state: this.state, mixI: this.mixI, attackT: this.attackT, firstAttack: this.firstAttack, armyScale: this.armyScale };
  }

  load(s: Partial<AIController> & { state?: 'build' | 'attack'; mixI?: number; attackT?: number }): void {
    Object.assign(this, s);
  }

  private route(from: Unit, to: Entity): { partial: boolean } {
    this.game.pf.pass = 2 + this.pid;
    return this.game.pf.find(from.x, from.y, to.x, to.y, to.x, to.y, 1);
  }

  private pickTarget(home: Entity): Entity | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const b of this.game.buildings) {
      if (b.owner === this.pid || b.def.wall) continue;
      const d = Math.hypot(b.x - home.x, b.y - home.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  private pickBuilder(villagers: Unit[], x: number, y: number): Unit | null {
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const v of villagers) {
      const o = v.order;
      if (v.inside || (o && (o.t === 'build' || o.t === 'movein' || o.t === 'shelter'))) continue;
      const d = Math.hypot(v.x - x, v.y - y) + (o ? (o.t === 'gather' && o.res === 'wood' ? 4 : 10) : 0);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  /** Find a spot with a one-tile margin so the base does not wall itself in. */
  private findSpot(type: string, x: number, y: number, minR: number, maxR: number): { cx: number; cy: number } | null {
    const g = this.game;
    const s = BUILDINGS[type].size;
    for (let r = minR; r <= maxR; r += 1.5) {
      const steps = Math.ceil(r * 5);
      const a0 = g.rng() * Math.PI * 2;
      for (let k = 0; k < steps; k++) {
        const a = a0 + (k / steps) * Math.PI * 2;
        const cx = Math.round(x + Math.cos(a) * r - s / 2), cy = Math.round(y + Math.sin(a) * r - s / 2);
        let ok = true;
        for (let yy = cy - 1; yy <= cy + s && ok; yy++)
          for (let xx = cx - 1; xx <= cx + s; xx++) {
            if (xx < 1 || yy < 1 || xx >= g.size - 1 || yy >= g.size - 1 || g.occupied[yy * g.size + xx]) { ok = false; break; }
          }
        if (ok) return { cx, cy };
      }
    }
    return null;
  }

  private build(type: string, near: { x: number; y: number }, villagers: Unit[], minR: number, maxR: number): Building | null {
    const g = this.game;
    if (!g.canAfford(g.players[this.pid], BUILDINGS[type].cost)) return null;
    const spot = this.findSpot(type, near.x, near.y, minR, maxR);
    if (!spot) return null;
    const v = this.pickBuilder(villagers, spot.cx, spot.cy);
    if (!v) return null;
    return g.cmdPlace(this.pid, type, spot.cx, spot.cy, [v.id]);
  }

  private assignWorkers(villagers: Unit[], mine: Building[], home: Building): void {
    const g = this.game, pid = this.pid;
    const p = g.players[pid];
    const want: Record<ResType, number> =
      p.age === 0 ? { food: 0.5, wood: 0.4, gold: 0.07, stone: 0.03 }
        : p.age === 1 ? { food: 0.42, wood: 0.3, gold: 0.2, stone: 0.08 }
          : { food: 0.38, wood: 0.24, gold: 0.3, stone: 0.08 };
    const order: ResType[] = ['food', 'wood', 'gold', 'stone'];
    const have: Record<ResType, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
    const idle: Unit[] = [];
    let hunters = 0;
    for (const v of villagers) {
      if (v.order?.t === 'gather') have[v.order.res]++;
      else if (v.order?.t === 'attack') { have.food++; hunters++; }
      else if (!v.order && !v.inside) idle.push(v);
    }
    // Lean away from whatever is already piling up and towards what is running out.
    for (const r of order) want[r] *= p.res[r] < 100 ? 2.2 : p.res[r] < 250 ? 1.4 : p.res[r] > 1500 ? 0.25 : p.res[r] > 800 ? 0.6 : 1;
    const sum = want.food + want.wood + want.gold + want.stone;
    for (const r of order) want[r] /= sum;
    const total = Math.max(1, villagers.length);
    const deficit = (r: ResType) => want[r] * total - have[r];

    // Every so often move one worker from the most over-staffed resource to the most needed one.
    if (!idle.length && (this.rebalanceT -= 1) <= 0) {
      this.rebalanceT = 6;
      const sorted = order.slice().sort((a, b) => deficit(b) - deficit(a));
      const need = sorted[0], over = sorted[3];
      if (deficit(need) - deficit(over) > 2) {
        const v = villagers.find((u) => u.order?.t === 'gather' && u.order.res === over);
        if (v) { idle.push(v); have[over]--; }
      }
    }

    const farms = mine.filter((b) => b.type === 'farm');
    let farmCount = farms.length;
    for (const v of idle) {
      const sorted = order.slice().sort((a, b) => deficit(b) - deficit(a));
      for (const res of sorted) {
        let t = g.findResourceNear(home.x, home.y, res, pid, res === 'food' ? 18 : res === 'wood' ? 40 : 64);
        if (!t && res === 'food') {
          // Hunt nearby deer with a couple of villagers, as long as they can actually be reached.
          const deer = hunters < 3 ? g.units.find((u) => u.type === 'deer' && Math.hypot(u.x - home.x, u.y - home.y) < 18
            && !this.route(v, u).partial) : undefined;
          if (deer) { g.cmdTarget(pid, [v.id], deer.id); have.food++; hunters++; break; }
          if (farmCount < want.food * total + 3 && farms.filter((f) => !f.complete).length < 3 && p.res.wood >= BUILDINGS.farm.cost.wood!) {
            const spot = this.findSpot('farm', home.x, home.y, 5, 14);
            if (spot && g.cmdPlace(pid, 'farm', spot.cx, spot.cy, [v.id])) { have.food++; farmCount++; break; }
          }
          continue;
        }
        if (!t) continue;
        // Prefer the node closest to this villager among those near home.
        const near = g.findResourceNear(v.x, v.y, res, pid, 10);
        if (near && Math.hypot(near.x - home.x, near.y - home.y) < 34) t = near;
        g.cmdTarget(pid, [v.id], t.id);
        have[res]++;
        // Long walks waste time: put a storehouse next to distant resources.
        if (t.kind === 'resource') {
          const drop = g.nearestDropoff(v);
          const far = !mine.some((b) => b.def.dropoff && Math.hypot(b.x - t!.x, b.y - t!.y) < 9);
          if (drop && far && p.res.wood >= 60 && !mine.some((b) => b.type === 'storehouse' && !b.complete)) {
            const spot = this.findSpot('storehouse', t.x, t.y, 2.5, 6);
            if (spot) g.cmdPlace(pid, 'storehouse', spot.cx, spot.cy, [v.id]);
          }
        }
        break;
      }
    }
  }
}
