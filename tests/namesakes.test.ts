// A visit's soldiers bear the roll's names (soldiernames.ts via visit.ts), and a town's people go by different given
// names where the town can (src/sim/namesakes.ts).
import { describe, expect, it } from 'vitest';
import { armyAt, newCampaign } from '../src/sim/campaign';
import { NAMES_M } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { pickName } from '../src/sim/namesakes';
import { rollOf } from '../src/sim/soldiernames';
import { beginVisit, visitConfig } from '../src/sim/visit';

function visit() {
  const c = newCampaign(4, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  expect(beginVisit(c, home.id)).toBe(true);
  const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
  return { c, home, g };
}

describe('a visit\'s soldiers', () => {
  it('are led by the men of the army\'s roll by name, as in a battle', () => {
    const { c, home, g } = visit();
    const army = armyAt(c, home.id)!;
    const roll = rollOf(c, army.id).map((m) => `${m.name} ${m.family}`).sort();
    expect(roll.length).toBeGreaterThan(0);
    expect(g.units.filter((u) => u.owner === 0 && u.roll).map((u) => `${u.name} ${u.family}`).sort()).toEqual(roll);
  });
});

describe('namesakes', () => {
  it('the lot draws a name nobody has, where one is left', () => {
    expect(pickName(NAMES_M, 0, new Set())).toBe(NAMES_M[0]);
    expect(pickName(NAMES_M, 0, new Set([NAMES_M[0], NAMES_M[1]]))).toBe(NAMES_M[2]);
    expect(pickName(NAMES_M, 0.99, new Set(NAMES_M))).toBe(NAMES_M[NAMES_M.length - 1]); // all taken: the lot's own
  });

  it('a town of thirty has no two villagers of a sex under one given name, nor one under a soldier\'s', () => {
    const { g } = visit();
    const soldiers = new Set(g.units.filter((u) => u.owner === 0 && u.roll).map((u) => u.name));
    for (const sex of ['m', 'f'] as const) {
      const folk = g.units.filter((u) => u.owner === 0 && u.type === 'villager' && u.gender === sex);
      // As many different names as there are people, or as the twenty a sex allow (the soldiers' among them, for the men).
      const room = 20 - (sex === 'm' ? soldiers.size : 0);
      expect(new Set(folk.map((u) => u.name)).size).toBeGreaterThanOrEqual(Math.min(folk.length, room));
      if (sex === 'm' && folk.length <= room) for (const u of folk) expect(soldiers.has(u.name)).toBe(false);
    }
    expect(g.units.some((u) => u.drawn !== undefined)).toBe(false); // nothing of the laying out is kept
  });

  it('a name from a record is never changed', () => {
    const { c, home } = visit();
    const f = c.territories[home.id].folk!;
    f.notables.push({ name: 'Ned', gender: 'f', kind: 'mother', kids: 4, deed: 'raised four', turn: 0 } as never);
    const cfg = visitConfig(c)!, g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(g.units.some((u) => u.owner === 0 && u.type === 'villager' && u.name === 'Ned' && u.gender === 'f')).toBe(true);
  });
});
