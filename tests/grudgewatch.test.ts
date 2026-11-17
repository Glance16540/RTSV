// A taken town's old people watch grudgingly (src/sim/threats.ts THREATS.grudge, over src/sim/oldfolk.ts's count).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { oldWeight } from '../src/sim/oldfolk';
import { defenceOf } from '../src/sim/threats';
import { THREATS } from '../src/sim/threatsbase';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';

describe('a taken town against a band', () => {
  it('its men count for less on the walls by the weight of its old people\'s resentment, and as before once that is gone', () => {
    const c = newCampaign(11, 2);
    c.armies = []; c.bands = []; c.events = [];
    const t = c.territories.find((x) => x.owner === 0 && x.capital < 0) ?? c.territories.find((x) => x.owner === 0)!;
    delete t.yoke; delete t.oldFolk; t.buildings = [];
    Object.assign(folkOf(c, t.id), { men: 10 * S, women: 10 * S, elders: 0, children: 0 });
    delete folkOf(c, t.id).ages;
    const free = defenceOf(c, t.id).men;
    expect(free).toBeGreaterThan(0);
    expect(oldWeight(c, t.id)).toBe(0);
    // Taken from another people a moment ago: everyone in it is theirs, and resents it wholly.
    t.yoke = { from: 1, since: c.turn, resent: 100 };
    t.oldFolk = { from: 1, n: 20 * S };
    expect(oldWeight(c, t.id)).toBe(1);
    expect(Math.abs(defenceOf(c, t.id).men - free * (1 - THREATS.grudge))).toBeLessThan(0.06); // told to a tenth
    // Half of them the holder's now, and half as resentful: a quarter of the weight.
    t.oldFolk.n = 10 * S; t.yoke.resent = 50;
    expect(oldWeight(c, t.id)).toBeCloseTo(0.25);
    expect(Math.abs(defenceOf(c, t.id).men - free * (1 - THREATS.grudge * 0.25))).toBeLessThan(0.06);
    // Settled: nothing is held against its holder.
    t.yoke.resent = 0; t.yoke.settled = true;
    expect(defenceOf(c, t.id).men).toBeCloseTo(free);
  });
});
