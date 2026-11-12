import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { BIRTH_COST, BIRTH_TIME, BUILDINGS, GROW_TIME } from '../src/sim/data';
import { Building, Game, Unit } from '../src/sim/game';
import { connected, generateMap, T_WATER } from '../src/sim/map';
import { armyAt, battleConfig, canRecruit, continueAI, endTurn, finishBattle, income, moveArmy, newCampaign, reinforce, resolvePending } from '../src/sim/campaign';

const setups = [
  { name: 'A', color: 0x3366ff, isAI: false },
  { name: 'B', color: 0xff3333, isAI: true },
];
const run = (g: Game, seconds: number, each?: () => void) => {
  for (let i = 0; i < seconds * 20; i++) { g.step(); if (each && i % 20 === 0) each(); }
};
const villagers = (g: Game, owner: number) => g.units.filter((u) => u.owner === owner && u.type === 'villager');
/** Find a free spot for a building near the player's town center. */
const spot = (g: Game, type: string, owner: number) => {
  const tc = g.buildings.find((b) => b.owner === owner)!;
  for (let r = 4; r < 20; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (g.canPlace(type, tc.cx + dx, tc.cy + dy)) return { cx: tc.cx + dx, cy: tc.cy + dy };
  throw new Error('no spot');
};

describe('map', () => {
  it('always connects both bases by land', () => {
    for (let seed = 1; seed <= 36; seed++) {
      const m = generateMap(seed, [96, 72, 128][seed % 3]);
      expect(m.animals.length).toBeGreaterThan(6);
      const blocked = new Uint8Array(m.size * m.size);
      m.terrain.forEach((t, i) => { if (t === T_WATER) blocked[i] = 1; });
      for (const n of m.nodes) {
        const s = n.type === 'gold' || n.type === 'stone' ? 2 : 1;
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) blocked[(n.cy + y) * m.size + n.cx + x] = 1;
      }
      expect(connected(m.size, blocked, m.starts[0], m.starts[1]), `seed ${seed}`).toBe(true);
    }
  });
});

describe('four players', () => {
  it('gives every player a reachable corner with the same resources', () => {
    for (const size of [72, 96, 128]) {
      const m = generateMap(4, size, 4);
      expect(m.starts.length).toBe(4);
      const blocked = new Uint8Array(m.size * m.size);
      m.terrain.forEach((t, i) => { if (t === T_WATER) blocked[i] = 1; });
      for (const n of m.nodes) {
        const s = n.type === 'gold' || n.type === 'stone' ? 2 : 1;
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) blocked[(n.cy + y) * m.size + n.cx + x] = 1;
      }
      for (const st of m.starts.slice(1)) expect(connected(m.size, blocked, m.starts[0], st), `size ${size}`).toBe(true);
      const near = (st: { x: number; y: number }, type: string) => m.nodes.filter((n) => n.type === type && Math.hypot(n.cx - st.x, n.cy - st.y) < 14).length;
      for (const type of ['berries', 'gold', 'stone']) {
        const counts = m.starts.map((st) => near(st, type));
        expect(counts[0]).toBeGreaterThan(0);
        expect(new Set(counts).size, `${type} at size ${size}`).toBe(1);
      }
    }
  });

  it('three AIs and a bystander play a free-for-all without errors', () => {
    const g = new Game(9, [setups[0], { ...setups[1], name: 'B' }, { ...setups[1], name: 'C' }, { ...setups[1], name: 'D' }]);
    const ais = [1, 2, 3].map((i) => new AIController(g, i));
    run(g, 60 * 20, () => { if (g.winner < 0) ais.forEach((a) => a.update()); });
    console.log('ffa 20m: ' + g.players.slice(0, 4).map((p) => `${p.name}[age ${p.age} pop ${p.pop}${p.defeated ? ' OUT' : ''}]`).join(' ') + ` winner ${g.winner}`);
    expect(g.players.slice(1, 4).every((p) => p.age >= 1 || p.defeated)).toBe(true);
    expect(g.wild).toBe(4);
  }, 180000);
});

describe('economy', () => {
  it('villagers gather each resource and deposit it', () => {
    const g = new Game(3, setups);
    const vs = villagers(g, 0);
    const start = { ...g.players[0].res };
    const types = ['tree', 'berries', 'gold', 'stone'];
    vs.forEach((v, i) => {
      const node = g.resources.filter((r) => r.type === types[i]).sort((a, b) => g.dist(v, a) - g.dist(v, b))[0];
      g.cmdTarget(0, [v.id], node.id);
    });
    run(g, 120);
    const res = g.players[0].res;
    expect(res.wood).toBeGreaterThan(start.wood);
    expect(res.food).toBeGreaterThan(start.food);
    expect(res.gold).toBeGreaterThan(start.gold);
    expect(res.stone).toBeGreaterThan(start.stone);
  });

  it('constructs buildings, farms them and raises the population cap', () => {
    const g = new Game(3, setups);
    const [a, b] = villagers(g, 0);
    const cap = g.players[0].popCap;
    const hs = spot(g, 'house', 0);
    const house = g.cmdPlace(0, 'house', hs.cx, hs.cy, [a.id])!;
    const fs = spot(g, 'farm', 0);
    const farm = g.cmdPlace(0, 'farm', fs.cx, fs.cy, [b.id])!;
    expect(g.players[0].res.wood).toBe(200 - 30 - 50);
    run(g, 40);
    expect(house.complete).toBe(true);
    expect(g.players[0].popCap).toBe(cap + BUILDINGS.house.pop);
    expect(farm.complete).toBe(true);
    expect(farm.workerId).toBe(b.id);
    const food = g.players[0].res.food;
    run(g, 60);
    expect(g.players[0].res.food).toBeGreaterThan(food);
  });
});

describe('families', () => {
  const housed = (g: Game): Building => {
    const hs = spot(g, 'house', 0);
    const house = g.cmdPlace(0, 'house', hs.cx, hs.cy, villagers(g, 0).map((v) => v.id))!;
    run(g, 15);
    expect(house.complete).toBe(true);
    return house;
  };

  it('a man and a woman sharing a house raise new villagers', () => {
    const g = new Game(5, setups);
    const house = housed(g);
    const man = villagers(g, 0).find((v) => v.gender === 'm')!;
    const woman = villagers(g, 0).find((v) => v.gender === 'f')!;
    g.cmdTarget(0, [man.id, woman.id], house.id);
    run(g, 10);
    expect(house.residents).toEqual({ m: man.id, f: woman.id });
    expect(man.homeId).toBe(house.id);
    const before = villagers(g, 0).length;
    const food = g.players[0].res.food;
    // Put the mother to work so the child has a trade to learn.
    const tree = g.resources.filter((r) => r.type === 'tree').sort((a, b) => g.dist(woman, a) - g.dist(woman, b))[0];
    g.cmdTarget(0, [woman.id], tree.id);
    g.cmdTarget(0, [man.id], tree.id);
    run(g, BIRTH_TIME + 2);
    expect(villagers(g, 0).length).toBe(before + 1);
    expect(g.players[0].res.food).toBe(food - BIRTH_COST);
    // The newborn is a child: weaker, and it cannot work until it grows up.
    const child = villagers(g, 0).find((v) => v.growT > 0)!;
    expect(child.maxHp).toBeLessThan(child.def.hp);
    g.cmdTarget(0, [child.id], tree.id);
    expect(child.order?.t).toBe('move');
    g.cmdStop(0, [child.id]);
    run(g, GROW_TIME);
    expect(child.growT).toBe(0);
    expect(child.maxHp).toBe(child.def.hp);
    expect(child.order?.t).toBe('gather');
  });

  it('a house needs both a man and a woman', () => {
    const g = new Game(5, setups);
    const house = housed(g);
    const men = villagers(g, 0).filter((v) => v.gender === 'm');
    g.cmdTarget(0, men.map((v) => v.id), house.id);
    run(g, 60);
    expect(house.residents.m).not.toBe(0);
    expect(house.residents.f).toBe(0);
    expect(villagers(g, 0).length).toBe(4);
    // Losing a resident frees the slot again.
    g.cmdDelete(0, [house.residents.m]);
    run(g, 1);
    expect(house.residents.m).toBe(0);
  });

  it('auto-assign finds a couple', () => {
    const g = new Game(5, setups);
    const house = housed(g);
    expect(g.cmdAutoResidents(0, house.id)).toBe(2);
    run(g, 10);
    expect(house.residents.m && house.residents.f).toBeTruthy();
  });
});

describe('ages and combat', () => {
  it('advancing an age unlocks new units', () => {
    const g = new Game(7, setups);
    const p = g.players[0];
    const tc = g.buildings.find((b) => b.owner === 0)!;
    expect(g.cmdTrain(0, tc.id, 'warlord')).toBe(false);
    Object.assign(p.res, { food: 2000, wood: 2000, gold: 2000, stone: 2000 });
    expect(g.cmdAgeUp(0, tc.id)).toBe(true);
    expect(g.cmdAgeUp(0, tc.id)).toBe(false);
    run(g, 50);
    expect(p.age).toBe(1);
    expect(g.cmdTrain(0, tc.id, 'warlord')).toBe(true);
    expect(g.cmdTrain(0, tc.id, 'warlord')).toBe(false); // hero limit
  });

  it('spearmen beat riders, and units kill each other', () => {
    const g = new Game(7, setups);
    const spears: Unit[] = [], riders: Unit[] = [];
    for (let i = 0; i < 4; i++) {
      spears.push(g.spawnUnit('spearman', 0, 46 + i, 48));
      riders.push(g.spawnUnit('rider', 1, 46 + i, 51));
    }
    run(g, 60);
    expect(riders.every((r) => r.dead)).toBe(true);
    expect(spears.some((s) => !s.dead)).toBe(true);
  });

  it('plague spreads through enemy troops and shamans cure it', () => {
    const g = new Game(7, setups);
    const prophet = g.spawnUnit('prophet', 0, 40, 48);
    prophet.mana = 100;
    const victims = [0, 1, 2, 3].map((i) => g.spawnUnit('clubman', 1, 47 + i * 0.5, 48));
    const far = g.spawnUnit('clubman', 1, 60, 60);
    expect(g.cmdCast(0, [prophet.id], 'plague', 48, 48)).toBe(true);
    run(g, 4);
    expect(prophet.mana).toBeLessThan(50);
    expect(victims.every((v) => v.plagueT > 0 && v.hp < v.maxHp)).toBe(true);
    expect(far.plagueT).toBe(0);
    expect(g.cmdCast(0, [prophet.id], 'plague', 48, 48)).toBe(false); // out of faith
    const shaman = g.spawnUnit('shaman', 1, 48, 49);
    g.cmdStop(1, victims.map((v) => v.id));
    run(g, 12);
    expect(victims.some((v) => !v.dead && v.plagueT === 0)).toBe(true);
    expect(shaman.dead).toBe(false);
  });

  it('earthquakes damage enemy buildings only', () => {
    const g = new Game(7, setups);
    const enemyTc = g.buildings.find((b) => b.owner === 1)!;
    const prophet = g.spawnUnit('prophet', 0, enemyTc.x - 8, enemyTc.y);
    prophet.mana = 100;
    const mine = g.spawnBuilding('house', 0, enemyTc.cx - 3, enemyTc.cy, true);
    g.cmdCast(0, [prophet.id], 'quake', enemyTc.x, enemyTc.y);
    run(g, 8);
    expect(enemyTc.hp).toBeLessThan(enemyTc.maxHp - 250);
    expect(mine.hp).toBe(mine.maxHp);
  });

  it('destroying every enemy building wins the game', () => {
    const g = new Game(7, setups);
    g.cmdDelete(1, g.buildings.filter((b) => b.owner === 1).map((b) => b.id));
    run(g, 2);
    expect(g.winner).toBe(0);
  });
});

describe('ai', () => {
  it('two AIs develop, advance ages and fight without errors', () => {
    const g = new Game(11, [{ ...setups[0], isAI: true }, setups[1]]);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    const log: string[] = [];
    let minute = 0;
    run(g, 60 * 25, () => {
      if (g.winner < 0) ais.forEach((a) => a.update());
      if (g.time / 60 >= minute) {
        log.push(`${minute}m ` + g.players.map((p) =>
          `[age ${p.age} pop ${p.pop}/${p.popCap} v${villagers(g, p.id).length} f${p.res.food | 0} w${p.res.wood | 0} g${p.res.gold | 0} s${p.res.stone | 0} b${g.buildings.filter((b) => b.owner === p.id).length} idle${villagers(g, p.id).filter((v) => !v.order).length} couples${g.buildings.filter((b) => b.owner === p.id && b.residents.m && b.residents.f).length} army${g.units.filter((u) => u.owner === p.id && u.type !== 'villager').length}]`).join(' '));
        minute++;
      }
    });
    console.log(log.join('\n') + `\nwinner ${g.winner} at ${(g.time / 60).toFixed(1)}m`);
    const best = Math.max(...g.players.map((p) => p.age));
    expect(best).toBeGreaterThanOrEqual(2);
  }, 120000);

  it('a Hard AI defeats an Easy AI', () => {
    const g = new Game(23, [{ ...setups[0], isAI: true }, setups[1]]);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    ais[0].setLevel(0);
    ais[1].setLevel(2);
    run(g, 60 * 45, () => { if (g.winner < 0) ais.forEach((a) => a.update()); });
    expect(g.winner).toBe(1);
  }, 120000);
});

describe('wildlife and shelter', () => {
  it('villagers hunt deer and bring home the meat', () => {
    const g = new Game(3, setups);
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const deer = g.units.filter((u) => u.type === 'deer').sort((a, b) => Math.hypot(a.x - tc.x, a.y - tc.y) - Math.hypot(b.x - tc.x, b.y - tc.y))[0];
    expect(Math.hypot(deer.x - tc.x, deer.y - tc.y)).toBeLessThan(18);
    const hunter = villagers(g, 0)[0];
    const food = g.players[0].res.food;
    g.cmdTarget(0, [hunter.id], deer.id);
    run(g, 90);
    expect(deer.dead).toBe(true);
    expect(hunter.dead).toBe(false);
    expect(g.players[0].res.food).toBeGreaterThan(food);
  });

  it('soldiers ignore deer but wolves attack, and the wild never wins', () => {
    const g = new Game(3, setups);
    const wolf = g.units.find((u) => u.type === 'wolf')!;
    const deer = g.units.find((u) => u.type === 'deer')!;
    const guard = g.spawnUnit('clubman', 0, deer.x + 1, deer.y);
    const bait = g.spawnUnit('villager', 0, wolf.x + 2, wolf.y, 'm');
    run(g, 20);
    expect(deer.dead).toBe(false);
    expect(guard.order).toBe(null);
    expect(bait.hp).toBeLessThan(bait.maxHp);
    expect(g.winner).toBe(-1);
  });

  it('the town bell shelters villagers and the all-clear sends them back to work', () => {
    const g = new Game(3, setups);
    const vs = villagers(g, 0);
    const tree = g.resources.filter((r) => r.type === 'tree').sort((a, b) => g.dist(vs[0], a) - g.dist(vs[0], b))[0];
    g.cmdTarget(0, vs.map((v) => v.id), tree.id);
    run(g, 5);
    g.cmdBell(0, true);
    run(g, 20);
    const tc = g.buildings.find((b) => b.owner === 0)!;
    expect(tc.sheltered.length).toBe(4);
    expect(vs.every((v) => v.inside === tc.id)).toBe(true);
    // Orders are ignored while inside.
    g.cmdMove(0, vs.map((v) => v.id), 30, 30);
    expect(vs[0].order).toBe(null);
    g.cmdBell(0, false);
    expect(tc.sheltered.length).toBe(0);
    expect(vs.every((v) => !v.inside && v.order?.t === 'gather')).toBe(true);
  });
});

describe('walls and gates', () => {
  /** Ring of wall around a point, with one gate. */
  const fort = (g: Game, owner: number, x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) g.spawnBuilding(dx === 0 && dy === 2 ? 'gate' : 'palisade', owner, x + dx, y + dy, true);
  };

  it('gates let only their owner through, and enemies break walls down', () => {
    const g = new Game(7, setups);
    fort(g, 0, 48, 48);
    const friend = g.spawnUnit('villager', 0, 48.5, 54.5, 'm'); // a villager, so it will not run out to fight
    const foe = g.spawnUnit('swordsman', 1, 50.5, 54.5);
    const before = g.buildings.length;
    g.cmdMove(0, [friend.id], 48.5, 48.5);
    g.cmdMove(1, [foe.id], 48.5, 48.5, true);
    run(g, 8);
    expect(Math.hypot(friend.x - 48.5, friend.y - 48.5)).toBeLessThan(0.5);
    expect(Math.max(Math.abs(foe.x - 48.5), Math.abs(foe.y - 48.5))).toBeGreaterThan(2);
    g.cmdDelete(0, [friend.id]);
    run(g, 120);
    expect(g.buildings.length).toBeLessThan(before); // chewed through a segment
  });

  it('places a line of segments and stops when the wood runs out', () => {
    const g = new Game(7, setups);
    const cells = Array.from({ length: 60 }, (_, i) => ({ cx: 40 + i, cy: 48 })).filter((c) => g.canPlace('palisade', c.cx, c.cy));
    // Player 1 is an AI, so it is not limited to explored ground.
    const n = g.cmdPlaceLine(1, 'palisade', cells, villagers(g, 1).map((v) => v.id));
    expect(n).toBe(Math.min(cells.length, 50)); // 200 wood at 4 each
    expect(villagers(g, 1).every((v) => v.order?.t === 'build')).toBe(true);
  });

  it('a player with only walls left is defeated', () => {
    const g = new Game(7, setups);
    g.spawnBuilding('palisade', 1, 48, 48, true);
    g.cmdDelete(1, g.buildings.filter((b) => b.owner === 1 && !b.def.wall).map((b) => b.id));
    run(g, 2);
    expect(g.winner).toBe(0);
  });
});

describe('queued orders', () => {
  it('a shift-queued order runs after the current one, and stop clears the queue', () => {
    const g = new Game(7, setups);
    const u = g.spawnUnit('clubman', 0, 40.5, 48.5);
    g.cmdMove(0, [u.id], 44.5, 48.5);
    g.cmdMove(0, [u.id], 44.5, 52.5, false, true);
    g.cmdMove(0, [u.id], 40.5, 52.5, false, true);
    expect(u.queue.length).toBe(2);
    run(g, 2.2);
    expect(Math.hypot(u.x - 44.5, u.y - 48.5)).toBeLessThan(0.6); // first leg done, not cut short
    run(g, 6);
    expect(Math.hypot(u.x - 40.5, u.y - 52.5)).toBeLessThan(0.3);
    expect(u.order).toBe(null);
    g.cmdMove(0, [u.id], 44.5, 48.5);
    g.cmdMove(0, [u.id], 44.5, 52.5, false, true);
    g.cmdStop(0, [u.id]);
    expect(u.order).toBe(null);
    expect(u.queue.length).toBe(0);
    // An ordinary order replaces the queue.
    g.cmdMove(0, [u.id], 44.5, 48.5);
    g.cmdMove(0, [u.id], 44.5, 52.5, false, true);
    g.cmdMove(0, [u.id], 41.5, 48.5);
    expect(u.queue.length).toBe(0);
  });

  it('villagers build shift-placed buildings one after another', () => {
    const g = new Game(7, [{ ...setups[0], isAI: true }, setups[1]]);
    const v = villagers(g, 0)[0];
    const a = spot(g, 'house', 0);
    const h1 = g.cmdPlace(0, 'house', a.cx, a.cy, [v.id], true)!;
    const b = spot(g, 'house', 0);
    const h2 = g.cmdPlace(0, 'house', b.cx, b.cy, [v.id], true)!;
    expect(v.order).toMatchObject({ t: 'build', id: h1.id });
    run(g, 60);
    expect(h1.complete && h2.complete).toBe(true);
  });
});

describe('market', () => {
  it('trades surplus for gold and gold for what is short', () => {
    const g = new Game(7, setups);
    const p = g.players[0];
    const market = g.spawnBuilding('market', 0, 40, 40, true);
    Object.assign(p.res, { food: 50, wood: 250, gold: 0, stone: 0 });
    expect(g.cmdTrade(0, market.id, 'food', 'buy')).toBe(false); // no gold yet
    expect(g.cmdTrade(0, market.id, 'wood', 'sell')).toBe(true);
    expect(g.cmdTrade(0, market.id, 'wood', 'sell')).toBe(true);
    expect(g.cmdTrade(0, market.id, 'wood', 'sell')).toBe(false); // only 50 wood left
    expect(p.res).toMatchObject({ wood: 50, gold: 80 });
    Object.assign(p.res, { gold: 100 });
    expect(g.cmdTrade(0, market.id, 'food', 'buy')).toBe(true);
    expect(p.res).toMatchObject({ food: 150, gold: 15 });
  });
});

describe('garrison', () => {
  it('units sent into a tower are safe, speed up its fire and come back out', () => {
    const g = new Game(7, setups);
    const tower = g.spawnBuilding('tower', 0, 47, 47, true);
    const archers = [0, 1, 2, 3, 4].map((i) => g.spawnUnit('bowman', 0, 46 + i, 50.5));
    const rider = g.spawnUnit('rider', 0, 46, 51.5);
    expect(g.cmdShelter(0, [...archers, rider].map((u) => u.id), tower.id)).toBe(4); // room for four, no horses
    run(g, 8);
    expect(tower.sheltered.length).toBe(4);
    const foe = g.spawnUnit('swordsman', 1, 48, 52);
    run(g, 3);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(archers.filter((a) => a.inside).every((a) => a.hp === a.maxHp)).toBe(true);
    g.cmdRelease(0, tower.id);
    expect(tower.sheltered.length).toBe(0);
    expect(archers.every((a) => !a.inside)).toBe(true);
  });
});

describe('save and load', () => {
  it('a restored game plays out exactly like the original', () => {
    const g = new Game(11, [{ ...setups[0], isAI: true }, setups[1]]);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    run(g, 60 * 6, () => ais.forEach((a) => a.update()));
    const copy = Game.restore(g.serialize());
    expect(copy.units.length).toBe(g.units.length);
    for (let i = 0; i < 600; i++) { g.step(); copy.step(); }
    expect(copy.serialize()).toBe(g.serialize());
    expect(() => Game.restore(g.serialize().replace(/"v":\d+/, '"v":0'))).toThrow();
  });
});

describe('conquest campaign', () => {
  it('builds a connected map with a capital and an army for each faction', () => {
    for (const rivals of [1, 2, 3]) {
      const c = newCampaign(42 + rivals, rivals);
      expect(c.territories.length).toBe(15);
      expect(c.factions.length).toBe(rivals + 1);
      for (const f of c.factions) {
        const cap = c.territories.find((t) => t.capital === f.id)!;
        expect(cap.owner).toBe(f.id);
        expect(armyAt(c, cap.id)?.owner).toBe(f.id);
      }
      // Every territory can be reached from the first.
      const seen = new Set([0]);
      const q = [0];
      while (q.length) for (const n of c.territories[q.pop()!].adj) if (!seen.has(n)) { seen.add(n); q.push(n); }
      expect(seen.size).toBe(15);
      expect(c.territories.every((t) => t.adj.every((n) => c.territories[n].adj.includes(t.id)))).toBe(true);
    }
  });

  it('spending, marching, and battles follow the rules', () => {
    const c = newCampaign(7);
    const home = c.territories.find((t) => t.capital === 0)!;
    const army = armyAt(c, home.id)!;
    expect(income(c, 0)).toBe(6); // 2 + development 2 + capital 2
    expect(canRecruit(c, 0, home.id)).toBe(false); // an army is already here
    expect(reinforce(c, 0, home.id)).toBe(true);
    expect(army.size).toBe(4);
    expect(c.factions[0].supplies).toBe(4);
    const target = c.territories[home.adj[0]];
    expect(moveArmy(c, army.id, target.id)).toBe('battle');
    expect(c.pending).toMatchObject({ attacker: 0, defender: -1, aStr: 4, dStr: target.militia });
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].bonus!.units!.clubman).toBe(4);
    expect(cfg.setups[1].name).toBe('Local Tribe');
    expect(cfg.level).toBe(0);
    expect(endTurn(c)).toBe(undefined);
    expect(c.phase).toBe('player'); // cannot end the turn with a battle outstanding
    finishBattle(c, true);
    expect(target.owner).toBe(0);
    expect(army.at).toBe(target.id);
    expect(moveArmy(c, army.id, home.id)).toBe('invalid'); // already moved this turn
    endTurn(c);
    expect(c.turn === 2 || c.pending !== null).toBe(true);
  });

  it('a lost defence costs the territory, and rivals fight the campaign to a finish', () => {
    const c = newCampaign(3, 2, 2);
    let guard = 0;
    while (c.phase !== 'over' && guard++ < 400) {
      if (c.pending) resolvePending(c, 'auto'); // the player never fights in person here
      else if (c.phase === 'player') endTurn(c);
      else continueAI(c);
    }
    expect(c.phase).toBe('over');
    expect(c.winner).toBeGreaterThan(0); // a passive player is eventually conquered
    expect(c.factions[0].alive).toBe(false);
    expect(c.territories.every((t) => t.dev >= 0 && t.dev <= 3)).toBe(true);
  });

  it('battle bonuses give each side its army in the real-time game', () => {
    const c = newCampaign(7);
    const home = c.territories.find((t) => t.capital === 0)!;
    moveArmy(c, armyAt(c, home.id)!.id, home.adj[0]);
    const cfg = battleConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'clubman').length).toBe(3);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'slinger').length).toBe(2);
    expect(g.players[0].res.food).toBe(200 + 120);
    run(g, 5);
  });
});
