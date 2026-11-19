// A reserve's camp has no people from nowhere (src/sim/reservecamp.ts): the army next door that joins a campaign siege
// comes with its soldiers and its camp's hall, and no villagers; having none, it has not died out.
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { diedOut } from '../src/sim/dyingout';
import { reserving } from '../src/sim/reservecamp';
import { run } from './helpers';

function withReserve(): Game {
  const c = newCampaign(7);
  c.fronts = [];
  const home = c.territories.find((t) => t.capital === 0)!;
  const army = armyAt(c, home.id)!;
  const target = c.territories[home.adj[0]];
  const side = c.territories.find((t) => t.id !== home.id && t.adj.includes(target.id))!;
  side.owner = 0;
  c.armies.push({ id: 50, owner: 0, at: side.id, units: { archers: 4 }, hero: false, vet: 0, moved: false });
  moveArmy(c, army.id, target.id);
  const cfg = battleConfig(c)!;
  expect(cfg.setups[2].reserve).toBe(true);
  expect(cfg.setups[0].reserve).toBeUndefined();
  expect(cfg.setups[1].reserve).toBeUndefined();
  const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  g.fixedAge = true; g.bornOnly = true;
  return g;
}
const villagers = (g: Game, pid: number) => g.units.filter((u) => u.owner === pid && !u.dead && u.type === 'villager').length;

describe('a reserve\'s camp', () => {
  it('comes with its soldiers and no villagers; the besieger and the town are as they were', () => {
    const g = withReserve();
    expect(reserving(g, 2)).toBe(true);
    expect(villagers(g, 2)).toBe(0);
    expect(g.units.filter((u) => u.owner === 2 && u.type === 'slinger').length).toBe(8);
    expect(villagers(g, 0)).toBe(0); // the player besieges: its camp has none either (siegecamp.ts)
    expect(villagers(g, 1)).toBeGreaterThan(0); // the town has its own people
  });

  it('having no villagers it has not died out: its soldiers fight on', () => {
    const g = withReserve();
    run(g, 5);
    expect(diedOut(g, 2)).toBe(false);
    expect(g.players[2].defeated).toBeFalsy();
  });
});
