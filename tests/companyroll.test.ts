// Each man of an army's roll is of a company (src/sim/companyroll.ts): the men of the companies lost on the map are the
// dead, and what the army fells is counted to the men who stood, by their kind's weight.
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { armyAt, raise } from '../src/sim/campaign';
import { musterOf, reckonArmies } from '../src/sim/armytown';
import { agesOf } from '../src/sim/ageing';
import { folkOf } from '../src/sim/township';
import { awayMen, creditArmy, housesOf } from '../src/sim/warhouse';
import { levelKinds, lostIn, lostRank, noteLost, standWeight } from '../src/sim/companyroll';

/** A town of the player's with a Barracks and a Stable, men to spare, and an army of two companies of foot and one of horse. */
const army = () => {
  const c = bareCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].supplies = 2000;
  home.buildings = ['barracks', 'stable'];
  const f = folkOf(c, home.id);
  Object.assign(f, { men: 60, women: 30, elders: 0, children: 0 }); f.notables = []; delete f.ages; delete f.houses;
  agesOf(c, home.id, f);
  expect(raise(c, 0, home.id, 'infantry')).toBe(true); c.turn++;
  expect(raise(c, 0, home.id, 'infantry')).toBe(true); c.turn++;
  expect(raise(c, 0, home.id, 'cavalry')).toBe(true);
  const a = armyAt(c, home.id)!;
  reckonArmies(c);
  return { c, home, a, f };
};

describe('each man of the roll is of a company', () => {
  it('the army\'s companies are shared out among its men by kind, those longest with it keeping theirs', () => {
    const { c, a, home } = army();
    const roll = levelKinds(c, a.id);
    const n = (k: string) => roll.filter((r) => r.man.kind === k).length, each = roll.length / 3;
    expect(n('infantry')).toBe(Math.round(2 * each));
    expect(n('cavalry')).toBe(roll.length - n('infantry'));
    const was = roll.map((r) => r.man.kind);
    expect(levelKinds(c, a.id).map((r) => r.man.kind)).toEqual(was); // asked again, nothing moves
    expect(awayMen(c, home.id).length).toBe(roll.length);
  });

  it('the men of the companies lost on the map are the dead, those last raised first, before any lot', () => {
    const { c, a, home } = army();
    noteLost(c, a.id, { cavalry: 1 });
    const roll = levelKinds(c, a.id), horse = roll.filter((r) => r.man.kind === 'cavalry');
    expect(lostIn(c, a.id, home.id)).toBe(horse.length);
    for (const r of horse) expect(lostRank(c, a.id, r.house.family, r.man.name)).toBe(0);
    for (const r of roll.filter((x) => x.man.kind !== 'cavalry')) expect(lostRank(c, a.id, r.house.family, r.man.name)).toBe(1);
    // The army loses its company of horse: it is the horsemen who are struck from the roll, dead or come home hurt.
    const names = new Set(horse.map((r) => `${r.man.name}|${r.house.family}`));
    a.units.cavalry = 0; delete a.units.cavalry;
    reckonArmies(c);
    const left = new Set(awayMen(c, home.id).map((m) => `${m.name}|${m.family}`));
    for (const k of names) expect(left.has(k)).toBe(false);
    expect(left.size).toBe(roll.length - horse.length);
  });

  it('a note is for the turn it was made: a later battle is not read by it', () => {
    const { c, a } = army();
    noteLost(c, a.id, { cavalry: 1 });
    c.turn++;
    expect(levelKinds(c, a.id).every((r) => lostRank(c, a.id, r.house.family, r.man.name) === 1)).toBe(true);
    noteLost(c, a.id, {});
    expect(musterOf(c, a.id)!.lostNow).toBeUndefined();
  });

  it('what the army fells goes to the men who stood, a horseman by twice a footman\'s weight, none to the lost', () => {
    const { c, a, f } = army();
    const roll = levelKinds(c, a.id);
    const horse = roll.find((r) => r.man.kind === 'cavalry')!, foot = roll.find((r) => r.man.kind === 'infantry')!;
    expect(standWeight(c, a.id, horse.man, horse.house.family)).toBe(2 * standWeight(c, a.id, foot.man, foot.house.family));
    // Lose the infantry: every foe felled goes to the houses of the horse.
    noteLost(c, a.id, { infantry: 2 });
    for (const h of housesOf(f)) delete h.war;
    expect(creditArmy(c, a.id, 30)).toBe(30);
    const horseHouses = new Set(roll.filter((r) => r.man.kind === 'cavalry').map((r) => r.house.family));
    const footOnly = housesOf(f).filter((h) => !horseHouses.has(h.family));
    expect(footOnly.reduce((n, h) => n + (h.war ?? 0), 0)).toBe(0);
    expect(housesOf(f).filter((h) => horseHouses.has(h.family)).reduce((n, h) => n + (h.war ?? 0), 0)).toBe(30);
  });
});
