// A rival's notable homes by which house did most (src/sim/rivalhomes.ts, read by rivalrule.ts notableHome).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { FIELD_WEIGHT, MADE_RENOWN } from '../src/sim/notableweight';
import { RIVAL_HOMES, creditHouses, homeDue, workingHouses } from '../src/sim/rivalhomes';
import { notableHome } from '../src/sim/rivalrule';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
const rivalTown = () => {
  const c: Campaign = JSON.parse(base);
  const t = c.territories.find((x) => x.owner === 1 && x.capital === 1)!;
  c.factions[1].isAI = true;
  Object.assign(folkOf(c, t.id), { men: 6, women: 6, children: 6 });
  return { c, t };
};

describe('a rival\'s houses and what they carry in', () => {
  it('a town\'s working houses share the work, the same every season', () => {
    const { c, t } = rivalTown();
    const hs = workingHouses(c, t.id);
    expect(hs.length).toBeGreaterThan(1);
    expect(hs.length).toBeLessThanOrEqual(RIVAL_HOMES.houses);
    expect(hs.reduce((n, h) => n + h.share, 0)).toBeCloseTo(1, 9);
    expect(workingHouses(c, t.id)).toEqual(hs);
  });

  it('the season\'s harvest is counted to them, food from the fields at its weight, once a season', () => {
    const { c, t } = rivalTown();
    const f = folkOf(c, t.id);
    f.reaped = { turn: c.turn, food: 1000 };
    expect(creditHouses(c, t.id)).toBe(1000);
    expect(Object.values(f.made!).reduce((a, b) => a + b, 0)).toBeCloseTo(1000 * FIELD_WEIGHT, 6);
    expect(creditHouses(c, t.id)).toBe(0); // not twice for one harvest
  });

  it('the house that did most is the next known home, once it has done enough; up to a few to a town', () => {
    const { c, t } = rivalTown();
    const f = folkOf(c, t.id);
    f.made = { Ashby: MADE_RENOWN - 1, Brand: MADE_RENOWN * 2, Cole: MADE_RENOWN * 3 };
    expect(homeDue(c, t.id)!.family).toBe('Cole');
    expect(notableHome(c, t.id)).toBe(true);
    expect(f.notables.at(-1)).toMatchObject({ kind: 'mother', family: 'Cole', made: MADE_RENOWN * 3 });
    expect(homeDue(c, t.id)!.family).toBe('Brand'); // the next
    expect(notableHome(c, t.id)).toBe(true);
    expect(homeDue(c, t.id)).toBeUndefined(); // Ashby has not done enough
    f.made.Ashby = MADE_RENOWN * 5; f.made.Dunn = MADE_RENOWN * 5;
    expect(notableHome(c, t.id)).toBe(true);
    expect(f.notables.filter((n) => n.kind === 'mother').length).toBe(RIVAL_HOMES.most);
    expect(notableHome(c, t.id)).toBe(false); // no more than a few to a town
  });
});
