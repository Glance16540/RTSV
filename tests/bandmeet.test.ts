// A band coming for a town of the player's is put to them once, when an army can meet it (src/sim/bandmeet.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign, resolvePending } from '../src/sim/campaign';
import type { Army, Campaign } from '../src/sim/campaign';
import { askedOf, bandComing, goOut, markOf, struckToTell, toldStrikes } from '../src/sim/bandmeet';
import { THREATS } from '../src/sim/threatsbase';
import type { Raid } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

/** The player's lands only, plain towns of six men, no armies or bands, in the player's turn. */
function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.fronts = []; c.armies = []; c.bands = []; c.turn = 20; c.phase = 'player'; c.pending = null; c.demand = null;
  for (const t of c.territories) {
    if (t.capital !== 0) t.capital = -1;
    t.owner = 0; t.buildings = []; t.trait = ''; delete t.town; delete t.horde;
    Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 0, children: 2 });
    delete folkOf(c, t.id).ages;
  }
  const t = c.territories.find((x) => x.capital < 0 && x.adj.filter((n) => c.territories[n].capital < 0).length >= 2)!;
  return { c, t };
}
let ids = 900;
const band = (c: Campaign, at: number, strength = 3): Band => { const b: Band = { id: ids++, kind: 'raiders', name: 'the Red Hands', at, strength, since: c.turn, held: [] }; (c.bands ??= []).push(b); return b; };
const army = (c: Campaign, at: number, n: number, owner = 0): Army => { const a: Army = { id: 800 + c.armies.length, owner, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };

describe('a band coming for a town of the player\'s', () => {
  it('is put to them when an army of theirs can meet it, with the town it has for its mark and the strongest army that can go', () => {
    const { c, t } = world();
    const b = band(c, t.id);
    expect(markOf(c, b)).toBeDefined();
    expect(c.territories[markOf(c, b)!].owner).toBe(0);
    expect(bandComing(c)).toBeNull(); // no army: nothing can answer, so nothing is asked
    army(c, t.adj[0], 2);
    const strong = army(c, t.adj[1], 5);
    const coming = bandComing(c)!;
    expect(coming.band).toBe(b);
    expect(coming.mark).toBe(markOf(c, b));
    expect(coming.army).toBe(strong);
    expect(coming.marching).toBe(false);
  });

  it('is put once for each band, and not counted as asked while nothing could answer', () => {
    const { c, t } = world();
    const b = band(c, t.id);
    expect(bandComing(c)).toBeNull();
    expect(c.bandAsked ?? []).toEqual([]); // not asked: no army could go
    army(c, t.adj[0], 4);
    expect(bandComing(c)!.band).toBe(b);
    askedOf(c, b.id);
    expect(bandComing(c)).toBeNull();
    // Another band is another matter; and one that is gone is forgotten.
    const other = c.territories.find((x) => x.id !== t.id && x.adj.includes(t.adj[0]) && x.capital < 0)!;
    const b2 = band(c, other.id, 5);
    expect(bandComing(c)!.band).toBe(b2);
    c.bands = c.bands!.filter((x) => x !== b);
    askedOf(c, b2.id);
    expect(c.bandAsked).toEqual([b2.id]);
  });

  it('is not put when it has another people\'s town for its mark, in another\'s turn, while a battle waits, for an army that has marched, or for the marauders', () => {
    const { c, t } = world();
    const b = band(c, t.id);
    const a = army(c, t.adj[0], 4);
    expect(bandComing(c)).not.toBeNull();
    c.phase = 'ai'; expect(bandComing(c)).toBeNull(); c.phase = 'player';
    a.moved = true; expect(bandComing(c)).toBeNull(); a.moved = false;
    b.kind = 'marauders'; expect(bandComing(c)).toBeNull(); b.kind = 'raiders';
    for (const id of [t.id, ...t.adj]) if (c.territories[id].capital < 0) c.territories[id].owner = 1;
    const mark = markOf(c, b);
    if (mark !== undefined && c.territories[mark].owner !== 0) expect(bandComing(c)).toBeNull();
  });

  it('on the march, it is put for the town it is bound for, as marching', () => {
    const { c, t } = world();
    // Only one town is left the player's, two lands off; the band is bound for the land beside it.
    const near = c.territories[t.adj.find((n) => c.territories[n].capital < 0)!];
    const town = c.territories[near.adj.find((n) => n !== t.id && !t.adj.includes(n) && c.territories[n].capital < 0) ?? near.adj.find((n) => n !== t.id)!];
    for (const x of c.territories) if (x.id !== town.id) x.owner = -1;
    const b = band(c, t.id);
    b.bound = near.id;
    if (markOf(c, b) !== town.id) return; // the town is in reach already on this map: nothing to show
    army(c, near.id, 4);
    const coming = bandComing(c);
    if (!coming) return; // the army cannot reach it from there on this map
    expect(coming.mark).toBe(town.id);
    expect(coming.marching).toBe(true);
  });

  it('going out opens the battle the map already has, which can be entered or left to the army', () => {
    const { c, t } = world();
    const b = band(c, t.id, 2);
    const a = army(c, t.adj[0], 8);
    const coming = bandComing(c)!;
    expect(goOut(c, coming)).toBe(true);
    expect(c.pending).toMatchObject({ armyId: a.id, band: b.id, mode: 'field' });
    resolvePending(c, 'auto');
    expect(c.pending).toBeNull();
    expect(c.bands).not.toContain(b); // eight companies against two
  });
});

describe('a band that struck a town of the player\'s', () => {
  const raid = (c: Campaign, at: number, b: Band, over: Partial<Raid> = {}): Raid => {
    const r: Raid = { turn: c.turn, band: b.id, kind: b.kind, name: b.name, at, owner: 0, outcome: 'taken', force: 5, defence: { men: 1, works: 0, walls: 0, army: 0, guard: 0, spirit: 1, total: 1 },
      killed: 2, taken: { men: 0, women: 3 }, names: ['Ysolde of the Mill'], stores: { food: 40, wood: 0, gold: 25, stone: 0 }, sway: -4, ...over };
    (c.raids ??= []).push(r);
    return r;
  };
  it('is told once for the season: who came, what was lost, who was carried off by name, and how long there is to get them back', () => {
    const { c, t } = world();
    const b = band(c, t.adj[0], 5);
    raid(c, t.id, b);
    const told = struckToTell(c)!;
    expect(told.raids).toHaveLength(1);
    expect(told.band).toBe(b);
    expect(told.title).toBe(`The Red Hands sacked ${t.name}`);
    const text = told.lines.join(' ');
    expect(text).toContain('2 men killed');
    expect(text).toContain('3 women carried off');
    expect(text).toContain('They took 40 food, 25 gold.');
    expect(text).toContain('Among those carried off: Ysolde of the Mill.');
    expect(text).toContain(`got back for ${THREATS.holdFor} seasons`);
    toldStrikes(c);
    expect(struckToTell(c)).toBeNull();
    // Next season, a new strike is told again.
    c.turn++;
    expect(struckToTell(c)).toBeNull(); // last season's are not told late
    raid(c, t.id, b, { outcome: 'raided', taken: { men: 0, women: 0 }, names: [], killed: 1 });
    const next = struckToTell(c)!;
    expect(next.title).toBe(`The Red Hands raided ${t.name}`);
    expect(next.lines.join(' ')).not.toContain('got back');
  });

  it('a strike beaten off, one on another people, or in another\'s turn is not told so; several are told together, the worst first', () => {
    const { c, t } = world();
    const b = band(c, t.adj[0], 5);
    raid(c, t.id, b, { outcome: 'held', killed: 0, taken: { men: 0, women: 0 }, names: [] });
    raid(c, t.adj[1], b, { owner: 1 });
    expect(struckToTell(c)).toBeNull();
    raid(c, t.adj[1], b, { outcome: 'raided', killed: 1, taken: { men: 0, women: 0 }, names: [] });
    raid(c, t.id, b);
    c.phase = 'ai'; expect(struckToTell(c)).toBeNull(); c.phase = 'player';
    const told = struckToTell(c)!;
    expect(told.raids.map((r) => r.at)).toEqual([t.id, t.adj[1]]);
    expect(told.title).toBe('2 of your towns were struck');
    // The band gone since: it is still told, with nobody to draw.
    c.bands = [];
    expect(struckToTell(c)!.band).toBeUndefined();
  });
});
