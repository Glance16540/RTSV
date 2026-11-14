// The computer player, left without a Town Center by an earlier siege, raises one again before anything else.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';

describe('the computer player re-founds a razed town', () => {
  it('builds a new Town Center first and has a hall again within a few minutes', () => {
    const fresh = new Game(5, setups, 72);
    const at = spot(fresh, 'barracks', 1);
    const g = new Game(5, [setups[0], { ...setups[1], bonus: { town: [['barracks', at.cx, at.cy]] } }], 72);
    const halls = () => g.buildings.filter((b) => b.owner === 1 && b.type === 'towncenter');
    expect(halls()).toHaveLength(0);
    const ai = new AIController(g, 1);
    ai.setLevel(1);
    const start = g.units.filter((u) => u.owner === 1 && u.type === 'villager').length;
    let begun = -1, first: string[] = [];
    for (let s = 0; s < 420; s++) {
      for (let i = 0; i < 20; i++) g.step();
      g.events.length = 0;
      ai.update();
      if (begun < 0 && halls().length) { begun = s; first = g.buildings.filter((b) => b.owner === 1 && b.type !== 'towncenter').map((b) => b.type); }
    }
    expect(begun).toBeGreaterThanOrEqual(0);
    expect(begun).toBeLessThan(200); // every hand went to wood and stone: it does not take the whole battle
    // Short of stone and with nowhere to bring it, it built a storehouse and nothing else before the hall.
    expect(first.sort()).toEqual(['barracks', 'storehouse']);
    expect(halls()[0].complete).toBe(true);
    expect(g.units.filter((u) => u.owner === 1 && u.type === 'villager').length).toBeGreaterThan(start);
  });
});
