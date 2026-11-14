// A building the victor never finished is still there, half built, the next time that land is fought over.
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, mendTowns, moveArmy, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { spot } from './helpers';

const march = (c: Campaign, owner: number, tid: number, id: number) => {
  const from = c.territories[c.territories[tid].adj[0]];
  from.owner = owner;
  c.armies = c.armies.filter((a) => a.at !== from.id);
  c.armies.push({ id, owner, at: from.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
  if (owner) c.phase = 'ai';
  expect(moveArmy(c, id, tid)).toBe('battle');
  c.pending!.mode = 'siege';
  const cfg = battleConfig(c)!;
  return new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate);
};

describe('unfinished buildings stay', () => {
  it('a half-built barracks waits as it was left, gives the map nothing, and can be finished next time', () => {
    const c = newCampaign(11, 2);
    const t = c.territories.find((x) => x.owner === 1 && x.capital < 0) ?? c.territories.find((x) => x.owner === 1)!;
    t.buildings = [];
    const g = march(c, 0, t.id, 811);
    const at = spot(g, 'barracks', 0);
    const site = g.spawnBuilding('barracks', 0, at.cx, at.cy, false);
    site.progress = 0.4;
    site.hp = Math.round(site.maxHp * 0.4);
    expect(g.standing(0).find((b) => b[0] === 'barracks')).toEqual(['barracks', at.cx, at.cy, 0.4, 0.4]);
    finishBattle(c, true, { clubman: 12 }, { town: g.standing(0) });
    expect(t.owner).toBe(0);
    expect(t.buildings).not.toContain('barracks'); // not finished: no Barracks on the map
    for (let i = 0; i < 5; i++) mendTowns(c);
    expect(t.town!.b.find((b) => b[0] === 'barracks')).toEqual(['barracks', at.cx, at.cy, 0.4, 0.4]);

    const h = march(c, 1, t.id, 812);
    const there = h.buildings.find((b) => b.owner === 0 && b.type === 'barracks')!;
    expect([there.cx, there.cy, there.complete, there.progress]).toEqual([at.cx, at.cy, false, 0.4]);
    expect(there.hp).toBe(Math.round(there.maxHp * 0.4));
    // Finished in the second fight, it is an ordinary building in the record and a Barracks on the map.
    there.progress = 1; there.complete = true; there.hp = there.maxHp;
    finishBattle(c, true, {}, { town: h.standing(0) });
    expect(t.town!.b.find((b) => b[0] === 'barracks')).toEqual(['barracks', at.cx, at.cy]);
    expect(t.buildings).toContain('barracks');
  });

  it('a land with a Barracks on the map still fields a finished one beside a half-built one', () => {
    const c = newCampaign(11, 2);
    const t = c.territories.find((x) => x.owner === 1 && x.capital < 0) ?? c.territories.find((x) => x.owner === 1)!;
    t.buildings = ['barracks'];
    const fresh = march(c, 0, t.id, 813);
    const home = fresh.spec.starts[1];
    c.pending = null;
    t.town = { at: 2, b: [['barracks', home.x + 5, home.y - 8, 0.3, 0.3]] };
    c.armies = c.armies.filter((a) => a.id !== 813);
    const g = march(c, 0, t.id, 814);
    const theirs = g.buildings.filter((b) => b.owner === 1 && b.type === 'barracks');
    expect(theirs.some((b) => b.complete)).toBe(true);
  });
});
