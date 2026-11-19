// What the computer player does for its own people and its allies' (src/sim/aicare.ts, called from ai.ts): it posts
// guards over its captives, feeds a hungry ally, buys food when its own go hungry, and sends soldiers to free its people
// held in a rival's camp.
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { AICARE, mountRescue } from '../src/sim/aicare';
import { FAMINE } from '../src/sim/famine';
import { Game } from '../src/sim/game';
import { rescueForce } from '../src/sim/rescue';
import { run } from './helpers';

/** A decadent town (0) with a Work Camp holding `held` people taken from its rival (1), and `guards` posted. */
const camped = (held: number, guards = 0) => {
  const g = new Game(5, [{ name: 'A', color: 1, isAI: true, civ: 'hearth' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }]);
  const p = g.players[0];
  p.age = 2; p.virtue = -80; p.popCap = 40;
  for (const q of g.players) q.dilemmaT = 1e9;
  const tc = g.buildings.find((b) => b.owner === 0)!;
  const camp = g.spawnBuilding('workcamp', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
  camp.captives = Array.from({ length: held }, (_, i) => ({ from: 1, name: 'Held' + i, family: '', gender: i % 2 ? 'f' as const : 'm' as const, trait: '', trait2: '', age: 0, lifespan: 9999 }));
  const posted = Array.from({ length: guards }, (_, i) => g.spawnUnit('slaver', 0, camp.x - 1 + i * 0.6, camp.y + 3));
  if (guards) { g.cmdTarget(0, posted.map((s) => s.id), camp.id); run(g, 8); }
  return { g, camp };
};
/** Soldiers of the rival's standing idle by its own Town Center. */
const soldiers = (g: Game, owner: number, n: number) => {
  const tc = g.buildings.find((b) => b.owner === owner && b.type === 'towncenter')!;
  return Array.from({ length: n }, (_, i) => g.spawnUnit('swordsman', owner, tc.x - 3 + (i % 5), tc.y + tc.size / 2 + 2 + Math.floor(i / 5)));
};
const boundFor = (g: Game, owner: number, x: number, y: number) => g.units.filter((u) => u.owner === owner && u.type === 'swordsman' && u.order?.t === 'move' && Math.hypot(u.order.x - x, u.order.y - y) <= AICARE.near);

describe('the computer keeps its captives guarded', () => {
  it('an idle Slaver of a town holding unwatched captives goes to stand guard', () => {
    const { g, camp } = camped(4);
    const s = g.spawnUnit('slaver', 0, camp.x + 4, camp.y + 4);
    new AIController(g, 0).update();
    expect(s.order?.t).toBe('staff');
  });
});

describe('the computer goes after its people held in a camp', () => {
  it('sends enough idle soldiers to beat the guard and work the gate, and no more', () => {
    const { g, camp } = camped(4);
    soldiers(g, 1, 6);
    new AIController(g, 1).update();
    const want = rescueForce(camp) + AICARE.spare;
    expect(boundFor(g, 1, camp.x, camp.y).length).toBe(want);
    new AIController(g, 1).update(); // asked again, it counts those already on their way
    expect(boundFor(g, 1, camp.x, camp.y).length).toBe(want);
  });

  it('frees them: the soldiers it sends get its people out', () => {
    const { g, camp } = camped(3);
    soldiers(g, 1, 4);
    const ai = new AIController(g, 1);
    run(g, 90, () => ai.update());
    expect(camp.dead || (camp.captives ?? []).filter((c) => c.from === 1).length < 3).toBe(true);
  });

  it('sends nobody when it has too few to beat the guard, or is under attack', () => {
    const { g, camp } = camped(4, 2);
    expect(rescueForce(camp)).toBeGreaterThan(4);
    const army = soldiers(g, 1, 4);
    expect(mountRescue(g, 1, army, false)).toBe(0);
    const more = [...army, ...soldiers(g, 1, 6)];
    expect(mountRescue(g, 1, more, true)).toBe(0); // busy: under attack or on the march
    expect(mountRescue(g, 1, more, false)).toBe(rescueForce(camp) + AICARE.spare);
  });
});

describe('the computer in a famine', () => {
  const allies = () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: true, civ: 'hearth', team: 0 }, { name: 'B', color: 2, isAI: true, civ: 'hearth', team: 0 }]);
    for (const q of g.players) { q.dilemmaT = 1e9; q.age = 1; }
    const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    g.spawnBuilding('market', 0, Math.floor(tc.x) + 6, Math.floor(tc.y) - 8, true);
    return g;
  };

  it('sends food to an ally going hungry, keeping enough for itself', () => {
    const g = allies();
    g.players[0].res.food = 1000; g.players[1].res.food = 0; g.players[1].hunger = FAMINE.hungry;
    new AIController(g, 0).update();
    expect(g.players[1].res.food).toBeGreaterThan(0);
    const lean = allies();
    lean.players[0].res.food = FAMINE.keep; lean.players[1].res.food = 0; lean.players[1].hunger = FAMINE.hungry;
    new AIController(lean, 0).update();
    expect(lean.players[1].res.food).toBe(0);
  });

  it('buys food when its own people go hungry, though gold is short of what it would usually spend', () => {
    const g = allies();
    const p = g.players[0];
    p.res.food = 0; p.res.gold = 200; p.hunger = FAMINE.hungry;
    new AIController(g, 0).update();
    expect(p.res.food).toBeGreaterThan(0);
    const fed = allies();
    fed.players[0].res.food = 0; fed.players[0].res.gold = 200;
    new AIController(fed, 0).update();
    expect(fed.players[0].res.food).toBe(0); // not hungry yet: it keeps to its usual reckoning
  });
});
