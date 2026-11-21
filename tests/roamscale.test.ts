// On a wider map a camp looks farther and minds the march less; on today's maps nothing changes (src/sim/bandroam.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { ROAM, roamRange, roamScale, waysFrom, weighed } from '../src/sim/bandroam';
import { landsWithin } from '../src/sim/rim';
import type { Band } from '../src/sim/threats';

/** The same world with so many lands inside the rim, by adding empty lands that touch nothing. */
const widened = (c: Campaign, lands: number): Campaign => {
  const w: Campaign = JSON.parse(JSON.stringify(c));
  while (landsWithin(w) < lands) w.territories.push({ ...JSON.parse(JSON.stringify(w.territories.find((t) => !t.rim && t.owner < 0)!)), id: w.territories.length, adj: [], owner: -1, capital: -1 });
  return w;
};
const camp = (c: Campaign): Band => {
  const at = c.territories.find((t) => !t.rim && t.owner < 0 && !t.horde && t.adj.length > 1)!.id;
  const b = { id: 7, kind: 'raiders', name: 'the Grey Band', at, strength: 5, since: 1, held: [] } as Band;
  c.bands = [b];
  return b;
};

describe('how far a camp looks', () => {
  it('on every map made today it is as it was: four lands, and the march weighed as before', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const c = newCampaign(seed, 1 + (seed % 5));
      expect(landsWithin(c)).toBeLessThanOrEqual(ROAM.lands);
      expect(roamScale(c)).toBe(1);
      expect(roamRange(c)).toBe(ROAM.range);
      expect(weighed(c, 10, 3)).toBe(10 / (1 + ROAM.far * 2));
    }
  });
  it('on a wider map it looks farther by the map\'s breadth (the root of its lands), never past the widest', () => {
    const c = newCampaign(3, 2);
    expect(roamScale(widened(c, ROAM.lands * 4))).toBe(2);
    expect(roamRange(widened(c, ROAM.lands * 4))).toBe(ROAM.widest);
    const half = widened(c, Math.round(ROAM.lands * 2.25));
    expect(roamScale(half)).toBeCloseTo(1.5, 5);
    expect(roamRange(half)).toBe(6);
    expect(roamRange(widened(c, ROAM.lands * 25))).toBe(ROAM.widest);
    expect(roamRange(widened(c, ROAM.lands + 4))).toBe(ROAM.range); // a little wider: still four
  });
  it('and minds the march less: the same far mark weighs more against a near one', () => {
    const c = newCampaign(3, 2), wide = widened(c, ROAM.lands * 4);
    expect(weighed(wide, 10, 1)).toBe(10); // the first season's march costs nothing either way
    expect(weighed(wide, 10, 4)).toBeGreaterThan(weighed(c, 10, 4));
    expect(weighed(wide, 10, 4)).toBe(10 / (1 + (ROAM.far / 2) * 3));
  });
  it('a camp\'s ways reach farther on the wider map over the very same lands', () => {
    let seen = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const c = newCampaign(seed, 2), wide = widened(c, ROAM.lands * 4);
      const far = (w: Campaign): number => Math.max(0, ...waysFrom(w, camp(w)).map((x) => x.steps));
      const near = far(c), wider = far(wide);
      expect(near).toBeLessThanOrEqual(ROAM.range);
      expect(wider).toBeGreaterThanOrEqual(near);
      if (wider > ROAM.range) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
});
