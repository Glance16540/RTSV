// Seizing one of a killer's suspects on the field, and what the map makes of it (src/sim/fieldaccuse.ts,
// src/sim/killerseized.ts; the judgement in intrigue.ts and at the Hall, hallcases.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { INTRIGUE, beginKiller, choicesFor, choose, intrigueAt, intrigueSeason } from '../src/sim/intrigue';
import { cmdQuestion, storyOut } from '../src/sim/fieldstory';
import { ACCUSE, accuseBar, cmdAccuse } from '../src/sim/fieldaccuse';
import { SEIZED, seizeSuspect } from '../src/sim/killerseized';
import { storyForVisit, storyFromVisit } from '../src/sim/storyvisit';
import { hallCasesAt, hallFromSitting } from '../src/sim/hallcases';
import { awaitsWord } from '../src/sim/encounter';
import { sensibleAnswers } from '../src/sim/storypolicy';
import { faithAt } from '../src/sim/townfaith';
import { folkOf } from '../src/sim/township';
import { run } from './helpers';

const CHILD = /\b(child|children|baby|infant|boy|girl|son|daughter|kid|orphan)\b/i;
const world = (hall = false): { c: Campaign; at: number } => {
  const c = newCampaign(3);
  c.turn = 20;
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 16, women: 16, elders: 2, children: 6 });
  if (hall) t.town = { at: t.town?.at ?? 2, b: [...(t.town?.b ?? []), ['hall', 3, 3, 1] as never] } as never;
  return { c, at: t.id };
};
const enter = (c: Campaign, at: number): Game => {
  expect(beginVisit(c, at)).toBe(true);
  const cfg = visitConfig(c)!;
  return new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
};
const suspectOf = (g: Game, i: number) => g.units.find((u) => u.owner === 0 && u.suspect === i)!;
const guardBy = (g: Game, u: { x: number; y: number }) => g.spawnUnit('clubman', 0, u.x + 1, u.y);
/** A killing with its victims, and an innocent (one not the killer) still spoken of. */
const killing = (c: Campaign, at: number) => { const it = beginKiller(c, at); const innocent = it.people.findIndex((_, i) => i !== it.culprit); return { it, innocent }; };

describe('seizing a suspect on the field', () => {
  it('needs a soldier beside them; the guilty one confesses and is held, and the map holds them for judgement', () => {
    const { c, at } = world();
    const { it } = killing(c, at), g = enter(c, at);
    run(g, 1);
    const u = suspectOf(g, it.culprit);
    for (const x of g.units) if (x.owner === 0 && x.type !== 'villager') x.x = x.y = 1; // no soldier near anyone
    u.x = 40; u.y = 40;
    expect(accuseBar(g, 0, u)).toMatch(/^Bring a soldier to /);
    expect(cmdAccuse(g, 0, u.id)).toBeNull();
    guardBy(g, u);
    expect(accuseBar(g, 0, u)).toBe('');
    expect(cmdAccuse(g, 0, u.id)).toBe(true);
    expect(storyOut(g, 0)).toMatchObject({ id: it.id, seized: it.culprit });
    // Nothing more to be done with the killing in this visit.
    const other = suspectOf(g, it.people.findIndex((_, i) => i !== it.culprit));
    guardBy(g, other);
    expect(accuseBar(g, 0, other)).toBe('The killer is seized and held for your judgement.');
    expect(cmdQuestion(g, 0, other.id)).toBe(false);
    // Home: held for judgement, the killing stopped.
    finishVisit(c, { story: storyOut(g, 0) });
    expect(it.held).toBe(it.culprit);
    expect(it.caught).toBe(c.turn);
    expect(storyForVisit(c, at)).toBeUndefined(); // judged on the map, or at the Hall: nothing more for the field
    expect(awaitsWord(it)).toBe(true); // face to face (encounter.ts)
    expect(choicesFor(c, it).map((x) => x.id)).toEqual(['hang', 'banish']);
    const dead = it.victims.length;
    intrigueSeason(c); // no more killing while held
    expect(it.victims.length).toBe(dead);
    expect(it.ended).toBeUndefined();
  }, 60_000);

  it('an innocent is let go: spoken of no longer, their household and the town remember it, and the town\'s standing dips', () => {
    const { c, at } = world();
    const { it, innocent } = killing(c, at), g = enter(c, at);
    run(g, 1);
    const u = suspectOf(g, innocent);
    guardBy(g, u);
    expect(cmdAccuse(g, 0, u.id)).toBe(false);
    expect(accuseBar(g, 0, suspectOf(g, it.culprit))).toMatch(/seized one of them in this town already/);
    const before = faithAt(c, at);
    finishVisit(c, { story: storyOut(g, 0) });
    expect(it.cleared).toContain(innocent);
    expect(it.held).toBeUndefined();
    expect(faithAt(c, at)).toBeCloseTo(before + SEIZED.wrong, 5);
    const mark = (c.marks ?? []).find((m) => m.kind === 'resentful' && m.at === at)!;
    expect(mark.text).toContain(`${it.people[innocent].name} ${it.people[innocent].family} was seized before the whole town`);
    expect(c.chronicle!.at(-1)!.text).toMatch(/was seized for killings (she|he) did not do, and let go\.$/);
    expect(it.clues.at(-1)!.clears).toEqual([innocent]);
    expect(it.ended).toBeUndefined(); // the killing goes on
  }, 60_000);

  it('what comes home is not believed blindly', () => {
    const { c, at } = world();
    const { it, innocent } = killing(c, at);
    expect(storyFromVisit(c, at, { id: it.id + 1, cleared: [], seized: it.culprit })).toBe(false); // another story
    expect(storyFromVisit(c, at, { id: it.id, cleared: [], seized: 99 })).toBe(false);
    it.cleared.push(innocent);
    expect(seizeSuspect(c, it, innocent)).toBeNull(); // spoken of no longer
    expect(seizeSuspect(c, it, it.culprit)).toBe('held');
    expect(seizeSuspect(c, it, it.people.findIndex((_, i) => i !== it.culprit && i !== innocent))).toBeNull(); // one held already
  });
});

describe('judging a killer seized', () => {
  it('hang ends it as a rightful accusation does; banish puts them out; left too long, the town hangs them itself', () => {
    for (const how of ['hang', 'banish', 'wait'] as const) {
      const { c, at } = world();
      const { it } = killing(c, at);
      const v = c.factions[0].virtue ?? 0;
      seizeSuspect(c, it, it.culprit);
      if (how === 'wait') { for (let k = 0; k <= INTRIGUE.killer.patience && !it.ended; k++) { c.turn++; intrigueSeason(c); } }
      else expect(choose(c, it.id, how)).toBe(true);
      expect(it.ended?.how).toBe(how === 'banish' ? 'banished' : 'hanged');
      if (how === 'hang') expect(it.ended!.text).toMatch(/^You accused /);
      if (how === 'wait') expect(it.ended!.text).toMatch(/did not wait for you/);
      if (how === 'banish') expect(c.factions[0].virtue ?? 0).toBeGreaterThanOrEqual(v);
      expect(it.ended!.text).not.toMatch(CHILD);
    }
  });

  it('the town\'s Hall hears it, and a careful ruler hangs, as an accusation would', () => {
    const { c, at } = world(true);
    const { it } = killing(c, at);
    seizeSuspect(c, it, it.culprit);
    const cases = hallCasesAt(c, at);
    expect(cases).toEqual([expect.objectContaining({ id: `story:${it.id}`, kind: 'killer', answers: [expect.objectContaining({ id: 'hang' }), expect.objectContaining({ id: 'banish' })] })]);
    expect(hallFromSitting(c, at, [{ id: `story:${it.id}`, answer: 'banish' }])).toBe(1);
    expect(it.ended?.how).toBe('banished');
    const other = world();
    const k = killing(other.c, other.at).it;
    seizeSuspect(other.c, k, k.culprit);
    expect(sensibleAnswers(other.c, 0)).toContain('killer:hang');
    expect(intrigueAt(other.c, other.at)).toBeUndefined();
  });

  it('the field\'s words name no child and say nothing of what is done to anyone held', () => {
    const { c, at } = world();
    const { it, innocent } = killing(c, at), g = enter(c, at);
    run(g, 1);
    const said: string[] = [];
    const msg = g.msg.bind(g);
    g.msg = (o: number, t: string) => { said.push(t); return msg(o, t); };
    guardBy(g, suspectOf(g, innocent));
    cmdAccuse(g, 0, suspectOf(g, innocent).id);
    expect(said.join(' ')).not.toMatch(CHILD);
    expect(ACCUSE.near).toBeGreaterThan(0);
  }, 60_000);
});
