// The computer player calls working villagers to a fire in its town.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { sentTo } from '../src/sim/calamity';
import { Game } from '../src/sim/game';
import { run, setups, spot } from './helpers';

const town = () => {
  const g = new Game(5, setups, 72);
  const ai = new AIController(g, 1);
  ai.setLevel(1);
  for (let s = 0; s < 20; s++) { run(g, 1); ai.update(); } // everyone has found work
  const at = spot(g, 'house', 1);
  const house = g.spawnBuilding('house', 1, at.cx, at.cy, true);
  house.hp = Math.round(house.maxHp * 0.6);
  house.burnT = 30;
  return { g, ai, house };
};

describe('the computer player and a fire in its town', () => {
  it('sends working villagers to it', () => {
    const { g, ai, house } = town();
    expect(g.units.filter((u) => u.owner === 1 && u.type === 'villager' && !u.order).length).toBe(0);
    expect(sentTo(g, house)).toBe(0);
    ai.update();
    expect(sentTo(g, house)).toBeGreaterThan(0);
  });

  it('leaves it while the town bell is rung', () => {
    const { g, ai, house } = town();
    g.players[1].bell = true;
    g.players[1].lastAttacked = { x: house.x, y: house.y, t: g.time };
    ai.update();
    expect(sentTo(g, house)).toBe(0);
  });
});
