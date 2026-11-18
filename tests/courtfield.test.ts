// A story of the leader's house, on the field of a visit to the town where the court is kept
// (src/sim/courtfield.ts, src/sim/courtvisit.ts).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { Campaign, atTruce, newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { COURT, beginPlot, beginRival, beginSuitor, shownTrue } from '../src/sim/courtstory';
import { FIELD_ANSWERS, FIELD_COURT, answerBar, cmdAnswer, courtOut, guiseOf } from '../src/sim/courtfield';
import { courtForVisit, courtFromVisit } from '../src/sim/courtvisit';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { kinOf, spouseOf } from '../src/sim/kin';
import { noblesOf } from '../src/sim/nobles';
import { folkOf } from '../src/sim/township';
import { run } from './helpers';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign well on, the player rich, with a spouse, a grown daughter, a rival people, and the court's town peopled. */
const world = (seed = 5): { c: Campaign; rival: number; seat: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 20; c.phase = 'player';
  for (const t of c.territories) if (t.owner === 0) Object.assign(folkOf(c, t.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
  kinOf(c, 0);
  houseOf(c, 0).heirs = [{ name: 'Elin', female: true, born: c.turn - HEIR_AGE - 8 }, { name: 'Tam', female: false, born: c.turn - 20 }];
  return { c, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id, seat: -1 };
};
/** A court of six nobles, one sour enough to plot; no confidant either way (as tests/courtstory.test.ts). */
const court = (seed = 5): { c: Campaign; key: string } => {
  const { c } = world(seed), seat = c.territories.find((t) => t.owner === 0)!.id;
  c.factions[0].nobles = ['Aldric', 'Bram', 'Cyra', 'Dunn', 'Edric', 'Faye'].map((name, i) => ({ key: `lord:${90 + i}:0`, name, female: name === 'Cyra' || name === 'Faye', town: seat, rank: 'lord' as const, leaning: 'martial' as const, mood: i === 2 ? -70 : i === 4 ? -30 : 0 }));
  kinOf(c, 0).circle = kinOf(c, 0).circle.filter((x) => x.post !== 'confidant');
  return { c, key: 'lord:92:0' };
};
const enter = (c: Campaign, at: number): Game => {
  expect(beginVisit(c, at)).toBe(true);
  const cfg = visitConfig(c)!;
  return new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
};
const leave = (c: Campaign, g: Game): boolean => finishVisit(c, { folk: g.census(0), court: courtOut(g, 0) });

describe('into the visit', () => {
  it('no story of the house brings none; one is at the court\'s town and nowhere else; a rival\'s own is not the player\'s', () => {
    const { c, rival } = world();
    const home = c.territories.find((t) => t.owner === 0)!.id;
    expect(courtForVisit(c, home)).toBeUndefined();
    const x = beginRival(c, rival)!;
    expect(courtForVisit(c, x.at)).toMatchObject({ id: x.id, kind: 'rival' });
    for (const t of c.territories) if (t.id !== x.at) expect(courtForVisit(c, t.id)).toBeUndefined();
    expect(beginVisit(c, x.at)).toBe(true);
    expect(visitConfig(c)!.setups[0].bonus!.court).toMatchObject({ id: x.id });
    const other = world(), theirs = c.factions.find((f) => f.id > 0 && f.id !== rival && f.alive);
    if (theirs) { const y = beginRival(other.c, other.rival, { owner: theirs.id }); if (y) expect(courtForVisit(other.c, y.at)).toBeUndefined(); }
  });

  it('a rival who has only threatened sends an envoy with nothing yet to answer; once he demands, the map\'s answers are offered', () => {
    const { c, rival } = world(), x = beginRival(c, rival)!;
    const first = courtForVisit(c, x.at)!;
    expect(first.guest).toContain('the envoy of');
    expect(first.guest).toContain(x.cast!.king!);
    expect(first.answers).toEqual([]);
    x.stage = 1; x.due = c.turn + 2;
    const s = courtForVisit(c, x.at)!;
    expect(s.answers.map((a) => a.id)).toEqual(['defy', 'buy', 'yield']); // a guard is set on the map, not here
    expect(s.errand).toContain(spouseOf(c, 0)!.name);
  });

  it('a suitor is there by name, with the daughter\'s; whether she is willing is carried but not said', () => {
    const { c, rival } = world(), x = beginSuitor(c, rival)!;
    const s = courtForVisit(c, x.at)!;
    expect(s.kind).toBe('suitor');
    expect(s.guest).toContain(x.cast!.suitor!);
    expect(s.daughter).toBe('Elin');
    expect(s.willing).toBe(!!x.willing);
    expect(`${s.guest} ${s.errand}`).not.toMatch(/willing|would have|would not/);
    expect(s.answers.map((a) => a.id)).toEqual(['give', 'decline', 'spurn']);
  });

  it('a plot brings the great still spoken of; one laid bare waits on the map\'s judgement and brings nothing', () => {
    const { c } = court(), x = beginPlot(c)!;
    const s = courtForVisit(c, x.at)!;
    expect(s.nobles!.map((n) => n.name)).toEqual(x.nobles!.map((n) => n.name));
    expect(s.culprit).toBe(x.culprit);
    x.found = true;
    expect(courtForVisit(c, x.at)).toBeUndefined();
  });
});

describe('a guest at the hall', () => {
  it('the leader answers a rival\'s demand in the hall, and it is done on leaving exactly as from the map', () => {
    const { c, rival } = world(), x = beginRival(c, rival)!;
    x.stage = 1; x.due = c.turn + 2;
    const g = enter(c, x.at);
    expect(g.players[0].court).toMatchObject({ id: x.id, kind: 'rival' });
    expect(answerBar(g, 0, 'watch')).not.toBe(''); // not for answering here
    expect(cmdAnswer(g, 0, 'watch')).toBe(false);
    expect(cmdAnswer(g, 0, 'defy')).toBe(true);
    expect(cmdAnswer(g, 0, 'yield')).toBe(false); // one answer
    expect(spouseOf(c, 0)).toBeTruthy();
    expect(x.stage).toBe(1); // nothing is done until the player leaves
    expect(leave(c, g)).toBe(true);
    expect(x.stage).toBe(2);
    expect(spouseOf(c, 0)).toBeTruthy();
    expect(c.intrigueNews!.some((n) => n.id === x.id)).toBe(true);
  });

  it('an answer the map would not offer is not believed: a made-up one, one that is barred, one to another story, one for a story ended', () => {
    const { c, rival } = world(), x = beginRival(c, rival)!;
    x.stage = 1; x.due = c.turn + 2;
    expect(courtFromVisit(c, x.at, { id: x.id, answer: 'crown me', cleared: [] })).toBe(false);
    expect(courtFromVisit(c, x.at, { id: x.id, answer: 'watch', cleared: [] })).toBe(false);
    expect(courtFromVisit(c, x.at, { id: x.id + 1, answer: 'defy', cleared: [] })).toBe(false);
    expect(courtFromVisit(c, x.at, 'defy')).toBe(false);
    expect(courtFromVisit(c, x.at, null)).toBe(false);
    for (const t of c.territories) if (t.owner === 0) Object.assign(folkOf(c, t.id).stores, { food: 0, wood: 0, gold: 0, stone: 0 });
    expect(courtFromVisit(c, x.at, { id: x.id, answer: 'buy', cleared: [] })).toBe(false); // nothing to buy him off with
    expect(x.stage).toBe(1);
    x.stage = 0; // only threatened: nothing to answer yet
    expect(courtFromVisit(c, x.at, { id: x.id, answer: 'defy', cleared: [] })).toBe(false);
    x.stage = 1;
    expect(courtFromVisit(c, x.at, { id: x.id, answer: 'yield', cleared: [] })).toBe(true);
    expect(x.ended?.how).toBe('yielded');
    expect(courtFromVisit(c, x.at, { id: x.id, answer: 'defy', cleared: [] })).toBe(false);
  });

  it('the daughter may be asked in the hall, and says what the map knows; given, she is wed as from the map', () => {
    const { c, rival } = world(), x = beginSuitor(c, rival)!;
    const g = enter(c, x.at);
    expect(answerBar(g, 0, 'ask')).toBe('');
    expect(cmdAnswer(g, 0, 'ask')).toBe(true);
    expect(g.players[0].court!.asked).toBe(true);
    expect(answerBar(g, 0, 'ask')).not.toBe('');
    expect(cmdAnswer(g, 0, 'give')).toBe(true);
    expect(houseOf(c, 0).heirs.some((h) => h.name === 'Elin')).toBe(true);
    leave(c, g);
    expect(x.asked).toBe(true);
    expect(x.ended?.how).toBe('wed');
    expect(houseOf(c, 0).heirs.some((h) => h.name === 'Elin')).toBe(false);
    expect(atTruce(c, 0, rival)).toBe(true);
  });

  it('left without an answer, nothing is changed and the suitor waits on', () => {
    const { c, rival } = world(), x = beginSuitor(c, rival)!, due = x.due;
    const g = enter(c, x.at);
    run(g, 30);
    leave(c, g);
    expect(x.ended).toBeUndefined();
    expect(x.due).toBe(due);
    expect(x.asked).toBeFalsy();
  });
});

describe('a plot at court', () => {
  it('the great spoken of are grown people of the town, shown by name and title, and keep their own names on its record', () => {
    const { c } = court(), x = beginPlot(c)!;
    Object.assign(folkOf(c, x.at), { men: 16, women: 16, elders: 2, children: 6 });
    const g = enter(c, x.at);
    run(g, 2);
    const shown = g.units.filter((u) => u.owner === 0 && u.noble !== undefined);
    expect(shown).toHaveLength(x.nobles!.length);
    for (const u of shown) {
      expect(u.type).toBe('villager');
      const n = guiseOf(g, u)!;
      expect(n.title).toBe(x.nobles![u.noble!].title);
      expect(u.gender).toBe(n.female ? 'f' : 'm');
    }
    // No name is written over: every one of them is still on the field under the name the town's record gave them.
    const names = g.census(0);
    expect(names.men + names.women + names.elders).toBeGreaterThan(0);
    for (const u of shown) expect(typeof u.name).toBe('string');
    const again = enter(JSON.parse(JSON.stringify(c)), x.at); // the same town, entered afresh with no plot laid yet
    const own = new Set(again.units.filter((u) => u.owner === 0 && u.type === 'villager').map((u) => `${u.name} ${u.family}`));
    for (const u of shown) expect(own.has(`${u.name} ${u.family}`)).toBe(true);
  });

  it('a soldier kept by one who is true may show it; the plotter is never shown true, however long they are watched', () => {
    let cleared = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { c } = court(seed), x = beginPlot(c)!;
      c.turn += seed; // each in its own season: what a watch shows is drawn by the season of the visit
      Object.assign(folkOf(c, x.at), { men: 16, women: 16, elders: 2, children: 6 });
      const g = enter(c, x.at);
      run(g, 2);
      for (const u of g.units.filter((u) => u.owner === 0 && u.noble !== undefined)) g.spawnUnit('clubman', 0, u.x + 0.5, u.y + 0.5);
      // The soldiers keep by them wherever they walk.
      for (let t = 0; t < FIELD_COURT.watch + 10; t++) {
        const great = g.units.filter((u) => u.owner === 0 && u.noble !== undefined), guards = g.units.filter((u) => u.owner === 0 && u.type === 'clubman');
        great.forEach((u, k) => { const s = guards[k]; if (s) { s.x = u.x + 0.5; s.y = u.y + 0.5; } });
        run(g, 1);
      }
      const out = courtOut(g, 0)!;
      expect(out.cleared).not.toContain(x.culprit);
      expect(g.players[0].court!.tried!.length).toBeGreaterThan(0);
      leave(c, g);
      for (const i of out.cleared) expect(x.cleared).toContain(i);
      expect(x.cleared).not.toContain(x.culprit);
      cleared += out.cleared.length;
    }
    expect(cleared).toBeGreaterThan(0);
  });

  it('what comes back is checked: the plotter, one cleared already, a number out of range and nonsense clear nobody', () => {
    const { c } = court(), x = beginPlot(c)!;
    const innocent = x.nobles!.map((_, i) => i).filter((i) => i !== x.culprit);
    expect(courtFromVisit(c, x.at, { id: x.id, cleared: [x.culprit, 99, -1, 1.5, 'a'] })).toBe(false);
    expect(x.cleared).toEqual([]);
    expect(courtFromVisit(c, x.at, { id: x.id, cleared: [innocent[0]] })).toBe(true);
    expect(x.cleared).toEqual([innocent[0]]);
    expect(x.clues.at(-1)!.text).toContain('Watched by your soldiers');
    expect(courtFromVisit(c, x.at, { id: x.id, cleared: [innocent[0]] })).toBe(false);
    expect(courtFromVisit(c, x.at, { id: x.id, answer: 'death', cleared: [] })).toBe(false); // a judgement is the map's
    expect(noblesOf(c, 0).length).toBe(6);
  });

  it('when all but one have been shown true, the one left is laid bare, and waits on judgement', () => {
    const { c } = court(), x = beginPlot(c)!;
    const innocent = x.nobles!.map((_, i) => i).filter((i) => i !== x.culprit);
    expect(courtFromVisit(c, x.at, { id: x.id, cleared: innocent })).toBe(true);
    expect(x.found).toBe(true);
    expect(x.ended).toBeUndefined();
    expect(shownTrue(c, x, x.culprit, 'no')).toBe(false);
  });
});

describe('the rules that hold for every story', () => {
  it('the answers that may be given on the field are the map\'s own, less a guard, informers and a judgement', () => {
    expect(FIELD_ANSWERS.rival).toEqual(['defy', 'buy', 'yield']);
    expect(FIELD_ANSWERS.suitor).toEqual(['give', 'decline', 'spurn']);
    expect(FIELD_ANSWERS.plot).toEqual([]);
    expect(COURT.plot.spoken).toBeGreaterThan(2);
  });

  it('nobody is spawned, struck or lost by a story on the field: the town goes home as it came', () => {
    const { c } = court(), x = beginPlot(c)!;
    Object.assign(folkOf(c, x.at), { men: 16, women: 16, elders: 2, children: 6 });
    const f = folkOf(c, x.at), before = f.men + f.women + f.elders + f.children;
    const g = enter(c, x.at);
    const units = g.units.filter((u) => u.owner === 0 && !u.dead).length;
    run(g, 20);
    expect(g.units.filter((u) => u.owner === 0 && !u.dead).length).toBeGreaterThanOrEqual(units);
    expect(g.units.some((u) => u.noble !== undefined && u.type !== 'villager')).toBe(false);
    leave(c, g);
    const a = folkOf(c, x.at);
    expect(a.men + a.women + a.elders + a.children).toBeGreaterThanOrEqual(before);
  });
});

describe('several stories of the house at once (docs/PLAYTEST.md 5.3)', () => {
  it('an envoy, a suitor and a plot all come to the field, each answered or watched for itself, and each is written back', async () => {
    const { courtsOf } = await import('../src/sim/courtfield');
    const { c } = court(), rival = c.factions.find((f) => f.id > 0 && f.alive)!.id;
    const r = beginRival(c, rival)!; r.stage = 1; r.due = c.turn + 2;
    const s = beginSuitor(c, rival)!, p = beginPlot(c)!;
    expect(new Set([r.at, s.at, p.at]).size).toBe(1);
    Object.assign(folkOf(c, r.at), { men: 16, women: 16, elders: 2, children: 6 });
    const into = courtForVisit(c, r.at)!;
    expect([into.id, ...(into.also ?? []).map((x) => x.id)].sort()).toEqual([r.id, s.id, p.id].sort());
    const g = enter(c, r.at);
    run(g, 2);
    expect(courtsOf(g, 0).map((x) => x.kind).sort()).toEqual(['plot', 'rival', 'suitor']);
    expect(g.units.filter((u) => u.owner === 0 && u.noble !== undefined && u.plot === p.id)).toHaveLength(p.nobles!.length);
    // An answer finds its own story by what may be answered to each.
    expect(cmdAnswer(g, 0, 'defy')).toBe(true);
    expect(cmdAnswer(g, 0, 'ask')).toBe(true);
    expect(cmdAnswer(g, 0, 'decline')).toBe(true);
    expect(cmdAnswer(g, 0, 'spurn')).toBe(false); // the suitor has his answer
    const out = courtOut(g, 0)!;
    expect([out, ...(out.also ?? [])].map((x) => x.id).sort()).toEqual([r.id, s.id, p.id].sort());
    leave(c, g);
    expect(r.stage).toBe(2);
    expect(s.asked).toBe(true);
    expect(s.ended?.how).toBe('refused');
    expect(p.ended).toBeUndefined();
    // What rides along is checked like the rest: nonsense in `also` changes nothing.
    expect(courtFromVisit(c, r.at, { id: -1, cleared: [], also: [{ id: p.id, cleared: [p.culprit, 99] }, 'x', null, { id: 12345, answer: 'defy' }] })).toBe(false);
  });
});

describe('a watch is drawn afresh each visit (docs/PLAYTEST.md 5.4)', () => {
  it('one not shown true on one visit may be on a later one: over the seasons every innocent can be, and the plotter never', async () => {
    const { courtTick, courtsOf } = await import('../src/sim/courtfield');
    const { c } = court(), x = beginPlot(c)!;
    Object.assign(folkOf(c, x.at), { men: 16, women: 16, elders: 2, children: 6 });
    const shown = new Set<number>(), bySeason: string[] = [];
    for (let season = 0; season < 12; season++) {
      const d: Campaign = JSON.parse(JSON.stringify(c)); d.turn = c.turn + season;
      expect(courtForVisit(d, x.at)!.turn).toBe(d.turn);
      const g = enter(d, x.at);
      run(g, 2);
      for (let t = 0; t < FIELD_COURT.watch + 5; t++) {
        const great = g.units.filter((u) => u.owner === 0 && u.noble !== undefined);
        if (t === 0) for (const u of great) g.spawnUnit('clubman', 0, u.x + 0.5, u.y + 0.5);
        const guards = g.units.filter((u) => u.owner === 0 && u.type === 'clubman');
        great.forEach((u, k) => { const s = guards[k]; if (s) { s.x = u.x + 0.5; s.y = u.y + 0.5; } });
        run(g, 1);
      }
      void courtTick;
      const out = courtsOf(g, 0)[0].out ?? [];
      for (const i of out) shown.add(i);
      bySeason.push([...out].sort().join(','));
      expect(out).not.toContain(x.culprit);
    }
    expect(new Set(bySeason).size).toBeGreaterThan(1); // not the same every visit
    expect(shown.size).toBe(x.nobles!.length - 1); // every innocent, in time
  });
});
