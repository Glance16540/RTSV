// People moving between towns by road of their own accord (src/sim/migration.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { MIGRATE, migrateOf, migrationSeason, pullOf, pushOf } from '../src/sim/migration';
import { CONVOYS, convoysTurn, onTheRoad } from '../src/sim/convoys';
import { layTown } from '../src/sim/rivalrule';
import { roomOf } from '../src/sim/seasonfolk';
import { folkOf, headcount } from '../src/sim/township';

/** Two towns of the player's side by side: `from` crowded to its roofs, `to` with room and bread. */
function world(): { c: Campaign; from: number; to: number } {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories.find((x) => x.owner < 0 && home.adj.includes(x.id))!;
  next.owner = 0;
  for (const t of [home, next]) { const f = folkOf(c, t.id); f.men = 8; f.women = 8; f.elders = 2; f.children = 6; delete f.ages; delete f.drift; delete f.hungry; delete f.grief; f.stores = { food: 4000, wood: 500, gold: 300, stone: 300 }; delete t.town; layTown(c, t.id); }
  c.events = [];
  // The capital is filled to its roofs; the next town is given room.
  const crowd = folkOf(c, home.id); crowd.children += Math.max(0, roomOf(home) - headcount(crowd));
  next.town!.b.push(['house', 60, 60], ['house', 64, 60], ['house', 68, 60]);
  return { c, from: home.id, to: next.id };
}
/** Season after season, until a family sets out (it goes by chance). */
function untilOneGoes(c: Campaign): ReturnType<typeof migrateOf> {
  for (let s = 0; s < 40; s++) { c.turn++; const m = migrateOf(c, 0); if (m.length) return m; }
  return [];
}

describe('families moving of their own accord', () => {
  it('a crowded town pushes, a town with room and bread draws', () => {
    const { c, from, to } = world();
    expect(pushOf(c, from)).toBe('crowded');
    expect(pushOf(c, to)).toBeNull();
    expect(pullOf(c, to)).toBeGreaterThanOrEqual(MIGRATE.room);
    expect(pullOf(c, from)).toBe(0);
    folkOf(c, to).hungry = 1;
    expect(pushOf(c, to)).toBe('hungry');
    expect(pullOf(c, to)).toBe(0); // a hungry town draws nobody
  });

  it('a family goes by road, a season on the way, and is of the new town from then on', () => {
    const { c, from, to } = world();
    const had = { from: headcount(folkOf(c, from)), to: headcount(folkOf(c, to)) };
    const moves = untilOneGoes(c);
    expect(moves).toEqual([expect.objectContaining({ from, to, why: 'crowded' })]);
    const n = moves[0].people;
    expect(n).toBe(2 + MIGRATE.children);
    expect(headcount(folkOf(c, from))).toBe(had.from - n);
    expect(onTheRoad(c, 0).filter((x) => x.movers)).toHaveLength(1);
    c.turn++;
    convoysTurn(c);
    expect(headcount(folkOf(c, to))).toBe(had.to + n);
    expect(folkOf(c, to).ages!.k.length).toBe(folkOf(c, to).children); // the children's ages came with them
  });

  it('never leaves a town under MIGRATE.keep grown people, and is not one of the people\'s convoys', () => {
    const { c, from } = world();
    const f = folkOf(c, from);
    f.men = 4; f.women = 4; f.elders = 0; delete f.ages;
    for (let s = 0; s < 40; s++) { c.turn++; migrateOf(c, 0); }
    expect(onTheRoad(c, 0).filter((x) => x.movers)).toHaveLength(0);
    // A family on the road does not take the place of a convoy the ruler orders.
    const w = world();
    untilOneGoes(w.c);
    expect(onTheRoad(w.c, 0).filter((x) => !x.movers).length).toBeLessThan(CONVOYS.most);
  });

  it('rivals\' towns live by the same rule, and the player is told in a line', () => {
    const { c, from, to } = world();
    for (const id of [from, to]) c.territories[id].owner = 1;
    expect(untilOneGoes(c)).toEqual([]);
    let moved: ReturnType<typeof migrationSeason> = [];
    for (let s = 0; s < 40 && !moved.length; s++) { c.turn++; moved = migrationSeason(c); }
    expect(moved[0]).toMatchObject({ owner: 1, from, to });
    expect(c.log.some((l) => l.includes('set out by road'))).toBe(false); // a rival's families are not told of
    const w = world();
    let mine: ReturnType<typeof migrationSeason> = [];
    for (let s = 0; s < 40 && !mine.length; s++) { w.c.turn++; mine = migrationSeason(w.c); }
    expect(w.c.log.filter((l) => l.includes('set out by road'))).toHaveLength(1);
  });
});
