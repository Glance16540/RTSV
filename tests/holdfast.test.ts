// A people about to rule beyond challenge holds what it has (src/sim/holdfast.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, newCampaign, playForPlayer } from '../src/sim/campaign';
import { reach } from '../src/sim/campaignbase';
import { holdStep, holding, restless, riseBare } from '../src/sim/holdfast';

/** The player holding a line of three lands out from the capital, its army in the capital, the furthest lately taken and resentful. */
function world(): { c: Campaign; home: number; mid: number; far: number } {
  for (let seed = 1; seed < 40; seed++) {
    const c = newCampaign(seed, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!;
    const free = (n: number) => c.territories[n].owner !== 0 && c.territories[n].capital < 0 && !c.territories[n].horde;
    for (const m of reach(c, home.id).filter(free)) {
      const f = reach(c, m).find((n) => n !== home.id && free(n) && !reach(c, home.id).includes(n));
      if (f === undefined) continue;
      const mid = c.territories[m], far = c.territories[f];
      for (const t of [mid, far]) t.owner = 0;
      c.armies = c.armies.filter((a) => (a.owner === 0 ? a.at === home.id : a.at !== mid.id && a.at !== far.id));
      far.yoke = { from: -1, since: c.turn, resent: 95 };
      return { c, home: home.id, mid: mid.id, far: far.id };
    }
  }
  throw new Error('no world with three lands in a line');
}

describe('is its count running', () => {
  it('only for the people whose count it is, and not when the campaign is over', () => {
    const { c } = world();
    expect(holding(c, 0)).toBe(false);
    c.dominion = { f: 0, turns: 3 };
    expect(holding(c, 0)).toBe(true);
    expect(holding(c, 1)).toBe(false);
    c.dominion = { f: 0, turns: 0 };
    expect(holding(c, 0)).toBe(false);
    c.dominion = { f: 0, turns: 3 }; c.phase = 'over';
    expect(holding(c, 0)).toBe(false);
  });
});

describe('where its armies stand', () => {
  it('the towns that might rise with no army in them, the likeliest first', () => {
    const { c, mid, far } = world();
    expect(riseBare(c, far)).toBeGreaterThan(0);
    expect(restless(c, 0)).toEqual([far]);
    c.territories[mid].yoke = { from: -1, since: c.turn, resent: 70 };
    expect(restless(c, 0)).toEqual([far, mid]);
    c.armies.push({ id: 77, owner: 0, at: far, units: { infantry: 1 }, hero: false, vet: 0, moved: false } as never);
    expect(restless(c, 0)).toEqual([mid]); // garrisoned: it is held
  });

  it('an army in a quiet town goes by its own lands towards the nearest that might rise', () => {
    const { c, home, mid, far } = world();
    const a = armyAt(c, home)!;
    expect(holdStep(c, 0, a)).toBe(mid); // the first step of two
    a.at = mid;
    expect(holdStep(c, 0, a)).toBe(far);
    a.at = far;
    expect(holdStep(c, 0, a)).toBe(-1); // it stands: the town would rise without it
  });

  it('with nowhere it is wanted, or no way there by its own lands, it stands where it is', () => {
    const { c, home, mid, far } = world();
    const a = armyAt(c, home)!;
    c.territories[mid].owner = 1; // the road is another people's
    expect(holdStep(c, 0, a)).toBe(-1);
    c.territories[mid].owner = 0; delete c.territories[far].yoke;
    expect(restless(c, 0)).toEqual([]);
    expect(holdStep(c, 0, a)).toBe(-1);
  });
});

describe('a people whose count is running', () => {
  it('takes no new land: its army goes to the town that might rise, and no battle is begun', () => {
    const { c, home, mid } = world();
    c.dominion = { f: 0, turns: 4 };
    const lands = c.territories.filter((t) => t.owner === 0).length;
    playForPlayer(c);
    expect(c.pending).toBeNull();
    expect(c.territories.filter((t) => t.owner === 0).length).toBe(lands);
    expect(armyAt(c, mid)?.owner).toBe(0);
    expect(armyAt(c, home)?.owner).not.toBe(0);
  });

  it('the same people with no count running marches as it always did', () => {
    const { c } = world();
    const a = c.armies.find((x) => x.owner === 0)!;
    a.units = { infantry: 9 }; // strong enough to dare a neighbour
    c.dominion = { f: -1, turns: 0 };
    const before = c.territories.filter((t) => t.owner === 0).length;
    playForPlayer(c);
    const took = c.territories.filter((t) => t.owner === 0).length > before, fights = !!c.pending;
    expect(took || fights).toBe(true);
  });
});
