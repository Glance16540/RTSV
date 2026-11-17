// A dead town stands open to whoever comes (docs/DESIGN.md, the owner's word; src/sim/deadtown.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, defence, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import { DEAD, deadTowns, isOpen, openDefence, seizeOpen } from '../src/sim/deadtown';
import { raise } from '../src/sim/campaign';
import { folkOf, headcount } from '../src/sim/township';

const LONG = 60_000;
/** A town of the rival's with nobody in it, no army there, and no marauders anywhere near. */
const dead = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner < 0 && !x.horde && x.capital < 0)!;
  Object.assign(t, { owner: 1, buildings: ['fortress'] });
  for (const x of c.territories) x.horde = false;
  c.bands = []; c.truces = [];
  c.armies = c.armies.filter((a) => a.at !== t.id);
  const f = folkOf(c, t.id);
  Object.assign(f, { men: 0, women: 0, elders: 0, children: 0 }); delete f.ages;
  return { c, t, f };
};
const seasons = (c: Campaign, n: number) => { let out: number[] = []; for (let i = 0; i < n; i++) { out = out.concat(deadTowns(c)); c.turn++; } return out; };

describe('a dead town', () => {
  it('stands open after a while with nobody in it: still its people\'s, with nobody on its walls', () => {
    const { c, t, f } = dead();
    const walled = defence(c, t.id);
    expect(walled).toBeGreaterThanOrEqual(3); // a Fortress, while it counts as a town; it has no men of its own to add to that (militia.ts)
    expect(isOpen(c, t.id)).toBe(false);
    expect(seasons(c, DEAD.open)).toEqual([]);
    expect(isOpen(c, t.id)).toBe(true);
    expect(t.owner).toBe(1); // it does not go back to the wild by itself
    expect(openDefence(c, t.id)).toBe(DEAD.defence);
    expect(defence(c, t.id)).toBe(DEAD.defence);
    // An army of its holder in it defends it as any town; and anyone alive in it and it is no dead town.
    c.armies.push({ id: 90, owner: 1, at: t.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    expect(openDefence(c, t.id)).toBeNull();
    expect(defence(c, t.id)).toBeGreaterThan(walled);
    c.armies.pop();
    f.children = 1;
    expect(isOpen(c, t.id)).toBe(false);
    seasons(c, 1);
    f.children = 0; delete f.ages;
    expect(isOpen(c, t.id)).toBe(false); // the count begins again
  }, LONG);

  it('a town whose only people are away with its armies is not dead', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), cap = c.territories.find((x) => x.capital === 1)!;
    cap.buildings = ['barracks']; c.factions[1].supplies = 100;
    c.armies = c.armies.filter((a) => a.at !== cap.id);
    const f = folkOf(c, cap.id);
    f.men = 10; f.women = 0; delete f.ages;
    for (let i = 0; i < 3; i++) raise(c, 1, cap.id, 'infantry');
    Object.assign(f, { men: 0, women: 0, elders: 0, children: 0 }); delete f.ages;
    c.armies.find((a) => a.at === cap.id)!.at = cap.adj[0];
    seasons(c, DEAD.open + 3);
    expect(isOpen(c, cap.id)).toBe(false);
  }, LONG);

  it('a rival that can reach it marches on it and has it for the asking, and settles it', () => {
    const { c, t } = dead();
    seasons(c, DEAD.open);
    t.owner = 0; c.emptiedOf![t.id] = 0; // it is the player's dead town, and a rival stands beside it
    const from = c.territories[t.adj[0]];
    Object.assign(from, { owner: 1, horde: false });
    c.armies = c.armies.filter((a) => a.at !== from.id && a.at !== t.id);
    c.armies.push({ id: 91, owner: 1, at: from.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(seizeOpen(c, 1)).toBe(1);
    if (c.pending) { expect(c.pending.dStr).toBeLessThan(1.5); resolvePending(c, 'attacker'); }
    expect(t.owner).toBe(1);
    expect(t.yoke).toBeUndefined(); // nobody is there to resent it
    expect(headcount(folkOf(c, t.id))).toBe(0);
    expect(deadTowns(c)).toEqual([]);
    expect(folkOf(c, t.id)).toMatchObject({ men: DEAD.settlers, women: DEAD.settlers });
    expect(c.log.join('\n')).toContain(`settled the empty town at ${t.name}`);
    expect(isOpen(c, t.id)).toBe(false);
    // It does not march on a town of its own, on one it has a truce with, or on a town with people in it.
    const b = dead(9);
    seasons(b.c, DEAD.open);
    const side = b.c.territories[b.t.adj[0]];
    Object.assign(side, { owner: 1, horde: false });
    b.c.armies = [{ id: 92, owner: 1, at: side.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false }];
    expect(seizeOpen(b.c, 1)).toBe(0); // its own
  }, LONG);

  it('marauders beside it walk in; and one nobody comes for is found by a wandering band in the end', () => {
    const { c, t } = dead();
    c.territories[t.adj[0]].horde = true; c.territories[t.adj[0]].owner = -1;
    expect(seasons(c, DEAD.open - 1)).toEqual([]);
    expect(seasons(c, 1)).toEqual([t.id]);
    expect(t).toMatchObject({ owner: -1, horde: true, militia: DEAD.camp });
    expect((c.bands ?? []).some((b) => b.kind === 'marauders' && b.at === t.id)).toBe(true);
    expect(c.log.join('\n')).toContain(`${t.name} stood empty, and the marauders beside it walked in`);
    expect(c.chronicle!.some((x) => x.text.includes(t.name) && x.text.includes('stood empty'))).toBe(true);
    // With an army of its holder in it, they do not.
    const g = dead(9);
    g.c.territories[g.t.adj[0]].horde = true; g.c.territories[g.t.adj[0]].owner = -1;
    g.c.armies.push({ id: 93, owner: 1, at: g.t.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(seasons(g.c, DEAD.open + 4)).toEqual([]);
    expect(g.t.owner).toBe(1);
    // Far from any marauders it waits, open, for whoever comes; and after long enough a wandering band does.
    const far = dead(11);
    expect(seasons(far.c, DEAD.found - 1)).toEqual([]);
    expect(far.t.owner).toBe(1);
    expect(seasons(far.c, 1)).toEqual([far.t.id]);
    expect(far.c.log.join('\n')).toContain('a wandering band of marauders found it');
  }, LONG);
});
