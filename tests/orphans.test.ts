// Children taken in by the nearest town of their people (src/sim/orphans.ts, docs/DESIGN.md "Children are never shown").
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { agesOf } from '../src/sim/ageing';
import { eatTown } from '../src/sim/larder';
import { nearestTowns, orphansSeason, takeIn } from '../src/sim/orphans';
import { MAX_KIND, folkOf, grown } from '../src/sim/township';

/** The player's capital, a land next to it and one two lands away, all theirs; the near one left with only children. */
function world() {
  for (let seed = 1; ; seed++) {
    const c = newCampaign(seed, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!;
    const near = c.territories.find((t) => t.owner < 0 && home.adj.includes(t.id));
    if (!near) continue;
    // A land further from it than the capital, as the crow flies.
    const d = (t: Territory) => Math.hypot(t.x - near.x, t.y - near.y);
    const far = c.territories.find((t) => t.capital < 0 && t.id !== near.id && d(t) > d(home));
    if (far) return made(c, home, near, far);
  }
}
function made(c: Campaign, home: Territory, near: Territory, far: Territory) {
  for (const t of [near, far]) t.owner = 0;
  const f = folkOf(c, near.id);
  f.men = 0; f.women = 0; f.elders = 0; f.children = 4; delete f.ages;
  const ages = agesOf(c, near.id, f);
  return { c, home, near, far, f, ages: [...ages.k] };
}

describe('children taken in', () => {
  it('a town with nobody grown sends its children, with their ages, to the nearest town of its people', () => {
    const { c, home, near, far, ages } = world();
    expect(nearestTowns(c, 0, near.id)[0]).toBe(home.id); // the nearer, before the one further off
    expect(nearestTowns(c, 0, near.id)).toContain(far.id);
    const k = folkOf(c, home.id), had = k.children, grownThere = grown(k);
    const moved = takeIn(c, near.id);
    expect(moved).toEqual([{ from: near.id, to: home.id, children: 4 }]);
    expect(folkOf(c, near.id).children).toBe(0);
    expect(k.children).toBe(had + 4);
    expect(grown(k)).toBe(grownThere); // they come as children, not grown
    for (const s of ages) expect(k.ages!.k).toContain(s); // each with its own age, to come of age when it would have
  });

  it('a town with anyone grown keeps its children, and a full town sends the rest on to the next nearest', () => {
    const { c, home, near, far, f } = world();
    f.elders = 1;
    expect(takeIn(c, near.id)).toEqual([]);
    f.elders = 0;
    const k = folkOf(c, home.id);
    k.children = MAX_KIND - 1; delete k.ages;
    const moved = takeIn(c, near.id);
    expect(moved[0]).toEqual({ from: near.id, to: home.id, children: 1 });
    expect(moved.reduce((n, x) => n + x.children, 0)).toBe(4);
    expect(moved.some((x) => x.to === far.id)).toBe(true);
    expect(k.children).toBe(MAX_KIND);
  });

  it('a people with no other town: the nearest other people takes its children in, and they grow up as theirs', () => {
    const { c, near, f, ages } = world();
    for (const t of c.territories) if (t.owner === 0 && t.id !== near.id) t.owner = -1;
    const d = (id: number) => Math.hypot(c.territories[id].x - near.x, c.territories[id].y - near.y);
    const nearest = c.territories.filter((t) => t.owner !== 0 && !t.horde).sort((a, b) => d(a.id) - d(b.id) || a.id - b.id)[0];
    const g = folkOf(c, nearest.id), had = g.children;
    const moved = takeIn(c, near.id);
    expect(moved).toEqual([{ from: near.id, to: nearest.id, children: 4, stranger: true }]);
    expect(f.children).toBe(0);
    expect(g.children).toBe(had + 4);
    for (const s of ages) expect(g.ages!.k).toContain(s);
    // Told: the player's last children have gone to another people.
    const c2 = world();
    for (const t of c2.c.territories) if (t.owner === 0 && t.id !== c2.near.id) t.owner = -1;
    orphansSeason(c2.c);
    expect(c2.c.log.join('\n')).toMatch(/the last of your people, have been taken in by .* and will grow up as theirs/);
    // Never to the marauders.
    const c3 = world();
    for (const t of c3.c.territories) { if (t.owner === 0 && t.id !== c3.near.id) t.owner = -1; if (t.id !== c3.near.id) t.horde = t.owner < 0; }
    for (const x of takeIn(c3.c, c3.near.id)) expect(c3.c.territories[x.to].horde).toBeFalsy();
  });

  it('a rival\'s last children may be taken in by the player, and grow up as the player\'s', () => {
    const { c, near, home, f } = world();
    near.owner = 1; // the rival's last town, next to the player's capital
    for (const t of c.territories) if (t.owner === 1 && t.id !== near.id) t.owner = -1;
    for (const t of c.territories) if (t.owner < 0) t.owner = 0; // and nobody else about but the player
    home.owner = 0;
    const g = folkOf(c, home.id), had = g.children;
    orphansSeason(c);
    expect(f.children).toBe(0);
    const total = c.territories.filter((t) => t.owner === 0).reduce((n, t) => n + folkOf(c, t.id).children, 0);
    expect(total).toBeGreaterThanOrEqual(had + 4);
    expect(c.log.join('\n')).toMatch(/will grow up as yours/);
  });

  it('once a season, every such town; the player is told and the chronicle keeps it', () => {
    const { c, near, home } = world();
    const out = orphansSeason(c);
    expect(out.map((x) => x.from)).toContain(near.id);
    expect(c.log.join('\n')).toContain(`The 4 children of ${near.name}, left with nobody grown, have been taken in at ${home.name}.`);
    expect(c.chronicle!.some((x) => x.text.includes(`taken in at ${home.name}`))).toBe(true);
    expect(orphansSeason(c)).toEqual([]); // and nobody is left to move
  });
});
