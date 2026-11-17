// A battle on the map fought out through the hub (src/sim/mapbattle.ts, campaign.ts resolvePending).
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, moveArmy, newCampaign, raise, resolvePending } from '../src/sim/campaign';
import { armySize } from '../src/sim/campaignbase';
import { agesOf } from '../src/sim/ageing';
import { folkOf } from '../src/sim/township';
import { fallenSince } from '../src/sim/warhouse';
import { clash, fallBack, foresee, forcesOf, wouldTake } from '../src/sim/mapbattle';

/** The player's chief town with a Barracks, a Range and a Stable and men to spare, and a rival's town next door. */
const field = (seed = 11) => {
  const c = newCampaign(seed, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  const back = (t: { id: number; adj: number[] }) => c.territories.find((x) => t.adj.includes(x.id) && x.id !== home.id && !x.horde && x.capital !== 0 && !home.adj.includes(x.id));
  const near = c.territories.find((t) => home.adj.includes(t.id) && !t.horde && t.capital < 0 && back(t))!;
  const behind = back(near)!;
  near.owner = 1; behind.owner = 1;
  c.armies = [];
  c.truces = []; c.ally = -1;
  c.factions[0].supplies = 500; c.factions[1].supplies = 500;
  for (const t of [home, near, behind]) {
    t.buildings = ['barracks', 'range', 'stable'];
    if (t.town) t.town.b = t.town.b.filter((b) => b[0] !== 'tower');
    const f = folkOf(c, t.id);
    Object.assign(f, { men: 30, women: 12, elders: 0, children: 0 }); f.notables = []; delete f.ages; delete f.houses;
    agesOf(c, t.id, f);
  }
  return { c, home, near, behind };
};
const muster = (c: Campaign, f: number, tid: number, kinds: string[]) => { for (const k of kinds) expect(raise(c, f, tid, k)).toBe(true); const a = armyAt(c, tid)!; a.moved = false; return a; };
const n = (u: Record<string, number>): number => Object.values(u).reduce((x, y) => x + y, 0);

describe('a battle on the map is fought out', () => {
  it('a strong army takes a weak town, loses by kind, and it is told', () => {
    const { c, home, near } = field();
    const a = muster(c, 0, home.id, ['infantry', 'infantry', 'infantry', 'archers', 'archers', 'cavalry']);
    muster(c, 1, near.id, ['infantry']);
    const before = { ...a.units };
    expect(moveArmy(c, a.id, near.id)).toBe('battle');
    expect(resolvePending(c, 'auto')).toBe(true);
    expect(near.owner).toBe(0);
    expect(a.at).toBe(near.id);
    expect(armySize(a)).toBeGreaterThan(0);
    const tale = c.tales![c.tales!.length - 1];
    expect(tale.attackerWon).toBe(true);
    expect(tale.at).toBe(near.id);
    for (const k of Object.keys(before)) expect((a.units[k] ?? 0) + (tale.lostA[k] ?? 0)).toBe(before[k]);
    expect(tale.text).toContain('was taken');
    expect(c.log).toContain(tale.text);
  });

  it('a weak army is thrown back: what is left stays where it marched from, or scatters, and the dead are named', () => {
    const { c, home, near } = field();
    const a = muster(c, 0, home.id, ['infantry', 'infantry']);
    muster(c, 1, near.id, ['infantry', 'infantry', 'infantry', 'archers', 'archers', 'cavalry']);
    const id = a.id;
    expect(moveArmy(c, id, near.id)).toBe('battle');
    expect(resolvePending(c, 'auto')).toBe(false);
    expect(near.owner).toBe(1);
    const tale = c.tales![c.tales!.length - 1], left = c.armies.find((x) => x.id === id);
    expect(tale.attackerWon).toBe(false);
    expect(n(tale.lostA)).toBeGreaterThan(0);
    if (left) { expect(left.at).toBe(home.id); expect(armySize(left)).toBe(2 - n(tale.lostA)); expect(left.moved).toBe(true); }
    else expect(n(tale.lostA)).toBe(2);
    // Men of the town fell with it, and their houses know their names.
    const fallen = fallenSince(c, 0, c.turn);
    expect(fallen.length).toBeGreaterThan(0);
    expect(tale.fell.length).toBeGreaterThan(0);
    expect(tale.text).toContain('Among the fallen');
  });

  it('a garrison beaten out of its town falls back on its own land next door', () => {
    const { c, near, behind } = field();
    const g = muster(c, 1, near.id, ['infantry', 'infantry', 'archers', 'archers', 'cavalry']);
    const side = { began: { ...g.units }, lost: { infantry: 1, archers: 1 }, left: { infantry: 1, archers: 1, cavalry: 1 }, share: 0.6, breakAt: 0.5, works: 0 };
    expect(fallBack(c, g, side, near.id)).toBe(true);
    expect(c.territories[g.at].owner).toBe(1);
    expect(g.at).not.toBe(near.id);
    expect(near.adj).toContain(g.at);
    expect(g.units).toEqual({ infantry: 1, archers: 1, cavalry: 1 });
    // With nowhere of its own to go, it is lost.
    const lone = muster(c, 1, near.id, ['infantry', 'infantry']);
    for (const id of near.adj) if (c.territories[id].owner === 1) c.territories[id].owner = 0;
    expect(fallBack(c, lone, { began: { infantry: 2 }, lost: { infantry: 1 }, left: { infantry: 1 }, share: 0.6, breakAt: 0.5, works: 0 }, near.id)).toBe(false);
    void behind;
  });

  it('whoever chooses where to march reads the same fight', () => {
    const { c, home, near } = field();
    const a = muster(c, 0, home.id, ['infantry', 'infantry', 'infantry']);
    muster(c, 1, near.id, ['archers']);
    const { a: fa, d: fd } = forcesOf(c, a, near.id, 3, 2);
    expect(fa.units).toBe(a.units);
    expect(fd.units).toEqual({ archers: 1 });
    expect(wouldTake(c, a, near.id, 3, 2)).toBe(foresee(fa, fd).attackerWon);
    expect(wouldTake(c, a, near.id, 3, 2)).toBe(true);
    expect(wouldTake(c, a, near.id, 3, 30)).toBe(false);
    expect(clash(fa, fd)).toEqual(foresee(fa, fd));
  });

  it('the same campaign fights the same battle', () => {
    const run = () => {
      const { c, home, near } = field(11);
      const a = muster(c, 0, home.id, ['infantry', 'infantry', 'archers', 'cavalry']);
      muster(c, 1, near.id, ['infantry', 'archers', 'archers']);
      moveArmy(c, a.id, near.id);
      resolvePending(c, 'auto');
      return c.tales![c.tales!.length - 1];
    };
    expect(run()).toEqual(run());
  });
});
