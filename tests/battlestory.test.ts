// The stories inside the story in a battle for the player's own town (src/sim/battlestory.ts): a thief, a killer and a
// plot come onto the field as in a visit; a rival's envoy and a suitor do not; what came of them comes home if the town held.
import { describe, expect, it } from 'vitest';
import { Campaign, battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { beginKiller, beginThief } from '../src/sim/intrigue';
import { beginPlot, beginRival, beginSuitor } from '../src/sim/courtstory';
import { BATTLE_COURT, ownTownBattle, storiesForBattle, storiesFromBattle } from '../src/sim/battlestory';
import { cmdAccuse } from '../src/sim/fieldaccuse';
import { storyOut } from '../src/sim/fieldstory';
import { courtOut } from '../src/sim/courtfield';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { kinOf } from '../src/sim/kin';
import { folkOf } from '../src/sim/township';
import { run } from './helpers';

/** A campaign with a court of six nobles at the capital, a grown daughter, and a rival people next door. */
function world(): { c: Campaign; home: number; rival: number } {
  const c = newCampaign(5, 2);
  c.turn = 20; c.phase = 'player';
  const home = c.territories.find((t) => t.capital === 0)!;
  for (const t of c.territories) if (t.owner === 0) Object.assign(folkOf(c, t.id), { men: 16, women: 16, elders: 2, children: 6 });
  Object.assign(folkOf(c, home.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
  kinOf(c, 0);
  houseOf(c, 0).heirs = [{ name: 'Elin', female: true, born: c.turn - HEIR_AGE - 8 }];
  c.factions[0].nobles = ['Aldric', 'Bram', 'Cyra', 'Dunn'].map((name, i) => ({ key: `lord:${90 + i}:0`, name, female: name === 'Cyra', town: home.id, rank: 'lord' as const, leaning: 'martial' as const, mood: i === 2 ? -70 : 0 }));
  return { c, home: home.id, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id };
}
/** The rival's army marched on the player's town: a siege to be fought in person. */
function besieged(c: Campaign, home: number, rival: number, mode: 'siege' | 'field' = 'siege') {
  const t = c.territories[home], next = c.territories[t.adj[0]];
  next.owner = rival;
  c.armies.push({ id: 99, owner: rival, at: next.id, units: { infantry: 6, archers: 3 }, hero: false, vet: 0, moved: false });
  c.phase = 'ai';
  expect(moveArmy(c, 99, home)).toBe('battle');
  c.pending!.mode = mode;
  return c.pending!;
}

describe('stories in a battle for the player\'s own town', () => {
  it('a thief, a killer and a plot come in; a rival\'s envoy and a suitor are left out; none in any other battle', () => {
    const { c, home, rival } = world();
    const killer = beginKiller(c, home);
    beginRival(c, rival); beginSuitor(c, rival);
    const plot = beginPlot(c, 'lord:92:0')!;
    const p = besieged(c, home, rival);
    expect(ownTownBattle(c, p)).toBe(true);
    const cfg = battleConfig(c)!;
    const bonus = cfg.setups[0].bonus!;
    expect(bonus.story).toMatchObject({ id: killer.id, kind: 'killer' });
    expect(bonus.court).toMatchObject({ id: plot.id, kind: 'plot' });
    expect(bonus.court!.also ?? []).toEqual([]);
    expect(BATTLE_COURT).toEqual(['plot']);
    // In the open, or the player attacking, or a rival's own town: nothing.
    expect(storiesForBattle(c, { ...p, mode: 'field' })).toEqual({});
    expect(storiesForBattle(c, { ...p, attacker: 0, defender: rival })).toEqual({});
    const theirs = c.territories.find((t) => t.owner === rival)!.id;
    expect(storiesForBattle(c, { ...p, to: theirs })).toEqual({});
  });

  it('a thief comes in as in a visit', () => {
    const { c, home, rival } = world();
    const it = beginThief(c, home); it.robbed = it.people.map((_, i) => (i < 2 ? 1 : 0));
    besieged(c, home, rival);
    expect(battleConfig(c)!.setups[0].bonus!.story).toMatchObject({ id: it.id, kind: 'thief' });
  });

  it('a killer seized in the battle is held for judgement if the town held, and nothing comes home if it fell', () => {
    for (const held of [true, false]) {
      const { c, home, rival } = world();
      const it = beginKiller(c, home);
      besieged(c, home, rival);
      const cfg = battleConfig(c)!;
      const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
      run(g, 1);
      const u = g.units.find((x) => x.owner === 0 && x.suspect === it.culprit)!;
      expect(u).toBeTruthy();
      g.spawnUnit('clubman', 0, u.x + 1, u.y);
      expect(cmdAccuse(g, 0, u.id)).toBe(true);
      finishBattle(c, held, undefined, { story: storyOut(g, 0), court: courtOut(g, 0) });
      if (held) expect(it.held).toBe(it.culprit);
      else expect(it.held).toBeUndefined();
    }
  }, 120_000);

  it('writes back by the map\'s own rules only for the town held', () => {
    const { c, home, rival } = world();
    const it = beginKiller(c, home);
    const p = besieged(c, home, rival);
    expect(storiesFromBattle(c, p, false, { story: { id: it.id, cleared: [], seized: it.culprit } })).toBe(false);
    expect(storiesFromBattle(c, { ...p, mode: 'field' }, true, { story: { id: it.id, cleared: [], seized: it.culprit } })).toBe(false);
    expect(storiesFromBattle(c, p, true, { story: { id: it.id, cleared: [], seized: it.culprit } })).toBe(true);
    expect(it.held).toBe(it.culprit);
  });
});
