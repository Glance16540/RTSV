// The old people of a taken town (src/sim/oldpeople.ts): counted, joining the taker over the years, and what their grudge costs.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { OLD, grudge, grudgeWatch, grudgeWork, oldCount, oldSeason, oldShare } from '../src/sim/oldpeople';
import { YOKE, seasonOfYoke, townTaken } from '../src/sim/conquered';
import { defenceOf } from '../src/sim/threats';
import { THREATS } from '../src/sim/threatsbase';
import { TOWN_SCALE as S, folkOf, grown } from '../src/sim/township';

/** A rival's town of ten men and ten women (as towns were) with no army, band or wild mark, about to be taken by the player. */
function world(seed = 11): { c: Campaign; t: Territory } {
  const c = newCampaign(seed, 2);
  c.armies = []; c.bands = []; c.events = []; c.turn = 20;
  const t = c.territories.find((x) => x.owner === 1 && x.capital < 0) ?? c.territories.find((x) => x.owner === 1)!;
  delete t.wild; delete t.horde; delete t.yoke; delete t.old; t.buildings = [];
  Object.assign(folkOf(c, t.id), { men: 10 * S, women: 10 * S, elders: 0, children: 6 * S, hungry: 0 });
  delete folkOf(c, t.id).ages;
  return { c, t };
}
const take = (c: Campaign, t: Territory, by = 0): void => { townTaken(c, t.id, t.owner, by); t.owner = by; };

describe('the old people of a taken town', () => {
  it('are every grown person in it when it is taken, of the people it was taken from; a town never taken has none', () => {
    const { c, t } = world();
    expect(oldCount(c, t.id)).toBe(0);
    oldSeason(c);
    expect(t.old).toBeUndefined();
    take(c, t);
    expect(t.yoke).toMatchObject({ from: 1 });
    oldSeason(c);
    expect(t.old).toMatchObject({ of: 1, since: c.turn });
    expect(oldCount(c, t.id)).toBeGreaterThan(18 * S); // all twenty, less the first season's joining
    expect(oldCount(c, t.id)).toBeLessThanOrEqual(20 * S);
    expect(oldShare(c, t.id)).toBeGreaterThan(0.9);
  });

  it('join the taker over the years, sooner as the town resents less, until none is left', () => {
    const years = (resent: number): number => {
      const { c, t } = world();
      take(c, t);
      let seasons = 0;
      while ((seasons === 0 || t.old) && seasons < 400) { t.yoke!.resent = resent; c.turn++; oldSeason(c); seasons++; }
      expect(t.old).toBeUndefined();
      return seasons / 4;
    };
    const content = years(0), sullen = years(100);
    expect(content).toBeGreaterThan(5);
    expect(content).toBeLessThan(25);
    expect(sullen).toBeGreaterThan(content * 2); // a town that still hates its holder keeps to itself
    // Half of them have joined in about three years where nothing is resented.
    const { c, t } = world();
    take(c, t);
    for (let i = 0; i < 12; i++) { t.yoke!.resent = 0; c.turn++; oldSeason(c); }
    expect(oldShare(c, t.id)).toBeGreaterThan(0.35);
    expect(oldShare(c, t.id)).toBeLessThan(0.6);
  });

  it('are never more than the town has: those who die or leave are old people no longer', () => {
    const { c, t } = world();
    take(c, t);
    oldSeason(c);
    Object.assign(folkOf(c, t.id), { men: 2 * S, women: 2 * S });
    expect(oldCount(c, t.id)).toBe(4 * S);
    oldSeason(c);
    expect(t.old!.n).toBeLessThanOrEqual(4 * S);
  });

  it('are none once its own people have it back or it is nobody\'s, and are counted anew when a third people takes it', () => {
    const { c, t } = world();
    take(c, t);
    oldSeason(c);
    take(c, t, 1); // back to those it was taken from
    expect(t.yoke).toBeUndefined();
    expect(oldCount(c, t.id)).toBe(0);
    oldSeason(c);
    expect(t.old).toBeUndefined();
    take(c, t, 0);
    c.turn += 8; for (let i = 0; i < 8; i++) oldSeason(c);
    const left = t.old!.n;
    expect(left).toBeLessThan(20 * S);
    c.turn++;
    take(c, t, 2); // a third people: everyone in it is of whoever held it
    oldSeason(c);
    expect(t.old).toMatchObject({ of: 0, since: c.turn });
    expect(t.old!.n).toBeGreaterThan(left);
    t.owner = -1; // it rises and is nobody's
    oldSeason(c);
    expect(t.old).toBeUndefined();
  });

  it('is run with the yoke\'s own season', () => {
    const { c, t } = world();
    take(c, t);
    seasonOfYoke(c);
    expect(t.old).toBeDefined();
  });
});

describe('what a taken town\'s resentment costs its holder', () => {
  it('the grudge is the share of the town that is still the old people\'s, times how it resents; nothing where either is nothing', () => {
    const { c, t } = world();
    expect(grudge(c, t.id)).toBe(0);
    expect(grudgeWork(c, t.id)).toBe(1);
    expect(grudgeWatch(c, t.id)).toBe(1);
    take(c, t);
    oldSeason(c);
    t.old!.n = 20 * S; t.yoke!.resent = 100;
    expect(grudge(c, t.id)).toBe(1);
    expect(grudgeWork(c, t.id)).toBeCloseTo(1 - OLD.harvest);
    expect(grudgeWatch(c, t.id)).toBeCloseTo(1 - OLD.watch);
    t.yoke!.resent = 50;
    expect(grudge(c, t.id)).toBeCloseTo(0.5);
    t.old!.n = 10 * S;
    expect(grudge(c, t.id)).toBeCloseTo(0.25);
    t.yoke!.resent = 0;
    expect(grudge(c, t.id)).toBe(0);
    expect(grudgeWork(c, t.id)).toBe(1);
  });

  it('its men count for less on the walls against a band while it lasts', () => {
    const { c, t } = world();
    const free = defenceOf(c, t.id).men;
    take(c, t);
    oldSeason(c);
    t.old!.n = 20 * S; t.yoke!.resent = 100;
    const held = defenceOf(c, t.id).men;
    expect(held / free).toBeCloseTo(1 - OLD.watch, 1);
    expect(free).toBeGreaterThan(0);
    expect(THREATS.man).toBeGreaterThan(0);
    t.yoke!.resent = YOKE.quiet; // nearly settled: nearly its whole watch
    expect(defenceOf(c, t.id).men / free).toBeGreaterThan(0.9);
  });
});
