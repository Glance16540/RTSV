// People moving between towns by road of their own accord (src/sim/migration.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { MIGRATE, migrateOf, migrationSeason, movesReport, pullOf, pushOf, settle, settleBar } from '../src/sim/migration';
import { reportLines, reportSince, snapshot } from '../src/sim/seasonreport';
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

describe('a family met on the road', () => {
  it('a band on its road carries off grown people, never a child, and holds them as captives', () => {
    let taken = 0, kids = 0, sent = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { c, from, to } = world();
      c.seed = seed;
      untilOneGoes(c);
      const x = onTheRoad(c, 0).find((y) => y.movers)!;
      sent += x.cargo.children!.length;
      (c.bands ??= []).push({ id: 50, kind: 'highwaymen', name: 'the Men of the Pass', at: from, to, strength: 9, since: c.turn, held: [] });
      c.turn++;
      const [a] = convoysTurn(c);
      kids += a.convoy.cargo.children!.length;
      const held = c.bands!.find((b) => b.id === 50)!.held;
      if (a.taken) { taken += a.taken; expect(held[0]).toMatchObject({ from, owner: 0 }); expect(held[0].men.length + held[0].women.length).toBe(a.taken); }
    }
    expect(taken).toBeGreaterThan(0);
    expect(kids).toBe(sent); // every child went on
  });
});

describe('known people move by name', () => {
  it('a known woman goes with her household by name, is set down on the new town\'s roll, and the season\'s report says so in a line', () => {
    let named = 0;
    for (let seed = 1; seed <= 30 && !named; seed++) {
      const { c, from, to } = world();
      c.seed = seed;
      folkOf(c, from).notables = [{ name: 'Elin', family: 'Barrow', gender: 'f', kind: 'mother', deed: 'raised four children', turn: 1, kids: 4 }];
      const s = snapshot(c);
      const moves = untilOneGoes(c);
      if (!moves[0]?.name) continue;
      named++;
      expect(moves[0].name).toBe('Elin Barrow');
      expect(folkOf(c, from).notables).toHaveLength(0); // struck from the town she left
      c.turn++;
      convoysTurn(c);
      expect(folkOf(c, to).notables.map((n) => n.name)).toContain('Elin');
      const lines = movesReport(c, 0, s.turn);
      expect(lines[0]).toContain('Elin Barrow and her household left');
      expect(reportLines(reportSince(c, s)).map((l) => l.text)).toContain(lines[0]);
    }
    expect(named).toBe(1);
  });

  it('many families are counted in one line, not listed', () => {
    const { c, from, to } = world();
    for (let i = 0; i < 6; i++) (c.moves ??= []).push({ owner: 0, from, to, why: 'crowded', people: 4, turn: c.turn });
    const lines = movesReport(c, 0, c.turn - 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^6 families moved between your towns/);
  });
});

describe('the player settles a town from another', () => {
  it('two families go to a town with room, and a town that cannot spare them, or one with no room, is refused', () => {
    const { c, from, to } = world();
    expect(settleBar(c, 0, from, to)).toBe('');
    const before = headcount(folkOf(c, from));
    expect(settle(c, 0, from, to)).toBe('');
    const x = onTheRoad(c, 0).find((y) => y.movers)!;
    expect(x.cargo.men).toHaveLength(MIGRATE.settlers);
    expect(x.cargo.women).toHaveLength(MIGRATE.settlers);
    expect(headcount(folkOf(c, from))).toBe(before - 2 * MIGRATE.settlers - x.cargo.children!.length);
    expect(c.log.at(-1)).toContain('settlers have set out');
    // The town they go to must have room: the capital, crowded to its roofs, has none.
    const full = world();
    expect(settleBar(full.c, 0, full.to, full.from)).toContain('no room');
    const small = world();
    const k = folkOf(small.c, small.from); k.men = 4; k.women = 4; k.elders = 0; delete k.ages;
    expect(settleBar(small.c, 0, small.from, small.to)).toContain('cannot spare');
  });
});
