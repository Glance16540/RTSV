// A story afoot in a town, on the field of a visit there (src/sim/fieldstory.ts, src/sim/storyvisit.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { beginKiller, beginThief, intrigueAt } from '../src/sim/intrigue';
import { FIELD_STORY, cmdQuestion, questionBar, storyOut } from '../src/sim/fieldstory';
import { storyForVisit, storyFromVisit } from '../src/sim/storyvisit';
import { folkOf } from '../src/sim/township';
import { run, spot } from './helpers';

const world = (): { c: Campaign; at: number } => {
  const c = newCampaign(3);
  c.turn = 20;
  const at = c.territories.find((t) => t.owner === 0)!.id;
  Object.assign(folkOf(c, at), { men: 16, women: 16, elders: 2, children: 6 });
  return { c, at };
};
const enter = (c: Campaign, at: number): Game => {
  expect(beginVisit(c, at)).toBe(true);
  const cfg = visitConfig(c)!;
  return new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
};
const thiefIn = (c: Campaign, at: number) => { const it = beginThief(c, at); it.robbed = it.people.map((_, i) => (i < 2 ? 1 + i : 0)); return it; };

describe('into the visit', () => {
  it('a town with no story afoot brings none, and a rival\'s story is not the player\'s to see', () => {
    const { c, at } = world();
    expect(beginVisit(c, at)).toBe(true);
    expect(visitConfig(c)!.setups[0].bonus!.story).toBeUndefined();
    const other = c.territories.find((t) => t.owner > 0 && t.folk)!;
    beginKiller(c, other.id);
    expect(storyForVisit(c, other.id)).toBeUndefined();
  });

  it('a thief or a killer of the player\'s comes in, the people as the map keeps them', () => {
    const { c, at } = world();
    const it = thiefIn(c, at);
    const s = storyForVisit(c, at)!;
    expect(s).toMatchObject({ id: it.id, kind: 'thief', robbed: it.robbed });
    expect(s.people.map((p) => p.name)).toEqual(it.people.map((p) => p.name));
    it.caught = c.turn; // taken already: nothing for the field
    expect(storyForVisit(c, at)).toBeUndefined();
  });
});

describe('a thief on the field', () => {
  it('the robbed houses are marked, and a soldier on guard by one takes the thief, which the map then judges', () => {
    const { c, at } = world();
    const it = thiefIn(c, at), g = enter(c, at);
    run(g, 1);
    const marked = g.buildings.filter((b) => b.robbed); // a first visit: the town not yet housed, so its works
    expect(marked).toHaveLength(2);
    expect(marked.map((b) => b.robbed).sort()).toEqual([it.people[0].family, it.people[1].family].sort());
    expect(storyOut(g, 0)).toEqual({ id: it.id, cleared: [] });
    const b = marked[0];
    g.spawnUnit('clubman', 0, b.x, b.y + b.size / 2 + 1);
    run(g, FIELD_STORY.guard - 5);
    expect(storyOut(g, 0)!.caught).toBeUndefined(); // not yet
    run(g, 10);
    expect(storyOut(g, 0)!.caught).toBe(true);
    expect(g.events.some((e) => e.t === 'msg' && /taken the thief/.test(e.text))).toBe(true);
    finishVisit(c, { story: storyOut(g, 0) });
    expect(it.caught).toBe(c.turn);
    expect(it.thief).toBeDefined();
    expect(it.ended).toBeUndefined(); // the leader judges on the map
  }, 60_000);

  it('a robbed household\'s own house is the one marked, where the town has it', () => {
    const { c, at } = world();
    const it = thiefIn(c, at), g = enter(c, at);
    const p0 = spot(g, 'house', 0), theirs = g.spawnBuilding('house', 0, p0.cx, p0.cy, true);
    theirs.family = it.people[1].family;
    const p1 = spot(g, 'house', 0), other = g.spawnBuilding('house', 0, p1.cx, p1.cy, true);
    other.family = 'Nobody';
    run(g, 1);
    expect(theirs.robbed).toBe(it.people[1].family);
    expect(other.robbed).toBe(it.people[0].family); // the other robbed household has no house of its own here
  }, 60_000);

  it('a villager standing there is no guard, and nobody is struck or killed', () => {
    const { c, at } = world();
    thiefIn(c, at);
    const g = enter(c, at);
    run(g, 1);
    const b = g.buildings.find((x) => x.robbed)!;
    g.spawnUnit('villager', 0, b.x, b.y + b.size / 2 + 1, 'm');
    const alive = g.units.filter((u) => u.owner === 0 && !u.dead).length;
    run(g, FIELD_STORY.guard + 5);
    expect(storyOut(g, 0)!.caught).toBeUndefined();
    expect(g.units.filter((u) => u.owner === 0 && !u.dead).length).toBeGreaterThanOrEqual(alive - 1);
  }, 60_000);
});

describe('a killer on the field', () => {
  it('those spoken of walk the town by name, each of their own sex, and only grown villagers', () => {
    const { c, at } = world();
    const it = beginKiller(c, at), g = enter(c, at);
    run(g, 1);
    const named = g.units.filter((u) => u.suspect !== undefined);
    expect(named.length).toBe(it.people.length);
    for (const u of named) {
      const p = it.people[u.suspect!];
      expect(u.type).toBe('villager');
      expect(u.owner).toBe(0);
      expect(`${u.name} ${u.family}`).toBe(`${p.name} ${p.family}`);
      expect(u.gender).toBe(p.gender);
    }
  }, 60_000);

  it('questioning may clear an innocent, never the guilty; once each; and the map takes the clearing with a clue', () => {
    const { c, at } = world();
    const it = beginKiller(c, at), g = enter(c, at);
    run(g, 1);
    const was = FIELD_STORY.question;
    try {
      FIELD_STORY.question = 1; // every innocent questioned is cleared
      const named = g.units.filter((u) => u.suspect !== undefined);
      const guilty = named.find((u) => u.suspect === it.culprit)!, innocent = named.find((u) => u.suspect !== it.culprit)!;
      expect(cmdQuestion(g, 0, guilty.id)).toBe(false);
      expect(questionBar(g, 0, guilty)).toMatch(/already/);
      expect(cmdQuestion(g, 0, innocent.id)).toBe(true);
      expect(questionBar(g, 0, innocent)).toMatch(/no longer/);
      expect(cmdQuestion(g, 1, innocent.id)).toBe(false); // not another side's to ask
      const out = storyOut(g, 0)!;
      expect(out.cleared).toEqual([innocent.suspect]);
      finishVisit(c, { story: out });
      expect(it.cleared).toContain(innocent.suspect);
      expect(it.cleared).not.toContain(it.culprit);
      expect(it.clues.at(-1)!.clears).toEqual([innocent.suspect]);
    } finally { FIELD_STORY.question = was; }
  }, 60_000);

  it('what comes back from the field is not believed blindly', () => {
    const { c, at } = world();
    const it = beginKiller(c, at);
    expect(storyFromVisit(c, at, null)).toBe(false);
    expect(storyFromVisit(c, at, { id: it.id + 1, cleared: [0] })).toBe(false);
    expect(storyFromVisit(c, at, { id: it.id, cleared: [it.culprit, 99, -1, 'x'] })).toBe(false);
    expect(it.cleared).toEqual([]);
    expect(storyFromVisit(c, at, { id: it.id, caught: true, cleared: [] })).toBe(false); // a killer is not a thief
    expect(intrigueAt(c, at)!.caught).toBeUndefined();
  });
});
