// A people is beaten when its last Town Center has fallen and it has not begun another in time (src/sim/beaten.ts).
import { describe, expect, it } from 'vitest';
import { HALL_GRACE, ROUT_GRACE, RAZED_GRACE, hallClock, hallLeft } from '../src/sim/beaten';
import type { HallState } from '../src/sim/beaten';
import { Game } from '../src/sim/game';
import { run, setups, spot } from './helpers';

const kill = (g: Game, e: unknown) => (g as unknown as { kill(e: unknown): void }).kill(e);
const hall = (g: Game, owner: number) => g.buildings.find((b) => b.owner === owner && b.type === 'towncenter')!;
/** A match in which the second people has a barracks and a guard besides its hall. */
const match = (guards = 3) => {
  const g = new Game(5, setups, 72);
  const at = spot(g, 'barracks', 1);
  g.spawnBuilding('barracks', 1, at.cx, at.cy, true);
  for (let i = 0; i < guards; i++) g.spawnUnit('clubman', 1, hall(g, 1).x + 4 + i, hall(g, 1).y + 5);
  run(g, 2);
  return g;
};

describe('the clock on a people with no Town Center', () => {
  it('starts when the last one falls, stops when another is begun, and runs out', () => {
    const p: HallState = {};
    expect(hallClock(p, false, 0, 1)).toBe('fine'); // a band that never had one has nothing to lose
    expect(hallClock(p, true, 1, 1)).toBe('fine');
    expect(hallClock(p, false, 10, 1)).toBe('lost');
    expect(hallLeft(p, 10)).toBe(HALL_GRACE);
    expect(hallClock(p, false, 10 + HALL_GRACE - 60, 1)).toBe('warn');
    expect(hallClock(p, false, 10 + HALL_GRACE - 59, 1)).toBe('fine');
    expect(hallClock(p, true, 50, 1)).toBe('raised');
    expect(hallLeft(p, 50)).toBe(-1);
    expect(hallClock(p, false, 60, 1)).toBe('lost');
    expect(hallClock(p, false, 60 + HALL_GRACE, 1)).toBe('beaten');
  });

  it('is cut short for a people with no soldier left, but not for a town that began the battle razed', () => {
    const p: HallState = { hadHall: true };
    expect(hallClock(p, false, 0, 1, false)).toBe('lost');
    expect(hallClock(p, false, 5, 1, true)).toBe('warn');
    expect(hallLeft(p, 5)).toBe(ROUT_GRACE);
    expect(hallClock(p, false, 5 + ROUT_GRACE, 1, true)).toBe('beaten');
    const q: HallState = { hadHall: true, hallDue: RAZED_GRACE, razedStart: true };
    expect(hallClock(q, false, 30, 1, true)).toBe('fine');
    expect(hallLeft(q, 30)).toBe(RAZED_GRACE - 30);
  });
});

describe('a people is beaten with its Town Center', () => {
  it('holds on for the grace it has, then falls with its other buildings still standing', () => {
    const g = match();
    kill(g, hall(g, 1));
    run(g, HALL_GRACE - 5);
    expect(g.players[1].defeated).toBe(false);
    expect(g.winner).toBe(-1);
    run(g, 8);
    expect(g.players[1].defeated).toBe(true);
    expect(g.winner).toBe(0);
    expect(g.buildings.some((b) => b.owner === 1 && b.type === 'barracks')).toBe(true);
  });

  it('is saved by beginning another, even one not yet built', () => {
    const g = match();
    const where = { cx: hall(g, 1).cx, cy: hall(g, 1).cy };
    kill(g, hall(g, 1));
    run(g, 30);
    expect(g.players[1].hallDue).toBeDefined();
    g.spawnBuilding('towncenter', 1, where.cx, where.cy, false);
    run(g, HALL_GRACE + 30);
    expect(g.players[1].defeated).toBe(false);
    expect(g.players[1].hallDue).toBeUndefined();
  });

  it('falls in seconds when it has no soldier left', () => {
    const g = match(0);
    kill(g, hall(g, 1));
    run(g, ROUT_GRACE - 5);
    expect(g.players[1].defeated).toBe(false);
    run(g, 8);
    expect(g.players[1].defeated).toBe(true);
  });

  it('a war band that has never raised a hall is not on the clock, and one that has is', () => {
    const g = new Game(5, [setups[0], { name: 'Band', color: 2, isAI: true, civ: 'wild' }], 72);
    expect(g.raider(1)).toBe(true);
    run(g, HALL_GRACE + 20);
    expect(g.players[1].defeated).toBe(false);
    const st = g.spec.starts[1];
    const h = g.spawnBuilding('towncenter', 1, st.x - 2, st.y - 2, true);
    run(g, 2);
    kill(g, h);
    run(g, HALL_GRACE + 5);
    expect(g.players[1].defeated).toBe(true);
  });
});
