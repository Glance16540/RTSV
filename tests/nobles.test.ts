// Nobles (docs/DESIGN.md, "Relationships"; src/sim/nobles.ts): who is noble, their say in decrees, and what an angry
// noble does to their town.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { NOBLES, angryAt, heardDecree, newLord, noblesAt, noblesOf, noblesSeason, nobleWork, sayOn, titleOf } from '../src/sim/nobles';
import type { Noble } from '../src/sim/nobles';
import { issueDecree } from '../src/sim/decrees';
import { driftTown, watchOf } from '../src/sim/drift';
import { folkOf } from '../src/sim/township';
import { kinOf } from '../src/sim/kin';
import { seat } from '../src/sim/court';

const world = (): { c: Campaign; tid: number; other: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id;
  const other = c.territories.find((t) => t.owner === -1 || (t.owner !== 0 && t.id !== tid))!.id;
  c.factions[0].supplies = 200;
  return { c, tid, other };
};
const big = (c: Campaign, tid: number, n = 14): void => { const f = folkOf(c, tid); f.men = Math.ceil(n / 2); f.women = Math.floor(n / 2); f.elders = 0; delete f.ages; };
const lordOf = (c: Campaign, tid: number): Noble => noblesAt(c, tid).find((n) => n.rank === 'lord')!;
const fresh = (c: Campaign): void => { delete c.factions[0].nobles; noblesSeason(c, 0); };

describe('who is noble', () => {
  it('a town of a size has a lord; its famous veteran is a captain and its famous mother a matron; the inner circle are nobles too', () => {
    const { c, tid } = world(), f = folkOf(c, tid);
    big(c, tid, NOBLES.lordAt - 2);
    f.notables = [
      { name: 'Wulf', gender: 'm', kind: 'veteran', deed: 'felled ten', turn: 0, kills: 10 },
      { name: 'Osric', gender: 'm', kind: 'veteran', deed: 'felled two', turn: 0, kills: 2 },
      { name: 'Hild', gender: 'f', kind: 'mother', deed: 'raised five', turn: 0, kids: 5 },
    ];
    fresh(c);
    expect(noblesAt(c, tid).some((n) => n.rank === 'lord')).toBe(false);
    expect(noblesAt(c, tid).find((n) => n.rank === 'captain')?.name).toBe('Wulf'); // the most famous of them
    expect(noblesAt(c, tid).find((n) => n.rank === 'matron')?.name).toBe('Hild');
    big(c, tid, NOBLES.lordAt + 2);
    noblesSeason(c, 0);
    const lord = lordOf(c, tid);
    expect(lord).toBeTruthy();
    expect(titleOf(c, lord)).toMatch(new RegExp(`^(Lord|Lady) ${lord.name} of ${c.territories[tid].name}$`));
    const circle = kinOf(c, 0).circle;
    expect(circle.length).toBeGreaterThan(0);
    for (const x of circle) expect(noblesOf(c, 0).some((n) => n.rank === 'close' && n.name === x.name && n.post === x.post)).toBe(true);
    // The priest of the circle is pious, the marshal martial.
    for (const n of noblesOf(c, 0)) if (n.post === 'priest') expect(n.leaning).toBe('pious');
    for (const n of noblesOf(c, 0)) if (n.post === 'marshal') expect(n.leaning).toBe('martial');
  });

  it('the same noble keeps their mood from season to season, and it eases back toward nothing', () => {
    const { c, tid } = world();
    big(c, tid);
    fresh(c);
    const lord = lordOf(c, tid);
    lord.mood = -60;
    noblesSeason(c, 0);
    const again = lordOf(c, tid);
    expect(again.key).toBe(lord.key);
    expect(again.mood).toBeGreaterThan(-60);
    expect(again.mood).toBeLessThan(0);
  });
});

describe('nobles have a say in decrees', () => {
  it('a decree pleases some and angers others by their leaning, most in their own town', () => {
    const { c, tid } = world();
    big(c, tid);
    fresh(c);
    seat(c, 0, tid); // given in person: at full strength
    const lord = lordOf(c, tid);
    lord.leaning = 'pious'; lord.mood = 0;
    const far = noblesOf(c, 0).find((n) => n.town !== tid);
    if (far) { far.leaning = 'pious'; far.mood = 0; }
    c.territories[tid].buildings = [...c.territories[tid].buildings.filter((b) => b !== 'tavern'), 'tavern'];
    const say = sayOn(c, 0, tid, 'tavernWomen');
    expect(say.angered).toContain(lord);
    expect(sayOn(c, 0, tid, 'closeTavern').pleased).toContain(lord);
    expect(issueDecree(c, 0, tid, 'tavernWomen')).toBe('');
    expect(lord.mood).toBe(-NOBLES.sway);
    if (far) { expect(far.mood).toBeLessThan(0); expect(far.mood).toBeGreaterThan(lord.mood); }
    // A worldly lord takes the same decree the other way.
    lord.leaning = 'worldly'; lord.mood = 0;
    heardDecree(c, 0, tid, 'tavernWomen', 1);
    expect(lord.mood).toBe(NOBLES.sway);
  });

  it('a decree that angers one of the inner circle costs their loyalty, and one that pleases them gains it', () => {
    const { c, tid } = world();
    fresh(c);
    const k = kinOf(c, 0), x = k.circle[0], n = noblesOf(c, 0).find((m) => m.rank === 'close' && m.name === x.name)!;
    n.leaning = 'pious';
    const was = x.loyalty;
    heardDecree(c, 0, x.town, 'tavernWomen', 1);
    expect(x.loyalty).toBeLessThan(was);
    const low = x.loyalty;
    heardDecree(c, 0, x.town, 'church', 1);
    expect(x.loyalty).toBeGreaterThan(low);
  });
});

describe('an angry noble tells on their town', () => {
  it('slacker work, readier drift, and a thinner watch while the leader is away', () => {
    const { c, tid, other } = world();
    big(c, tid);
    fresh(c);
    const f = folkOf(c, tid);
    f.stores.food = 5000; delete f.hungry;
    c.factions[0].heroAlive = true; // a living leader, who can be away or here (court.ts)
    c.territories[other].owner = 0; // a second land of theirs to be away in
    seat(c, 0, other);
    driftTown(c, tid);
    const calm = { strain: f.drift!.strain, watch: watchOf(c, tid) };
    expect(nobleWork(c, tid)).toBe(1);
    lordOf(c, tid).mood = -80;
    expect(angryAt(c, tid)).toBe(true);
    expect(nobleWork(c, tid)).toBe(1 - NOBLES.slack);
    driftTown(c, tid);
    expect(f.drift!.strain).toBeGreaterThan(calm.strain);
    expect(watchOf(c, tid)).toBeLessThan(calm.watch);
    // With the leader there to see it, the watch is kept.
    seat(c, 0, tid);
    expect(watchOf(c, tid)).toBe(calm.watch);
  });

  it('a town raided or hungry sours its nobles, season by season', () => {
    const { c, tid } = world();
    big(c, tid);
    fresh(c);
    folkOf(c, tid).hungry = 2;
    for (let s = 0; s < 3; s++) { c.turn++; noblesSeason(c, 0); }
    expect(lordOf(c, tid).mood).toBeLessThan(0);
  });

  it('rivals have nobles of their own', () => {
    const { c } = world();
    for (const x of c.factions) if (x.alive) noblesSeason(c, x.id);
    expect(c.factions.filter((x) => x.alive && x.id !== 0).every((x) => (x.nobles ?? []).length > 0)).toBe(true);
  });
});

describe('a town whose lord is gone has a new one', () => {
  it('of another name, with no grudge, kept from season to season; the lord before is not brought back', () => {
    const { c, tid } = world();
    big(c, tid);
    fresh(c);
    const old = lordOf(c, tid);
    old.mood = -90;
    const next = newLord(c, 0, tid)!;
    expect(next).toBeTruthy();
    expect(next.name).not.toBe(old.name);
    expect(next.key).not.toBe(old.key);
    expect(next.mood).toBe(0);
    expect(noblesAt(c, tid).filter((n) => n.rank === 'lord')).toHaveLength(1);
    next.mood = 30;
    noblesSeason(c, 0);
    expect(lordOf(c, tid).name).toBe(next.name);
    expect(lordOf(c, tid).mood).toBeGreaterThan(0);
    // And another after that.
    const third = newLord(c, 0, tid)!;
    expect(third.name).not.toBe(next.name);
  });
});
