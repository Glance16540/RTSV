import { describe, expect, it } from 'vitest';
import { FOLK, FOLK_VOICES, FolkMoment, LEANS, folkKey, leanOf } from '../src/sim/folk';
import { AIController } from '../src/sim/ai';
import { MERC_WAGE, PATRON_MUSTER, CLERGY_BIRTH, CLERGY_VIRTUE, CREEDS, DILEMMAS, MAID_GOLD, MAID_VIRTUE, creedOf } from '../src/sim/creed';
import { BIRTH_COST, BIRTH_TIME, BUILDINGS, GROW_TIME } from '../src/sim/data';
import { Building, DAY_LENGTH, Game, LAIR_AT, LAIR_BIRTH, NIGHT_SIGHT, Unit } from '../src/sim/game';
import { connected, generateMap, T_GRASS, T_MARSH, T_ROCK, T_SAND, T_SNOW, T_WATER } from '../src/sim/map';
import { MISSIONS, missionById, runMission } from '../src/sim/scenario';
import { TEMPER_QUESTIONS, battleHabits, habitsWith, leaningWith, setTemperament, temperFrom, temperWord } from '../src/sim/temper';
import { LEADERS, LEADER_EVENTS, leaderOf, lineKey, monogram, personaLines, setLeaderCharacter, setLeaderPersona, speechText } from '../src/sim/leaders';
import { BAND, CIV_COLOR, CIV_IDS, CIV_STYLE, CIVS, STYLES, UNITS, styleOf } from '../src/sim/data';
import { Campaign, BIOMES, biomeOf, terrainOf, WEATHER, HOARD_PRIZE, HORDE_PRIZE, weatherAt, eventsAt, ageCost, truceCost, giftCost, advanceAge, canAdvance, ageOf, AGE_COST, AGE_EDGE, reach, canBuild, SEA_LANDING, sendGift, canGift, GIFT_COST, MAX_FAVOR, answerDemand, atTruce, offerTruce, offerAlliance, canAlly, dominionNeed, DOMINION_TURNS, ALLIANCE_COST, totalStrength, siteCost, companyCost, territoryIncome, heroCost, homeEdge, TRUCE_COST, PERSONA, CAMPAIGN_EDGE, armyAt, armySize, armyStrength, battleConfig, winChance, build, canRaise, canSummonHero, continueAI, defence, endTurn, finishBattle, income, moveArmy, newCampaign, raise, resolvePending, summonHero } from '../src/sim/campaign';

const setups = [
  { name: 'A', color: 0x3366ff, isAI: false },
  { name: 'B', color: 0xff3333, isAI: true, civ: 'hearth' }, // a settled people: the raiders have tests of their own
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

  it('keeps score: kills, losses, gathering and a history', () => {
    const g = new Game(7, setups);
    for (let i = 0; i < 3; i++) { g.spawnUnit('swordsman', 0, 46 + i, 48); g.spawnUnit('clubman', 1, 46 + i, 50); }
    const v = villagers(g, 0)[0];
    const tree = g.resources.filter((r) => r.type === 'tree').sort((a, b) => g.dist(v, a) - g.dist(v, b))[0];
    g.cmdTarget(0, [v.id], tree.id);
    const before = g.score(0);
    run(g, 65);
    expect(g.players[0].stats.kills).toBe(3);
    expect(g.players[1].stats.lost).toBe(3);
    expect(g.players[0].stats.gathered).toBeGreaterThan(0);
    expect(g.players[0].history.length).toBe(2); // sampled every 30 seconds
    expect(g.score(0)).toBeGreaterThan(before - 100);
    expect(Game.restore(g.serialize()).players[0].stats.kills).toBe(3);
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

describe('teams', () => {
  const four = (teams: number[]) => new Game(9, teams.map((team, i) => ({ name: 'P' + i, color: i + 1, isAI: i > 0, team, civ: ['stonekin', 'hearth', 'forge', 'egypt'][i] })));

  it('allies do not fight, share sight and gates, and win together', () => {
    const g = four([0, 0, 1, 1]);
    expect(g.hostile(0, 1)).toBe(false);
    expect(g.hostile(0, 2)).toBe(true);
    expect(g.hostile(0, g.wild)).toBe(true);
    // Soldiers of allied players stand side by side; an enemy nearby is attacked by both.
    const mine = g.spawnUnit('swordsman', 0, 60.5, 60.5), friend = g.spawnUnit('swordsman', 1, 61.5, 60.5);
    run(g, 3);
    expect(mine.hp).toBe(mine.maxHp);
    expect(friend.order).toBe(null);
    g.cmdTarget(0, [mine.id], friend.id);
    expect(mine.order?.t).toBe('move'); // cannot be told to attack an ally
    const foe = g.spawnUnit('villager', 2, 63.5, 60.5, 'm');
    run(g, 6);
    expect(foe.dead).toBe(true);
    // An ally's gate opens for us; an enemy's does not.
    for (let dx = -3; dx <= 3; dx++) g.spawnBuilding(dx === 0 ? 'gate' : 'palisade', 1, 64 + dx, 70, true);
    g.pf.pass = 2 + g.players[0].team;
    expect(g.pf.isBlocked(64, 70)).toBe(false);
    g.pf.pass = 2 + g.players[2].team;
    expect(g.pf.isBlocked(64, 70)).toBe(true);
    // We see what our ally sees.
    const allyTc = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    expect(g.vis[Math.floor(allyTc.y) * g.size + Math.floor(allyTc.x)]).toBe(2);
    // Victory belongs to the side, and the game goes on while an ally stands.
    g.cmdDelete(2, g.buildings.filter((b) => b.owner === 2).map((b) => b.id));
    run(g, 2);
    expect(g.winner).toBe(-1);
    g.cmdDelete(0, g.buildings.filter((b) => b.owner === 0).map((b) => b.id));
    run(g, 2);
    expect(g.players[0].defeated).toBe(true);
    expect(g.winner).toBe(-1);
    g.cmdDelete(3, g.buildings.filter((b) => b.owner === 3).map((b) => b.id));
    run(g, 2);
    expect(g.winner).toBe(1);
    expect(g.hostile(g.winner, 0)).toBe(false);
  });

  it('allied AIs leave each other alone and go for the other side', () => {
    const g = four([0, 1, 1, 1]);
    const ais = [1, 2, 3].map((i) => new AIController(g, i));
    ais.forEach((a) => { a.setLevel(2); });
    run(g, 60 * 14, () => { if (g.winner < 0) ais.forEach((a) => a.update()); });
    // The three allies never hurt one another's buildings, and the lone player is the one under attack.
    for (const i of [1, 2, 3]) expect(g.players[i].stats.buildingsLost).toBe(0);
    expect(g.players[0].defeated || g.players[0].lastAttacked !== null).toBe(true);
  }, 180000);
});

describe('upgrades, gunpowder and traits', () => {
  it('an upgrade re-equips existing units and changes what is trained', () => {
    const g = new Game(7, setups);
    const p = g.players[0];
    p.age = 4;
    Object.assign(p.res, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
    const barracks = g.spawnBuilding('barracks', 0, 40, 40, true);
    const range = g.spawnBuilding('range', 0, 46, 40, true);
    const slinger = g.spawnUnit('slinger', 0, 42, 45);
    slinger.hp = slinger.maxHp / 2;
    g.cmdMove(0, [slinger.id], 44, 46);
    expect(g.cmdResearch(0, barracks.id, 'up_bowman')).toBe(true);
    run(g, 31);
    expect(slinger.type).toBe('bowman');
    expect(slinger.hp).toBeCloseTo(slinger.maxHp / 2);
    expect(g.trainedAs(0, 'slinger')).toBe('bowman');
    // Chained upgrades: slinger -> bowman -> crossbowman -> musketeer.
    g.cmdResearch(0, range.id, 'up_crossbow');
    g.cmdResearch(0, range.id, 'up_musket');
    run(g, 105);
    expect(slinger.type).toBe('musketeer');
    expect(g.cmdTrain(0, barracks.id, 'slinger')).toBe(true);
    expect(barracks.queue[0].id).toBe('musketeer');
    // Guns out-range and out-hit the bows they replace.
    const foe = g.spawnUnit('knight', 1, slinger.x + 6, slinger.y);
    g.cmdStop(1, [foe.id]);
    run(g, 1.5);
    expect(foe.maxHp - foe.hp).toBeGreaterThanOrEqual(19);
  });

  it('the fifth age can be reached', () => {
    const g = new Game(7, setups);
    const p = g.players[0];
    const tc = g.buildings.find((b) => b.owner === 0)!;
    p.age = 3;
    Object.assign(p.res, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
    expect(g.cmdAgeUp(0, tc.id)).toBe(true);
    run(g, 95);
    expect(p.age).toBe(4);
    expect(g.cmdAgeUp(0, tc.id)).toBe(false); // nothing beyond
  });

  it('villagers have names and traits, and children take after their parents', () => {
    const g = new Game(5, setups);
    const vs = villagers(g, 0);
    expect(vs.every((v) => v.name.length > 0)).toBe(true);
    const man = vs.find((v) => v.gender === 'm')!, woman = vs.find((v) => v.gender === 'f')!;
    g.setTrait(man, 'strong');
    g.setTrait(woman, 'hardy');
    expect(woman.maxHp).toBe(60);
    const hs = spot(g, 'house', 0);
    const house = g.spawnBuilding('house', 0, hs.cx, hs.cy, true);
    house.residents = { m: man.id, f: woman.id };
    g.players[0].res.food = 99999;
    const counts: Record<string, number> = {};
    for (let i = 0; i < 80; i++) {
      house.birthProgress = 1;
      g.step();
      const child = villagers(g, 0).find((v) => v.growT > 0)!;
      expect(child.family).toBe(house.family);
      counts[child.trait || 'none'] = (counts[child.trait || 'none'] ?? 0) + 1;
      if (child.trait === 'hardy') expect(child.maxHp).toBe(Math.round(40 * 1.5 * 0.4));
      g.cmdDelete(0, [child.id]);
    }
    expect(house.family.length).toBeGreaterThan(0);
    expect(counts.strong + counts.hardy).toBeGreaterThan(60); // about nine in ten inherit
    expect(counts.strong).toBeGreaterThan(20);
    expect(counts.hardy).toBeGreaterThan(20);
    // Traits do what they say.
    const fast = g.spawnUnit('villager', 0, 40.5, 60.5, 'm'), slow = g.spawnUnit('villager', 0, 40.5, 62.5, 'm');
    g.setTrait(fast, 'swift');
    g.setTrait(slow, '');
    g.cmdMove(0, [fast.id], 52.5, 60.5);
    g.cmdMove(0, [slow.id], 52.5, 62.5);
    run(g, 3);
    expect(fast.x).toBeGreaterThan(slow.x + 0.8);
  });
});

describe('stances, patrol and wonder', () => {
  it('stances decide how far a unit chases', () => {
    const g = new Game(7, setups);
    const mk = (stance: 'aggressive' | 'defensive' | 'hold', y: number) => { const u = g.spawnUnit('swordsman', 0, 40.5, y); u.stance = stance; return u; };
    const hold = mk('hold', 44.5), aggressive = mk('aggressive', 54.5);
    const bait1 = g.spawnUnit('villager', 1, 44.5, 44.5, 'm'), bait2 = g.spawnUnit('villager', 1, 44.5, 54.5, 'm');
    run(g, 8);
    expect(Math.hypot(hold.x - 40.5, hold.y - 44.5)).toBeLessThan(0.5); // never left its post
    expect(bait1.hp).toBe(bait1.maxHp);
    expect(bait2.dead).toBe(true);
    expect(aggressive.x).toBeGreaterThan(42);
    // Something walking into reach of a holding unit is still struck.
    const fool = g.spawnUnit('villager', 1, 41.2, 44.5, 'm');
    run(g, 6);
    expect(fool.dead).toBe(true);
  });

  it('patrolling units walk their beat and fight what they meet', () => {
    const g = new Game(7, setups);
    const u = g.spawnUnit('swordsman', 0, 40.5, 48.5);
    g.cmdPatrol(0, [u.id], 46.5, 48.5);
    let maxX = 0, returned = false;
    run(g, 14, () => { maxX = Math.max(maxX, u.x); if (maxX > 46 && u.x < 41.5) returned = true; });
    expect(maxX).toBeGreaterThan(46);
    expect(returned).toBe(true);
    expect(u.order?.t).toBe('patrol');
    const foe = g.spawnUnit('villager', 1, 43.5, 50, 'm');
    run(g, 10);
    expect(foe.dead).toBe(true);
    expect(u.order?.t).toBe('patrol');
  });

  it('a Wonder that stands for five minutes wins, and losing it stops the clock', () => {
    const g = new Game(7, setups);
    const v = villagers(g, 1)[0];
    const s = spot(g, 'wonder', 1);
    g.players[1].age = 3;
    Object.assign(g.players[1].res, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
    const w = g.cmdPlace(1, 'wonder', s.cx, s.cy, [v.id])!;
    w.progress = 0.999;
    run(g, 20);
    expect(w.complete).toBe(true);
    expect(g.events.some((e) => e.t === 'wonder')).toBe(true);
    expect(g.wonderLeft(1)).toBeGreaterThan(270);
    expect(g.wonderLeft(0)).toBe(-1);
    run(g, 200);
    expect(g.winner).toBe(-1);
    const copy = Game.restore(g.serialize());
    copy.cmdDelete(1, [w.id]);
    run(copy, 120);
    expect(copy.winner).toBe(-1); // clock stopped with the Wonder gone
    run(g, 100);
    expect(g.winner).toBe(1);
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
      const n = c.territories.length;
      expect(n).toBeGreaterThanOrEqual(12);
      expect(n).toBeLessThanOrEqual(30);
      expect(c.factions.length).toBe(rivals + 1);
      for (const f of c.factions) {
        const cap = c.territories.find((t) => t.capital === f.id)!;
        expect(cap.owner).toBe(f.id);
        expect(armyAt(c, cap.id)?.owner).toBe(f.id);
      }
      // Every territory can be reached from the first.
      const seen = new Set([0]);
      const q = [0];
      while (q.length) for (const t of c.territories[q.pop()!].adj) if (!seen.has(t)) { seen.add(t); q.push(t); }
      expect(seen.size).toBe(n);
      expect(c.territories.every((t) => t.adj.every((a) => c.territories[a].adj.includes(t.id)))).toBe(true);
      // Capitals are never next door to each other.
      const caps = c.territories.filter((t) => t.capital >= 0);
      expect(caps.every((a) => caps.every((b) => a === b || !a.adj.includes(b.id)))).toBe(true);
    }
  });

  it('every campaign is a different world of different peoples, each with a leader', () => {
    const shapes = new Set<number>(), homes = new Set<string>(), lineups = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const c = newCampaign(seed, 3);
      shapes.add(c.territories.length);
      homes.add(c.territories.filter((t) => t.capital >= 0).map((t) => t.id).join(','));
      const civs = c.factions.map((f) => f.civ);
      lineups.add(civs.join(','));
      expect(new Set(civs).size).toBe(4); // no two factions are the same people
      for (const f of c.factions) expect(f.color).toBe(CIV_COLOR[f.civ]);
      // Each rival leader introduces themselves.
      // Your own leader opens, then each rival leader introduces themselves.
      expect(c.speech[0]).toMatchObject({ civ: civs[0], event: 'p_start' });
      expect(c.speech.slice(1).map((sp) => sp.civ)).toEqual(civs.slice(1));
      expect(c.speech.slice(1).every((sp) => sp.event === 'intro' && speechText(sp).length > 10)).toBe(true);
    }
    expect(shapes.size).toBeGreaterThanOrEqual(4);
    expect(homes.size).toBeGreaterThan(20);
    expect(lineups.size).toBeGreaterThan(20);
    expect(newCampaign(9, 2, 1, 'wild').factions[0].civ).toBe('wild');
    expect(JSON.stringify(newCampaign(9, 2))).toBe(JSON.stringify(newCampaign(9, 2))); // same seed, same world
  });

  it('leaders have a full set of lines and speak when things happen', () => {
    expect(Object.keys(LEADERS).sort()).toEqual(CIV_IDS.slice().sort());
    const keys = new Set<string>();
    for (const l of Object.values(LEADERS)) {
      for (const ev of LEADER_EVENTS) {
        expect(l.lines[ev].length, `${l.civ} ${ev}`).toBeGreaterThanOrEqual(2);
        l.lines[ev].forEach((_, i) => keys.add(lineKey(l.civ, ev, i)));
      }
    }
    expect(keys.size).toBe(520);
    expect(keys.has('steppe_attack_2')).toBe(true);
    // In a campaign: the player attacks a rival, wins, and finally wipes them out.
    const c = newCampaign(7, 1);
    c.speech.length = 0;
    const foeCap = c.territories.find((t) => t.capital === 1)!;
    const next = c.territories[foeCap.adj[0]];
    next.owner = 0;
    c.armies = c.armies.filter((a) => a.owner !== 0 && a.at !== next.id);
    c.armies.push({ id: 77, owner: 0, at: next.id, units: { cavalry: 10 }, hero: false, vet: 0, moved: false });
    moveArmy(c, 77, foeCap.id);
    expect(c.speech.map((sp) => sp.event)).toEqual(['defend']);
    expect(c.speech[0].civ).toBe(c.factions[1].civ);
    finishBattle(c, true);
    expect(c.speech.map((sp) => sp.event)).toEqual(['defend', 'lose', 'p_win', 'eliminated']);
    expect(c.phase).toBe('over');
    // And when a rival comes for the player and wins.
    const d = newCampaign(7, 1);
    d.speech.length = 0;
    const myCap = d.territories.find((t) => t.capital === 0)!;
    const beside = d.territories[myCap.adj[0]];
    beside.owner = 1;
    d.armies = d.armies.filter((a) => a.at !== beside.id);
    d.armies.push({ id: 78, owner: 1, at: beside.id, units: { cavalry: 10 }, hero: false, vet: 0, moved: false });
    moveArmy(d, 78, myCap.id);
    expect(d.speech.map((sp) => sp.event)).toEqual(['attack']);
    const cfg = battleConfig(d)!;
    expect(cfg.setups[0].civ).toBe(d.factions[0].civ);
    expect(cfg.setups[1].civ).toBe(d.factions[1].civ);
    finishBattle(d, false);
    expect(d.speech.map((sp) => sp.event)).toEqual(['attack', 'win', 'p_loss']);
  });

  it('spending, marching, and battles follow the rules', () => {
    const c = newCampaign(7, 1, 1, 'steppe'); // a people with no discount on what is bought here
    const home = c.territories.find((t) => t.capital === 0)!;
    const army = armyAt(c, home.id)!;
    expect(income(c, 0)).toBe(6); // 2 + farmland 2 + capital 2
    expect(c.territories.some((t) => t.trait)).toBe(true);
    expect(armyStrength(army)).toBe(5); // three infantry and the Warlord
    expect(canRaise(c, 0, home.id, 'archers')).toBe(false); // no archery range yet
    expect(build(c, 0, home.id, 'range')).toBe(true);
    expect(build(c, 0, home.id, 'range')).toBe(false); // one of each
    expect(raise(c, 0, home.id, 'archers')).toBe(true);
    expect(army.units).toEqual({ infantry: 3, archers: 1 });
    expect(c.factions[0].supplies).toBe(8 - 5 - 2);
    const target = c.territories[home.adj[0]];
    expect(moveArmy(c, army.id, target.id)).toBe('battle');
    // Archers fight 30% harder against the locals' infantry: 3 + 1.3 + Warlord 2.
    expect(c.pending).toMatchObject({ attacker: 0, defender: -1, aStr: 6.3, dStr: target.militia + (target.trait === 'hills' ? 2 : 0) });
    expect(winChance(6.3, 1)).toBe(1);
    expect(winChance(3, 3)).toBeLessThan(0.5); // the defender has the edge at even strength
    expect(winChance(1, 6)).toBe(0);
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].bonus!.units).toEqual({ clubman: 6, slinger: 2, warlord: 1 });
    expect(cfg.setups[1].bonus!.units).toEqual({ clubman: target.militia * 2 });
    expect(cfg.setups[1].name).toBe('Local Tribe');
    expect(cfg.level).toBe(0);
    endTurn(c);
    expect(c.phase).toBe('player'); // cannot end the turn with a battle outstanding
    finishBattle(c, true);
    expect(target.owner).toBe(0);
    expect(army.at).toBe(target.id);
    expect(army.hero).toBe(true);
    expect(army.vet).toBe(1); // a victory makes veterans
    expect(armyStrength(army)).toBe(armySize(army) + 2 + 1);
    expect(moveArmy(c, army.id, home.id)).toBe('invalid'); // already moved this turn
    endTurn(c);
    expect(c.turn === 2 || c.pending !== null).toBe(true);
  });

  it('a lost army takes its Warlord with it, and a fortress is razed when stormed', () => {
    const c = newCampaign(7);
    const home = c.territories.find((t) => t.capital === 0)!;
    const army = armyAt(c, home.id)!;
    const target = c.territories[home.adj[0]];
    moveArmy(c, army.id, target.id);
    finishBattle(c, false);
    expect(c.armies.some((a) => a.owner === 0)).toBe(false);
    expect(c.factions[0].heroAlive).toBe(false);
    expect(canSummonHero(c, 0, home.id)).toBe(false); // needs an army to lead
    c.factions[0].supplies = 20;
    raise(c, 0, home.id, 'infantry');
    expect(summonHero(c, 0, home.id)).toBe(true);
    expect(armyAt(c, home.id)!.hero).toBe(true);
    // Storming fortified land.
    const foe = c.territories.find((t) => t.capital === 1)!;
    foe.buildings.push('fortress');
    expect(defence(c, foe.id)).toBe(5 + 1 + (c.factions[1].civ === 'stonekin' ? 4 : 3));
    const raiders = { id: 99, owner: 0, at: foe.adj[0], units: { cavalry: 6 }, hero: false, vet: 2, moved: false };
    c.territories[foe.adj[0]].owner = 0;
    c.armies = c.armies.filter((a) => a.at !== foe.adj[0]);
    c.armies.push(raiders);
    moveArmy(c, 99, foe.id);
    const cfg = battleConfig(c)!;
    expect(cfg.setups[1].bonus).toMatchObject({ age: 1, buildings: ['tower', 'tower'] });
    expect(cfg.setups[0].bonus!.atk).toBe(2);
    // Infantry is the answer to cavalry: the defenders count for more against this army.
    expect(c.pending!.dStr).toBeGreaterThan(defence(c, foe.id));
    const g = new Game(cfg.seed, cfg.setups, cfg.size);
    expect(g.buildings.filter((b) => b.owner === 1 && b.type === 'tower').length).toBe(2);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'rider').length).toBe(12);
    expect(g.players[0].mods.atk).toBe(2);
    finishBattle(c, true);
    expect(foe.owner).toBe(0);
    expect(foe.buildings).not.toContain('fortress');
    expect(c.factions[1].heroAlive).toBe(false);
  });

  it('a lost defence costs the territory, and rivals fight the campaign to a finish', () => {
    const c = newCampaign(3, 2, 2);
    let guard = 0;
    while (c.phase !== 'over' && guard++ < 400) {
      if (c.demand) answerDemand(c, false);
      else if (c.pending) resolvePending(c, 'auto'); // the player never fights in person here
      else if (c.phase === 'player') endTurn(c);
      else continueAI(c);
    }
    expect(c.phase).toBe('over');
    expect(c.winner).toBeGreaterThan(0); // a passive player is eventually conquered
    // Either wiped out, or a rival came to hold most of the land.
    expect(!c.factions[0].alive || c.dominion.turns >= DOMINION_TURNS).toBe(true);
    expect(c.territories.every((t) => t.buildings.length <= 4 && new Set(t.buildings).size === t.buildings.length)).toBe(true);
  });

  it('battle bonuses give each side its army in the real-time game', () => {
    const c = newCampaign(7);
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    moveArmy(c, armyAt(c, home.id)!.id, home.adj[0]);
    const cfg = battleConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'clubman').length).toBe(6);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'warlord').length).toBe(1);
    expect(g.players[0].res.food).toBe(200 + 150);
    run(g, 5);
  });
});

describe('new units', () => {
  const duel = (a: string, b: string, n = 4, gap = 3) => {
    const g = new Game(7, setups);
    const as: Unit[] = [], bs: Unit[] = [];
    for (let i = 0; i < n; i++) { as.push(g.spawnUnit(a, 0, 44 + i * 1.2, 48)); bs.push(g.spawnUnit(b, 1, 44 + i * 1.2, 48 + gap)); }
    run(g, 60);
    return { a: as.filter((u) => !u.dead).length, b: bs.filter((u) => !u.dead).length };
  };

  it('each new unit does its job', () => {
    expect(duel('javelineer', 'slinger').a).toBeGreaterThan(0); // skirmishers beat missile troops
    expect(duel('javelineer', 'slinger').b).toBe(0);
    expect(duel('pikeman', 'knight').b).toBe(0);
    expect(duel('hound', 'bowman', 6, 5).b).toBe(0); // hounds close the distance
    // A Scorpion bolt takes a great bite out of a beast, though unguarded it will still be trampled.
    const g = new Game(7, setups);
    g.spawnUnit('scorpion', 0, 44.5, 48.5);
    const beast = g.spawnUnit('mammoth', 1, 44.5, 56.5);
    g.cmdStop(1, [beast.id]);
    beast.stance = 'hold';
    run(g, 1.5);
    expect(beast.maxHp - beast.hp).toBeGreaterThanOrEqual(55);
    expect(duel('hussar', 'crossbowman', 4, 6).b).toBe(0);
  });

  it('rams ignore units and flatten buildings; berserkers speed up when hurt', () => {
    const g = new Game(7, setups);
    const ram = g.spawnUnit('ram', 0, 46.5, 46.5);
    const guard = g.spawnUnit('villager', 1, 47.5, 46.5, 'm');
    const wall = g.spawnBuilding('palisade', 1, 46, 49, true);
    g.cmdTarget(0, [ram.id], guard.id);
    run(g, 1);
    expect((ram.order as { id?: number } | null)?.id).not.toBe(guard.id); // cannot be set on a unit
    g.cmdStop(0, [ram.id]);
    run(g, 8);
    expect(wall.dead).toBe(true);
    expect(guard.hp).toBe(guard.maxHp);
    // Arrows barely scratch it.
    const archers = [0, 1, 2].map((i) => g.spawnUnit('bowman', 1, 44 + i, 42));
    run(g, 10);
    expect(ram.hp).toBeGreaterThan(ram.maxHp * 0.8);
    expect(archers.length).toBe(3);
    // Frenzy.
    const fresh = g.spawnUnit('berserker', 0, 60.5, 60.5), hurt = g.spawnUnit('berserker', 0, 60.5, 66.5);
    hurt.hp = hurt.maxHp * 0.2;
    const d1 = g.spawnBuilding('stonewall', 1, 61, 60, true), d2 = g.spawnBuilding('stonewall', 1, 61, 66, true);
    g.cmdTarget(0, [fresh.id], d1.id);
    g.cmdTarget(0, [hurt.id], d2.id);
    run(g, 12);
    expect(d2.maxHp - d2.hp).toBeGreaterThan((d1.maxHp - d1.hp) * 1.4);
  });

  it('a Strategist saps enemy damage and mends allies', () => {
    const fight = (withHero: boolean) => {
      const g = new Game(7, setups);
      const victim = g.spawnUnit('knight', 0, 46.5, 46.5);
      g.cmdStop(0, [victim.id]);
      victim.stance = 'hold';
      if (withHero) { const s = g.spawnUnit('strategist', 0, 46.5, 43.5); s.stance = 'hold'; (s.def as unknown) = { ...s.def, atk: 0, heal: 0 }; }
      const foe = g.spawnBuilding('tower', 1, 48, 48, true);
      run(g, 10);
      return { lost: victim.maxHp - victim.hp, tower: foe };
    };
    // Towers are buildings, so use a unit attacker instead for the damage comparison.
    const hit = (withHero: boolean) => {
      const g = new Game(7, setups);
      const target = g.spawnBuilding('stonewall', 0, 46, 48, true);
      if (withHero) g.spawnUnit('strategist', 0, 46.5, 51.5).stance = 'hold';
      const foe = g.spawnUnit('swordsman', 1, 46.5, 47.2);
      g.cmdTarget(1, [foe.id], target.id);
      run(g, 10);
      return target.maxHp - target.hp;
    };
    void fight;
    const plain = hit(false), sapped = hit(true);
    expect(sapped).toBeLessThan(plain * 0.9);
    const g = new Game(7, setups);
    const s = g.spawnUnit('strategist', 0, 46.5, 46.5), friend = g.spawnUnit('clubman', 0, 47.5, 46.5);
    friend.hp = 10;
    run(g, 6);
    expect(friend.hp).toBeGreaterThan(20);
    expect(g.cmdTrain(0, g.buildings.find((b) => b.owner === 0)!.id, 'strategist')).toBe(false); // needs the Iron Age
    expect(s.def.limit).toBe(1);
  });
});

describe('fighting as a side', () => {
  const four = (teams: number[]) => new Game(9, teams.map((team, i) => ({ name: 'P' + i, color: i + 1, isAI: i > 0, team, civ: ['stonekin', 'hearth', 'forge', 'egypt'][i] })));

  it('tribute moves resources between allies only, and needs a market', () => {
    const g = four([0, 0, 1, 1]);
    expect(g.cmdTribute(0, 1, 'wood')).toBe(false); // no market yet
    g.spawnBuilding('market', 0, 40, 40, true);
    expect(g.cmdTribute(0, 2, 'wood')).toBe(false); // an enemy
    expect(g.cmdTribute(0, 1, 'wood')).toBe(true);
    expect(g.players[0].res.wood).toBe(100);
    expect(g.players[1].res.wood).toBe(300);
    expect(g.allies(0).map((p) => p.id)).toEqual([1]);
  });

  it('an allied AI answers a call and comes to the defence of its ally', () => {
    const g = four([0, 0, 1, 1]);
    const ai = new AIController(g, 1);
    const troops = [0, 1, 2, 3].map((i) => g.spawnUnit('swordsman', 1, g.spec.starts[1].x - 2 + i, g.spec.starts[1].y + 6));
    g.cmdSignal(0, 60, 40);
    run(g, 3, () => ai.update());
    expect(troops.every((u) => u.order?.t === 'attackMove' && Math.hypot(u.order.x - 60, u.order.y - 40) < 3)).toBe(true);
    // Later, raiders hit the human's town: the ally's idle troops march to it.
    g.cmdStop(1, troops.map((u) => u.id));
    const myTc = g.buildings.find((b) => b.owner === 0)!;
    const raider = g.spawnUnit('swordsman', 2, myTc.x + 3, myTc.y);
    g.cmdTarget(2, [raider.id], myTc.id);
    run(g, 6, () => ai.update());
    expect(troops.some((u) => u.order?.t === 'attackMove' && Math.hypot(u.order.x - myTc.x, u.order.y - myTc.y) < 6)).toBe(true);
  });
});

describe('conquest reserves', () => {
  it('armies next door support a battle and join it as allies', () => {
    const c = newCampaign(7);
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    const army = armyAt(c, home.id)!;
    const target = c.territories[home.adj[0]];
    const side = c.territories.find((t) => t.id !== home.id && t.adj.includes(target.id))!;
    side.owner = 0;
    c.armies.push({ id: 50, owner: 0, at: side.id, units: { archers: 4 }, hero: false, vet: 0, moved: false });
    moveArmy(c, army.id, target.id);
    expect(c.pending!.aStr).toBeCloseTo(5 + 4 * 0.3, 1);
    const cfg = battleConfig(c)!;
    expect(cfg.setups.map((s) => [s.name, s.team])).toEqual([['You', 0], ['Local Tribe', 1], ['Your reserve', 0]]);
    expect(cfg.setups[2].bonus!.units).toEqual({ slinger: 8 });
    const g = new Game(cfg.seed, cfg.setups, cfg.size);
    expect(g.hostile(0, 2)).toBe(false);
    expect(g.units.filter((u) => u.owner === 2 && u.type === 'slinger').length).toBe(8);
    run(g, 5);
  });
});

describe('civilisations', () => {
  const as = (civ: string) => new Game(7, [{ ...setups[0], civ }, { ...setups[1], civ: 'steppe' }]);

  it('each people has its bonuses and its own unit', () => {
    const stone = as('stonekin'), forge = as('forge'), hearth = as('hearth');
    const tc = (g: Game) => g.buildings.find((b) => b.owner === 0)!;
    expect(tc(stone).maxHp).toBe(Math.round(2200 * 1.25));
    expect(tc(forge).maxHp).toBe(2200);
    // Only the right people can train a unique unit, and rivals are assigned different peoples by default.
    for (const g of [stone, forge]) { g.players[0].age = 4; Object.assign(g.players[0].res, { food: 9000, wood: 9000, gold: 9000, stone: 9000 }); }
    const b1 = stone.spawnBuilding('barracks', 0, 40, 40, true), b2 = forge.spawnBuilding('barracks', 0, 40, 40, true);
    expect(stone.cmdTrain(0, b1.id, 'shieldbearer')).toBe(true);
    expect(forge.cmdTrain(0, b2.id, 'shieldbearer')).toBe(false);
    expect(new Game(7, setups.map(({ name, color, isAI }) => ({ name, color, isAI }))).players.map((p) => p.civ).slice(0, 2)).toEqual(['stonekin', 'steppe']);
    // Steppe cavalry is cheaper; Forgeborn research is cheaper and quicker.
    expect(stone.unitCost(1, 'rider')).toEqual({ food: 60, gold: 26 });
    expect(stone.unitCost(0, 'rider')).toEqual({ food: 70, gold: 30 });
    expect(forge.techCost(0, 'up_bowman')).toEqual({ food: 102, wood: 85 });
    forge.cmdResearch(0, b2.id, 'up_bowman');
    expect(b2.queue[0].time).toBeCloseTo(21);
    // Hearthfolk houses hold one more.
    const cap = hearth.players[0].popCap;
    const hs = spot(hearth, 'house', 0);
    hearth.spawnBuilding('house', 0, hs.cx, hs.cy, true);
    run(hearth, 1.1);
    expect(hearth.players[0].popCap).toBe(cap + 6);
  });

  it('unique units behave as described', () => {
    const g = as('stonekin');
    // Shieldbearers shrug off half of an arrow.
    const shield = g.spawnUnit('shieldbearer', 0, 40.5, 48.5), plain = g.spawnUnit('spearman', 0, 40.5, 56.5);
    for (const u of [shield, plain]) { u.stance = 'hold'; }
    g.spawnUnit('bowman', 1, 45.5, 48.5).stance = 'hold';
    g.spawnUnit('bowman', 1, 45.5, 56.5).stance = 'hold';
    run(g, 8);
    expect(shield.maxHp - shield.hp).toBeLessThan((plain.maxHp - plain.hp) * 0.5);
    // A Lancer's charge: the first blow after a run is far heavier than the ones that follow.
    const wall = g.spawnBuilding('stonewall', 0, 46, 58, true);
    const lancer = g.spawnUnit('lancer', 1, 46.5, 50.5);
    g.cmdTarget(1, [lancer.id], wall.id);
    let first = 0;
    for (let i = 0; i < 200 && !first; i++) { g.step(); if (wall.hp < wall.maxHp) first = wall.maxHp - wall.hp; }
    const afterFirst = wall.hp;
    for (let i = 0; i < 200 && wall.hp === afterFirst; i++) g.step(); // the next, ordinary blow
    expect(first).toBeGreaterThan((afterFirst - wall.hp) * 2);
    // Fire keeps burning after the Fire Thrower is gone.
    const hut = g.spawnBuilding('house', 0, 70, 70, true);
    const fire = g.spawnUnit('firethrower', 1, 71, 68.5);
    g.cmdTarget(1, [fire.id], hut.id);
    run(g, 2);
    g.cmdDelete(1, [fire.id]);
    const hp = hut.hp;
    run(g, 4);
    expect(hut.hp).toBeLessThan(hp - 15);
  });
});

describe('generations', () => {
  it('villagers grow old, slow down and die, unless aging is off', () => {
    const g = new Game(5, setups);
    const [a, b] = villagers(g, 0);
    expect(a.lifespan).toBeGreaterThanOrEqual(16 * 60);
    a.age = a.lifespan * 0.8;
    expect(g.isElder(a)).toBe(true);
    b.age = b.lifespan - 2;
    run(g, 3);
    expect(b.dead).toBe(true);
    expect(g.events.some((e) => e.t === 'oldage')).toBe(true);
    const still = new Game(5, setups);
    still.aging = false;
    const c = villagers(still, 0)[0];
    c.age = c.lifespan - 1;
    run(still, 3);
    expect(c.dead).toBe(false);
    expect(still.isElder(c)).toBe(false);
    expect(Game.restore(still.serialize()).aging).toBe(false);
  });

  it('gifted couples sometimes have doubly gifted children, and families gain renown', () => {
    const g = new Game(5, setups);
    const vs = villagers(g, 0);
    const man = vs.find((v) => v.gender === 'm')!, woman = vs.find((v) => v.gender === 'f')!;
    g.setTrait(man, 'strong');
    g.setTrait(woman, 'swift');
    const hs = spot(g, 'house', 0);
    const house = g.spawnBuilding('house', 0, hs.cx, hs.cy, true);
    house.residents = { m: man.id, f: woman.id };
    g.players[0].res.food = 99999;
    let both = 0;
    const slow = g.birthTime(house);
    for (let i = 0; i < 60; i++) {
      house.birthProgress = 1;
      g.step();
      const child = villagers(g, 0).find((v) => v.growT > 0)!;
      if (g.has(child, 'strong') && g.has(child, 'swift')) both++;
      g.cmdDelete(0, [child.id]);
    }
    expect(both).toBeGreaterThan(4);
    expect(both).toBeLessThan(30);
    expect(g.renown(house)).toBe(3);
    house.children = 9; // same slowdown from child count, now with renown
    const cap = g.players[0].popCap;
    run(g, 1.1);
    expect(g.players[0].popCap).toBeGreaterThanOrEqual(cap); // renown adds room
    house.children = 0;
    expect(g.renown(house)).toBe(0);
    expect(slow).toBeGreaterThan(0);
  });
});

describe('missions', () => {
  const start = (id: string) => { const m = missionById(id)!; const g = new Game(m.seed, m.setups, m.size); m.init(g); return { m, g }; };

  it('every mission sets up cleanly and reports objectives', () => {
    for (const mission of MISSIONS) {
      const { m, g } = start(mission.id);
      const st = runMission(g, m);
      expect(st.objectives.length).toBeGreaterThan(2);
      expect(st.result).toBe(null);
      run(g, 5);
      expect(Game.restore(g.serialize()).scenario!.id).toBe(m.id);
    }
  });

  it('First Hearth is won by doing what it asks', () => {
    const { m, g } = start('hearth');
    expect(g.aging).toBe(false);
    expect(g.scenario!.ids.length).toBe(3);
    const done = () => runMission(g, m).objectives.map((o) => o.done);
    expect(done().every((d) => !d)).toBe(true);
    const vs = villagers(g, 0);
    const tree = g.resources.filter((r) => r.type === 'tree').sort((a, b) => g.dist(vs[0], a) - g.dist(vs[0], b))[0];
    g.cmdTarget(0, vs.slice(0, 3).map((v) => v.id), tree.id);
    expect(done()[0]).toBe(true);
    const hs = spot(g, 'house', 0);
    const house = g.spawnBuilding('house', 0, hs.cx, hs.cy, true);
    house.residents = { m: vs.find((v) => v.gender === 'm')!.id, f: vs.find((v) => v.gender === 'f')!.id };
    const bs = spot(g, 'barracks', 0);
    g.spawnBuilding('barracks', 0, bs.cx, bs.cy, true);
    for (let i = 0; i < 6; i++) g.spawnUnit('clubman', 0, g.spec.starts[0].x + i - 3, g.spec.starts[0].y + 5);
    expect(done().slice(1, 5)).toEqual([true, true, true, true]);
    expect(g.winner).toBe(-1);
    g.cmdDelete(g.wild, g.scenario!.ids);
    expect(runMission(g, m).result).toBe('win');
    expect(g.winner).toBe(0);
  });

  it('Hold the Line sends growing waves, and is lost or won on the Town Center', () => {
    const lost = start('line');
    expect(lost.g.buildings.filter((b) => b.owner === 0 && b.def.gate).length).toBeGreaterThanOrEqual(2);
    expect(lost.g.buildings.filter((b) => b.owner === 0 && b.type === 'tower').length).toBe(2);
    let waves = 0, biggest = 0;
    run(lost.g, 200, () => {
      const st = runMission(lost.g, lost.m);
      waves = lost.g.scenario!.n;
      biggest = Math.max(biggest, lost.g.units.filter((u) => u.owner === 1 && u.type !== 'villager').length);
      void st;
    });
    expect(waves).toBeGreaterThanOrEqual(2);
    expect(biggest).toBeGreaterThanOrEqual(3);
    lost.g.cmdDelete(0, lost.g.buildings.filter((b) => b.owner === 0 && b.type === 'towncenter').map((b) => b.id));
    expect(runMission(lost.g, lost.m).result).toBe('lose');
    expect(lost.g.winner).toBe(1);
    // With a strong garrison the ten minutes pass and the mission is won.
    const won = start('line');
    for (let i = 0; i < 24; i++) won.g.spawnUnit('knight', 0, won.g.spec.starts[0].x - 4 + (i % 8), won.g.spec.starts[0].y + 5 + Math.floor(i / 8));
    run(won.g, 605, () => { if (won.g.winner < 0) runMission(won.g, won.m); });
    expect(won.g.winner).toBe(0);
    expect(won.g.scenario!.n).toBe(8);
  }, 120000);
});

describe('dawn court and wildborn', () => {
  it('have their own bonuses and units', () => {
    const g = new Game(7, [{ ...setups[0], civ: 'dawn' }, { ...setups[1], civ: 'wild' }]);
    expect(g.unitCost(0, 'shaman')).toEqual({ food: 30, gold: 45 });
    expect(g.unitCost(1, 'shaman')).toEqual({ food: 40, gold: 60 });
    expect(g.unitCost(1, 'hound')).toEqual({ food: 26 });
    // Faith comes back faster to the Dawn Court.
    const mine = g.spawnUnit('prophet', 0, 40.5, 40.5), theirs = g.spawnUnit('prophet', 1, 60.5, 60.5);
    mine.mana = theirs.mana = 0;
    run(g, 10);
    expect(mine.mana).toBeCloseTo(15, 0);
    expect(theirs.mana).toBeCloseTo(10, 0);
    // Zealots mend as they strike.
    const zealot = g.spawnUnit('zealot', 0, 46.5, 48.5);
    zealot.hp = 40;
    const post = g.spawnBuilding('stonewall', 1, 46, 49, true);
    g.cmdTarget(0, [zealot.id], post.id);
    run(g, 6);
    expect(zealot.hp).toBeGreaterThan(50);
    for (const p of [0, 1]) { g.players[p].age = 1; Object.assign(g.players[p].res, { food: 999, gold: 999 }); }
    const b0 = g.spawnBuilding('stable', 0, 30, 40, true), b1 = g.spawnBuilding('stable', 1, 30, 46, true);
    expect(g.cmdTrain(1, b1.id, 'wolfrider')).toBe(true);
    expect(g.cmdTrain(0, b0.id, 'wolfrider')).toBe(false);
  });

  it('wild wolves leave the Wildborn alone, and are left alone by them', () => {
    const g = new Game(3, [{ ...setups[0], civ: 'wild' }, { ...setups[1], civ: 'stonekin' }]);
    const wolf = g.units.find((u) => u.type === 'wolf')!;
    const friend = g.spawnUnit('villager', 0, wolf.x + 1.5, wolf.y, 'm'), guard = g.spawnUnit('clubman', 0, wolf.x - 1.5, wolf.y);
    const stranger = g.spawnUnit('villager', 1, wolf.x, wolf.y + 2.5, 'm');
    g.aging = false;
    run(g, 12);
    expect(friend.hp).toBe(friend.maxHp);
    expect(guard.order).toBe(null);
    expect(stranger.hp < stranger.maxHp || stranger.dead).toBe(true);
  });
});

describe('campaign diplomacy and peoples', () => {
  it('each people has its own edge on the map', () => {
    const land = newCampaign(7).territories.find((t) => t.capital < 0 && t.trait !== 'horses')!;
    expect(siteCost(land, 'fortress', 'stonekin')).toBe(5);
    expect(siteCost(land, 'fortress', 'forge')).toBe(8);
    expect(siteCost(land, 'fortress', 'hearth')).toBe(9);
    expect(companyCost(land, 'cavalry', 'steppe')).toBe(3);
    expect(companyCost(land, 'cavalry', 'wild')).toBe(4);
    expect(heroCost('dawn')).toBe(4);
    const farm = { ...land, buildings: ['farm'], trait: '' };
    expect(territoryIncome(farm, 'hearth')).toBe(territoryIncome(farm, 'forge') + 1);
    expect(Object.keys(CAMPAIGN_EDGE).sort()).toEqual(CIV_IDS.slice().sort());
    expect(Object.keys(PERSONA).sort()).toEqual(CIV_IDS.slice().sort());
    // Dawn Court attackers cancel the defender's home advantage.
    const dawn = newCampaign(7, 1, 1, 'dawn'), other = newCampaign(7, 1, 1, 'forge');
    expect(homeEdge(dawn, 0)).toBe(1);
    expect(homeEdge(other, 0)).toBe(1.1);
    // Steppe armies may march twice through their own land.
    const st = newCampaign(7, 1, 1, 'steppe');
    const home = st.territories.find((t) => t.capital === 0)!;
    const a = st.territories[home.adj[0]], army = armyAt(st, home.id)!;
    a.owner = 0;
    expect(moveArmy(st, army.id, a.id)).toBe('moved');
    expect(army.moved).toBe(false);
    expect(moveArmy(st, army.id, home.id)).toBe('moved');
    expect(army.moved).toBe(true);
  });

  it('truces are offered, kept by rivals and can be broken by the player at a price', () => {
    // Find a campaign where the rival is open to peace.
    let c = newCampaign(1, 1);
    for (let seed = 1; seed < 60; seed++) {
      c = newCampaign(seed, 1);
      c.speech.length = 0;
      c.factions[0].supplies = 20;
      c.armies.find((x) => x.owner === 0)!.units.infantry = 9; // strength makes them listen
      if (offerTruce(c, 1)) break;
      expect(c.speech[0].event).toBe('refuse');
      expect(c.factions[0].supplies).toBe(20); // a refusal costs nothing
    }
    expect(atTruce(c, 0, 1)).toBe(true);
    expect(c.factions[0].supplies).toBe(20 - TRUCE_COST);
    expect(c.speech[0].event).toBe('truce');
    expect(offerTruce(c, 1)).toBe(false); // already at truce
    // The rival will not march on us while it lasts, however strong it is.
    const myCap = c.territories.find((t) => t.capital === 0)!;
    const beside = c.territories[myCap.adj[0]];
    beside.owner = 1;
    c.armies = c.armies.filter((x) => x.at !== beside.id);
    c.armies.push({ id: 90, owner: 1, at: beside.id, units: { cavalry: 12 }, hero: false, vet: 0, moved: false });
    expect(moveArmy(c, 90, myCap.id)).toBe('invalid');
    // Breaking it ourselves is allowed, is remembered, and is answered.
    c.speech.length = 0;
    const mine = armyAt(c, myCap.id)!;
    expect(moveArmy(c, mine.id, beside.id)).toBe('battle');
    expect(atTruce(c, 0, 1)).toBe(false);
    expect(c.honor).toBe(-1);
    expect(c.speech.map((sp) => sp.event)).toEqual(['betray']);
    resolvePending(c, 'defender');
    c.factions[0].supplies = 20;
    expect(offerTruce(c, 1)).toBe(false); // nobody trusts an oathbreaker
  });

  it('a stronger, greedy neighbour demands tribute, and the answer matters', () => {
    const setup = () => {
      const c = newCampaign(5, 1, 1, 'hearth');
      c.factions[1].civ = 'wild'; // the greediest leader
      c.turn = 6;
      const myCap = c.territories.find((t) => t.capital === 0)!;
      const beside = c.territories[myCap.adj[0]];
      beside.owner = 1;
      c.armies = c.armies.filter((x) => x.at !== beside.id);
      c.armies.push({ id: 91, owner: 1, at: beside.id, units: { cavalry: 12 }, hero: false, vet: 0, moved: false });
      c.factions[0].supplies = 20;
      return c;
    };
    let c = setup();
    let asked = false;
    for (let i = 0; i < 40 && !asked; i++) {
      c = setup();
      c.rngState = i * 7919;
      endTurn(c);
      asked = !!c.demand;
    }
    expect(asked).toBe(true);
    expect(c.phase).toBe('ai'); // the rivals wait for an answer
    expect(c.speech.some((sp) => sp.event === 'demand')).toBe(true);
    const amount = c.demand!.amount, theirs = c.factions[1].supplies;
    const paid = JSON.parse(JSON.stringify(c));
    answerDemand(paid, true);
    expect(paid.factions[0].supplies).toBe(20 - amount);
    expect(paid.factions[1].supplies).toBe(theirs + amount);
    expect(atTruce(paid, 0, 1)).toBe(true);
    continueAI(paid);
    expect(paid.pending).toBe(null); // bought off: no attack
    answerDemand(c, false);
    expect(c.factions[1].angry).toBe(true);
    continueAI(c);
    expect(c.pending?.attacker).toBe(1); // refused: they come at once
    expect(totalStrength(c, 1)).toBeGreaterThan(totalStrength(c, 0));
  });
});

describe('field battles', () => {
  it('have no towns, are fought by the armies alone and end when one is gone', () => {
    const c = newCampaign(7, 1);
    const home = c.territories.find((t) => t.capital === 0)!;
    const army = armyAt(c, home.id)!;
    army.units = { infantry: 5, archers: 3 };
    moveArmy(c, army.id, home.adj[0]);
    c.pending!.mode = 'field';
    const cfg = battleConfig(c)!;
    expect(cfg.field).toBe(true);
    expect(cfg.size).toBe(56);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field);
    expect(g.buildings.length).toBe(0);
    expect(g.units.some((u) => u.type === 'villager' || u.owner === g.wild)).toBe(false);
    expect(g.units.filter((u) => u.owner === 0).map((u) => u.type).sort().join()).toBe([...Array(10).fill('clubman'), ...Array(6).fill('slinger'), 'warlord'].join());
    expect(g.aging).toBe(false);
    // The enemy marches on us of its own accord, and the fight is settled without anyone building anything.
    const ai = new AIController(g, 1);
    ai.setLevel(cfg.level);
    run(g, 240, () => { if (g.winner < 0) ai.update(); });
    expect(g.winner).toBeGreaterThanOrEqual(0);
    expect(g.time).toBeLessThan(240);
    expect(g.units.some((u) => g.hostile(u.owner, g.winner))).toBe(false);
    expect(Game.restore(new Game(cfg.seed, cfg.setups, cfg.size, true).serialize()).field).toBe(true);
  });

  it('what is left of a winning army is what survived the fight', () => {
    const setup = () => {
      const c = newCampaign(7, 1);
      const home = c.territories.find((t) => t.capital === 0)!;
      const army = armyAt(c, home.id)!;
      army.units = { infantry: 5, archers: 3 };
      moveArmy(c, army.id, home.adj[0]);
      return { c, army };
    };
    let { c, army } = setup();
    finishBattle(c, true, { clubman: 5, slinger: 1, warlord: 1 });
    expect(army.units).toEqual({ infantry: 3, archers: 1 }); // two clubmen to a company, rounded up
    expect(army.hero).toBe(true);
    ({ c, army } = setup());
    finishBattle(c, true, { clubman: 30 });
    expect(army.units).toEqual({ infantry: 5 }); // never more than marched in; the archers are gone
    expect(army.hero).toBe(false);
    expect(c.factions[0].heroAlive).toBe(false);
    ({ c, army } = setup());
    finishBattle(c, true, {});
    expect(armySize(army)).toBe(1); // a won battle never erases the army
    ({ c, army } = setup());
    finishBattle(c, false, { clubman: 9 });
    expect(c.armies.includes(army)).toBe(false); // a lost attack still costs the army
  });
});

describe('alliances and dominion', () => {
  it('an ally is sworn from a truce, lends its armies, and the bond ends when only two remain', () => {
    let c = newCampaign(1, 2), ok = false;
    for (let seed = 1; seed < 80 && !ok; seed++) {
      c = newCampaign(seed, 2);
      c.factions[0].supplies = 40;
      expect(canAlly(c, 1)).toBe(false); // no truce yet
      if (!offerTruce(c, 1)) continue;
      ok = offerAlliance(c, 1);
    }
    expect(ok).toBe(true);
    expect(c.ally).toBe(1);
    expect(c.speech.some((s) => s.event === 'ally')).toBe(true);
    expect(c.factions[0].supplies).toBe(40 - TRUCE_COST - ALLIANCE_COST);
    expect(canAlly(c, 2)).toBe(false); // one alliance at a time
    c.truces = [];
    expect(atTruce(c, 0, 1)).toBe(true); // an alliance does not run out

    // The ally's army next door adds weight to the player's attack.
    const mine = c.armies.find((a) => a.owner === 0)!;
    const target = c.territories.find((t) => t.owner === 2)!;
    const from = c.territories[target.adj[0]], side = c.territories[target.adj[1] ?? target.adj[0]];
    from.owner = 0; mine.at = from.id; mine.moved = false;
    c.armies = c.armies.filter((a) => a === mine || (a.at !== from.id && a.at !== side.id));
    const alone = (() => { const d = JSON.parse(JSON.stringify(c)); moveArmy(d, mine.id, target.id); return d.pending.aStr; })();
    if (side.id !== from.id) {
      side.owner = 1;
      c.armies.push({ id: c.nextArmy++, owner: 1, at: side.id, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
      const helped = (() => { const d = JSON.parse(JSON.stringify(c)); moveArmy(d, mine.id, target.id); return d.pending.aStr; })();
      expect(helped).toBeGreaterThan(alone);
      const d = JSON.parse(JSON.stringify(c));
      moveArmy(d, mine.id, target.id);
      expect(battleConfig(d)!.setups.some((s) => s.team === 0 && s.name.includes('(ally)'))).toBe(true);
    }

    // The third people fall: the alliance gives way to a short truce.
    for (const t of c.territories) if (t.owner === 2) t.owner = 0;
    c.armies = c.armies.filter((a) => a.owner !== 2);
    const loc = c.territories.find((t) => t.owner < 0 && t.adj.some((n) => c.territories[n].owner === 0));
    if (loc) {
      const a = c.armies.find((x) => x.owner === 0)!;
      a.at = loc.adj.find((n) => c.territories[n].owner === 0)!; a.moved = false; a.units = { infantry: 12 };
      c.armies = c.armies.filter((x) => x === a || x.at !== a.at);
      moveArmy(c, a.id, loc.id);
      resolvePending(c, 'attacker');
      expect(c.ally).toBe(-1);
      expect(c.speech.some((s) => s.event === 'rivalry')).toBe(true);
      expect(atTruce(c, 0, 1)).toBe(true);
    }
  });

  it('breaking an alliance costs more honour than breaking a truce', () => {
    const c = newCampaign(7, 2);
    c.ally = 1;
    const target = c.territories.find((t) => t.owner === 1)!;
    const a = c.armies.find((x) => x.owner === 0)!;
    const from = c.territories[target.adj[0]];
    from.owner = 0; c.armies = c.armies.filter((x) => x === a || x.at !== from.id); a.at = from.id;
    expect(moveArmy(c, a.id, target.id)).toBe('battle');
    expect(c.ally).toBe(-1);
    expect(c.honor).toBe(-2);
  });

  it('holding most of the land for long enough wins the campaign', () => {
    const c = newCampaign(7, 2);
    const need = dominionNeed(c);
    const spare = c.territories.filter((t) => t.capital < 0);
    for (let i = 0; i < spare.length && c.territories.filter((t) => t.owner === 0).length < need; i++) spare[i].owner = 0;
    c.armies = c.armies.filter((a) => a.owner === 0 || c.territories[a.at].owner === a.owner);
    // Nobody can touch the player while we count.
    c.truces = [{ with: 1, until: 99 }, { with: 2, until: 99 }];
    for (const t of c.territories) if (t.owner === 0) t.buildings = ['fortress'];
    let turns = 0;
    while (c.phase !== 'over' && turns < 10) { endTurn(c); turns++; }
    expect(c.territories.filter((t) => t.owner === 0).length).toBeGreaterThanOrEqual(need);
    expect(c.winner).toBe(0);
    expect(turns).toBe(DOMINION_TURNS);
    expect(c.factions.filter((f) => f.alive).length).toBeGreaterThan(1);
  });
});

describe('an active ally', () => {
  it('gifts earn goodwill, an ally shares stores and rewards an answered call', () => {
    const c = newCampaign(7, 2);
    c.factions[0].supplies = 40;
    for (let i = 0; i < 5; i++) sendGift(c, 2);
    expect(c.factions[2].favor).toBe(MAX_FAVOR);
    expect(c.factions[0].supplies).toBe(40 - GIFT_COST * MAX_FAVOR); // no more once goodwill is full
    c.ally = 1;
    expect(canGift(c, 1)).toBe(true);

    // Faction 2 takes land from the ally: the ally asks for help.
    const land = c.territories.find((t) => t.owner === 1)!;
    const from = c.territories[land.adj[0]];
    from.owner = 2;
    c.armies = c.armies.filter((a) => a.at !== from.id && a.at !== land.id);
    c.armies.push({ id: c.nextArmy++, owner: 2, at: from.id, units: { infantry: 12 }, hero: false, vet: 0, moved: false });
    c.territories.find((t) => t.owner === 1 && t !== land) ?? (c.territories.find((t) => t.owner < 0)!.owner = 1);
    moveArmy(c, c.nextArmy - 1, land.id);
    if (c.pending) resolvePending(c, 'attacker');
    expect(land.owner).toBe(2);
    expect(c.request?.foe).toBe(2);

    // The player answers by taking that land back from faction 2.
    const mine = c.armies.find((a) => a.owner === 0)!;
    const base = c.territories[land.adj.find((n) => n !== from.id) ?? land.adj[0]];
    if (base.owner !== 0) { base.owner = 0; c.armies = c.armies.filter((a) => a === mine || a.at !== base.id); }
    mine.at = base.id; mine.moved = false;
    c.factions[1].supplies = 10;
    const before = c.factions[0].supplies;
    expect(moveArmy(c, mine.id, land.id)).toBe('battle');
    resolvePending(c, 'attacker');
    expect(c.request).toBeNull();
    expect(c.factions[0].supplies).toBe(before + 4);

    // A rich ally shares with a poor friend at the turn.
    c.factions[0].supplies = 0; c.factions[1].supplies = 30;
    c.truces = [{ with: 2, until: 99 }];
    const turn = c.turn;
    endTurn(c);
    while (c.pending) { resolvePending(c, 'defender'); continueAI(c); }
    if (c.turn > turn && c.ally === 1) expect(c.log.some((l) => l.includes('share 3 supplies'))).toBe(true);
  });
});

describe('water and ships', () => {
  const lake = (seed = 5) => new Game(seed, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }], 96, false, true);
  /** A spot for a dock on the shore of the great lake (not of some pond near a base). */
  const shore = (g: Game) => {
    const mid = g.size / 2;
    const tc = g.resources.filter((r) => r.type === 'fish').sort((a, b) => Math.hypot(a.x - mid, a.y - mid) - Math.hypot(b.x - mid, b.y - mid))[0];
    let best: [number, number] | null = null, bd = Infinity;
    for (let y = 2; y < g.size - 5; y++) for (let x = 2; x < g.size - 5; x++) {
      const d = Math.hypot(x - tc.x, y - tc.y);
      if (d < bd && g.canPlace('dock', x, y)) { bd = d; best = [x, y]; }
    }
    return best!;
  };

  it('a lake map has a sea with fish in it, and the land is otherwise unchanged', () => {
    const g = lake(), plain = new Game(5, g.setups);
    const water = (x: Game) => x.terrain.reduce((n, t) => n + (t === 1 ? 1 : 0), 0);
    expect(water(g)).toBeGreaterThan(water(plain) + 500);
    const fish = g.resources.filter((r) => r.type === 'fish');
    expect(fish.length).toBeGreaterThanOrEqual(8);
    for (const f of fish) expect(g.terrain[f.cy * g.size + f.cx]).toBe(1);
    expect(g.canPlace('dock', Math.floor(g.buildings[0].x) + 5, Math.floor(g.buildings[0].y) + 5)).toBe(false); // no water there
  });

  it('fishing boats bring in food through a dock, and never leave the water', () => {
    const g = lake();
    const [cx, cy] = shore(g);
    const dock = g.spawnBuilding('dock', 0, cx, cy, true);
    g.players[0].res.wood = 500;
    expect(g.cmdTrain(0, dock.id, 'fishboat')).toBe(true);
    run(g, 25);
    const boat = g.units.find((u) => u.type === 'fishboat')!;
    expect(boat).toBeTruthy();
    expect(g.terrain[Math.floor(boat.y) * g.size + Math.floor(boat.x)]).toBe(1);
    const fish = g.resources.filter((r) => r.type === 'fish').sort((a, b) => Math.hypot(a.x - boat.x, a.y - boat.y) - Math.hypot(b.x - boat.x, b.y - boat.y))[0];
    // A villager cannot fish; a boat can.
    const v = g.units.find((u) => u.owner === 0 && u.type === 'villager')!;
    g.cmdTarget(0, [v.id], fish.id);
    expect(v.order?.t).toBe('move');
    g.cmdTarget(0, [boat.id], fish.id);
    expect(boat.order?.t).toBe('gather');
    const food = g.players[0].res.food;
    let dry = false;
    run(g, 150, () => { if (g.terrain[Math.floor(boat.y) * g.size + Math.floor(boat.x)] !== 1) dry = true; });
    expect(dry).toBe(false);
    expect(g.players[0].res.food).toBeGreaterThan(food + 15);
    // Told to go ashore, it stops at the water's edge.
    g.cmdMove(0, [boat.id], g.buildings[0].x, g.buildings[0].y);
    run(g, 30);
    expect(g.terrain[Math.floor(boat.y) * g.size + Math.floor(boat.x)]).toBe(1);
  });

  it('a galley sinks boats and shells the shore; swordsmen ignore ships, a save keeps them afloat', () => {
    const g = lake();
    const [cx, cy] = shore(g);
    const dock = g.spawnBuilding('dock', 1, cx, cy, true);
    const wet = g.seaPf.nearestFree(dock.x, dock.y);
    const galley = g.spawnUnit('galley', 0, wet.x, wet.y);
    const hp = dock.hp;
    g.cmdTarget(0, [galley.id], dock.id);
    run(g, 20);
    expect(dock.hp).toBeLessThan(hp);
    // A melee unit beside the water does not chase the ship.
    const land = g.landPf.nearestFree(galley.x, galley.y);
    const club = g.spawnUnit('clubman', 1, land.x, land.y);
    run(g, 5);
    expect((club.order as { id?: number } | null)?.id).not.toBe(galley.id);
    // A slinger does shoot it.
    const ghp = galley.hp;
    const sl = g.spawnUnit('slinger', 1, land.x, land.y);
    g.cmdTarget(1, [sl.id], galley.id);
    run(g, 6);
    expect(galley.hp).toBeLessThan(ghp);
    const r = Game.restore(g.serialize());
    expect(r.sea).toBe(true);
    const g2 = r.units.find((u) => u.type === 'galley')!;
    run(r, 5);
    expect(r.terrain[Math.floor(g2.y) * r.size + Math.floor(g2.x)]).toBe(1);
    // Frigates replace galleys once researched.
    g.players[0].upgrades.galley = 'frigate';
    expect(g.trainedAs(0, 'galley')).toBe('frigate');
  });
});

describe('the AI at sea', () => {
  it('on a lake map the AI builds a dock, fishes and launches warships; inland games are untouched', () => {
    const g = new Game(11, [{ name: 'A', color: 1, isAI: true }, { name: 'B', color: 2, isAI: true }], 96, false, true);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    let boats = 0, galleys = 0;
    for (let t = 0; t < 20 * 60 * 14 && g.winner < 0; t++) {
      g.step();
      if (t % 20 === 0) for (const a of ais) a.update();
      if (t % 200 === 0) { boats = Math.max(boats, g.units.filter((u) => u.type === 'fishboat').length); galleys = Math.max(galleys, g.units.filter((u) => u.def.naval && !u.def.fisher).length); }
    }
    expect(g.buildings.some((b) => b.type === 'dock') || boats > 0).toBe(true);
    expect(boats).toBeGreaterThanOrEqual(2);
    expect(galleys).toBeGreaterThanOrEqual(1);
    for (const u of g.units) if (u.def.naval) expect(g.terrain[Math.floor(u.y) * g.size + Math.floor(u.x)]).toBe(1);
  });
});

describe('transport ships', () => {
  it('carry land units over water, put them ashore, and take them down if sunk', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }], 96, false, true);
    // Two shore cells on the great lake, far apart.
    const mid = g.size / 2;
    const shores: { x: number; y: number; wx: number; wy: number }[] = [];
    for (let y = 3; y < g.size - 3; y++) for (let x = 3; x < g.size - 3; x++) {
      if (g.landPf.isBlocked(x, y) || Math.hypot(x - mid, y - mid) > g.size * 0.3) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g.terrain[(y + dy) * g.size + x + dx] === 1) { shores.push({ x: x + 0.5, y: y + 0.5, wx: x + dx + 0.5, wy: y + dy + 0.5 }); break; }
    }
    const a = shores[0];
    const reach = (s: typeof a) => !g.seaPf.find(a.wx, a.wy, s.wx, s.wy, s.wx, s.wy, 0.71).partial;
    const b = shores.filter(reach).sort((p, q) => Math.hypot(q.x - a.x, q.y - a.y) - Math.hypot(p.x - a.x, p.y - a.y))[0];
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(12);

    const ship = g.spawnUnit('transport', 0, a.wx, a.wy);
    const men = [0, 1, 2].map(() => g.spawnUnit('clubman', 0, a.x, a.y));
    for (const m of men) m.stance = 'hold';
    g.cmdTarget(0, men.map((m) => m.id), ship.id);
    run(g, 5);
    expect(ship.cargo?.length).toBe(3);
    expect(men.every((m) => m.inside === ship.id)).toBe(true);
    // Nowhere to land in open water.
    g.cmdMove(0, [ship.id], b.wx, b.wy);
    run(g, 40);
    expect(Math.hypot(ship.x - b.wx, ship.y - b.wy)).toBeLessThan(2);
    expect(g.cmdUnload(0, [ship.id])).toBe(3);
    expect(ship.cargo!.length).toBe(0);
    for (const m of men) {
      expect(m.inside).toBe(0);
      expect(g.landPf.isBlocked(Math.floor(m.x), Math.floor(m.y))).toBe(false);
      expect(Math.hypot(m.x - b.x, m.y - b.y)).toBeLessThan(5);
    }
    // Back aboard, saved and restored, then sunk: nobody survives.
    g.cmdTarget(0, men.map((m) => m.id), ship.id);
    run(g, 8);
    expect(ship.cargo!.length).toBe(3);
    const r = Game.restore(g.serialize());
    const s2 = r.units.find((u) => u.type === 'transport')!;
    expect(s2.cargo!.length).toBe(3);
    const before = r.units.filter((u) => u.type === 'clubman').length;
    const gal = r.spawnUnit('frigate', 1, s2.x + 1, s2.y);
    r.cmdTarget(1, [gal.id], s2.id);
    run(r, 60);
    expect(r.units.some((u) => u.type === 'transport')).toBe(false);
    expect(r.units.filter((u) => u.type === 'clubman').length).toBe(before - 3);
  });
});

describe('coastal land', () => {
  it('some rim territories are coast: they pay a little more and their sieges are fought on a lake', () => {
    let found = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2);
      for (const t of c.territories.filter((x) => x.trait === 'coast')) {
        found++;
        expect(t.capital).toBe(-1);
        expect(territoryIncome(t)).toBe(territoryIncome({ ...t, trait: '' }) + 1);
      }
      const coast = c.territories.find((t) => t.trait === 'coast' && t.owner < 0);
      if (!coast) continue;
      const a = c.armies.find((x) => x.owner === 0)!;
      const from = c.territories[coast.adj[0]];
      from.owner = 0; c.armies = c.armies.filter((x) => x === a || x.at !== from.id); a.at = from.id;
      expect(moveArmy(c, a.id, coast.id)).toBe('battle');
      c.pending!.mode = 'siege';
      expect(battleConfig(c)!.sea).toBe(true);
      c.pending!.mode = 'field';
      expect(battleConfig(c)!.sea).toBe(false);
    }
    expect(found).toBeGreaterThan(3);
  });
});

describe('landings', () => {
  it('a loaded transport sent to a point sails there and lands its troops', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }], 96, false, true);
    const mid = g.size / 2;
    const a = g.shoreSpot(mid, mid - 14, 12, 0)!;
    const b = g.shoreSpot(mid, mid + 14, 12, 0, a.wx, a.wy)!;
    expect(a && b).toBeTruthy();
    const ship = g.spawnUnit('transport', 0, a.wx, a.wy);
    const men = [0, 1, 2, 3].map(() => g.spawnUnit('spearman', 0, a.lx, a.ly));
    g.cmdTarget(0, men.map((m) => m.id), ship.id);
    run(g, 5);
    expect(ship.cargo!.length).toBe(4);
    g.cmdUnloadAt(0, [ship.id], b.lx, b.ly);
    run(g, 60);
    expect(ship.cargo!.length).toBe(0);
    for (const m of men) expect(Math.hypot(m.x - b.lx, m.y - b.ly)).toBeLessThan(9);
    expect(Math.hypot(a.lx - b.lx, a.ly - b.ly)).toBeGreaterThan(18);
    expect(ship.order).toBeNull();
  });

  it('the AI lands troops across the lake when its dock is on it', () => {
    // Whether a landing is possible depends on where the docks end up, so try a few worlds.
    let landedFar = false, carried = 0;
    for (const seed of [23, 11, 40, 5]) {
      if (landedFar) break;
      const g = new Game(seed, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'forge' }], 96, false, true);
      const ais = [new AIController(g, 0), new AIController(g, 1)];
      const home = g.spec.starts.map((p) => ({ x: p.x, y: p.y }));
      let most = 0;
      for (let t = 0; t < 20 * 60 * 16 && g.winner < 0 && !landedFar; t++) {
        g.step();
        if (t % 20 === 0) for (const a of ais) a.update();
        if (t % 20 === 0) for (const s of g.units) if (s.def.carry) {
          most = Math.max(most, s.cargo?.length ?? 0);
          // A ship that has carried troops and is now empty, far from home, has made its landing.
          if (most >= 3 && !s.cargo?.length && Math.hypot(s.x - home[s.owner].x, s.y - home[s.owner].y) > 40) landedFar = true;
        }
      }
      carried = Math.max(carried, most);
    }
    console.log('landing: carried ' + carried + ' landedFar ' + landedFar);
    expect(carried).toBeGreaterThanOrEqual(3);
    expect(landedFar).toBe(true);
  }, 120000);
});

describe('harbours', () => {
  it('an army sails from a harbour to any other coast, and lands at a disadvantage', () => {
    let done = false;
    for (let seed = 1; seed <= 40 && !done; seed++) {
      const c = newCampaign(seed, 2);
      const coasts = c.territories.filter((t) => t.trait === 'coast');
      const from = coasts[0], to = coasts.find((t) => t !== from && !from.adj.includes(t.id) && t.owner < 0);
      if (!from || !to) continue;
      done = true;
      const inland = c.territories.find((t) => t.trait !== 'coast' && t.capital < 0)!;
      inland.owner = 0; from.owner = 0; from.buildings = [];
      c.factions[0].supplies = 30;
      expect(canBuild(c, 0, inland.id, 'harbour')).toBe(false);
      expect(reach(c, from.id)).toEqual(from.adj);
      expect(build(c, 0, from.id, 'harbour')).toBe(true);
      expect(reach(c, from.id)).toContain(to.id);
      const a = c.armies.find((x) => x.owner === 0)!;
      c.armies = c.armies.filter((x) => x === a || (x.at !== from.id && x.at !== to.id));
      a.at = from.id; a.moved = false; a.units = { infantry: 6 };
      // Nobody next door to help either side, so the numbers are easy to check.
      c.armies = c.armies.filter((x) => x === a || !to.adj.includes(x.at));
      expect(moveArmy(c, a.id, to.id)).toBe('battle');
      expect(c.pending!.sea).toBe(true);
      expect(c.pending!.aStr).toBeCloseTo(Math.round(armyStrength(a) * SEA_LANDING * 10) / 10, 1);
      expect(battleConfig(c)!.title).toContain('landing');
      resolvePending(c, 'attacker');
      expect(to.owner).toBe(0);
      expect(a.at).toBe(to.id);
    }
    expect(done).toBe(true);
  });
});

describe('ages on the campaign map', () => {
  it('advancing costs supplies, strengthens armies and starts battles in that age with its weapons', () => {
    const c = newCampaign(7, 1, 1, 'hearth');
    expect(canAdvance(c, 0)).toBe(false);
    c.factions[0].supplies = AGE_COST[0] + AGE_COST[1];
    expect(advanceAge(c, 0)).toBe(true);
    expect(advanceAge(c, 0)).toBe(true);
    expect(ageOf(c, 0)).toBe(2);
    expect(c.factions[0].supplies).toBe(0);
    expect(c.speech.some((s) => s.event === 'p_ageup')).toBe(true);
    const a = c.armies.find((x) => x.owner === 0)!;
    const target = c.territories.find((t) => t.owner < 0 && c.territories[a.at].adj.includes(t.id))!;
    c.armies = c.armies.filter((x) => x === a || !target.adj.includes(x.at));
    moveArmy(c, a.id, target.id);
    expect(c.pending!.aStr).toBeCloseTo(Math.round(armyStrength(a) * (1 + 2 * AGE_EDGE) * 10) / 10, 1);
    c.pending!.mode = 'field';
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].bonus!.age).toBe(2);
    expect(cfg.setups[1].bonus!.age).toBe(0);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field);
    // Iron Age weapons: the infantry companies turn out as swordsmen, not clubmen.
    expect(g.units.some((u) => u.owner === 0 && u.type === 'swordsman')).toBe(true);
    expect(g.units.some((u) => u.owner === 0 && u.type === 'clubman')).toBe(false);
    expect(g.units.some((u) => u.owner === 1 && u.type === 'clubman')).toBe(true);
    // Survivors fighting with the new weapons still count as the same companies.
    const inf = a.units.infantry;
    finishBattle(c, true, { swordsman: inf * 2, warlord: 1 });
    expect(a.units.infantry).toBe(inf);
  });

  it('rivals advance too once they have the stores', () => {
    const c = newCampaign(3, 2, 2);
    for (let i = 0; i < 40 && c.phase !== 'over'; i++) { endTurn(c); while (c.pending || c.demand) { if (c.demand) answerDemand(c, false); else resolvePending(c, 'auto'); continueAI(c); } }
    expect(c.factions.slice(1).some((f) => (f.age ?? 0) > 0)).toBe(true);
  });
});

describe('second unique units', () => {
  it('each people has a later unit of its own that only it can train, and that fights as described', () => {
    const seen = new Set<string>();
    for (const id of CIV_IDS) {
      const u2 = CIVS[id].unique2;
      expect(UNITS[u2].civ).toBe(id);
      expect(UNITS[u2].age).toBeGreaterThan(UNITS[CIVS[id].unique].age);
      expect(Object.values(BUILDINGS).some((b) => b.trains.includes(u2))).toBe(true);
      seen.add(u2);
    }
    expect(seen.size).toBe(CIV_IDS.length);

    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'steppe' }, { name: 'B', color: 2, isAI: false, civ: 'wild' }]);
    const p = g.players[0];
    p.age = 4; for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 5000;
    const tc = g.spec.starts[0];
    const stable = g.spawnBuilding('stable', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) + 6, true);
    expect(g.cmdTrain(0, stable.id, 'horsearcher')).toBe(true);
    expect(g.cmdTrain(0, stable.id, 'warbear')).toBe(false); // not theirs
    // A horse archer shoots; a wounded war bear strikes faster; a herbwife heals.
    const ha = g.spawnUnit('horsearcher', 0, 48, 48), dummy = g.spawnUnit('swordsman', 1, 52, 48);
    dummy.stance = 'hold';
    g.cmdTarget(0, [ha.id], dummy.id);
    run(g, 4);
    expect(dummy.hp).toBeLessThan(dummy.maxHp);
    expect(Math.hypot(ha.x - dummy.x, ha.y - dummy.y)).toBeGreaterThan(2);
    const hurt = g.spawnUnit('swordsman', 0, 40, 40);
    hurt.hp = 20;
    g.spawnUnit('herbwife', 0, 41, 40);
    run(g, 4);
    expect(hurt.hp).toBeGreaterThan(40);
  });
});

describe('piety and decadence', () => {
  it('dilemmas come up, answers move the scale and pay or cost, and the creed changes what a people is good at', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: true, civ: 'dawn' }]);
    const p = g.players[0];
    expect(g.creed(0).id).toBe('temperate');
    let asked = 0;
    run(g, 185, () => { asked += g.events.filter((e) => e.t === 'dilemma' && e.player === 0).length; g.events.length = 0; });
    expect(asked).toBe(1);
    const d = DILEMMAS.find((x) => x.id === p.dilemma)!;
    const before = { ...p.res };
    expect(g.cmdDecide(0, 'b')).toBe(true);
    expect(p.dilemma).toBeNull();
    expect(p.virtue).toBe(d.b.virtue);
    expect(p.res.gold).toBe(before.gold + (d.b.res.gold ?? 0));
    expect(g.cmdDecide(0, 'a')).toBe(false); // nothing to decide now
    // The rival, left to itself, has answered too: the Dawn Court leans pious.
    expect(g.players[1].dilemma).toBeNull();
    expect(g.players[1].virtue).not.toBe(0);
    // An answer that cannot be paid for is refused and the question stands.
    p.dilemma = 'strangers'; p.res.food = 10;
    expect(g.cmdDecide(0, 'a')).toBe(false);
    expect(p.dilemma).toBe('strangers');

    // The ends of the scale.
    p.virtue = -80;
    expect(g.creed(0).id).toBe('decadent');
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const market = g.spawnBuilding('market', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) + 6, true);
    p.res.wood = 500;
    const gold = p.res.gold;
    g.cmdTrade(0, market.id, 'wood', 'sell');
    const decadentPrice = p.res.gold - gold;
    p.virtue = 80;
    expect(g.creed(0).id).toBe('zealous');
    const gold2 = p.res.gold;
    g.cmdTrade(0, market.id, 'wood', 'sell');
    expect(p.res.gold - gold2).toBeLessThan(decadentPrice);
    expect(p.virtue).toBe(78); // trading wears piety away
    // The zealous pray harder: a prophet's faith comes quicker.
    const pr = g.spawnUnit('prophet', 0, tc.x + 3, tc.y + 3);
    pr.mana = 0;
    run(g, 5);
    const zealousFaith = pr.mana;
    p.virtue = -80; pr.mana = 0;
    run(g, 5);
    expect(zealousFaith).toBeGreaterThan(pr.mana * 2);
    // It all survives a save.
    const r = Game.restore(g.serialize());
    expect(r.players[0].virtue).toBe(p.virtue);
    expect(creedOf(100).id).toBe('zealous');
    expect(CREEDS.length).toBe(5);
  });
});

describe('church and tavern', () => {
  const town = () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]);
    const p = g.players[0];
    p.age = 1; p.dilemmaT = 1e9; g.players[1].dilemmaT = 1e9;
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const vs = [0, 1, 2, 3, 4, 5].map((i) => g.spawnUnit('villager', 0, tc.x + 4 + (i % 3), tc.y + 4 + Math.floor(i / 3), i % 2 ? 'f' : 'm'));
    return { g, p, tc, vs };
  };

  it('clergy make a people pious and bring children sooner; they stop working while stationed', () => {
    const { g, p, tc, vs } = town();
    const church = g.spawnBuilding('temple', 0, Math.floor(tc.x) + 8, Math.floor(tc.y) + 2, true);
    expect(church.def.name).toBe('Church');
    const house = g.buildings.find((b) => b.type === 'house') ?? g.spawnBuilding('house', 0, Math.floor(tc.x) - 6, Math.floor(tc.y) + 6, true);
    const plain = g.birthTime(house);
    g.cmdTarget(0, vs.map((v) => v.id), church.id);
    run(g, 20);
    expect(church.staff!.length).toBe(4); // room for four; the rest are turned away
    expect(vs.filter((v) => v.inside === church.id).length).toBe(4);
    expect(p.clergy).toBe(4);
    run(g, 60);
    expect(p.virtue).toBeGreaterThan(4 * CLERGY_VIRTUE * 0.9);
    expect(g.birthTime(house)).toBeLessThan(plain / (1 + 4 * CLERGY_BIRTH) + 0.01);
    // Out they come, one and then all.
    expect(g.cmdUnstaff(0, church.id)).toBe(1);
    expect(g.cmdUnstaff(0, church.id, true)).toBe(3);
    expect(vs.every((v) => !v.inside)).toBe(true);
    run(g, 2);
    expect(p.clergy).toBe(0);
    // A church that falls puts its clergy on the street, alive.
    g.cmdTarget(0, [vs[0].id], church.id);
    run(g, 15);
    expect(vs[0].inside).toBe(church.id);
    g.cmdDelete(0, [church.id]);
    expect(vs[0].inside).toBe(0);
    expect(vs[0].dead).toBe(false);
  });

  it('in a worldly town a tavern almost never has a child, and then one no household owns to', () => {
    const setup = (virtue: number, men: number, women: number) => {
      const { g, p, tc } = town();
      const tavern = g.spawnBuilding('tavern', 0, Math.floor(tc.x) + 8, Math.floor(tc.y) + 2, true);
      const staff = [...Array.from({ length: men }, () => g.spawnUnit('villager', 0, tavern.x, tavern.y + 2.5, 'm')), ...Array.from({ length: women }, () => g.spawnUnit('villager', 0, tavern.x + 1, tavern.y + 2.5, 'f'))];
      g.cmdTarget(0, staff.map((v) => v.id), tavern.id);
      run(g, 20);
      expect(tavern.staff!.length).toBe(men + women);
      for (let i = 0; i < 4; i++) g.spawnBuilding('house', 0, Math.floor(tc.x) - 10 + i * 3, Math.floor(tc.y) + 8, true); // room for more people
      tavern.trystT = 0;
      // Held at the standing under test: the maids themselves would otherwise drag it down as the minutes pass.
      const hold = () => { p.virtue = virtue; };
      const own = () => g.units.filter((u) => u.bornAt === tavern.id);
      return { g, tavern, hold, own };
    };
    // Five minutes of it and nothing has come of it anywhere; only in a worldly town with both maids and patrons is there even a chance building.
    const after = (virtue: number, men: number, women: number): number => { const t = setup(virtue, men, women); run(t.g, 300, t.hold); expect(t.own().length).toBe(0); return t.tavern.trystT ?? 0; };
    expect(after(0, 1, 1)).toBe(0); // not in a temperate town
    expect(after(-50, 0, 2)).toBe(0); // nor with no patrons
    const worldly = after(-50, 1, 1), decadent = after(-90, 1, 1);
    expect(worldly).toBeGreaterThan(0);
    expect(worldly).toBeLessThan(0.15); // far from a child: tens of minutes for one couple
    expect(decadent).toBeGreaterThan(worldly);
    const two = after(-50, 2, 2); // a full tavern: two couples
    expect(two).toBeGreaterThan(worldly * 1.8);
    expect(two).toBeLessThan(worldly * 2.2);
    // When it does happen: a child, of no household.
    const t = setup(-50, 1, 1);
    t.tavern.trystT = 0.9999;
    run(t.g, 3, t.hold); // looked at straight away: in a town like this the child may not live long
    expect(t.own().length).toBe(1);
    expect(t.own()[0].growT).toBeGreaterThan(0);
    expect(t.own()[0].family).toBe('');
  });

  it('tavern maids bring in gold and decadence, and distract the rest of the town', () => {
    const { g, p, tc, vs } = town();
    const tavern = g.spawnBuilding('tavern', 0, Math.floor(tc.x) + 8, Math.floor(tc.y) + 2, true);
    g.cmdTarget(0, vs.slice(0, 3).map((v) => v.id), tavern.id);
    run(g, 20);
    expect(tavern.staff!.length).toBe(3);
    const gold = p.res.gold, virtue = p.virtue;
    run(g, 60);
    expect(p.maids).toBe(3);
    const women = vs.slice(0, 3).filter((v) => v.gender === 'f').length;
    expect(p.patrons).toBe(3 - women);
    expect(p.res.gold - gold).toBeGreaterThan(women * MAID_GOLD * 60 * 0.95);
    expect(p.res.gold - gold).toBeLessThan(women * MAID_GOLD * 60 * 1.05 + 1);
    expect(p.virtue).toBeLessThan(virtue - 3 * MAID_VIRTUE * 0.9);
    // Saved and restored, they are still behind the bar.
    const r = Game.restore(g.serialize());
    expect(r.buildings.find((b) => b.type === 'tavern')!.staff!.length).toBe(3);
    run(r, 2);
    expect(r.players[0].maids).toBe(3);
  });

  it('a pious AI staffs its church and a worldly one builds and staffs a tavern', () => {
    const g = new Game(9, [{ name: 'A', color: 1, isAI: true, civ: 'dawn' }, { name: 'B', color: 2, isAI: true, civ: 'forge' }]);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    let clergy = 0, maids = 0;
    for (let t = 0; t < 20 * 60 * 14 && g.winner < 0 && !(clergy && maids); t++) {
      g.step();
      if (t % 20 === 0) { for (const a of ais) a.update(); clergy = Math.max(clergy, g.players[0].clergy); maids = Math.max(maids, g.players[1].maids); }
    }
    expect(clergy).toBeGreaterThan(0);
    expect(maids).toBeGreaterThan(0);
  });
});

describe('faith, plague and the home', () => {
  it('the devout get over a plague in half the time and no plague takes hold among the righteous; the decadent suffer longer', () => {
    const lasts = (virtue: number) => {
      const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]);
      g.players[1].virtue = virtue;
      const pr = g.spawnUnit('prophet', 0, 40, 40);
      pr.mana = 200;
      const v = g.spawnUnit('swordsman', 1, 44, 40);
      v.stance = 'hold'; pr.stance = 'hold';
      g.cmdCast(0, [pr.id], 'plague', 44, 40);
      run(g, 3);
      return v.plagueT;
    };
    const plain = lasts(0);
    expect(plain).toBeGreaterThan(10);
    expect(lasts(40)).toBeLessThan(plain * 0.6);
    expect(lasts(80)).toBe(0);
    expect(lasts(-80)).toBeGreaterThan(plain * 1.3);
    expect(creedOf(80).name).toBe('Righteous');
  });

  it('a monk or nun leaves their house; a house with someone at the tavern raises no children', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]);
    const p = g.players[0];
    p.age = 1; p.dilemmaT = 1e9; p.res.food = 2000;
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const house = g.spawnBuilding('house', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) - 2, true);
    const tavern = g.spawnBuilding('tavern', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) + 3, true);
    const church = g.spawnBuilding('temple', 0, Math.floor(tc.x) + 11, Math.floor(tc.y) + 3, true);
    const man = g.spawnUnit('villager', 0, house.x, house.y + 2, 'm'), woman = g.spawnUnit('villager', 0, house.x + 1, house.y + 2, 'f');
    g.cmdTarget(0, [man.id, woman.id], house.id);
    run(g, 10);
    expect(house.residents.m).toBe(man.id);
    expect(house.residents.f).toBe(woman.id);
    // He goes drinking: the cradle stays empty however long we wait.
    g.cmdTarget(0, [man.id], tavern.id);
    run(g, 15);
    expect(man.inside).toBe(tavern.id);
    const before = house.birthProgress;
    run(g, 30);
    expect(house.birthProgress).toBe(before);
    expect(house.residents.m).toBe(man.id); // still his house
    // He comes home and life goes on.
    g.cmdUnstaff(0, tavern.id, true);
    run(g, 10);
    expect(house.birthProgress).toBeGreaterThan(before);
    // She takes the veil: the house is no longer hers.
    g.cmdTarget(0, [woman.id], church.id);
    run(g, 20);
    expect(woman.inside).toBe(church.id);
    expect(house.residents.f).toBe(0);
    expect(woman.homeId).toBe(0);
  });
});

describe('the tavern\'s other trade', () => {
  const town = () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]);
    const p = g.players[0];
    p.age = 1; p.dilemmaT = 1e9; g.players[1].dilemmaT = 1e9;
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const tavern = g.spawnBuilding('tavern', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) + 3, true);
    const man = g.spawnUnit('villager', 0, tavern.x - 1, tavern.y + 2.5, 'm'), woman = g.spawnUnit('villager', 0, tavern.x + 1, tavern.y + 2.5, 'f');
    return { g, p, tc, tavern, man, woman };
  };

  it('a patron drinks food away and hurries the muster; a milkmaid earns', () => {
    const { g, p, tc, tavern, man } = town();
    g.cmdTarget(0, [man.id], tavern.id);
    run(g, 10);
    expect(p.patrons).toBe(1);
    const food = p.res.food, gold = p.res.gold;
    run(g, 20);
    expect(p.res.gold).toBe(gold); // he earns nothing
    // (villagers elsewhere may be gathering, so only check the drain is there)
    const barracks = g.spawnBuilding('barracks', 0, Math.floor(tc.x) - 8, Math.floor(tc.y) + 3, true);
    p.res.food = 1000; p.res.wood = 1000;
    g.cmdTrain(0, barracks.id, 'clubman');
    const withPatron = barracks.queue[0].time;
    g.cmdUnstaff(0, tavern.id, true);
    run(g, 2);
    g.cmdTrain(0, barracks.id, 'clubman');
    expect(withPatron).toBeCloseTo(barracks.queue[barracks.queue.length - 1].time * (1 - PATRON_MUSTER), 3);
    expect(food).toBeGreaterThan(0);
  });

  it('mercenaries are hired for gold on the spot, want wages, and walk away unpaid', () => {
    const { g, p, tavern, woman } = town();
    p.res.gold = 500;
    expect(g.cmdHire(0, tavern.id, 'clubman')).toBeNull(); // nobody in the tavern
    g.cmdTarget(0, [woman.id], tavern.id);
    run(g, 10);
    const price = g.hireCost(0, 'clubman');
    const gold = p.res.gold, virtue = p.virtue;
    const m = g.cmdHire(0, tavern.id, 'clubman')!;
    expect(m.merc).toBe(true);
    expect(m.type).toBe('clubman');
    expect(p.res.gold).toBeCloseTo(gold - price, 5);
    expect(p.virtue).toBeLessThan(virtue);
    expect(g.cmdHire(0, tavern.id, 'mammoth')).toBeNull(); // not for hire
    // Wages are paid while there is gold; a restored game remembers who is hired.
    g.cmdUnstaff(0, tavern.id, true);
    const g0 = p.res.gold;
    run(g, 10);
    expect(p.res.gold).toBeCloseTo(g0 - 10 * MERC_WAGE, 1);
    expect(Game.restore(g.serialize()).units.some((u) => u.merc)).toBe(true);
    p.res.gold = 0;
    run(g, 6);
    expect(m.dead).toBe(true);
  });

  it('plague breaks out in the tavern of a decadent town, never a righteous or temperate one', () => {
    const outbreak = (virtue: number) => {
      const { g, p, tavern, man, woman } = town();
      g.cmdTarget(0, [man.id, woman.id], tavern.id);
      run(g, 10);
      const bystander = g.spawnUnit('villager', 0, tavern.x, tavern.y + 3, 'm');
      let sick = false;
      for (let i = 0; i < 20 * 60 * 12 && !sick; i++) { p.virtue = virtue; bystander.hp = bystander.maxHp; g.step(); sick = bystander.plagueT > 0; }
      return sick;
    };
    expect(outbreak(-90)).toBe(true);
    expect(outbreak(0)).toBe(false);
    expect(outbreak(90)).toBe(false);
  });
});

describe('the holy town and the work camp', () => {
  const town = () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]);
    const p = g.players[0];
    p.age = 2; p.dilemmaT = 1e9; g.players[1].dilemmaT = 1e9;
    for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 3000;
    const tc = g.buildings.find((b) => b.owner === 0)!;
    return { g, p, tc };
  };

  it('a town that keeps the faith trains no shamans or berserkers, but may call a priest', () => {
    const { g, p, tc } = town();
    const church = g.spawnBuilding('temple', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) + 3, true);
    const barracks = g.spawnBuilding('barracks', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
    expect(g.cmdTrain(0, church.id, 'priest')).toBe(false); // not yet devout
    expect(g.cmdTrain(0, church.id, 'shaman')).toBe(true);
    expect(g.cmdTrain(0, barracks.id, 'berserker')).toBe(true);
    p.virtue = 40;
    expect(g.cmdTrain(0, church.id, 'shaman')).toBe(false);
    expect(g.cmdTrain(0, barracks.id, 'berserker')).toBe(false);
    expect(g.cmdTrain(0, church.id, 'priest')).toBe(true);
    expect(g.cmdTrain(0, barracks.id, 'spearman')).toBe(true); // honest soldiers are fine
    expect(UNITS.priest.heal!).toBeGreaterThan(UNITS.shaman.heal!);
    // Neither will it keep slaves.
    expect(g.creedBar(0, UNITS.slaver)).toBeTruthy();
    const v = g.units.find((u) => u.owner === 0 && u.type === 'villager')!;
    expect(g.cmdPlace(0, 'workcamp', Math.floor(tc.x) + 6, Math.floor(tc.y) - 6, [v.id])).toBeNull();
  });

  it('a decadent town\'s slavers carry off villagers to a work camp, which drives the town and can be broken open', () => {
    const { g, p, tc } = town();
    p.virtue = -80;
    const tavern = g.spawnBuilding('tavern', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) + 3, true);
    expect(g.cmdTrain(0, tavern.id, 'slaver')).toBe(true);
    const slaver = g.spawnUnit('slaver', 0, tc.x - 2, tc.y + 5);
    const victim = g.spawnUnit('villager', 1, tc.x - 1, tc.y + 5, 'f');
    victim.name = 'Ruth'; victim.trait = 'strong';
    const theirs = g.units.filter((u) => u.owner === 1 && u.type === 'villager').length;
    // No camp, no capture.
    g.cmdTarget(0, [slaver.id], victim.id);
    expect(slaver.order).toBeNull();
    const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
    g.cmdTarget(0, [slaver.id], victim.id);
    expect(slaver.order?.t).toBe('capture');
    run(g, 6);
    expect(victim.dead).toBe(true);
    expect(g.units.filter((u) => u.owner === 1 && u.type === 'villager').length).toBe(theirs - 1);
    run(g, 12);
    expect(slaver.captive ?? null).toBeNull();
    expect(camp.captives!.map((c) => c.name)).toEqual(['Ruth']);
    run(g, 2);
    expect(p.captives).toBe(1);
    expect(p.captiveMen).toBe(0); // a woman: she adds villagers, not work
    // A man held adds work and no children.
    const solo = new Game(5, g.setups);
    const sc = solo.spawnBuilding('workcamp', 0, 30, 30, true);
    sc.captives = [{ from: 1, name: 'Boaz', family: '', gender: 'm', trait: '', trait2: '', age: 0, lifespan: 9999 }];
    solo.players[0].dilemmaT = 1e9; solo.players[0].popCap = 200;
    const sv = solo.units.filter((u) => u.owner === 0 && u.type === 'villager').length;
    run(solo, 130);
    expect(solo.players[0].captiveMen).toBe(1);
    expect(sc.campT ?? 0).toBe(0);
    expect(solo.units.filter((u) => u.owner === 0 && u.type === 'villager').length).toBeLessThanOrEqual(sv + 2); // only what the town itself trains or bears
    // Saved and restored, she is still held.
    expect(Game.restore(g.serialize()).buildings.find((b) => b.type === 'workcamp')!.captives!.length).toBe(1);
    // The camp turns out villagers for its owners in time.
    const mine = g.units.filter((u) => u.owner === 0 && u.type === 'villager').length;
    p.popCap = 200;
    run(g, 120);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'villager').length).toBeGreaterThan(mine);
    // Break the camp and Ruth goes home, still herself.
    g.cmdDelete(0, [camp.id]);
    const ruth = g.units.find((u) => u.owner === 1 && u.name === 'Ruth');
    expect(ruth).toBeTruthy();
    expect(ruth!.trait).toBe('strong');
    expect(ruth!.gender).toBe('f');
  });

  it('slavers posted at a camp drive its men harder; the day has a night', () => {
    const { g, p, tc } = town();
    p.virtue = -80;
    const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
    expect(camp.size).toBe(4);
    const man = (name: string) => ({ from: 1, name, family: '', gender: 'm' as const, trait: '', trait2: '', age: 0, lifespan: 9999 });
    camp.captives = [man('Boaz'), man('Amos')];
    run(g, 2);
    expect(p.captiveMen).toBe(2);
    // A villager cannot stand guard; a Slaver with no one to deliver can.
    const v = g.spawnUnit('villager', 0, camp.x, camp.y + 3, 'm'), s1 = g.spawnUnit('slaver', 0, camp.x + 1, camp.y + 3), s2 = g.spawnUnit('slaver', 0, camp.x - 1, camp.y + 3);
    g.cmdTarget(0, [v.id], camp.id);
    g.cmdTarget(0, [s1.id, s2.id], camp.id);
    run(g, 12);
    expect(v.inside).toBe(0);
    expect(camp.staff).toEqual(expect.arrayContaining([s1.id, s2.id]));
    expect(p.captiveMen).toBeCloseTo(2 * 1.5);
    expect(p.clergy).toBe(0); // guards are not counted as clergy or maids
    expect(p.maids).toBe(0);
    expect(Game.restore(g.serialize()).buildings.find((b) => b.type === 'workcamp')!.staff!.length).toBe(2);
    // Sent out again, the men are back to their own pace.
    expect(g.cmdUnstaff(0, camp.id, true)).toBe(2);
    run(g, 2);
    expect(p.captiveMen).toBe(2);
    // Day and night: seven tenths of five minutes light, the rest dark.
    const d = new Game(5, g.setups);
    expect(d.night).toBe(false);
    run(d, 215);
    expect(d.night).toBe(true);
    run(d, 90);
    expect(d.night).toBe(false);
  });

  it('by night unwatched captives slip away and an unguarded camp of men may rise; guards prevent both', () => {
    const camped = (men: number, women: number, guards: number) => {
      const { g, p, tc } = town();
      p.virtue = -80; p.popCap = 5; // no room for the camp's own children: this is about who gets out
      const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
      const held = (name: string, gender: 'm' | 'f') => ({ from: 1, name, family: '', gender, trait: '', trait2: '', age: 0, lifespan: 9999 });
      camp.captives = [...Array.from({ length: men }, (_, i) => held('Man' + i, 'm')), ...Array.from({ length: women }, (_, i) => held('Woman' + i, 'f'))];
      const posted = Array.from({ length: guards }, (_, i) => g.spawnUnit('slaver', 0, camp.x - 1 + i, camp.y + 3));
      if (guards) g.cmdTarget(0, posted.map((s) => s.id), camp.id);
      const said: string[] = [];
      const through = (seconds: number) => run(g, seconds, () => { for (const e of g.events) if (e.t === 'msg') said.push(e.text); g.events.length = 0; });
      return { g, camp, said, through };
    };
    // By day no one gets out, guarded or not.
    const day = camped(6, 2, 0);
    day.through(200);
    expect(day.g.night).toBe(false);
    expect(day.camp.captives!.length).toBe(8);
    expect(day.g.unwatched(day.camp)).toBe(8);
    // Through three nights with no guard, a camp of women loses some of them one by one, and they run for home as themselves.
    const loose = camped(0, 6, 0);
    const theirs = loose.g.units.filter((u) => u.owner === 1 && u.type === 'villager').length;
    loose.through(900);
    expect(loose.camp.captives!.length).toBeLessThan(6);
    expect(loose.said.some((t) => t.includes('slipped away'))).toBe(true);
    expect(loose.said.some((t) => t.includes('risen'))).toBe(false); // it takes men to rise
    expect(loose.g.units.filter((u) => u.owner === 1 && u.type === 'villager').length).toBeGreaterThanOrEqual(theirs); // those who got out are back among their own, unless cut down on the way
    expect(loose.g.units.some((u) => u.owner === 1 && u.name.startsWith('Woman'))).toBe(true);
    // Two guards watch six: no one gets out however many nights pass.
    const held = camped(3, 3, 2);
    held.through(900);
    expect(held.camp.staff!.length).toBe(2);
    expect(held.g.unwatched(held.camp)).toBe(0);
    expect(held.camp.captives!.length).toBe(6);
    // A camp full of unwatched men rises sooner or later: it burns and half of them are gone at a stroke.
    const risen = camped(10, 0, 0);
    risen.through(1500);
    expect(risen.said.some((t) => t.includes('risen'))).toBe(true);
    expect(risen.camp.dead || risen.camp.hp < risen.camp.maxHp).toBe(true);
  });

  it('a slaver killed on the road loses his captive', () => {
    const { g, p } = town();
    p.virtue = -80;
    g.spawnBuilding('workcamp', 0, 20, 60, true);
    const slaver = g.spawnUnit('slaver', 0, 46, 46), victim = g.spawnUnit('villager', 1, 47, 46, 'm');
    victim.name = 'Boaz';
    g.cmdTarget(0, [slaver.id], victim.id);
    run(g, 5);
    expect(slaver.captive?.name).toBe('Boaz');
    const guard = g.spawnUnit('swordsman', 1, slaver.x + 1, slaver.y);
    g.cmdTarget(1, [guard.id], slaver.id);
    run(g, 20);
    expect(slaver.dead).toBe(true);
    expect(g.units.some((u) => u.owner === 1 && u.name === 'Boaz')).toBe(true);
  });
});

describe('children who live to grow up', () => {
  it('a decadent town is dying out: few children, half of them lost, villagers slow to raise; it grows by its camp', () => {
    const dec = CREEDS.find((c) => c.id === 'decadent')!, mid = CREEDS.find((c) => c.id === 'temperate')!, worldly = CREEDS.find((c) => c.id === 'worldly')!;
    expect(dec.birth).toBeLessThan(0.5 * mid.birth);
    expect(dec.childLoss).toBeGreaterThanOrEqual(0.5);
    expect(dec.settle).toBe(2);
    expect(worldly.settle).toBe(1); // only the far end of the scale
    // A villager takes twice as long to raise at the Town Center.
    const queued = (virtue: number): number => {
      const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]);
      g.players[0].virtue = virtue; g.players[0].res.food = 999;
      const tc = g.buildings.find((b) => b.owner === 0)!;
      g.cmdTrain(0, tc.id, 'villager');
      return tc.queue[0].time;
    };
    expect(queued(-90)).toBeCloseTo(queued(0) * 2);
    // The camp holds twelve, and its women still bring villagers at the old pace whatever the town's own homes do.
    expect(BUILDINGS.workcamp.camp).toBe(12);
  });

  it('nearly all do in a righteous town, far fewer in a decadent one', () => {
    const raise = (virtue: number) => {
      const g = new Game(5, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]);
      const p = g.players[0];
      p.dilemmaT = 1e9; p.popCap = 400; p.res.food = 1e6;
      g.aging = false;
      const tc = g.buildings.find((b) => b.owner === 0)!;
      for (let i = 0; i < 6; i++) {
        const h = g.spawnBuilding('house', 0, Math.floor(tc.x) - 12 + i * 4, Math.floor(tc.y) + 8, true);
        const m = g.spawnUnit('villager', 0, h.x, h.y + 2, 'm'), f = g.spawnUnit('villager', 0, h.x + 0.5, h.y + 2, 'f');
        h.residents = { m: m.id, f: f.id }; m.homeId = h.id; f.homeId = h.id;
      }
      let died = 0;
      run(g, 600, () => { p.virtue = virtue; p.popCap = 400; died += g.events.filter((e) => e.t === 'msg' && e.player === 0 && e.text.includes('died young')).length; g.events.length = 0; });
      return { born: p.stats.born, died };
    };
    const holy = raise(90), fallen = raise(-90);
    expect(holy.born).toBeGreaterThan(20);
    expect(holy.died / holy.born).toBeLessThan(0.08);
    expect(fallen.died / fallen.born).toBeGreaterThan(0.15);
    expect(holy.born).toBeGreaterThan(fallen.born); // and the faithful have more of them to begin with
  });
});

describe('the thirteen nations', () => {
  it('every nation is complete: bonuses, two units of its own with a place to train them, a leader with every line, and campaign rules', () => {
    expect(CIV_IDS.length).toBe(13);
    for (const id of CIV_IDS) {
      const civ = CIVS[id];
      expect(civ.bonuses.length).toBeGreaterThan(0);
      for (const u of [civ.unique, civ.unique2]) {
        expect(UNITS[u].civ).toBe(id);
        expect(Object.values(BUILDINGS).some((b) => b.trains.includes(u))).toBe(true);
      }
      expect(LEADERS[id].civ).toBe(id);
      for (const e of LEADER_EVENTS) expect(LEADERS[id].lines[e].length).toBe(2);
      expect(CAMPAIGN_EDGE[id]).toBeTruthy();
      expect(PERSONA[id]).toBeTruthy();
      expect(CIV_COLOR[id]).toBeGreaterThan(0);
      // And it can start a match and a campaign.
      const g = new Game(3, [{ name: 'A', color: 1, isAI: false, civ: id }, { name: 'B', color: 2, isAI: true }]);
      expect(g.players[0].civ).toBe(id);
      expect(newCampaign(4, 2, 1, id).factions[0].civ).toBe(id);
    }
    expect(new Set(CIV_IDS.map((id) => CIVS[id].name)).size).toBe(13);
    expect(new Set(CIV_IDS.map((id) => LEADERS[id].name)).size).toBe(13);
  });

  it('the new nations\' units and campaign rules do what they say', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'england' }, { name: 'B', color: 2, isAI: false, civ: 'greece' }]);
    for (const p of g.players.slice(0, 2)) { p.age = 4; for (const r of ['food', 'wood', 'gold', 'stone'] as const) p.res[r] = 5000; }
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const range = g.spawnBuilding('range', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) + 3, true);
    expect(g.cmdTrain(0, range.id, 'longbowman')).toBe(true);
    expect(g.cmdTrain(0, range.id, 'ashigaru')).toBe(false); // Japanese only
    expect(UNITS.longbowman.range).toBeGreaterThan(UNITS.crossbowman.range);
    expect(g.players[1].mods.armor).toBe(1); // Greek soldiers
    // A billman beats a knight; a hoplite shrugs off arrows.
    const bill = g.spawnUnit('billman', 0, 48, 48), knight = g.spawnUnit('knight', 1, 49, 48);
    g.cmdTarget(0, [bill.id], knight.id); g.cmdTarget(1, [knight.id], bill.id);
    run(g, 20);
    expect(knight.dead).toBe(true);
    expect(bill.dead).toBe(false);
    expect(UNITS.hoplite.rangedResist).toBeGreaterThan(0);

    const land = newCampaign(7).territories.find((t) => t.capital < 0 && !t.trait)!;
    expect(siteCost(land, 'farm', 'egypt')).toBe(2);
    expect(companyCost(land, 'infantry', 'greece')).toBe(1);
    expect(companyCost(land, 'archers', 'england')).toBe(1);
    expect(truceCost('arabs')).toBe(1);
    expect(giftCost('arabs')).toBe(3);
    const bab = newCampaign(7, 1, 1, 'babylon'), rome = newCampaign(7, 1, 1, 'stonekin');
    expect(ageCost(bab, 0)).toBe(ageCost(rome, 0) - 3);
    const per = newCampaign(7, 1, 1, 'persia');
    const base = income(per, 0);
    for (const t of per.territories.filter((x) => x.owner < 0).slice(0, 2)) { t.owner = 0; t.buildings = []; t.trait = ''; }
    expect(income(per, 0)).toBe(base + 2 * 2 + 1); // two plain territories, and one more for holding three
    const jp = newCampaign(7, 1, 1, 'japan');
    const cap = jp.territories.find((t) => t.capital === 0)!;
    jp.armies = jp.armies.filter((a) => a.at !== cap.id);
    jp.factions[0].supplies = 20;
    raise(jp, 0, cap.id, 'infantry');
    expect(armyAt(jp, cap.id)!.vet).toBe(1);
  });
});

describe('men and women as leaders', () => {
  it('every nation but the Dawnsworn offers a leader of each sex, and the game uses whichever is chosen', () => {
    for (const id of CIV_IDS) {
      const l = LEADERS[id];
      if (id === 'dawn') { expect(l.female).toBe(false); expect(l.alt).toBeUndefined(); continue; }
      expect(l.alt).toBeTruthy();
      expect(l.alt!.female).toBe(!l.female);
      expect(l.alt!.name).not.toBe(l.name);
      // They speak every line; only the ones that name them differ.
      const lines = personaLines(id, true);
      for (const e of LEADER_EVENTS) expect(lines[e].length).toBe(2);
      expect(lines.intro[0]).not.toBe(l.lines.intro[0]);
      expect(lines.attack).toEqual(l.lines.attack);
    }
    expect(CIV_IDS.filter((id) => LEADERS[id].female || LEADERS[id].alt?.female).length).toBe(12);
    expect(leaderOf('england')!.name).toBe('Earl Godric of Wessex');
    setLeaderPersona('england', true);
    expect(leaderOf('england')!.name).toBe('Countess Edith of Wessex');
    expect(speechText({ civ: 'england', event: 'intro', index: 0 })).toContain('Edith');
    expect(speechText({ civ: 'england', event: 'win', index: 0 })).toBe(LEADERS.england.lines.win[0]);
    setLeaderPersona('england', false);
    expect(speechText({ civ: 'england', event: 'intro', index: 0 })).toContain('Godric');
    // The Dawnsworn have one leader whatever is asked for.
    setLeaderPersona('dawn', true);
    expect(leaderOf('dawn')!.name).toBe('Eliab the Seer');
    setLeaderPersona('dawn', false);
  });

  it('a map with relief has hills to hold and mountains to go round', () => {
    for (const seed of [3, 11, 42]) {
      const flat = generateMap(seed, 96, 2, false), m = generateMap(seed, 96, 2, false, true);
      const N = m.size;
      expect(flat.height.every((h) => h === 0)).toBe(true);
      expect(flat.terrain.includes(T_ROCK)).toBe(false);
      // The water lies where it did, so a seed still means the same country.
      for (let i = 0; i < N * N; i++) if (flat.terrain[i] === T_WATER) expect(m.terrain[i]).toBe(T_WATER);
      expect(m.terrain.includes(T_ROCK)).toBe(true);
      expect(Math.max(...m.height)).toBeGreaterThan(1);
      // Homes stand on level ground, clear of the ranges.
      for (const s of m.starts) for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
        const i = (s.y + dy) * N + s.x + dx;
        expect(m.height[i]).toBe(0);
        expect(m.terrain[i]).not.toBe(T_ROCK);
      }
      // Nothing grows or lies on bare rock, and no height stands in or beside water.
      for (const n of m.nodes) if (n.type !== 'fish') expect(m.terrain[n.cy * N + n.cx]).not.toBe(T_ROCK);
      for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
        const i = y * N + x;
        if (m.terrain[i] === T_WATER) expect(m.height[i]).toBe(0);
        else if ([i - 1, i + 1, i - N, i + N].some((j) => m.terrain[j] === T_WATER)) expect(m.height[i]).toBeLessThanOrEqual(0.46);
      }
      // There is always a way through from one home to the other.
      const blocked = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) if (m.terrain[i] === T_WATER || m.terrain[i] === T_ROCK) blocked[i] = 1;
      for (const n of m.nodes) if (n.type !== 'fish') { const sz = n.type === 'gold' || n.type === 'stone' ? 2 : 1; for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) blocked[(n.cy + y) * N + n.cx + x] = 1; }
      expect(connected(N, blocked, m.starts[0], m.starts[1])).toBe(true);
    }
  });

  it('high ground strikes harder, mountains cannot be crossed or built on, and steep ground cannot be built on', () => {
    const g = new Game(11, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }], 96, false, false, true);
    const N = g.size, H = g.spec.height;
    expect(new Game(11, [{ name: 'A', color: 1, isAI: false }, { name: 'B', color: 2, isAI: false }]).heightAt(40, 40)).toBe(0);
    // Find a hilltop and a spot on the flat.
    let top = 0, low = -1;
    for (let i = 0; i < N * N; i++) { if (H[i] > H[top]) top = i; if (low < 0 && H[i] === 0 && g.terrain[i] === 0) low = i; }
    const at = (i: number) => ({ x: (i % N) + 0.5, y: Math.floor(i / N) + 0.5 });
    expect(g.heightAt(at(top).x, at(top).y)).toBeCloseTo(H[top], 5);
    expect(g.highGround(at(top).x, at(top).y, at(low))).toBe(1.25);
    expect(g.highGround(at(low).x, at(low).y, at(top))).toBe(0.85);
    expect(g.highGround(at(low).x, at(low).y, at(low))).toBe(1);
    // Rock is closed to walkers and builders alike.
    const rock = g.terrain.indexOf(T_ROCK);
    expect(g.landPf.isBlocked(rock % N, Math.floor(rock / N))).toBe(true);
    expect(g.canPlace('house', rock % N, Math.floor(rock / N))).toBe(false);
    // A slope too steep for a house; the flat by the Town Center is fine.
    let steep = -1;
    for (let y = 2; y < N - 4 && steep < 0; y++) for (let x = 2; x < N - 4; x++) {
      const hs = [0, 1, N, N + 1].map((k) => H[y * N + x + k]);
      if (Math.max(...hs) - Math.min(...hs) > 0.42 && [0, 1, N, N + 1].every((k) => !g.occupied[y * N + x + k])) { steep = y * N + x; break; }
    }
    expect(steep).toBeGreaterThan(-1);
    expect(g.canPlace('house', steep % N, Math.floor(steep / N))).toBe(false);
    const st = g.spec.starts[0];
    let ok = false;
    for (let d = 3; d < 8 && !ok; d++) ok = g.canPlace('house', st.x + d, st.y + d);
    expect(ok).toBe(true);
    // A game with relief saves and comes back with the same land.
    const back = Game.restore(g.serialize());
    expect(back.relief).toBe(true);
    expect(Array.from(back.terrain)).toEqual(Array.from(g.terrain));
    // And the computer can still play a match on it.
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    g.players[0].isAI = g.players[1].isAI = true;
    for (let i = 0; i < 20 * 240; i++) { if (i % 20 === 0) for (const a of ais) a.update(); g.step(); }
    expect(g.buildings.filter((b) => b.owner === 0).length).toBeGreaterThan(2);
  });

  it('a leader\'s answers about how they rule steer how the computer plays their nation', () => {
    // Every axis can be pushed both ways by the questions.
    const first = temperFrom(Object.fromEntries(TEMPER_QUESTIONS.map((q) => [q.id, 0])))!;
    const last = temperFrom(Object.fromEntries(TEMPER_QUESTIONS.map((q) => [q.id, 2])))!;
    expect(first.war).toBeGreaterThan(0.33); expect(first.faith).toBeGreaterThan(0.33); expect(first.fort).toBeGreaterThan(0.33);
    expect(last.fort).toBeLessThan(-0.33); expect(last.faith).toBeLessThan(-0.33); expect(last.greed).toBeGreaterThan(0.33);
    expect(temperFrom({})).toBeNull();
    expect(temperWord('war', 0.8)).toBe('Warlike');
    // Unset, a nation plays as written.
    const written = PERSONA.hearth;
    expect(habitsWith('hearth', written)).toBe(written);
    expect(leaningWith('hearth', 0.7)).toBe(0.7);
    expect(battleHabits('hearth')).toEqual({ haste: 1, army: 1, walls: 'usual' });
    // A warlike, worldly raider: attacks sooner with more, never walls, turns to the tavern, refuses peace.
    setTemperament('hearth', { war: 1, faith: -1, fort: -1, greed: 1 });
    const b = battleHabits('hearth');
    expect(b.haste).toBeLessThan(0.7); expect(b.army).toBeGreaterThan(1.1); expect(b.walls).toBe('never');
    expect(leaningWith('hearth', 0.7)).toBeLessThan(0.2);
    const h = habitsWith('hearth', written);
    expect(h.margin).toBe(-1); expect(h.peace).toBeLessThan(written.peace); expect(h.greed).toBeGreaterThan(written.greed); expect(h.fort).toBeLessThan(0.1);
    const g = new Game(3, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'stonekin' }]);
    const raider = new AIController(g, 0), plain = new AIController(g, 1);
    raider.setLevel(1); plain.setLevel(1);
    expect(raider.firstAttack).toBeLessThan(plain.firstAttack);
    expect(raider.armyScale).toBeGreaterThan(plain.armyScale);
    // A pious fortifier is the opposite, and out-of-range numbers are held in.
    setTemperament('hearth', { war: -5, faith: 9, fort: 1, greed: -1 });
    expect(battleHabits('hearth').walls).toBe('early');
    expect(battleHabits('hearth').haste).toBeCloseTo(1.3);
    expect(leaningWith('hearth', 0.1)).toBeGreaterThan(0.9);
    setTemperament('hearth', null);
    expect(battleHabits('hearth').walls).toBe('usual');
  });

  it('a leader can be rewritten as a character of the voice actor\'s own', () => {
    setLeaderCharacter('greece', { name: 'Dave the <b>Bold</b>', title: '', lines: { attack: [null, 'Right. <script>Shields</script> up, lads.'], win: ['x'.repeat(500)] } });
    const l = leaderOf('greece')!;
    expect(l.name).toBe('Dave the bBold/b'); // nothing that could be markup survives
    expect(l.title).toBe(LEADERS.greece.title); // left blank: kept
    expect(monogram('Strategos Kallias')).toBe('K');
    expect(monogram('Dave the Unready')).toBe('D');
    expect(monogram('')).toBe('?');
    expect(l.female).toBe(false);
    expect(speechText({ civ: 'greece', event: 'attack', index: 0 })).toBe(LEADERS.greece.lines.attack[0]);
    expect(speechText({ civ: 'greece', event: 'attack', index: 1 })).toBe('Right. scriptShields/script up, lads.');
    expect(speechText({ civ: 'greece', event: 'win', index: 0 }).length).toBe(160);
    expect(speechText({ civ: 'greece', event: 'win', index: 1 })).toBe(LEADERS.greece.lines.win[1]);
    expect(speechText({ civ: 'greece', event: 'intro', index: 0 })).toBe(LEADERS.greece.lines.intro[0]);
    // Rubbish is ignored, and a renamed leader is still the man or woman they were.
    setLeaderCharacter('dawn', { name: 'Miriam', lines: 'nonsense' as never });
    expect(speechText({ civ: 'dawn', event: 'intro', index: 0 })).toBe(LEADERS.dawn.lines.intro[0]);
    expect(leaderOf('dawn')!.female).toBe(false);
    setLeaderCharacter('greece', null);
    setLeaderCharacter('dawn', null);
    expect(leaderOf('greece')!.name).toBe(LEADERS.greece.name);
  });
});

describe('roads, rough ground and the country', () => {
  it('a building is joined to its town centre by a road, which is lifted when it falls and kept across a save', () => {
    const g = new Game(5, setups);
    const p = spot(g, 'barracks', 0);
    const b = g.spawnBuilding('barracks', 0, p.cx, p.cy, true);
    const cells = g.roadOf.get(b.id)!;
    expect(cells.length).toBeGreaterThan(1);
    expect(cells[0]).toBe(g.buildings.find((x) => x.owner === 0 && x.type === 'towncenter')!.id);
    for (const i of cells.slice(1)) { expect(g.road[i]).toBeGreaterThan(0); expect(g.moveCost[i]).toBeCloseTo(0.6); }
    // Walls and farms take no road.
    const f = spot(g, 'farm', 0);
    expect(g.roadOf.has(g.spawnBuilding('farm', 0, f.cx, f.cy, true).id)).toBe(false);
    const back = Game.restore(g.serialize());
    expect([...back.roadOf]).toEqual([...g.roadOf]);
    expect(Array.from(back.moveCost)).toEqual(Array.from(g.moveCost));
    g.cmdDelete(0, [b.id]);
    run(g, 1);
    expect(g.roadOf.has(b.id)).toBe(false);
    expect(cells.slice(1).every((i) => g.road[i] === 0 && g.moveCost[i] === 1)).toBe(true);
  });

  it('units march faster on a road and slower through marsh, and their routes go round bad ground', () => {
    const march = (cost: number): number => {
      const g = new Game(5, setups);
      // A straight open lane somewhere on the map.
      let lx = 0, ly = 0;
      find: for (let y = 4; y < 92; y++) for (let x = 4; x < 70; x++) {
        let ok = true;
        for (let k = -1; k < 17 && ok; k++) for (const dy of [-1, 0, 1]) if (g.occupied[(y + dy) * 96 + x + k] || g.moveCost[(y + dy) * 96 + x + k] !== 1) ok = false;
        if (ok) { lx = x; ly = y; break find; }
      }
      expect(lx).toBeGreaterThan(0);
      const u = g.spawnUnit('villager', 0, lx + 0.5, ly + 0.5, 'm');
      // Bad ground is laid three tiles deep, or the route would simply step round it.
      for (let k = 0; k < 16; k++) for (const dy of cost > 1 ? [-1, 0, 1] : [0]) g.moveCost[(ly + dy) * 96 + lx + k] = cost;
      g.cmdMove(0, [u.id], lx + 15.5, ly + 0.5);
      run(g, 4);
      return u.x - (lx + 0.5);
    };
    const plain = march(1), road = march(0.6), bog = march(1.9);
    expect(road).toBeGreaterThan(plain * 1.4);
    expect(bog).toBeLessThan(plain * 0.8);
    // A wide bog lies straight across the way, with open ground to one side: the route goes round.
    const g = new Game(5, setups, 96, true);
    for (let y = 40; y < 60; y++) for (let x = 46; x < 52; x++) g.moveCost[y * 96 + x] = 1.9;
    const res = g.landPf.find(40.5, 50.5, 58.5, 50.5, 58.5, 50.5, 0.71);
    let wet = 0;
    for (let k = 0; k < res.path.length; k += 2) if (g.moveCost[Math.floor(res.path[k + 1]) * 96 + Math.floor(res.path[k])] > 1.5) wet++;
    expect(res.partial).toBe(false);
    expect(wet).toBe(0);
  });

  it('each country has its own ground, the same for both sides, and every home can still reach the others', () => {
    const count = (m: ReturnType<typeof generateMap>, t: number) => m.terrain.reduce((n, v) => n + (v === t ? 1 : 0), 0);
    const plain = generateMap(7, 96, 2, true, true);
    expect(count(plain, T_SAND) + count(plain, T_MARSH) + count(plain, T_SNOW)).toBe(0);
    const green = generateMap(7, 96, 2, true, true, 'temperate'), desert = generateMap(7, 96, 2, true, true, 'desert'), snow = generateMap(7, 96, 2, true, true, 'snow'), steppe = generateMap(7, 96, 2, true, true, 'steppe');
    expect(count(green, T_SAND)).toBeGreaterThan(50); // beaches
    expect(count(green, T_MARSH)).toBeGreaterThan(20);
    expect(count(desert, T_SAND)).toBeGreaterThan(count(desert, T_GRASS));
    expect(count(snow, T_SNOW)).toBeGreaterThan(count(snow, T_GRASS));
    const trees = (m: ReturnType<typeof generateMap>) => m.nodes.filter((n) => n.type === 'tree').length;
    expect(trees(desert)).toBeLessThan(trees(green));
    expect(trees(steppe)).toBeLessThan(trees(green));
    for (const m of [green, desert, snow, steppe]) {
      // Fair: the land is the same seen from either home.
      for (let i = 0; i < 96 * 96; i++) { const a = m.terrain[i], b = m.terrain[96 * 96 - 1 - i]; if (a >= T_SAND && b !== T_WATER && b !== T_ROCK && b !== 2) expect(b).toBe(a); }
      const blocked = new Uint8Array(96 * 96);
      for (let i = 0; i < 96 * 96; i++) if (m.terrain[i] === T_WATER || m.terrain[i] === T_ROCK) blocked[i] = 1;
      expect(connected(96, blocked, m.starts[0], m.starts[1])).toBe(true);
    }
    // The country is kept across a save.
    const g = new Game(7, setups, 96, false, true, true, 'desert');
    expect(Game.restore(g.serialize()).climate).toBe('desert');
    expect(Array.from(Game.restore(g.serialize()).terrain)).toEqual(Array.from(g.terrain));
  });
  it('weather comes to a country, tells on the fighting, and is kept across a save', () => {
    // The plain maps the missions and tests use have no weather at all.
    const plain = new Game(7, setups);
    run(plain, 400);
    expect(plain.weather).toBe('');
    const kinds = { temperate: 'rain', steppe: 'rain', snow: 'snow', desert: 'dust' } as const;
    for (const [climate, kind] of Object.entries(kinds)) {
      const g = new Game(7, setups, 96, false, false, true, climate as 'snow');
      expect(g.foul).toBe(''); // a match opens under a clear sky
      let seen = '';
      for (let i = 0; i < 20 * 400 && !seen; i++) { g.step(); seen = g.foul; }
      expect(seen).toBe(kind);
      // It passes again.
      for (let i = 0; i < 20 * 300 && g.foul; i++) g.step();
      expect(g.foul).toBe('');
    }
    // Rain: a bowman reaches a tile less and fires die sooner. Dust: no one sees as far. Snow: slower off the road.
    const g = new Game(7, setups, 96, false, false, true, 'temperate');
    const bow = g.spawnUnit('bowman', 0, 20, 20), sword = g.spawnUnit('swordsman', 0, 21, 20);
    const reach = g.reachOf(bow), sight = g.sightOf(bow);
    g.weather = 'rain'; g.weatherAmt = g.weatherWant = 1; g.weatherT = 1e6;
    expect(g.reachOf(bow)).toBe(reach - 1);
    expect(g.reachOf(sword)).toBe(sword.def.range);
    const back = Game.restore(g.serialize());
    expect(back.foul).toBe('rain');
    expect(back.weatherAmt).toBe(1);
    g.weather = 'dust';
    expect(g.sightOf(bow)).toBe(sight - 2);
    const walk = (snowing: boolean): number => {
      const w = new Game(7, setups, 96, false, false, true, 'snow');
      if (snowing) { w.weather = 'snow'; w.weatherAmt = w.weatherWant = 1; }
      w.weatherT = 1e6;
      const tc = w.buildings.find((b) => b.owner === 0)!, u = w.spawnUnit('swordsman', 0, tc.x + 4, tc.y + 4);
      w.cmdMove(0, [u.id], tc.x + 14, tc.y + 4);
      run(w, 3);
      return Math.hypot(u.x - tc.x - 4, u.y - tc.y - 4);
    };
    expect(walk(true)).toBeLessThan(walk(false) * 0.95);
  });
});

describe('play styles and raiders', () => {
  const band = (civ = 'wild') => new Game(7, [{ name: 'A', color: 1, isAI: false, civ }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);

  it('every nation belongs to a play style, and only the raiders raid', () => {
    for (const id of CIV_IDS) expect(STYLES[CIV_STYLE[id]], id).toBeTruthy();
    expect(CIV_IDS.filter((c) => styleOf(c).raid).sort()).toEqual(['steppe', 'wild']);
  });

  it('raiders start as a war band with no Town Center, and may raise one when they settle', () => {
    const g = band();
    expect(g.buildings.filter((b) => b.owner === 0).length).toBe(0);
    expect(g.units.filter((u) => u.owner === 0 && g.isMilitary(u)).length).toBe(BAND.fighters);
    expect(villagers(g, 0).length).toBe(2);
    run(g, 3);
    expect(g.players[0].defeated).toBe(false); // no town to lose
    expect(g.players[0].popCap).toBe(BAND.pop);
    const st = g.spec.starts[0];
    let at = { cx: 0, cy: 0 };
    for (let d = 3; d < 14 && !at.cx; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (!at.cx && g.canPlace('towncenter', Math.floor(st.x) + dx, Math.floor(st.y) + dy)) at = { cx: Math.floor(st.x) + dx, cy: Math.floor(st.y) + dy };
    const hall = g.cmdPlace(0, 'towncenter', at.cx, at.cy, villagers(g, 0).map((v) => v.id));
    expect(hall).toBeTruthy(); // in the Stone Age, which a settled people could not
    expect(g.cmdPlace(1, 'towncenter', 20, 20, villagers(g, 1).map((v) => v.id))).toBe(null);
    // The band is beaten when the last of it falls.
    for (const u of g.units.filter((u) => u.owner === 0)) (g as any).kill(u);
    for (const b of g.buildings.filter((b) => b.owner === 0)) (g as any).kill(b);
    run(g, 2);
    expect(g.players[0].defeated).toBe(true);
  });

  it('a raider carries a villager off and they join the tribe; a settled soldier just attacks', () => {
    const g = band();
    const st = g.spec.starts[0];
    const f = g.units.find((u) => u.owner === 0 && g.isMilitary(u))!;
    const v = g.spawnUnit('villager', 1, f.x + 2, f.y, 'f');
    v.name = 'Ada';
    const before = villagers(g, 0).length;
    g.cmdTarget(0, [f.id], v.id);
    expect(f.order?.t).toBe('capture');
    run(g, 12);
    expect(v.dead).toBe(true);
    // With no roof of their own, she is taken in where they stand.
    expect(villagers(g, 0).length).toBe(before + 1);
    expect(villagers(g, 0).some((u) => u.name === 'Ada' && u.gender === 'f')).toBe(true);
    // With a hall, the captive is led home first, and is freed if the raider falls on the way.
    g.spawnBuilding('towncenter', 0, Math.floor(st.x) - 2, Math.floor(st.y) - 8, true);
    const far = g.spawnUnit('clubman', 0, st.x + 14, st.y + 8);
    const v2 = g.spawnUnit('villager', 1, far.x + 1, far.y, 'm');
    v2.name = 'Bram';
    g.cmdTarget(0, [far.id], v2.id);
    run(g, 5);
    expect(far.captive?.name).toBe('Bram');
    expect(far.order?.t).toBe('deliver');
    (g as any).kill(far);
    expect(villagers(g, 1).some((u) => u.name === 'Bram')).toBe(true);
    // A settled people's soldier has no such order.
    const s = g.spawnUnit('clubman', 1, 30, 30), t = g.spawnUnit('villager', 0, 31, 30, 'm');
    g.cmdTarget(1, [s.id], t.id);
    expect(s.order?.t).toBe('attack');
  });

  it('a raiding computer player settles, and brings people home', () => {
    const g = new Game(11, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'wild' }]);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    run(g, 60 * 12, () => ais.forEach((a) => a.update()));
    expect(g.buildings.some((b) => b.owner === 1 && b.type === 'towncenter' && b.complete)).toBe(true);
    expect(g.players[1].defeated).toBe(false);
  });
});

describe('pathing and the computer player under load', () => {
  it('a unit that is built over walks out to open ground and carries on', () => {
    const g = new Game(3, setups);
    const s = spot(g, 'barracks', 0);
    const size = BUILDINGS.barracks.size;
    const u = g.spawnUnit('clubman', 0, s.cx + size / 2, s.cy + size / 2);
    g.spawnBuilding('barracks', 0, s.cx, s.cy, true);
    g.cmdMove(0, [u.id], s.cx + size + 4.5, s.cy + size / 2);
    run(g, 20);
    const inside = u.x >= s.cx && u.x < s.cx + size && u.y >= s.cy && u.y < s.cy + size;
    expect(inside).toBe(false);
    expect(Math.hypot(u.x - (s.cx + size + 4.5), u.y - (s.cy + size / 2))).toBeLessThan(2.5);
  });

  it('a raider fights the armed man before he takes the villager beside him', () => {
    const g = new Game(3, [{ name: 'A', color: 1, isAI: false, civ: 'wild' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
    // A clear stretch of open ground to stand them on.
    const st = g.spec.starts[0];
    let at = { x: 0, y: 0 };
    search: for (let r = 5; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const cx = Math.floor(st.x) + dx, cy = Math.floor(st.y) + dy;
      let clear = true;
      for (let k = -4; k <= 3 && clear; k++) for (let m = -1; m <= 1; m++) if (g.landPf.isBlocked(cx + k, cy + m)) { clear = false; break; }
      if (clear) { at = { x: cx + 0.5, y: cy + 0.5 }; break search; }
    }
    const raider = g.spawnUnit('clubman', 0, at.x, at.y);
    const villager = g.spawnUnit('villager', 1, at.x + 1.5, at.y, 'm');
    const guard = g.spawnUnit('spearman', 1, at.x - 3, at.y);
    guard.stance = 'hold';
    let fought = false;
    run(g, 6, () => { if (raider.order?.t === 'attack' && (raider.order as { id: number }).id === guard.id) fought = true; });
    console.log('raider: fought ' + fought + ', guard hp ' + guard.hp + '/' + guard.maxHp + ', order ' + raider.order?.t);
    expect(fought || guard.hp < guard.maxHp).toBe(true);
    expect(villager.dead).toBeFalsy();
  });

  it('no second of a long game between two computer players stalls, and the game is won', () => {
    // Seed 13 between these two once froze for half a minute laying a road to a house outside the walls.
    const g = new Game(13, [{ name: 'a', color: 1, isAI: true, civ: 'greece' }, { name: 'b', color: 2, isAI: true, civ: 'dawn' }]);
    const ais = [0, 1].map((i) => { const c = new AIController(g, i); c.setLevel(1); return c; });
    let worst = 0;
    for (let sec = 0; sec < 50 * 60 && g.winner < 0; sec++) {
      const t0 = Date.now();
      for (let i = 0; i < 20; i++) g.step();
      g.events.length = 0;
      ais.forEach((c) => c.update());
      worst = Math.max(worst, Date.now() - t0);
    }
    console.log(`long AI game: winner ${g.winner} at ${(g.time / 60).toFixed(1)}m, worst second ${worst}ms`);
    expect(worst).toBeLessThan(3000);
    expect(g.winner).toBeGreaterThanOrEqual(0);
  }, 240000);
});

describe('day and night', () => {
  it('units see two tiles less in the dark; buildings do not', () => {
    const g = new Game(3, setups);
    const u = g.units.find((q) => q.owner === 0)!;
    expect(g.night).toBe(false);
    const byDay = g.sightOf(u);
    g.time = DAY_LENGTH * 0.8;
    expect(g.night).toBe(true);
    expect(g.sightOf(u)).toBe(Math.max(3, byDay - NIGHT_SIGHT));
    g.time = DAY_LENGTH * 1.1;
    expect(g.sightOf(u)).toBe(byDay);
  });
});

describe('weather and events on the campaign map', () => {
  const still = (kind: 'rain' | 'snow' | 'dust', x: number, y: number) => [{ kind, x, y, r: 40, vx: 0, vy: 0 }];
  it('an army attacking into snow fights at 85% strength, and snow costs a land a supply', () => {
    const make = () => { const c = newCampaign(5, 1, 1, 'hearth'); c.fronts = []; return c; };
    const clear = make(), snowy = make();
    const home = clear.territories.find((t) => t.capital === 0)!;
    const to = home.adj.find((n) => clear.territories[n].owner < 0)!;
    snowy.fronts = still('snow', snowy.territories[to].x, snowy.territories[to].y);
    expect(weatherAt(snowy, to)).toBe('snow');
    expect(weatherAt(clear, to)).toBe('');
    const army = (c: Campaign) => c.armies.find((a) => a.owner === 0)!.id;
    expect(moveArmy(clear, army(clear), to)).toBe('battle');
    expect(moveArmy(snowy, army(snowy), to)).toBe('battle');
    expect(snowy.pending!.aStr).toBeCloseTo(clear.pending!.aStr * WEATHER.snow.march, 0);
    expect(snowy.pending!.aStr).toBeLessThan(clear.pending!.aStr);
    const c = make();
    const before = income(c, 0);
    c.fronts = still('snow', home.x, home.y);
    expect(income(c, 0)).toBe(before - 1);
    expect(battleConfig(snowy)!.weather).toBe('snow');
  });

  it('unrest left without a garrison ends in revolt; a hoard pays whoever holds the land', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    const land = c.territories[home.adj.find((n) => c.territories[n].owner < 0)!];
    land.owner = 0;
    c.events = [{ kind: 'unrest', at: land.id, turn: c.turn, until: c.turn }, { kind: 'hoard', at: home.id, turn: c.turn, until: c.turn }];
    const twin: Campaign = JSON.parse(JSON.stringify(c));
    twin.events = [{ kind: 'unrest', at: land.id, turn: c.turn, until: c.turn }];
    endTurn(c);
    endTurn(twin);
    expect(c.events!.some((e) => e.kind === 'revolt' && e.at === land.id)).toBe(true);
    expect(c.log.some((l) => l.includes('has risen'))).toBe(true);
    expect(c.events!.some((e) => e.kind === 'found' && e.at === home.id)).toBe(true);
    expect(c.factions[0].supplies - twin.factions[0].supplies).toBe(HOARD_PRIZE);
    expect(eventsAt(c, home.id)[0].kind).toBe('found');
  });
});

describe('marauders', () => {
  it('make camp in the wilds, carry off a woman who bears them children, and she goes free when the camp burns', () => {
    const g = new Game(3, setups);
    g.marauders = true;
    run(g, LAIR_AT + 2);
    const lair = g.buildings.find((b) => b.type === 'lair')!;
    expect(lair).toBeTruthy();
    expect(lair.owner).toBe(g.wild);
    for (const st of g.spec.starts) expect(Math.hypot(st.x - lair.x, st.y - lair.y)).toBeGreaterThan(18);
    const band = () => g.units.filter((u) => u.def.marauder);
    expect(band().length).toBeGreaterThanOrEqual(4);
    // One of them seizes a mother of two.
    const woman = villagers(g, 0).find((v) => v.gender === 'f' && v.growT <= 0)!;
    woman.kids = 2;
    const name = woman.name;
    const man = band()[0];
    man.x = woman.x + 0.4; man.y = woman.y;
    g.cmdStop(0, [woman.id]);
    g.cmdTarget(g.wild, [man.id], woman.id);
    run(g, 8);
    expect(man.captive?.name).toBe(name);
    expect(man.captive!.kids).toBe(2);
    expect(villagers(g, 0).some((v) => v.name === name)).toBe(false);
    // Brought to the camp, she is held there, and the band grows by her.
    const held = man.captive!;
    man.x = lair.x; man.y = lair.y + lair.size / 2 + 0.6;
    run(g, 6);
    expect(lair.captives).toContain(held);
    expect(held.held).toBe(true);
    const before = band().length;
    run(g, LAIR_BIRTH * 5);
    expect(held.born ?? 0).toBeGreaterThanOrEqual(1);
    expect(band().length).toBeGreaterThan(before);
    // The camp is burnt: she comes home with her record, bears no more, and works harder.
    (g as unknown as { kill(e: Building): void }).kill(lair);
    const home = villagers(g, 0).find((v) => v.name === name)!;
    expect(home).toBeTruthy();
    expect(home.freed).toBe(true);
    expect(home.kids).toBe(2);
    expect(home.captiveKids).toBe(held.born);
    expect(home.story!.map((d) => d.s)).toEqual(['Carried off by marauders', 'Freed, and came home']);
  }, 60000);

  it('a computer player that has lost a woman to the camp marches on it and burns it', () => {
    const g = new Game(3, setups);
    g.marauders = true;
    const ai = new AIController(g, 1);
    let found = 0, burnt = 0, taken = 0;
    for (let s = 0; s < 60 * 35 && !burnt; s++) {
      run(g, 1);
      ai.update();
      const lair = g.buildings.find((b) => b.type === 'lair');
      if (lair && !found) found = g.time;
      if (lair) taken = Math.max(taken, (lair.captives ?? []).filter((c) => c.from === 1).length);
      if (found && !lair) burnt = g.time;
    }
    console.log(`camp at ${Math.round(found)}s, burnt at ${Math.round(burnt)}s, most held from the AI ${taken}`);
    expect(found).toBeGreaterThan(0);
    expect(burnt).toBeGreaterThan(0);
    // Left to chance it took half an hour and the camp filled; hunted, it falls well before that.
    expect(burnt).toBeLessThan(60 * 25);
    expect(taken).toBeLessThan(8);
  }, 240000);

  it('do not appear unless the match asks for them', () => {
    const g = new Game(3, setups);
    run(g, LAIR_AT + 5);
    expect(g.buildings.some((b) => b.type === 'lair')).toBe(false);
  });
});

describe('the voices of the people', () => {
  it('every villager job and every arm has a line for each moment in each temper, and every recording has its own name', () => {
    const keys = new Set<string>();
    let n = 0;
    for (const r of FOLK) {
      const moments = Object.keys(r.lines) as FolkMoment[];
      expect(moments, r.id).toEqual(r.kind === 'villager' ? ['ready', 'go', 'fear'] : ['ready', 'march', 'charge', 'hurt']);
      for (const m of moments) {
        expect(r.lines[m]!.length).toBe(3);
        r.lines[m]!.forEach((text, i) => {
          expect(text.length, `${r.id} ${m}`).toBeGreaterThan(3);
          expect(text.length, `${r.id} ${m}: short enough to call out`).toBeLessThan(60);
          for (const sex of ['m', 'f'] as const) for (const v of FOLK_VOICES) { keys.add(folkKey(r.id, LEANS[i], m, sex, v)); n++; }
        });
        // The three tempers do not say the same thing.
        expect(new Set(r.lines[m]).size).toBe(3);
      }
    }
    expect(keys.size).toBe(n);
    expect(FOLK.filter((r) => r.kind === 'villager').map((r) => r.id)).toEqual(['townsfolk', 'woodcutter', 'farmer', 'forager', 'hunter', 'fisher', 'miner', 'builder', 'cleric', 'taverner']);
    expect(leanOf(40)).toBe('pious');
    expect(leanOf(0)).toBe('plain');
    expect(leanOf(-40)).toBe('decadent');
  });
});

describe('the worlds of the campaign', () => {
  it('each world lays out its country differently, and a battle is fought in the country of the land', () => {
    const kinds = (seed: number) => { const c = newCampaign(seed, 2, 1, 'hearth'); return c.territories.map((t) => biomeOf(c, t.id)); };
    const all = new Set<string>(), shapes = new Set<string>(), sizes = new Set<number>();
    for (let seed = 1; seed <= 14; seed++) { const k = kinds(seed); k.forEach((b) => all.add(b)); shapes.add(k.join()); sizes.add(k.length); }
    expect(shapes.size).toBe(14);
    expect(sizes.size).toBeGreaterThan(2);
    for (const b of ['grass', 'forest', 'steppe', 'desert', 'snow']) expect(all.has(b), b).toBe(true);
    expect(kinds(4)).toEqual(kinds(4));
    // The same point is always the same country in the same world.
    const c = newCampaign(6, 1, 1, 'hearth');
    const a = c.armies.find((x) => x.owner === 0)!;
    const target = c.territories.find((t) => t.owner < 0 && c.territories[a.at].adj.includes(t.id))!;
    moveArmy(c, a.id, target.id);
    c.pending!.mode = 'siege';
    expect(battleConfig(c)!.climate).toBe(BIOMES[biomeOf(c, target.id)].climate);
  });
});

describe('mountains and rivers on the campaign map', () => {
  it('close the border they lie across, and never cut the world in two', () => {
    let closed = 0;
    const kinds = new Set<string>(), all: Record<string, number> = {};
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth'), T = terrainOf(c);
      const links = c.territories.reduce((n, t) => n + t.adj.length, 0) / 2;
      expect(c.barriers!.length).toBeLessThanOrEqual(Math.ceil((links + c.barriers!.length) / 4));
      for (const w of c.barriers!) {
        kinds.add(w.kind); closed++; all[w.kind] = (all[w.kind] ?? 0) + 1;
        // Neither land counts the other a neighbour, so no army marches across and none lends support.
        expect(c.territories[w.a].adj).not.toContain(w.b);
        expect(c.territories[w.b].adj).not.toContain(w.a);
        expect(reach(c, w.a)).not.toContain(w.b);
      }
      // Every land can still be reached from every other, and none is left with a single way in.
      const seen = new Set([0]), q = [0];
      while (q.length) for (const n of c.territories[q.pop()!].adj) if (!seen.has(n)) { seen.add(n); q.push(n); }
      expect(seen.size).toBe(c.territories.length);
      for (const t of c.territories) expect(t.adj.length).toBeGreaterThanOrEqual(2);
      for (const t of c.territories) expect(t.name, `a name for every land of world ${seed}`).toBeTruthy();
      // Every town stands on dry land, and the world has water round it.
      for (const t of c.territories) expect(T.H[Math.round(t.y / 3) * T.gw + Math.round(t.x / 3)]).toBeGreaterThan(0);
      expect(T.H[0]).toBeLessThan(0);
    }
    console.log(`borders closed in 12 worlds: ${closed} ${JSON.stringify(all)}`);
    expect(closed).toBeGreaterThan(12);
    expect(kinds.has('mountains')).toBe(true);
    expect(kinds.has('river')).toBe(true);
  });

  it('an army ordered across a closed border does not move', () => {
    const c = newCampaign(3, 2, 1, 'hearth');
    const w = c.barriers![0];
    c.armies = [{ id: 99, owner: 0, at: w.a, units: { infantry: 3 }, hero: false, vet: 0, moved: false }];
    c.territories[w.a].owner = 0;
    moveArmy(c, 99, w.b);
    expect(c.armies[0].at).toBe(w.a);
    expect(c.pending).toBeNull();
  });
});

describe('marauders on the campaign map', () => {
  it('women carried off cost a land its supplies until the camp next door is broken', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    const camp = c.territories[home.adj.find((n) => c.territories[n].owner < 0)!];
    const before = income(c, 0);
    home.taken = 2;
    expect(income(c, 0)).toBe(before - 2);
    // The player takes the camp's land: next turn the news comes in.
    camp.horde = true;
    camp.owner = 0;
    const twin: Campaign = JSON.parse(JSON.stringify(c));
    twin.territories[camp.id].horde = false;
    twin.territories[home.id].taken = 0;
    endTurn(c);
    endTurn(twin);
    expect(c.territories[camp.id].horde).toBe(false);
    expect(c.territories[home.id].taken).toBe(0);
    expect(c.events!.some((e) => e.kind === 'freed' && e.at === camp.id)).toBe(true);
    // The prize, less the two supplies the land was still short of when this turn's stores were counted.
    expect(c.factions[0].supplies - twin.factions[0].supplies).toBe(HORDE_PRIZE - 2);
  });

  it('a camp left alone grows, and marauders appear in a long campaign', () => {
    const c = newCampaign(9, 2, 1, 'hearth');
    let seen = false, grew = false, last = 0;
    for (let turn = 0; turn < 30 && c.phase !== 'over'; turn++) {
      if (c.pending) resolvePending(c, 'auto');
      if (c.demand) answerDemand(c, true);
      if (c.phase === 'ai') continueAI(c);
      if (c.phase === 'player') endTurn(c);
      const camps = c.territories.filter((t) => t.horde && t.owner < 0);
      if (camps.length) { seen = true; const m = Math.max(...camps.map((t) => t.militia)); if (last && m > last) grew = true; last = m; }
    }
    expect(seen).toBe(true);
    expect(grew).toBe(true);
  });
});
