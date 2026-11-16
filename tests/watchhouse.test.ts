// The Watch House: on the map it answers the thief and the killer, in a town it raises the town to a fire (src/sim/watchhouse.ts).
import { describe, expect, it } from 'vitest';
import { sentTo } from '../src/sim/calamity';
import { Campaign, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { BUILDINGS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { beginKiller, beginThief, intrigueSeason } from '../src/sim/intrigue';
import { nationStores } from '../src/sim/township';
import { folkOf } from '../src/sim/township';
import { worksOf } from '../src/sim/townworks';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { WATCH, canRaiseWatch, governWatch, hasWatchHouse, raiseWatch, watchBar, watchEdge } from '../src/sim/watchhouse';
import { run, spot, villagers } from './helpers';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign with one roomy, well-found town of the player's, and that town. */
const world = (seed = 5): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 12, women: 12, elders: 2, children: 6 });
  Object.assign(folkOf(c, t.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
  return { c, at: t.id };
};
const season = (c: Campaign): void => { c.turn++; intrigueSeason(c); };
/** A nation with nothing in store: its governors can raise nothing, so a town has a Watch House only if the test gave it one. */
const penniless = (c: Campaign): void => { c.factions[0].supplies = 0; for (const t of c.territories) if (t.owner === 0) Object.assign(folkOf(c, t.id).stores, { wood: 0, gold: 0, stone: 0 }); };
const goods = (c: Campaign): number => { const s = nationStores(c, 0); return s.food + s.wood + s.gold + s.stone; };

describe('a Watch House on the map', () => {
  it('is raised for its price in a town with the people to man it, once, and takes none of the land\'s places', () => {
    const { c, at } = world(), t = c.territories[at], had = goods(c), works = [...t.buildings];
    expect(hasWatchHouse(c, at)).toBe(false);
    expect(watchEdge(c, at)).toEqual({ thief: 0, clue: 0, strike: 1 });
    expect(raiseWatch(c, 0, at)).toBe(true);
    expect(hasWatchHouse(c, at)).toBe(true);
    expect(t.watchHouse).toBe(c.turn);
    expect(goods(c)).toBeLessThan(had);
    expect(t.buildings).toEqual(works); // outside the three or four
    expect(watchBar(c, 0, at)).toBe('It has one.');
    expect(raiseWatch(c, 0, at)).toBe(false);
    const small = world(); Object.assign(folkOf(small.c, small.at), { men: 2, women: 2, elders: 0 });
    expect(watchBar(small.c, 0, small.at)).toContain('grown people');
    const poor = world(); poor.c.factions[0].supplies = 0;
    for (const x of poor.c.territories) if (x.owner === 0) Object.assign(folkOf(poor.c, x.id).stores, { food: 0, wood: 0, gold: 0, stone: 0 });
    expect(canRaiseWatch(poor.c, 0, poor.at)).toBe(false);
    const theirs = world(), other = theirs.c.territories.find((x) => x.owner > 0)!;
    expect(watchBar(theirs.c, 0, other.id)).toBe('It is not your town.');
    expect(JSON.parse(JSON.stringify(c.territories[at])).watchHouse).toBe(c.turn); // plain data
  });
  it('takes a thief sooner, with a watch set on the houses or without', () => {
    const taken = (house: boolean, seasons: number): number => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const { c, at } = world(seed);
        penniless(c);
        if (house) c.territories[at].watchHouse = 1;
        const x = beginThief(c, at);
        for (let i = 0; i < seasons && x.caught === undefined && !x.ended; i++) season(c);
        if (x.caught !== undefined) n++;
      }
      return n;
    };
    expect(taken(true, 3)).toBeGreaterThan(taken(false, 3) + 10);
  });
  it('finds a killer\'s clues faster, and fewer die meanwhile', () => {
    const run4 = (house: boolean): { clues: number; dead: number } => {
      const sum = { clues: 0, dead: 0 };
      for (let seed = 1; seed <= 60; seed++) {
        const { c, at } = world(seed);
        penniless(c);
        if (house) c.territories[at].watchHouse = 1;
        const x = beginKiller(c, at);
        c.factions[0].heroAlive = false; // no court in the town: the watch alone
        c.armies = [];
        for (let i = 0; i < 3 && !x.ended; i++) season(c);
        sum.clues += x.clues.length; sum.dead += x.victims.length;
      }
      return sum;
    };
    const bare = run4(false), kept = run4(true);
    expect(kept.clues).toBeGreaterThan(bare.clues + 10);
    expect(kept.dead).toBeLessThan(bare.dead);
  });
  it('is raised by the town\'s governor once the town has had cause, and not before', () => {
    const quiet = world();
    expect(governWatch(quiet.c)).toEqual([]); // nothing has happened there
    const { c, at } = world(), x = beginThief(c, at);
    expect(governWatch(c)).toEqual([]); // not in its first season
    for (let i = 0; i < WATCH.after; i++) { c.turn++; }
    expect(governWatch(c)).toEqual([at]);
    expect(hasWatchHouse(c, at)).toBe(true);
    expect(c.log.at(-1)).toContain('governor');
    expect(governWatch(c)).toEqual([]); // once
    expect(x.ended).toBeUndefined();
    const poor = world(); beginKiller(poor.c, poor.at); poor.c.turn += 3; poor.c.factions[0].supplies = 0;
    for (const t of poor.c.territories) if (t.owner === 0) Object.assign(folkOf(poor.c, t.id).stores, { food: 0, wood: 0, gold: 0, stone: 0 });
    expect(governWatch(poor.c)).toEqual([]); // it cannot pay
  });
});

describe('a Watch House in the town', () => {
  it('stands when a battle or a visit is laid out for a town that has one on the map', () => {
    const { c, at } = world();
    expect(worksOf(c, at)).toEqual([]);
    raiseWatch(c, 0, at);
    expect(worksOf(c, at)).toEqual(['watchhouse']);
    expect(beginVisit(c, at)).toBe(true);
    const cfg = visitConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    expect(g.buildings.some((b) => b.type === 'watchhouse' && b.owner === 0 && b.complete)).toBe(true);
    // And for a siege: the defender's works include it.
    const w = world(), rival = w.c.factions.find((f) => f.id > 0)!.id;
    raiseWatch(w.c, 0, w.at);
    const from = w.c.territories[w.at].adj[0];
    w.c.territories[from].owner = rival;
    w.c.armies.push({ id: 990, owner: rival, at: from, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
    w.c.phase = 'ai';
    expect(moveArmy(w.c, 990, w.at)).toBe('battle');
    w.c.pending!.mode = 'siege';
    const siege = battleConfig(w.c)!;
    expect(siege.setups.some((s) => s.bonus?.buildings?.includes('watchhouse'))).toBe(true);
  });
  it('built in the town, it is on the town\'s record and counts on the map', () => {
    const { c, at } = world();
    c.territories[at].town = { at: 2, b: [['towncenter', 40, 40], ['watchhouse', 46, 40]] };
    expect(hasWatchHouse(c, at)).toBe(true);
    expect(watchEdge(c, at).thief).toBe(WATCH.thief);
    c.territories[at].town = { at: 2, b: [['towncenter', 40, 40], ['watchhouse', 46, 40, 0.01, 0.4]] }; // begun, never finished
    expect(hasWatchHouse(c, at)).toBe(false);
  });
  it('can be built by villagers, and the watch calls them off their work to a fire', () => {
    expect(BUILDINGS.watchhouse.cost).toBeTruthy();
    const fire = (watch: boolean): number => {
      const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
      g.weatherT = 1e6;
      const at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
      if (watch) { const w = spot(g, 'watchhouse', 0); g.spawnBuilding('watchhouse', 0, w.cx, w.cy, true); }
      // Everyone is at work some way off: nobody is idle to turn out of their own accord.
      const tree = g.resources.find((r) => r.type === 'tree') ?? g.resources[0];
      g.cmdTarget(0, villagers(g, 0).map((u) => u.id), tree.id);
      run(g, 3);
      h.burnT = 30; h.hp -= 1;
      run(g, 2);
      return sentTo(g, h);
    };
    expect(fire(false)).toBe(0);
    expect(fire(true)).toBeGreaterThan(0);
  });
});
