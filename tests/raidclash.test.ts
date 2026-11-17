// A raid fought out a round at a time (src/sim/raidclash.ts), stage one: the fight itself, not yet used by a strike.
import { describe, expect, it } from 'vitest';
import { RAID, raidClash, raidForces, raidForeseen } from '../src/sim/raidclash';
import type { TownStand } from '../src/sim/raidclash';

const stand = (over: Partial<TownStand> = {}): TownStand => { const s = { men: 1, works: 0, walls: 0, army: 0, guard: 0, spirit: 1, total: 0, ...over }; return { ...s, total: over.total ?? (s.men + s.works + s.walls + s.army + s.guard) * s.spirit }; };

describe('the two sides of a raid', () => {
  it('a band is companies on foot and with bows, worth its force of the day; a town is its works, with its army\'s companies behind them', () => {
    const { a, d } = raidForces(6, 5.4, stand({ men: 2, works: 3, army: 3 }), { infantry: 2, archers: 1 });
    expect(a.units).toEqual({ infantry: 4, archers: 2 });
    expect(a.weight).toBeCloseTo(5.4 * RAID.press);
    expect(d.units).toEqual({ infantry: 2, archers: 1 });
    expect(d.weight).toBe(8);
    expect(d.own).toBeCloseTo(3); // the army's three of the eight
    expect(d.walled).toBe(true);
    // A town with nobody but its own people has no companies: it is all works.
    const bare = raidForces(1, 1, stand({ men: 2 })).d;
    expect(bare.units).toEqual({});
    expect(bare.own).toBe(0);
    expect(bare.walled).toBe(false);
    expect(raidForces(1, 1, stand()).a.units).toEqual({ infantry: 1 }); // a band of one is one company, on foot
  });
});

describe('a raid fought out', () => {
  it('a strong town holds and the band is the weaker for it; a weak one is broken into; one that costs the band little is taken', () => {
    const held = raidClash(4, 4, stand({ men: 2, works: 4, army: 4 }), { infantry: 4 });
    expect(held.outcome).toBe('held');
    expect(held.bandLost).toBeGreaterThanOrEqual(1);
    expect(held.rounds).toBeGreaterThan(0);
    const taken = raidClash(10, 10, stand({ men: 1 }));
    expect(taken.outcome).toBe('taken');
    expect(taken.broke).toBe('defender');
    expect(taken.garrisonLost).toEqual({});
    // Between the two there are raids: the town breaks, but the band had to fight for it.
    const seen = new Set<string>();
    for (let f = 1; f <= 24; f += 0.25) seen.add(raidClash(f, f, stand({ men: 2, works: 3 })).outcome);
    expect([...seen].sort()).toEqual(['held', 'raided', 'taken']);
  });

  it('the stronger the band against the same town, the worse it goes for the town, never the better', () => {
    const rank = { held: 0, raided: 1, taken: 2 };
    let worst = 0;
    for (let f = 1; f <= 40; f += 0.5) {
      const o = rank[raidClash(f, f, stand({ men: 3, works: 3, walls: 1 })).outcome];
      expect(o).toBeGreaterThanOrEqual(worst);
      worst = o;
    }
    expect(worst).toBe(2);
  });

  it('a garrison pressed loses companies, and the day\'s luck can turn a near thing', () => {
    const pressed = raidClash(9, 9, stand({ men: 1, army: 4 }), { infantry: 4 });
    expect(pressed.outcome).not.toBe('held');
    expect(Object.values(pressed.garrisonLost).reduce((n, v) => n + v, 0)).toBeGreaterThan(0);
    const s = stand({ men: 2, works: 3 });
    let turn = 0;
    for (let f = 2; f <= 10; f += 0.25) if (raidClash(f, f, s, {}, 0, 1, 0).outcome !== raidClash(f, f, s, {}, 0, 0, 1).outcome) turn++;
    expect(turn).toBeGreaterThan(0);
  });

  it('a pious town stands longer than a decadent one under the same band', () => {
    const rank = { held: 0, raided: 1, taken: 2 };
    let holy = 0, fallen = 0;
    for (let f = 2; f <= 12; f += 0.25) { holy += rank[raidClash(f, f, stand({ men: 3, works: 3 }), {}, 100).outcome]; fallen += rank[raidClash(f, f, stand({ men: 3, works: 3 }), {}, -100).outcome]; }
    expect(holy).toBeLessThanOrEqual(fallen);
  });

  it('a strike on record is foreseen from its own figures', () => {
    const r = { force: 6, defence: stand({ men: 2, works: 3, army: 2 }) };
    const f = raidForeseen(r);
    expect(['held', 'raided', 'taken']).toContain(f.outcome);
    expect(f).toEqual(raidClash(6, 6, r.defence, { infantry: 2 }));
  });
});
