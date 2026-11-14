// Lamps and torches: which flames are given real light, and who carries a torch.
import { describe, expect, it } from 'vitest';
import { NIGHT_LIGHTS, carriesTorch, nearestFlames } from '../src/client/nightlight';

describe('light after dark', () => {
  it('gives real light to the flames nearest the middle of the view, and never to more than there are lights', () => {
    const flames = Array.from({ length: 30 }, (_, i) => ({ x: i * 3, z: 0, id: i }));
    const lit = nearestFlames(flames, 30, 0);
    expect(lit.length).toBe(NIGHT_LIGHTS);
    expect(Math.max(...lit.map((f) => Math.abs(f.x - 30)))).toBeLessThanOrEqual(9);
    expect(nearestFlames(flames.slice(0, 2), 30, 0).length).toBe(2);
  });

  it('puts a torch in the hand of the leader and about one soldier in three', () => {
    expect(carriesTorch(7, true)).toBe(true);
    const bearers = Array.from({ length: 300 }, (_, i) => i).filter((i) => carriesTorch(i, false)).length;
    expect(bearers).toBe(100);
  });
});
