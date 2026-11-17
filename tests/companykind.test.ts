// The company a soldier is of on the map, and what the panel says a town keeps (src/sim/townmuster.ts companyOf, src/sim/armytown.ts noMenText).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { COMPANIES } from '../src/sim/campaignbase';
import { BUILDINGS } from '../src/sim/data';
import { agesOf } from '../src/sim/ageing';
import { MEN, noMenText } from '../src/sim/armytown';
import { companyOf } from '../src/sim/townmuster';
import { visitArms } from '../src/sim/visit';
import { cleanQueued } from '../src/sim/queueddrill';
import { folkOf } from '../src/sim/township';

describe('the company a soldier is of', () => {
  it('is the one that fields his kind: a slinger is of the archers, though a Barracks trains slingers', () => {
    expect(BUILDINGS.barracks.trains).toContain('slinger'); // which is why he was taken for infantry
    expect(COMPANIES.archers.units).toHaveProperty('slinger');
    expect(companyOf('slinger')).toBe('archers');
    expect(companyOf('clubman')).toBe('infantry');
    expect(companyOf('rider')).toBe('cavalry');
    for (const [kind, d] of Object.entries(COMPANIES)) for (const u of Object.keys(d.units)) expect(companyOf(u), u).toBe(kind);
  });
  it('a soldier no company fields goes by the yard that trains him, and one of no yard is of none', () => {
    expect(companyOf('spearman')).toBe('infantry');
    expect(companyOf('bowman')).toBe('archers');
    expect(companyOf('infantry')).toBe('infantry');
    expect(companyOf('villager')).toBeUndefined();
    expect(companyOf('dragon')).toBeUndefined();
  });
  it('so slingers trained on a visit, and a slinger left in a queue, are archers on the map', () => {
    expect(visitArms([{ owner: 0, type: 'slinger', lifespan: 300 }, { owner: 0, type: 'slinger', lifespan: 300 }], 0)).toEqual({ army: {}, trained: { archers: 2 } });
    expect(cleanQueued([{ as: 'slinger', name: 'Tam', seasons: 80 }])).toEqual([{ as: 'slinger', name: 'Tam', seasons: 80 }]);
  });
});

describe('what the panel says a town keeps', () => {
  it('names the share of its women a town keeps a husband for, as the rule has it', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    for (const t of c.territories) if (t.owner === 0 && t !== home) t.owner = -1;
    const f = folkOf(c, home.id);
    Object.assign(f, { men: MEN.floor, women: 12 }); delete f.ages; agesOf(c, home.id, f);
    const was = MEN.couples;
    try {
      MEN.couples = 0.34; expect(noMenText(c, 0, home.id)).toContain('a husband for a third of its women');
      MEN.couples = 0.5; expect(noMenText(c, 0, home.id)).toContain('a husband for half of its women');
      MEN.couples = 0.25; expect(noMenText(c, 0, home.id)).toContain('a husband for a quarter of its women');
    } finally { MEN.couples = was; }
    expect(noMenText(c, 0, home.id)).toContain(`keeps ${MEN.floor} men at the least`);
  });
});
