// Stories inside the story: a thief and a killer (src/sim/intrigue.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { INTRIGUE, onRecord, beginKiller, beginThief, choicesFor, choose, fullName, intrigueNews, intrigueSeason, openIntrigues, standing, suspected } from '../src/sim/intrigue';
import { reportLines, reportSince, snapshot } from '../src/sim/seasonreport';
import { folkOf, grown, living, TOWN_SCALE as S } from '../src/sim/township';
import { ofTown } from '../src/sim/intriguebase';

/** A campaign with one roomy, well-found town of the player's, and that town. */
const base = JSON.stringify(newCampaign(5, 2));
const world = (seed = 5): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; // the stories' chances go by the campaign's seed
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 12 * S, women: 12 * S, elders: 2 * S, children: 6 * S }); // a town of that size as towns now are (township.ts TOWN_SCALE)
  Object.assign(folkOf(c, t.id).stores, { food: 5000, gold: 600 });
  c.turn = 10;
  return { c, at: t.id };
};
const season = (c: Campaign): void => { c.turn++; intrigueSeason(c); };

describe('a thief', () => {
  it('keeps robbing the same few houses, and the town\'s gold goes', () => {
    const { c, at } = world();
    const it0 = beginThief(c, at), f = folkOf(c, at), gold0 = 600;
    expect(it0.people).toHaveLength(INTRIGUE.thief.houses);
    expect(f.stores.gold).toBeLessThan(gold0);
    const houses = it0.people.map(fullName);
    for (let i = 0; i < 6 && it0.caught === undefined && !it0.ended; i++) season(c);
    expect(it0.people.map(fullName)).toEqual(houses); // never another house
    expect(it0.robbed.reduce((a, b) => a + b, 0)).toBeGreaterThan(1);
    expect(it0.taken).toBe(gold0 - f.stores.gold);
    expect(standing(c, it0)).toContain('same 3 houses');
  });
  it('is caught sooner by a watch, which the town pays for, and then waits on the leader\'s judgement', () => {
    const caughtIn = (watch: boolean): number => {
      let sum = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const { c, at } = world(seed), x = beginThief(c, at);
        if (watch) expect(choose(c, x.id, 'watch')).toBe(true);
        let n = 0;
        while (x.caught === undefined && !x.ended && n < 12) { season(c); n++; }
        sum += n;
      }
      return sum / 12;
    };
    expect(caughtIn(true)).toBeLessThan(caughtIn(false) - 2);
    const { c, at } = world(3), x = beginThief(c, at), f = folkOf(c, at);
    choose(c, x.id, 'watch');
    const before = f.stores.gold, taken = x.taken;
    season(c);
    expect(before - f.stores.gold - (x.taken - taken)).toBe(INTRIGUE.thief.cost);
    while (x.caught === undefined) season(c);
    expect(x.thief).toBeTruthy();
    expect(choicesFor(c, x).map((k) => k.id)).toEqual(['work', 'pardon', 'banish', 'hang']);
    const robbed = x.taken; season(c); season(c);
    expect(x.taken).toBe(robbed); // nothing more is stolen while they are held
  });
  it('is judged four ways, each leaving its mark on the people and the record', () => {
    const judge = (choice: string) => {
      const { c, at } = world(3), x = beginThief(c, at), f = folkOf(c, at);
      choose(c, x.id, 'watch');
      while (x.caught === undefined) season(c);
      const people = grown(f), gold = f.stores.gold, virtue = c.factions[0].virtue ?? 0, lines = (c.chronicle ?? []).length;
      expect(choose(c, x.id, choice)).toBe(true);
      return { x, c, lost: people - grown(f), gold: f.stores.gold - gold, virtue: (c.factions[0].virtue ?? 0) - virtue, told: (c.chronicle ?? []).length - lines };
    };
    const hang = judge('hang'), work = judge('work'), pardon = judge('pardon'), banish = judge('banish');
    expect([hang.lost, banish.lost, work.lost, pardon.lost]).toEqual([1, 1, 0, 0]);
    expect(work.gold).toBeGreaterThan(hang.gold);
    expect(pardon.gold).toBe(0);
    expect(hang.virtue).toBeLessThan(0);
    expect(pardon.virtue).toBeGreaterThan(work.virtue);
    for (const r of [hang, work, pardon, banish]) {
      expect(r.told).toBe(1);
      expect(r.x.ended!.text).toContain(fullName(r.x.thief!));
      expect(openIntrigues(r.c)).toHaveLength(0);
      expect(choose(r.c, r.x.id, 'hang')).toBe(false); // it is over
    }
  });
  it('who stole to eat is hanged at a heavier cost than one who stole from greed', () => {
    const hanged = (hungry: boolean): number => {
      const { c, at } = world(3), x = beginThief(c, at), f = folkOf(c, at);
      choose(c, x.id, 'watch');
      if (hungry) f.stores.food = 0;
      while (x.caught === undefined) season(c);
      expect(x.why).toBe(hungry ? 'hunger' : 'greed');
      const v = c.factions[0].virtue ?? 0;
      choose(c, x.id, 'hang');
      return (c.factions[0].virtue ?? 0) - v;
    };
    expect(hanged(true)).toBeLessThan(hanged(false));
  });
});

describe('a killer', () => {
  it('kills grown people of the town, a few of whom are suspected by name', () => {
    const { c, at } = world();
    const f = folkOf(c, at), before = grown(f), x = beginKiller(c, at);
    expect(x.people).toHaveLength(INTRIGUE.killer.suspects);
    expect(new Set(x.people.map(fullName)).size).toBe(INTRIGUE.killer.suspects);
    expect(new Set(x.people.map((p) => p.gender)).size).toBe(2);
    expect(x.victims).toHaveLength(1);
    expect(grown(f)).toBe(before - 1);
    expect(intrigueNews(c)[0].text).toContain(fullName(x.victims[0]));
  });
  it('is narrowed down by clues that clear the innocent, never the guilty, and found by accusing rightly', () => {
    const { c, at } = world(7), x = beginKiller(c, at);
    for (let i = 0; i < 9 && suspected(x).length > 2 && !x.ended; i++) season(c);
    expect(x.ended).toBeUndefined();
    expect(x.clues.length).toBeGreaterThan(0);
    expect(suspected(x)).toContain(x.culprit);
    expect(suspected(x).length).toBeLessThan(INTRIGUE.killer.suspects);
    const f = folkOf(c, at), people = grown(f), v = c.factions[0].virtue ?? 0;
    expect(choose(c, x.id, `accuse:${x.culprit}`)).toBe(true);
    expect(x.ended!.how).toBe('hanged');
    expect(grown(f)).toBe(people - 1);
    expect(c.factions[0].virtue ?? 0).toBeGreaterThan(v);
    expect(c.chronicle!.at(-1)!.text).toContain(fullName(x.people[x.culprit]));
    const dead = x.victims.length; season(c); season(c);
    expect(x.victims).toHaveLength(dead); // it is over
  });
  it('goes on killing when an innocent is hanged for it, and the town knows', () => {
    const { c, at } = world(7), x = beginKiller(c, at), f = folkOf(c, at);
    const wrong = suspected(x).find((i) => i !== x.culprit)!, v = c.factions[0].virtue ?? 0, people = grown(f);
    expect(choose(c, x.id, `accuse:${wrong}`)).toBe(true);
    expect(x.ended).toBeUndefined();
    expect(x.wronged!.map(fullName)).toEqual([fullName(x.people[wrong])]);
    expect(grown(f)).toBe(people - 1);
    expect(c.factions[0].virtue ?? 0).toBeLessThan(v);
    expect(choicesFor(c, x).some((k) => k.id === `accuse:${wrong}`)).toBe(false); // nobody is hanged twice
    expect(c.chronicle!.at(-1)!.text).toContain('did not do');
  });
  it('is found sooner with the leader\'s court in the town', () => {
    const clues = (court: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 16; seed++) {
        const { c, at } = world(seed);
        if (court) c.factions[0].court = { at }; else c.factions[0].heroAlive = false; // nobody leads them
        const x = beginKiller(c, at);
        for (let i = 0; i < 3; i++) season(c);
        n += x.clues.length;
      }
      return n;
    };
    expect(clues(true)).toBeGreaterThan(clues(false));
  });
  it('left alone is hanged by the town once only one is left, or is never found, and never empties a town', () => {
    const hows = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const { c, at } = world(seed), x = beginKiller(c, at), f = folkOf(c, at);
      if (seed % 2) Object.assign(f, { men: 4 * S, women: 3 * S, elders: 0 });
      for (let i = 0; i < 14 && !x.ended; i++) season(c);
      expect(x.ended).toBeTruthy();
      hows.add(x.ended!.how);
      expect(grown(f)).toBeGreaterThanOrEqual(seed % 2 ? INTRIGUE.killer.leave - 1 : 10);
    }
    expect(hows.has('hanged') || hows.has('unfound')).toBe(true);
  });
});

describe('every story', () => {
  it('never touches a child', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { c, at } = world(seed), f = folkOf(c, at);
      const a = beginKiller(c, at);
      for (let i = 0; i < 6; i++) season(c);
      const wrong = suspected(a).find((i) => i !== a.culprit);
      if (wrong !== undefined && !a.ended) choose(c, a.id, `accuse:${wrong}`);
      a.ended ??= { turn: c.turn, how: 'unfound', text: '' };
      const b = beginThief(c, at); choose(c, b.id, 'watch');
      while (b.caught === undefined && !b.ended) season(c);
      choose(c, b.id, 'hang');
      expect(f.children).toBe(6 * S);
      if (f.ages) expect(f.ages.k).toHaveLength(6 * S);
    }
  });
  it('comes by chance to a town of the player\'s, one at a time, likelier where the town is strained', () => {
    const count = (hungry: boolean): number => {
      let n = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const { c, at } = world(seed);
        if (hungry) folkOf(c, at).stores.food = 0;
        for (let i = 0; i < 40; i++) {
          season(c);
          if (hungry) folkOf(c, at).stores.food = 0;
          const open = openIntrigues(c).filter(ofTown); // the town's stories, one at a time (a story of the house is apart: courtstory.ts)
          expect(open.length).toBeLessThanOrEqual(INTRIGUE.open);
          expect(new Set(open.map((x) => x.at)).size).toBe(open.length);
          for (const x of open) x.ended = { turn: c.turn, how: 'unfound', text: '' }; // count beginnings only
          n += open.length;
        }
      }
      return n;
    };
    const calm = count(false), hungry = count(true);
    expect(calm).toBeGreaterThan(0);
    expect(hungry).toBeGreaterThan(calm);
  });
  it('none begins before its season, and a lost town takes its story with it', () => {
    const { c, at } = world();
    c.turn = 0;
    for (let i = 0; i < INTRIGUE.from - 2; i++) season(c);
    expect(c.intrigues ?? []).toHaveLength(0);
    const x = beginThief(c, at);
    c.territories[at].owner = 1;
    season(c);
    expect(x.ended!.how).toBe('lost');
  });
  it('is in the season\'s report, and is plain data', () => {
    const { c, at } = world();
    const s = snapshot(c);
    c.turn++;
    const x = beginKiller(c, at);
    const r = reportSince(c, s);
    expect(r.stories).toHaveLength(1);
    expect(reportLines(r).some((l) => l.kind === 'story' && l.text.includes(fullName(x.victims[0])))).toBe(true);
    const back: Campaign = JSON.parse(JSON.stringify(c));
    expect(back.intrigues).toEqual(c.intrigues);
    expect(choose(back, x.id, `accuse:${x.culprit}`)).toBe(true);
  });
});

describe('the people in a town\'s story', () => {
  /** A town whose record knows six people by name: four notable, two of them women with a man of the house. */
  const known = (seed: number): { c: Campaign; at: number } => {
    const w = world(seed), f = folkOf(w.c, w.at);
    f.notables = [
      { name: 'Hild', family: 'Marsh', gender: 'f', kind: 'mother', deed: 'raised four children', turn: 2, kids: 4, husband: 'Bram' },
      { name: 'Orla', family: 'Pike', gender: 'f', kind: 'mother', deed: 'raised three children', turn: 3, kids: 3, husband: 'Kell' },
      { name: 'Rolf', family: 'Thorne', gender: 'm', kind: 'veteran', deed: 'felled 5 in battle as a spearman', turn: 4, kills: 5, unit: 'Spearman' },
      { name: 'Edric', family: 'Oakes', gender: 'm', kind: 'veteran', deed: 'felled 3 in battle as an archer', turn: 5, kills: 3, unit: 'Archer' },
    ];
    return w;
  };
  it('are, some of them, the people its record already knows by name', () => {
    const { c, at } = known(1);
    expect(onRecord(c, at).map(fullName).sort()).toEqual(['Bram Marsh', 'Edric Oakes', 'Hild Marsh', 'Kell Pike', 'Orla Pike', 'Rolf Thorne']);
    let onIt = 0, all = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const w = known(seed), x = seed % 2 ? beginKiller(w.c, w.at) : beginThief(w.c, w.at);
      expect(new Set(x.people.map(fullName)).size).toBe(x.people.length); // nobody twice
      onIt += x.people.filter((p) => p.known).length; all += x.people.length;
    }
    expect(onIt).toBeGreaterThan(all * 0.25);
    expect(onIt).toBeLessThan(all);
  });
  it('are struck from that record when the story takes them, with how', () => {
    let killed = 0, hanged = 0, widowed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { c, at } = known(seed), f = folkOf(c, at), x = beginKiller(c, at);
      for (let i = 0; i < 4 && !x.ended; i++) season(c);
      const wrong = suspected(x).find((i) => i !== x.culprit && x.people[i].known === 'notable');
      if (wrong !== undefined && !x.ended) { choose(c, x.id, `accuse:${wrong}`); hanged++; expect(f.notables.find((n) => n.name === x.people[wrong].name)!.lost!.how).toContain('did not do'); }
      for (const v of x.victims) {
        if (v.known === 'notable') { killed++; expect(f.notables.find((n) => n.name === v.name)!.lost).toMatchObject({ how: 'was killed in the night' }); }
        if (v.known === 'husband') { widowed++; expect(f.notables.find((n) => n.family === v.family)!.husband).toBeUndefined(); }
      }
      expect(living(f).length).toBeLessThanOrEqual(4);
      expect(f.children).toBe(6 * S); // and never a child
    }
    expect(killed).toBeGreaterThan(0);
    expect(hanged).toBeGreaterThan(0);
    expect(widowed).toBeGreaterThan(0);
  });
});
