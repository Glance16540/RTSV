// A people's own soldiers are companies on the map (src/sim/uniquecompany.ts), raised by that people in its age, of the
// family of the plain kind they fight as, and fielded in a battle as those soldiers.
import { describe, expect, it } from 'vitest';
import { BEATS, COMPANIES, armyAt, battleConfig, beatenIn, canRaise, familyOf, finishBattle, moveArmy, newCampaign, raise, soldierWord, strengthVs } from '../src/sim/campaign';
import { UNITS } from '../src/sim/data';
import { UNIQUE, mayRaiseKind } from '../src/sim/uniquecompany';

describe('uniquecompany', () => {
  it('every people\'s own foot, bow and horse soldiers are a kind of company; no siege engine, healer or beast is', () => {
    const own = Object.entries(COMPANIES).filter(([, d]) => d.civ);
    expect(own.length).toBeGreaterThan(15);
    for (const [k, d] of own) {
      const u = UNITS[k], plain = COMPANIES[d.base!];
      expect(u.civ).toBe(d.civ);
      expect(['infantry', 'archers', 'cavalry']).toContain(d.base);
      expect(d.needs).toBe(plain.needs);
      expect(d.units).toEqual({ [k]: 2 });
      expect(d.age).toBe(u.age);
      expect(d.str).toBeGreaterThanOrEqual(plain.str);
      expect(d.str).toBeLessThanOrEqual(plain.str * UNIQUE.most + 1e-9);
      expect(d.cost).toBeGreaterThanOrEqual(plain.cost);
    }
    for (const k of ['trebuchet', 'organgun', 'herbwife', 'warbear', 'warelephant', 'firethrower']) expect(COMPANIES[k]).toBeUndefined();
    expect(COMPANIES.samurai.base).toBe('infantry');
    expect(COMPANIES.longbowman.base).toBe('archers');
    expect(COMPANIES.lancer.base).toBe('cavalry');
    // The plain kinds are as they were.
    expect(COMPANIES.infantry).toMatchObject({ cost: 2, str: 1 });
    expect(COMPANIES.cavalry).toMatchObject({ cost: 4, str: 2 });
  });

  it('a people\'s own company fights as its family: it beats what that kind beats, and is beaten by what beats it', () => {
    expect(familyOf('samurai')).toBe('infantry');
    expect(familyOf('cavalry')).toBe('cavalry');
    expect(beatenIn('samurai', { cavalry: 2, lancer: 1, archers: 3 })).toBe(3); // infantry beats horse, the lancers too
    expect(beatenIn('cavalry', { longbowman: 2, infantry: 1 })).toBe(2);
    const army = (units: Record<string, number>) => ({ id: 1, owner: 0, at: 0, units, hero: false, vet: 0, moved: false });
    expect(strengthVs(army({ samurai: 1 }), { lancer: 1 })).toBeCloseTo(COMPANIES.samurai.str * 1.3, 1);
    expect(strengthVs(army({ samurai: 1 }), { longbowman: 1 })).toBeCloseTo(COMPANIES.samurai.str, 1);
    expect(BEATS[familyOf('lancer')]).toBe('archers');
    expect(soldierWord('samurai')).toBe('Samurai');
    expect(soldierWord('cavalry')).toBe('Rider');
  });

  it('only its own people raise it, and only from the age the soldier needs', () => {
    expect(mayRaiseKind(COMPANIES.infantry, 'japan', 0)).toBe(true);
    expect(mayRaiseKind(COMPANIES.samurai, 'japan', 1)).toBe(false);
    expect(mayRaiseKind(COMPANIES.samurai, 'japan', 2)).toBe(true);
    expect(mayRaiseKind(COMPANIES.samurai, 'england', 4)).toBe(false);
    const c = newCampaign(3, 1, 1, 'japan');
    const t = c.territories.find((x) => x.capital === 0)!;
    t.buildings = ['barracks'];
    c.factions[0].supplies = 999;
    c.factions[0].age = 1;
    expect(canRaise(c, 0, t.id, 'samurai')).toBe(false);
    expect(canRaise(c, 0, t.id, 'hoplite')).toBe(false);
    c.factions[0].age = 2;
    expect(canRaise(c, 0, t.id, 'samurai')).toBe(canRaise(c, 0, t.id, 'infantry'));
  });

  it('raised on the map, it is fielded in a battle as those soldiers, and what lives comes home as that company', () => {
    let done = false;
    for (let seed = 1; seed < 40 && !done; seed++) {
      const c = newCampaign(seed, 1, 1, 'japan');
      const home = c.territories.find((x) => x.capital === 0)!;
      home.buildings = ['barracks'];
      c.factions[0].supplies = 999; c.factions[0].age = 2;
      if (!raise(c, 0, home.id, 'samurai')) continue;
      const a = armyAt(c, home.id)!;
      expect(a.units.samurai).toBeGreaterThanOrEqual(1);
      a.units = { samurai: 1 };
      const to = home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
      if (to === undefined || moveArmy(c, a.id, to) !== 'battle') continue;
      c.pending!.mode = 'siege';
      const cfg = battleConfig(c)!;
      expect(cfg.setups[0].bonus!.units).toMatchObject({ samurai: 2 });
      finishBattle(c, true, { samurai: 2 }, {});
      expect(c.armies.find((x) => x.id === a.id)?.units).toEqual({ samurai: 1 });
      done = true;
    }
    expect(done).toBe(true);
  });
});
