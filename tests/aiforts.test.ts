// The computer treats a shooting Fortress as it treats a tower: its raiders keep clear of one, and it counts one in a defence (src/sim/aiforts.ts).
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { AIFORTS, defenceWorth, keepsClear, shootsAlone } from '../src/sim/aiforts';
import { BUILDINGS } from '../src/sim/data';
import { Game } from '../src/sim/game';

const game = () => {
  const g = new Game(5, [{ name: 'A', color: 1, isAI: true, civ: 'wild' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
  for (const q of g.players) q.dilemmaT = 1e9;
  const tc = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
  const put = (type: string, dx: number, done = true) => g.spawnBuilding(type, 1, Math.floor(tc.x) + dx, Math.floor(tc.y) + 6, done);
  return { g, tc, put };
};

describe('which works shoot, and how far a raiding party keeps from them', () => {
  it('a Fortress shoots from its walls as a Watch Tower does', () => {
    const { put } = game();
    const tower = put('tower', -8), fort = put('fortress', 4);
    expect(BUILDINGS.fortress.atk).toBe(BUILDINGS.tower.atk);
    expect(shootsAlone(tower)).toBe(true);
    expect(shootsAlone(fort)).toBe(true);
  });
  it('a raider\'s mark must stand beyond its reach and one more, the same for both; a Town Center only once the foe has soldiers', () => {
    const { tc, put } = game();
    const tower = put('tower', -8), fort = put('fortress', 4);
    expect(keepsClear(tower, false)).toBe(BUILDINGS.tower.range! + AIFORTS.clear);
    expect(keepsClear(fort, false)).toBe(BUILDINGS.fortress.range! + AIFORTS.clear);
    expect(keepsClear(fort, true)).toBe(keepsClear(fort, false)); // feared even in the raiders' hour, as a tower is
    expect(keepsClear(tc, false)).toBe(AIFORTS.hall);
    expect(keepsClear(tc, true)).toBe(0);
  });
  it('one not yet built is nothing to anybody, and a house is nothing ever', () => {
    const { put } = game();
    const half = put('fortress', 4, false), house = put('house', -6);
    expect(keepsClear(half, false)).toBe(0);
    expect(defenceWorth(half)).toBe(0);
    expect(keepsClear(house, false)).toBe(0);
    expect(defenceWorth(house)).toBe(0);
  });
});

describe('what a Fortress is worth to a defence', () => {
  it('more than a tower or a Town Center', () => {
    const { tc, put } = game();
    expect(defenceWorth(put('tower', -8))).toBe(AIFORTS.tower);
    expect(defenceWorth(tc)).toBe(AIFORTS.towncenter);
    expect(defenceWorth(put('fortress', 4))).toBe(AIFORTS.fortress);
    expect(AIFORTS.fortress).toBeGreaterThan(AIFORTS.towncenter);
  });
  it('the computer weighing a foe that stands to defend counts its Fortress, and not when it marches', () => {
    const { g, put } = game();
    const ai = new AIController(g, 0) as unknown as { weight(pid: number, defending: boolean): number };
    const before = ai.weight(1, true), marching = ai.weight(1, false);
    put('fortress', 4);
    expect(ai.weight(1, true)).toBe(before + AIFORTS.fortress);
    expect(ai.weight(1, false)).toBe(marching);
  });
});
