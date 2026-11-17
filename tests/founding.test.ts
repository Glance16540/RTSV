// Settlers found a new town on an empty land (src/sim/founding.ts; migration.ts settle and foundOf; convoys.ts sendSettlers).
import { describe, expect, it } from 'vitest';
import type { Campaign } from '../src/sim/campaign';
import { emptyLand } from '../src/sim/founding';
import { MIGRATE, foundOf, freeLands, movesReport, settle, settleBar } from '../src/sim/migration';
import { convoysTurn, onTheRoad } from '../src/sim/convoys';
import { layTowns } from '../src/sim/rivalrule';
import { roomOf } from '../src/sim/seasonfolk';
import { folkOf, headcount } from '../src/sim/township';
import { newCampaign } from '../src/sim/campaign';

/** A town of the player's beside the capital, crowded enough to spare settlers, and an empty land beside it. */
function world(): { c: Campaign; from: number; to: number } {
  for (let seed = 1; seed < 40; seed++) {
    const c = newCampaign(seed, 1, 1, 'hearth');
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    const near = home.adj.filter((n) => c.territories[n].owner < 0 && !c.territories[n].horde);
    if (near.length < 2) continue;
    const [mid, to] = near;
    const t = c.territories[mid];
    t.owner = 0; t.buildings = ['farm'];
    const f = folkOf(c, mid); f.men = 11; f.women = 11; f.elders = 2; f.children = 6; delete f.ages; delete f.drift; delete f.hungry; delete f.grief;
    f.stores = { food: 3000, wood: 900, gold: 900, stone: 900 };
    delete t.town; layTowns(c);
    const land = c.territories[to];
    land.militia = 0; land.buildings = []; delete land.town;
    land.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
    c.bands = (c.bands ?? []).filter((b) => b.at !== to && b.to !== to);
    return { c, from: mid, to };
  }
  throw new Error('no seed with two unheld lands beside the capital');
}

describe('an empty land', () => {
  it('is one nobody holds, with nobody living there, no warriors and no band: a tribe\'s land, a camp of marauders or a band\'s place is not', () => {
    const { c, from, to } = world();
    expect(emptyLand(c, to)).toBe(true);
    expect(emptyLand(c, from)).toBe(false); // the people's own
    expect(freeLands(c, 0)).toContain(to);
    c.territories[to].horde = true;
    expect(emptyLand(c, to)).toBe(false);
    expect(settleBar(c, 0, from, to)).toContain('held by a band');
    c.territories[to].horde = false;
    (c.bands ??= []).push({ id: 70, kind: 'raiders', name: 'the Red Hand', at: to, strength: 3, since: c.turn, held: [] });
    expect(emptyLand(c, to)).toBe(false);
    c.bands = c.bands.filter((b) => b.id !== 70);
    folkOf(c, to).men = 3; // somebody lives there
    expect(emptyLand(c, to)).toBe(false);
  });
});

describe('settlers found a town', () => {
  it('the player\'s settlers carry food and timber, and coming in they make the land a small town of their people', () => {
    const { c, from, to } = world();
    const had = headcount(folkOf(c, from));
    expect(settleBar(c, 0, from, to)).toBe('');
    expect(settle(c, 0, from, to)).toBe('');
    const x = onTheRoad(c, 0).find((y) => y.found)!;
    expect(x.cargo.food).toBe(MIGRATE.provisions.food);
    expect(x.cargo.wood).toBe(MIGRATE.provisions.wood);
    const people = x.cargo.men.length + x.cargo.women.length + x.cargo.children!.length;
    expect(headcount(folkOf(c, from))).toBe(had - people);
    expect(movesReport(c, 0, c.turn - 1)[0]).toContain(`to found a town at ${c.territories[to].name}`);
    c.turn++;
    const [a] = convoysTurn(c);
    expect(a.founded).toBe(true);
    const land = c.territories[to];
    expect(land.owner).toBe(0);
    expect(headcount(folkOf(c, to))).toBe(people);
    expect(folkOf(c, to).stores.food).toBe(MIGRATE.provisions.food);
    expect(c.events!.some((e) => e.kind === 'founded' && e.at === to)).toBe(true);
    expect(c.chronicle!.some((e) => e.text.includes(`founded a new town at ${land.name}`))).toBe(true);
    layTowns(c); // the next season its town is laid on the record: a hall and a roof for every couple
    expect(land.town?.b.some((b) => b[0] === 'towncenter')).toBe(true);
    expect(roomOf(land)).toBeGreaterThanOrEqual(people);
  });

  it('if the land is taken before they come, they go home to their people', () => {
    const { c, from, to } = world();
    settle(c, 0, from, to);
    c.territories[to].owner = 1; // a rival has it first
    c.turn++;
    const [a] = convoysTurn(c);
    expect(a.founded).toBeFalsy();
    expect(c.territories[to].owner).toBe(1);
    expect(a.at).not.toBe(to);
  });

  it('a rival\'s crowded town, or the player\'s by its governor, sends settlers to an empty land beside its people\'s', () => {
    const { c, from, to } = world();
    for (const t of c.territories) if (t.owner === 0) t.owner = 1;
    c.factions[1].alive = true;
    const crowd = folkOf(c, from); crowd.children += Math.max(0, roomOf(c.territories[from]) - headcount(crowd));
    let moved: ReturnType<typeof foundOf> = [];
    for (let s = 0; s < 60 && !moved.length; s++) { c.turn++; moved = foundOf(c, 1); }
    expect(moved[0]).toMatchObject({ owner: 1, from, to, found: true });
    // The player's crowded town, kept by its governor, does the same, and the player is told.
    const w = world();
    const mine = folkOf(w.c, w.from); mine.children += Math.max(0, roomOf(w.c.territories[w.from]) - headcount(mine));
    let sent: ReturnType<typeof foundOf> = [];
    for (let s = 0; s < 60 && !sent.length; s++) { w.c.turn++; sent = foundOf(w.c, 0); }
    expect(sent[0]).toMatchObject({ owner: 0, from: w.from, to: w.to, found: true });
    expect(w.c.log.at(-1)).toContain('settlers have set out');
  });
});
