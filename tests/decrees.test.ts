// Decrees (docs/DESIGN.md, "Decrees"; src/sim/decrees.ts): the leader rules a town by decree, at a cost, for some
// seasons, in person or more weakly by messenger, and each decree bends how the town drifts.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { seat } from '../src/sim/court';
import { ALMS_FOOD, DECREES, MESSENGER, TAVERN_WOMEN_GOLD, decreeBar, decreeEffect, decreesAt, decreesSeason, issueDecree, sensibleDecrees } from '../src/sim/decrees';
import { driftOf, driftTown, seasonDrift } from '../src/sim/drift';
import { folkOf } from '../src/sim/township';

const world = (): { c: Campaign; tid: number; other: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  c.factions[0].supplies = 30;
  seat(c, 0, tid);
  return { c, tid, other: c.territories.find((t) => t.owner !== 0)!.id };
};

describe('a decree', () => {
  it('costs supplies, holds for its seasons and is then struck off', () => {
    const { c, tid } = world();
    const before = c.factions[0].supplies;
    expect(issueDecree(c, 0, tid, 'guards')).toBe('');
    expect(c.factions[0].supplies).toBe(before - DECREES.guards.cost);
    expect(decreesAt(c, tid)).toHaveLength(1);
    expect(decreeBar(c, 0, tid, 'guards')).toMatch(/already in force/);
    c.turn += DECREES.guards.seasons;
    decreesSeason(c);
    expect(decreesAt(c, tid)).toHaveLength(0);
  });

  it('is given only to a town of your own, with what it needs there, and what you can pay for', () => {
    const { c, tid, other } = world(), t = c.territories[tid];
    expect(decreeBar(c, 0, other, 'alms')).toMatch(/your own/);
    t.buildings = t.buildings.filter((b) => b !== 'church' && b !== 'tavern');
    expect(decreeBar(c, 0, tid, 'church')).toMatch(/no church/);
    expect(decreeBar(c, 0, tid, 'tavernWomen')).toMatch(/no tavern/);
    c.factions[0].supplies = 0;
    expect(decreeBar(c, 0, tid, 'guards')).toMatch(/costs/);
    // Food is paid in goods, not supplies: the town's own first, then what the towns beside it can spare.
    expect(decreeBar(c, 0, tid, 'alms')).toBe('');
    const s = folkOf(c, tid).stores;
    s.gold = 0; s.wood = 0; s.stone = 0;
    for (const n of c.territories[tid].adj) if (c.territories[n].owner === 0) folkOf(c, n).stores.food = 0;
    expect(decreeBar(c, 0, tid, 'alms')).toMatch(/no food to be had/);
  });

  it('given in person is whole; sent by messenger, the leader being elsewhere, half as strong', () => {
    const { c, tid, other } = world();
    const food = folkOf(c, tid).stores.food;
    issueDecree(c, 0, tid, 'alms');
    expect(folkOf(c, tid).stores.food).toBe(food + ALMS_FOOD);
    c.territories[other].owner = 0;
    seat(c, 0, other); // the leader is in another town of theirs
    c.territories[tid].decrees = [];
    issueDecree(c, 0, tid, 'alms');
    expect(decreesAt(c, tid)[0].strength).toBe(MESSENGER);
    expect(folkOf(c, tid).stores.food).toBe(food + ALMS_FOOD + ALMS_FOOD * MESSENGER);
  });
});

describe('what each decree does to how a town drifts', () => {
  it('guards halve what strains it; the church draws it up; the tavern\'s women bring gold and bring it down', () => {
    const { c, tid, other } = world(), f = folkOf(c, tid), t = c.territories[tid];
    c.territories[other].owner = 0;
    seat(c, 0, other); // away, so that the church has room to draw the town further
    t.buildings = [...t.buildings.filter((b) => b !== 'church' && b !== 'tavern'), 'church', 'tavern'];
    f.stores.food = 0;
    const bare = driftTown(c, tid);
    delete f.drifted; // the same town, with nobody yet gone
    issueDecree(c, 0, tid, 'guards');
    expect(driftTown(c, tid)).toBeGreaterThan(bare);
    c.territories[tid].decrees = [];
    f.stores.food = 5000;
    const quiet = driftTown(c, tid);
    issueDecree(c, 0, tid, 'church');
    expect(driftTown(c, tid)).toBeGreaterThan(quiet);
    c.territories[tid].decrees = [];
    const gold = f.stores.gold;
    issueDecree(c, 0, tid, 'tavernWomen');
    const after = driftTown(c, tid);
    expect(f.stores.gold).toBeGreaterThanOrEqual(gold + TAVERN_WOMEN_GOLD * MESSENGER); // sent by messenger
    expect(after).toBeLessThan(quiet);
  });

  it('closing the tavern stops its pull, and angers a town already given over to decadence', () => {
    const { c, tid } = world();
    c.territories[tid].buildings.push('tavern');
    issueDecree(c, 0, tid, 'closeTavern');
    expect(decreeEffect(c, tid, false)).toMatchObject({ tavernShut: true, strainAdd: 0 });
    expect(decreeEffect(c, tid, true).strainAdd).toBeGreaterThan(0);
  });
});

describe('a sensible ruler', () => {
  it('feeds a hungry town, guards a raided one, and keeps supplies in hand', () => {
    const { c, tid } = world();
    const given = sensibleDecrees(c, 0, () => ({ hungry: true, raided: false, moved: 0, standing: 0 }));
    expect(given).toBeGreaterThan(0);
    expect(decreesAt(c, tid).map((d) => d.kind)).toContain('alms');
    c.factions[0].supplies = 4;
    c.territories[tid].decrees = [];
    // With only the supplies it keeps in hand, it gives nothing that costs supplies; food, paid in goods, still goes.
    expect(sensibleDecrees(c, 0, () => ({ hungry: false, raided: true, moved: -5, standing: 0 }))).toBe(0);
    expect(sensibleDecrees(c, 0, () => ({ hungry: true, raided: true, moved: -5, standing: 0 }))).toBe(1);
    expect(decreesAt(c, tid).map((d) => d.kind)).toEqual(['alms']);
    expect(c.factions[0].supplies).toBe(4);
  });

  it('the computer\'s peoples give their decrees when the season turns', () => {
    const { c } = world();
    for (const t of c.territories) if (t.owner === 1) { folkOf(c, t.id).stores.food = 0; driftTown(c, t.id); }
    c.factions[1].supplies = 30;
    seasonDrift(c);
    expect(c.territories.some((t) => t.owner === 1 && (t.decrees?.length ?? 0) > 0)).toBe(true);
    expect(driftOf(c, c.territories.find((t) => t.owner === 1)!.id)).toHaveProperty('moved');
  });
});
