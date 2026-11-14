// A computer player whose town has no room left near its Town Center builds further out instead of not at all.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game } from '../src/sim/game';
import { run, setups } from './helpers';

describe('the computer player in a crowded town', () => {
  it('finds ground further out for what it needs next', () => {
    const g = new Game(5, setups, 96);
    const home = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    // A post on every other cell for sixteen tiles around: nothing bigger than a post fits, but people can walk.
    for (let y = Math.floor(home.y) - 16; y <= home.y + 16; y++)
      for (let x = Math.floor(home.x) - 16; x <= home.x + 16; x++)
        if (x % 2 === 0 && y % 2 === 0 && Math.hypot(x - home.x, y - home.y) <= 16 && g.canPlace('palisade', x, y)) g.spawnBuilding('palisade', 1, x, y, true);
    const p = g.players[1];
    p.res = { food: 2000, wood: 2000, gold: 2000, stone: 2000 };
    const before = new Set(g.buildings.map((b) => b.id));
    const ai = new AIController(g, 1);
    ai.setLevel(1);
    for (let s = 0; s < 180; s++) { run(g, 1); ai.update(); }
    const built = g.buildings.filter((b) => b.owner === 1 && !before.has(b.id) && !b.def.wall && b.type !== 'farm');
    expect(built.length).toBeGreaterThan(0);
    for (const b of built) expect(Math.hypot(b.x - home.x, b.y - home.y)).toBeGreaterThan(13);
  });
});
