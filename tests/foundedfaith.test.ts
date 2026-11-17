// A town founded by settlers begins partly apart from its nation's faith (founding.ts foundedFaith; DESIGN.md).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { FOUNDING, claimLand, foundedFaith } from '../src/sim/founding';
import { folkOf } from '../src/sim/township';

describe('a founded town\'s faith', () => {
  it('begins FOUNDING.apart from its founders\' town, either way by the world\'s seed, the same each time', () => {
    const [lo, hi] = FOUNDING.apart;
    let up = 0, down = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      const home = c.territories.find((t) => t.capital === 0)!;
      home.virtue = 20;
      const to = c.territories.find((t) => t.owner < 0 && t.capital < 0)!;
      const v = foundedFaith(c, to.id, home.id, 0);
      expect(Math.abs(v - 20)).toBeGreaterThanOrEqual(lo);
      expect(Math.abs(v - 20)).toBeLessThanOrEqual(hi);
      expect(foundedFaith(c, to.id, home.id, 0)).toBe(v);
      if (v > 20) up++; else down++;
    }
    expect(up).toBeGreaterThan(5);
    expect(down).toBeGreaterThan(5);
  });

  it('settlers coming in set the new town\'s standing so', () => {
    for (let seed = 1; seed < 40; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      const home = c.territories.find((t) => t.capital === 0)!;
      const to = home.adj.map((n) => c.territories[n]).find((t) => t.owner < 0 && t.capital < 0 && !t.wild);
      if (!to) continue;
      to.militia = 0; to.buildings = []; delete to.town; to.horde = false;
      to.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
      c.bands = (c.bands ?? []).filter((b) => b.at !== to.id && b.to !== to.id);
      home.virtue = -10;
      const want = foundedFaith(c, to.id, home.id, 0);
      expect(claimLand(c, to.id, 0, { from: home.id })).toBe(true);
      expect(to.virtue).toBe(want);
      expect(folkOf(c, to.id).men).toBe(0);
      return;
    }
    throw new Error('no capital with an unheld land beside it');
  });
});
