// A harvest that fails by chance (leanYear in src/sim/famine.ts): the act of God that brings famine unasked.
import { describe, expect, it } from 'vitest';
import { FAMINE, leanYear, want } from '../src/sim/famine';
import { Game } from '../src/sim/game';
import { run, spot, villagers } from './helpers';

const town = (virtue = 0, farms = 6, field = false) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }], 96, field);
  g.weatherT = 1e6;
  g.players[0].virtue = virtue;
  const fields = [];
  for (let i = 0; i < farms; i++) { const at = spot(g, 'farm', 0); fields.push(g.spawnBuilding('farm', 0, at.cx, at.cy, true)); }
  return { g, fields };
};
/** Many seconds of chance, clearing each failure as it comes: how many failures, and how they fell. */
const years = (g: Game, n: number, virtue: number) => {
  let fails = 0, most = 0, least = 99, long = 0;
  for (let s = 0; s < n; s++) {
    g.tick += 20; g.time += 1; g.players[0].virtue = virtue;
    const struck = leanYear(g).filter((b) => b.owner === 0);
    if (struck.length) { fails++; most = Math.max(most, struck.length); least = Math.min(least, struck.length); long = struck[0].blightT!; }
    for (const b of g.buildings) b.blightT = 0;
  }
  return { fails, most, least, long };
};

describe('a harvest that fails by chance', () => {
  it('comes about once in FAMINE.lean seconds to an ordinary town, takes half its fields, and the town is told', () => {
    const { g } = town();
    const r = years(g, FAMINE.lean * 60, 0);
    expect(r.fails).toBeGreaterThan(40);
    expect(r.fails).toBeLessThan(85);
    expect(r.most).toBe(3); expect(r.least).toBe(3);
    expect(r.long).toBe(FAMINE.barren);
    expect(g.events.some((e) => e.t === 'msg' && e.player === 0 && e.text.includes('The harvest has failed on 3 of your 6 fields'))).toBe(true);
    expect(g.events.some((e) => e.t === 'blight')).toBe(true);
  });

  it('a third as often, on fewer fields and for a third as long among the Righteous; more of each among the Decadent', () => {
    const n = FAMINE.lean * 120;
    const holy = years(town(100).g, n, 100), plain = years(town().g, n, 0), fallen = years(town(-100).g, n, -100);
    expect(holy.fails).toBeGreaterThan(0); // nobody is spared
    expect(holy.fails / plain.fails).toBeGreaterThan(0.2);
    expect(holy.fails / plain.fails).toBeLessThan(0.5);
    expect(fallen.fails / plain.fails).toBeGreaterThan(1.2);
    expect(holy.most).toBe(1);
    expect(fallen.most).toBe(5); // three quarters of six, rounded
    expect(holy.long).toBeCloseTo(FAMINE.barren / 3, 5);
    expect(fallen.long).toBeCloseTo(FAMINE.barren * 1.5, 5);
  });

  it('never in heavy rain, about twice as often in a dust storm, and never to a town with no fields or in a field battle', () => {
    const n = FAMINE.lean * 80;
    const wet = town().g; wet.weather = 'rain'; wet.weatherAmt = wet.weatherWant = 1;
    expect(years(wet, n, 0).fails).toBe(0);
    const dry = town().g; dry.weather = 'dust'; dry.weatherAmt = dry.weatherWant = 1;
    const clear = years(town().g, n, 0).fails, dusty = years(dry, n, 0).fails;
    expect(dusty / clear).toBeGreaterThan(1.5);
    expect(dusty / clear).toBeLessThan(2.6);
    expect(years(town(0, 0).g, n, 0).fails).toBe(0);
    const battle = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }], 96, true);
    battle.spawnBuilding('farm', 0, 20, 20, true);
    expect(years(battle, n, 0).fails).toBe(0);
  });

  it('a town of one field loses it; a failed field yields nothing, and a town living from field to mouth goes hungry for it', () => {
    const one = town(0, 1);
    expect(years(one.g, FAMINE.lean * 60, 0).most).toBe(1);

    const fed = (failed: boolean) => {
      const { g, fields } = town(0, 2);
      const p = g.players[0];
      const hands = villagers(g, 0);
      g.cmdTarget(0, [hands[0].id], fields[0].id);
      g.cmdTarget(0, [hands[1].id], fields[1].id);
      for (const u of hands.slice(2)) (g as unknown as { kill(e: unknown): void }).kill(u);
      run(g, 30);
      p.res.food = 0;
      let hungry = false;
      run(g, FAMINE.hungry + 20, () => { if (failed) for (const f of fields) f.blightT = 50; if (want(p)) hungry = true; });
      return { hungry, food: p.res.food };
    };
    const good = fed(false), bad = fed(true);
    expect(good.hungry).toBe(false);
    expect(good.food).toBeGreaterThan(0);
    expect(bad.food).toBe(0);
    expect(bad.hungry).toBe(true);
  });
});
