// A tribe's town buries the men its bands lost in the fight, as a nation's town does (src/sim/militiatoll.ts tribeFell).
import { describe, expect, it } from 'vitest';
import { moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { FELL, militiaFell, tribeFell } from '../src/sim/militiatoll';
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
