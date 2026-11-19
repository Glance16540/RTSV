// Monks and nuns at their work (src/sim/clergywork.ts).
import { describe, expect, it } from 'vitest';
import { MONKS, NUNS, clergyOf, monksTeach, nunsNurse } from '../src/sim/clergywork';
import { Game } from '../src/sim/game';
import { setups, spot, villagers } from './helpers';

const serving = (g: Game, type: string, sexes: ('m' | 'f')[]) => {
  const at = spot(g, type, 0), b = g.spawnBuilding(type, 0, at.cx, at.cy, true);
  b.staff = sexes.map((s) => g.spawnUnit('villager', 0, at.cx, at.cy, s).id);
  return b;
};

describe('monks and nuns', () => {
  it('are counted by who serves a Church or a Monastery, not a Tavern', () => {
    const g = new Game(4, setups, 72);
    serving(g, 'temple', ['m', 'f', 'f']);
    serving(g, 'tavern', ['f', 'm']);
    expect(clergyOf(g, 0)).toEqual({ monks: 1, nuns: 2, infirmary: false });
    expect(clergyOf(g, 1)).toEqual({ monks: 0, nuns: 0, infirmary: false });
  });

  it('nuns nurse the sick where an Infirmary stands, up to a limit; monks do not', () => {
    const g = new Game(4, setups, 72);
    serving(g, 'temple', ['f', 'f', 'm', 'm']);
    expect(nunsNurse(g, 0)).toBe(1); // nowhere to nurse them
    const at = spot(g, 'infirmary', 0);
    g.spawnBuilding('infirmary', 0, at.cx, at.cy, true);
    g.tick++;
    expect(nunsNurse(g, 0)).toBeCloseTo(1 - 2 * NUNS.each);
    serving(g, 'temple', ['f', 'f', 'f', 'f', 'f', 'f']);
    g.tick++;
    expect(nunsNurse(g, 0)).toBeCloseTo(1 - NUNS.most);
  });

  it('monks copy and teach: research goes faster, up to a limit; nuns do not speed it', () => {
    const g = new Game(4, setups, 72);
    expect(monksTeach(g, 0)).toBe(1);
    serving(g, 'temple', ['f', 'f', 'f']);
    g.tick++;
    expect(monksTeach(g, 0)).toBe(1);
    serving(g, 'temple', ['m', 'm']);
    g.tick++;
    expect(monksTeach(g, 0)).toBeCloseTo(1 + 2 * MONKS.each);
    serving(g, 'temple', ['m', 'm', 'm', 'm', 'm', 'm', 'm', 'm']);
    g.tick++;
    expect(monksTeach(g, 0)).toBeCloseTo(1 + MONKS.most);
    void villagers;
  });
});
