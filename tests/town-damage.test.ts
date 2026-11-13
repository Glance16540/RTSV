// A town kept from one siege to the next is as battered as the last one left it.
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { spot } from './helpers';

describe('damage to a land\'s town carries over', () => {
  it('a building hurt in a siege the player wins is still hurt when they next defend it', () => {
    const c = newCampaign(11, 2);
    const t = c.territories.find((x) => x.owner === 1 && x.capital < 0) ?? c.territories.find((x) => x.owner === 1)!;
    t.buildings = [];
    const from = c.territories[t.adj[0]];
    from.owner = 0;
    c.armies = c.armies.filter((a) => a.at !== from.id);
    c.armies.push({ id: 801, owner: 0, at: from.id, units: { infantry: 6 }, hero: false, vet: 0, moved: false });
    expect(moveArmy(c, 801, t.id)).toBe('battle');
    c.pending!.mode = 'siege';
    const cfg = battleConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate);
    const at = spot(g, 'barracks', 0);
    const hurt = g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
    hurt.hp = Math.round(hurt.maxHp * 0.25);
    const whole = spot(g, 'house', 0);
    g.spawnBuilding('house', 0, whole.cx, whole.cy, true);
    const half = g.spawnBuilding('house', 0, ...Object.values(spot(g, 'house', 0)) as [number, number], false); // never finished
    const stood = g.standing(0);
    expect(stood.find((b) => b[0] === 'barracks')).toEqual(['barracks', at.cx, at.cy, 0.25]);
    expect(stood.find((b) => b[0] === 'house')).toEqual(['house', whole.cx, whole.cy]);
    expect(stood.some((b) => b[1] === half.cx && b[2] === half.cy)).toBe(false);
    finishBattle(c, true, { clubman: 12 }, { town: stood });
    expect(t.town!.b.find((b) => b[0] === 'barracks')![3]).toBe(0.25);

    const foe = c.territories[t.adj[0]];
    foe.owner = 1;
    c.armies = c.armies.filter((a) => a.at !== foe.id);
    c.armies.push({ id: 802, owner: 1, at: foe.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    c.phase = 'ai';
    expect(moveArmy(c, 802, t.id)).toBe('battle');
    c.pending!.mode = 'siege';
    const again = battleConfig(c)!;
    const h = new Game(again.seed, again.setups, again.size, again.field, again.sea, true, again.climate);
    const there = h.buildings.find((b) => b.owner === 0 && b.type === 'barracks')!;
    expect([there.cx, there.cy]).toEqual([at.cx, at.cy]);
    expect(there.hp).toBe(Math.round(there.maxHp * 0.25));
    expect(there.complete).toBe(true);
    const house = h.buildings.find((b) => b.owner === 0 && b.type === 'house')!;
    expect(house.hp).toBe(house.maxHp);
    // Mended in the second fight, it is whole in the record again.
    there.hp = there.maxHp;
    finishBattle(c, true, {}, { town: h.standing(0) });
    expect(t.town!.b.find((b) => b[0] === 'barracks')).toHaveLength(3);
  });

  it('a health that makes no sense is dropped, not trusted', () => {
    const c = newCampaign(11, 2);
    const t = c.territories.find((x) => x.owner === 1)!;
    const from = c.territories[t.adj[0]];
    from.owner = 0;
    c.armies = c.armies.filter((a) => a.at !== from.id);
    c.armies.push({ id: 803, owner: 0, at: from.id, units: { cavalry: 8 }, hero: false, vet: 0, moved: false });
    expect(moveArmy(c, 803, t.id)).toBe('battle');
    c.pending!.mode = 'siege';
    finishBattle(c, true, {}, { town: [['house', 20, 20, -3], ['house', 24, 20, 7], ['house', 28, 20, 0.5], ['house', 32, 20, 'x' as unknown as number]] });
    expect(t.town!.b).toEqual([['house', 20, 20], ['house', 24, 20], ['house', 28, 20, 0.5], ['house', 32, 20]]);
  });
});
