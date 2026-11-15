// Towns eat their food on the map (src/sim/larder.ts, docs/DESIGN.md "Stores").
import { describe, expect, it } from 'vitest';
import { answerDemand, continueAI, endTurn, landIncome, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { EAT, KEEP_SEASONS, ROT, STARVE_AFTER, STARVE_SHARE, eatTown, larderSeason, mouths, needOf } from '../src/sim/larder';
import { driftTown } from '../src/sim/drift';
import { spread, yieldShares } from '../src/sim/harvest';
import { SUPPLY_UNITS } from '../src/sim/stores';
import { folkOf } from '../src/sim/township';

const LONG = 60_000;
/** A town of the player's beside the capital, with the people and food asked for and nothing else in it. */
function town(people: { men?: number; women?: number; elders?: number; children?: number } = {}, food = 1000) {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const t = c.territories.find((x) => x.owner < 0 && home.adj.includes(x.id))!;
  t.owner = 0; t.buildings = [];
  const f = folkOf(c, t.id);
  f.men = people.men ?? 5; f.women = people.women ?? 5; f.elders = people.elders ?? 2; f.children = people.children ?? 4;
  delete f.ages; delete f.drift;
  f.stores = { food, wood: 100, gold: 100, stone: 100 };
  return { c, t, f };
}

describe('towns eat their food on the map', () => {
  it('everyone on the record eats a season\'s share: the grown most, the old less, children least', () => {
    const { c, t, f } = town({ men: 5, women: 5, elders: 2, children: 4 });
    const need = 10 * EAT.grown + 2 * EAT.old + 4 * EAT.child;
    expect(needOf(c, t.id)).toBe(need);
    const m = eatTown(c, t.id);
    expect(m).toMatchObject({ need, ate: need, hungry: 0, dead: 0 });
    // What is left beyond KEEP_SEASONS of eating spoils, ROT of it.
    const left = 1000 - need, rot = Math.floor((left - KEEP_SEASONS * need) * ROT);
    expect(m.rotted).toBe(rot);
    expect(f.stores.food).toBe(left - rot);
    expect(f.hungry).toBeUndefined();
  });

  it('food beyond a couple of seasons\' eating spoils, a share a season, and none below that', () => {
    const { c, t, f } = town({ men: 5, women: 5, elders: 0, children: 0 });
    const need = needOf(c, t.id);
    f.stores.food = need * (1 + KEEP_SEASONS); // just enough to eat and keep
    expect(eatTown(c, t.id).rotted).toBe(0);
    expect(f.stores.food).toBe(need * KEEP_SEASONS);
    f.stores.food = 100000; // a granary of years
    for (let s = 0; s < 30; s++) { c.turn++; eatTown(c, t.id); }
    expect(f.stores.food).toBeLessThan(need * (KEEP_SEASONS + 1)); // spoiled down to about what keeps
  });

  it('those who have drifted to the mines or the tavern eat there, not at home', () => {
    const { c, t, f } = town({ men: 6, women: 6, elders: 0, children: 0 });
    f.drifted = { tavern: 0, mines: 3 }; // who has drifted is on the town's record (drift.ts)
    expect(mouths(c, t.id)).toMatchObject({ men: 3, women: 6 }); // no tavern: the women stay
    t.buildings = ['tavern'];
    f.drifted = { tavern: 3, mines: 3 };
    expect(mouths(c, t.id)).toMatchObject({ men: 3, women: 3 });
    expect(needOf(c, t.id)).toBe(6 * EAT.grown);
  });

  it('a town that cannot eat in full eats what there is and goes hungry, and drift reads it as strain', () => {
    const { c, t, f } = town({}, 50);
    const m = eatTown(c, t.id);
    expect(m.ate).toBe(50);
    expect(m.hungry).toBe(1);
    expect(f.stores.food).toBe(0);
    driftTown(c, t.id);
    expect(f.drift!.hungry).toBe(true);
    expect(f.drift!.strain).toBeGreaterThan(0);
    // Fed again, it is hungry no longer.
    f.stores.food = 1000;
    expect(eatTown(c, t.id).hungry).toBe(0);
    expect(f.hungry).toBeUndefined();
  });

  it('hungry long enough, a town loses its grown people, the old first, and never a child', () => {
    const { c, t, f } = town({ men: 10, women: 10, elders: 2, children: 6 }, 0);
    for (let s = 1; s <= STARVE_AFTER; s++) { c.turn++; expect(eatTown(c, t.id)).toMatchObject({ hungry: s, dead: 0 }); }
    c.turn++;
    const m = eatTown(c, t.id);
    expect(m.dead).toBe(Math.round(22 * STARVE_SHARE));
    expect(f.elders).toBe(0); // the old first
    expect(f.men + f.women).toBe(20 - (m.dead - 2));
    expect(f.children).toBe(6);
    for (let s = 0; s < 40; s++) { c.turn++; eatTown(c, t.id); }
    expect(f.men + f.women + f.elders).toBe(0); // with nothing coming in, the grown all die in the end
    expect(f.children).toBe(6); // and no child
  });

  it('a farmed town of twenty is about fed by its own fields; a town with none is not', () => {
    const { c, t, f } = town({ men: 7, women: 7, elders: 0, children: 6 });
    const fed = (land: Territory) => spread(landIncome(c, 0, land) * SUPPLY_UNITS, yieldShares(c, land.id)).food;
    t.buildings = ['farm'];
    const need = needOf(c, t.id);
    expect(fed(t)).toBeGreaterThanOrEqual(need * 0.8);
    t.buildings = [];
    expect(fed(t)).toBeLessThan(need * 0.6);
    expect(f.children).toBe(6);
  });

  it('the local tribes\' towns are not counted, and a season of it is told in the log', () => {
    const { c, t } = town({}, 0);
    const tribe = c.territories.find((x) => x.owner < 0)!;
    folkOf(c, tribe.id).stores.food = 0;
    const meals = larderSeason(c);
    expect(meals.some((m) => m.at === tribe.id)).toBe(false);
    expect(meals.find((m) => m.at === t.id)!.hungry).toBe(1);
    expect(c.log.some((l) => l.includes(`The granary at ${t.name} is empty`))).toBe(true);
  });

  it('thirty seasons of a campaign: no town\'s food runs below nothing, and every held town is counted', () => {
    const c: Campaign = newCampaign(5, 2);
    for (let i = 0; i < 30 && c.phase !== 'over'; i++) {
      endTurn(c);
      for (let k = 0; k < 60 && (c.pending || c.demand || c.phase === 'ai'); k++) { if (c.pending) resolvePending(c, 'auto'); if (c.demand) answerDemand(c, true); continueAI(c); }
      for (const t of c.territories) expect(folkOf(c, t.id).stores.food, t.name).toBeGreaterThanOrEqual(0);
    }
  }, LONG);
});
