// Town Watch: a study taught at the Watch House, against bands and against crime (src/sim/townwatch.ts).
import { describe, expect, it } from 'vitest';
import { sentTo } from '../src/sim/calamity';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { TECHS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { intrigueSeason } from '../src/sim/intrigue';
import { hasStudy, learn, studyBar, studySeason, teacherOf } from '../src/sim/studies';
import { defenceOf } from '../src/sim/threats';
import type { Raid } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';
import { begunAt } from '../src/sim/townworks';
import { TOWNWATCH, crimeEdge, keepsWatch, watchDefence } from '../src/sim/townwatch';
import { governWatch } from '../src/sim/watchhouse';
import { run, spot, villagers } from './helpers';

const base = JSON.stringify(newCampaign(5, 2));
const world = (seed = 5): { c: Campaign; at: number; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0)!;
  for (const x of c.territories) if (x.owner >= 0) { Object.assign(folkOf(c, x.id), { men: 12, women: 12, elders: 2, children: 6 }); Object.assign(folkOf(c, x.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 }); }
  for (const f of c.factions) f.age = 1;
  return { c, at: t.id, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id };
};
const stand = (c: Campaign, at: number): void => { const t = c.territories[at]; t.town ??= { at: 2, b: [['towncenter', 40, 40]] }; t.town.b.push(['watchhouse', 46, 40]); };

describe('Town Watch', () => {
  it('is a study of the nation\'s, taught where a Watch House stands', () => {
    const { c, at } = world();
    expect(TECHS.townwatch.answers).toBe('crime');
    expect(teacherOf('townwatch')).toBe('watchhouse');
    expect(studyBar(c, 0, 'townwatch', at)).toContain('Watch House');
    stand(c, at);
    expect(studyBar(c, 0, 'townwatch', at)).toBe('');
    expect(learn(c, 0, 'townwatch', at)).toBe('');
    expect(hasStudy(c, 0, 'townwatch')).toBe(true);
  });
  it('makes a town with a Watch House stand a company stronger against a band, and no other', () => {
    const { c, at } = world(), other = c.territories.find((t) => t.owner === 0 && t.id !== at)?.id;
    const bare = defenceOf(c, at).works;
    stand(c, at);
    expect(defenceOf(c, at).works).toBe(bare); // a Watch House alone is not a town watch
    expect(keepsWatch(c, at)).toBe(false);
    c.factions[0].studies = ['townwatch'];
    expect(keepsWatch(c, at)).toBe(true);
    expect(watchDefence(c, at)).toBe(TOWNWATCH.defence);
    expect(defenceOf(c, at).works).toBe(bare + TOWNWATCH.defence);
    expect(defenceOf(c, at).total).toBeGreaterThan(0);
    if (other !== undefined) expect(watchDefence(c, other)).toBe(0); // the study without the house
  });
  it('means fewer thieves and killers begin among the people', () => {
    const begun = (study: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { c } = world(seed);
        if (study) c.factions[0].studies = ['townwatch'];
        for (let i = 0; i < 60; i++) {
          c.turn++; intrigueSeason(c);
          for (const x of c.intrigues ?? []) if (!x.ended) { x.ended = { turn: c.turn - 50, how: 'unfound', text: '' }; if (x.kind === 'thief' || x.kind === 'killer') n++; }
        }
      }
      return n;
    };
    expect(crimeEdge(world().c, 0)).toBe(1);
    const without = begun(false), withIt = begun(true);
    expect(withIt).toBeLessThan(without * 0.9);
    expect(withIt).toBeGreaterThan(0);
  });
  it('in a town, the people turn out to a fire with no Watch House standing', () => {
    const fire = (study: boolean): number => {
      const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', bonus: study ? { studies: ['townwatch'] } : {} }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
      g.weatherT = 1e6;
      const at = spot(g, 'house', 0), h = g.spawnBuilding('house', 0, at.cx, at.cy, true);
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
  it('a rival whose town a band has struck begins a Watch House there, and learns the study when raids press on it', () => {
    const { c, rival } = world();
    const t = c.territories.find((x) => x.owner === rival)!;
    expect(governWatch(c)).toEqual([]); // no cause
    const raid = { turn: c.turn, band: 1, kind: 'raiders', name: 'the Test Men', at: t.id, owner: rival, outcome: 'raided' } as unknown as Raid;
    c.raids = [raid];
    t.buildings = [...new Set([...t.buildings, 'fortress'])]; // its wall is up: the Watch House comes after
    expect(governWatch(c)).toEqual([t.id]);
    expect(begunAt(c, t.id, 'watchhouse')).toBe(true);
    // The player's own governor does not take a raid for cause: for the player it answers thieves and killers.
    const mine = world(); mine.c.raids = [{ ...raid, at: mine.at, owner: 0 }];
    expect(governWatch(mine.c)).toEqual([]);
    // Once it stands, and a raid presses, the rival learns Town Watch.
    t.town!.b = t.town!.b.filter((x) => x[0] !== 'watchhouse'); stand(c, t.id);
    (c.events ??= []).push({ kind: 'raid', at: t.id, turn: c.turn, until: c.turn });
    expect(studySeason(c, rival)).toBe('townwatch');
    expect(keepsWatch(c, t.id)).toBe(true);
  });
});
