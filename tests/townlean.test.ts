// Every town its own faith (src/sim/townlean.ts): a lean of its own, and the pull that keeps a nation together.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { LEAN, leanOf, pullFor } from '../src/sim/townlean';
import { PULL, faithAt, faithSpread, nationVirtue, pullTogether, seasonOfFaith, settleFaith, swayTown } from '../src/sim/townfaith';

/** A nation of the player's with these towns held, all built alike (no Church, Tavern or holy place), standing at 0. */
const nation = (n: number): { c: Campaign; towns: number[] } => {
  const c = newCampaign(11, 1, 1, 'hearth');
  const towns = c.territories.filter((t) => !t.horde && !t.wild).slice(0, n).map((t) => t.id);
  for (const t of c.territories) if (t.owner === 0 && !towns.includes(t.id)) t.owner = -1;
  for (const id of towns) { const t = c.territories[id]; t.owner = 0; delete t.horde; t.buildings = t.buildings.filter((b) => b !== 'church' && b !== 'tavern'); t.virtue = 0; }
  settleFaith(c);
  return { c, towns };
};
const seasons = (c: Campaign, k: number): void => { for (let i = 0; i < k; i++) { c.turn++; seasonOfFaith(c, (_f, by, at) => swayTown(c, at, by)); } };

describe('every town its own lean', () => {
  it('is a whole number of steps, never 0, at most LEAN.most either way, and the same each time it is asked', () => {
    const c = newCampaign(3, 1, 1, 'hearth');
    const leans = c.territories.map((t) => leanOf(c, t.id));
    for (const l of leans) { expect(Number.isInteger(l)).toBe(true); expect(l).not.toBe(0); expect(Math.abs(l)).toBeLessThanOrEqual(LEAN.most); }
    expect(new Set(leans).size).toBeGreaterThan(1); // towns differ
    expect(c.territories.map((t) => leanOf(c, t.id))).toEqual(leans);
  });

  it('is the land\'s own: the same under any holder', () => {
    const c = newCampaign(3, 1, 1, 'hearth'), t = c.territories.find((x) => x.owner === 1)!;
    const was = leanOf(c, t.id);
    t.owner = 0;
    expect(leanOf(c, t.id)).toBe(was);
  });

  it('towns built alike stand apart by their leans, and the nation\'s standing is still the mean of its towns', () => {
    const { c, towns } = nation(4);
    seasons(c, 80);
    const leans = towns.map((id) => leanOf(c, id));
    expect(new Set(leans).size).toBeGreaterThan(1); // on this seed the four lean both ways
    expect(faithSpread(c, 0).spread).toBeGreaterThanOrEqual(10);
    expect(c.factions[0].virtue).toBe(nationVirtue(c, 0));
    // A town that leans to piety stands above one that leans to decadence.
    const up = towns.find((id) => leanOf(c, id) > 0), down = towns.find((id) => leanOf(c, id) < 0);
    expect(up !== undefined && down !== undefined).toBe(true);
    expect(faithAt(c, up!)).toBeGreaterThan(faithAt(c, down!));
  });

  it('a town far from its nation is drawn back the harder, so a nation does not fly apart', () => {
    expect(pullFor(10, PULL)).toBe(PULL);
    expect(pullFor(LEAN.far + 1, PULL)).toBeCloseTo(PULL * LEAN.farTimes, 9);
    expect(pullFor(-(LEAN.far + 1), PULL)).toBeCloseTo(PULL * LEAN.farTimes, 9);
    expect(pullFor(LEAN.far + 1, 2 * PULL)).toBeGreaterThan(pullFor(LEAN.far + 1, PULL)); // Pilgrimage still draws the faster
    const { c, towns } = nation(2);
    c.territories[towns[0]].virtue = 60; c.territories[towns[1]].virtue = -20; settleFaith(c);
    pullTogether(c);
    // 40 off the mean of 20 either way: three tenths of it, not a tenth.
    expect(faithAt(c, towns[0])).toBe(60 - Math.round(40 * PULL * LEAN.farTimes));
    expect(faithAt(c, towns[1])).toBe(-20 + Math.round(40 * PULL * LEAN.farTimes));
  });
});
