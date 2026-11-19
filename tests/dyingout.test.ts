// A people that has died out is beaten (src/sim/dyingout.ts): with no villager and no child left a side can never
// have another person, and its soldiers hold the battle only for a while.
import { describe, expect, it } from 'vitest';
import { battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { DIE_OUT, diedOut } from '../src/sim/dyingout';
import { Game } from '../src/sim/game';
import { run, setups, villagers } from './helpers';

/** A rival's army marched on the player's capital, which has an army of its own: a campaign siege, nobody playing. */
function siege(): Game {
  const c = newCampaign(4, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const next = c.territories[home.adj[0]];
  next.owner = 1;
  c.armies = c.armies.filter((a) => a.at !== home.id);
  c.armies.push({ id: 98, owner: 0, at: home.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
  c.armies.push({ id: 99, owner: 1, at: next.id, units: { infantry: 6, archers: 1 }, hero: false, vet: 0, moved: false });
  c.phase = 'ai';
  expect(moveArmy(c, 99, home.id)).toBe('battle');
  const cfg = battleConfig(c)!;
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return g;
}
const soldiers = (g: Game, pid: number) => g.units.filter((u) => u.owner === pid && !u.dead && g.isMilitary(u));
const empty = (g: Game, pid: number) => { for (const u of villagers(g, pid).filter((u) => !u.dead)) g.perish(u); };

describe('dyingout', () => {
  it('a side with people, and the besieger (an army, not a people), have not died out', () => {
    const g = siege();
    expect(villagers(g, 0).length).toBeGreaterThan(0);
    expect(diedOut(g, 0)).toBe(false);
    empty(g, 1);
    expect(soldiers(g, 1).length).toBeGreaterThan(0);
    expect(diedOut(g, 1)).toBe(false);
  });

  it('a town with no villager or child left, its soldiers standing, is told so and beaten after the grace', () => {
    const g = siege();
    const said: { player: number; text: string }[] = [];
    const msg = g.msg.bind(g);
    g.msg = (player, text) => { said.push({ player, text }); msg(player, text); };
    empty(g, 0);
    expect(soldiers(g, 0).length).toBeGreaterThan(0);
    expect(diedOut(g, 0)).toBe(true);
    run(g, 2);
    expect(g.players[0].dieDue).toBeGreaterThan(g.time);
    expect(said.some((m) => m.player === 0 && /died out/.test(m.text))).toBe(true);
    expect(said.some((m) => m.player === 1 && /died out/.test(m.text))).toBe(true);
    expect(g.winner).toBe(-1);
    run(g, DIE_OUT.grace);
    expect(g.players[0].defeated).toBe(true);
    expect(g.winner).toBe(1);
  });

  it('a villager alive again stops the clock', () => {
    const g = siege();
    empty(g, 0);
    run(g, 2);
    expect(g.players[0].dieDue).toBeDefined();
    const s = soldiers(g, 0)[0];
    g.spawnUnit('villager', 0, s.x, s.y, 'f');
    run(g, 2);
    expect(g.players[0].dieDue).toBeUndefined();
    run(g, DIE_OUT.grace);
    expect(g.players[0].defeated).toBe(false);
  });

  it('its last soldier fallen, a town died out is beaten at once', () => {
    const g = siege();
    empty(g, 0);
    for (const u of soldiers(g, 0)) g.perish(u);
    run(g, 2);
    expect(g.players[0].defeated).toBe(true);
  });

  it('a skirmish, where villagers are bought, never dies out', () => {
    const g = new Game(5, setups);
    empty(g, 0);
    g.spawnUnit('clubman', 0, 30, 30);
    expect(diedOut(g, 0)).toBe(false);
  });
});
