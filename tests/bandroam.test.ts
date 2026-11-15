// Bands move (src/sim/bandroam.ts): they flee strong armies, roam toward softer marks, settle and break up.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { ROAM, armyOver, placesFrom, roamSeason } from '../src/sim/bandroam';
import type { Band, BandKind } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

/** A world of the player's lands only, each a plain town of six men, with no armies. */
function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.fronts = [];
  c.armies = [];
  c.turn = 20;
  for (const t of c.territories) {
    if (t.capital !== 0) t.capital = -1;
    t.owner = 0; t.buildings = []; t.trait = ''; delete t.town; delete t.horde;
    Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 0, children: 2 });
    delete folkOf(c, t.id).ages;
  }
  const t = c.territories.find((x) => x.capital < 0 && x.adj.filter((n) => c.territories[n].capital < 0).length >= 2)!;
  return { c, t };
}
const band = (c: Campaign, t: Territory, strength: number, kind: BandKind = 'raiders', to?: number): Band => {
  const b: Band = { id: 900 + (c.bands?.length ?? 0), kind, name: 'the Test Men', at: t.id, ...(to === undefined ? {} : { to }), strength, since: c.turn, held: [] };
  (c.bands ??= []).push(b);
  return b;
};

describe('bands move', () => {
  it('a band flees an army at its place that is its match, to a place with none, taking those it holds; a weaker army it stays for', () => {
    const { c, t } = world();
    const b = band(c, t, 4);
    b.held.push({ from: t.id, owner: 0, men: [], women: [80], since: c.turn });
    c.armies.push({ id: 801, owner: 0, at: t.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    expect(armyOver(c, b)).toBe(3);
    const out: string[] = [];
    expect(roamSeason(c, out)).toBe(0);
    expect(b.at).toBe(t.id);
    c.armies[0].units.infantry = 4;
    expect(roamSeason(c, out)).toBe(1);
    expect(b.at).not.toBe(t.id);
    expect(t.adj).toContain(b.at);
    expect(c.armies.some((a) => a.at === b.at)).toBe(false);
    expect(b.held).toHaveLength(1);
    expect(b.moved).toBe(c.turn);
    expect(out.join(' ')).toContain('have fled');
    expect(c.bandNews!.some((n) => n.kind === 'fled' && n.band === b.id)).toBe(true);
  });

  it('cornered, with an army in every place it could go, it stays where it is', () => {
    const { c, t } = world();
    const b = band(c, t, 4);
    [t.id, ...t.adj].forEach((id, i) => c.armies.push({ id: 801 + i, owner: 0, at: id, units: { infantry: 6 }, hero: false, vet: 0, moved: false }));
    expect(placesFrom(c, b)).toEqual([]);
    expect(roamSeason(c, [])).toBe(0);
    expect(b.at).toBe(t.id);
  });

  it('after some seasons in one place it moves next door if a clearly softer town would be in its reach there, and not before', () => {
    const { c, t } = world();
    // Everything in its reach is walled; one land two steps off is open.
    const b = band(c, t, 4);
    const near = new Set([t.id, ...t.adj]);
    const step = c.territories[t.adj.find((n) => c.territories[n].capital < 0 && c.territories[n].adj.some((m) => !near.has(m) && c.territories[m].capital < 0))!];
    const soft = c.territories[step.adj.find((m) => !near.has(m) && c.territories[m].capital < 0)!];
    for (const x of c.territories) if (x.id !== soft.id) x.buildings = ['fortress'];
    Object.assign(folkOf(c, soft.id), { men: 0 });
    expect(roamSeason(c, [])).toBe(0); // it has only just come
    c.turn += ROAM.restless;
    const out: string[] = [];
    expect(roamSeason(c, out)).toBe(1);
    expect(c.territories[b.at].adj).toContain(soft.id);
    expect(out.join(' ')).toContain('after softer marks');
    // Where nothing is softer it looks, stays, and does not look again for a while.
    const flat = world();
    const k = band(flat.c, flat.t, 4);
    flat.c.turn += ROAM.restless;
    expect(roamSeason(flat.c, [])).toBe(0);
    expect(k.at).toBe(flat.t.id);
    expect(k.moved).toBe(flat.c.turn);
  });

  it('old and still weak, holding nobody, it drifts apart; holding someone, it does not', () => {
    const { c, t } = world();
    const b = band(c, t, ROAM.weak);
    b.since = c.turn - ROAM.old; b.moved = c.turn;
    b.held.push({ from: t.id, owner: 0, men: [], women: [80], since: c.turn });
    roamSeason(c, []);
    expect(c.bands).toContain(b);
    b.held = [];
    const out: string[] = [];
    roamSeason(c, out);
    expect(c.bands).not.toContain(b);
    expect(out.join(' ')).toContain('drifted apart');
  });

  it('with nothing left in reach it moves to where there is, and with nowhere to go it is gone', () => {
    const { c, t } = world();
    const b = band(c, t, 4);
    for (const id of [t.id, ...t.adj]) c.territories[id].owner = -1;
    const out: string[] = [];
    roamSeason(c, out);
    if (c.bands!.includes(b)) { expect(b.at).not.toBe(t.id); expect(out.join(' ')).toContain('nothing left to rob where they were'); }
    for (const x of c.territories) x.owner = -1;
    b.moved = c.turn;
    roamSeason(c, out);
    expect(c.bands).not.toContain(b);
    expect(out.join(' ')).toContain('nothing left there to rob');
  });

  it('raiders grown strong in a tribe\'s land take it for their own and are marauders from then on; in a held land they do not', () => {
    const { c, t } = world();
    const wild = c.territories[t.adj[0]];
    wild.owner = -1; wild.militia = 2;
    const b = band(c, wild, ROAM.settle);
    b.since = c.turn - ROAM.settled; b.moved = c.turn;
    const out: string[] = [];
    roamSeason(c, out);
    expect(b.kind).toBe('marauders');
    expect(wild.horde).toBe(true);
    expect(wild.militia).toBe(ROAM.settle);
    expect(out.join(' ')).toContain('take');
    const held = world();
    const k = band(held.c, held.t, ROAM.settle);
    k.since = held.c.turn - ROAM.settled; k.moved = held.c.turn;
    roamSeason(held.c, []);
    expect(k.kind).toBe('raiders');
  });

  it('pirates move from coast to coast, highwaymen to a road that meets theirs, and the marauders not at all', () => {
    const { c, t } = world();
    const coasts = c.territories.filter((x) => x.capital < 0).slice(0, 3);
    for (const x of coasts) x.trait = 'coast';
    const p = band(c, coasts[0], 4, 'pirates');
    expect(placesFrom(c, p).map((x) => x[0]).sort()).toEqual(coasts.slice(1).map((x) => x.id).sort());
    const h = band(c, t, 4, 'highwaymen', t.adj[0]);
    for (const [a, b] of placesFrom(c, h)) {
      expect(c.territories[a].adj).toContain(b);
      expect([a, b].some((id) => id === t.id || id === t.adj[0])).toBe(true);
      expect([a, b].sort()).not.toEqual([t.id, t.adj[0]].sort());
    }
    expect(placesFrom(c, h).length).toBeGreaterThan(0);
    const m = band(c, c.territories[t.adj[1]], 9, 'marauders');
    c.armies.push({ id: 801, owner: 0, at: m.at, units: { infantry: 12 }, hero: false, vet: 0, moved: false });
    roamSeason(c, []);
    expect(m.at).toBe(t.adj[1]);
  });
});
