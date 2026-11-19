// A band meets soldiers on the road, fought out (src/sim/roadclash.ts). Stage one: it decides nothing.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { ROAD, escortFight, loseBy, roadClash, roadForces, roadTally, soldiersOf } from '../src/sim/roadclash';
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

  it('the tally sets the old rule beside the fight', () => {
    const c = newCampaign(7, 2);
    roadTally(c, 'hunt', false, roadClash(1, 1, men(8)));
    roadTally(c, 'hunt', true, roadClash(1, 1, men(8)));
    expect(c.roadTally!.hunt).toEqual({ n: 2, ruleBand: 1, clashBand: 0, agree: 1, neither: 0 });
  });

  it('an army loses the companies a fight took, kind by kind, and never its last', () => {
    const a = { id: 1, owner: 0, at: 0, units: { infantry: 3, archers: 2 }, hero: false, vet: 0, moved: false };
    expect(loseBy(a, { infantry: 1.4, archers: 0 })).toBe(1);
    expect(a.units).toEqual({ infantry: 2, archers: 2 });
    expect(loseBy(a, { infantry: 9, archers: 9 })).toBe(3);
    expect(Object.values(a.units).reduce((n, v) => n + v, 0)).toBe(1);
    expect(loseBy(a, { infantry: 5, archers: 5 })).toBe(0);
  });

  it('with no army on the road nobody fights and the band takes its whole share', () => {
    const c = newCampaign(7, 2), band = { strength: 5 };
    c.armies = [];
    expect(escortFight(c, 'convoy', band, 0, [0, 1])).toEqual({ robbed: true, share: 1, fought: false, lost: 0 });
    expect(band.strength).toBe(5);
    expect(c.roadTally).toBeUndefined();
  });

  it('an escort far stronger sees the band off, which is the weaker for it; one far weaker is broken, and the band takes less than a whole share', () => {
    const c = newCampaign(7, 2), home = c.territories.find((t) => t.capital === 0)!;
    c.armies = [{ id: 5, owner: 0, at: home.id, units: { infantry: 9 }, hero: false, vet: 0, moved: false }];
    const weak = { strength: 2 };
    const safe = escortFight(c, 'convoy', weak, 0, [home.id]);
    expect(safe).toMatchObject({ robbed: false, share: 0, fought: true });
    expect(weak.strength).toBe(1);
    c.armies = [{ id: 6, owner: 0, at: home.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false }];
    const strong = { strength: 9 };
    const hit = escortFight(c, 'convoy', strong, 0, [home.id]);
    expect(hit.robbed).toBe(true);
    expect(hit.fought).toBe(true);
    expect(hit.share).toBeGreaterThan(0.3);
    expect(hit.share).toBeLessThan(1);
    expect(hit.lost).toBeGreaterThanOrEqual(1);
    expect(c.armies[0].units.infantry).toBe(2 - hit.lost);
    expect(c.armies[0].units.infantry).toBeGreaterThanOrEqual(1); // never its last
    expect(strong.strength).toBe(9); // it won: what it lost is in the hands it has left
    // An escort that is not on the road is no escort.
    expect(escortFight(c, 'convoy', { strength: 9 }, 0, [home.adj[0]]).fought).toBe(false);
  });
});
