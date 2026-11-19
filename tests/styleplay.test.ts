// The computer plays to its people's rule (src/sim/styleplay.ts; ai.ts asks it).
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { BUILDINGS, STYLE_RULES } from '../src/sim/data';
import { STYLE_PLAY, fallBack, roomWork, studyReserve, styleWork } from '../src/sim/styleplay';
import { spot } from './helpers';

const game = (civ: string, seed = 7): Game => new Game(seed, [{ name: 'A', color: 1, isAI: true, civ }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
const rich = (g: Game, pid = 0): void => { Object.assign(g.players[pid].res, { food: 5000, wood: 5000, gold: 5000, stone: 5000 }); };
const town = (g: Game, over: Partial<{ villagers: number; age: number; peace: boolean }> = {}, pid = 0) =>
  ({ villagers: 20, age: g.players[pid].age, peace: false, count: (t: string) => g.buildings.filter((b) => b.owner === pid && b.type === t).length, ...over });
const stand = (g: Game, type: string, pid = 0, complete = true) => { const at = spot(g, type, pid); return g.spawnBuilding(type, pid, at.cx, at.cy, complete); };
/** Let the computer play both sides for so many seconds. */
const play = (g: Game, seconds: number): void => {
  const ais = g.players.map((_, i) => { const a = new AIController(g, i); a.setLevel(1); return a; });
  for (let s = 0; s < seconds && g.winner < 0; s++) { for (let i = 0; i < 20; i++) { g.step(); g.events.length = 0; } ais.forEach((a) => a.update()); }
};
const LONG = 120000;

describe('what a people\'s rule makes worth raising', () => {
  it('traders raise a market as soon as they may, and then up to the three that earn, when the town has hands for it', () => {
    const g = game('persia'); rich(g);
    expect(styleWork(g, 0, town(g))).toBeNull(); // not of their age yet
    g.players[0].age = 1;
    expect(styleWork(g, 0, town(g, { villagers: 6 }))).toBe('market'); // the first before the rest of its age
    stand(g, 'market');
    expect(styleWork(g, 0, town(g))).toBe('market');
    expect(styleWork(g, 0, town(g, { villagers: STYLE_PLAY.marketHands - 1 }))).toBeNull();
    stand(g, 'market'); stand(g, 'market');
    expect(g.buildings.filter((b) => b.owner === 0 && b.type === 'market')).toHaveLength(STYLE_RULES.caravanMarkets);
    expect(styleWork(g, 0, town(g))).toBeNull();
    const other = game('hearth'); rich(other); other.players[0].age = 1; stand(other, 'market');
    expect(styleWork(other, 0, town(other))).toBeNull(); // nobody else wants a second
  });
  it('the Faithful raise their church before the rest of its age; builders keep more towers than others, but not a town in peace', () => {
    const f = game('dawn'); rich(f);
    expect(styleWork(f, 0, town(f))).toBeNull(); // not of their age yet
    f.players[0].age = Math.max(1, f.ageFor(0, BUILDINGS.temple));
    expect(styleWork(f, 0, town(f))).toBe('temple');
    stand(f, 'temple');
    expect(styleWork(f, 0, town(f))).toBeNull();
    const b = game('stonekin'); rich(b); b.players[0].age = 1;
    expect(styleWork(b, 0, town(b))).toBeNull(); // the first two by the common order
    stand(b, 'tower'); stand(b, 'tower');
    expect(styleWork(b, 0, town(b))).toBe('tower');
    expect(styleWork(b, 0, town(b, { peace: true }))).toBeNull();
    stand(b, 'tower'); stand(b, 'tower');
    expect(styleWork(b, 0, town(b))).toBeNull();
    b.players[0].res.stone = 0; b.players[0].res.wood = 0;
    const c = game('stonekin'); c.players[0].age = 1; Object.assign(c.players[0].res, { food: 0, wood: 0, gold: 0, stone: 0 }); stand(c, 'tower'); stand(c, 'tower');
    expect(styleWork(c, 0, town(c))).toBeNull(); // nothing it cannot pay for
  });
  it('a farmer short of room raises a farm, while farms still make room and the town has houses for its couples', () => {
    const g = game('hearth'); rich(g);
    for (let i = 0; i < 6; i++) stand(g, 'house');
    expect(roomWork(g, 0, town(g))).toBe('farm');
    expect(roomWork(g, 0, town(g, { villagers: 40 }))).toBe('house'); // too few houses for so many: couples first
    for (let i = 0; i < STYLE_RULES.farmPopMax; i++) stand(g, 'farm');
    expect(roomWork(g, 0, town(g))).toBe('house'); // twelve farms make all the room farms can
    const other = game('persia'); rich(other);
    for (let i = 0; i < 6; i++) stand(other, 'house');
    expect(roomWork(other, 0, town(other))).toBe('house');
  });
  it('scholars keep nothing back when a technology is to be bought', () => {
    expect(studyReserve(game('forge'), 0)).toEqual({ food: 0, wood: 0 });
    expect(studyReserve(game('hearth'), 0)).toEqual({ food: 150, wood: 100 });
  });
});

describe('who a people\'s rule sends out of the fight', () => {
  it('the Faithful\'s hurt go to their nearest church and stay until they are whole', () => {
    const g = game('dawn'), temple = stand(g, 'temple'), home = g.buildings.find((b) => b.owner === 0)!;
    const mine = () => g.buildings.filter((b) => b.owner === 0);
    const a = g.spawnUnit('clubman', 0, temple.x + 12, temple.y), b = g.spawnUnit('clubman', 0, temple.x + 13, temple.y), far = g.spawnUnit('clubman', 0, temple.x + STYLE_PLAY.reach + 20, temple.y);
    a.hp = a.maxHp * 0.4; far.hp = far.maxHp * 0.2;
    expect(fallBack(g, 0, [a, b, far], mine(), home)).toEqual([{ ids: [a.id], x: temple.x, y: temple.y }]); // the whole man fights on; one too far from any church stays
    a.x = temple.x + 2; a.hp = a.maxHp * 0.7; // at the church, mending
    expect(fallBack(g, 0, [a, b], mine(), home)).toEqual([{ ids: [a.id], x: temple.x, y: temple.y }]);
    a.hp = a.maxHp * 0.95;
    expect(fallBack(g, 0, [a, b], mine(), home)).toEqual([]);
    const other = game('hearth'), t2 = stand(other, 'temple'), u = other.spawnUnit('clubman', 0, t2.x + 5, t2.y);
    u.hp = 1;
    expect(fallBack(other, 0, [u], other.buildings.filter((x) => x.owner === 0), t2)).toEqual([]);
  });
  it('a warrior people\'s veteran badly hurt is sent home; a green soldier fights on', () => {
    const g = game('japan'), home = g.buildings.find((b) => b.owner === 0)!;
    const vet = g.spawnUnit('clubman', 0, home.x + 20, home.y), green = g.spawnUnit('clubman', 0, home.x + 21, home.y);
    vet.kills = STYLE_PLAY.kills; vet.hp = vet.maxHp * 0.2; green.hp = green.maxHp * 0.2;
    expect(fallBack(g, 0, [vet, green], [], home)).toEqual([{ ids: [vet.id], x: home.x, y: home.y }]);
    vet.hp = vet.maxHp * 0.6;
    expect(fallBack(g, 0, [vet, green], [], home)).toEqual([]);
  });
  it('the computer gives the order: a hurt soldier of the Faithful walks to the church and is healed there', () => {
    const g = game('dawn'), temple = stand(g, 'temple');
    const u = g.spawnUnit('clubman', 0, temple.x + 14, temple.y + 2);
    u.hp = u.maxHp * 0.3;
    play(g, 25);
    expect(Math.hypot(u.x - temple.x, u.y - temple.y)).toBeLessThanOrEqual(STYLE_RULES.sanctuary);
    expect(u.hp).toBeGreaterThan(u.maxHp * 0.5);
    play(g, 30);
    expect(u.hp).toBeGreaterThanOrEqual(u.maxHp * STYLE_PLAY.whole); // whole again, and back to the army
  }, LONG);
});

describe('the computer plays it out', () => {
  it('a trader people left to itself keeps more markets than a farmer people does', () => {
    const g = new Game(11, [{ name: 'A', color: 1, isAI: true, civ: 'persia' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
    play(g, 22 * 60);
    const n = (pid: number, t: string): number => g.buildings.filter((b) => b.owner === pid && b.type === t && !b.dead).length;
    expect(n(0, 'market')).toBeGreaterThan(1);
    expect(n(0, 'market')).toBeLessThanOrEqual(STYLE_RULES.caravanMarkets);
    expect(n(1, 'market')).toBeLessThanOrEqual(1);
  }, 600000);
});
