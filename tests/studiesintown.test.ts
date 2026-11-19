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
