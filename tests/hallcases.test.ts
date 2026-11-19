// Judgement at the Hall, in the town (src/sim/hallcases.ts, src/sim/hallfield.ts): the cases the map has waiting in a town
// with a Hall of Judgement come before the player there, and their rulings are given by the map's own rules.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { beginThief } from '../src/sim/intrigue';
import { noblesOf, noblesSeasons } from '../src/sim/nobles';
import { hallCasesAt, hallFromSitting } from '../src/sim/hallcases';
import { casesBefore, hallOut, ruleAt, seatHall } from '../src/sim/hallfield';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { folkOf } from '../src/sim/township';
import { setups, spot } from './helpers';

function world(withHall = true): { c: Campaign; tid: number } {
  const c = newCampaign(7, 2, 1, 'hearth');
  c.turn = 20;
  noblesSeasons(c);
  const t = c.territories.find((x) => x.capital === 0)!;
  t.town = { at: t.town?.at ?? 2, b: [...(t.town?.b ?? []), ...(withHall ? [['hall', 3, 3, 1] as never] : [])] } as never;
  c.factions[0].supplies = 50;
  Object.assign(folkOf(c, t.id).stores, { food: 900, wood: 900, gold: 900, stone: 900 });
  return { c, tid: t.id };
}
/** A thief of the town, taken and held for judgement. */
function caught(c: Campaign, tid: number) {
  const it = beginThief(c, tid);
  it.caught = c.turn;
  it.thief = { name: 'Odo', family: 'Reeve', gender: 'm', trade: 'carter' };
  it.why = 'hunger';
  return it;
}

describe('judgement at the Hall', () => {
  it('a town with a Hall has before it the thief held there and a noble\'s petition; one with none, nothing', () => {
    const { c, tid } = world();
    const it = caught(c, tid);
    const n = noblesOf(c, 0).find((x) => x.town === tid && x.rank !== 'close')!;
    c.factions[0].petition = { id: 1, key: n.key, name: n.name, town: tid, kind: 'estate', since: c.turn };
    const cases = hallCasesAt(c, tid);
    expect(cases.map((x) => x.kind).sort()).toEqual(['petition', 'thief']);
    const thief = cases.find((x) => x.kind === 'thief')!;
    expect(thief.id).toBe(`story:${it.id}`);
    expect(thief.answers.map((a) => a.id)).toEqual(['work', 'pardon', 'banish', 'hang']);
    expect(thief.text).toContain('Odo Reeve');
    const bare = world(false);
    caught(bare.c, bare.tid);
    expect(hallCasesAt(bare.c, bare.tid)).toEqual([]);
  });

  it('the rulings given at the Hall are given by the map\'s rules; a stale or unknown one is not', () => {
    const { c, tid } = world();
    const it = caught(c, tid);
    const n = noblesOf(c, 0).find((x) => x.town === tid && x.rank !== 'close')!;
    c.factions[0].petition = { id: 1, key: n.key, name: n.name, town: tid, kind: 'estate', since: c.turn };
    const mood = n.mood;
    expect(hallFromSitting(c, tid, [{ id: `story:${it.id}`, answer: 'work' }, { id: 'petition:1', answer: 'grant' }, { id: 'story:999', answer: 'hang' }, { id: `story:${it.id}`, answer: 'hang' }, 'junk'])).toBe(2);
    expect(it.ended?.how).toBe('worked');
    expect(n.mood).toBeGreaterThan(mood);
    expect(c.factions[0].petition).toBeUndefined();
    expect(hallFromSitting(c, tid, 'nope')).toBe(0);
  });

  it('on the field: the cases are before a Hall that stands, a ruling is one of the answers given, and it goes back as the sitting ends', () => {
    const g = new Game(5, setups);
    const cases = [{ id: 'story:4', kind: 'thief' as const, who: 'Odo Reeve', text: 'Odo Reeve waits on your judgement.', answers: [{ id: 'work', label: 'Set him to work it off' }, { id: 'hang', label: 'Hang him', bar: 'not now' }] }];
    expect(seatHall(g, 0, cases)).toBe(1);
    expect(casesBefore(g, 0)).toEqual([]); // no Hall standing yet
    expect(ruleAt(g, 0, 'story:4', 'work')).toBe(false);
    const at = spot(g, 'hall', 0);
    g.spawnBuilding('hall', 0, at.cx, at.cy, true);
    expect(casesBefore(g, 0)).toHaveLength(1);
    expect(ruleAt(g, 0, 'story:4', 'hang')).toBe(false); // barred
    expect(ruleAt(g, 0, 'story:4', 'drown')).toBe(false); // not an answer it has
    expect(ruleAt(g, 0, 'story:4', 'work')).toBe(true);
    expect(ruleAt(g, 0, 'story:4', 'work')).toBe(false); // ruled already
    expect(casesBefore(g, 0)).toEqual([]);
    expect(hallOut(g, 0)).toEqual([{ id: 'story:4', answer: 'work' }]);
    expect(seatHall(g, 1, [{ id: '', kind: 'thief', answers: [] }])).toBe(0); // nothing safe in it
  });

  it('a visit to a town with a Hall hands its cases to the sitting', () => {
    const { c, tid } = world();
    caught(c, tid);
    c.phase = 'player';
    expect(beginVisit(c, tid)).toBe(true);
    const cfg = visitConfig(c)!;
    expect(cfg.setups[0].hall?.map((x) => x.kind)).toContain('thief');
  });
});
