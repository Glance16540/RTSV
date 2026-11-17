// A poor people still musters (src/sim/rivalrule.ts, poorMuster).
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { COMPANIES, armyAt, companyCost, hireOff } from '../src/sim/campaign';
import { MEN_A_COMPANY, awayFrom } from '../src/sim/armytown';
import { RIVAL, poorMuster, warFooting } from '../src/sim/rivalrule';
import { settleStores, SUPPLY_UNITS } from '../src/sim/stores';
import { STORE_KINDS, Stores, folkOf } from '../src/sim/township';

const units = (s: Stores) => STORE_KINDS.reduce((n, k) => n + s[k], 0);
/** A rival down to its chief town: ten men, six women, a Barracks, at war, and nothing in store over its keep. */
const ruined = () => {
  const c = bareCampaign(7, 2, 1);
  const home = c.territories.find((t) => t.capital === 1)!;
  for (const t of c.territories) if (t.owner === 1 && t !== home) t.owner = -1;
  c.armies = c.armies.filter((a) => a.owner !== 1);
  home.buildings = ['barracks'];
  const f = folkOf(c, home.id);
  Object.assign(f, { men: 10, women: 6, elders: 0, children: 4 }); delete f.ages; delete f.houses;
  f.stores = { food: 200, wood: 150, gold: 100, stone: 100 };
  settleStores(c);
  c.wars = { 1: { land: 1, changed: c.turn } }; // it has just lost land: it is at war
  return { c, home, f };
};

describe('a poor people still musters', () => {
  it('with men and nothing to spare, a rival at war raises a company out of its town\'s own stores', () => {
    const { c, home, f } = ruined();
    expect(c.factions[1].supplies).toBe(0);
    expect(warFooting(c, 1)).toBe('war');
    const had = units(f.stores), price = companyCost(home, 'infantry', c.factions[1].civ, hireOff(c, 1, home.id)) * SUPPLY_UNITS;
    expect(price).toBeLessThanOrEqual(had * RIVAL.stock);
    expect(poorMuster(c, 1)).toBe(home.id);
    const a = armyAt(c, home.id)!;
    expect(a.owner).toBe(1);
    expect(a.units.infantry).toBe(1);
    expect(a.moved).toBe(true);
    expect(f.men).toBe(10 - MEN_A_COMPANY);
    expect(awayFrom(c, home.id)).toBe(MEN_A_COMPANY);
    expect(units(f.stores)).toBe(had - price);
    expect(f.stores.food).toBe(200); // its bread is spent last
  });

  it('never more than the share of a town\'s stock it may spend', () => {
    const { c, home, f } = ruined();
    f.stores = { food: 150, wood: 60, gold: 40, stone: 40 }; // under twice the price of a company
    expect(companyCost(home, 'infantry', c.factions[1].civ, hireOff(c, 1, home.id)) * SUPPLY_UNITS).toBeGreaterThan(units(f.stores) * RIVAL.stock);
    expect(poorMuster(c, 1)).toBe(-1);
    expect(f.men).toBe(10);
    expect(armyAt(c, home.id)).toBeUndefined();
    expect(units(f.stores)).toBe(290);
  });

  it('not at peace, not with nobody to send, and not when it can pay in the ordinary way', () => {
    const peace = ruined();
    peace.c.turn += RIVAL.lull + 1; // the land it lost is long ago
    expect(warFooting(peace.c, 1)).toBe('peace');
    expect(poorMuster(peace.c, 1)).toBe(-1);
    const few = ruined();
    few.f.men = 2; delete few.f.ages;
    expect(poorMuster(few.c, 1)).toBe(-1);
    expect(units(few.f.stores)).toBe(550);
    const rich = ruined();
    rich.f.stores = { food: 2000, wood: 2000, gold: 2000, stone: 2000 };
    settleStores(rich.c);
    expect(rich.c.factions[1].supplies).toBeGreaterThan(COMPANIES.infantry.cost);
    expect(poorMuster(rich.c, 1)).toBe(-1);
    expect(rich.f.men).toBe(10);
  });

  it('with no yard left it musters plain infantry at its chief town', () => {
    const { c, home, f } = ruined();
    home.buildings = ['farm'];
    expect(poorMuster(c, 1)).toBe(home.id);
    expect(armyAt(c, home.id)!.units).toEqual({ infantry: 1 });
    expect(f.men).toBe(10 - MEN_A_COMPANY);
  });

  it('it is the rivals\' rule: the player\'s people are not mustered so', () => {
    const { c } = ruined();
    expect(poorMuster(c, 0)).toBe(-1);
  });
});
