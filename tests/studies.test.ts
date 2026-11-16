// A nation's studies on the map, and buildings raised on a town's record (src/sim/studies.ts, src/sim/townworks.ts).
// No real study or map building exists yet: these tests make one of each, and take them away again.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { BUILDINGS, TECHS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { allStudies, hasStudy, isStudy, learn, learnedIn, standsAt, studiesOf, studyBar, studySeason, teacherOf } from '../src/sim/studies';
import { mapWorks, raiseBar, raiseWork } from '../src/sim/townworks';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { governTown } from '../src/sim/governor';
import { folkOf } from '../src/sim/township';
import { layTown } from '../src/sim/rivalrule';

const world = (): { c: Campaign; tid: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  const s = folkOf(c, tid).stores;
  s.food = 2000; s.wood = 2000; s.gold = 2000; s.stone = 2000;
  layTown(c, tid);
  return { c, tid };
};

beforeEach(() => {
  BUILDINGS.testhall = { ...BUILDINGS.temple, id: 'testhall', name: 'Test Hall', techs: ['testlaw'], trains: [], onMap: true, age: 0, cost: { wood: 100, stone: 50 } };
  TECHS.testlaw = { id: 'testlaw', name: 'Test Law', icon: '📜', desc: 'For the tests.', cost: { gold: 100 }, time: 5, age: 0, answers: 'unrest', apply: (m) => { m.gather += 0.01; } };
});
afterEach(() => { delete BUILDINGS.testhall; delete TECHS.testlaw; });

describe('what is a study', () => {
  it('a tech that says what it answers is a study, and one that does not is not', () => {
    expect(isStudy('testlaw')).toBe(true);
    expect(isStudy('weapons1')).toBe(false);
    // The game has studies of its own now (the first were each people's own, ownstudies.ts), so this asks only after the one made here.
    expect(allStudies().map((t) => t.id)).toContain('testlaw');
    expect(teacherOf('testlaw')).toBe('testhall');
    delete TECHS.testlaw;
    expect(allStudies().map((t) => t.id)).not.toContain('testlaw');
  });
});

describe('a building raised on the town\'s record', () => {
  it('is begun at a free plot out of the town\'s own stores, and the governor finishes it', () => {
    const { c, tid } = world(), t = c.territories[tid], s = folkOf(c, tid).stores;
    expect(mapWorks()).toContain('testhall');
    expect(raiseBar(c, 0, tid, 'testhall')).toBe('');
    expect(raiseWork(c, 0, tid, 'testhall')).toBe('');
    expect(s.wood).toBe(1900);
    expect(s.stone).toBe(1950);
    expect(t.town!.b.some((x) => x[0] === 'testhall' && x[4] !== undefined)).toBe(true);
    expect(raiseBar(c, 0, tid, 'testhall')).toMatch(/already/);
    expect(raiseBar(c, 0, tid, 'testhall', () => 'Not here.')).toMatch(/already|Not here/);
    for (let i = 0; i < 20 && !standsAt(c, tid, 'testhall'); i++) { c.turn++; governTown(c, tid); }
    expect(standsAt(c, tid, 'testhall')).toBe(true);
  });
});

describe('learning a study on the map', () => {
  it('needs the building that teaches it standing in the town, and is paid from it', () => {
    const { c, tid } = world();
    expect(studyBar(c, 0, 'testlaw', tid)).toMatch(/taught at a Test Hall/);
    c.territories[tid].town!.b.push(['testhall', 2, 2]);
    expect(studyBar(c, 0, 'testlaw', tid)).toBe('');
    const gold = folkOf(c, tid).stores.gold;
    expect(learn(c, 0, 'testlaw', tid)).toBe('');
    expect(hasStudy(c, 0, 'testlaw')).toBe(true);
    expect(folkOf(c, tid).stores.gold).toBe(gold - 100);
    expect(studyBar(c, 0, 'testlaw', tid)).toMatch(/Already/);
  });

  it('a rival learns the study that answers what presses on its towns, and nothing that answers nothing pressing', () => {
    const { c } = world();
    const r = c.territories.find((t) => t.owner === 1)!;
    const s = folkOf(c, r.id).stores; s.food = 5000; s.wood = 5000; s.gold = 5000; s.stone = 5000;
    r.town = r.town ?? { at: 0, b: [] };
    r.town.b.push(['testhall', 2, 2]);
    expect(studySeason(c, 1)).toBeNull(); // nothing presses: no unrest
    r.yoke = { from: 0, since: c.turn, resent: 40 };
    expect(studySeason(c, 1)).toBe('testlaw');
    expect(studiesOf(c, 1)).toEqual(['testlaw']);
  });
});

describe('a study in a visit', () => {
  it('the nation\'s studies are known in the town, and one learned there comes home', () => {
    const { c, tid } = world();
    c.factions[0].studies = ['testlaw'];
    beginVisit(c, tid);
    const cfg = visitConfig(c)!;
    expect(cfg.setups[0].bonus?.studies).toEqual(['testlaw']);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(g.players[0].techs.has('testlaw')).toBe(true);
    // Learned in the town instead, it comes home.
    c.factions[0].studies = [];
    expect(learnedIn(g.players[0].techs)).toEqual(['testlaw']);
    finishVisit(c, { studies: learnedIn(g.players[0].techs) });
    expect(hasStudy(c, 0, 'testlaw')).toBe(true);
    // What is not a study does not come home.
    c.factions[0].studies = [];
    c.visit = null; c.territories[tid].visited = -1;
    beginVisit(c, tid);
    finishVisit(c, { studies: ['weapons1', 'nonsense', 3] as never });
    expect(studiesOf(c, 0)).toEqual([]);
  });
});
