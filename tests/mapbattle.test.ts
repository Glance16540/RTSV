import { describe, expect, it } from 'vitest';
import { CLASH, Force, accountOf, breakOf, chance, clash, foresee, heartOf } from '../src/sim/mapbattle';

const army = (units: Record<string, number>, more: Partial<Force> = {}): Force => {
  const weight = (units.infantry ?? 0) + (units.archers ?? 0) + 2 * (units.cavalry ?? 0);
  return { units, weight, ...more };
};
const n = (u: Record<string, number>): number => Object.values(u).reduce((x, y) => x + y, 0);

describe('a battle on the map, fought and not summed', () => {
  it('comes out the same for the same forces and the same day', () => {
    const a = army({ infantry: 3, cavalry: 1 }), d = army({ archers: 2, infantry: 2 });
    expect(clash(a, d, 1.1, 0.9)).toEqual(clash(a, d, 1.1, 0.9));
  });

  it('the heavier side wins, and loses less than the side it breaks', () => {
    const out = foresee(army({ infantry: 6 }), army({ infantry: 3 }));
    expect(out.attackerWon).toBe(true);
    expect(out.broke).toBe('defender');
    expect(n(out.a.lost)).toBeLessThan(n(out.d.lost));
    expect(n(out.a.left)).toBeGreaterThan(0);
    const back = foresee(army({ infantry: 3 }), army({ infantry: 6 }));
    expect(back.attackerWon).toBe(false);
    expect(back.broke).toBe('attacker');
  });

  it('level sides: the attack fails', () => {
    expect(foresee(army({ infantry: 4 }), army({ infantry: 4 })).attackerWon).toBe(false);
  });

  it('what counters what decides a battle of equal weight', () => {
    // Cavalry beats archers, archers beat infantry, infantry beats cavalry: four of weight either way.
    expect(foresee(army({ cavalry: 2 }), army({ archers: 4 })).attackerWon).toBe(true);
    expect(foresee(army({ archers: 4 }), army({ infantry: 4 })).attackerWon).toBe(true);
    expect(foresee(army({ infantry: 4 }), army({ cavalry: 2 })).attackerWon).toBe(true);
    expect(foresee(army({ archers: 4 }), army({ cavalry: 2 })).attackerWon).toBe(false);
  });

  it('the kind that is beaten is the kind that falls', () => {
    // Archers beat infantry: of a mixed army facing archers, the infantry bear the worst of it.
    const out = clash(army({ archers: 6 }), army({ infantry: 3, archers: 3 }), 1.2, 1);
    expect(out.d.lost.infantry ?? 0).toBeGreaterThanOrEqual(out.d.lost.archers ?? 0);
    const horse = clash(army({ infantry: 6 }), army({ cavalry: 2, archers: 3 }), 1.2, 1);
    expect((horse.d.lost.cavalry ?? 0) / 2).toBeGreaterThanOrEqual((horse.d.lost.archers ?? 0) / 3);
  });

  it('losses are by kind and add up', () => {
    const a = army({ infantry: 3, archers: 2, cavalry: 1 }), d = army({ infantry: 2, cavalry: 2 });
    const out = clash(a, d, 0.9, 1.1);
    for (const side of [out.a, out.d]) for (const k of Object.keys(side.began)) expect((side.lost[k] ?? 0) + (side.left[k] ?? 0)).toBe(side.began[k]);
    expect(out.a.began).toEqual(a.units);
  });

  it('walls shelter the companies behind them', () => {
    const attack = army({ infantry: 8 });
    const open = foresee(attack, army({ infantry: 3 }));
    const walled = foresee(attack, { units: { infantry: 3 }, weight: 7, own: 3, walled: true });
    expect(open.attackerWon).toBe(true);
    expect(n(walled.a.lost)).toBeGreaterThan(n(open.a.lost)); // the town's works strike too
    expect(walled.d.works).toBeGreaterThan(0);
    // Works enough hold a town its garrison could not.
    expect(foresee(army({ infantry: 5 }), army({ infantry: 3 })).attackerWon).toBe(true);
    expect(foresee(army({ infantry: 5 }), { units: { infantry: 3 }, weight: 6.5, own: 3, walled: true }).attackerWon).toBe(false);
  });

  it('a town with nobody but its own people fights by its works', () => {
    const out = foresee(army({ infantry: 2 }), { units: {}, weight: 1 });
    expect(out.attackerWon).toBe(true);
    expect(out.d.began).toEqual({});
    expect(foresee(army({ infantry: 1 }), { units: {}, weight: 4, walled: true }).attackerWon).toBe(false);
  });

  it('veterans, a leader, walls and creed hold a side longer', () => {
    const plain = breakOf({ units: {}, weight: 1 });
    expect(plain).toBe(CLASH.breakAt);
    expect(breakOf({ units: {}, weight: 1, vet: 2 })).toBeGreaterThan(plain);
    expect(breakOf({ units: {}, weight: 1, led: true, rank: 3 })).toBeGreaterThan(breakOf({ units: {}, weight: 1, led: true }));
    expect(breakOf({ units: {}, weight: 1, walled: true })).toBeGreaterThan(plain);
    expect(heartOf(100)).toBeGreaterThan(1);
    expect(heartOf(-100)).toBeLessThan(1);
    expect(breakOf({ units: {}, weight: 1, heart: heartOf(-100) })).toBeLessThan(plain);
    expect(breakOf({ units: {}, weight: 1, vet: 9, led: true, rank: 9, walled: true, heart: 1.5 })).toBe(CLASH.most);
    // Level but for their leader: the led side stands when the other breaks.
    expect(foresee(army({ infantry: 4 }, { led: true, vet: 2 }), army({ infantry: 4 })).attackerWon).toBe(true);
  });

  it('cavalry rides down a broken side', () => {
    const beaten = army({ infantry: 4 });
    const foot = clash(army({ infantry: 8 }), beaten), horse = clash({ units: { cavalry: 4 }, weight: 8 }, { units: { archers: 4 }, weight: 4 });
    expect(foot.broke).toBe('defender');
    expect(horse.broke).toBe('defender');
    expect(n(horse.d.left)).toBeLessThanOrEqual(n(foot.d.left));
  });

  it('a victor keeps a company at the least, and a beaten side may keep some', () => {
    const close = clash(army({ infantry: 2 }), army({ infantry: 2 }), 1.25, 0.8);
    expect(close.attackerWon).toBe(true);
    expect(n(close.a.left)).toBeGreaterThanOrEqual(1);
    const routed = foresee(army({ infantry: 8 }), army({ infantry: 9 }));
    expect(routed.attackerWon).toBe(false);
    expect(n(routed.a.left)).toBeGreaterThan(0); // not gone to the last man
    expect(n(routed.a.left)).toBeLessThan(8);
    expect(routed.a.scattered).toBeUndefined();
  });

  it('a broken side left with too few to hold together scatters for home', () => {
    const out = foresee(army({ infantry: 3 }), army({ infantry: 9 }));
    expect(out.broke).toBe('attacker');
    expect(out.a.scattered).toBe(true);
    expect(out.a.left).toEqual({});
    expect(out.a.lost).toEqual({ infantry: 3 });
    expect(n(out.d.left)).toBeGreaterThan(0);
  });

  it('the day can turn a near thing, and the chance says how near', () => {
    const a = army({ infantry: 4 }), d = army({ infantry: 4 });
    expect(clash(a, d, 1.2, 0.85).attackerWon).toBe(true);
    expect(clash(a, d, 0.85, 1.2).attackerWon).toBe(false);
    const even = chance(a, d);
    expect(even).toBeGreaterThan(0.2);
    expect(even).toBeLessThan(0.6);
    expect(chance(army({ infantry: 8 }), army({ infantry: 3 }))).toBe(1);
    expect(chance(army({ infantry: 2 }), army({ infantry: 8 }))).toBe(0);
    expect(chance(army({ infantry: 5 }), d)).toBeGreaterThan(even);
  });

  it('tells it in words', () => {
    const out = foresee(army({ infantry: 6 }), army({ archers: 3 }));
    const text = accountOf(out, 'The Kush', 'the Franks', 'Reims');
    expect(text).toContain('the Franks broke');
    expect(text).toContain('Reims was taken');
    expect(text).toContain('of archers');
    expect(accountOf(foresee(army({ infantry: 1 }), { units: {}, weight: 9, walled: true }), 'The Kush', 'the Franks', 'Reims')).toMatch(/broke|drew off/);
  });
});
