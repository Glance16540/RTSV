// A road laid by hand in a siege is kept on the town's record, as a visit's roads are (src/sim/handroads.ts, campaign.ts finishBattle).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { Campaign, battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { cmdLayRoad, handRoadsOut, roadBar, roadLine } from '../src/sim/handroads';
import { run } from './helpers';

/** A campaign in which a rival's army has come against the player's capital: the pending siege, and the town. */
const besieged = (seed = 3): { c: Campaign; at: number } => {
  const c = newCampaign(seed, 1);
  const home = c.territories.find((t) => t.capital === 0)!;
  c.armies.push({ id: 99, owner: 1, at: home.adj[0], units: { infantry: 2 }, hero: false, vet: 0, moved: false });
  c.territories[home.adj[0]].owner = 1;
  c.phase = 'ai';
  expect(moveArmy(c, 99, home.id)).toBe('battle');
  c.pending!.mode = 'siege';
  return { c, at: home.id };
};
const field = (c: Campaign): Game => { const cfg = battleConfig(c)!; return new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? ''); };
/** A straight run of five open tiles near the player's town centre. */
const someRoad = (g: Game): [number, number][] => {
  const tc = g.buildings.find((b) => b.type === 'towncenter' && b.owner === 0)!;
  for (let y = tc.cy - 10; y < tc.cy + 12; y++) for (let x = tc.cx - 10; x < tc.cx + 12; x++) { const t = roadLine(x, y, x + 4, y); if (t.every(([a, b]) => !roadBar(g, 0, a, b))) return t; }
  throw new Error('no open run of tiles');
};

describe('a road laid by hand in a siege', () => {
  it('is kept on the town\'s record when the town is held, and laid again the next time the town is fought for', () => {
    const { c, at } = besieged();
    const g = field(c);
    run(g, 1);
    const tiles = someRoad(g);
    expect(cmdLayRoad(g, 0, tiles)).toBe(5);
    finishBattle(c, true, {}, { town: g.standing(0), roads: handRoadsOut(g, 0) });
    expect(c.territories[at].owner).toBe(0);
    expect(c.territories[at].town!.roads).toEqual(tiles);
    // Besieged again: the town comes to the field with them.
    c.pending = null; c.phase = 'ai';
    const near = c.territories[at].adj[0];
    c.armies = c.armies.filter((a) => a.id !== 99);
    c.armies.push({ id: 98, owner: 1, at: near, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    c.territories[near].owner = 1;
    expect(moveArmy(c, 98, at)).toBe('battle');
    c.pending!.mode = 'siege';
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].bonus!.roads).toEqual(tiles);
    const again = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    run(again, 3);
    expect(handRoadsOut(again, 0)).toEqual(tiles);
  });
  it('is not kept when the town is lost', () => {
    const { c, at } = besieged();
    const g = field(c);
    run(g, 1);
    cmdLayRoad(g, 0, someRoad(g));
    finishBattle(c, false, {}, { town: g.standing(1), roads: handRoadsOut(g, 0) });
    expect(c.territories[at].owner).toBe(1);
    expect(c.territories[at].town?.roads).toBeUndefined();
  });
  it('a town held with no road laid keeps none, and one held with no word of roads loses none it had', () => {
    const { c, at } = besieged();
    const g = field(c);
    run(g, 1);
    finishBattle(c, true, {}, { town: g.standing(0), roads: handRoadsOut(g, 0) });
    expect(c.territories[at].town!.roads).toBeUndefined();
  });
  it('a field battle keeps nothing: it is fought on other ground', () => {
    const { c, at } = besieged();
    c.pending!.mode = 'field';
    const before = c.territories[at].town?.roads;
    finishBattle(c, true, {}, { roads: [[5, 5], [6, 5]] });
    expect(c.territories[at].town?.roads).toEqual(before);
  });
});
