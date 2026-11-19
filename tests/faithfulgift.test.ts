// The Faithful's one gift that is not to their clergy: their villagers gather a little faster (src/sim/data.ts, CIVS.dawn).
import { describe, expect, it } from 'vitest';
import { CIVS, CIV_STYLE, baseMods } from '../src/sim/data';
import { Game } from '../src/sim/game';

describe('the Arameans, who are the Faithful', () => {
  it('gather 5% faster, and are told so with their other gifts', () => {
    const plain = baseMods(), m = baseMods();
    CIVS.dawn.apply(m);
    expect(m.gather).toBeCloseTo(plain.gather * 1.05, 10);
    expect(CIVS.dawn.bonuses).toContain('Villagers gather 5% faster');
    expect(CIV_STYLE.dawn).toBe('faithful');
  });
  it('keep the gifts to their clergy as they were', () => {
    const m = baseMods();
    CIVS.dawn.apply(m);
    expect(m.clergyCost).toBe(0.75);
    expect(m.faith).toBe(1.5);
    expect(m.heal).toBeCloseTo(baseMods().heal + 0.3, 10);
  });
  it('in a battle their people have it, and nobody else\'s gathering is changed by it', () => {
    const g = new Game(3, [{ name: 'A', color: 1, isAI: true, civ: 'dawn' }, { name: 'B', color: 2, isAI: true, civ: 'stonekin' }]);
    const other = baseMods(); CIVS.stonekin.apply(other);
    expect(g.players[0].mods.gather).toBeCloseTo(baseMods().gather * 1.05, 10);
    expect(g.players[1].mods.gather).toBeCloseTo(other.gather, 10);
  });
});
