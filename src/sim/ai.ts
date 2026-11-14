// Computer opponent. Plays by the same rules and commands as a human (but ignores fog of war).

import { T_MARSH } from './map';
import { ABILITIES, AGES, BUILDINGS, CIVS, ResType, TECHS, TRADE, UNITS } from './data';
import { Building, Entity, Game, Unit } from './game';
import { LEANING, isDecadent } from './creed';
import { battleHabits, leaningWith } from './temper';

const VILLAGER_TARGET = [16, 26, 34, 40, 44];
const AGE_VILLAGERS = [12, 18, 24, 30];
const ARMY_TARGET = [4, 10, 18, 26, 32];
const ARMY_MIX: string[][] = [
  ['clubman', 'slinger', 'hound', 'clubman', 'javelineer'],
  ['spearman', 'bowman', 'rider', 'chariot', 'bowman', 'spearman', 'mammoth', 'shaman', 'hound'],
  ['swordsman', 'bowman', 'rider', 'prophet', 'berserker', 'ram', 'scorpion', 'catapult', 'mammoth', 'shaman', 'spearman'],
  ['swordsman', 'crossbowman', 'knight', 'prophet', 'pikeman', 'berserker', 'ram', 'catapult', 'knight', 'shaman', 'spearman', 'bowman'],
  ['musketeer', 'knight', 'bombard', 'prophet', 'grenadier', 'hussar', 'musketeer', 'pikeman', 'ram', 'shaman', 'spearman', 'bowman'],
];
const BUILD_ORDER: { type: string; age: number; villagers: number; count: number }[] = [
  { type: 'barracks', age: 0, villagers: 8, count: 1 },
  { type: 'storehouse', age: 0, villagers: 10, count: 1 },
  { type: 'range', age: 1, villagers: 0, count: 1 },
  { type: 'stable', age: 1, villagers: 0, count: 1 },
  { type: 'blacksmith', age: 1, villagers: 0, count: 1 },
  { type: 'market', age: 1, villagers: 0, count: 1 },
  { type: 'temple', age: 1, villagers: 0, count: 1 },
  { type: 'tower', age: 1, villagers: 0, count: 2 },
  { type: 'workshop', age: 2, villagers: 0, count: 1 },
  { type: 'wonder', age: 3, villagers: 0, count: 1 },
  { type: 'barracks', age: 2, villagers: 0, count: 2 },
];

export class AIController {
  level = 1;
  private state: 'build' | 'attack' = 'build';
  private mixI = 0;
  private attackT = 0;
  private rebalanceT = 0;
  private holdWood = false;
  /** Cells of the planned wall around the base, and how far along it construction has got. */
  private ring: { cx: number; cy: number }[] | null = null;
  private ringI = 0;
  private wallT = 0;
  /** Building the army is currently marching on. */
  private targetId = 0;
  /** Time of the last ally signal this AI answered. */
  private signalT = -1;
  /** How many fighters set out on the present attack, and when the army was first large enough to go. */
  private launched = 0;
  private readyT = -1;
  /** Marching on the marauders' camp, not on a rival. */
  private hunt = false;
  private knowsLair = false;
  /** Seconds before the first attack may launch. */
  firstAttack = 420;
  /** Multiplier on how large an army the AI wants. */
  armyScale = 1;

  /** No hall stands: every hand and every log goes to raising one. */
  private founding = false;
  constructor(private game: Game, private pid: number) {}

  /** 0 easy, 1 normal, 2 hard. */
  setLevel(level: number): void {
    this.level = level;
    // A leader with a temperament of their own attacks sooner or later, with more or fewer, than the level alone says.
    const habits = battleHabits(this.game.players[this.pid].civ);
    this.firstAttack = [660, 420, 270][level] * habits.haste;
    this.armyScale = [0.5, 1, 1.3][level] * habits.army;
    this.game.players[this.pid].mods.gather += [-0.35, 0, 0.2][level];
  }

  /** Called once per simulated second. */
  update(): void {
    const g = this.game, pid = this.pid;
    const p = g.players[pid];
    if (p.defeated) return;
    if (g.field) { this.fieldBattle(); return; }

    const villagers: Unit[] = [], army: Unit[] = [], ships: Unit[] = [];
    for (const u of g.units) {
      if (u.owner !== pid) continue;
      if (u.type === 'villager') { if (u.growT <= 0) villagers.push(u); }
      else if (u.def.naval) ships.push(u);
      else army.push(u);
    }
    const mine = g.buildings.filter((b) => b.owner === pid);
    const count = (type: string) => mine.filter((b) => b.type === type).length;
    const tc = mine.find((b) => b.type === 'towncenter' && b.complete) ?? mine.find((b) => b.type === 'towncenter');
    const home = tc ?? mine[0];
    if (!home) {
      // A raiding band with no roof yet: settle where it stands.
      if (g.raider(pid) && villagers.length && Math.floor(g.time) % 2 === 0) this.build('towncenter', g.spec.starts[pid], villagers, 0, 9);
      return;
    }
    // A settled people whose hall is gone (razed in an earlier siege of this land) raise it again before anything
    // else: without it there are no new villagers and no new age. Until it is begun, nothing else is built.
    this.founding = !tc && (!g.raider(pid) || !!p.hadHall); // a war band that has settled once is a people like any other
    if (this.founding && villagers.length) this.build('towncenter', g.spec.starts[pid], villagers, 0, 12);
    // With nowhere to bring wood and stone, there will never be enough for a hall: a storehouse comes first.
    if (this.founding && villagers.length && !g.canAfford(p, BUILDINGS.towncenter.cost) && !mine.some((b) => b.def.dropoff) && g.canAfford(p, BUILDINGS.storehouse.cost)) {
      // It goes beside what is most wanted, stone before wood, so that no one walks far with a load.
      const st = g.spec.starts[pid], cost = BUILDINGS.towncenter.cost;
      const node = (p.res.stone < (cost.stone ?? 0) ? g.findResourceNear(st.x, st.y, 'stone', pid, 40) : null) ?? g.findResourceNear(st.x, st.y, 'wood', pid, 40);
      const at = (node && this.findSpot('storehouse', node.x, node.y, 2.5, 6)) ?? this.findSpot('storehouse', st.x, st.y, 3, 10), v = at && this.pickBuilder(villagers, at.cx, at.cy);
      if (at && v) g.cmdPlace(pid, 'storehouse', at.cx, at.cy, [v.id]);
    }
    const underAttack = p.lastAttacked && g.time - p.lastAttacked.t < 6 && Math.hypot(p.lastAttacked.x - home.x, p.lastAttacked.y - home.y) < 28;

    // Town bell: hide the villagers while raiders are in the village.
    const raiders = underAttack ? g.units.filter((u) => g.hostile(u.owner, pid) && u.owner !== g.wild && u.def.atk > 3 && Math.hypot(u.x - home.x, u.y - home.y) < 13).length : 0;
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
    // One villager works its way along a stretch of wall; do not send one per segment.
    const walling = villagers.some((v) => v.order?.t === 'build' && (g.entities.get(v.order.id) as Building | undefined)?.def.wall);
    for (const b of building) {
      if (!builders.has(b.id) && !(b.def.wall && walling)) {
        const v = this.pickBuilder(villagers, b.x, b.y);
        if (v) g.cmdTarget(pid, [v.id], b.id);
      }
    }

    // Gold lying idle while the larder or the woodpile is bare: wood is kept back for a market before more fields.
    this.holdWood = p.age >= 1 && count('market') === 0 && !building.some((b) => b.type === 'market') && p.res.gold > 400 && (p.res.food < 100 || p.res.wood < 100);
    // Houses: keep population headroom, and fill them with couples.
    const housesBuilding = building.filter((b) => b.type === 'house').length;
    if (p.popCap - p.pop < 5 && p.popCap < 150 && housesBuilding < (p.age > 0 ? 2 : 1)) this.build('house', home, villagers, 5, 12);
    const enough = villagers.length >= VILLAGER_TARGET[p.age];
    for (const h of mine) {
      if (h.type !== 'house' || !h.complete) continue;
      if (!h.residents.m || !h.residents.f) g.cmdAutoResidents(pid, h.id);
      // Families keep growing on their own, so tell them when the village is big enough.
      h.birthsPaused = enough || (saving && p.res.food < AGES[p.age + 1].cost.food!);
    }

    // Other buildings, one at a time.
    if (!building.some((b) => b.type !== 'house' && b.type !== 'farm')) {
      const marketFirst = this.holdWood;
      // A full treasury and too few places to spend it: more barracks, ranges and stables, so an army lost can be raised again quickly.
      const idleWealth = Math.min((p.res.food + p.res.wood + p.res.gold) / 3, Math.max(p.res.food, p.res.wood) / 2);
      const more = this.level >= 1 && p.age >= 2 ? Math.min(3, Math.floor(idleWealth / 900)) : 0;
      for (const step of BUILD_ORDER) {
        if (marketFirst && step.type !== 'market') continue;
        const extra = step.type === 'barracks' || step.type === 'range' || step.type === 'stable' ? more : 0;
        if (step.age > p.age || villagers.length < step.villagers || count(step.type) >= step.count + extra) continue;
        if (saving && step.type !== 'barracks') continue;
        // A Wonder is for an AI that is rich and not on the easy setting.
        if (step.type === 'wonder' && (this.level < 1 || p.res.wood < 1600 || !g.canAfford(p, BUILDINGS.wonder.cost))) continue;
        if (g.canAfford(p, BUILDINGS[step.type].cost)) this.build(step.type, home, villagers, 7, 13);
        break;
      }
    }

    // Give up on wall segments nobody can get to (deep in trees, behind water) so the wall keeps going.
    const stalled = building.filter((b) => b.def.wall);
    this.wallT = stalled.length ? this.wallT + 1 : 0;
    if (this.wallT > 45) { g.cmdDelete(pid, stalled.map((b) => b.id)); this.wallT = 0; }
    if (!saving && !underAttack) this.buildWalls(home, villagers, stalled.length > 0);

    this.assignWorkers(villagers, mine, home);
    if (!underAttack) this.staffHouses(mine, villagers, home);
    if (!underAttack) this.slaving(mine, villagers, home);
    if (!underAttack) this.raiding(army, home);
    if (g.sea && !saving) this.navy(mine, ships, villagers, home);
    if (g.sea && this.level >= 1) this.seaRaid(mine, ships, army, !!underAttack);

    // Market: turn whatever is piling up into whatever has run out.
    const market = mine.find((b) => b.type === 'market' && b.complete);
    if (market) {
      for (const r of ['wood', 'food', 'stone'] as ResType[]) {
        if (p.res.gold < 200 && p.res[r] > (r === 'food' ? 900 : 600)) g.cmdTrade(pid, market.id, r, 'sell');
        // A great heap of one thing and no gold: sell faster.
        if (p.res.gold < 1200 && p.res[r] > 2000) { g.cmdTrade(pid, market.id, r, 'sell'); g.cmdTrade(pid, market.id, r, 'sell'); }
      }
      // The more gold is lying idle, the more is bought at once.
      const lots = p.res.gold > 900 ? 3 : p.res.gold > 600 ? 2 : 1;
      for (let k = 0; k < lots; k++) {
        if (p.res.food < 150 && p.res.gold > 300) g.cmdTrade(pid, market.id, 'food', 'buy');
        if (p.res.wood < 100 && p.res.gold > 300) g.cmdTrade(pid, market.id, 'wood', 'buy');
      }
      if (p.res.food < 100 && p.res.gold <= 300 && p.res.wood > 500) g.cmdTrade(pid, market.id, 'wood', 'sell');
      // Share a surplus with an ally who has run dry.
      for (const ally of g.allies(pid)) {
        for (const r of ['food', 'wood', 'gold', 'stone'] as ResType[]) if (ally.res[r] < 150 && p.res[r] > 1500) g.cmdTribute(pid, ally.id, r);
      }
    }

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
    // Wealth lying idle is turned into soldiers: the richer the treasury, the larger the army it keeps.
    // Counted across all three stores, so a mountain of timber is not left to rot for want of gold.
    const spare = Math.max(0, Math.min((p.res.food + p.res.wood + p.res.gold) / 3, Math.max(p.res.food, p.res.wood) / 2) - 300);
    const armyTarget = Math.round(ARMY_TARGET[p.age] * this.armyScale) + (this.level >= 1 ? Math.min(24, Math.floor(spare / 110)) : 0);
    this.castCalamities(army);
    if ((!saving || underAttack) && army.length < armyTarget + (underAttack ? 6 : 0)) {
      // The civilisation's own unit turns up often once its age is reached.
      const own = CIVS[p.civ]?.unique;
      const own2 = CIVS[p.civ]?.unique2;
      const mix = [...ARMY_MIX[p.age], ...(own && UNITS[own].age <= p.age ? [own, own, own] : []), ...(own2 && UNITS[own2].age <= p.age ? [own2, own2] : [])];
      for (let k = 0; k < mix.length; k++) {
        let type = mix[(this.mixI + k) % mix.length];
        // A people that keeps the faith calls a priest where others would call a shaman, and has no berserkers.
        if (g.creedBar(pid, UNITS[type])) { if (type !== 'shaman') continue; type = 'priest'; }
        const def = UNITS[type];
        // Yesterday's soldiers are only raised in need: an army of bowmen is no use against knights.
        if (def.age <= p.age - 2 && type !== own && type !== own2 && !underAttack && army.length >= armyTarget / 2 && def.atk > 0 && def.cls !== 'siege' && p.res.gold >= 150) continue;
        const src = mine.find((b) => b.complete && b.def.trains.includes(type) && b.queue.length < 2);
        if (!src || !g.canAfford(p, def.cost)) continue;
        if ((type === 'shaman' || type === 'priest') && g.countUnits(pid, type) >= 2) continue;
        if (type === 'prophet' && g.countUnits(pid, 'prophet') >= 1) continue;
        if (g.cmdTrain(pid, src.id, type)) { this.mixI = (this.mixI + k + 1) % mix.length; break; }
      }
      if (p.age >= 1 && tc && tc.complete && !saving && g.countUnits(pid, 'warlord') === 0 && g.canAfford(p, UNITS.warlord.cost)) {
        g.cmdTrain(pid, tc.id, 'warlord');
      }
      if (p.age >= 2 && tc && tc.complete && !saving && g.countUnits(pid, 'strategist') === 0 && g.canAfford(p, UNITS.strategist.cost)) {
        g.cmdTrain(pid, tc.id, 'strategist');
      }
    }

    // A worldly people with gold in hand buys swords when the enemy is at the door.
    if (underAttack && p.res.gold > 350 && this.level >= 1) {
      const tavern = mine.find((b) => b.type === 'tavern' && b.complete && b.staff?.length);
      if (tavern) g.cmdHire(pid, tavern.id, p.age >= 1 ? 'spearman' : 'clubman');
    }
    if (underAttack && this.state === 'build') {
      const idle = army.filter((u) => !u.order || u.order.t === 'move');
      if (idle.length) g.cmdMove(pid, idle.map((u) => u.id), p.lastAttacked!.x, p.lastAttacked!.y, true);
    }

    // ---- Fighting as a side ----
    const allies = g.allies(pid);
    if (allies.length && !underAttack) {
      // An ally's call comes first: everyone who can fight goes.
      const call = allies.map((a) => a.signal).filter((s): s is NonNullable<typeof s> => !!s && s.t > this.signalT && g.time - s.t < 60)[0];
      if (call) {
        this.signalT = call.t;
        if (fighters.length) g.cmdMove(pid, army.map((u) => u.id), call.x, call.y, true);
      } else if (this.state === 'build') {
        // Otherwise help an ally whose town is being hit right now.
        const hurt = allies.find((a) => a.lastAttacked && g.time - a.lastAttacked.t < 6 && g.buildings.some((b) => b.owner === a.id && Math.hypot(b.x - a.lastAttacked!.x, b.y - a.lastAttacked!.y) < 14));
        const idle = army.filter((u) => !u.order);
        if (hurt && idle.length >= 3) g.cmdMove(pid, idle.map((u) => u.id), hurt.lastAttacked!.x, hurt.lastAttacked!.y, true);
      }
    }
    const push = allies.length ? this.allyPush(allies) : null;
    p.attackTarget = this.state === 'attack' ? this.targetId : 0; // tell allies what we are marching on

    // ---- Marauders ----
    const lair = g.marauders ? g.buildings.find((b) => b.type === 'lair') : undefined;
    if (!lair) {
      // The camp is burnt (or was never there): the men who went after it come home.
      if (this.hunt) {
        this.hunt = false; this.state = 'build'; this.targetId = 0;
        const mid = g.size / 2, d = Math.hypot(mid - home.x, mid - home.y) || 1;
        g.cmdMove(pid, army.map((u) => u.id), home.x + ((mid - home.x) / d) * 9, home.y + ((mid - home.y) / d) * 9, false);
      }
      this.knowsLair = false;
    } else {
      // A raiding party in the village is run down by whoever is standing about: a man killed drops the woman he leads.
      const party = g.units.filter((u) => u.def.marauder && Math.hypot(u.x - home.x, u.y - home.y) < 18);
      if (party.length && this.state === 'build') {
        const free = fighters.filter((u) => !u.order && !u.inside);
        if (free.length) g.cmdMove(pid, free.map((u) => u.id), party[0].x, party[0].y, true);
      }
      // It learns where the camp is by losing a woman to it, or by one of its own coming in sight of it.
      const lost = (lair.captives ?? []).some((c) => c.from === pid);
      if (!this.knowsLair) this.knowsLair = lost || g.units.some((u) => u.owner === pid && Math.hypot(u.x - lair.x, u.y - lair.y) < u.def.sight + 2);
      if (this.knowsLair && this.state === 'build' && !underAttack && fighters.length >= 4) {
        // It marches when it can beat the band: sooner if its own women are held there.
        const band = g.units.filter((u) => u.def.marauder).length;
        if (this.weight(pid, false) >= (band * 70 + 250) * (lost ? 1 : 1.3)) {
          this.state = 'attack'; this.attackT = 0; this.launched = fighters.length; this.readyT = -1;
          this.targetId = lair.id; this.hunt = true;
        }
      }
    }

    // How many make an army worth sending is set by the age, not by the treasury: a rich people keeps more men, it does not wait for more.
    const attackSize = Math.max(4, Math.floor(Math.round(ARMY_TARGET[p.age] * this.armyScale) * 0.8));
    if (this.state === 'build') {
      const clock = g.buildings.some((b) => g.hostile(b.owner, pid) && b.type === 'wonder'); // no time to wait for a full army
      // It does not march into an army it cannot beat: it waits to outweigh the defenders, though not for ever.
      const ready = fighters.length >= attackSize && g.time > this.firstAttack && !underAttack;
      if (!ready) this.readyT = -1; else if (this.readyT < 0) this.readyT = g.time;
      const foe = this.nearestFoe(home);
      // A long war makes everyone bolder: the margin it waits for shrinks from the twenty-fifth minute.
      const margin = Math.max(1, 1.4 - Math.max(0, g.time - 1500) / 2250);
      const outweighs = this.level < 1 || foe < 0 || this.weight(pid, false) >= this.weight(foe, true) * margin || g.time - this.readyT > (g.time > 1800 ? 150 : 360);
      if ((ready && outweighs) || (clock && fighters.length >= 3)) {
        this.state = 'attack';
        this.attackT = 0;
        this.launched = fighters.length;
        this.readyT = -1;
      } else if (push && fighters.length >= Math.max(3, attackSize / 2) && !underAttack) {
        // An ally is on the offensive: join with what we have rather than attack alone later.
        this.state = 'attack';
        this.attackT = 0;
        this.launched = fighters.length;
        this.targetId = push.id;
      } else {
        // Keep idle troops gathered in front of the base.
        const mid = g.size / 2;
        const d = Math.hypot(mid - home.x, mid - home.y) || 1;
        const rx = home.x + ((mid - home.x) / d) * 9, ry = home.y + ((mid - home.y) / d) * 9;
        const stray = army.filter((u) => !u.order && Math.hypot(u.x - rx, u.y - ry) > 6);
        if (stray.length) g.cmdMove(pid, stray.map((u) => u.id), rx, ry, false);
      }
    } else {
      // In a long war there is no more going home: after half an hour an attack is fought to the finish.
      const beaten = this.level >= 1 && g.time < 1800 && fighters.length < Math.max(3, this.launched * 0.35) && this.weight(this.nearestFoe(home), false) > 0;
      if (fighters.length < 3) { this.state = 'build'; this.hunt = false; }
      else if (beaten) {
        this.hunt = false;
        // The attack has failed: what is left comes home to fight another day instead of dying to the last man.
        this.state = 'build';
        const mid = g.size / 2, d = Math.hypot(mid - home.x, mid - home.y) || 1;
        g.cmdMove(pid, army.map((u) => u.id), home.x + ((mid - home.x) / d) * 9, home.y + ((mid - home.y) / d) * 9, false);
      } else if ((this.attackT -= 1) <= 0) {
        this.attackT = 5;
        const idle = army.filter((u) => !u.order);
        // Men fresh from the barracks wait until there are enough of them to go up together, not one by one.
        const fresh = idle.filter((u) => Math.hypot(u.x - home.x, u.y - home.y) < 16), afield = idle.filter((u) => !fresh.includes(u));
        const go = g.time >= 1800 || fresh.length >= Math.max(3, Math.floor(attackSize / 3)) || fresh.length === fighters.length ? idle : afield;
        const target = go.length ? this.pickTarget(go[0]) : null;
        if (target) g.cmdMove(pid, go.map((u) => u.id), target.x, target.y, true);
      }
    }
  }

  /**
   * A field battle has no town to run: gather for a moment, then march the whole army on the
   * enemy and keep at it until one side is gone.
   */
  private fieldBattle(): void {
    const g = this.game, pid = this.pid;
    if (g.time < [14, 8, 4][this.level]) return; // give the other side a moment to look at the field
    if ((this.attackT -= 1) > 0) return;
    this.attackT = 3;
    const idle = g.units.filter((u) => u.owner === pid && !u.order);
    if (!idle.length) return;
    const lead = idle[0];
    let target: Unit | null = null, best = Infinity;
    for (const u of g.units) {
      if (!g.hostile(u.owner, pid) || u.owner === g.wild) continue;
      const d = Math.hypot(u.x - lead.x, u.y - lead.y);
      if (d < best) { best = d; target = u; }
    }
    if (target) g.cmdMove(pid, idle.map((u) => u.id), target.x, target.y, true);
  }

  /** The enemy building an ally is assaulting, if any: an AI ally's target, or one a human ally's army has reached. */
  private allyPush(allies: { id: number; isAI: boolean; attackTarget: number }[]): Entity | null {
    const g = this.game;
    for (const a of allies) {
      if (a.isAI) {
        const t = g.entities.get(a.attackTarget);
        if (t && !t.dead) return t;
        continue;
      }
      const troops = g.units.filter((u) => u.owner === a.id && g.isMilitary(u));
      if (troops.length < 5) continue;
      for (const b of g.buildings) {
        if (!g.hostile(b.owner, this.pid) || b.def.wall) continue;
        if (troops.filter((u) => Math.hypot(u.x - b.x, u.y - b.y) < 12).length >= 5) return b;
      }
    }
    return null;
  }

  /** Prophets strike clumps of enemy troops with plague and enemy buildings with earthquakes. */
  private castCalamities(army: Unit[]): void {
    const g = this.game;
    for (const u of army) {
      if (!u.def.mana || u.order?.t === 'cast') continue;
      if (u.mana >= ABILITIES.plague.cost) {
        const near = g.units.filter((v) => g.hostile(v.owner, this.pid) && v.owner !== g.wild && v.plagueT <= 0 && Math.hypot(v.x - u.x, v.y - u.y) < 11);
        if (near.length >= 3) { g.cmdCast(this.pid, [u.id], 'plague', near[0].x, near[0].y); continue; }
      }
      // Fire where buildings stand close enough for it to leap, and not in the rain; blight on a rival's fields.
      if (u.mana >= ABILITIES.fire.cost && g.foul !== 'rain') {
        const near = g.buildings.filter((v) => g.hostile(v.owner, this.pid) && !v.def.wall && v.burnT <= 0 && Math.hypot(v.x - u.x, v.y - u.y) < 11);
        const b = near.find((v) => near.some((w) => w !== v && Math.hypot(w.x - v.x, w.y - v.y) < 4));
        if (b) { g.cmdCast(this.pid, [u.id], 'fire', b.x, b.y); continue; }
      }
      if (u.mana >= ABILITIES.blight.cost && u.mana < ABILITIES.fire.cost) {
        const farms = g.buildings.filter((v) => v.type === 'farm' && !v.blightT && g.hostile(v.owner, this.pid) && Math.hypot(v.x - u.x, v.y - u.y) < 11);
        if (farms.length >= 2) { g.cmdCast(this.pid, [u.id], 'blight', farms[0].x, farms[0].y); continue; }
      }
      if (u.mana >= ABILITIES.quake.cost) {
        const b = g.buildings.find((v) => g.hostile(v.owner, this.pid) && Math.hypot(v.x - u.x, v.y - u.y) < 11);
        if (b) g.cmdCast(this.pid, [u.id], 'quake', b.x, b.y);
      }
    }
  }

  /** State to store in a saved game. */
  save(): object {
    return { level: this.level, state: this.state, mixI: this.mixI, attackT: this.attackT, firstAttack: this.firstAttack, armyScale: this.armyScale, ring: this.ring, ringI: this.ringI, targetId: this.targetId, signalT: this.signalT, launched: this.launched, readyT: this.readyT, hunt: this.hunt, knowsLair: this.knowsLair, raid: this.raid, raidT: this.raidT };
  }

  load(s: Partial<AIController> & { state?: 'build' | 'attack'; mixI?: number; attackT?: number }): void {
    Object.assign(this, s);
  }

  /** From the Bronze Age, spend spare wood on a palisade around the base, with a gate every few segments. */
  private buildWalls(home: Building, villagers: Unit[], busy: boolean): void {
    const g = this.game, p = g.players[this.pid];
    const walls = battleHabits(p.civ).walls; // some leaders never wall their town; others do it before anything else
    if (walls === 'never' || this.level < 1 || p.age < 1 || busy || p.res.wood < (walls === 'early' ? 150 : 260)) return;
    if (!this.ring) {
      const R = 16, x0 = Math.floor(home.x), y0 = Math.floor(home.y);
      this.ring = [];
      for (let i = -R; i < R; i++) this.ring.push({ cx: x0 + i, cy: y0 - R });
      for (let i = -R; i < R; i++) this.ring.push({ cx: x0 + R, cy: y0 + i });
      for (let i = R; i > -R; i--) this.ring.push({ cx: x0 + i, cy: y0 + R });
      for (let i = R; i > -R; i--) this.ring.push({ cx: x0 - R, cy: y0 + i });
    }
    if (this.ringI >= this.ring.length) return;
    const stretch = this.ring.slice(this.ringI, this.ringI + 8);
    const builder = this.pickBuilder(villagers, stretch[0].cx, stretch[0].cy);
    if (!builder) return;
    this.ringI += 8;
    const gate = stretch[4];
    g.cmdPlaceLine(this.pid, 'palisade', stretch.filter((c) => c !== gate), [builder.id]);
    // Where a gate cannot stand (a tree, the map edge) the gap simply stays open.
    if (gate && g.canPlace('gate', gate.cx, gate.cy)) g.cmdPlace(this.pid, 'gate', gate.cx, gate.cy, []);
  }

  /** Where a landing from this dock would load and come ashore, if its water reaches an enemy shore. Looked up afresh every two minutes. */
  private plan: { t: number; v: { load: { wx: number; wy: number; lx: number; ly: number }; land: { wx: number; wy: number }; target: { x: number; y: number } } | null } | null = null;
  private landing(dock: Building): NonNullable<AIController['plan']>['v'] {
    const g = this.game;
    if (this.plan && g.time - this.plan.t < 120) return this.plan.v;
    const team = g.players[this.pid].team;
    const d = (b: Building) => Math.hypot(b.x - dock.x, b.y - dock.y);
    const target = g.buildings.filter((b) => g.hostile(b.owner, this.pid) && !b.def.wall && b.owner !== g.wild).sort((a, b) => d(a) - d(b))[0];
    const from = g.seaPf.nearestFree(dock.x, dock.y);
    const load = g.shoreSpot(dock.x, dock.y, 9, team, from.x, from.y);
    const land = target && g.shoreSpot(target.x, target.y, 26, team, from.x, from.y);
    const ok = target && load && land && Math.hypot(land.wx - load.wx, land.wy - load.wy) >= 20;
    this.plan = { t: g.time, v: ok ? { load: load!, land: land!, target: { x: target.x, y: target.y } } : null };
    return this.plan.v;
  }

  /** For every water cell, how many cells of water it is joined to. */
  private waterSizes(): Int32Array {
    const g = this.game, N = g.size, out = new Int32Array(N * N), seen = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) {
      if (seen[i] || g.terrain[i] !== 1) continue;
      const cells = [i];
      seen[i] = 1;
      for (let k = 0; k < cells.length; k++) {
        const c = cells[k], x = c % N, y = (c - x) / N;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, n = ny * N + nx;
          if (nx < 0 || ny < 0 || nx >= N || ny >= N || seen[n] || g.terrain[n] !== 1) continue;
          seen[n] = 1;
          cells.push(n);
        }
      }
      for (const c of cells) out[c] = cells.length;
    }
    return out;
  }

  /**
   * A town that has become Decadent is dying out and knows it: it builds a Work Camp, keeps a pair of Slavers, and
   * sends them after the nearest rival villagers for as long as the camp has room.
   */
  private slaving(mine: Building[], villagers: Unit[], home: Building): void {
    const g = this.game, pid = this.pid, p = g.players[pid];
    if (this.level < 1 || !isDecadent(p.virtue) || p.age < 1 || Math.floor(g.time) % 3) return;
    const camp = mine.find((b) => b.type === 'workcamp');
    if (!camp) { if (villagers.length >= 10) this.build('workcamp', home, villagers, 7, 18); return; }
    if (!camp.complete) return;
    const slavers = g.units.filter((u) => u.owner === pid && u.def.slaver);
    const tavern = mine.find((b) => b.type === 'tavern' && b.complete);
    if (tavern && slavers.length < 2 && !tavern.queue.length && g.canAfford(p, UNITS.slaver.cost)) g.cmdTrain(pid, tavern.id, 'slaver');
    if ((camp.captives?.length ?? 0) >= (camp.def.camp ?? 0)) return;
    for (const s of slavers) {
      if (s.order || s.captive || s.inside) continue;
      let best: Unit | null = null, bestD = Infinity;
      for (const v of g.units) {
        if (v.type !== 'villager' || v.growT > 0 || v.inside || v.owner === g.wild || !g.hostile(v.owner, pid)) continue;
        const d = Math.hypot(v.x - s.x, v.y - s.y);
        if (d < bestD) { bestD = d; best = v; }
      }
      if (best) g.cmdTarget(pid, [s.id], best.id);
    }
  }

  /**
   * A raiding people sends a few idle fighters after the nearest rival villagers, to bring them home alive.
   * Only a handful go at a time, so the band is never all away at once.
   */
  private raiding(army: Unit[], home: Building): void {
    const g = this.game, pid = this.pid, p = g.players[pid];
    if (!g.raider(pid) || Math.floor(g.time) % 4 || p.pop >= p.popCap) return;
    // While the nearest rival has next to no soldiers the whole band goes for its people: this is the raiders'
    // hour, before walls and towers. After that only a few slip out at a time, and they keep clear of towers.
    const foe = this.nearestFoe(home);
    const open = this.level >= 1 && foe >= 0 && this.weight(foe, false) < this.weight(pid, false) * 0.6;
    const able = army.filter((u) => g.canSeize(u) && !u.inside);
    const want = open ? Math.max(2, able.length - 1) : this.level === 0 ? 1 : this.level === 1 ? 2 : 3;
    const towers = g.buildings.filter((b) => g.hostile(b.owner, pid) && b.complete && (b.type === 'tower' || (!open && b.type === 'towncenter')));
    // A raider who is badly hurt gives it up and comes home: a live man raids again tomorrow.
    for (const u of army) if (u.order?.t === 'capture' && u.hp < u.maxHp * 0.45) g.cmdMove(pid, [u.id], home.x, home.y + 5, false);
    const marked = new Set<number>();
    for (const u of army) if (u.order?.t === 'capture') marked.add(u.order.id);
    let out = army.filter((u) => u.order?.t === 'capture' || u.captive).length;
    for (const s of able) {
      if (out >= want) break;
      if (s.order || s.captive || s.hp < s.maxHp * 0.7) continue;
      let best: Unit | null = null, bestD = open ? 110 : 60;
      for (const v of g.units) {
        if (v.type !== 'villager' || v.growT > 0 || v.inside || v.owner === g.wild || !g.hostile(v.owner, pid) || marked.has(v.id)) continue;
        if (towers.some((b) => Math.hypot(b.x - v.x, b.y - v.y) < (b.type === 'tower' ? 9 : 10))) continue;
        const d = open ? Math.hypot(v.x - s.x, v.y - s.y) : Math.hypot(v.x - home.x, v.y - home.y);
        if (d < bestD) { bestD = d; best = v; }
      }
      if (!best) {
        // Nobody to take (they have rung the bell and gone indoors): do not stand about under their arrows.
        if (Math.hypot(s.x - home.x, s.y - home.y) > 26) g.cmdMove(pid, [s.id], home.x, home.y + 5, false);
        continue;
      }
      marked.add(best.id);
      g.cmdTarget(pid, [s.id], best.id);
      out++;
    }
  }

  /** Once the town can spare the hands, put a few in the church or the tavern, as this people leans. */
  private staffHouses(mine: Building[], villagers: Unit[], home: Building): void {
    const g = this.game, pid = this.pid, p = g.players[pid];
    if (this.level < 1 || p.age < 1 || villagers.length < 16) return;
    const pious = leaningWith(p.civ, LEANING[p.civ] ?? 0.5) >= 0.5;
    const type = pious ? 'temple' : 'tavern';
    if (!pious) {
      // It likes the tavern's gold but knows where the road ends: a Decadent town's own people die out. Near the
      // edge it empties the tavern, and does not fill it again until it has drawn well back.
      if (p.virtue <= -60) { for (const b of mine) if (b.type === 'tavern' && b.staff?.length) g.cmdUnstaff(pid, b.id, true); return; }
      if (p.virtue <= -45) return;
    }
    const want = villagers.length >= 26 ? 4 : 2;
    if ((pious ? p.clergy : p.maids) >= want) return;
    const house = mine.find((b) => b.type === type && b.complete && (b.staff?.length ?? 0) < (b.def.staff ?? 0));
    if (!house) {
      // Build the house itself if the town has none (the build order gets to a church late, and never to a tavern).
      if (!mine.some((b) => b.type === type) && p.res.wood >= (BUILDINGS[type].cost.wood ?? 0) + 60) this.build(type, home, villagers, 6, 18);
      return;
    }
    // Anyone already walking there counts.
    if (villagers.some((v) => v.order?.t === 'staff')) return;
    const free = villagers.filter((v) => !v.inside && (!v.order || v.order.t === 'gather'));
    const v = free.sort((a, b) => Math.hypot(a.x - house.x, a.y - house.y) - Math.hypot(b.x - house.x, b.y - house.y))[0];
    if (v) g.cmdTarget(pid, [v.id], house.id);
  }

  /** A landing in progress: troops gather at the shore, board a transport and are put ashore near the enemy. */
  private raid: { phase: 'load' | 'sail'; ship: number; men: number[]; t: number; called: boolean; load: { wx: number; wy: number; lx: number; ly: number }; land: { wx: number; wy: number }; tx: number; ty: number } | null = null;
  private raidT = 420;
  private seaRaid(mine: Building[], ships: Unit[], army: Unit[], underAttack: boolean): void {
    const g = this.game, pid = this.pid, p = g.players[pid], team = p.team;
    const dock = mine.find((b) => b.type === 'dock' && b.complete);
    const r = this.raid;
    if (r) {
      const ship = g.entities.get(r.ship);
      if (!ship || ship.kind !== 'unit' || ship.dead) { this.raid = null; this.raidT = g.time + 240; return; }
      const aboard = ship.cargo?.length ?? 0;
      if (r.phase === 'load') {
        const men = r.men.map((id) => g.entities.get(id)).filter((u): u is Unit => !!u && u.kind === 'unit' && !u.dead);
        if (!r.called && Math.hypot(ship.x - r.load.wx, ship.y - r.load.wy) < 1.2) {
          r.called = true;
          g.cmdTarget(pid, men.map((u) => u.id), ship.id);
        }
        const waited = g.time - r.t;
        if (aboard >= Math.max(3, men.length) || (waited > 60 && aboard >= 3)) {
          g.cmdUnloadAt(pid, [ship.id], r.land.wx, r.land.wy);
          // Warships go ahead to clear the landing.
          const escort = ships.filter((u) => u.def.atk > 0).map((u) => u.id);
          if (escort.length) g.cmdMove(pid, escort, r.land.wx, r.land.wy, true);
          r.phase = 'sail';
          r.t = g.time;
        } else if (waited > 90 || underAttack) {
          // It is not coming together: everyone off, try again later.
          g.cmdUnload(pid, [ship.id]);
          this.raid = null;
          this.raidT = g.time + 200;
        } else if (r.called && waited > 20 && Math.floor(waited) % 15 === 0) {
          g.cmdTarget(pid, men.filter((u) => !u.inside).map((u) => u.id), ship.id); // stragglers
        }
      } else if (!aboard) {
        // Ashore: go for the town, and send the ship home.
        g.cmdMove(pid, r.men, r.tx, r.ty, true);
        g.cmdMove(pid, [ship.id], r.load.wx, r.load.wy);
        this.raid = null;
        this.raidT = g.time + 300;
      } else if (g.time - r.t > 120) {
        g.cmdUnload(pid, [ship.id]);
        this.raid = null;
        this.raidT = g.time + 300;
      }
      return;
    }
    if (!dock || p.age < 1 || g.time < this.raidT || underAttack || this.state !== 'build') return;
    const fighters = army.filter((u) => u.def.atk > 0 && !u.def.aura && u.def.cls !== 'siege' && !u.inside);
    if (fighters.length < 8) return;
    const plan = this.landing(dock);
    if (!plan) { this.raidT = g.time + 180; return; }
    const { load, land, target } = plan;
    const ship = ships.find((u) => u.def.carry && !u.cargo?.length);
    if (!ship) {
      if (!dock.queue.some((q) => q.kind === 'unit' && q.id === 'transport') && dock.queue.length < 2) g.cmdTrain(pid, dock.id, 'transport');
      return;
    }
    const men = fighters.sort((a, b) => Math.hypot(a.x - load.lx, a.y - load.ly) - Math.hypot(b.x - load.lx, b.y - load.ly)).slice(0, 6);
    g.cmdMove(pid, [ship.id], load.wx, load.wy);
    g.cmdMove(pid, men.map((u) => u.id), load.lx, load.ly);
    this.raid = { phase: 'load', ship: ship.id, men: men.map((u) => u.id), t: g.time, called: false, load, land, tx: target.x, ty: target.y };
  }

  /** On a lake map: a dock near fish, a few fishing boats, and a small fleet to guard them. */
  private dockSpot: { cx: number; cy: number } | null | undefined;
  private navy(mine: Building[], ships: Unit[], villagers: Unit[], home: Building): void {
    const g = this.game, pid = this.pid, p = g.players[pid];
    const dock = mine.find((b) => b.type === 'dock');
    if (!dock) {
      if (g.time < 150 || p.res.wood < 200) return;
      if (this.dockSpot === undefined) {
        // The nearest shore that has fish within a boat's reach of it.
        this.dockSpot = null;
        let bd = 46, bestSize = 0;
        const size = this.waterSizes();
        for (let cy = 2; cy < g.size - 5; cy++)
          for (let cx = 2; cx < g.size - 5; cx++) {
            const d = Math.hypot(cx + 1.5 - home.x, cy + 1.5 - home.y);
            if (d >= 46 || d < 8 || !g.canPlace('dock', cx, cy)) continue;
            const fish = g.findResourceNear(cx + 1.5, cy + 1.5, 'food', pid, 22, 0, true);
            if (!fish) continue;
            const from = g.seaPf.nearestFree(cx + 1.5, cy + 1.5);
            if (Math.hypot(from.x - cx - 1.5, from.y - cy - 1.5) > 3) continue;
            // Open water beats a pond: more fish, and somewhere for ships to go.
            const body = size[Math.floor(from.y) * g.size + Math.floor(from.x)];
            if (body < bestSize * 0.8 || (body <= bestSize * 1.25 && d >= bd)) continue;
            if (g.seaPf.find(from.x, from.y, fish.x, fish.y, fish.x, fish.y, 1).partial) continue;
            bestSize = Math.max(bestSize, body);
            bd = d;
            this.dockSpot = { cx, cy };
          }
      }
      const spot = this.dockSpot;
      if (!spot) return;
      if (!g.canPlace('dock', spot.cx, spot.cy)) { this.dockSpot = undefined; return; }
      const v = this.pickBuilder(villagers, spot.cx, spot.cy);
      if (v) g.cmdPlace(pid, 'dock', spot.cx, spot.cy, [v.id]);
      return;
    }
    if (!dock.complete) return;
    const queued = (type: string) => dock.queue.filter((q) => q.kind === 'unit' && q.id === type).length;
    const boats = ships.filter((u) => u.def.fisher);
    const fish = g.findResourceNear(dock.x, dock.y, 'food', pid, 30, 0, true);
    if (fish && boats.length + queued('fishboat') < [2, 3, 4][this.level] && dock.queue.length < 2) g.cmdTrain(pid, dock.id, 'fishboat');
    for (const b of boats) {
      if (b.order) continue;
      const near = g.findResourceNear(b.x, b.y, 'food', pid, 30, 0, true);
      if (near) g.cmdTarget(pid, [b.id], near.id);
    }
    // A transport early, before the town fills up, if there is anywhere to land with it.
    if (this.level >= 1 && p.age >= 1 && boats.length && !ships.some((u) => u.def.carry) && !queued('transport') && dock.queue.length < 2 && this.landing(dock)) {
      g.cmdTrain(pid, dock.id, 'transport');
    }
    // Warships once there is something to protect, and the ships to match the age.
    if (this.level >= 1 && p.age >= 1 && boats.length) {
      if (p.age >= 4 && !p.techs.has('up_frigate') && !p.pending.has('up_frigate') && dock.queue.length === 0) g.cmdResearch(pid, dock.id, 'up_frigate');
      const fleet = ships.filter((u) => u.def.atk > 0).length + queued('galley');
      // Match whatever the enemy has put on the water, and one more.
      const theirs = g.units.filter((u) => u.def.naval && u.def.atk > 0 && g.hostile(u.owner, pid)).length;
      const want = Math.min(6, Math.max([0, 2, 3][this.level], theirs + 1));
      if (fleet < want && dock.queue.length < 2 && p.res.gold >= 120) g.cmdTrain(pid, dock.id, 'galley');
      // Idle warships go to wherever enemy ships are raiding our boats or shore.
      const raider = g.units.find((u) => u.def.naval && u.def.atk > 0 && g.hostile(u.owner, pid) && Math.hypot(u.x - dock.x, u.y - dock.y) < 30);
      if (raider) {
        const idle = ships.filter((u) => u.def.atk > 0 && !u.order).map((u) => u.id);
        if (idle.length) g.cmdMove(pid, idle, raider.x, raider.y, true);
      }
    }
  }

  /** The nearest rival still in the game, by where its buildings stand; -1 if there is none. */
  private nearestFoe(home: Building): number {
    let best = -1, bd = Infinity;
    for (const b of this.game.buildings) {
      if (!this.game.hostile(b.owner, this.pid) || b.owner === this.game.wild) continue;
      const d = Math.hypot(b.x - home.x, b.y - home.y);
      if (d < bd) { bd = d; best = b.owner; }
    }
    return best;
  }

  /** How much fighting strength a player has, by what it cost: soldiers, and for one standing on the defence its towers and town centre too. */
  private weight(pid: number, defending: boolean): number {
    if (pid < 0) return 0;
    let w = 0;
    for (const u of this.game.units) {
      if (u.owner !== pid || u.type === 'villager' || u.def.atk <= 0 || u.def.naval) continue;
      const c = u.def.cost;
      w += ((c.food ?? 0) + (c.wood ?? 0) + (c.gold ?? 0)) * (u.hp / u.maxHp);
    }
    if (defending) for (const b of this.game.buildings) if (b.owner === pid && b.complete && (b.type === 'tower' || b.type === 'towncenter')) w += b.type === 'tower' ? 200 : 300;
    return w;
  }

  private route(from: Unit, to: Entity): { partial: boolean } {
    this.game.pf.pass = 2 + this.game.players[this.pid].team;
    const h = to.kind === 'unit' ? 0 : to.size / 2;
    return this.game.pf.find(from.x, from.y, to.x - h, to.y - h, to.x + h, to.y + h, 1);
  }

  /**
   * Building for the army to march on. It sticks with one target until that falls, prefers
   * finished buildings over foundations, and picks the nearest one it can actually walk to. If
   * none can be reached (the enemy is walled in) it takes the nearest: the army walks up to the
   * wall and breaks through.
   */
  private pickTarget(from: Unit): Entity | null {
    // A rival's Wonder is a clock running out: go for it before anything else.
    const wonder = this.game.buildings.find((b) => this.game.hostile(b.owner, this.pid) && b.type === 'wonder');
    if (wonder) return wonder;
    const g = this.game;
    const d = (b: Entity) => Math.hypot(b.x - from.x, b.y - from.y);
    const enemy = g.buildings.filter((b) => g.hostile(b.owner, this.pid) && !b.def.wall);
    // A people falls with its Town Center (see beaten.ts). Once it has next to no soldiers left, or its last hall
    // is down and it is trying to raise another, the hall is the target, begun or finished. Not before: a Town
    // Center shoots, and in trial games an army sent at it while the defenders still stood was thrown away.
    const halls = enemy.filter((b) => b.type === 'towncenter' && !g.players[b.owner].defeated).sort((a, b) => d(a) - d(b));
    if (halls.length) {
      const mine = g.units.filter((u) => u.owner === this.pid && g.isMilitary(u) && !u.def.naval).length;
      const hall = halls.find((b) => {
        const theirs = g.units.filter((u) => u.owner === b.owner && g.isMilitary(u) && !u.def.naval).length;
        return (!b.complete || (theirs <= 2 && mine >= 6)) && !this.route(from, b).partial;
      });
      if (hall) { this.targetId = hall.id; return hall; }
    }
    const cur = g.entities.get(this.targetId);
    if (cur && !cur.dead) return cur;
    const done = enemy.filter((b) => b.complete);
    const list = (done.length ? done : enemy).sort((a, b) => d(a) - d(b));
    const pick = list.slice(0, 10).find((b) => !this.route(from, b).partial) ?? list[0] ?? null;
    this.targetId = pick ? pick.id : 0;
    return pick;
  }

  private pickBuilder(villagers: Unit[], x: number, y: number): Unit | null {
    let best: Unit | null = null;
    let bestD = Infinity;
    for (const v of villagers) {
      const o = v.order;
      if (v.inside || (o && (o.t === 'build' || o.t === 'movein' || o.t === 'shelter' || o.t === 'staff'))) continue;
      const d = Math.hypot(v.x - x, v.y - y) + (o ? (o.t === 'gather' && o.res === 'wood' ? 4 : 10) : 0);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  /** Find a spot with a one-tile margin so the base does not wall itself in. */
  private findSpot(type: string, x: number, y: number, minR: number, maxR: number): { cx: number; cy: number } | null {
    const g = this.game;
    const s = BUILDINGS[type].size;
    // First a spot out of the bog; failing that, anywhere that is free. (Keeping off its own roads as well was
    // tried and pushed its town so far apart that a Hard opponent stopped beating an Easy one.)
    let bog = false;
    for (const fussy of [true, false]) if (fussy || bog) for (let r = minR; r <= maxR; r += 1.5) {
      const steps = Math.ceil(r * 5);
      const a0 = g.rng() * Math.PI * 2;
      for (let k = 0; k < steps; k++) {
        const a = a0 + (k / steps) * Math.PI * 2;
        const cx = Math.round(x + Math.cos(a) * r - s / 2), cy = Math.round(y + Math.sin(a) * r - s / 2);
        let ok = true;
        for (let yy = cy - 1; yy <= cy + s && ok; yy++)
          for (let xx = cx - 1; xx <= cx + s; xx++) {
            if (xx < 1 || yy < 1 || xx >= g.size - 1 || yy >= g.size - 1 || g.occupied[yy * g.size + xx]) { ok = false; break; }
            if (fussy && g.terrain[yy * g.size + xx] === T_MARSH) { ok = false; bog = true; break; }
          }
        if (ok) return { cx, cy };
      }
    }
    return null;
  }

  private build(type: string, near: { x: number; y: number }, villagers: Unit[], minR: number, maxR: number): Building | null {
    const g = this.game;
    if (this.founding && type !== 'towncenter') return null;
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
    // With no hall to raise yet, the hands go to what a hall is made of.
    const cost = BUILDINGS.towncenter.cost, short = (r: ResType) => (this.founding && p.res[r] < (cost[r] ?? 0) ? 1 : 0);
    // Every hand: no one hunts or digs gold while the hall is wanting, and each goes where the most is lacking.
    const lack = (r: ResType) => Math.max(0, (cost[r] ?? 0) - p.res[r]) * short(r);
    const scraping = lack('wood') + lack('stone') > 0;
    const want: Record<ResType, number> =
      scraping ? { food: 0, wood: lack('wood'), gold: 0, stone: lack('stone') }
        : p.age === 0 ? { food: 0.5, wood: 0.4, gold: 0.07, stone: 0.03 }
        : p.age === 1 ? { food: 0.42, wood: 0.3, gold: 0.2, stone: 0.08 }
          : { food: 0.38, wood: 0.24, gold: 0.3, stone: 0.08 };
    const order: ResType[] = ['food', 'wood', 'gold', 'stone'];
    const have: Record<ResType, number> = { food: 0, wood: 0, gold: 0, stone: 0 };
    const idle: Unit[] = [];
    let hunters = 0;
    for (const v of villagers) {
      if (scraping && v.order?.t === 'gather' && !lack(v.order.res) && !v.inside) { g.cmdStop(pid, [v.id]); idle.push(v); } // called off at once
      else if (v.order?.t === 'gather') have[v.order.res]++;
      else if (v.order?.t === 'attack') { have.food++; hunters++; }
      else if (!v.order && !v.inside) idle.push(v);
    }
    // Lean away from whatever is already piling up and towards what is running out.
    if (!scraping) for (const r of order) want[r] *= p.res[r] < 100 ? 2.2 : p.res[r] < 250 ? 1.4 : p.res[r] > 1500 ? 0.25 : p.res[r] > 800 ? 0.6 : 1;
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
          if (farmCount < want.food * total + 3 && farms.filter((f) => !f.complete).length < 3 && p.res.wood >= BUILDINGS.farm.cost.wood! && !this.holdWood) {
            // Fields can spread well beyond the crowded town centre (and outside its wall).
            const spot = this.findSpot('farm', home.x, home.y, 5, 26);
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
          const near = Math.hypot(t.x - home.x, t.y - home.y) < 32; // do not plant outposts in the enemy's yard
          if (drop && far && near && !scraping && p.res.wood >= 60 && mine.filter((b) => b.type === 'storehouse').length < 6 && !mine.some((b) => b.type === 'storehouse' && !b.complete)) {
            const spot = this.findSpot('storehouse', t.x, t.y, 2.5, 6);
            if (spot) g.cmdPlace(pid, 'storehouse', spot.cx, spot.cy, [v.id]);
          }
        }
        break;
      }
    }
  }
}
