// The older chance events of a turn, fever in the camp and a hard season, go by the town's creed (src/sim/chancecreed.ts).
import { describe, expect, it } from 'vitest';
import { answerDemand, continueAI, endTurn, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { wrathAt } from '../src/sim/acts';
import { CHANCE_CREED, befalls, feverToll, hardCost } from '../src/sim/chancecreed';

const base = JSON.stringify(newCampaign(5, 2));
const world = (virtue: number): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  const t = c.territories.find((x) => x.owner === 0)!;
  t.virtue = virtue;
  return { c, at: t.id };
};
/** Over many seasons, the share in which `f` is true of the town. */
const share = (virtue: number, f: (c: Campaign, at: number) => boolean, n = 4000): number => {
  const { c, at } = world(virtue);
  let k = 0;
  for (let i = 0; i < n; i++) { c.turn = 10 + i; if (f(c, at)) k++; }
  return k / n;
};

describe('fever and a hard season go by the town\'s creed', () => {
  it('a hard season costs by the town\'s measure: 1 from the Virtuous, 2 Upright, 3 ordinary, 4 Dissolute, 5 Depraved', () => {
    expect([90, 50, 0, -50, -90].map((v) => { const { c, at } = world(v); return hardCost(c, at); })).toEqual([1, 2, 3, 4, 5]);
    expect(CHANCE_CREED.hard).toBe(3);
  });
  it('they pass the holy by, by their measure, and always fall on an ordinary town or worse', () => {
    expect(share(0, befalls)).toBe(1);
    expect(share(-50, befalls)).toBe(1);
    expect(share(-90, befalls)).toBe(1);
    const holy = share(90, befalls), devout = share(50, befalls);
    expect(holy).toBeGreaterThan(1 / 3 - 0.03); expect(holy).toBeLessThan(1 / 3 + 0.03);
    expect(devout).toBeGreaterThan(0.5 - 0.03); expect(devout).toBeLessThan(0.5 + 0.03);
  });
  it('a fever takes one company, and from the worldly a second by the share their measure is over one', () => {
    const two = (c: Campaign, at: number) => feverToll(c, at) === 2;
    expect(share(90, two)).toBe(0);
    expect(share(0, two)).toBe(0);
    const worldly = share(-50, two), low = share(-90, two);
    expect(worldly).toBeGreaterThan(0.25 - 0.03); expect(worldly).toBeLessThan(0.25 + 0.03);
    expect(low).toBeGreaterThan(0.5 - 0.03); expect(low).toBeLessThan(0.5 + 0.03);
  });
  it('is the town\'s own standing that counts, not its people\'s, and a town of nobody\'s is ordinary', () => {
    const { c, at } = world(90);
    c.factions[0].virtue = -90;
    expect(wrathAt(c, at)).toBeCloseTo(1 / 3);
    expect(hardCost(c, at)).toBe(1);
    const wild = c.territories.find((t) => t.owner < 0)!;
    expect(hardCost(c, wild.id)).toBe(3);
    expect(befalls(c, wild.id)).toBe(true);
  });
  it('asked twice in a season it answers the same, and spends none of the campaign\'s own luck', () => {
    const { c, at } = world(90), rng = c.rngState;
    c.turn = 33;
    expect(befalls(c, at)).toBe(befalls(c, at));
    expect(feverToll(c, at)).toBe(feverToll(c, at));
    expect(c.rngState).toBe(rng);
  });
  it('in a campaign as it is played, a hard season is told at a cost the rule allows and a fever at one company or two', () => {
    const hard: number[] = [], fever: string[] = [];
    for (const seed of [2, 4, 6]) {
      const c = newCampaign(seed, 2);
      for (let s = 0; s < 80 && c.phase !== 'over'; s++) {
        endTurn(c);
        for (let i = 0; i < 200 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
        if (c.pending) resolvePending(c, 'auto');
      }
      for (const line of c.log) {
        const h = /^A hard season in .* costs (\d+) of /.exec(line); if (h) hard.push(+h[1]);
        const f = /^Fever in the camp at .* costs .* army (a company|2 companies)\.$/.exec(line); if (f) fever.push(f[1]);
        expect(/^Fever in the camp/.test(line) && !f).toBe(false);
      }
    }
    expect(hard.length).toBeGreaterThan(0);
    for (const n of hard) { expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThanOrEqual(5); }
  }, 60_000);
});
