// Crowding breeds plague (src/sim/acts.ts, ACTS.crowd): a hamlet is struck and passed to less often than a town,
// and loses fewer; a town of ACTS.crowd people or more is as it ever was; the creed's measure is untouched.
import { describe, expect, it } from 'vitest';
import { ACTS, actsOfGod, crowding, sicken } from '../src/sim/acts';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { folkOf } from '../src/sim/township';

/** Every town of the player's with this many men and this many women, and stores enough for anything. */
const people = (c: Campaign, n: number) => {
  for (const t of c.territories) if (t.owner === 0) { const k = folkOf(c, t.id); k.men = n; k.women = n; k.elders = 0; k.children = 0; delete k.ages; k.stores = { food: 1e6, wood: 1e6, gold: 1e6, stone: 1e6 }; }
};
const world = () => {
  const c = newCampaign(11, 2);
  c.factions[0].virtue = 0;
  for (const t of c.territories.filter((x) => x.owner !== 0 && x.capital < 0).slice(0, 7)) t.owner = 0;
  c.fronts = [];
  return c;
};
/** Outbreaks of plague among the player's towns over many seasons. */
const outbreaks = (c: Campaign, n: number, size: number) => {
  let k = 0;
  for (let s = 0; s < n; s++) { c.turn = 10 + s; c.events = []; people(c, size); k += actsOfGod(c).filter((x) => x.owner === 0 && x.kind === 'plague' && x.from === undefined).length; }
  return k;
};

describe('crowding breeds plague', () => {
  it('measures a town by its people, up to a whole at ACTS.crowd', () => {
    const c = world(), t = c.territories.find((x) => x.owner === 0)!;
    people(c, 2);
    expect(crowding(c, t.id)).toBeCloseTo(4 / ACTS.crowd);
    people(c, ACTS.crowd);
    expect(crowding(c, t.id)).toBe(1);
  });
  it('a hamlet is struck far less often than a crowded town', () => {
    const big = outbreaks(world(), 3000, ACTS.crowd), small = outbreaks(world(), 3000, 2);
    expect(big).toBeGreaterThan(0);
    expect(small / big).toBeGreaterThan(0.08);
    expect(small / big).toBeLessThan(0.35); // about 4 people in 20
  });
  it('a hamlet loses fewer, and a town of ACTS.crowd or more loses as it always did', () => {
    const c = world(), t = c.territories.find((x) => x.owner === 0)!;
    people(c, 20);
    expect(sicken(c, t)).toBe(Math.round(40 * ACTS.sick));
    // A hamlet of four: a tenth of four, by its crowding, is less than one person, so a chance of one.
    let dead = 0;
    for (let s = 0; s < 400; s++) { c.turn = 10 + s; people(c, 2); dead += sicken(c, t); }
    expect(dead / 400).toBeGreaterThan(0.01);
    expect(dead / 400).toBeLessThan(0.15); // 4 × 0.1 × 4/20 = 0.08 a season, where before it was always one
  });
  it('passes next door less to a hamlet than to a crowded town', () => {
    const passed = (size: number) => {
      const d = world(), home = d.territories.find((x) => x.owner === 0 && x.adj.length > 0)!;
      for (const id of home.adj) d.territories[id].owner = 0;
      let k = 0;
      for (let s = 0; s < 2000; s++) {
        d.turn = 10 + s; people(d, size); const h = folkOf(d, home.id); h.men = h.women = ACTS.crowd;
        d.events = [{ kind: 'plague', at: home.id, turn: d.turn, until: d.turn }];
        if (actsOfGod(d).some((x) => x.from === home.id)) k++;
      }
      return k;
    };
    const toTown = passed(ACTS.crowd), toHamlet = passed(2);
    expect(toTown / 2000).toBeGreaterThan(ACTS.spread * 0.75);
    expect(toHamlet / toTown).toBeLessThan(0.4);
  });
});
