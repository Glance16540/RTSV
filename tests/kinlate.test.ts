// A strike that falls after the household has looked is weighed the season after (src/sim/kin.ts, unweighed).
// A band's strike on a town of the player's waits on the player and falls once the season has turned (raidfought.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { KIN, kinOf, kinSeason } from '../src/sim/kin';
import { THREATS } from '../src/sim/threats';

const world = (turn: number): { c: Campaign; home: number } => {
  const c = newCampaign(7, 1, 1, 'japan');
  c.turn = turn;
  kinOf(c, 0);
  return { c, home: c.territories.find((t) => t.capital === 0)!.id };
};
const sack = (c: Campaign, at: number) => (c.events ??= []).push({ kind: 'carried', at, turn: c.turn, until: c.turn });
const takenIn = (n: number, play: (c: Campaign, home: number) => void): number => {
  let taken = 0;
  for (let i = 0; i < n; i++) { const { c, home } = world(20 + i); play(c, home); if (c.factions[0].kin!.spouse!.lost?.how === 'taken') taken++; }
  return taken;
};

describe('the household and a strike that waited', () => {
  it('a seat sacked after the household looked is weighed the season after, as often as one it saw fall', () => {
    const late = takenIn(40, (c, home) => { kinSeason(c, 0); sack(c, home); expect(c.factions[0].kin!.spouse!.lost).toBeUndefined(); c.turn++; kinSeason(c, 0); });
    expect(late).toBeGreaterThan(40 * KIN.carried * 0.5);
    expect(late).toBeLessThan(40 * KIN.carried * 1.5);
  });
  it('a sack it saw fall is weighed once, not again the season after', () => {
    const twice = takenIn(40, (c, home) => {
      sack(c, home);
      kinSeason(c, 0);
      const s = c.factions[0].kin!.spouse!;
      if (s.lost) return;
      c.turn++;
      kinSeason(c, 0);
      expect(c.factions[0].kin!.spouse!.lost?.how).not.toBe('taken'); // spared the first season, she is not asked again for the same sack
    });
    expect(twice).toBeLessThan(40 * KIN.carried * 1.5);
  });
  it('of two sacks in a season, one before it looked and one after, only the later is left for next season', () => {
    const { c, home } = world(30);
    sack(c, home);
    kinSeason(c, 0);
    expect(kinOf(c, 0).saw).toEqual({ turn: 30, n: 1 });
    sack(c, home);
    c.turn++;
    const before = kinOf(c, 0).spouse!.lost;
    kinSeason(c, 0);
    expect(kinOf(c, 0).saw).toEqual({ turn: 31, n: 0 });
    if (!before) expect(['taken', undefined]).toContain(kinOf(c, 0).spouse!.lost?.how);
  });
  it('a household that did not look last season weighs nothing old', () => {
    const n = takenIn(20, (c, home) => { sack(c, home); c.turn++; delete kinOf(c, 0).saw; kinSeason(c, 0); });
    expect(n).toBe(0);
  });
  it('she is held by the band that took her in the late sack', () => {
    for (let i = 0; i < 40; i++) {
      const { c, home } = world(20 + i);
      kinSeason(c, 0);
      sack(c, home);
      const name = kinOf(c, 0).spouse!.name;
      c.bands = [{ id: 9, kind: 'raiders', name: 'the Red Hand', at: home, strength: 5, held: [{ from: home, owner: 0, since: c.turn, n: 3 }] } as never];
      c.turn++;
      kinSeason(c, 0);
      const s = kinOf(c, 0).spouse!;
      if (s.lost?.how !== 'taken') continue;
      expect(s.name).toBe(name);
      expect(s.lost.band).toBe(9);
      expect(c.bands![0].held[0].names).toContain(name);
      return;
    }
    throw new Error('never taken in forty worlds');
  });
  it('taken in a late sack and held too long, she is gone for good, not come home', () => {
    for (let i = 0; i < 40; i++) {
      const { c, home } = world(20 + i);
      kinSeason(c, 0);
      sack(c, home);
      const taken = c.turn;
      c.bands = [{ id: 9, kind: 'raiders', name: 'the Red Hand', at: home, strength: 5, held: [{ from: home, owner: 0, since: taken, men: [], women: [30] }] } as never];
      c.turn++;
      kinSeason(c, 0);
      const s = kinOf(c, 0).spouse!;
      if (s.lost?.how !== 'taken') continue;
      expect(s.lost.turn).toBe(taken); // dated from the sack, as her captors date it
      c.turn = taken + THREATS.holdFor;
      c.bands![0].held = []; // her time ran out (threats.ts captivesSeason)
      kinSeason(c, 0);
      expect(kinOf(c, 0).spouse?.name === s.name ? s.lost?.final : true).toBe(true);
      expect(c.chronicle!.some((x) => x.text.includes('is free and has come home'))).toBe(false);
      return;
    }
    throw new Error('never taken in forty worlds');
  });
});
