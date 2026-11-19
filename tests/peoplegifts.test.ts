// Two peoples' gifts trimmed after a round of all fifteen (src/sim/data.ts CIVS.wild, CIVS.greece; game.ts findEnemy).
// The Norse won four decided games in five against the other fourteen peoples' computers, and Greece nearly three
// in four; what was taken away is checked here, and that what is left is still theirs.
import { describe, expect, it } from 'vitest';
import { CIVS, UNITS, baseMods, styleOf } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { run } from './helpers';

describe('the Norse', () => {
  it('gather from the wild no faster than anyone, and pay for hounds and mammoths what anyone pays', () => {
    const plain = baseMods(), m = baseMods();
    CIVS.wild.apply(m);
    expect(m.hunt).toBe(plain.hunt);
    expect(m.beastCost).toBe(plain.beastCost);
    expect(CIVS.wild.bonuses.join(' ')).not.toMatch(/50% faster|25% less|wolves never/);
  });
  it('are raiders still, and their own two units still cost food alone', () => {
    expect(styleOf('wild').raid).toBe(true);
    expect(CIVS.wild.unique).toBe('wolfrider');
    expect(CIVS.wild.unique2).toBe('warbear');
    expect(UNITS.wolfrider.cost).toEqual({ food: 75 });
    expect(UNITS.warbear.cost).toEqual({ food: 130 });
    expect(CIVS.wild.bonuses).toContain('Their Wolf Riders and War Bears cost food alone');
  });
  it('are attacked by wild wolves, as their neighbours are', () => {
    const g = new Game(3, [{ name: 'A', color: 1, isAI: false, civ: 'wild' }, { name: 'B', color: 2, isAI: true, civ: 'stonekin' }]);
    const wolf = g.units.find((u) => u.type === 'wolf')!;
    const norse = g.spawnUnit('villager', 0, wolf.x + 1.5, wolf.y, 'm'), other = g.spawnUnit('villager', 1, wolf.x - 1.5, wolf.y, 'm');
    g.aging = false;
    run(g, 12);
    expect(norse.hp < norse.maxHp || norse.dead || other.hp < other.maxHp || other.dead).toBe(true);
    // And a Norse soldier beside a wolf fights it: nobody stands idle next to one.
    const g2 = new Game(3, [{ name: 'A', color: 1, isAI: false, civ: 'wild' }, { name: 'B', color: 2, isAI: true, civ: 'stonekin' }]);
    const w2 = g2.units.find((u) => u.type === 'wolf')!, hp = w2.hp;
    g2.spawnUnit('clubman', 0, w2.x + 1, w2.y); g2.spawnUnit('clubman', 0, w2.x - 1, w2.y);
    g2.aging = false;
    run(g2, 12);
    expect(w2.dead || w2.hp < hp).toBe(true);
  });
});

describe('the Greeks', () => {
  it('pay for research what anyone pays, and their soldiers have no more armour than anyone\'s', () => {
    const plain = baseMods(), m = baseMods();
    CIVS.greece.apply(m);
    expect(m.techCost).toBe(plain.techCost);
    expect(m.armor).toBe(plain.armor);
    expect(CIVS.greece.bonuses.join(' ')).not.toMatch(/Research costs|more armour/);
  });
  it('are scholars still, with their own two units as they were', () => {
    const g = new Game(3, [{ name: 'A', color: 1, isAI: false, civ: 'greece' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
    expect(g.style(0)).toBe('scholar');
    expect(g.lore(0)).toBeGreaterThan(1);
    expect(UNITS.hoplite.rangedResist).toBe(0.35);
    expect(UNITS.hoplite.armor).toBe(2);
    expect(UNITS.companion.charge).toBe(2.2);
  });
});

describe('the English', () => {
  it('gather 5% faster, beside their farms and their towers', () => {
    const plain = baseMods(), m = baseMods();
    CIVS.england.apply(m);
    expect(m.gather).toBeCloseTo(plain.gather * 1.05, 10);
    expect(m.farm).toBe(1.1);
    expect(m.towerAtk).toBe(plain.towerAtk + 3);
    expect(CIVS.england.bonuses).toContain('Villagers gather 5% faster');
  });
});
