// What must be held to win by dominion (src/sim/campaignbase.ts DOMINION_SHARE, dominionNeed).
import { describe, expect, it } from 'vitest';
import { DOMINION_SHARE, dominionNeed, newCampaign } from '../src/sim/campaign';
import { besideFor } from '../src/sim/emptybeside';

describe('winning by dominion', () => {
  it('asks for a little over half of the lands with somebody on them', () => {
    expect(DOMINION_SHARE).toBe(0.52);
    const c = newCampaign(7, 2, 1);
    const peopled = c.territories.filter((t) => !(t.owner < 0 && !t.horde && (t.militia ?? 0) <= 0 && !!t.folk && t.folk.men + t.folk.women + t.folk.elders + t.folk.children === 0)).length;
    expect(dominionNeed(c)).toBe(Math.ceil(peopled * DOMINION_SHARE));
    expect(dominionNeed(c)).toBeGreaterThan(peopled / 2);
  });
  it('an empty land beside a chief town is not counted until somebody lives there', () => {
    const c = newCampaign(7, 2, 1);
    const t = besideFor(c, 0)!;
    const before = dominionNeed(c);
    let n = 0;
    for (const x of c.territories) if (x.beside !== undefined) n++;
    expect(n).toBeGreaterThan(0);
    // Settled, each counts again: with every one of them peopled the need is that of a world with those lands in it.
    for (const x of c.territories) if (x.beside !== undefined) { x.owner = x.beside; x.folk!.men = 5; x.folk!.women = 5; }
    const after = dominionNeed(c);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after - before).toBeLessThanOrEqual(n);
    expect(t.owner).toBe(0);
  });
});
