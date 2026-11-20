// A lean season for a town that lives by hunting, fishing or its herds (src/sim/leanwild.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { FAMINE } from '../src/sim/famine';
import { LEAN_WILD, leanWild, wildPace } from '../src/sim/leanwild';
import { setups, spot } from './helpers';

/** Seconds of leanWild until player 0 is struck, at most `most`. */
const strike = (g: Game, most = 200000): number => { for (let i = 0; i < most; i++) { g.time += 1; g.tick++; if (leanWild(g).includes(0)) return i; } return -1; };

describe('a lean season', () => {
  it('comes by chance to a town with no farm, after its first stretch, and halves its hunters and fishers', () => {
    const g = new Game(5, setups);
    g.time = 0;
    for (let i = 0; i < FAMINE.lean - 1; i++) { g.time = i; expect(leanWild(g)).toEqual([]); }
    g.time = FAMINE.lean;
    expect(strike(g)).toBeGreaterThanOrEqual(0);
    expect(g.players[0].leanT).toBeGreaterThan(0);
    for (const k of ['carcass', 'fish', 'berries']) expect(wildPace(g, 0, k)).toBe(LEAN_WILD.pace);
    for (const k of ['farm', 'tree', 'gold', 'stone']) expect(wildPace(g, 0, k)).toBe(1);
    expect(wildPace(g, 1, 'fish')).toBe(1);
  });

  it('runs down and ends', () => {
    const g = new Game(5, setups);
    g.players[0].leanT = 3;
    leanWild(g); leanWild(g); leanWild(g);
    expect(g.players[0].leanT).toBe(0);
    expect(wildPace(g, 0, 'fish')).toBe(1);
  });

  it('never for a town with a farm standing: that is the fields\' to fail', () => {
    const g = new Game(5, setups);
    const at = spot(g, 'farm', 0);
    g.spawnBuilding('farm', 0, at.cx, at.cy, true);
    g.time = FAMINE.lean;
    expect(strike(g, 60000)).toBe(-1);
  });
});
