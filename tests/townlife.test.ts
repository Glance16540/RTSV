// A town's own life moves its faith (src/sim/townlife.ts, called from townfaith.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { LIFE, lifeDrift, lifeSeason } from '../src/sim/townlife';
import { faithAt, seasonOfFaith, shiftVirtue, townDrift } from '../src/sim/townfaith';
import { needOf } from '../src/sim/larder';
import { folkOf } from '../src/sim/township';

/** The player's capital and a second town, nothing standing in either that moves faith, and no unrest to come. */
function realm(): { c: Campaign; a: number; b: number } {
  const c = newCampaign(7, 1, 0, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories.find((t) => t.owner < 0 && !t.wild && home.adj.includes(t.id))!;
  next.owner = 0;
  for (const t of [home, next]) { t.buildings = []; const f = folkOf(c, t.id); delete f.hungry; f.stores.food = Math.ceil(LIFE.full * needOf(c, t.id)) + 10; }
  c.places = []; c.events = []; c.truces = [{ with: 1, until: 999 }];
  return { c, a: home.id, b: next.id };
}
const season = (c: Campaign): void => { c.turn++; seasonOfFaith(c, (f, by, at) => shiftVirtue(c, f, by, { at })); };

describe('a town\'s own life moves its faith', () => {
  it('a hungry town, or one with plague in it, slides toward decadence', () => {
    const { c, a, b } = realm();
    folkOf(c, a).hungry = 1;
    (c.events ??= []).push({ kind: 'plague', at: b, turn: c.turn, until: c.turn + 2 });
    expect(lifeDrift(c, a)).toBe(-LIFE.hunger);
    expect(lifeDrift(c, b)).toBe(-LIFE.plague);
    expect(townDrift(c, a)).toBe(-LIFE.hunger); // nothing else moves it
    const was = { a: faithAt(c, a), b: faithAt(c, b) };
    season(c);
    expect(faithAt(c, a)).toBeLessThan(was.a);
  });

  it('a long peace with full stores draws a town toward piety; trouble begins the count again, and bare stores do not count', () => {
    const { c, a, b } = realm();
    for (let s = 0; s < LIFE.calm - 1; s++) { c.turn++; lifeSeason(c); }
    expect(lifeDrift(c, a)).toBe(0); // not long enough yet
    c.turn++; lifeSeason(c);
    expect(c.territories[a].calm).toBe(LIFE.calm);
    expect(lifeDrift(c, a)).toBe(LIFE.peace);
    folkOf(c, b).stores.food = 0;
    expect(lifeDrift(c, b)).toBe(0); // at peace, but its stores are bare
    // A raid breaks the peace, and the count begins again.
    (c.events ??= []).push({ kind: 'raid', at: a, turn: c.turn, until: c.turn });
    c.turn++; lifeSeason(c);
    expect(c.territories[a].calm).toBe(0);
    expect(lifeDrift(c, a)).toBe(0);
  });

  it('one town of a nation stands apart from the rest by what it has lived through', () => {
    const { c, a, b } = realm();
    folkOf(c, b).hungry = 1;
    for (let s = 0; s < 24; s++) { folkOf(c, b).hungry = 1; season(c); }
    expect(faithAt(c, a) - faithAt(c, b)).toBeGreaterThanOrEqual(5);
  });

  it('its life alone never carries a town into the Decadent or the Righteous creed', () => {
    const { c, a } = realm();
    const t = c.territories[a];
    folkOf(c, a).hungry = 1;
    t.virtue = LIFE.floor; expect(lifeDrift(c, a)).toBe(0);
    t.virtue = LIFE.floor + 1; expect(lifeDrift(c, a)).toBe(-1);
    delete folkOf(c, a).hungry;
    t.calm = LIFE.calm;
    t.virtue = LIFE.ceiling; expect(lifeDrift(c, a)).toBe(0);
    t.virtue = 0; expect(lifeDrift(c, a)).toBe(LIFE.peace);
  });
});
