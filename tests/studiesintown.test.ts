// The studies of rule, law, nobles and faith in a town (src/sim/studiesintown.ts): each does in a battle or a visit of the
// nation's town what it does on the map, where it has a meaning there.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { STUDY_TOWN, feastCare, lawGuard, markBegun, spyWatch, studyBuild } from '../src/sim/studiesintown';
import { run, setups, spot } from './helpers';

/** A town with a work standing half-built, and a villager set to build it; its people knowing Stewardship or not. */
function building(steward: boolean): { g: Game; progress: () => number } {
  const g = new Game(5, setups);
  if (steward) g.players[0].techs.add('stewardship');
  const at = spot(g, 'barracks', 0);
  const b = g.spawnBuilding('barracks', 0, at.cx, at.cy, false);
  b.progress = 0.2;
  markBegun(g, 0);
  const v = g.units.find((u) => u.owner === 0 && u.type === 'villager')!;
  g.setOrder(v, { t: 'build', id: b.id, then: null });
  return { g, progress: () => b.progress };
}

describe('studies in a town', () => {
  it('Stewardship: a work begun before the sitting is built half again as fast; a new one, and without it, as before', () => {
    const plain = building(false), stewarded = building(true);
    // From the moment work begins (the builder has walked over), for a stretch short of finishing it.
    const begin = (x: ReturnType<typeof building>) => { for (let i = 0; i < 600 && x.progress() <= 0.2; i++) x.g.step(); return x.progress(); };
    const p0 = begin(plain), s0 = begin(stewarded);
    run(plain.g, 4); run(stewarded.g, 4);
    const a = plain.progress() - p0, b = stewarded.progress() - s0;
    expect(stewarded.progress()).toBeLessThan(1);
    expect(a).toBeGreaterThan(0);
    expect(b / a).toBeCloseTo(STUDY_TOWN.steward, 1);
    const g = new Game(5, setups);
    g.players[0].techs.add('stewardship');
    const at = spot(g, 'barracks', 0);
    const fresh = g.spawnBuilding('barracks', 0, at.cx, at.cy, false); // laid after the sitting began: not begun before
    expect(studyBuild(g, fresh)).toBe(1);
  });

  it('Written Law, Spymasters and Feast Days each act only for the people that knows them', () => {
    const g = new Game(5, setups);
    expect([lawGuard(g, 0), spyWatch(g, 0), feastCare(g, 0)]).toEqual([1, 1, 1]);
    g.players[0].techs.add('writtenlaw'); g.players[0].techs.add('spymasters'); g.players[0].techs.add('feastdays');
    expect(lawGuard(g, 0)).toBe(STUDY_TOWN.law);
    expect(spyWatch(g, 0)).toBe(STUDY_TOWN.spies);
    expect(feastCare(g, 0)).toBe(STUDY_TOWN.feast);
    expect([lawGuard(g, 1), spyWatch(g, 1), feastCare(g, 1)]).toEqual([1, 1, 1]); // the other side does not know them
    expect(STUDY_TOWN.law).toBeLessThan(1);
    expect(STUDY_TOWN.spies).toBeLessThan(1);
    expect(STUDY_TOWN.feast).toBeGreaterThan(1);
  });
});

describe('studies in a town: each rule on its own', () => {
  const place = (g: Game, type: string, owner: number, complete: boolean) => { const at = spot(g, type, owner); return g.spawnBuilding(type, owner, at.cx, at.cy, complete); };

  it('the figures are the map\'s: half again as fast, four-fifths, seven-tenths, a quarter more', () => {
    expect(STUDY_TOWN).toEqual({ steward: 1.5, law: 0.8, spies: 0.7, feast: 1.25 });
  });

  it('markBegun marks only this side\'s works standing half-built and whole, and counts them', () => {
    const g = new Game(5, setups);
    const half = place(g, 'barracks', 0, false), done = place(g, 'house', 0, true), fallen = place(g, 'range', 0, false), theirs = place(g, 'barracks', 1, false);
    fallen.dead = true;
    const before = g.buildings.filter((b) => b.owner === 0 && !b.dead && !b.complete).length;
    expect(markBegun(g, 0)).toBe(before);
    expect(before).toBeGreaterThanOrEqual(1);
    expect(half.begun).toBe(true);
    expect(done.begun).toBeUndefined();
    expect(fallen.begun).toBeUndefined();
    expect(theirs.begun).toBeUndefined();
    // Asked again it finds the same works.
    expect(markBegun(g, 0)).toBe(before);
    expect(markBegun(g, 1)).toBe(g.buildings.filter((b) => b.owner === 1 && !b.dead && !b.complete).length);
    expect(theirs.begun).toBe(true);
  });

  it('a side with nothing half-built marks nothing', () => {
    const g = new Game(5, setups);
    for (const b of g.buildings) if (b.owner === 0) b.complete = true;
    expect(markBegun(g, 0)).toBe(0);
    expect(g.buildings.some((b) => b.begun)).toBe(false);
  });

  it('studyBuild: half again as fast only for a work begun before, its people knowing Stewardship', () => {
    const g = new Game(5, setups);
    const b = place(g, 'barracks', 0, false), t = place(g, 'barracks', 1, false);
    expect(studyBuild(g, b)).toBe(1); // not begun, no study
    markBegun(g, 0); markBegun(g, 1);
    expect(studyBuild(g, b)).toBe(1); // begun, but the study unknown
    g.players[0].techs.add('stewardship');
    expect(studyBuild(g, b)).toBe(STUDY_TOWN.steward);
    expect(studyBuild(g, t)).toBe(1); // the other side does not know it
    g.players[0].techs.add('writtenlaw');
    expect(studyBuild(g, b)).toBe(STUDY_TOWN.steward); // another study changes nothing here
    b.begun = false;
    expect(studyBuild(g, b)).toBe(1);
  });

  it('each study acts on its own measure only, and a side that is not there knows nothing', () => {
    const g = new Game(5, setups);
    const all = () => [lawGuard(g, 0), spyWatch(g, 0), feastCare(g, 0)];
    g.players[0].techs.add('writtenlaw');
    expect(all()).toEqual([STUDY_TOWN.law, 1, 1]);
    g.players[0].techs.delete('writtenlaw'); g.players[0].techs.add('spymasters');
    expect(all()).toEqual([1, STUDY_TOWN.spies, 1]);
    g.players[0].techs.delete('spymasters'); g.players[0].techs.add('feastdays');
    expect(all()).toEqual([1, 1, STUDY_TOWN.feast]);
    // Oaths of Fealty and Pilgrimage do nothing in a town.
    g.players[0].techs.delete('feastdays'); g.players[0].techs.add('oaths'); g.players[0].techs.add('pilgrimage');
    expect(all()).toEqual([1, 1, 1]);
    expect([lawGuard(g, 7), spyWatch(g, 7), feastCare(g, 7)]).toEqual([1, 1, 1]);
    expect([lawGuard(g, -1), spyWatch(g, -1), feastCare(g, -1)]).toEqual([1, 1, 1]);
  });

  it('the other side learning them changes nothing for this one', () => {
    const g = new Game(5, setups);
    for (const id of ['writtenlaw', 'spymasters', 'feastdays', 'stewardship']) g.players[1].techs.add(id);
    expect([lawGuard(g, 0), spyWatch(g, 0), feastCare(g, 0)]).toEqual([1, 1, 1]);
    expect([lawGuard(g, 1), spyWatch(g, 1), feastCare(g, 1)]).toEqual([STUDY_TOWN.law, STUDY_TOWN.spies, STUDY_TOWN.feast]);
  });
});
