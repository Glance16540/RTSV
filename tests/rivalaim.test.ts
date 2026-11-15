// Where a rival marches: the country and the town's faith are weighed (src/sim/rivalaim.ts).
import { describe, expect, it } from 'vitest';
import { biomeOf, newCampaign } from '../src/sim/campaign';
import { COUNTRY, countryYield } from '../src/sim/country';
import { AIM, REDEPLOY, aimAt, aimOrder, aimText, faithGap, marchInto, redeploy } from '../src/sim/rivalaim';
import { nationVirtue } from '../src/sim/townfaith';

/** A world with a land of each of the two kinds of country asked for, neither the rival's: the country is the map's, so worlds are tried until one has both. */
const world = (first = 'grass', second = 'grass') => {
  for (let seed = 1; seed <= 60; seed++) {
    const c = newCampaign(seed, 2, 1);
    const free = c.territories.filter((t) => t.owner !== 1 && !t.horde && t.capital < 0);
    const a = free.find((t) => biomeOf(c, t.id) === first), b = free.find((t) => biomeOf(c, t.id) === second && t !== a);
    if (!a || !b) continue;
    for (const t of [a, b]) { t.virtue = nationVirtue(c, 1); t.buildings = []; }
    return { c, a: a.id, b: b.id };
  }
  throw new Error(`no world with ${first} and ${second}`);
};

describe('a rival weighs the country and the town\'s faith when it chooses where to march', () => {
  it('of two lands as well defended, it wants the one it marches into more easily', () => {
    const { c, a, b } = world('marsh', 'steppe');
    expect(marchInto(c, a)).toBe(COUNTRY.marsh.march);
    expect(marchInto(c, b)).toBe(COUNTRY.steppe.march);
    expect(aimAt(c, 1, b, 4)).toBeLessThan(aimAt(c, 1, a, 4));
    expect(aimOrder(c, 1, [a, b], () => 4)).toEqual([b, a]);
  });

  it('thin country is wanted less than good country', () => {
    const { c, a, b } = world('desert', 'grass');
    c.territories[b].buildings = ['farm'];
    expect(countryYield(c, a)).toBeLessThan(countryYield(c, b));
    // The desert is the harder march as well; set the defences so that the march alone would not decide it.
    const da = 4 * COUNTRY.desert.march, db = 4;
    expect(da / marchInto(c, a)).toBeCloseTo(db / marchInto(c, b));
    expect(aimOrder(c, 1, [a, b], (id) => (id === a ? da : db))).toEqual([b, a]);
    expect(aimAt(c, 1, a, da) - aimAt(c, 1, b, db)).toBeCloseTo(AIM.yield * (countryYield(c, b) - countryYield(c, a)));
  });

  it('a town whose faith is far from its own is wanted less', () => {
    const { c, a, b } = world();
    const mine = nationVirtue(c, 1);
    c.territories[b].virtue = mine >= 0 ? mine - 100 : mine + 100;
    expect(faithGap(c, 1, a)).toBe(0);
    expect(faithGap(c, 1, b)).toBe(100);
    expect(aimAt(c, 1, b, 4) - aimAt(c, 1, a, 4)).toBeCloseTo(AIM.faith);
    expect(aimOrder(c, 1, [b, a], () => 4)).toEqual([a, b]);
    expect(aimText(c, 1, b)).toContain('a faith far from theirs');
    expect(aimText(c, 1, a)).toContain('a faith like theirs');
  });

  it('a land much the softer is still the one it wants, whatever the country', () => {
    const { c, a, b } = world('desert', 'grass');
    const mine = nationVirtue(c, 1);
    c.territories[a].virtue = mine >= 0 ? mine - 100 : mine + 100;
    expect(aimOrder(c, 1, [a, b], (id) => (id === a ? 1 : 9))).toEqual([a, b]);
  });

  it('lands weighed alike keep the order they came in', () => {
    const { c, a, b } = world();
    expect(aimOrder(c, 1, [b, a], () => 3)).toEqual([b, a]);
    expect(aimOrder(c, 1, [], () => 3)).toEqual([]);
  });
});

describe('an army with nothing it dares goes to a border where there is something', () => {
  /** A row of lands 0-1-2-3-4, all the rival's but the last. */
  const row = () => {
    const c = newCampaign(7, 2, 1);
    c.territories = c.territories.slice(0, 5);
    c.territories.forEach((t, i) => { t.id = i; t.adj = [i - 1, i + 1].filter((n) => n >= 0 && n < 5); t.owner = i < 4 ? 1 : 2; t.horde = false; });
    const reachOf = (id: number) => c.territories[id].adj;
    return { c, reachOf };
  };

  it('it takes the first step of the shortest way through its own lands', () => {
    const { c, reachOf } = row();
    const dares = (land: number) => land === 3; // only from the land next to the foe
    expect(redeploy(c, 1, 0, dares, reachOf)).toBe(1);
    expect(redeploy(c, 1, 2, dares, reachOf)).toBe(3);
  });

  it('it stays where it already dares, and where there is nowhere to go', () => {
    const { c, reachOf } = row();
    expect(redeploy(c, 1, 3, (land) => land === 3, reachOf)).toBe(-1);
    expect(redeploy(c, 1, 0, () => false, reachOf)).toBe(-1);
  });

  it('it goes by its own people\'s lands only, and no further than REDEPLOY of them', () => {
    const { c, reachOf } = row();
    c.territories[2].owner = 2; // the way is cut
    expect(redeploy(c, 1, 0, (land) => land === 3, reachOf)).toBe(-1);
    const long = newCampaign(7, 2, 1);
    long.territories = long.territories.slice(0, 10);
    long.territories.forEach((t, i) => { t.id = i; t.adj = [i - 1, i + 1].filter((n) => n >= 0 && n < 10); t.owner = 1; t.horde = false; });
    const reachLong = (id: number) => long.territories[id].adj;
    expect(redeploy(long, 1, 0, (land) => land === REDEPLOY, reachLong)).toBe(1);
    expect(redeploy(long, 1, 0, (land) => land === REDEPLOY + 1, reachLong)).toBe(-1);
  });
});
