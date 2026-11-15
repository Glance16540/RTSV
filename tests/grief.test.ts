// Grief (docs/DESIGN.md, "Grief"; src/sim/grief.ts): a home that loses its mother or its sons works more slowly for
// a time, most in a town of middling morals.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import type { Building, Unit } from '../src/sim/game';
import { GRIEF_SECONDS, GRIEF_SEASONS, GRIEF_SLOW, griefPace, griefSeason, griefWeight, grieving, mourn } from '../src/sim/grief';
import { unitPortrait } from '../src/sim/portrait';
import type { Folk } from '../src/sim/township';
import { run, setups, spot, villagers } from './helpers';

/** A town with a house, a couple living in it who have raised a child, and a grown son born under its roof. */
const family = () => {
  const g = new Game(7, setups);
  const at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
  run(g, 1);
  g.cmdAutoResidents(0, h.id);
  run(g, 30);
  h.children = 1;
  const father = g.entities.get(h.residents.m) as Unit, mother = g.entities.get(h.residents.f) as Unit;
  const son = villagers(g, 0).find((v) => v.gender === 'm' && v !== father)!;
  son.bornAt = h.id;
  return { g, h, father, mother, son };
};

describe('a house grieves its mother and its sons', () => {
  it('the mother dies: the house grieves, and her husband works more slowly for a while', () => {
    const { g, h, father, mother } = family();
    expect(griefPace(g, father)).toBe(1);
    g.perish(mother);
    expect(grieving(h)).toBe(true);
    expect(h.griefT).toBe(GRIEF_SECONDS);
    expect(griefPace(g, father)).toBeCloseTo(1 - GRIEF_SLOW * griefWeight(0));
    expect(unitPortrait(g, father)!.marks).toContain('grieving');
    run(g, GRIEF_SECONDS + 2);
    expect(grieving(h)).toBe(false);
    expect(griefPace(g, father)).toBe(1);
  });

  it('a son who dies, at home or at war, is mourned; one who goes to be trained is not', () => {
    const { g, h, son } = family();
    son.enlisted = true;
    expect(mourn(g, son)).toBeNull();
    son.enlisted = false;
    expect(mourn(g, son)).toBe(h);
    // Someone with no tie to the house is not mourned by it.
    const other = villagers(g, 0).find((v) => v.gender === 'f' && v.id !== h.residents.f)!;
    (h as Building).griefT = 0;
    expect(mourn(g, other)).toBeNull();
  });

  it('it tells most in a middling town and half as much at the holy or the decadent end', () => {
    expect(griefWeight(0)).toBe(1);
    expect(griefWeight(80)).toBe(0.5);
    expect(griefWeight(-80)).toBe(0.5);
    expect(griefWeight(35)).toBeGreaterThan(0.5);
    const { g, father, mother } = family();
    g.players[0].virtue = 90;
    g.perish(mother);
    expect(griefPace(g, father)).toBeCloseTo(1 - GRIEF_SLOW * 0.5);
  });

  it('on the map a bereaved town grieves for some seasons', () => {
    const f = { men: 1, women: 1, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] } as Folk;
    griefSeason(f, true);
    expect(f.grief).toBe(GRIEF_SEASONS);
    for (let s = 0; s < GRIEF_SEASONS; s++) griefSeason(f, false);
    expect(f.grief).toBe(0);
  });
});
