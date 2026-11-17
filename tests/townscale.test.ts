// Towns of any size are as hard to take and to raid as towns were (township.ts TOWN_SCALE): the threats' and the
// tribes' side. Written in terms of the scale, so that it holds whatever the scale is turned to.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { TOWN_SCALE, folkOf, headcount } from '../src/sim/township';
import { TRIBE, bandMen, setTribe, tribeBeaten, warriorsOf } from '../src/sim/tribes';
import { defenceOf } from '../src/sim/threats';
import { THREATS } from '../src/sim/threatsbase';
import { FREE, riseFree, treatCost } from '../src/sim/freetown';

function world() {
  const c = newCampaign(11, 2);
  c.armies = []; c.bands = []; c.turn = 20;
  for (const t of c.territories) { delete t.wild; delete t.horde; }
  return c;
}

describe('a town as large as towns now are', () => {
  it('a tribe fields a band for every TRIBE.men of a town as towns were: the same bands from a town TOWN_SCALE times the size', () => {
    const c = world(), t = c.territories.find((x) => x.owner < 0)!;
    expect(bandMen()).toBe(TRIBE.men * TOWN_SCALE);
    setTribe(c, t.id, 3);
    expect(folkOf(c, t.id).men).toBe(3 * TRIBE.men * TOWN_SCALE);
    expect(warriorsOf(c, t.id)).toBe(3);
    folkOf(c, t.id).men += bandMen() - 1; // not quite another band's worth
    expect(warriorsOf(c, t.id)).toBe(3);
    folkOf(c, t.id).men += 1;
    expect(warriorsOf(c, t.id)).toBe(4);
  });

  it('a tribe beaten off loses a band\'s worth of men for each band, and is never left with fewer than its least', () => {
    const c = world(), t = c.territories.find((x) => x.owner < 0)!;
    setTribe(c, t.id, 4);
    expect(tribeBeaten(c, t.id, 1)).toBe(bandMen());
    expect(warriorsOf(c, t.id)).toBe(3);
    expect(tribeBeaten(c, t.id, 9)).toBe((3 - TRIBE.least) * bandMen());
    expect(warriorsOf(c, t.id)).toBe(TRIBE.least);
  });

  it('a town meets a band with its men as a share of a town: THREATS.man for each man of a town as towns were', () => {
    const c = world(), t = c.territories.find((x) => x.owner === 0 && x.capital < 0) ?? c.territories.find((x) => x.owner === 0)!;
    const f = folkOf(c, t.id);
    f.men = 6 * TOWN_SCALE; delete f.ages;
    const six = defenceOf(c, t.id).men;
    f.men = 12 * TOWN_SCALE; delete f.ages;
    const twelve = defenceOf(c, t.id).men;
    expect(twelve).toBeCloseTo(six * 2);
    expect(six / (6 * THREATS.man)).toBeGreaterThan(0.5); // six men's worth, give or take the town's watch
    expect(six / (6 * THREATS.man)).toBeLessThan(2);
  });

  it('a free town asks a price by its size as a share of a town', () => {
    const c = world(), t = c.territories.find((x) => x.owner === 0 && x.capital < 0) ?? c.territories.find((x) => x.owner === 0)!;
    Object.assign(folkOf(c, t.id), { men: 10 * TOWN_SCALE, women: 10 * TOWN_SCALE, elders: 0, children: 0 });
    delete folkOf(c, t.id).ages;
    riseFree(c, t.id);
    c.turn += FREE.ease * 2; // long free: only its size is in the price
    expect(headcount(folkOf(c, t.id))).toBe(20 * TOWN_SCALE);
    expect(treatCost(c, t.id)).toBe(Math.max(FREE.least, Math.ceil(20 / FREE.folk)));
  });
});
