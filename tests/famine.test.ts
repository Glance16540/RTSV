// Famine: a store that stays bare starves the town (src/sim/famine.ts).
import { describe, expect, it } from 'vitest';
import { FAMINE, nextLost, want } from '../src/sim/famine';
import { Game } from '../src/sim/game';
import { run, villagers } from './helpers';

const town = (civ = 'hearth', field = false) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ }, { name: 'B', color: 2, isAI: false, civ: 'england' }], 96, field);
  g.weatherT = 1e6;
  return g;
};
const said = (g: Game, what: string) => g.events.some((e) => e.t === 'msg' && e.player === 0 && e.text.includes(what));
const hallOf = (g: Game, owner = 0) => g.buildings.find((b) => b.owner === owner && b.type === 'towncenter')!;

describe('famine', () => {
  it('a bare store brings hunger, then famine, and food in the store ends it at once', () => {
    const g = town();
    const p = g.players[0];
    const all = g.units.filter((u) => u.owner === 0).length;
    p.res.food = 0;
    run(g, FAMINE.hungry - 2);
    expect(want(p)).toBe('');
    run(g, 4);
    expect(want(p)).toBe('hungry');
    expect(said(g, 'going hungry')).toBe(true);
    run(g, FAMINE.starving - FAMINE.hungry);
    expect(want(p)).toBe('famine');
    expect(said(g, 'Famine!')).toBe(true);
    expect(g.units.filter((u) => u.owner === 0).length).toBe(all); // nobody yet
    p.res.food = 60;
    run(g, 2);
    expect(want(p)).toBe('');
    expect(said(g, 'the famine is over')).toBe(true);
    run(g, FAMINE.toll * 3);
    expect(g.units.filter((u) => u.owner === 0).length).toBe(all);
    expect(g.players[1].hunger ?? 0).toBe(0); // the other town was never short
  });

  it('a store that is spent as fast as it fills is not a famine', () => {
    const g = town();
    const p = g.players[0];
    for (let s = 0; s < FAMINE.starving * 2; s++) { p.res.food = s % 40 === 0 ? 30 : 0; run(g, 1); }
    expect(p.hunger!).toBeLessThan(FAMINE.hungry);
    expect(p.starved ?? 0).toBe(0);
  });

  it('it takes the old first, then soldiers, then grown villagers, leaves the last few, and never a child', () => {
    const g = town();
    const p = g.players[0], at = hallOf(g);
    for (let i = 0; i < 4; i++) g.spawnUnit('villager', 0, at.x + 4 + i * 0.5, at.y + 5);
    const folk = villagers(g, 0);
    const elder = folk[0];
    elder.lifespan = 1e6; elder.age = 0.99e6;
    // A child on a house's record: a famine cannot reach it (nursery.ts).
    at.young = [{ id: 1e6, name: 'Small', family: '', gender: 'f', trait: '', trait2: '', lifespan: 9999, left: 1e9, bornAt: at.id }];
    const soldier = g.spawnUnit('clubman', 0, at.x + 5, at.y + 6);
    const grown = folk.length - 1;
    expect(grown).toBeGreaterThan(FAMINE.spare);
    expect(nextLost(g, 0)).toBe(elder);
    p.res.food = 0;
    const order: string[] = [];
    const seen = new Set<number>();
    run(g, FAMINE.starving + FAMINE.toll * (grown + 6), () => {
      p.res.food = 0;
      for (const u of [elder, soldier, ...folk]) if (u.dead && !seen.has(u.id)) { seen.add(u.id); order.push(u === elder ? 'old' : u === soldier ? 'soldier' : 'grown'); }
    });
    expect(order.slice(0, 2)).toEqual(['old', 'soldier']);
    expect(order.slice(2).every((x) => x === 'grown')).toBe(true);
    expect(at.young.length).toBe(1);
    expect(villagers(g, 0).length).toBe(FAMINE.spare);
    expect(p.starved).toBe(2 + grown - FAMINE.spare);
    expect(nextLost(g, 0)).toBe(null);
    expect(said(g, 'has starved')).toBe(true);
    expect(said(g, 'has walked away from your army')).toBe(true);
    expect(p.defeated).toBe(false);
  });

  it('one loss every FAMINE.toll seconds, no sooner', () => {
    const g = town();
    const p = g.players[0], at = hallOf(g);
    for (let i = 0; i < 6; i++) g.spawnUnit('villager', 0, at.x + 4 + i * 0.5, at.y + 5);
    const n = () => villagers(g, 0).length, first = n();
    p.res.food = 0;
    run(g, FAMINE.starving + FAMINE.toll - 2);
    expect(n()).toBe(first);
    run(g, 4);
    expect(n()).toBe(first - 1);
    run(g, FAMINE.toll);
    expect(n()).toBe(first - 2);
  });

  it('sickness follows hunger; among the Righteous three times as late, and a third as long', () => {
    const sick = (virtue: number, wait = FAMINE.plague + 3) => {
      const g = town();
      const p = g.players[0];
      p.virtue = virtue;
      p.res.food = 0;
      let struck = 0;
      run(g, wait, () => { p.res.food = 0; p.virtue = virtue; struck = Math.max(struck, g.units.filter((u) => u.owner === 0 && u.plagueT > 0).length); });
      return { struck, told: said(g, 'Sickness has followed hunger'), creed: g.creed(0).id };
    };
    const plain = sick(0);
    expect(plain.struck).toBeGreaterThan(0);
    expect(plain.told).toBe(true);
    const holy = sick(100);
    expect(holy.creed).toBe('zealous');
    expect(holy.struck).toBe(0);
    expect(holy.told).toBe(false);
    const later = sick(100, FAMINE.plague * 3 + 3);
    expect(later.told).toBe(true);
    expect(later.struck).toBeGreaterThan(0);
  });

  it('a war band with no hall, and the armies of a field battle, do not starve', () => {
    const band = town('wild');
    expect(band.buildings.some((b) => b.owner === 0 && b.type === 'towncenter')).toBe(false);
    band.players[0].res.food = 0;
    const field = town('hearth', true);
    field.players[0].res.food = 0;
    for (const g of [band, field]) {
      const all = g.units.filter((u) => u.owner === 0).length;
      run(g, FAMINE.starving + FAMINE.toll * 2, () => { g.players[0].res.food = 0; });
      expect(g.players[0].hunger ?? 0).toBe(0);
      expect(g.units.filter((u) => u.owner === 0).length).toBe(all);
    }
  });
});
