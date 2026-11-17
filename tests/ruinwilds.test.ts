// Ruin is read over the map that can be held (src/sim/ruin.ts): the true wilderness is no part of it.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { bandShare, heldShare, holdable } from '../src/sim/ruin';
import { wilderness } from '../src/sim/wilds';
import { biomeOf } from '../src/sim/campaignbase';

/** A world with no wild lands, bands or marauders, the player holding the first `held` lands and nobody the rest. */
function world(held: number) {
  const c = newCampaign(11, 2);
  c.bands = [];
  for (const f of c.factions) f.alive = f.id === 0;
  c.territories.forEach((t, i) => { delete t.wild; delete t.horde; t.owner = i < held ? 0 : -1; });
  return c;
}
/** Lands of snow or desert, which are wilderness once they are marked wild. */
const barren = (c: ReturnType<typeof world>) => c.territories.filter((t) => ['snow', 'desert'].includes(biomeOf(c, t.id)));

describe('ruin and the wilderness', () => {
  it('with no wilderness, the shares are of the whole map as before', () => {
    const c = world(5), n = c.territories.length;
    expect(holdable(c)).toHaveLength(n);
    expect(heldShare(c)).toBeCloseTo(5 / n);
    c.bands = [{ id: 1, kind: 'raiders', name: 'the Test Men', at: c.territories[n - 1].id, strength: 3, since: 1, held: [] }];
    c.territories[n - 2].horde = true;
    expect(bandShare(c)).toBeCloseTo(2 / n);
  });

  it('the wilderness is no part of the map the peoples hold a share of, nor is a band camped in it holding land', () => {
    let c = world(5);
    const wild = barren(c).filter((t) => t.owner < 0);
    if (wild.length < 2) { c = world(3); }
    const w = barren(c).filter((t) => t.owner < 0).slice(0, 2);
    expect(w.length).toBeGreaterThan(0); // this seed has snow or desert outside the held lands
    for (const t of w) t.wild = true;
    for (const t of w) expect(wilderness(c, t.id)).toBe(true);
    const n = c.territories.length, heldN = c.territories.filter((t) => t.owner === 0).length;
    expect(holdable(c)).toHaveLength(n - w.length);
    expect(heldShare(c)).toBeCloseTo(heldN / (n - w.length));
    expect(heldShare(c)).toBeGreaterThan(heldN / n);
    c.bands = [{ id: 1, kind: 'raiders', name: 'the Far Men', at: w[0].id, strength: 3, since: 1, held: [] }];
    expect(bandShare(c)).toBe(0); // out in the wilderness they hold nothing anybody could
    const other = c.territories.find((t) => t.owner < 0 && !w.includes(t))!;
    c.bands.push({ id: 2, kind: 'raiders', name: 'the Near Men', at: other.id, strength: 3, since: 1, held: [] });
    expect(bandShare(c)).toBeCloseTo(1 / (n - w.length));
    // A wild land that is not snow or desert can be settled, and counts as before.
    const green = c.territories.find((t) => t.owner < 0 && !['snow', 'desert'].includes(biomeOf(c, t.id)) && t.id !== other.id);
    if (green) { green.wild = true; expect(holdable(c)).toHaveLength(n - w.length); }
  });
});
