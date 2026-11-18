// What a town's own men lose in a battle nobody watched follows the fight (src/sim/militiatoll.ts; mapbattle.ts, township.ts tollFolk).
import { describe, expect, it } from 'vitest';
import { defence, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import { agesOf } from '../src/sim/ageing';
import { MILITIA } from '../src/sim/militia';
import { FELL, menStood, militiaFell } from '../src/sim/militiatoll';
import { clash, forcesOf } from '../src/sim/mapbattle';
import type { Outcome } from '../src/sim/mapbattle';
import { bandMen } from '../src/sim/tribes';
import { TOLL, folkOf, tollFolk } from '../src/sim/township';

/** A rival's town with no army in it and nothing built, and the player's army next door. */
const world = (seed = 11) => {
  const c = newCampaign(seed, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  const town = c.territories.find((t) => home.adj.includes(t.id) && !t.horde && t.capital < 0)!;
  town.owner = 1; town.buildings = []; town.trait = '';
  c.armies = c.armies.filter((a) => a.at !== town.id);
  const set = (men: number) => { const f = folkOf(c, town.id); Object.assign(f, { men, women: 10, elders: 0, children: 0 }); delete f.ages; agesOf(c, town.id, f); };
  const army = c.armies.find((a) => a.owner === 0)!;
  return { c, town, set, army };
};
const side = (over: Partial<Outcome['d']> = {}): Outcome['d'] => ({ began: {}, lost: {}, left: {}, share: 0, breakAt: 0.5, works: 0, body: 0, ...over });
const fight = (d: Partial<Outcome['d']>, attackerWon = false): Outcome => ({ attackerWon, broke: attackerWon ? 'defender' : 'attacker', rounds: 3, a: side(), d: side(d) });

describe('the men a town loses in a battle nobody watched', () => {
  it('those in the fight are its bands, as many as the walls have room for', () => {
    const { c, town, set } = world();
    set(0);
    expect(menStood(c, town.id)).toBe(0);
    set(5);
    expect(menStood(c, town.id)).toBe(5);
    set(2 * bandMen());
    expect(menStood(c, town.id)).toBe(2 * bandMen());
    set(20 * bandMen());
    expect(menStood(c, town.id)).toBe((MILITIA.most / MILITIA.worth) * bandMen()); // the rest never came to blows
  });

  it('where they were the town\'s companies, they fall by what the companies lost', () => {
    const { c, town, set } = world();
    set(2 * bandMen());
    expect(militiaFell(c, town.id, fight({ body: 0 }))).toBe(0); // the attack drew off at the first rush
    expect(militiaFell(c, town.id, fight({ body: 0.5 }))).toBe(Math.round(2 * bandMen() * 0.5 * FELL.dead));
    expect(militiaFell(c, town.id, fight({ body: 1 }, true))).toBe(Math.round(2 * bandMen() * FELL.dead));
    expect(militiaFell(c, town.id, fight({ body: 0, works: 1 }))).toBe(0); // walls beaten down are not men, when the men were the companies
  });

  it('behind an army of their own they man the works, and fall as the works are beaten down', () => {
    const { c, town, set, army } = world();
    set(2 * bandMen());
    c.armies.push({ ...army, id: 999, owner: 1, at: town.id, units: { infantry: 2 } });
    expect(militiaFell(c, town.id, fight({ body: 1, works: 0 }, true))).toBe(0); // the army did the dying
    expect(militiaFell(c, town.id, fight({ body: 0, works: 0.5 }))).toBe(Math.round(2 * bandMen() * 0.5 * FELL.dead));
  });

  it('too few for a band, they are on the works too', () => {
    const { c, town, set } = world();
    set(bandMen() - 2);
    expect(militiaFell(c, town.id, fight({ body: 1, works: 0.5 }))).toBe(Math.round((bandMen() - 2) * 0.5 * FELL.dead));
  });

  it('answers nothing for a battle that was not fought out, or for a tribe\'s land', () => {
    const { c, town, set } = world();
    set(2 * bandMen());
    expect(militiaFell(c, town.id, null)).toBeUndefined();
    const tribe = c.territories.find((t) => t.owner < 0 && !t.horde)!;
    expect(militiaFell(c, tribe.id, fight({ body: 1 }))).toBeUndefined();
  });

  it('the fight itself says what share of the companies fell, parts of a company counted, before any scattering', () => {
    const { c, town, set, army } = world();
    set(2 * bandMen());
    const { a, d } = forcesOf(c, army, town.id, 30, defence(c, town.id, army.units));
    const out = clash(a, d);
    expect(out.attackerWon).toBe(true);
    expect(out.d.body).toBeGreaterThan(0.5);
    expect(out.d.body).toBeLessThanOrEqual(1);
    const weak = clash({ ...a, weight: 0.5 }, d);
    expect(weak.attackerWon).toBe(false);
    expect(weak.d.body!).toBeLessThan(out.d.body!);
  });

  it('the toll takes that many men, and the old share only where there is no fight to follow', () => {
    const { c, town, set } = world();
    set(20);
    expect(tollFolk(c, town.id, false, { men: 7 })).toBe(7);
    expect(folkOf(c, town.id).men).toBe(13);
    expect(tollFolk(c, town.id, false, { men: 0 })).toBe(0);
    expect(tollFolk(c, town.id, false)).toBe(Math.ceil(13 * TOLL.held));
    set(3);
    expect(tollFolk(c, town.id, true, { men: 9 })).toBe(3 - TOLL.last); // someone still lives to bury the rest
  });

  it('on the map: a town stormed with nobody watching buries the men its bands lost, not a share by rule', () => {
    const { c, town, set, army } = world();
    set(2 * bandMen());
    army.units = { infantry: 6, archers: 4 }; army.moved = false;
    const got = moveArmy(c, army.id, town.id);
    expect(got).toBe('battle');
    const stood = menStood(c, town.id);
    resolvePending(c, 'auto');
    const dead = 2 * bandMen() - folkOf(c, town.id).men;
    expect(town.owner).toBe(0);
    expect(dead).toBeGreaterThan(Math.ceil(2 * bandMen() * TOLL.taken)); // ridden down as they broke: more than the old three in ten
    expect(dead).toBeLessThanOrEqual(Math.round(stood * FELL.dead));
  });
});
