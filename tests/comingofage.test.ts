// Everyone comes of age at eighteen (docs/DESIGN.md, the owner's word, 18 November 2026): nobody under eighteen years is
// grown, wed, levied, a parent, an heir or a suitor's bride, on the map or when a town is loaded to the field.
import { bareCampaign, setups } from './helpers';
import { describe, expect, it } from 'vitest';
import { CHILD_PACE, CHILD_SEASONS, GROWN_SEASON, GROWN_YEARS, SEASONS_A_YEAR, ageTown, agesOf, childYears, countFrom, yearsFromBirth, yearsOf } from '../src/sim/ageing';
import { GROWN_AT } from '../src/sim/nursery';
import { GROWN_SEASONS, seasonTown } from '../src/sim/seasonfolk';
import { HEIR_AGE, houseOf, ofAge } from '../src/sim/dynasty';
import { daughterOfAge } from '../src/sim/courtstory';
import { wedOf } from '../src/sim/marriage';
import { raise } from '../src/sim/campaign';
import { folkOf, grown, musterFolk } from '../src/sim/township';
import { Game } from '../src/sim/game';

/** A town of the player's whose people are only these: children of the given ages in seasons, and these grown. */
const town = (kids: number[], men: number[] = [], women: number[] = []) => {
  const c = bareCampaign(5, 1, 1, 'hearth'), t = c.territories.find((x) => x.capital === 0)!, f = folkOf(c, t.id);
  f.notables = []; delete f.widowed; delete f.orphans; delete f.drifted; delete f.fieldHome; delete f.hungry;
  countFrom(f, { m: [...men], f: [...women], k: [...kids] });
  delete f.wed;
  return { c, tid: t.id, t, f };
};
const justUnder = CHILD_SEASONS - 1; // a season short of coming of age: under eighteen on the record

describe('nobody under eighteen is grown', () => {
  it('eighteen years, in every measure of it', () => {
    expect(GROWN_YEARS).toBe(18);
    expect(GROWN_SEASON).toBe(18 * SEASONS_A_YEAR);
    expect(GROWN_AT).toBe(18);
    expect(GROWN_SEASON).toBe(18 * SEASONS_A_YEAR); // the age, in seasons of age, of one just come of age
    expect(GROWN_SEASONS).toBe(CHILD_SEASONS); // seasons from birth to it
    expect(HEIR_AGE).toBe(CHILD_SEASONS);
    expect(childYears(justUnder)).toBeLessThan(18);
    expect(yearsOf(0, 1000)).toBe(18); // the youngest grown person on a field is eighteen
  });

  it('a child born in season s is eighteen at s + 60: its years run 1.2 a year, the grown a year a year', () => {
    expect(CHILD_SEASONS).toBe(60);
    expect(CHILD_PACE).toBeCloseTo(1.2, 9);
    expect(yearsFromBirth(0)).toBe(0);
    expect(yearsFromBirth(CHILD_SEASONS)).toBe(18);
    expect(yearsFromBirth(CHILD_SEASONS - 1)).toBeLessThan(18);
    expect(yearsFromBirth(CHILD_SEASONS + 4)).toBe(19);
    expect(yearsFromBirth(20)).toBeCloseTo(6, 9); // five years of the calendar: six on the record
  });

  it('on the map a child is a child until the season it turns eighteen', () => {
    const { c, tid, f } = town([justUnder - 1]);
    expect(ageTown(c, tid, f).grew).toBe(0);
    expect([grown(f), f.children]).toEqual([0, 1]);
    expect(ageTown(c, tid, f).grew).toBe(1);
    expect([grown(f), f.children]).toEqual([1, 0]);
    expect([...agesOf(c, tid, f).m, ...agesOf(c, tid, f).f]).toEqual([GROWN_SEASON]);
  });

  it('a town of children under eighteen has nobody wed, no parents, and no man to levy', () => {
    const { c, tid, t, f } = town(Array.from({ length: 30 }, () => justUnder - 4));
    expect(wedOf(f)).toBe(0);
    t.buildings = ['barracks']; c.factions[0].supplies = 500;
    expect(raise(c, 0, tid, 'infantry')).toBe(false);
    f.stores.food = 5000;
    expect(seasonTown(c, tid).born).toBe(0);
  });

  it('an heir is of age, and a daughter a bride, only at eighteen', () => {
    const { c } = town([]);
    const h = houseOf(c, 0);
    h.heirs = [{ name: 'Ada', female: true, born: c.turn - justUnder } as never];
    expect(ofAge(c, h.heirs[0])).toBe(false);
    expect(daughterOfAge(c, 0)).toBeUndefined();
    h.heirs[0].born = c.turn - GROWN_SEASON;
    expect(ofAge(c, h.heirs[0])).toBe(true);
    expect(daughterOfAge(c, 0)?.name).toBe('Ada');
  });

  it('loaded to the field, a child of seventeen is a child and not a villager; the grown are eighteen and over', () => {
    const { c, tid } = town([justUnder, justUnder], [GROWN_SEASON, GROWN_SEASON + 20], [GROWN_SEASON + 4]);
    const m = musterFolk(c, tid);
    expect([m.people.men, m.people.women, m.people.children]).toEqual([2, 1, 2]);
    const s = [{ ...setups[0], bonus: { people: m.people, stores: m.stores } }, setups[1]];
    const g = new Game(7, s);
    g.bornOnly = true;
    const grownOnField = g.units.filter((u) => u.owner === 0 && u.type === 'villager' && u.growT <= 0);
    for (const u of grownOnField) if (u.lifespan > 0) expect(yearsOf(u.age, u.lifespan)).toBeGreaterThanOrEqual(18);
    const young = g.buildings.filter((b) => b.owner === 0).reduce((n, b) => n + (b.young?.length ?? 0), 0);
    expect(young).toBe(2); // the two of seventeen are children on the houses' records, never shown
    expect(grownOnField.filter((u) => u.lifespan > 0 && yearsOf(u.age, u.lifespan) < 18)).toEqual([]);
  });
});
