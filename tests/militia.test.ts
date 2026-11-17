// A town's own men in its defence against a nation, on the map (src/sim/militia.ts; campaign.ts defence, mapbattle.ts forcesOf).
import { describe, expect, it } from 'vitest';
import { defence, newCampaign } from '../src/sim/campaign';
import { agesOf } from '../src/sim/ageing';
import { MILITIA, militiaBands, militiaOf } from '../src/sim/militia';
import { forcesOf } from '../src/sim/mapbattle';
import { bandMen } from '../src/sim/tribes';
import { folkOf } from '../src/sim/township';

/** A rival's town with no army in it and nothing built, and the player's army next door. */
const world = () => {
  const c = newCampaign(11, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  const town = c.territories.find((t) => home.adj.includes(t.id) && !t.horde && t.capital < 0)!;
  town.owner = 1; town.buildings = []; town.trait = '';
  c.armies = c.armies.filter((a) => a.at !== town.id);
  const set = (men: number) => { const f = folkOf(c, town.id); Object.assign(f, { men, women: 10, elders: 0, children: 0 }); delete f.ages; agesOf(c, town.id, f); };
  const army = c.armies.find((a) => a.owner === 0)!;
  return { c, town, set, army };
};

describe('a town\'s own men in its defence', () => {
  it('turn out by bands, each worth half a company, and never more than a wall has room for', () => {
    const { c, town, set } = world();
    set(0);
    expect(militiaBands(c, town.id)).toBe(0);
    expect(militiaOf(c, town.id)).toBe(0);
    set(2 * bandMen());
    expect(militiaBands(c, town.id)).toBe(2);
    expect(militiaOf(c, town.id)).toBe(2 * MILITIA.worth);
    set(100 * bandMen());
    expect(militiaOf(c, town.id)).toBe(MILITIA.most);
  });

  it('a town full of men is harder to take than one whose men are away, and an empty one stands on its ground alone', () => {
    const { c, town, set } = world();
    set(0);
    const bare = defence(c, town.id);
    set(2 * bandMen());
    const manned = defence(c, town.id);
    set(6 * bandMen());
    const full = defence(c, town.id);
    expect(manned).toBeGreaterThan(bare);
    expect(full).toBeGreaterThan(manned);
    expect(full - bare).toBeCloseTo(MILITIA.most * (manned - bare) / (2 * MILITIA.worth), 1); // by the same creed, in proportion
  });

  it('an ordinary town comes to about the one point it was always given', () => {
    const { c, town, set } = world();
    set(2 * bandMen()); // sixteen men at home, in towns of the size they are
    expect(militiaOf(c, town.id)).toBe(1);
  });

  it('a tribe\'s land and the marauders\' are not weighed this way: they have their warriors', () => {
    const { c } = world();
    const tribe = c.territories.find((t) => t.owner < 0 && !t.horde)!;
    expect(militiaBands(c, tribe.id)).toBe(0);
    expect(militiaOf(c, tribe.id)).toBe(0);
  });

  it('in the fight itself, with no army there, they are its companies on foot; with an army they stand behind it', () => {
    const { c, town, set, army } = world();
    set(3 * bandMen());
    const d = defence(c, town.id, army.units);
    const alone = forcesOf(c, army, town.id, 6, d).d;
    expect(alone.units).toEqual({ infantry: 3 });
    expect(alone.own).toBe(militiaOf(c, town.id));
    expect(alone.weight).toBe(d);
    // Too few for a band: the town fights by its works alone.
    set(bandMen() - 1);
    expect(forcesOf(c, army, town.id, 6, defence(c, town.id)).d.units).toEqual({});
    // With an army of its own in the town, the companies are the army's.
    set(3 * bandMen());
    c.armies.push({ id: 900, owner: 1, at: town.id, units: { archers: 2 }, hero: false, vet: 0, moved: false });
    expect(forcesOf(c, army, town.id, 6, defence(c, town.id, army.units)).d.units).toEqual({ archers: 2 });
  });
});
