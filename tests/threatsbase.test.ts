// The numbers of the threats of men, on their own (src/sim/threatsbase.ts). Nothing here but numbers: these check
// that they hang together, so that a port that copies them over has something to hold them to.
import { describe, expect, it } from 'vitest';
import { THREATS } from '../src/sim/threatsbase';
import { BANDS, BandKind } from '../src/sim/threats';

const share = (x: number) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(1); };

describe('threatsbase', () => {
  it('bands come from a season on, a few at a time, and grow within bounds', () => {
    expect(Number.isInteger(THREATS.from)).toBe(true);
    expect(THREATS.from).toBeGreaterThan(0);
    expect(THREATS.lands).toBeGreaterThan(0);
    expect(THREATS.most).toBeGreaterThan(0);
    const [least, most] = THREATS.start;
    expect(least).toBeGreaterThan(0);
    expect(least).toBeLessThanOrEqual(most);
    expect(most).toBeLessThanOrEqual(THREATS.max);
    expect(THREATS.grow).toBeGreaterThan(0);
  });

  it('every chance and share is between nought and one', () => {
    for (const x of [THREATS.appear, THREATS.strike, THREATS.grudge, THREATS.hold, THREATS.fall, THREATS.sick, THREATS.pirateLoot, THREATS.road, THREATS.carried, THREATS.left, THREATS.burn]) share(x);
    for (const x of Object.values(THREATS.dead)) share(x);
  });

  it('a town holds above the line it falls under, and the dead rise with how badly it went', () => {
    expect(THREATS.hold).toBeGreaterThan(THREATS.fall);
    expect(THREATS.dead.held).toBeLessThanOrEqual(THREATS.dead.raided);
    expect(THREATS.dead.raided).toBeLessThanOrEqual(THREATS.dead.taken);
  });

  it('a strike sways a people up when held and down when raided, and further down when taken', () => {
    expect(THREATS.sway.held).toBeGreaterThan(0);
    expect(THREATS.sway.raided).toBeLessThan(0);
    expect(THREATS.sway.taken).toBeLessThan(THREATS.sway.raided);
  });

  it('every kind of band has what it can carry, and only those', () => {
    const kinds = Object.keys(BANDS) as BandKind[];
    expect(Object.keys(THREATS.carry).sort()).toEqual([...kinds].sort());
    for (const k of kinds) expect(THREATS.carry[k]).toBeGreaterThan(0);
    // Pirates have ships to fill; marauders come for women and take little else.
    expect(THREATS.carry.pirates).toBe(Math.max(...Object.values(THREATS.carry)));
    expect(THREATS.carry.marauders).toBe(Math.min(...Object.values(THREATS.carry)));
  });

  it('what counts toward a town\'s defence is all positive, and the caps on towers and walls are whole numbers', () => {
    for (const k of ['man', 'fortress', 'raising', 'tower', 'wall', 'capital', 'wayfarers'] as const) expect(THREATS[k], k).toBeGreaterThan(0);
    expect(Number.isInteger(THREATS.towers)).toBe(true);
    expect(Number.isInteger(THREATS.walls)).toBe(true);
  });

  it('captives can be got back for some seasons, at a cost in years, and a few reports are kept', () => {
    expect(THREATS.holdFor).toBeGreaterThan(0);
    expect(THREATS.yearsMan).toBeGreaterThan(0);
    expect(THREATS.yearsWoman).toBeGreaterThan(0);
    expect(THREATS.last).toBeGreaterThan(0);
    expect(THREATS.larder).toBeGreaterThan(0);
    expect(THREATS.prize).toBeGreaterThan(0);
    expect(Number.isInteger(THREATS.kept)).toBe(true);
    expect(THREATS.kept).toBeGreaterThan(0);
  });
});
