// Which army a man marches with, and what an army fells counted to its men's houses (src/sim/warhouse.ts).
import { describe, expect, it } from 'vitest';
import { armyAt, moveArmy, newCampaign, raise } from '../src/sim/campaign';
import { MEN_A_COMPANY, armiesJoined, musterOf, reckonArmies, seasonOfArmies } from '../src/sim/armytown';
import { agesOf } from '../src/sim/ageing';
import { Notable, folkOf } from '../src/sim/township';
import { awayMen, awayText, creditArmy, housesOf, levelArmies } from '../src/sim/warhouse';

/** Two towns of the player's side by side, each with a Barracks and men to spare, and no army in either. */
const two = () => {
  const c = newCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  const near = c.territories.find((t) => home.adj.includes(t.id) && !t.horde && t.capital < 0)!;
  near.owner = 0;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].supplies = 500;
  for (const t of [home, near]) {
    t.buildings = ['barracks'];
    const f = folkOf(c, t.id);
    Object.assign(f, { men: 10, women: 4, elders: 0, children: 0 }); f.notables = []; delete f.ages; delete f.houses;
    agesOf(c, t.id, f);
  }
  return { c, home, near };
};

describe('a man falls from the army he marched with', () => {
  it('each man away is on record with his army', () => {
    const { c, home, near } = two();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, near.id, 'infantry');
    const a = armyAt(c, home.id)!, b = armyAt(c, near.id)!;
    expect(awayMen(c, home.id).map((m) => m.army)).toEqual([a.id, a.id]);
    expect(awayMen(c, near.id).map((m) => m.army)).toEqual([b.id, b.id]);
  });

  it('when an army loses companies it is its own men who fall, not men of another army of the same town', () => {
    const { c, home } = two();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, home.id, 'infantry');
    const first = armyAt(c, home.id)!;
    // A second army of the same town, standing elsewhere.
    const second = { id: c.nextArmy++, owner: 0, at: c.territories.find((t) => t.owner !== 0)!.id, units: { infantry: 2 }, hero: false, vet: 0, moved: true };
    c.armies.push(second);
    const roll = musterOf(c, first.id)!;
    c.musters![second.id] = { size: 2, owner: 0, men: { [home.id]: roll.men[home.id].splice(2) } };
    roll.size = 1; first.units.infantry = 1;
    levelArmies(c, home.id);
    const before = awayMen(c, home.id);
    expect(before.filter((m) => m.army === first.id).length).toBe(MEN_A_COMPANY);
    expect(before.filter((m) => m.army === second.id).length).toBe(MEN_A_COMPANY);
    const theirs = before.filter((m) => m.army === second.id).map((m) => `${m.name} ${m.family}`);
    // The second army is destroyed.
    c.armies.splice(c.armies.indexOf(second), 1);
    const fallen = reckonArmies(c);
    const names = fallen.flatMap((x) => x.names ?? []);
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) expect(theirs).toContain(n);
    // Nobody of the first army is gone from the record.
    expect(awayMen(c, home.id).filter((m) => m.army === first.id).length).toBe(MEN_A_COMPANY);
    expect(awayMen(c, home.id).filter((m) => m.army === second.id).length).toBe(0);
  });

  it('armies that join share out their men, and each man\'s house knows which he is with', () => {
    const { c, home, near } = two();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, near.id, 'infantry');
    const a = armyAt(c, home.id)!, b = armyAt(c, near.id)!;
    // All of a's companies go over to b.
    b.units.infantry += a.units.infantry; a.units = {};
    c.armies.splice(c.armies.indexOf(a), 1);
    armiesJoined(c, a, b);
    expect(awayMen(c, home.id).map((m) => m.army)).toEqual([b.id, b.id]);
    expect(awayMen(c, near.id).map((m) => m.army)).toEqual([b.id, b.id]);
  });

  it('a campaign saved before armies were recorded is set right when the season turns', () => {
    const { c, home } = two();
    raise(c, 0, home.id, 'infantry');
    const a = armyAt(c, home.id)!;
    for (const h of housesOf(folkOf(c, home.id))) for (const s of h.away) delete s.army;
    seasonOfArmies(c);
    expect(awayMen(c, home.id).map((m) => m.army)).toEqual([a.id, a.id]);
    moveArmy(c, a.id, a.at); // nothing: only that the record survives a turn's handling
    expect(awayMen(c, home.id).length).toBe(MEN_A_COMPANY);
  });
});

describe('what an army fells on the map counts to its men\'s houses', () => {
  it('each foe felled is one more to the house of a man of that army, by lot', () => {
    const { c, home, near } = two();
    raise(c, 0, home.id, 'infantry');
    raise(c, 0, near.id, 'infantry');
    const a = armyAt(c, home.id)!;
    expect(creditArmy(c, a.id, 6)).toBe(6);
    expect(housesOf(folkOf(c, home.id)).reduce((n, h) => n + (h.war ?? 0), 0)).toBe(6);
    expect(housesOf(folkOf(c, near.id)).reduce((n, h) => n + (h.war ?? 0), 0)).toBe(0); // another army's men
    expect(awayText(c, home.id)).toContain('in the field');
  });

  it('a house the nation knows has it on her record too, so its standing rises', () => {
    const { c, home } = two();
    const f = folkOf(c, home.id);
    const ada: Notable = { name: 'Ada', family: 'Harrow', gender: 'f', kind: 'mother', deed: 'raised three children', turn: 0, kids: 3, husband: 'Bram' };
    f.notables.push(ada);
    Object.assign(f, { men: 4, women: 4 }); delete f.ages; agesOf(c, home.id, f);
    raise(c, 0, home.id, 'infantry'); // no man is unmarried: husbands go, Bram first
    const a = armyAt(c, home.id)!;
    expect(awayMen(c, home.id).some((m) => m.name === 'Bram' && m.family === 'Harrow')).toBe(true);
    creditArmy(c, a.id, 40);
    const harrow = housesOf(f).find((h) => h.family === 'Harrow')!;
    expect(harrow.war).toBeGreaterThan(0);
    expect(ada.war).toBe(harrow.war);
  });

  it('a house with deeds to its name is kept when its men are home', () => {
    const { c, home } = two();
    raise(c, 0, home.id, 'infantry');
    const a = armyAt(c, home.id)!;
    creditArmy(c, a.id, 4);
    c.armies.splice(c.armies.indexOf(a), 1); delete c.musters![a.id];
    for (const h of housesOf(folkOf(c, home.id))) h.away = [];
    seasonOfArmies(c);
    expect(housesOf(folkOf(c, home.id)).reduce((n, h) => n + (h.war ?? 0), 0)).toBe(4);
  });

  it('an army with no men of any town counts nothing, and nonsense is nothing', () => {
    const { c, home } = two();
    const a = { id: c.nextArmy++, owner: 0, at: home.id, units: { infantry: 2 }, hero: false, vet: 0, moved: true };
    c.armies.push(a);
    expect(creditArmy(c, a.id, 5)).toBe(0);
    expect(creditArmy(c, 9999, 5)).toBe(0);
    expect(creditArmy(c, a.id, -3)).toBe(0);
  });
});
