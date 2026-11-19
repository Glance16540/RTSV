// The computer knows its people's captivity is on a clock, in a town (src/sim/aicaptives.ts, read by aicare.ts).
import { describe, expect, it } from 'vitest';
import { AICARE, mountRescue } from '../src/sim/aicare';
import { AICLOCK, heldFirst, keepCamps } from '../src/sim/aicaptives';
import { CAPTIVE_HOLD } from '../src/sim/captivity';
import { Game } from '../src/sim/game';
import type { Building } from '../src/sim/game';
import { rescueForce } from '../src/sim/rescue';

const game = () => {
  const g = new Game(5, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
  const p = g.players[0];
  p.age = 2; p.virtue = -80; p.popCap = 40;
  for (const q of g.players) q.dilemmaT = 1e9;
  g.time = 1000;
  return g;
};
/** A Work Camp of town 0, `dx` from its Town Center, holding `held` of town 1's people, seized `ago` seconds since. */
const camp = (g: Game, dx: number, held: number, ago: number): Building => {
  const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
  const b = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) + dx, Math.floor(tc.y) + 3, true);
  b.captives = Array.from({ length: held }, (_, i) => ({ from: 1, name: 'Held' + i, family: '', gender: i % 2 ? 'f' as const : 'm' as const, trait: '', trait2: '', age: 0, lifespan: 9999, taken: g.time - ago }));
  return b;
};
const soldiers = (g: Game, owner: number, n: number, near?: Building) => {
  const at = near ?? g.buildings.find((b) => b.owner === owner && b.type === 'towncenter')!;
  const y = near ? near.cy + near.size + 1 : at.y + at.size / 2 + 2;
  return Array.from({ length: n }, (_, i) => g.spawnUnit('swordsman', owner, (near ? near.cx : at.x - 3) + (i % 5), y + Math.floor(i / 5)));
};

describe('the computer\'s rescue weighs the clock', () => {
  it('goes first to the camp where its people have least time left, not the nearest', () => {
    const g = game();
    const near = camp(g, -9, 2, 60), far = camp(g, -16, 2, CAPTIVE_HOLD - 200);
    expect(heldFirst(g, 1)?.camp).toBe(far);
    expect(heldFirst(g, 1)?.pressed).toBe(false);
    near.captives![0].taken = g.time - (CAPTIVE_HOLD - 50);
    expect(heldFirst(g, 1)?.camp).toBe(near);
    expect(heldFirst(g, 1)?.pressed).toBe(true);
  });

  it('busy, it goes only once one of its people is within the last stretch, drawing on soldiers on the march too', () => {
    const g = game();
    const b = camp(g, -9, 3, 60);
    const army = soldiers(g, 1, 8);
    expect(mountRescue(g, 1, army, true)).toBe(0); // marching on a rival, and time enough
    b.captives![0].taken = g.time - (CAPTIVE_HOLD - AICLOCK.last + 1);
    for (const u of army) g.cmdMove(1, [u.id], 5, 5, true); // all on the march
    expect(mountRescue(g, 1, army, true)).toBe(rescueForce(b) + AICARE.spare);
  });

  it('still sends nobody it has too few to beat the guard with', () => {
    const g = game();
    const b = camp(g, -9, 4, CAPTIVE_HOLD - 30);
    for (let i = 0; i < 2; i++) { const s = g.spawnUnit('slaver', 0, b.x, b.y + 3); (b.staff ??= []).push(s.id); }
    expect(rescueForce(b)).toBeGreaterThan(3);
    expect(mountRescue(g, 1, soldiers(g, 1, 3), true)).toBe(0);
  });
});

describe('the computer meets a rescue at its own camp', () => {
  it('sends idle soldiers to the gate, as many as work it and one more; busy, only in the last stretch', () => {
    const g = game();
    const b = camp(g, -18, 3, 60); // far enough from its Town Center that none of its soldiers stand by it already
    const at = soldiers(g, 1, 2, b);
    expect(at.length).toBe(2);
    const own = soldiers(g, 0, 6);
    expect(keepCamps(g, 0, own, true)).toBe(0); // busy, and time enough
    expect(keepCamps(g, 0, own, false)).toBe(2 + AICLOCK.more);
    const g2 = game(), b2 = camp(g2, -18, 3, CAPTIVE_HOLD - 60);
    soldiers(g2, 1, 2, b2);
    expect(keepCamps(g2, 0, soldiers(g2, 0, 6), true)).toBe(2 + AICLOCK.more);
  });

  it('sends nobody where nobody is at the gate', () => {
    const g = game();
    camp(g, -9, 3, CAPTIVE_HOLD - 60);
    expect(keepCamps(g, 0, soldiers(g, 0, 6), false)).toBe(0);
  });
});
