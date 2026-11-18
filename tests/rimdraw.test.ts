// The rim of true wilderness on the campaign map (src/client/rimdraw.ts): its waste, its paint, a band's camp.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { RIM_PAINT, bandCamp, rimTint, seenByPlayer, wasteOf } from '../src/client/rimdraw';
import { townsThatSee } from '../src/sim/bandmarch';
import { wasteAt } from '../src/sim/campaignbase';

const land = (name: string, x = 600, y = 400) => ({ id: 99, name, x, y } as never);

describe('rimdraw', () => {
  const c = newCampaign(11, 1, 1, 'hearth');
  it('a rim land is painted as its own waste, snow or desert; one saved before it kept a waste, by the rim\'s rule (rim.ts rimWaste)', () => {
    // The rim keeps its waste now (rim.ts): it is painted as that, whatever its name or the country round it.
    expect(wasteOf(c, { ...(land('the Southern Frozen Reach') as object), waste: 'snow' } as never)).toBe('snow');
    expect(wasteOf(c, { ...(land('the Northern Dry Marches') as object), waste: 'desert' } as never)).toBe('desert');
    for (const t of c.territories.filter((x) => x.rim)) expect(wasteOf(c, t)).toBe(t.waste);
    // A campaign saved before: the same rule the rim is made by, at the land's place.
    for (const [x, y] of [[600, 30], [600, 770], [30, 400], [1170, 400]]) expect(wasteOf(c, land('the Western Grey Fells', x, y))).toBe(wasteAt(c.seed, x, y));
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

  it('a camp in the rim is drawn only where the player\'s towns can see its fires (bandmarch.ts townsThatSee)', () => {
    const world = newCampaign(11, 1, 1, 'hearth');
    const rims = world.territories.filter((t) => t.rim);
    expect(rims.length).toBeGreaterThan(0);
    const band = (at: number) => ({ id: 1, at, strength: 4 } as never);
    for (const r of rims) expect(seenByPlayer(world, band(r.id))).toBe(townsThatSee(world, [r.id]).some((s) => s.owner === 0));
    // Make the land below one rim land the player's: its camp is seen. Give every land within sight to nobody: it is not.
    const r = rims[0], below = world.territories[r.down![0]];
    const was = below.owner;
    below.owner = 0;
    expect(seenByPlayer(world, band(r.id))).toBe(true);
    below.owner = was;
    for (const t of world.territories) if (t.owner === 0) t.owner = 1;
    expect(seenByPlayer(world, band(r.id))).toBe(false);
  });
});
