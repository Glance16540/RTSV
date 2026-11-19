// A plain way of answering the stories, for a player the computer plays (src/sim/storypolicy.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { beginPlot, beginRival, beginSuitor } from '../src/sim/courtstory';
import { houseOf, HEIR_AGE } from '../src/sim/dynasty';
import { beginKiller, beginThief, intrigueSeason } from '../src/sim/intrigue';
import { kinOf, spouseOf } from '../src/sim/kin';
import { sensibleAnswers } from '../src/sim/storypolicy';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
const world = (seed: number): { c: Campaign; at: number; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 20; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 12, women: 12, elders: 2, children: 6 });
  for (const x of c.territories) if (x.owner === 0) Object.assign(folkOf(c, x.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
  kinOf(c, 0);
  houseOf(c, 0).heirs = [{ name: 'Elin', female: true, born: c.turn - HEIR_AGE - 8 }];
  return { c, at: t.id, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id };
};
const play = (c: Campaign, n: number): void => { for (let i = 0; i < n; i++) { sensibleAnswers(c); c.turn++; intrigueSeason(c); } sensibleAnswers(c); };

describe('a plain way of answering the stories', () => {
  it('never hangs an innocent, and takes a killer and a thief sooner than leaving them', () => {
    let found = 0, worked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const a = world(seed), k = beginKiller(a.c, a.at);
      play(a.c, 12);
      expect(k.wronged ?? []).toHaveLength(0);
      if (k.ended?.how === 'hanged') found++;
      const b = world(seed), t = beginThief(b.c, b.at);
      play(b.c, 12);
      if (t.ended?.how === 'worked') worked++;
    }
    expect(found).toBeGreaterThan(12);
    expect(worked).toBeGreaterThan(15);
  });
  it('keeps the spouse and the daughter\'s say, and pardons a plotter it finds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = world(seed), r = beginRival(a.c, a.rival)!;
      play(a.c, 10);
      expect(spouseOf(a.c, 0)).toBeTruthy();
      expect(['foiled', 'slain', 'wounded']).toContain(r.ended!.how);
      const b = world(seed), s = beginSuitor(b.c, b.rival)!;
      play(b.c, 1);
      expect(s.ended!.how).toBe(s.willing ? 'wed' : 'refused');
      const d = world(seed);
      d.c.factions[0].nobles = ['Aldric', 'Bram', 'Cyra', 'Dunn'].map((name, i) => ({ key: `lord:${90 + i}:0`, name, female: false, town: d.at, rank: 'lord' as const, leaning: 'martial' as const, mood: i === 2 ? -90 : 0 }));
      const p = beginPlot(d.c)!;
      play(d.c, 10);
      expect(['pardoned', 'nothing', 'foiled', 'usurped']).toContain(p.ended!.how);
      expect(p.ended!.how).not.toBe('executed');
    }
  });
});

// The policy rule by rule, one story at a time.
import { pactOf, wedPeace } from '../src/sim/pacts';
import { openIntrigues } from '../src/sim/intrigue';

describe('a plain way of answering the stories: rule by rule', () => {
  it('with nothing waiting, it does nothing', () => {
    const { c } = world(3);
    expect(sensibleAnswers(c)).toEqual([]);
    expect(sensibleAnswers(c, 1)).toEqual([]);
  });

  it('a thief: a watch is set first, and only once', () => {
    const { c, at } = world(4);
    const t = beginThief(c, at);
    expect(sensibleAnswers(c)).toEqual(['thief:watch']);
    expect(t.watch).toBe(true);
    expect(sensibleAnswers(c)).toEqual([]); // the watch stands: it is not stood down
    expect(t.watch).toBe(true);
  });

  it('a thief with no gold in the town to pay a watch: nothing is done', () => {
    const { c, at } = world(4);
    const t = beginThief(c, at);
    folkOf(c, at).stores.gold = 0;
    expect(sensibleAnswers(c)).toEqual([]);
    expect(t.watch).toBeFalsy();
  });

  it('a thief taken is set to work it off: never hanged, banished or let go', () => {
    const { c, at } = world(4);
    const t = beginThief(c, at);
    sensibleAnswers(c);
    t.caught = c.turn; t.thief = t.people[0];
    expect(sensibleAnswers(c)).toEqual(['thief:work']);
    expect(t.ended?.how).toBe('worked');
    expect(openIntrigues(c)).not.toContain(t);
  });

  it('a killer: a watch, and an accusation only when the clues have left one', () => {
    const { c, at } = world(6);
    const k = beginKiller(c, at);
    expect(k.people.length).toBeGreaterThan(1);
    k.cleared = [];
    expect(sensibleAnswers(c)).toEqual(['killer:watch']);
    // Two left: still nobody accused. (Honest clues never clear the culprit.)
    const culprit = k.culprit!;
    k.cleared = k.people.map((_, i) => i).filter((i) => i !== culprit).slice(1);
    expect(sensibleAnswers(c).some((m) => m.startsWith('killer:accuse'))).toBe(false);
    expect(k.ended).toBeUndefined();
    // One left: that one.
    k.cleared = k.people.map((_, i) => i).filter((i) => i !== culprit);
    expect(sensibleAnswers(c)).toEqual([`killer:accuse:${culprit}`]);
    expect(k.ended?.how).toBe('hanged');
    expect(k.wronged ?? []).toHaveLength(0);
  });

  it('a rival\'s offer of trade is taken at peace; without a truce it cannot be, and nothing is claimed', () => {
    const a = world(7);
    a.c.truces.push({ with: a.rival, until: a.c.turn + 6 });
    a.c.pactOffer = { kind: 'trade', from: a.rival, turn: a.c.turn };
    expect(sensibleAnswers(a.c)).toEqual(['pact:trade']);
    expect(pactOf(a.c, 'trade', 0, a.rival)).toBeTruthy();
    expect(a.c.pactOffer).toBeUndefined();
    const b = world(7);
    b.c.pactOffer = { kind: 'trade', from: b.rival, turn: b.c.turn };
    expect(sensibleAnswers(b.c)).toEqual([]);
    expect(pactOf(b.c, 'trade', 0, b.rival)).toBeFalsy();
    expect(b.c.pactOffer).toBeUndefined(); // answered all the same
  });

  it('a royal match: taken by the weaker player, who wants the peace; declined by the stronger', () => {
    const offer = (weaker: boolean) => {
      const w = world(8);
      houseOf(w.c, w.rival).heirs = [{ name: 'Osric', female: false, born: w.c.turn - HEIR_AGE - 4 }];
      w.c.armies = w.c.armies.filter((x) => x.owner === (weaker ? w.rival : 0));
      w.c.pactOffer = { kind: 'marriage', from: w.rival, turn: w.c.turn, wed: ['Osric', 'Elin'] };
      return w;
    };
    const weak = offer(true);
    expect(sensibleAnswers(weak.c)).toEqual(['pact:marriage']);
    expect(wedPeace(weak.c, 0, weak.rival)).toBe(true);
    const strong = offer(false);
    expect(sensibleAnswers(strong.c)).toEqual([]);
    expect(wedPeace(strong.c, 0, strong.rival)).toBe(false);
    expect(strong.c.pactOffer).toBeUndefined();
    expect(strong.c.log.some((l) => /You decline .*offer of a match/.test(l))).toBe(true);
  });

  it('a match between peoples equally strong is declined: only the weaker side takes one', () => {
    const w = world(8);
    houseOf(w.c, w.rival).heirs = [{ name: 'Osric', female: false, born: w.c.turn - HEIR_AGE - 4 }];
    w.c.armies = [];
    w.c.pactOffer = { kind: 'marriage', from: w.rival, turn: w.c.turn, wed: ['Osric', 'Elin'] };
    expect(sensibleAnswers(w.c)).toEqual([]);
    expect(wedPeace(w.c, 0, w.rival)).toBe(false);
  });

  it('answering for a rival\'s people leaves the player\'s offers and stories alone', () => {
    const { c, at, rival } = world(9);
    const t = beginThief(c, at);
    c.truces.push({ with: rival, until: c.turn + 6 });
    c.pactOffer = { kind: 'trade', from: rival, turn: c.turn };
    expect(sensibleAnswers(c, rival)).toEqual([]);
    expect(t.watch).toBeFalsy();
    expect(c.pactOffer).toBeDefined();
  });
});
