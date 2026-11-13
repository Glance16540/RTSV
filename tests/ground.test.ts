// Wood felled, berries picked and stone dug in a siege stay gone the next time that land is fought over.
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';

const attack = (c: Campaign, tid: number, mode: 'siege' | 'field' = 'siege') => {
  const t = c.territories[tid], from = c.territories[t.adj[0]];
  from.owner = 0;
  c.armies = c.armies.filter((a) => a.at !== from.id);
  c.armies.push({ id: 700 + c.nextArmy++, owner: 0, at: from.id, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
  expect(moveArmy(c, c.armies[c.armies.length - 1].id, tid)).toBe('battle');
  c.pending!.mode = mode;
  return battleConfig(c)!;
};
const play = (cfg: NonNullable<ReturnType<typeof battleConfig>>) => {
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate);
  if (cfg.ground) g.wear(cfg.ground);
  return g;
};
const at = (g: Game, cx: number, cy: number) => g.resources.find((r) => r.cx === cx && r.cy === cy);
const kill = (g: Game, r: unknown) => (g as unknown as { kill(e: unknown): void }).kill(r);

describe('the ground of a land remembers what was taken from it', () => {
  it('felled trees and worked stone are as the last siege left them, even when the siege was lost', () => {
    const c = newCampaign(11, 2);
    const t = c.territories.find((x) => x.owner === 1)!;
    const g = play(attack(c, t.id));
    expect(g.ground()).toEqual({ gone: [], left: [] });
    const trees = g.resources.filter((r) => r.type === 'tree').slice(0, 5).map((r) => [r.cx, r.cy]);
    for (const [cx, cy] of trees) kill(g, at(g, cx, cy));
    const stone = g.resources.find((r) => r.type === 'stone')!, gold = g.resources.find((r) => r.type === 'gold')!;
    stone.amount = 310.5;
    kill(g, gold);
    const berries = g.resources.find((r) => r.type === 'berries')!;
    kill(g, berries);
    const count = g.resources.length;
    finishBattle(c, false, {}, { ground: g.ground() }); // thrown back: the land is still theirs
    expect(t.owner).toBe(1);
    expect(t.ground!.gone).toHaveLength(7);

    const h = play(attack(c, t.id));
    for (const [cx, cy] of trees) { expect(at(h, cx, cy)).toBeUndefined(); expect((h as unknown as { occupied: Uint8Array }).occupied[cy * h.size + cx]).toBe(0); }
    expect(at(h, gold.cx, gold.cy)).toBeUndefined();
    expect(at(h, stone.cx, stone.cy)!.amount).toBe(311);
    expect(at(h, berries.cx, berries.cy)).toBeUndefined(); // picked bushes stay bare
    expect(h.resources.length).toBe(count);
    // A second siege adds to the first.
    const more = h.resources.find((r) => r.type === 'tree')!;
    kill(h, more);
    finishBattle(c, true, {}, { ground: h.ground() });
    expect(t.ground!.gone).toHaveLength(8);
    expect(t.ground!.left).toEqual([[stone.cy * h.size + stone.cx, 311]]);
  });

  it('a field battle is fought elsewhere and changes nothing', () => {
    const c = newCampaign(11, 2);
    const t = c.territories.find((x) => x.owner === 1)!;
    t.ground = { gone: [5], left: [] };
    const cfg = attack(c, t.id, 'field');
    expect(cfg.ground).toBeUndefined();
    finishBattle(c, true, {}, { ground: { gone: [1, 2, 3], left: [] } });
    expect(t.ground).toEqual({ gone: [5], left: [] });
  });
});
