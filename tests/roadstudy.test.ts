// A rival weighs the roads (src/sim/studies.ts, `pressing`): towns at an end of a road highwaymen hold press for Paved Roads.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { pressing } from '../src/sim/studies';

describe('what presses on the roads', () => {
  it('is the share of a people\'s towns at an end of a road that highwaymen hold', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const mine = c.territories.filter((t) => t.owner === 1 && !t.horde);
    expect(pressing(c, 1, 'roads')).toBe(0);
    c.bands = [{ id: 1, kind: 'highwaymen', name: 'the Toll-takers', at: mine[0].id, to: mine[0].adj[0], strength: 3, since: 0, held: [] }];
    expect(pressing(c, 1, 'roads')).toBeCloseTo(mine.filter((t) => t.id === mine[0].id || t.id === mine[0].adj[0]).length / mine.length, 5);
  });
});
