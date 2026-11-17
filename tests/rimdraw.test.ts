// The rim of true wilderness on the campaign map (src/client/rimdraw.ts): its waste by name and place, its paint, a band's camp.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { RIM_PAINT, bandCamp, rimTint, wasteOf } from '../src/client/rimdraw';

const land = (name: string, x = 600, y = 400) => ({ id: 99, name, x, y } as never);

describe('rimdraw', () => {
  const c = newCampaign(11, 1, 1, 'hearth');
  it('a rim land is snow or desert by its name, and a barren one by its side of the map', () => {
    expect(wasteOf(c, land('the Southern Frozen Reach'))).toBe('snow');
    expect(wasteOf(c, land('the Northern Dry Marches'))).toBe('desert');
    expect(wasteOf(c, land('the Northern Grey Fells'))).toBe('snow');
    expect(wasteOf(c, land('the Southern Stone Wastes'))).toBe('desert');
  });
  it('turns the ground pale near a rim land, and leaves it be far off', () => {
    const tint = rimTint(c)!;
    expect(tint).not.toBeNull();
    const rim = c.territories.find((t) => t.rim)!;
    const near = [100, 140, 40], far = [100, 140, 40];
    tint(rim.x, rim.y, near);
    tint(rim.x + RIM_PAINT.reach * 2, rim.y, far);
    expect(near[0]).toBeGreaterThan(200);
    expect(far).toEqual([100, 140, 40]);
    expect(rimTint({ ...c, territories: c.territories.filter((t) => !t.rim) } as never)).toBeNull();
  });
  it('a band\'s camp has more tents for a stronger band, and its fires', () => {
    const small = bandCamp({ id: 1, strength: 2 } as never, 'snow'), big = bandCamp({ id: 2, strength: 7 } as never, 'desert');
    expect(big.group.children.length).toBeGreaterThan(small.group.children.length);
    expect(small.fires.length).toBeGreaterThan(0);
  });
});
