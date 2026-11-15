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
