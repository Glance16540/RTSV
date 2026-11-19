// What an answer to the 'held' dilemma does to those held (src/sim/dilemmaacts.ts, src/sim/captivity.ts).
import { describe, expect, it } from 'vitest';
import { SOLD_GOLD } from '../src/sim/captivity';
import { ACTS, dilemmaAct } from '../src/sim/dilemmaacts';
import { DILEMMAS } from '../src/sim/creed';
import type { Captive } from '../src/sim/game';
import { Game } from '../src/sim/game';
import { setups, spot } from './helpers';

const captive = (from: number, name: string, gender: 'm' | 'f'): Captive => ({ from, name, family: 'Holt', gender, trait: '', trait2: '', age: 0, lifespan: 1080, taken: 0 });

/** A town of player 0 with a work camp holding three of player 1's people, and a marauders' lair holding one. */
function camp(): { g: Game; held: Captive[]; lair: Captive[] } {
  const g = new Game(4, setups, 72);
  const at = spot(g, 'workcamp', 0), b = g.spawnBuilding('workcamp', 0, at.cx, at.cy, true);
  const held = [captive(1, 'Ada', 'f'), captive(1, 'Bran', 'm'), captive(1, 'Cora', 'f')];
  b.captives = [...held];
  const lair = g.spawnBuilding('house', g.wild, 40, 40, true);
  lair.captives = [captive(1, 'Dara', 'f')];
  Object.assign(g.players[0].res, { food: 500, wood: 500, gold: 0, stone: 500 });
  g.players[0].dilemma = 'held';
  return { g, held, lair: lair.captives };
}
const inCamp = (g: Game): number => g.buildings.filter((b) => b.owner === 0 && b.type === 'workcamp').reduce((n, b) => n + (b.captives?.length ?? 0), 0);

describe('the dilemma of those held in the camp', () => {
  it('set free: everyone held goes home to their own people, as a freed captive does', () => {
    const { g, held, lair } = camp();
    const before = g.units.filter((u) => u.owner === 1 && u.type === 'villager').length;
    expect(g.cmdDecide(0, 'a')).toBe(true);
    expect(inCamp(g)).toBe(0);
    const home = g.units.filter((u) => u.owner === 1 && u.type === 'villager');
    expect(home.length).toBe(before + held.length);
    for (const c of held) expect(home.some((u) => u.name === c.name && u.family === c.family)).toBe(true);
    expect(lair).toHaveLength(1); // a marauders' lair is not the town's camp
    expect(g.players[0].res.food).toBe(500 + (DILEMMAS.find((d) => d.id === 'held')!.a.res.food ?? 0));
  });

  it('sold: everyone held is sold on at the camp\'s own price, and lost to their people', () => {
    const { g, held, lair } = camp();
    const before = g.units.filter((u) => u.owner === 1 && u.type === 'villager').length;
    expect(g.cmdDecide(0, 'b')).toBe(true);
    expect(inCamp(g)).toBe(0);
    expect(g.players[0].res.gold).toBe(SOLD_GOLD * held.length);
    expect(g.units.filter((u) => u.owner === 1 && u.type === 'villager').length).toBe(before);
    expect(g.events.filter((e) => e.t === 'msg' && e.player === 1 && /sold on from the work camp/.test((e as { text: string }).text))).toHaveLength(held.length);
    expect(lair).toHaveLength(1);
  });

  it('asks a flat price no longer: its goods are only what its words say', () => {
    const d = DILEMMAS.find((x) => x.id === 'held')!;
    expect(d.b.res.gold).toBeUndefined();
    expect(d.b.label).toMatch(/camp's price/);
  });
});

describe('the acts themselves', () => {
  it('are kept for the dilemmas whose words say more, and do nothing for any other', () => {
    expect(Object.keys(ACTS)).toEqual(['held']);
    expect(Object.keys(ACTS.held).sort()).toEqual(['a', 'b']);
    const { g } = camp();
    const before = inCamp(g);
    dilemmaAct(g, 0, 'harvest', 'a'); // no act of its own
    dilemmaAct(g, 0, 'held', 'c' as 'a');
    expect(inCamp(g)).toBe(before);
    dilemmaAct(g, 0, 'held', 'a');
    expect(inCamp(g)).toBe(0);
  });
});
