// The army a people begins with is its chief town's own men, each of a house there; and what a company needs in
// men to be raised (src/sim/armytown.ts foundingMuster, menToRaise; src/sim/rivalaim.ts skyInto).
import { describe, expect, it } from 'vitest';
import { armyAt, canRaise, newCampaign } from '../src/sim/campaign';
import { FOUNDING, MEN, MEN_A_COMPANY, foundArmies, foundingMuster, menOf, menToRaise, musterOf, noMenText, reckonArmies, sendMenHome } from '../src/sim/armytown';
import { GROWN_SEASON, GROWN_YEARS } from '../src/sim/ageing';
import { foundFolk, folkOf } from '../src/sim/township';
import { awayMen, fallenSince } from '../src/sim/warhouse';
import { skyInto } from '../src/sim/rivalaim';
import { WEATHER } from '../src/sim/campaignbase';

const year = GROWN_SEASON / GROWN_YEARS;

describe('the army a people begins with', () => {
  it('is its chief town\'s men from the first turn: two a company, each of a house there, and no army is of no town', () => {
    const c = newCampaign(7, 2, 1, 'hearth');
    expect(c.armies.length).toBe(3);
    for (const a of c.armies) {
      const home = c.territories.find((t) => t.capital === a.owner)!;
      expect(a.at).toBe(home.id);
      const m = musterOf(c, a.id)!;
      expect(m.size).toBe(3);
      expect(Object.keys(m.men)).toEqual([String(home.id)]);
      expect(m.men[home.id].length).toBe(3 * MEN_A_COMPANY);
      for (const s of m.men[home.id]) { expect(s).toBeGreaterThanOrEqual(FOUNDING.youngest * year); expect(s).toBeLessThanOrEqual(FOUNDING.oldest * year); }
      expect(menOf(c, a)).toEqual({ town: 6, none: 0 });
      // Each is on the record of a house of the town, as away with this army.
      const away = awayMen(c, home.id);
      expect(away.length).toBe(6);
      expect(away.every((x) => x.army === a.id)).toBe(true);
    }
  });

  it('they were already away: the town is founded with as many at home as it ever was', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    const bare = foundFolk(c, home.id), f = folkOf(c, home.id);
    expect(f.men).toBe(bare.men);
    expect(f.women).toBe(bare.women);
    expect(f.children).toBe(bare.children);
  });

  it('its dead are that town\'s dead, by name, and its men come home to it', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    const a = armyAt(c, home.id)!, before = folkOf(c, home.id).men;
    a.units.infantry = 2; // a company lost
    const fallen = reckonArmies(c);
    expect(fallen.length).toBe(1);
    expect(fallen[0].town).toBe(home.id);
    expect(fallen[0].dead).toBeGreaterThan(0);
    expect(fallenSince(c, 0, c.turn).length).toBe(fallen[0].dead);
    expect(fallen[0].names!.length).toBe(fallen[0].dead);
    const wounded = folkOf(c, home.id).men - before; // the rest of the company came home hurt
    expect(wounded + fallen[0].dead).toBe(MEN_A_COMPANY);
    const left = menOf(c, a).town;
    expect(left).toBe(4);
    expect(sendMenHome(c, a.id, 2)).toBe(2);
    expect(folkOf(c, home.id).men).toBe(before + wounded + 2);
    expect(awayMen(c, home.id).length).toBe(2);
  });

  it('an army that has a roll, or stands in no town of its own, is left as it is', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    const a = armyAt(c, home.id)!;
    expect(foundingMuster(c, a)).toBe(0); // it has one
    expect(foundArmies(c)).toBe(0);
    const abroad = c.territories.find((t) => t.owner !== 0)!;
    const b = { id: c.nextArmy++, owner: 0, at: abroad.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false };
    c.armies.push(b);
    expect(foundingMuster(c, b)).toBe(0);
    expect(musterOf(c, b.id)).toBeUndefined();
  });

  it('the same campaign begins with the same men', () => {
    const a = newCampaign(11, 2, 1, 'hearth'), b = newCampaign(11, 2, 1, 'hearth');
    expect(a.musters).toEqual(b.musters);
    expect(a.territories.map((t) => t.folk?.houses)).toEqual(b.territories.map((t) => t.folk?.houses));
  });
});

describe('the men a company needs', () => {
  it('counts what the town and its people\'s other towns can spare', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    const f = folkOf(c, home.id);
    Object.assign(f, { men: 10, women: 4 }); delete f.ages;
    expect(menToRaise(c, 0, home.id)).toBe(8); // it keeps two, and a husband for half its women: two
    expect(noMenText(c, 0, home.id)).toBe('');
    Object.assign(f, { men: 3, women: 4 }); delete f.ages;
    expect(menToRaise(c, 0, home.id)).toBe(1);
    expect(noMenText(c, 0, home.id)).toContain('only 1 of the 2 men');
    Object.assign(f, { men: 2, women: 4 }); delete f.ages;
    expect(menToRaise(c, 0, home.id)).toBe(0);
    expect(noMenText(c, 0, home.id)).toContain('None of your towns can spare a man');
    expect(menToRaise(c, 1, home.id)).toBe(0); // not another people's town
  });

  it('where the rule asks for men, a town without them raises no company', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    c.factions[0].supplies = 500;
    const f = folkOf(c, home.id);
    Object.assign(f, { men: 2, women: 4 }); delete f.ages;
    const was = MEN.least;
    try {
      expect(canRaise(c, 0, home.id, 'infantry')).toBe(was === 0); // as the rule stands today
      MEN.least = 1;
      expect(canRaise(c, 0, home.id, 'infantry')).toBe(false);
      expect(noMenText(c, 0, home.id)).toContain('No men for it');
      Object.assign(f, { men: 4, women: 4 }); delete f.ages;
      expect(canRaise(c, 0, home.id, 'infantry')).toBe(true);
    } finally { MEN.least = was; }
  });
});

describe('the weather a rival weighs', () => {
  it('an army marching into rain, snow or dust is weighed the weaker for it, as the battle will weigh it', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), t = c.territories[0];
    c.fronts = [];
    expect(skyInto(c, t.id)).toBe(1);
    c.fronts = [{ kind: 'snow', x: t.x, y: t.y, r: 50, vx: 0, vy: 0 }];
    expect(skyInto(c, t.id)).toBe(WEATHER.snow.march);
  });
});
