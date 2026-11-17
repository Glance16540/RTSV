// The Watch House: on the map it answers the thief and the killer, in a town it raises the town to a fire (src/sim/watchhouse.ts).
import { describe, expect, it } from 'vitest';
import { sentTo } from '../src/sim/calamity';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { BUILDINGS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { beginKiller, beginThief, intrigueSeason } from '../src/sim/intrigue';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';
import { begunAt, mapWorks, raiseBar, raiseWork } from '../src/sim/townworks';
import { WATCH, governWatch, hasWatchHouse, watchEdge } from '../src/sim/watchhouse';
import { run, spot, villagers } from './helpers';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign with one roomy, well-found town of the player's, on record, and that town. */
const world = (seed = 5): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 12 * S, women: 12 * S, elders: 2 * S, children: 6 * S }); // a town of that size as towns now are (township.ts TOWN_SCALE)
  Object.assign(folkOf(c, t.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
  c.factions[0].age = 1; // the Bronze Age, which a Watch House needs
  return { c, at: t.id };
};
const season = (c: Campaign): void => { c.turn++; intrigueSeason(c); };
/** A town with nothing in store: nothing can be begun there, so it has a Watch House only if the test stood one. */
const penniless = (c: Campaign, at: number): void => { Object.assign(folkOf(c, at).stores, { wood: 0, gold: 0, stone: 0 }); };
/** Stand a finished Watch House on the town's record. */
const stand = (c: Campaign, at: number): void => { const t = c.territories[at]; t.town ??= { at: 2, b: [['towncenter', 40, 40]] }; t.town.b.push(['watchhouse', 46, 40]); };

describe('a Watch House on the map', () => {
  it('is one of the buildings raised on a town\'s record: begun from the town\'s stores, and it keeps no watch until it is finished', () => {
    const { c, at } = world(), wood = folkOf(c, at).stores.wood;
    expect(mapWorks()).toContain('watchhouse');
    expect(raiseBar(c, 0, at, 'watchhouse')).toBe('');
    expect(raiseWork(c, 0, at, 'watchhouse')).toBe('');
    expect(folkOf(c, at).stores.wood).toBe(wood - BUILDINGS.watchhouse.cost.wood!);
    expect(begunAt(c, at, 'watchhouse')).toBe(true);
    expect(hasWatchHouse(c, at)).toBe(false); // begun, not finished
    expect(watchEdge(c, at)).toEqual({ thief: 0, clue: 0, strike: 1 });
    expect(raiseWork(c, 0, at, 'watchhouse')).not.toBe(''); // once
    const done = world(); stand(done.c, done.at);
    expect(hasWatchHouse(done.c, done.at)).toBe(true);
    expect(watchEdge(done.c, done.at)).toEqual({ thief: WATCH.thief, clue: WATCH.clue, strike: WATCH.strike });
    done.c.territories[done.at].town!.b = [['towncenter', 40, 40], ['watchhouse', 46, 40, 0.01, 0.4]]; // never finished
    expect(hasWatchHouse(done.c, done.at)).toBe(false);
  });
  it('takes a thief sooner, with a watch set on the houses or without', () => {
    const taken = (house: boolean, seasons: number): number => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const { c, at } = world(seed);
        if (house) stand(c, at);
        const x = beginThief(c, at);
        penniless(c, at); // so that no governor begins one meanwhile
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
        if (house) stand(c, at);
        penniless(c, at);
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
  it('is begun by the town\'s governor once the town has had cause, and not before', () => {
    const quiet = world();
    expect(governWatch(quiet.c)).toEqual([]); // nothing has happened there
    const { c, at } = world(), x = beginThief(c, at);
    expect(governWatch(c)).toEqual([]); // not in the story's first season
    c.turn += WATCH.after;
    expect(governWatch(c)).toEqual([at]);
    expect(begunAt(c, at, 'watchhouse')).toBe(true);
    expect(c.log.at(-1)).toContain('governor');
    expect(c.log.filter((l) => l.includes('Watch House'))).toHaveLength(1); // told once, in the governor's words
    expect(governWatch(c)).toEqual([]); // once
    expect(x.ended).toBeUndefined();
    const poor = world(); beginKiller(poor.c, poor.at); poor.c.turn += 3; penniless(poor.c, poor.at);
    expect(governWatch(poor.c)).toEqual([]); // it cannot pay
    expect(JSON.parse(JSON.stringify(c.territories[at].town))).toEqual(c.territories[at].town); // plain data
  });
});

describe('a Watch House in the town', () => {
  it('can be built by villagers, and the watch calls them off their work to a fire', () => {
    expect(BUILDINGS.watchhouse.onMap).toBe(true);
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
