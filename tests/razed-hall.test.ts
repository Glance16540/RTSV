// A Town Center destroyed in a siege is not there the next time that land is fought over.
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { BUILDINGS } from '../src/sim/data';
import { run, spot } from './helpers';

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
const settled = (seed: number) => {
  const c = newCampaign(seed, 2, 1, 'hearth'); // a settled people: a war band has no hall to lose
  const t = c.territories.find((x) => x.owner === 1 && x.capital < 0) ?? c.territories.find((x) => x.owner === 1)!;
  t.buildings = [];
  return { c, t };
};
const halls = (g: Game, owner: number) => g.buildings.filter((b) => b.owner === owner && b.type === 'towncenter');

describe('a razed Town Center stays razed', () => {
  it('the holder defends without it, is not beaten for lack of it, and may raise it again in the Stone Age', () => {
    const { c, t } = settled(11);
    const g = march(c, 0, t.id, 821);
    expect(halls(g, 0)).toHaveLength(1);
    const at = spot(g, 'barracks', 0);
    g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
    (g as unknown as { kill(e: unknown): void }).kill(halls(g, 0)[0]);
    finishBattle(c, true, { clubman: 12 }, { town: g.standing(0) });
    expect(t.town!.b.map((b) => b[0])).toEqual(['barracks']);

    const h = march(c, 1, t.id, 822);
    expect(halls(h, 0)).toHaveLength(0);
    expect(h.buildings.some((b) => b.owner === 0 && b.type === 'barracks')).toBe(true);
    expect(h.units.filter((u) => u.owner === 0 && u.type === 'villager').length).toBeGreaterThan(0);
    run(h, 2);
    expect(h.players[0].defeated).toBe(false);
    expect(h.players[0].age).toBe(0);
    expect(h.ageFor(0, BUILDINGS.towncenter)).toBe(0);
    expect(h.ageFor(1, BUILDINGS.towncenter)).toBe(BUILDINGS.towncenter.age); // the attacker has a hall already
  });

  it('a hall that was only battered comes back battered, and a town of nothing but walls is given a hall', () => {
    const { c, t } = settled(11);
    const g = march(c, 0, t.id, 823);
    const hall = halls(g, 0)[0];
    hall.hp = Math.round(hall.maxHp * 0.3);
    finishBattle(c, true, { clubman: 12 }, { town: g.standing(0) });
    const h = march(c, 1, t.id, 824);
    expect(halls(h, 0)).toHaveLength(1);
    expect([halls(h, 0)[0].cx, halls(h, 0)[0].cy]).toEqual([hall.cx, hall.cy]);
    expect(halls(h, 0)[0].hp).toBe(Math.round(hall.maxHp * 0.3));
    const wall = spot(h, 'palisade', 0);
    finishBattle(c, true, {}, { town: [['palisade', wall.cx, wall.cy]] });
    c.armies = c.armies.filter((a) => a.id !== 824);
    const k = march(c, 1, t.id, 825);
    expect(halls(k, 0)).toHaveLength(1);
  });
});
