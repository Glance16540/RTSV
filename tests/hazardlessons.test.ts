// Lessons for what befalls a battle from outside: plague, a storm, marauders, a rival's Wonder, the leader's powers.
import { describe, expect, it } from 'vitest';
import { CALAMITY, WONDER_TIME } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { hazardLessons, hazardsDue, MARAUDER_NEAR } from '../src/sim/hazardlessons';
import { lessons, lessonsDue, nextLesson } from '../src/sim/lessons';
import { run, setups, spot } from './helpers';

const start = (field = false) => {
  const g = new Game(5, setups, 72, field);
  if (field) for (const o of [0, 1]) g.spawnUnit('swordsman', o, 20 + o * 30, 36); // a field battle is two armies, and nothing else
  run(g, 1);
  return g;
};

describe('lessons for what befalls a battle', () => {
  it('falls due for plague among your own, and not for plague among theirs', () => {
    const g = start();
    g.units.find((u) => u.owner === 1)!.plagueT = 10;
    expect(hazardsDue(g, 0)).toEqual([]);
    g.units.find((u) => u.owner === 0)!.plagueT = 10;
    expect(hazardsDue(g, 0)).toEqual(['plague']);
    expect(nextLesson(g, 0, [])!.title).toBe('Plague among your people');
  });

  it('tells a storm by what it is, with the harvest numbers from the rules', () => {
    const g = start();
    g.weather = 'snow'; g.weatherAmt = 1;
    expect(hazardsDue(g, 0)).toEqual(['storm']);
    const snow = nextLesson(g, 0, [])!;
    expect(snow.text).toMatch(/Snow is down/);
    expect(snow.text).toContain(`${Math.round((1 - CALAMITY.harvest.snow) * 100)}% less`);
    g.weather = 'dust';
    expect(nextLesson(g, 0, [])!.text).toMatch(/dust storm/);
    g.weatherAmt = 0.1; // a light shower is not a storm
    expect(hazardsDue(g, 0)).toEqual([]);
  });

  it('warns of a rival Wonder once it stands, with the time it must stand', () => {
    const g = start();
    const at = spot(g, 'wonder', 1);
    const w = g.spawnBuilding('wonder', 1, at.cx, at.cy, true)!;
    w.doneAt = g.time;
    expect(hazardsDue(g, 0)).toEqual(['wonder']);
    expect(hazardsDue(g, 1)).toEqual([]); // their own Wonder is no warning to them
    expect(nextLesson(g, 0, [])!.text).toContain(`${Math.round(WONDER_TIME / 60)} minutes`);
  });

  it('warns of marauders only once they come near', () => {
    const g = start();
    const mine = g.units.find((u) => u.owner === 0)!;
    const m = g.spawnUnit('marauder', 1, mine.x + MARAUDER_NEAR + 15, mine.y, 'm');
    m.x = Math.min(g.size - 1, mine.x + MARAUDER_NEAR + 15);
    const far = hazardsDue(g, 0).includes('marauders');
    m.x = mine.x + 2; m.y = mine.y;
    expect(hazardsDue(g, 0)).toContain('marauders');
    expect(far).toBe(g.buildings.some((b) => b.owner === 0 && Math.hypot(b.x - m.x - MARAUDER_NEAR - 13, b.y - m.y) <= MARAUDER_NEAR));
  });

  it('tells the leader they have a power to choose', () => {
    const g = start();
    const mine = g.units.find((u) => u.owner === 0)!;
    const w = g.spawnUnit('warlord', 0, mine.x, mine.y);
    expect(hazardsDue(g, 0)).toEqual([]); // untried: nothing to choose yet
    w.hero = { xp: 6, rank: 1 };
    expect(hazardsDue(g, 0)).toEqual(['power']);
    expect(nextLesson(g, 0, [])!.title).toBe('Your leader has a power to choose');
  });

  it('is told in a field battle too, where the town\'s lessons are not', () => {
    const g = start(true);
    g.weather = 'rain'; g.weatherAmt = 1;
    g.players[0].lastAttacked = { x: 1, y: 1, t: g.time };
    expect(lessonsDue(g, 0)).toEqual(['storm']);
  });

  it('ranks behind fire and hunger and the walls, and every lesson has words', () => {
    const ids = lessons().map((l) => l.id);
    expect(ids.indexOf('wonder')).toBeGreaterThan(ids.indexOf('hungry'));
    for (const l of hazardLessons()) { expect(l.text.length).toBeGreaterThan(80); expect(l.text).not.toMatch(/undefined|NaN/); }
    for (const f of ['rain', 'snow', 'dust'] as const) expect(hazardLessons(f).find((l) => l.id === 'storm')!.text).not.toMatch(/undefined|NaN/);
  });
});

describe('lessons for what is done to a people', () => {
  it('tells how to get back one carried off, while they are led away', () => {
    const g = start();
    const v = g.units.find((u) => u.owner === 0 && u.type === 'villager')!;
    const s = g.spawnUnit('swordsman', 1, v.x + 3, v.y);
    s.captive = { from: 0, people: '', name: v.name, family: v.family, gender: 'm', trait: '', trait2: '', age: 20, lifespan: 60, taken: g.time } as never;
    expect(hazardsDue(g, 0)).toEqual(['taken']);
    expect(hazardsDue(g, 1)).toEqual([]);
    expect(nextLesson(g, 0, [])!.text).toMatch(/\d+ minutes they are lost for good/);
  });

  it('warns of a rival Prophet once he comes near, and of no Prophet of your own', () => {
    const g = start();
    const mine = g.units.find((u) => u.owner === 0)!;
    const own = g.spawnUnit('prophet', 0, mine.x, mine.y);
    expect(hazardsDue(g, 0)).toEqual([]);
    own.dead = true;
    const theirs = g.spawnUnit('prophet', 1, mine.x + 4, mine.y);
    expect(hazardsDue(g, 0)).toEqual(['prophet']);
    expect(nextLesson(g, 0, [])!.text).toContain(`${theirs.def.hp} health`);
  });

  it('tells of the leader fallen until another is raised, and of a dilemma waiting', () => {
    const g = start();
    g.players[0].heroFell = true;
    expect(hazardsDue(g, 0)).toEqual(['fallen']);
    const mine = g.units.find((u) => u.owner === 0)!;
    const w = g.spawnUnit('swordsman', 0, mine.x, mine.y);
    w.hero = { xp: 0, rank: 0 };
    expect(hazardsDue(g, 0)).toEqual([]);
    g.players[0].dilemma = 'harvest';
    expect(hazardsDue(g, 0)).toEqual(['dilemma']);
    for (const l of hazardLessons()) expect(l.text).not.toMatch(/undefined|NaN/);
  });
});
