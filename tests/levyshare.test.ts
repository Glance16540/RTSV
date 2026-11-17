// A people sends a quarter of its men to its armies and no more; past that a company is hired men (src/sim/armytown.ts, MEN.share).
import { describe, expect, it } from 'vitest';
import { armyAt, raise } from '../src/sim/campaign';
import { MEN, MEN_A_COMPANY, menLeftToSend, menMustered, menOf, menOfNation } from '../src/sim/armytown';
import { agesOf } from '../src/sim/ageing';
import { folkOf } from '../src/sim/township';
import { bareCampaign } from './helpers';

/** The player with one town of `men` men and a Barracks, no army, and goods to raise with. */
const nation = (men: number) => {
  const c = bareCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  for (const t of c.territories) if (t.owner === 0 && t !== home) t.owner = -1;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].supplies = 500;
  home.buildings = ['barracks'];
  const f = folkOf(c, home.id);
  Object.assign(f, { men, women: 4, elders: 0, children: 0 }); f.notables = []; delete f.ages; delete f.houses;
  agesOf(c, home.id, f);
  return { c, home, f };
};

describe('the share of its men a people sends to war', () => {
  it('is a quarter of them all, counting those already away', () => {
    const { c, home, f } = nation(40);
    expect(MEN.share).toBe(0.25);
    expect(menOfNation(c, 0)).toEqual({ away: 0, home: 40 });
    expect(menLeftToSend(c, 0)).toBe(10);
    for (let i = 0; i < 5; i++) expect(raise(c, 0, home.id, 'infantry')).toBe(true);
    expect(menOfNation(c, 0)).toEqual({ away: 10, home: 30 });
    expect(menLeftToSend(c, 0)).toBe(0);
    expect(f.men).toBe(30);
  });

  it('past it a company is still raised, of hired men of no town: nobody more leaves home', () => {
    const { c, home, f } = nation(40);
    for (let i = 0; i < 7; i++) expect(raise(c, 0, home.id, 'infantry')).toBe(true);
    const a = armyAt(c, home.id)!;
    expect(a.units.infantry).toBe(7);
    expect(f.men).toBe(30); // five companies took ten men; the sixth and seventh took none
    expect(menOf(c, a)).toEqual({ town: 10, none: 2 * MEN_A_COMPANY });
  });

  it('a small people sends fewer: of eight men, two', () => {
    const { c, home, f } = nation(8);
    expect(menLeftToSend(c, 0)).toBe(2);
    raise(c, 0, home.id, 'infantry'); raise(c, 0, home.id, 'infantry');
    expect(f.men).toBe(6);
    expect(menOf(c, armyAt(c, home.id)!)).toEqual({ town: 2, none: 2 });
  });

  it('men trained in person in their town have gone already: the quarter is not asked of them', () => {
    const { c, home, f } = nation(8);
    const a = { id: c.nextArmy++, owner: 0, at: home.id, units: { infantry: 2 }, hero: false, vet: 0, moved: true };
    c.armies.push(a);
    expect(menMustered(c, a, home.id, { gone: true })).toBe(MEN_A_COMPANY);
    expect(menMustered(c, a, home.id, { gone: true })).toBe(MEN_A_COMPANY);
    expect(f.men).toBe(4);
    expect(menMustered(c, a, home.id)).toBe(0); // and by the ordinary way nobody more goes
  });

  it('when men come home or are born, it may send again', () => {
    const { c, home, f } = nation(40);
    for (let i = 0; i < 5; i++) raise(c, 0, home.id, 'infantry');
    expect(menLeftToSend(c, 0)).toBe(0);
    f.men += 8; delete f.ages; agesOf(c, home.id, f); // a generation comes of age
    expect(menLeftToSend(c, 0)).toBe(2);
  });
});
