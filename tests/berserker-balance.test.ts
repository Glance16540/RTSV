// The Berserker against the Swordsman, who stands in his place for a town that keeps the faith: same Barracks,
// same age, same price. The owner asked for him to be evened up; he was raised from 95 health and 12 attack to
// 110 and 14, which took him from losing every decided fight to about half. These fights pin that, loosely:
// they are meant to catch him becoming useless or overbearing again, not to hold a number to the decimal.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { UNITS } from '../src/sim/data';
import { run } from './helpers';

/** Two lines set down six tiles apart between the towns and sent at each other. Returns how many of each are left. */
const fight = (seed: number, a: string, na: number, b: string, nb: number): [number, number] => {
  const g = new Game(seed, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
  for (const p of g.players) { p.dilemmaT = 1e9; p.age = 2; }
  const s0 = g.spec.starts[0], s1 = g.spec.starts[1];
  const mx = (s0.x + s1.x) / 2, my = (s0.y + s1.y) / 2;
  const d = Math.hypot(s1.x - s0.x, s1.y - s0.y), ux = (s1.x - s0.x) / d, uy = (s1.y - s0.y) / d;
  const put = (id: string, n: number, owner: number, side: number) => Array.from({ length: n }, (_, i) =>
    g.spawnUnit(id, owner, mx + side * ux * 3 - uy * (i - n / 2) * 0.8, my + side * uy * 3 + ux * (i - n / 2) * 0.8));
  const A = put(a, na, 0, -1), B = put(b, nb, 1, 1);
  g.cmdMove(0, A.map((u) => u.id), mx + ux * 3, my + uy * 3, true);
  g.cmdMove(1, B.map((u) => u.id), mx - ux * 3, my - uy * 3, true);
  for (let t = 0; t < 180 && A.some((u) => !u.dead) && B.some((u) => !u.dead); t++) run(g, 1);
  return [A.filter((u) => !u.dead).length, B.filter((u) => !u.dead).length];
};
// Maps on which the two lines meet and fight to the end (on about half they are parted by the ground and never do).
const MAPS = [1, 2, 7, 11, 16, 18, 20, 22];

describe('the Berserker is worth his price', () => {
  it('he is what he was in kind: unarmoured, faster as he is wounded, at the Swordsman\'s price', () => {
    const total = (id: string) => Object.values(UNITS[id].cost).reduce((n, v) => n + (v ?? 0), 0);
    expect(UNITS.berserker.armor).toBe(0);
    expect(UNITS.berserker.frenzy).toBe(true);
    expect(UNITS.berserker.hp).toBeLessThan(UNITS.swordsman.hp); // he wins by fury, not by standing longer
    expect(total('berserker')).toBe(total('swordsman'));
  });

  it('ten against ten Swordsmen, he wins some and loses some', () => {
    const results = MAPS.map((seed) => fight(seed, 'berserker', 10, 'swordsman', 10));
    const decided = results.filter(([b, s]) => !b || !s);
    const won = decided.filter(([b]) => b > 0).length, lost = decided.length - won;
    expect(decided.length).toBeGreaterThanOrEqual(6);
    expect(won).toBeGreaterThanOrEqual(2); // before the change he won none
    expect(lost).toBeGreaterThanOrEqual(2); // and he must not simply replace the Swordsman
  }, 60000);

  it('against Spearmen at equal cost he does no better than the Swordsman does', () => {
    let berserkers = 0, swordsmen = 0;
    for (const seed of MAPS.slice(0, 4)) {
      const [b, foeB] = fight(seed, 'berserker', 10, 'spearman', 15), [s, foeS] = fight(seed, 'swordsman', 10, 'spearman', 15);
      expect(foeB).toBe(0); // both still win it
      expect(foeS).toBe(0);
      berserkers += b; swordsmen += s;
    }
    expect(berserkers).toBeLessThanOrEqual(swordsmen);
  }, 60000);
});
