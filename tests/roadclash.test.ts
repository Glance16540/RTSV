// A band meets soldiers on the road, fought out (src/sim/roadclash.ts). Stage one: it decides nothing.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { ROAD, escortTally, roadClash, roadForces, roadTally, soldiersOf } from '../src/sim/roadclash';
import { armyStrength } from '../src/sim/campaignbase';

const men = (n: number, strength = n): { units: Record<string, number>; strength: number } => ({ units: { infantry: n }, strength });

describe('the road fight', () => {
  it('the band is companies on foot and with bows at its force of the day; the soldiers are their own companies, with no walls', () => {
    const { a, d } = roadForces(6, 5, { ...men(4, 4.5), vet: 2, led: true, rank: 1, virtue: 0 });
    expect(a.units.infantry + (a.units.archers ?? 0)).toBe(6);
    expect(a.weight).toBeCloseTo(5 * ROAD.press, 6);
    expect(d.units).toEqual({ infantry: 4 });
    expect(d.weight).toBe(4.5);
    expect(d.walled).toBeFalsy();
    expect(d.vet).toBe(2);
    expect(d.led).toBe(true);
  });

  it('the far stronger side breaks the other; near even, either may break by the day, or neither', () => {
    expect(roadClash(9, 9, men(1)).broke).toBe('soldiers');
    expect(roadClash(1, 1, men(8)).broke).toBe('band');
    const seen = new Set<string>();
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) seen.add(roadClash(4, 4, men(4), i / 10, j / 10).broke);
    expect(seen.has('band')).toBe(true);
    expect(seen.has('soldiers')).toBe(true);
  });

  it('says what each side lost and what the band would come away with', () => {
    const win = roadClash(9, 9, men(2));
    expect(win.broke).toBe('soldiers');
    expect(win.body).toBeGreaterThan(0);
    expect(Object.values(win.lost).reduce((n, v) => n + v, 0)).toBeGreaterThan(0);
    expect(win.time).toBeGreaterThan(0.5);
    expect(win.hands).toBeGreaterThan(0.5);
    const lose = roadClash(2, 2, men(9));
    expect(lose.broke).toBe('band');
    expect(lose.bandLost).toBeGreaterThanOrEqual(1);
    expect(lose.cost).toBeGreaterThan(0);
  });

  it('an army is the soldiers it is where it stands, and a scale makes it more or less on the day', () => {
    const c = newCampaign(7, 2), a = c.armies.find((x) => x.owner === 0)!;
    const s = soldiersOf(c, a), half = soldiersOf(c, a, 0.5);
    expect(s.units).toBe(a.units);
    expect(s.strength).toBeCloseTo(armyStrength(a, c), 6);
    expect(half.strength).toBeCloseTo(s.strength / 2, 6);
    expect(s.led).toBe(a.hero);
  });

  it('stage one keeps a tally and changes nothing: how the rule went, how the clash would have, and whether they agree', () => {
    const c = newCampaign(7, 2), a = c.armies.find((x) => x.owner === 0)!, before = JSON.stringify({ armies: c.armies, bands: c.bands });
    roadTally(c, 'hunt', false, roadClash(1, 1, men(8)));
    roadTally(c, 'hunt', true, roadClash(1, 1, men(8)));
    expect(c.roadTally!.hunt).toEqual({ n: 2, ruleBand: 1, clashBand: 0, agree: 1, neither: 0 });
    escortTally(c, 'convoy', { strength: 2 }, 0, [a.at], armyStrength(a));
    expect(c.roadTally!.convoy.n).toBe(1);
    escortTally(c, 'convoy', { strength: 2 }, 0, [a.at], 0); // no escort: nobody to fight
    expect(c.roadTally!.convoy.n).toBe(1);
    expect(JSON.stringify({ armies: c.armies, bands: c.bands })).toBe(before);
  });
});
