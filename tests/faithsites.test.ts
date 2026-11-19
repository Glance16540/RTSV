// A Church or a Tavern built in a town is raised as the map's site, which moves the town's faith (src/sim/faithsites.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { SITE_BUILDING, slots } from '../src/sim/campaignbase';
import { tavernPull } from '../src/sim/churchtavern';
import { FAITH_SITES, raiseFaithSites } from '../src/sim/faithsites';
import { Game } from '../src/sim/game';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { spot } from './helpers';

const world = (): { c: Campaign; home: number } => {
  const c = newCampaign(3);
  const home = c.territories.find((t) => t.owner === 0)!.id;
  c.territories[home].buildings = [];
  return { c, home };
};

describe('a Church or a Tavern built in a town', () => {
  it('is raised as the map\'s site where a finished one stands, once, and said in the log', () => {
    const { c, home } = world(), land = c.territories[home];
    expect(raiseFaithSites(c, home, [['towncenter', 40, 40], ['temple', 46, 40]], 'in the fighting')).toEqual(['church']);
    expect(land.buildings).toEqual(['church']);
    expect(c.log[c.log.length - 1]).toBe(`The Church you built in the fighting stands in ${land.name}.`);
    expect(raiseFaithSites(c, home, [['temple', 46, 40], ['temple', 50, 40]], 'in the fighting')).toEqual([]); // it has one
    expect(land.buildings).toEqual(['church']);
    expect(raiseFaithSites(c, home, [['tavern', 30, 40, 0.5]], 'on your visit')).toEqual(['tavern']); // damaged, but finished
    expect(land.buildings).toEqual(['church', 'tavern']);
    expect(tavernPull(c, home)).toBeGreaterThan(0); // and it pulls on the town as a Tavern does
  });
  it('is not raised from one never finished, nor where the land has no room, nor from anything else', () => {
    const { c, home } = world(), land = c.territories[home];
    expect(raiseFaithSites(c, home, [['temple', 46, 40, 0.01, 0.4], ['house', 30, 30], ['barracks', 20, 20]], 'in the fighting')).toEqual([]);
    expect(land.buildings).toEqual([]);
    land.buildings = Array.from({ length: slots(land) }, () => 'farm');
    expect(raiseFaithSites(c, home, [['temple', 46, 40], ['tavern', 30, 40]], 'in the fighting')).toEqual([]);
    expect(land.buildings).not.toContain('church');
    expect(raiseFaithSites(c, 9999, [['temple', 46, 40]], 'in the fighting')).toEqual([]); // no such land
  });
  it('is a table of its own: the sites laid as buildings when a battle begins are as they were', () => {
    expect(FAITH_SITES).toEqual({ church: 'temple', tavern: 'tavern' });
    expect(SITE_BUILDING.church).toBeUndefined();
    expect(SITE_BUILDING.tavern).toBeUndefined();
  });
  it('a church built on a visit stands on the map when the player leaves', () => {
    const { c, home } = world();
    expect(beginVisit(c, home)).toBe(true);
    const cfg = visitConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const at = spot(g, 'temple', 0);
    g.spawnBuilding('temple', 0, at.cx, at.cy, true);
    expect(finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: 200 })).toBe(true);
    const land = c.territories[home];
    expect(land.buildings).toContain('church');
    expect(land.town!.b.some((x) => x[0] === 'temple')).toBe(true); // and on the town's record still
    expect(c.log.some((l) => l === `The Church you built on your visit stands in ${land.name}.`)).toBe(true);
  });
});
