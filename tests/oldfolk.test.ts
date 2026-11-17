// A taken town's old people (src/sim/oldfolk.ts): counted, becoming the holder's, and costing while they resent it.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { OLD, oldBuild, oldSeason, oldStrain, oldText, oldWeight } from '../src/sim/oldfolk';
import { townTaken } from '../src/sim/conquered';
import { folkOf } from '../src/sim/township';

const taken = (): { c: Campaign; tid: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner === 1)!;
  const f = folkOf(c, t.id); f.men = 8; f.women = 8; f.elders = 0; f.children = 4; delete f.ages; f.wed = 8;
  townTaken(c, t.id, 1, 0); t.owner = 0;
  return { c, tid: t.id };
};
const name = (f: number) => (f === 1 ? 'the Rivals' : 'you');

describe('a taken town\'s old people', () => {
  it('are counted when it is taken: all its people, still of the people it was taken from', () => {
    const { c, tid } = taken(), t = c.territories[tid];
    oldSeason(c, t);
    expect(t.oldFolk?.from).toBe(1);
    expect(t.oldFolk!.n).toBeLessThan(20);
    expect(t.oldFolk!.n).toBeGreaterThan(15);
    expect(oldText(c, tid, name)).toMatch(/still of the Rivals/);
  });

  it('cost the holder while they resent it: building and drift', () => {
    const { c, tid } = taken(), t = c.territories[tid];
    oldSeason(c, t);
    const w = oldWeight(c, tid);
    expect(w).toBeGreaterThan(0.5);
    expect(oldBuild(c, tid)).toBeCloseTo(1 - OLD.build * w, 5);
    expect(oldStrain(c, tid)).toBeGreaterThan(0);
    expect(oldText(c, tid, name)).toMatch(/building .* slower/);
  });

  it('become the holder\'s faster as resentment eases and by marriage; taken back, none of another\'s are in it', () => {
    const { c, tid } = taken(), t = c.territories[tid], f = folkOf(c, tid);
    oldSeason(c, t);
    const first = t.oldFolk!.n;
    oldSeason(c, t);
    const angry = first - t.oldFolk!.n;
    t.yoke!.resent = 0;
    const before = t.oldFolk!.n;
    oldSeason(c, t);
    expect(before - t.oldFolk!.n).toBeGreaterThan(angry);
    const was = t.oldFolk!.n; f.wed = (f.wed ?? 0) + 2;
    oldSeason(c, t);
    expect(t.oldFolk?.n ?? 0).toBeLessThanOrEqual(was - 2);
    t.owner = 1; oldSeason(c, t);
    expect(t.oldFolk).toBeUndefined();
  });

  it('a town never taken has none, and costs nothing', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const tid = c.territories.find((x) => x.capital === 0)!.id;
    oldSeason(c, c.territories[tid]);
    expect(c.territories[tid].oldFolk).toBeUndefined();
    expect(oldBuild(c, tid)).toBe(1);
    expect(oldStrain(c, tid)).toBe(0);
    expect(oldText(c, tid, name)).toBe('');
  });
});
