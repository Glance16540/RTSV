// What the computer builds for its town besides its works of war, and the studies it queues (src/sim/aiworks.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { AIController } from '../src/sim/ai';
import { BUILDINGS, TECHS } from '../src/sim/data';
import { NEEDED, OF_PLENTY, WORKS, hasUseFor, mayRaise, queuesBehind, workNeeded, workOfPlenty } from '../src/sim/aiworks';
import { run, setups, spot, villagers } from './helpers';

const LONG = 120_000;
const town = (g: Game, more: Partial<{ villagers: number; peace: boolean }> = {}) => {
  const home = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
  return { villagers: villagers(g, 1).length, peace: false, home, ...more };
};
const rich = (g: Game) => { g.players[1].res = { food: 9000, wood: 9000, gold: 9000, stone: 9000 }; };
const raise = (g: Game, type: string) => { const at = spot(g, type, 1); return g.spawnBuilding(type, 1, at.cx, at.cy, true); };

describe('what a town has a use for', () => {
  it('a town with nothing wrong and nothing to spare wants none of them', () => {
    const g = new Game(7, setups);
    g.players[1].age = 2;
    expect(workNeeded(g, 1, town(g))).toBeNull();
    g.players[1].res = { food: 200, wood: 200, gold: 0, stone: 0 };
    expect(workOfPlenty(g, 1, town(g))).toBeNull();
  });

  it('a Granary in a hungry town', () => {
    const g = new Game(7, setups);
    rich(g);
    expect(hasUseFor(g, 1, 'granary', town(g))).toBe(false);
    g.players[1].hunger = 5;
    expect(workNeeded(g, 1, town(g))).toBe('granary');
    raise(g, 'granary');
    expect(mayRaise(g, 1, 'granary')).toBe(false); // one is enough
    expect(workNeeded(g, 1, town(g))).toBeNull();
    // It cannot pay: it waits.
    const h = new Game(7, setups);
    h.players[1].starved = 2;
    h.players[1].res = { food: 0, wood: BUILDINGS.granary.cost.wood! + WORKS.need.wood - 1, gold: 0, stone: 0 };
    expect(hasUseFor(h, 1, 'granary', town(h))).toBe(true);
    expect(workNeeded(h, 1, town(h))).toBeNull();
    h.players[1].res.wood += 1; // its bread is not asked for: a hungry town has none
    expect(workNeeded(h, 1, town(h))).toBe('granary');
  });

  it('an Infirmary where plague is, and a Well where it has been or the town is crowded', () => {
    const g = new Game(7, setups);
    rich(g); g.players[1].age = 1;
    expect(workNeeded(g, 1, town(g))).toBeNull();
    villagers(g, 1)[0].plagueT = 30;
    g.players[1].plagueAt = g.time + 1;
    expect(workNeeded(g, 1, town(g))).toBe('infirmary');
    raise(g, 'infirmary');
    expect(workNeeded(g, 1, town(g))).toBe('well');
    const h = new Game(7, setups);
    rich(h);
    expect(hasUseFor(h, 1, 'well', town(h))).toBe(false);
    expect(hasUseFor(h, 1, 'well', town(h, { villagers: WORKS.crowded }))).toBe(true);
  });

  it('a Watch House when something of its own burns, and a Fortress when it has been attacked at home', () => {
    const g = new Game(7, setups);
    rich(g); g.players[1].age = 1;
    const home = town(g).home;
    home.burnT = 10;
    expect(workNeeded(g, 1, town(g))).toBe('watchhouse');
    home.burnT = 0;
    g.players[1].lastAttacked = { x: home.x + 3, y: home.y, t: g.time };
    expect(workNeeded(g, 1, town(g))).toBe('fortress');
    expect(workNeeded(g, 1, town(g, { peace: true }))).toBeNull(); // a town kept in peace raises no stronghold
    g.players[1].lastAttacked = { x: home.x + 60, y: home.y, t: g.time }; // far from home: not its town that was struck
    expect(workNeeded(g, 1, town(g))).toBeNull();
  });

  it('the building\'s own rules stand: its age, its creed, the size of its town', () => {
    const g = new Game(7, setups);
    rich(g);
    g.players[1].lastAttacked = { x: town(g).home.x, y: town(g).home.y, t: g.time };
    expect(BUILDINGS.fortress.age).toBeGreaterThan(g.players[1].age);
    expect(workNeeded(g, 1, town(g))).toBeNull(); // too early an age for a Fortress
    g.players[1].age = 2;
    g.players[1].virtue = 0;
    expect(mayRaise(g, 1, 'monastery')).toBe(false); // only a town that keeps the faith
    g.players[1].virtue = 100;
    expect(mayRaise(g, 1, 'monastery')).toBe(true);
    expect(villagers(g, 1).length).toBeLessThan(BUILDINGS.manor.townAt!);
    expect(mayRaise(g, 1, 'manor')).toBe(false); // too small a town for a lord's house
  });

  it('out of plenty: a Mill with fields, a Hall in a grown town, an Inn with a market; never on a bare treasury', () => {
    const g = new Game(7, setups);
    g.players[1].age = 2;
    rich(g);
    expect(workOfPlenty(g, 1, town(g))).toBeNull(); // no fields, a small town, no market
    for (let i = 0; i < WORKS.fields; i++) raise(g, 'farm');
    expect(workOfPlenty(g, 1, town(g))).toBe('mill');
    raise(g, 'mill');
    expect(workOfPlenty(g, 1, town(g, { villagers: WORKS.grown }))).toBe('hall');
    raise(g, 'hall');
    raise(g, 'market');
    expect(workOfPlenty(g, 1, town(g, { villagers: WORKS.grown }))).toBe('inn');
    const c = BUILDINGS.inn.cost;
    g.players[1].res = { food: 150, wood: (c.wood ?? 0) * WORKS.plenty + 100, gold: (c.gold ?? 0) * WORKS.plenty - 1, stone: 0 }; // a coin short of plenty
    expect(workOfPlenty(g, 1, town(g, { villagers: WORKS.grown }))).toBeNull();
  });

  it('every building it decides on is one the game has, and the lists do not overlap', () => {
    for (const t of [...NEEDED, ...OF_PLENTY]) expect(BUILDINGS[t], t).toBeTruthy();
    expect(NEEDED.filter((t) => OF_PLENTY.includes(t))).toEqual([]);
  });

  it('a nation\'s study is queued behind a busy building, two at the most; another upgrade is not', () => {
    const study = Object.keys(TECHS).find((id) => TECHS[id].answers && !TECHS[id].civ)!;
    const plain = Object.keys(TECHS).find((id) => !TECHS[id].answers)!;
    expect(queuesBehind(study, 1)).toBe(true);
    expect(queuesBehind(study, WORKS.queue)).toBe(false);
    expect(queuesBehind(plain, 1)).toBe(false);
  });
});

describe('the computer in a battle', () => {
  it('raises a Granary when its store has stood bare', () => {
    const g = new Game(7, setups);
    rich(g);
    g.players[1].starved = 1; // people have starved here
    const ai = new AIController(g, 1);
    run(g, 90, () => ai.update());
    expect(g.buildings.some((b) => b.owner === 1 && b.type === 'granary')).toBe(true);
  }, LONG);

  it('and builds none of them in a town with nothing wrong and little to spare', () => {
    const g = new Game(7, setups);
    const ai = new AIController(g, 1);
    run(g, 120, () => ai.update());
    for (const t of [...NEEDED, ...OF_PLENTY]) expect(g.buildings.some((b) => b.owner === 1 && b.type === t), t).toBe(false);
  }, LONG);
});
