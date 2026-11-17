// A tribe's people have names of their own, no two alike in one battle (src/sim/tribenames.ts; docs/PLAYTEST.md 2.4).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { NAMES_F, NAMES_M } from '../src/sim/data';
import { armyAt, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { TRIBE_NAMES_F, TRIBE_NAMES_M, freeName, tribeName } from '../src/sim/tribenames';
import { setups } from './helpers';

describe('the names of a tribe', () => {
  it('are their own: none is a name of the settled peoples, and none is said twice in a list', () => {
    for (const n of [...TRIBE_NAMES_M, ...TRIBE_NAMES_F]) expect([...NAMES_M, ...NAMES_F]).not.toContain(n);
    expect(new Set(TRIBE_NAMES_M).size).toBe(TRIBE_NAMES_M.length);
    expect(new Set(TRIBE_NAMES_F).size).toBe(TRIBE_NAMES_F.length);
    expect(TRIBE_NAMES_M.length).toBeGreaterThanOrEqual(40);
  });

  it('the lot steps on to the next name free, and falls where it would when all are taken', () => {
    const names = ['a', 'b', 'c'];
    expect(freeName(names, 0, new Set())).toBe('a');
    expect(freeName(names, 0.99, new Set())).toBe('c');
    expect(freeName(names, 0, new Set(['a']))).toBe('b');
    expect(freeName(names, 0.99, new Set(['c']))).toBe('a'); // round to the start
    expect(freeName(names, 0.5, new Set(['a', 'b', 'c']))).toBe('b');
    expect(TRIBE_NAMES_M).toContain(tribeName('m', 0.3, new Set()));
    expect(TRIBE_NAMES_F).toContain(tribeName('f', 0.3, new Set()));
  });

  it('on the field a tribe\'s people are named so, without repeats; a settled people as before', () => {
    const g = new Game(7, [setups[0], { ...setups[1], name: 'Local Tribe', tribe: true }]);
    for (let i = 0; i < 20; i++) g.spawnUnit('villager', 1, 60 + (i % 5), 60 + Math.floor(i / 5), i % 2 ? 'f' : 'm');
    const theirs = g.units.filter((u) => u.owner === 1 && u.type === 'villager'), mine = g.units.filter((u) => u.owner === 0 && u.type === 'villager');
    expect(theirs.length).toBeGreaterThan(20);
    for (const u of theirs) expect(u.gender === 'm' ? TRIBE_NAMES_M : TRIBE_NAMES_F).toContain(u.name);
    expect(new Set(theirs.map((u) => u.name)).size).toBe(theirs.length);
    for (const u of mine) expect(u.gender === 'm' ? NAMES_M : NAMES_F).toContain(u.name);
  });

  it('the locals of a campaign battle are marked as a tribe, and a rival nation is not', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
    const to = home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde)!;
    expect(moveArmy(c, armyAt(c, home.id)!.id, to)).toBe('battle');
    const cfg = battleConfig(c)!;
    expect(cfg.setups.find((s) => s.name === 'Local Tribe')!.tribe).toBe(true);
    expect(cfg.setups[0].tribe).toBeUndefined();
  });
});
