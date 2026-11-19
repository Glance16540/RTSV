// A tribe's town buries the men its bands lost in the fight, as a nation's town does (src/sim/militiatoll.ts tribeFell).
import { describe, expect, it } from 'vitest';
import { moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { FELL, militiaFell, openToll, tribeFell } from '../src/sim/militiatoll';
import type { Outcome } from '../src/sim/mapbattle';
import { bandMen, setTribe, warriorsOf } from '../src/sim/tribes';
import { TOLL, folkOf } from '../src/sim/township';

function world(seed = 11): { c: Campaign; home: Territory; tribe: Territory } {
  const c = newCampaign(seed, 2);
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const tribe = c.territories[home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde && !c.territories[n].wild)!];
  tribe.buildings = []; tribe.trait = '';
  return { c, home, tribe };
}
const side = (over: Partial<Outcome['d']> = {}): Outcome['d'] => ({ began: {}, lost: {}, left: {}, share: 0, breakAt: 0.5, works: 0, body: 0, ...over });
const fight = (body: number, attackerWon = false): Outcome => ({ attackerWon, broke: attackerWon ? 'defender' : 'attacker', rounds: 3, a: side(), d: side({ body }) });

describe('the men a tribe\'s town loses in a battle nobody watched', () => {
  it('are those its bands stood for, by the share of their strength lost, half of a band lost being dead', () => {
    const { c, tribe } = world();
    setTribe(c, tribe.id, 3);
    const stood = warriorsOf(c, tribe.id) * bandMen();
    expect(stood).toBe(3 * bandMen());
    expect(tribeFell(c, tribe.id, fight(0))).toBe(0); // drove them off at the first rush
    expect(tribeFell(c, tribe.id, fight(0.4))).toBe(Math.round(stood * 0.4 * FELL.dead));
    expect(tribeFell(c, tribe.id, fight(1, true))).toBe(Math.round(stood * FELL.dead)); // ridden down
    expect(tribeFell(c, tribe.id, fight(7))).toBe(Math.round(stood * FELL.dead)); // never more than all of them
    expect(militiaFell(c, tribe.id, fight(0.4))).toBe(tribeFell(c, tribe.id, fight(0.4)));
    // Never more men than the town has, however many bands it is reckoned at.
    folkOf(c, tribe.id).men = 5;
    expect(tribeFell(c, tribe.id, fight(1, true))).toBeLessThanOrEqual(Math.round(5 * FELL.dead));
  });

  it('settled on the map, a tribe\'s town taken buries by the fight and not by the old share, and its women and children are untouched by it', () => {
    let fought = 0, differs = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { c, home, tribe } = world(seed);
      setTribe(c, tribe.id, 2);
      const f = folkOf(c, tribe.id), men = f.men, women = f.women, children = f.children;
      c.armies = c.armies.filter((a) => a.owner !== 0);
      c.armies.push({ id: 801, owner: 0, at: home.id, units: { infantry: 10 }, hero: false, vet: 0, moved: false });
      if (moveArmy(c, 801, tribe.id) !== 'battle') continue;
      c.pending!.mode = 'siege';
      resolvePending(c, 'auto');
      if (c.territories[tribe.id].owner !== 0) continue;
      fought++;
      const lost = men - folkOf(c, tribe.id).men;
      expect(lost).toBeGreaterThanOrEqual(0);
      expect(lost).toBeLessThanOrEqual(Math.round(men * FELL.dead) + 1); // half of those who stood at the most, where the old rule took three in ten whatever the fight
      if (lost !== Math.ceil(men * TOLL.taken)) differs++;
      expect(folkOf(c, tribe.id).women).toBeLessThanOrEqual(women);
      expect(folkOf(c, tribe.id).children).toBeLessThanOrEqual(children); // none dies of the battle: those who leave are led away or walk (carriedoff.ts, migration.ts)
    }
    expect(fought).toBeGreaterThan(5);
    expect(differs).toBeGreaterThan(0);
  });
});

describe('a tribe that beats an attack off (the double count)', () => {
  it('loses the men its bands lost in the fight, and no bands by a share of the attacker\'s strength besides', async () => {
    const { tollByFight } = await import('../src/sim/tribes');
    let held = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { c, home, tribe } = world(seed);
      setTribe(c, tribe.id, 6);
      const f = folkOf(c, tribe.id), men = f.men;
      c.armies = c.armies.filter((a) => a.owner !== 0);
      c.armies.push({ id: 801, owner: 0, at: home.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
      if (moveArmy(c, 801, tribe.id) !== 'battle') continue;
      c.pending!.mode = 'siege';
      const aStr = c.pending!.aStr;
      resolvePending(c, 'auto');
      if (c.territories[tribe.id].owner >= 0) continue;
      held++;
      const lost = men - folkOf(c, tribe.id).men;
      // By the fight alone: never more than half of those who stood (it held, so far fewer), and less than the old two rules
      // together would have taken (fifteen in a hundred of its men, and three tenths of the attacker's strength in bands).
      expect(lost).toBeLessThanOrEqual(Math.round(men * FELL.dead));
      const old = Math.ceil(men * TOLL.held) + Math.floor(aStr * 0.3) * bandMen();
      expect(lost).toBeLessThanOrEqual(old);
    }
    expect(held).toBeGreaterThan(5);
    const p = { to: 0, mode: 'siege' } as never, c0 = newCampaign(3, 2);
    c0.territories[0].horde = false;
    expect(tollByFight(c0, p, { how: 'auto', fought: {} })).toBe(true);
    expect(tollByFight(c0, p, { how: 'attacker', fought: {} })).toBe(false); // fought in person: the census says who fell
    expect(tollByFight(c0, p, { how: 'auto' })).toBe(false); // summed, not fought
    c0.territories[0].owner = 1; // a nation's land met in the open: its army's companies are counted with the army
    expect(tollByFight(c0, { to: 0, mode: 'field' } as never, { how: 'auto', fought: {} })).toBe(false);
    c0.territories[0].owner = -1; // a tribe's, met in the open: by the fight (openToll)
    expect(tollByFight(c0, { to: 0, mode: 'field' } as never, { how: 'auto', fought: {} })).toBe(true);
    c0.territories[0].horde = true;
    expect(tollByFight(c0, p, { how: 'auto', fought: {} })).toBe(false); // the marauders' land
  });
});

describe('a tribe met in the open, with nobody watching', () => {
  it('buries the men its bands lost in that fight, its stores are not looted for it, and a nation\'s land answers nothing', () => {
    const { c, home, tribe } = world();
    expect(openToll(c, home.id, fight(1, true))).toBeUndefined();
    expect(openToll(c, tribe.id, null)).toBeUndefined();
    setTribe(c, tribe.id, 3);
    expect(openToll(c, tribe.id, fight(0.5))).toBe(tribeFell(c, tribe.id, fight(0.5)));
    let fought = 0, buried = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const w = world(seed);
      setTribe(w.c, w.tribe.id, 3);
      const f = folkOf(w.c, w.tribe.id), men = f.men, women = f.women, children = f.children;
      f.stores = { food: 500, wood: 500, gold: 500, stone: 500 };
      w.c.armies = w.c.armies.filter((a) => a.owner !== 0);
      w.c.armies.push({ id: 801, owner: 0, at: w.home.id, units: { infantry: 8 }, hero: false, vet: 0, moved: false });
      if (moveArmy(w.c, 801, w.tribe.id) !== 'battle') continue;
      w.c.pending!.mode = 'field';
      resolvePending(w.c, 'auto');
      fought++;
      const after = folkOf(w.c, w.tribe.id), lost = men - after.men;
      expect(lost).toBeGreaterThanOrEqual(0);
      expect(lost).toBeLessThanOrEqual(Math.round(men * FELL.dead) + 1);
      if (lost > 0) buried++;
      expect(after.women).toBeLessThanOrEqual(women);
      expect(after.children).toBeLessThanOrEqual(children);
      if (w.c.territories[w.tribe.id].owner < 0) expect(after.stores.gold).toBe(500); // it held: nothing is taken from it
    }
    expect(fought).toBeGreaterThan(10);
    expect(buried).toBeGreaterThan(5); // before, a tribe met in the open and left to the armies buried nobody unless it won
  });
});
