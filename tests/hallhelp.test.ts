// A rival's Hall of Judgement, helped by its other towns (src/sim/rule.ts, `hallSeason`): where the chief town cannot
// pay alone, the nation's other towns send it what it lacks, each keeping two floors of its own.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { hallSeason } from '../src/sim/rule';
import { layTown } from '../src/sim/rivalrule';
import { folkOf } from '../src/sim/township';
import { PLENTY, breadless } from '../src/sim/plenty';

const world = () => {
  const c = newCampaign(5, 1, 1, 'hearth');
  for (const x of c.factions) x.age = 1;
  const chief = c.territories.find((t) => t.capital === 1)!;
  const other = c.territories[chief.adj.find((n) => c.territories[n].owner !== 0)!];
  other.owner = 1; delete other.horde;
  layTown(c, chief.id);
  for (const t of c.territories.filter((x) => x.owner === 1)) { const f = folkOf(c, t.id); f.men = 8; f.women = 8; t.buildings = [...new Set([...t.buildings, 'farm'])]; }
  return { c, chief: chief.id, other: other.id };
};

describe('a rival\'s Hall, helped by its other towns', () => {
  it('is raised in the chief town with what another town sends, and that town keeps two floors', () => {
    const { c, chief, other } = world();
    folkOf(c, chief).stores = { food: 3000, wood: 50, gold: 50, stone: 50 };
    folkOf(c, other).stores = { food: 3000, wood: 2000, gold: 2000, stone: 2000 };
    for (const t of c.territories.filter((x) => x.owner === 1 && x.id !== chief && x.id !== other)) folkOf(c, t.id).stores = { food: 3000, wood: 600, gold: 600, stone: 600 };
    expect(hallSeason(c, 1)).toBe(true);
    expect(c.territories[chief].town!.b.some((x) => x[0] === 'hall')).toBe(true);
    expect(breadless(folkOf(c, other).stores)).toBeGreaterThanOrEqual(2 * PLENTY.floor);
  });

  it('nothing is sent when the others have not enough beyond their floors', () => {
    const { c, chief, other } = world();
    folkOf(c, chief).stores = { food: 3000, wood: 50, gold: 50, stone: 50 };
    for (const t of c.territories.filter((x) => x.owner === 1 && x.id !== chief)) folkOf(c, t.id).stores = { food: 3000, wood: 250, gold: 250, stone: 250 };
    const before = JSON.stringify(folkOf(c, other).stores);
    expect(hallSeason(c, 1)).toBe(false);
    expect(JSON.stringify(folkOf(c, other).stores)).toBe(before);
  });
});
