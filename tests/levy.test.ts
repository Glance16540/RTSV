// A company its town cannot man is filled from its people's other towns (src/sim/armytown.ts).
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { armyAt, raise } from '../src/sim/campaign';
import { MEN, MEN_A_COMPANY, awayFrom, menOf, musterOf, sendHome, sparedMen } from '../src/sim/armytown';
import { folkOf } from '../src/sim/township';
import { recordedAway } from '../src/sim/warhouse';

/** The player's chief town with a Barracks and nobody to spare, and two other towns of theirs with men. */
const nation = () => {
  const c = bareCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].supplies = 500;
  if (!home.buildings.includes('barracks')) home.buildings.push('barracks');
  const others = c.territories.filter((t) => t.owner < 0 && !t.horde && t.capital < 0).slice(0, 2);
  for (const t of others) t.owner = 0;
  const set = (tid: number, men: number, women: number) => { const f = folkOf(c, tid); f.men = men; f.women = women; delete f.ages; delete f.houses; return f; };
  const f = set(home.id, MEN.floor, 0); // it keeps what it has
  const near = set(others[0].id, 7, 4), far = set(others[1].id, 5, 4);
  return { c, home, f, others, near, far };
};

describe('a company its town cannot man is filled from the other towns', () => {
  it('the town with most men to spare sends them, and every town keeps what a town keeps', () => {
    const { c, home, f, others, near, far } = nation();
    expect(sparedMen(c, home.id)).toBe(0);
    expect(sparedMen(c, others[0].id)).toBe(5);
    expect(sparedMen(c, others[1].id)).toBe(3);
    expect(raise(c, 0, home.id, 'infantry')).toBe(true);
    const a = armyAt(c, home.id)!;
    expect(f.men).toBe(MEN.floor);
    expect(near.men).toBe(7 - MEN_A_COMPANY);
    expect(far.men).toBe(5);
    expect(musterOf(c, a.id)!.men[others[0].id].length).toBe(MEN_A_COMPANY);
    expect(menOf(c, a)).toEqual({ town: MEN_A_COMPANY, none: 0 });
    // Raise until nobody can spare a man: no town is below its floor or its husbands.
    for (let i = 0; i < 8; i++) raise(c, 0, home.id, 'infantry');
    for (const t of [home, ...others]) { const k = folkOf(c, t.id); expect(k.men).toBeGreaterThanOrEqual(Math.max(MEN.floor, Math.ceil(k.women * MEN.couples))); expect(sparedMen(c, t.id)).toBe(0); }
    expect(awayFrom(c, others[0].id)).toBe(5);
    expect(awayFrom(c, others[1].id)).toBe(3);
    expect(menOf(c, a).none).toBe(armyAt(c, home.id)!.units.infantry * MEN_A_COMPANY - 8); // the rest are men of no town
  });

  it('a town that can man half a company sends its man, and the other comes from elsewhere', () => {
    const { c, home, f, others } = nation();
    f.men = MEN.floor + 1; delete f.ages;
    raise(c, 0, home.id, 'infantry');
    expect(awayFrom(c, home.id)).toBe(1);
    expect(awayFrom(c, others[0].id)).toBe(1);
  });

  it('each man is of a house of his own town, and comes home to it', () => {
    const { c, home, others, near } = nation();
    raise(c, 0, home.id, 'infantry');
    expect(recordedAway(near)).toBe(MEN_A_COMPANY);
    expect(recordedAway(folkOf(c, home.id))).toBe(0);
    const a = armyAt(c, home.id)!;
    a.moved = false;
    expect(sendHome(c, a.id)).toBe(MEN_A_COMPANY);
    expect(near.men).toBe(7);
    expect(recordedAway(near)).toBe(0);
    expect(awayFrom(c, others[0].id)).toBe(0);
  });

  it('another people\'s towns are not called on, and with the levy off nobody is', () => {
    const { c, home, others, near } = nation();
    others[0].owner = 1;
    others[1].owner = 1;
    raise(c, 0, home.id, 'infantry');
    expect(near.men).toBe(7);
    expect(menOf(c, armyAt(c, home.id)!)).toEqual({ town: 0, none: MEN_A_COMPANY });
    const b = nation();
    MEN.levy = false;
    try { raise(b.c, 0, b.home.id, 'infantry'); expect(b.near.men).toBe(7); } finally { MEN.levy = true; }
  });
});
