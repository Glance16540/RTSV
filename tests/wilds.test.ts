// The wild lands: a share of the far and poor lands start with no tribe and no town (src/sim/wilds.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { biomeOf } from '../src/sim/campaignbase';
import { emptyLand } from '../src/sim/founding';
import { WILD, farOrPoor, wildable } from '../src/sim/wilds';
import { warriorsOf } from '../src/sim/tribes';

describe('the wild lands', () => {
  it('a share of the far and poor lands start wild: nobody there, no warriors, no works, empty for settlers', () => {
    let wild = 0, may = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      const lands = c.territories.filter((t) => t.wild);
      wild += lands.length;
      for (const t of lands) {
        expect(farOrPoor(c, t)).toBe(true);
        expect(t.owner).toBe(-1);
        expect(t.capital).toBe(-1);
        expect(t.buildings).toEqual([]);
        expect(emptyLand(c, t.id)).toBe(true);
        expect(warriorsOf(c, t.id)).toBe(0); // never made up to a tribe's strength
        // Beside no people's chief town: nobody starts with a free land at the door.
        expect(t.adj.some((n) => c.territories[n].capital >= 0)).toBe(false);
      }
      // Of all the far and poor lands, the share made wild:
      may += wildable(c).length; // the wild lands are among them
    }
    expect(wild).toBeGreaterThan(0);
    expect(wild / may).toBeCloseTo(WILD.share, 1);
  });

  it('the same seed makes the same wilds, and the far lands are snow, desert or the map\'s edge', () => {
    const a = newCampaign(5, 2, 1, 'hearth'), b = newCampaign(5, 2, 1, 'hearth');
    expect(a.territories.filter((t) => t.wild).map((t) => t.id)).toEqual(b.territories.filter((t) => t.wild).map((t) => t.id));
    const c = newCampaign(5, 2, 1, 'hearth');
    for (const t of c.territories) {
      const b = biomeOf(c, t.id);
      if (b === 'snow' || b === 'desert') expect(farOrPoor(c, t)).toBe(true);
    }
  });

  it('every people still has tribes to conquer', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 3, 1, 'hearth');
      expect(c.territories.filter((t) => t.owner < 0 && !t.wild).length).toBeGreaterThan(c.territories.length / 3);
    }
  });
});
