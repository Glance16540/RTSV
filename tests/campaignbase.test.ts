// What the map's systems share, below all of them (src/sim/campaignbase.ts). That it imports no system is
// scripts/porting-check.mjs's to say: it fails if this module joins an import cycle.
import { describe, expect, it } from 'vitest';
import * as hub from '../src/sim/campaign';
import * as base from '../src/sim/campaignbase';

describe('the campaign\'s base', () => {
  it('everything in it is still found in the hub, the same thing and not a copy', () => {
    const names = Object.keys(base);
    expect(names.length).toBeGreaterThan(40);
    for (const n of names) expect((hub as Record<string, unknown>)[n], n).toBe((base as Record<string, unknown>)[n]);
  });

  it('the helpers are what they were', () => {
    const c = hub.newCampaign(7, 2, 1);
    const a = c.armies[0];
    expect(base.armySize(a)).toBe(Object.values(a.units).reduce((n, v) => n + v, 0));
    expect(base.armyAt(c, a.at)).toBe(a);
    expect(base.landOf(c, 0)).toBe(c.territories.filter((t) => t.owner === 0).length);
    expect(base.dominionNeed(c)).toBe(Math.ceil(c.territories.length * base.DOMINION_SHARE));
    expect(base.biomeOf(c, 0)).toBe(base.biomeAt(c.seed, c.territories[0].x, c.territories[0].y));
    expect(base.companyCost(c.territories[0], 'infantry')).toBe(base.COMPANIES.infantry.cost);
  });
});
