// The Town Center clock shows whoever the rule has a clock running for, and the seconds the rule gives them.
import { describe, expect, it } from 'vitest';
import { hallClocks } from '../src/client/hallclock';
import { HALL_GRACE } from '../src/sim/beaten';
import { Game } from '../src/sim/game';
import { run, setups, spot } from './helpers';

const hall = (g: Game, owner: number) => g.buildings.find((b) => b.owner === owner && b.type === 'towncenter')!;
/** A match in which both peoples have a barracks and a guard besides their hall, so that losing the hall is not losing everything. */
const match = () => {
  const g = new Game(5, setups, 72);
  for (const o of [0, 1]) {
    const at = spot(g, 'barracks', o);
    g.spawnBuilding('barracks', o, at.cx, at.cy, true);
    for (let i = 0; i < 3; i++) g.spawnUnit('clubman', o, hall(g, o).x + 4 + i, hall(g, o).y + 5);
  }
  run(g, 2);
  return g;
};
const fell = (g: Game, owner: number) => (g as unknown as { kill(e: unknown): void }).kill(hall(g, owner));

describe('the Town Center clock', () => {
  it('shows nothing while every people has its hall', () => {
    const g = new Game(5, setups);
    run(g, 3);
    expect(hallClocks(g, 0)).toEqual([]);
  });

  it('runs for the player whose last Town Center has fallen, from the time the rule allows', () => {
    const g = match();
    fell(g, 0);
    run(g, 2);
    const mine = hallClocks(g, 0).find((c) => c.mine)!;
    expect(mine, 'a clock for the player').toBeTruthy();
    expect(mine.left).toBeGreaterThan(HALL_GRACE - 6);
    expect(mine.left).toBeLessThanOrEqual(HALL_GRACE);
    const before = mine.left;
    run(g, 10);
    expect(hallClocks(g, 0).find((c) => c.mine)!.left).toBeLessThanOrEqual(before - 9);
  });

  it('shows a rival\'s clock to their enemy, marked as a foe\'s, and puts your own first', () => {
    const g = match();
    fell(g, 1);
    run(g, 2);
    const seen = hallClocks(g, 0);
    expect(seen.map((c) => [c.id, c.foe, c.mine])).toEqual([[1, true, false]]);
    fell(g, 0);
    run(g, 2);
    expect(hallClocks(g, 0)[0].mine).toBe(true);
  });

  it('is put away once the battle is decided', () => {
    const g = match();
    fell(g, 1);
    run(g, 2);
    g.winner = 0;
    expect(hallClocks(g, 0)).toEqual([]);
  });
});
