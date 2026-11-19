// The war band's own first steps: a raiding people in the open are not shown the settled town's.
import { describe, expect, it } from 'vitest';
import { BAND } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { bandCount, onTheMove, raiderSteps } from '../src/sim/raiderguide';
import { run, villagers } from './helpers';

const band = () => { const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'steppe' }, { name: 'B', color: 2, isAI: true, civ: 'hearth' }], 72); run(g, 1); return g; };

describe('the war band\'s guide', () => {
  it('is for a raiding people with no hall, and not for a settled one', () => {
    const g = band();
    expect(onTheMove(g, 0)).toBe(true);
    expect(onTheMove(g, 1)).toBe(false);
  });

  it('begins with taking people alive, quotes the band\'s own numbers, and has no undone words', () => {
    const g = band(), steps = raiderSteps(g, 0);
    expect(steps.map((s) => s.title)).toEqual(['Take people alive', 'Put the band to work', 'Settle when you choose']);
    expect(steps[0].how).toContain(`${BAND.fighters} fighters`);
    expect(steps.every((s) => !s.done)).toBe(true);
    for (const s of steps) expect(s.how).not.toMatch(/undefined|NaN/);
  });

  it('counts a villager taken, and ends once the hall stands', () => {
    const g = band();
    const v = villagers(g, 0)[0];
    for (let i = 0; i < 2; i++) g.spawnUnit('villager', 0, v.x + 1 + i, v.y, 'm');
    expect(raiderSteps(g, 0)[0].done).toBe(true);
    g.spawnBuilding('towncenter', 0, Math.floor(v.x) - 1, Math.floor(v.y) - 5, true);
    expect(raiderSteps(g, 0)[2].done).toBe(true);
    expect(onTheMove(g, 0)).toBe(false); // a town now: the settled town's steps follow
  });
});

describe('the band\'s head count', () => {
  it('says a full band is full, plainly, and how to grow', () => {
    expect(bandCount(9, 12)).toMatchObject({ text: '9/12' });
    const full = bandCount(12, 12);
    expect(full.text).toBe('12 · band full');
    expect(full.tip).toMatch(/raise a Town Center/);
  });
});
