// A governor's standing orders (src/sim/townorders.ts, read by governor.ts and migration.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { FOCUS, forbids, keepTimes, mayLeave, raiseFor, setStanding, standingText } from '../src/sim/townorders';
import { governTown, workOf } from '../src/sim/governor';
import { GOVERN } from '../src/sim/governor';
import { folkOf } from '../src/sim/township';
import { layTown } from '../src/sim/rivalrule';

const world = (): { c: Campaign; tid: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  const f = folkOf(c, tid); f.men = 8; f.women = 8; f.elders = 0; delete f.ages;
  f.stores = { food: 4000, wood: 4000, gold: 4000, stone: 4000 };
  layTown(c, tid);
  return { c, tid };
};

describe('a governor\'s standing orders', () => {
  it('with none, the town is kept as before; only the player\'s own towns take them', () => {
    const { c, tid } = world(), t = c.territories[tid];
    expect(workOf(t)).toEqual(GOVERN.work);
    expect(keepTimes(t)).toBe(1);
    expect(mayLeave(c, tid, 'family')).toBe(true);
    expect(standingText(t, (x) => x)).toMatch(/own sense/);
    const rival = c.territories.find((x) => x.owner === 1)!;
    expect(setStanding(c, rival.id, { first: 'walls' })).toMatch(/your own/);
  });

  it('what comes first sets the hands, where the player has not, and the governor raises what serves it', () => {
    const { c, tid } = world(), t = c.territories[tid];
    t.buildings = t.buildings.filter((b) => b !== 'fortress');
    expect(setStanding(c, tid, { first: 'walls' })).toBe('');
    expect(workOf(t)).toEqual(FOCUS.walls.work);
    expect(raiseFor(t)).toBe('fortress');
    // What the town wants comes first (a Mill, a Well...); then what the player has put first.
    let g = governTown(c, tid)!;
    for (let i = 0; i < 8 && g.began !== 'fortress'; i++) { c.turn++; folkOf(c, tid).stores = { food: 4000, wood: 4000, gold: 4000, stone: 4000 }; g = governTown(c, tid)!; }
    expect(g.began).toBe('fortress');
    expect(g.ordered).toBe(true);
    expect(t.buildings).toContain('fortress');
    expect(c.log.some((l) => /By your orders/.test(l))).toBe(true);
    // The player's own orders for the work stand.
    t.orders = { work: { food: 10, wood: 0, gold: 0, stone: 0 }, turn: c.turn };
    expect(workOf(t).food).toBe(1);
  });

  it('what he is told not to build, he does not', () => {
    const { c, tid } = world(), t = c.territories[tid];
    t.buildings = t.buildings.filter((b) => b !== 'fortress');
    setStanding(c, tid, { first: 'walls', never: ['fortress'] });
    expect(forbids(t, 'fortress')).toBe(true);
    expect(raiseFor(t)).toBeUndefined();
    governTown(c, tid);
    expect(t.buildings).not.toContain('fortress');
  });

  it('how much to keep: told to keep much, he does not spend what he would have', () => {
    const { c, tid } = world(), t = c.territories[tid], f = folkOf(c, tid);
    t.buildings = t.buildings.filter((b) => b !== 'church');
    f.stores = { food: 4000, wood: 500, gold: 500, stone: 500 };
    setStanding(c, tid, { first: 'faith', keep: 'much', never: ['mill', 'well', 'infirmary', 'granary'] });
    expect(keepTimes(t)).toBe(2);
    governTown(c, tid);
    expect(t.buildings).not.toContain('church');
    setStanding(c, tid, { keep: 'little' });
    f.stores = { food: 4000, wood: 500, gold: 500, stone: 500 };
    governTown(c, tid);
    expect(t.buildings).toContain('church');
  });

  it('whether its people may leave', () => {
    const { c, tid } = world();
    setStanding(c, tid, { leave: 'families' });
    expect(mayLeave(c, tid, 'family')).toBe(true);
    expect(mayLeave(c, tid, 'settlers')).toBe(false);
    setStanding(c, tid, { leave: 'none' });
    expect(mayLeave(c, tid, 'family')).toBe(false);
    setStanding(c, tid, { leave: 'both', first: null, keep: 'usual', never: [] });
    expect(c.territories[tid].standing).toBeUndefined(); // nothing left standing
  });
});
