// A visit to a town of your own from the campaign map: when it is allowed, what the town is, and what comes home.
import { describe, expect, it } from 'vitest';
import { endTurn, newCampaign, continueAI } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { VISIT_SECONDS, beginVisit, canVisit, finishVisit, visitBar, visitConfig } from '../src/sim/visit';
import { primerPage } from '../src/sim/primer';
import { run, spot } from './helpers';

const world = (): { c: Campaign; home: number; foreign: number } => {
  const c = newCampaign(3);
  return { c, home: c.territories.find((t) => t.owner === 0)!.id, foreign: c.territories.find((t) => t.owner !== 0)!.id };
};
const play = (c: Campaign): Game => {
  const cfg = visitConfig(c)!;
  return new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
};

describe('a visit', () => {
  it('is to a town of your own, in your own turn, with nothing else waiting', () => {
    const { c, home, foreign } = world();
    expect(canVisit(c, home)).toBe(true);
    expect(visitBar(c, foreign)).toMatch(/your own/);
    c.phase = 'ai';
    expect(canVisit(c, home)).toBe(false);
    c.phase = 'player';
    c.demand = { from: 1, amount: 2 };
    expect(canVisit(c, home)).toBe(false);
    c.demand = null;
    c.territories[home].horde = true;
    expect(canVisit(c, home)).toBe(false);
    expect(beginVisit(c, home)).toBe(false);
    expect(visitConfig(c)).toBeNull();
  });

  it('is a town with the player alone in it, in the nation\'s age, and nobody wins or loses there', () => {
    const { c, home } = world();
    c.factions[0].age = 2;
    expect(beginVisit(c, home)).toBe(true);
    const cfg = visitConfig(c)!;
    expect(cfg.setups.length).toBe(1);
    expect(cfg.setups[0].isAI).toBe(false);
    expect(cfg.title).toContain(c.territories[home].name);
    const g = play(c);
    expect(g.players[0].age).toBe(2);
    expect(g.buildings.some((b) => b.owner === 0 && b.type === 'towncenter')).toBe(true);
    run(g, 30);
    expect(g.winner).toBe(-1);
    expect(g.players[0].defeated).toBe(false);
    expect(g.units.some((u) => u.owner === 0)).toBe(true);
  });

  it('leaves what was built standing on the map, and is there again at the next visit', () => {
    const { c, home } = world();
    beginVisit(c, home);
    const g = play(c);
    const at = spot(g, 'barracks', 0);
    g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
    expect(finishVisit(c, { town: g.standing(0), ground: g.ground(), virtue: g.players[0].virtue, seconds: 200 })).toBe(true);
    const land = c.territories[home];
    expect(c.visit).toBeNull();
    expect(land.town!.b.some((b) => b[0] === 'barracks' && b[1] === at.cx && b[2] === at.cy)).toBe(true);
    expect(land.buildings).toContain('barracks');
    expect(c.log[c.log.length - 1]).toContain('3 minutes');
    // The next season the same barracks stands where it was put.
    land.visited = undefined;
    beginVisit(c, home);
    const again = play(c);
    expect(again.buildings.some((b) => b.owner === 0 && b.type === 'barracks' && b.cx === at.cx && b.cy === at.cy)).toBe(true);
  });

  it('is once a season for each town, and any number of towns', () => {
    const { c, home } = world();
    const other = c.territories.find((t) => t.owner !== 0)!;
    other.owner = 0;
    beginVisit(c, home);
    finishVisit(c, {});
    expect(canVisit(c, home)).toBe(false);
    expect(visitBar(c, home)).toMatch(/once a season/);
    expect(canVisit(c, other.id)).toBe(true);
    endTurn(c);
    for (let i = 0; i < 400 && c.phase === 'ai' && !c.pending && !c.demand; i++) continueAI(c);
    if (c.phase === 'player' && !c.pending && !c.demand && c.territories[home].owner === 0) expect(canVisit(c, home)).toBe(true);
    expect(c.territories[home].visited).toBeLessThan(c.turn);
  });

  it('keeps the land\'s town when a visit sends nothing home, and takes in a record handed to it', () => {
    const { c, home } = world();
    c.territories[home].town = { at: 2, b: [['towncenter', 10, 10], ['house', 16, 10]] };
    beginVisit(c, home);
    const cfg = visitConfig(c, { town: [['towncenter', 10, 10]], res: 300, units: { clubman: 4 } })!;
    expect(cfg.setups[0].bonus!.town!.length).toBe(1);
    expect(cfg.setups[0].bonus!.units).toEqual({ clubman: 4 });
    expect(cfg.setups[0].bonus!.res).toBeGreaterThanOrEqual(300);
    finishVisit(c, { town: [] });
    expect(c.territories[home].town!.b.length).toBe(2);
  });

  it('is told of on the campaign\'s page, with the length the rule gives', () => {
    const text = JSON.stringify(primerPage());
    expect(text).toContain(`${VISIT_SECONDS / 60} minutes of the season`);
  });
});
