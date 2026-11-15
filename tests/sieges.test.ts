// A siege nobody watches: walls are worth more than their sum to those who stand on them (src/sim/sieges.ts).
import { describe, expect, it } from 'vitest';
import { moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { SIEGE, manned, walled, wallsEdge } from '../src/sim/sieges';
import { folkOf } from '../src/sim/township';

/** A rival's army set against a town of the player's next door, with the pending battle opened. */
function siege(seed: number, town: (c: Campaign, tid: number) => void, men = 6) {
  const c = newCampaign(seed, 2);
  c.fronts = [];
  const t = c.territories.find((x) => x.owner === 0 && x.capital < 0) ?? c.territories.find((x) => x.owner === 0)!;
  const from = c.territories[t.adj[0]];
  from.owner = 1;
  c.armies = c.armies.filter((a) => a.at !== from.id && a.at !== t.id);
  c.truces = []; c.ally = -1;
  t.buildings = []; delete t.town;
  Object.assign(folkOf(c, t.id), { men, women: 4, elders: 0, children: 2 });
  town(c, t.id);
  c.armies.push({ id: 801, owner: 1, at: from.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
  c.phase = 'ai';
  const moved = moveArmy(c, 801, t.id);
  return { c, t, moved };
}

describe('walls and the men to hold them', () => {
  it('a land is walled by a Fortress, or by a finished tower or wall on its battlefield; and manned by its men or an army of its holder\'s', () => {
    const { c, t } = siege(11, () => {});
    expect(walled(c, t.id)).toBe(false);
    expect(manned(c, t.id)).toBe(true);
    t.buildings = ['fortress'];
    expect(walled(c, t.id)).toBe(true);
    t.buildings = [];
    t.town = { at: 0, b: [['house', 5, 5]] };
    expect(walled(c, t.id)).toBe(false);
    t.town = { at: 0, b: [['tower', 5, 5, undefined, 0.5]] }; // never finished
    expect(walled(c, t.id)).toBe(false);
    t.town = { at: 0, b: [['tower', 5, 5, 0.4]] };
    expect(walled(c, t.id)).toBe(true);
    t.town = { at: 0, b: [['palisade', 5, 5]] };
    expect(walled(c, t.id)).toBe(true);
    folkOf(c, t.id).men = 0;
    expect(manned(c, t.id)).toBe(false);
    c.armies.push({ id: 802, owner: 0, at: t.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(manned(c, t.id)).toBe(true);
    c.armies.find((a) => a.id === 802)!.owner = 2; // somebody else's army does not man it
    expect(manned(c, t.id)).toBe(false);
  });

  it('only a walled and manned town has the edge, and never a field battle, a tribe\'s land or a fight with a band', () => {
    const open = siege(11, () => {});
    expect(open.moved).toBe('battle');
    expect(wallsEdge(open.c, open.c.pending!)).toBe(1);
    const fort = siege(11, (c, tid) => { c.territories[tid].buildings = ['fortress']; });
    expect(wallsEdge(fort.c, fort.c.pending!)).toBe(SIEGE.walls);
    expect(wallsEdge(fort.c, { ...fort.c.pending!, mode: 'field' })).toBe(1);
    expect(wallsEdge(fort.c, { ...fort.c.pending!, defender: -1 })).toBe(1);
    expect(wallsEdge(fort.c, { ...fort.c.pending!, band: 3 })).toBe(1);
    const empty = siege(11, (c, tid) => { c.territories[tid].buildings = ['fortress']; }, 0);
    expect(wallsEdge(empty.c, empty.c.pending!)).toBe(1); // walls with nobody on them
  });

  it('settled unwatched, the same assault that takes an open town is mostly thrown back from a walled one', () => {
    let open = 0, fort = 0, n = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const a = siege(seed, () => {}), b = siege(seed, (c, tid) => { c.territories[tid].buildings = ['fortress']; });
      if (a.moved !== 'battle' || b.moved !== 'battle') continue;
      n++;
      if (!resolvePending(a.c, 'auto')) open++;
      if (!resolvePending(b.c, 'auto')) fort++;
    }
    expect(n).toBeGreaterThan(15);
    expect(fort).toBeGreaterThan(open);
    expect(fort / n).toBeGreaterThan(0.6);
    expect(open / n).toBeLessThan(0.4);
  }, 60000);
});
