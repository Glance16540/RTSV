// Acts of God, births and a town's defence read the town's own standing, not its nation's (townfaith.ts).
import { describe, expect, it } from 'vitest';
import { defence, newCampaign } from '../src/sim/campaign';
import { wrathAt, wrathOf } from '../src/sim/acts';
import { defenceOf } from '../src/sim/threats';
import { creedOf } from '../src/sim/creed';
import { seasonTown } from '../src/sim/seasonfolk';
import { folkOf } from '../src/sim/township';

/** A nation of plain standing with one holy town and one decadent town. */
function world() {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.factions[0].virtue = 0;
  const home = c.territories.find((t) => t.capital === 0)!;
  const [a, b] = c.territories.filter((t) => t.owner < 0 && t.capital < 0).slice(0, 2);
  a.owner = 0; b.owner = 0;
  home.virtue = 0; a.virtue = 100; b.virtue = -100;
  c.armies = c.armies.filter((x) => x.owner !== 0);
  return { c, home, a, b };
}

describe('faith is a town\'s: what reads it', () => {
  it('acts of God fall on a town by its own standing: a third as hard on a holy town of a plain nation', () => {
    const { c, home, a, b } = world();
    expect(wrathOf(c, 0)).toBe(creedOf(0).plague); // the nation stands in the middle
    expect(wrathAt(c, home.id)).toBe(creedOf(0).plague);
    expect(wrathAt(c, a.id)).toBeCloseTo(1 / 3, 5);
    expect(wrathAt(c, b.id)).toBeGreaterThan(1);
    expect(wrathAt(c, c.territories.find((t) => t.owner < 0)!.id)).toBe(1); // the tribes
  });

  it('a town defends itself in its own spirit, against a band and on the map', () => {
    const { c, a, b } = world();
    for (const t of [a, b]) { const f = folkOf(c, t.id); f.men = 6; delete f.ages; t.buildings = []; }
    expect(defenceOf(c, a.id).spirit).toBe(Math.round(creedOf(100).morale * 10) / 10);
    expect(defenceOf(c, b.id).spirit).toBe(Math.round(creedOf(-100).morale * 10) / 10);
    expect(defence(c, a.id)).not.toBe(defence(c, b.id));
  });

  it('a town bears children by its own standing', () => {
    const { c, a, b } = world();
    for (const t of [a, b]) { const f = folkOf(c, t.id); f.men = 6; f.women = 6; f.children = 0; f.due = 0; f.stores.food = 5000; delete f.ages; delete t.town; }
    seasonTown(c, a.id); seasonTown(c, b.id);
    const due = (id: number) => (folkOf(c, id).due ?? 0) + folkOf(c, id).children;
    expect(creedOf(100).birth).not.toBe(creedOf(-100).birth);
    expect(Math.sign(due(a.id) - due(b.id))).toBe(Math.sign(creedOf(100).birth - creedOf(-100).birth));
  });
});
