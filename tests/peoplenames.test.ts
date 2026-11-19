// Each people names its own (src/sim/peoplenames.ts).
import { describe, expect, it } from 'vitest';
import { BAND_NAMES, PEOPLE_NAMES, givenNames, houseNames, namesOfPeople, townPeople } from '../src/sim/peoplenames';
import { CIV_IDS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { freeCaptive } from '../src/sim/captivity';
import { championName } from '../src/sim/champion';
import { newCampaign } from '../src/sim/campaign';
import { houseOf, tickHouses } from '../src/sim/dynasty';
import { setups } from './helpers';

const PLAIN = /^[A-Z][a-z]+(?:[-'][A-Za-z][a-z]+)*$/;

describe('each people\'s names', () => {
  it('every people has its own lists, long enough, each name once, plainly written', () => {
    for (const civ of CIV_IDS) {
      const n = PEOPLE_NAMES[civ];
      expect(n, civ).toBeTruthy();
      for (const [kind, list] of [['m', n.m], ['f', n.f], ['houses', n.houses]] as const) {
        expect(list.length, `${civ} ${kind}`).toBeGreaterThanOrEqual(kind === 'houses' ? 30 : 40);
        expect(new Set(list).size, `${civ} ${kind} has a name twice`).toBe(list.length);
        for (const name of list) expect(name, `${civ} ${kind}`).toMatch(PLAIN);
      }
      expect(n.m.filter((x) => n.f.includes(x)), `${civ}: a name both a man's and a woman's`).toEqual([]);
    }
    // The peoples' lists are their own, not one list under fifteen names.
    expect(new Set(CIV_IDS.map((c) => PEOPLE_NAMES[c].m[0])).size).toBe(CIV_IDS.length);
  });

  it('a people the lists do not know (marauders and the like) draws the band folk\'s names', () => {
    expect(namesOfPeople(undefined)).toBe(BAND_NAMES);
    expect(namesOfPeople('nobody')).toBe(BAND_NAMES);
    expect(givenNames('japan', 'f')).toBe(PEOPLE_NAMES.japan.f);
    expect(houseNames('mali')).toBe(PEOPLE_NAMES.mali.houses);
  });

  it('a battle\'s people are named from their own lists, the same every time for the same seed', () => {
    const named = (civ: string) => {
      const g = new Game(9, [{ ...setups[0], civ }, { ...setups[1], civ: 'japan' }], 72);
      return g.units.filter((u) => u.owner === 0 && u.type === 'villager' && u.name).map((u) => [u.gender, u.name] as const);
    };
    for (const civ of ['egypt', 'steppe', 'stonekin']) {
      const a = named(civ);
      expect(a.length).toBeGreaterThan(0);
      for (const [sex, name] of a) expect(givenNames(civ, sex)).toContain(name);
      expect(named(civ)).toEqual(a);
    }
  });

  it('a house\'s children are named in their people\'s way, no two alike', () => {
    for (const civ of ['hearth', 'persia', 'kush']) {
      const c = newCampaign(11, 1, 1, civ), f = 0;
      for (let t = 0; t < 40; t++) { c.turn++; tickHouses(c); }
      const heirs = houseOf(c, f).heirs;
      expect(heirs.length).toBeGreaterThan(1);
      expect(new Set(heirs.map((h) => h.name)).size).toBe(heirs.length);
      for (const h of heirs) expect(givenNames(civ, h.female ? 'f' : 'm')).toContain(h.name);
      expect(townPeople(c, c.territories.find((t) => t.owner === 0)!.id)).toBe(civ);
    }
  });

  it('a person keeps the name given when taken and freed: it is theirs, not their keepers\'', () => {
    const g = new Game(9, [{ ...setups[0], civ: 'hearth' }, { ...setups[1], civ: 'egypt' }], 72);
    const name = PEOPLE_NAMES.hearth.f[3];
    freeCaptive(g, { from: 0, name, family: 'Laon', gender: 'f', trait: '', trait2: '', age: 0, lifespan: 1000 }, 30, 30);
    const back = g.units.find((u) => u.owner === 0 && u.name === name);
    expect(back?.family).toBe('Laon');
    expect(PEOPLE_NAMES.egypt.f).not.toContain(name);
  });

  it('a soldier who makes a name is named in their own people\'s way', () => {
    for (let id = 1; id < 30; id++) expect([...PEOPLE_NAMES.greece.m, ...PEOPLE_NAMES.greece.f]).toContain(championName(id, 'greece'));
  });
});
