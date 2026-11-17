// Marriages on the map (src/sim/marriage.ts): couples are the married; the unmarried marry, or go to a town beside.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { MARRY, marryAcross, marryIn, singles, wedOf } from '../src/sim/marriage';
import { couplesOf } from '../src/sim/seasonfolk';
import { folkOf } from '../src/sim/township';

const world = (): { c: Campaign; tid: number; near: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  const near = c.territories[tid].adj.find((n) => c.territories[n].owner !== 1)!;
  c.territories[near].owner = 0; delete c.territories[near].horde;
  for (const id of [tid, near]) { const f = folkOf(c, id); f.elders = 0; delete f.ages; delete f.wed; f.stores.food = 3000; }
  return { c, tid, near };
};

describe('marriages on the map', () => {
  it('a town first asked after counts every pair married; a death undoes a couple', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    f.men = 6; f.women = 4;
    expect(wedOf(f)).toBe(4);
    f.women = 3;
    expect(wedOf(f)).toBe(3);
    expect(singles(f)).toEqual({ men: 3, women: 0 });
  });

  it('the unmarried marry, some each season, and only the married are couples', () => {
    const { c, tid } = world(), f = folkOf(c, tid), t = c.territories[tid];
    f.men = 4; f.women = 4; f.wed = 0;
    expect(couplesOf(t, f)).toBe(0);
    expect(marryIn(c, tid)).toBe(Math.max(1, Math.floor(4 * MARRY.rate)));
    expect(f.wed).toBe(Math.max(1, Math.floor(4 * MARRY.rate)));
    for (let i = 0; i < 5; i++) marryIn(c, tid);
    expect(f.wed).toBe(4);
    expect(marryIn(c, tid)).toBe(0);
  });

  it('where a town has unmarried men and none of its women free, a woman of the town beside comes to marry, never the last', () => {
    const { c, tid, near } = world();
    const a = folkOf(c, tid), b = folkOf(c, near);
    a.men = 6; a.women = 3; a.wed = 3; // three single men
    b.men = 2; b.women = 5; b.wed = 2; // three single women
    const went = marryAcross(c, 0);
    expect(went).toHaveLength(1);
    expect(went[0]).toEqual({ from: near, to: tid, sex: 'women' });
    expect(b.women).toBe(4);
  });
});
