// The rim of true wilderness is always snow or desert, the waste nobody farms (src/sim/rim.ts rimWaste, campaignbase.ts wasteAt).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { biomeAt, biomeOf, climateAt, wasteAt } from '../src/sim/campaignbase';
import { RIM, rimWaste } from '../src/sim/rim';
import { wilderness } from '../src/sim/wilds';

const SNOW = /Frozen Reach|White Waste|Ice Marches|Winter Fells/, SAND = /Burning Waste|Red Sands|Dry Marches|Salt Flats/;

describe('the rim is a waste', () => {
  it('every rim land is snow or desert, its name says which, and its climate is that waste', () => {
    let rims = 0, green = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      for (const t of c.territories.filter((x) => x.rim)) {
        rims++;
        expect(['snow', 'desert']).toContain(t.waste);
        expect(t.name).toMatch(t.waste === 'snow' ? SNOW : SAND);
        expect(biomeOf(c, t.id)).toBe(t.waste);
        expect(wilderness(c, t.id)).toBe(true);
        const b = biomeAt(c.seed, t.x, t.y);
        if (b !== 'snow' && b !== 'desert') green++;
        else expect(t.waste).toBe(b); // where the place is a waste already, it is that one
      }
    }
    expect(rims).toBeGreaterThan(40);
    expect(green).toBeGreaterThan(0); // some lie where the country round them is green: they are a waste all the same
  }, 120_000);

  it('in green country it is snow on the colder side of the middle warmth and desert on the hotter', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60 && seen < 40; seed++) for (let y = 30; y < 800; y += 97) for (let x = 30; x < 1200; x += 131) {
      const b = biomeAt(seed, x, y);
      if (b === 'snow' || b === 'desert') continue;
      seen++;
      expect(wasteAt(seed, x, y)).toBe(climateAt(seed, x, y).warm < RIM.middle ? 'snow' : 'desert');
      expect(rimWaste(seed, x, y)).toBe(wasteAt(seed, x, y, RIM.middle));
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('a campaign saved before its rim kept a waste reads the same one', () => {
    const c = newCampaign(7, 2, 1, 'hearth'), t = c.territories.find((x) => x.rim);
    if (!t) return;
    const was = t.waste;
    delete t.waste;
    expect(biomeOf(c, t.id)).toBe(was);
  });

  it('no land of the world but the rim\'s is changed: their climate is where they lie', () => {
    const c = newCampaign(3, 2, 1, 'hearth');
    for (const t of c.territories.filter((x) => !x.rim)) { expect(t.waste).toBeUndefined(); expect(biomeOf(c, t.id)).toBe(biomeAt(c.seed, t.x, t.y)); }
  });
});
