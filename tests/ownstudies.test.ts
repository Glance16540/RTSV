// Each people its own: the studies only one nation can learn (docs/DESIGN.md; src/sim/ownstudies.ts).
import { describe, expect, it } from 'vitest';
import { BATTLE_HOOKS, ageOf, defence, newCampaign } from '../src/sim/campaign';
import { CIVS, CIV_IDS, TECHS, baseMods } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { ARMY_REST } from '../src/sim/armytown';
import { resentOf, townTaken, goodRule } from '../src/sim/conquered';
import { countryYield } from '../src/sim/country';
import { OWN, OWN_STUDIES, STUDY_HALL, birthPace, buildPace, canLearn, cannotLearn, defenceAdd, faithPull, keepLearned, knownIn, knows, learn, mayLearn, moodEase, nationOf, ownAmong, ownStudiesSeason, researchAt, restSpared, rivalLearns, roadRisk, studiesOf, studyList, unrestEase, yokeEase, yokeSpared } from '../src/sim/ownstudies';
import { defenceOf } from '../src/sim/threats';
import { townDrift } from '../src/sim/townfaith';
import { folkOf } from '../src/sim/township';
import { unrestChance, noteHolders } from '../src/sim/unrest';
import { setups } from './helpers';

/** A campaign played as this nation, rich enough to learn, in its second age, with one more town of its own. */
const world = (civ: string) => {
  const c = newCampaign(7, 2, 1, civ);
  c.factions[0].age = 2;
  const home = c.territories.find((t) => t.capital === 0)!;
  const f = folkOf(c, home.id);
  f.stores = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
  const town = c.territories.find((t) => t.owner < 0 && !t.horde && t.capital < 0)!;
  town.owner = 0; town.buildings = []; delete town.yoke;
  c.armies = c.armies.filter((a) => a.at !== town.id);
  Object.assign(folkOf(c, town.id), { men: 6, women: 6, elders: 0, children: 2 });
  return { c, home, town };
};
const taught = (civ: string, id: string) => { const w = world(civ); expect(learn(w.c, 0, id)).toBe(true); return w; };

describe('each people has a study of its own', () => {
  it('every nation has one, in the tech table under the same id and marked as that nation\'s', () => {
    for (const civ of CIV_IDS) expect(studiesOf(civ).length, civ).toBeGreaterThanOrEqual(1);
    expect(new Set(OWN_STUDIES.map((s) => s.id)).size).toBe(OWN_STUDIES.length);
    for (const s of OWN_STUDIES) {
      expect(CIVS[s.civ], s.id).toBeDefined();
      expect(TECHS[s.id], s.id).toBeDefined();
      expect(TECHS[s.id].civ).toBe(s.civ);
      expect(TECHS[s.id].name).toBe(s.name);
      expect(TECHS[s.id].age).toBe(s.age);
      expect(TECHS[s.id].desc).toContain(CIVS[s.civ].name); // the research list names the nation
      const m = baseMods(), before = JSON.stringify(m);
      TECHS[s.id].apply(m);
      expect(JSON.stringify(m), s.id).not.toBe(before); // it does something in a town too
    }
    // And no study in the table claims a nation without being on the list here.
    for (const t of Object.values(TECHS)) if (t.civ) expect(nationOf(t.id)).toBe(t.civ);
  });

  it('only its own nation may learn it: on the map, and in a town', () => {
    const { c } = world('hearth');
    expect(mayLearn('hearth', 'own_kinship')).toBe(true);
    expect(mayLearn('babylon', 'own_kinship')).toBe(false);
    expect(mayLearn('babylon', 'stonetools')).toBe(true); // anyone's study is anyone's
    expect(canLearn(c, 0, 'own_kinship')).toBe(true);
    expect(canLearn(c, 0, 'own_code')).toBe(false);
    expect(cannotLearn(c, 0, 'own_code')).toBe('Not a study of this people.');
    // In a town: listed at the Town Center for its nation alone, and refused to anyone else.
    expect(researchAt(STUDY_HALL, 'hearth', ['a'])).toEqual(['a', 'own_kinship']);
    expect(researchAt(STUDY_HALL, 'babylon', [])).toEqual(['own_code']);
    expect(researchAt('barracks', 'hearth', ['a'])).toEqual(['a']);
    const g = new Game(5, [{ ...setups[0], civ: 'hearth' }, { ...setups[1], civ: 'babylon' }]);
    for (const p of g.players) p.age = 2;
    expect(g.techAvailable(g.players[0], 'own_kinship')).toBe(true);
    expect(g.techAvailable(g.players[1], 'own_kinship')).toBe(false);
    expect(g.techAvailable(g.players[1], 'own_code')).toBe(true);
    const tc = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    g.players[1].res = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
    expect(g.cmdResearch(1, tc.id, 'own_kinship')).toBe(false);
    expect(g.cmdResearch(1, tc.id, 'own_code')).toBe(true);
  });

  it('on the map it is learned once, for supplies, at its age, and kept', () => {
    const { c } = world('forge');
    c.factions[0].age = 1;
    expect(cannotLearn(c, 0, 'own_examinations')).toBe('Needs a later age.');
    c.factions[0].age = 2;
    const had = c.territories.filter((t) => t.owner === 0).reduce((n, t) => n + Object.values(folkOf(c, t.id).stores).reduce((a, b) => a + b, 0), 0);
    expect(learn(c, 0, 'own_examinations')).toBe(true);
    const has = c.territories.filter((t) => t.owner === 0).reduce((n, t) => n + Object.values(folkOf(c, t.id).stores).reduce((a, b) => a + b, 0), 0);
    expect(had - has).toBe(OWN_STUDIES.find((s) => s.id === 'own_examinations')!.cost * 100);
    expect(knows(c, 0, 'own_examinations')).toBe(true);
    expect(learn(c, 0, 'own_examinations')).toBe(false);
    expect(cannotLearn(c, 0, 'own_examinations')).toBe('Already learned.');
    expect(c.log.at(-1)).toContain('Examinations');
    expect(studyList(c, 0)).toMatchObject([{ learned: true, can: false }]);
    // A poor people cannot.
    const poor = world('greece');
    for (const t of poor.c.territories) if (t.owner === 0) folkOf(poor.c, t.id).stores = { food: 100, wood: 100, gold: 50, stone: 50 };
    poor.c.factions[0].supplies = 0;
    expect(canLearn(poor.c, 0, 'own_assembly')).toBe(false);
  });

  it('a nation that has learned it begins a battle with it, and what is learned in a town goes home', () => {
    const { c } = taught('kush', 'own_bow');
    expect(knownIn(c, 0)).toEqual(['own_bow']);
    expect(knownIn(c, -1)).toEqual([]);
    const g = new Game(5, [{ ...setups[0], civ: 'kush', ownStudies: knownIn(c, 0) }, { ...setups[1], civ: 'hearth', ownStudies: ['own_bow'] }]);
    expect(g.players[0].techs.has('own_bow')).toBe(true);
    expect(g.players[0].mods.towerRange).toBe(baseModsFor('kush').towerRange + 1);
    expect(g.players[1].techs.has('own_bow')).toBe(false); // not theirs, whatever the setup says
    // Home again: only its own studies are kept, each once.
    expect(ownAmong(new Set(['stonetools', 'own_bow', 'own_code']), 'kush')).toEqual(['own_bow']);
    const fresh = world('babylon');
    expect(keepLearned(fresh.c, 0, ['own_code', 'own_bow', 'stonetools', 7, 'own_code'])).toEqual(['own_code']);
    expect(knows(fresh.c, 0, 'own_code')).toBe(true);
    expect(fresh.c.factions[0].studies).toEqual(['own_code']);
    // The list is shared with the studies anyone may learn: learning one of its own leaves those where they were.
    const both = world('greece');
    both.c.factions[0].studies = ['some_general_study'];
    expect(learn(both.c, 0, 'own_assembly')).toBe(true);
    expect(both.c.factions[0].studies).toEqual(['some_general_study', 'own_assembly']);
    expect(knownIn(both.c, 0)).toEqual(['own_assembly']);
    expect(BATTLE_HOOKS.order('written')).toContain('ownstudies');
    // A record meddled with keeps nothing that is not the nation's.
    fresh.c.factions[0].studies = ['own_bow', 'own_code', 'own_code'];
    expect(knownIn(fresh.c, 0)).toEqual(['own_code']);
    expect(knows(fresh.c, 0, 'own_bow')).toBe(false);
  });

  it('a computer-led people learns its own when it can well afford it', () => {
    const c = newCampaign(7, 2, 1, 'hearth');
    const rival = c.factions[1], own = studiesOf(rival.civ)[0];
    rival.age = 2;
    for (const t of c.territories) if (t.owner === 1) folkOf(c, t.id).stores = { food: 100, wood: 100, gold: 100, stone: 100 };
    rival.supplies = own.cost + OWN.reserve - 1;
    expect(rivalLearns(c, 1)).toEqual([]);
    for (const t of c.territories) if (t.owner === 1) folkOf(c, t.id).stores = { food: 9000, wood: 9000, gold: 9000, stone: 9000 };
    rival.supplies = own.cost + OWN.reserve;
    expect(rivalLearns(c, 1)).toEqual([own.id]);
    expect(knows(c, 1, own.id)).toBe(true);
  });
});
const baseModsFor = (civ: string) => { const m = baseMods(); CIVS[civ].apply(m); return m; };

describe('what each study does on the map', () => {
  it('Franks, Kinship: children sooner', () => {
    const before = world('hearth');
    expect(birthPace(before.c, before.town.id)).toBe(1);
    const { c, town } = taught('hearth', 'own_kinship');
    expect(birthPace(c, town.id)).toBe(OWN.kinship);
    expect(birthPace(c, c.territories.find((t) => t.owner === 1)!.id)).toBe(1); // nobody else's towns
  });

  it('Babylonians, the King\'s Code, and Persians, Satrapies: a taken town settles sooner', () => {
    const b = taught('babylon', 'own_code');
    const was = goodRule(world('babylon').c, b.town.id);
    expect(yokeEase(b.c, b.town.id)).toBe(OWN.code);
    expect(goodRule(b.c, b.town.id)).toBe(was + OWN.code);
    expect(unrestEase(b.c, b.town.id)).toBe(OWN.codeUnrest);
    const p = taught('persia', 'own_satrapies'), q = world('persia');
    townTaken(p.c, p.town.id, 1, 0); townTaken(q.c, q.town.id, 1, 0);
    expect(yokeSpared(p.c, 0)).toBe(OWN.satrapStart);
    expect(resentOf(q.c, q.town.id) - resentOf(p.c, p.town.id)).toBe(OWN.satrapStart);
    expect(yokeEase(p.c, p.town.id)).toBe(OWN.satrapEase);
  });

  it('Greeks, the Assembly: less unrest', () => {
    const a = world('greece'), b = taught('greece', 'own_assembly');
    for (const w of [a, b]) { w.c.turn = 50; noteHolders(w.c); }
    expect(unrestChance(b.c, b.town.id)).toBeCloseTo(unrestChance(a.c, a.town.id) * OWN.assembly);
  });

  it('Malians, Caravans, and Egyptians, the Flood Calendar: goods every season', () => {
    const m = taught('mali', 'own_caravans');
    const gold = folkOf(m.c, m.town.id).stores.gold, towns = m.c.territories.filter((t) => t.owner === 0).length;
    expect(ownStudiesSeason(m.c)).toBe(OWN.caravans * towns);
    expect(folkOf(m.c, m.town.id).stores.gold).toBe(gold + OWN.caravans);
    const e = taught('egypt', 'own_flood');
    for (const t of e.c.territories) if (t.owner === 0) t.buildings = t.buildings.filter((x) => x !== 'farm');
    expect(ownStudiesSeason(e.c)).toBe(0); // no Farmland, no flood to count on
    e.town.buildings = ['farm'];
    const food = folkOf(e.c, e.town.id).stores.food;
    expect(ownStudiesSeason(e.c)).toBe(OWN.flood);
    expect(folkOf(e.c, e.town.id).stores.food).toBe(food + OWN.flood);
    expect(ownStudiesSeason(world('hearth').c)).toBe(0);
  });

  it('Kushites, the Land of the Bow, and Romans, Great Walls: harder to take', () => {
    const plain = world('kush'), k = taught('kush', 'own_bow');
    expect(defenceAdd(k.c, k.town.id)).toBe(OWN.bow);
    expect(defence(k.c, k.town.id)).toBeGreaterThan(defence(plain.c, plain.town.id));
    folkOf(k.c, k.town.id).men = 0;
    expect(defenceAdd(k.c, k.town.id)).toBe(0); // nobody to draw a bow
    const r = taught('stonekin', 'own_walls');
    expect(defenceAdd(r.c, r.town.id)).toBe(0);
    r.town.buildings = ['fortress'];
    expect(defenceAdd(r.c, r.town.id)).toBe(OWN.walls);
  });

  it('English, Yeomanry: a town stands better against a band', () => {
    const plain = world('england'), e = taught('england', 'own_yeomen');
    expect(defenceOf(e.c, e.town.id).total).toBeCloseTo(defenceOf(plain.c, plain.town.id).total * OWN.yeomen, 0);
  });

  it('Mongols, Remounts; Chinese, Examinations; Abbasids, Caravanserais; Japanese, the Bond of Service', () => {
    const m = taught('steppe', 'own_remounts');
    expect(restSpared(m.c, 0)).toBe(OWN.remounts);
    expect(ARMY_REST - restSpared(m.c, 0)).toBeGreaterThan(0);
    expect(restSpared(m.c, 1)).toBe(0);
    const f = taught('forge', 'own_examinations');
    expect(buildPace(f.c, f.town.id)).toBe(OWN.examinations);
    const a = taught('arabs', 'own_caravanserai');
    expect(roadRisk(a.c, 0)).toBe(OWN.caravanserai);
    expect(roadRisk(a.c, 1)).toBe(1);
    const j = taught('japan', 'own_bond');
    expect(moodEase(j.c, 0)).toBe(OWN.bond);
    expect(moodEase(j.c, 1)).toBe(1);
  });

  it('Arameans, Schools of the Prophets: a churched town grows more pious', () => {
    const { c, town } = taught('dawn', 'own_schools');
    expect(faithPull(c, town.id)).toBe(0);
    const was = townDrift(c, town.id);
    town.buildings = ['church'];
    expect(faithPull(c, town.id)).toBe(OWN.schools);
    expect(townDrift(c, town.id)).toBeGreaterThan(was + OWN.schools - 0.001);
  });

  it('Norse, Winter Stores: thin country costs them nothing', () => {
    const plain = world('wild'), n = taught('wild', 'own_winter');
    expect(ageOf(n.c, 0)).toBe(2);
    for (const t of n.c.territories) {
      if (t.owner !== 0) continue;
      expect(countryYield(n.c, t.id)).toBeGreaterThanOrEqual(t.buildings.includes('farm') ? countryYield(n.c, t.id) : 0);
      expect(countryYield(n.c, t.id)).toBeGreaterThanOrEqual(countryYield(plain.c, t.id));
    }
  });
});
