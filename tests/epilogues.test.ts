// A campaign's own ending: what became of the threads, the people of note and the houses (src/sim/epilogues.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, answerDemand, continueAI, endTurn, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';
import { epilogue } from '../src/sim/story';
import { EPILOGUE, ending, houseFates, peopleFates, threadFates } from '../src/sim/epilogues';
import { sensibleAnswers } from '../src/sim/storypolicy';
import { HEIR_AGE } from '../src/sim/dynasty';

const CHILD = /\b(child|children|childhood|baby|babies|infant|boy|boys|girl|girls|kid|kids|youngster|orphan)\b/i;
const SUGGESTIVE = /\b(bed|bedded|naked|lust|kiss|seduce|harlot|whore|brothel|mistress)\b/i;

const over = (seed = 7) => { const c = newCampaign(seed, 1, 1, 'steppe'); c.turn = 60; c.phase = 'over'; c.winner = 0; return c; };
const cap = (c: Campaign) => c.territories.find((t) => t.capital === 0)!;

describe('the ending told whole', () => {
  it('is told only once the campaign is over, after the summing-up', () => {
    const c = newCampaign(7, 1, 1, 'steppe');
    expect(ending(c)).toEqual([]);
    c.phase = 'over'; c.winner = 0;
    const page = epilogue(c), more = ending(c);
    expect(more.length).toBeGreaterThan(0);
    expect(page.slice(-more.length)).toEqual(more);
  });

  it('tells how each thread ended, was left unfinished, or was still open', () => {
    const c = over(), land = cap(c).id;
    c.answers = [
      { id: 'exile', choice: 'a', turn: 4, land, rival: 1, tribe: -1 }, { id: 'exile_home', choice: 'a', turn: 8, land, rival: 1, tribe: -1 }, { id: 'exile_crowned', choice: 'b', turn: 12, land, rival: 1, tribe: -1 },
      { id: 'relics', choice: 'a', turn: 20, land, rival: 1, tribe: -1 }, { id: 'cure', choice: 'b', turn: 24, land, rival: 1, tribe: -1 },
    ];
    c.threadEnds = [
      { root: 'exile', last: 'exile_crowned', choice: 'b', from: 4, to: 12, how: 'ended', land, rival: 1, tribe: -1, steps: 3 },
      { root: 'hunger', last: 'tribe_grudge', choice: 'b', from: 14, to: 18, how: 'dropped', land, rival: 1, tribe: land, steps: 2 },
    ];
    const lines = threadFates(c);
    expect(lines[0]).toBe('Of the exile at the gate: The prince paid what you asked, and never asked anything of you again.');
    expect(lines[1]).toBe(`Of the hungry tribe: it was never finished, for ${cap(c).name} was no longer a free people before it could be.`);
    expect(lines[2]).toBe('Of the saint\'s bones: it was still unfinished when the story ended; so far you built a shrine over the bones and charged at the shrine door.');
    expect(lines.length).toBe(3);
    for (const l of lines) expect(l).not.toMatch(/[{}]/);
  });

  it('names the ruler, the household, the grown heirs and the circle, and never a child', () => {
    const c = over(), me = c.factions[0];
    me.house = { heirs: [{ name: 'Aldric', female: false, born: 0 }, { name: 'Wenna', female: true, born: c.turn - 4 }], line: 3, births: 2, due: 99 };
    (me.house.heirs[0] as { wedTo?: { key: string; name: string } }).wedTo = { key: 'house:1', name: 'Berta of the house of Odo' };
    me.kin = { leader: 'x', spouse: { name: 'Hild', female: true, born: 0, of: 'Eastmarch', lost: { turn: 40, how: 'died' } }, circle: [{ post: 'marshal', name: 'Osric Wyn', female: false, family: 'Wyn', town: cap(c).id, loyalty: 90, feeling: 'warm' as never, since: 1 }], seen: { lands: 0 } };
    const lines = peopleFates(c);
    expect(lines[0]).toMatch(/^The third to lead your people in this story, .+, ruled at the end\.$/);
    expect(lines).toContain(`Hild, the ruler's wife, died in year 11.`);
    expect(lines).toContain('Aldric, of the ruling house, was wed to Berta of the house of Odo when the story ended.');
    expect(lines.join(' ')).not.toContain('Wenna'); // not of age: no figure here
    expect(c.turn - me.house.heirs[1].born).toBeLessThan(HEIR_AGE);
    expect(lines).toContain('Osric Wyn, marshal, loyal to the end.'); // the family is not said twice
  });

  it('tells the lords, a plotter by how the plot ended, a grown claimant, and the most renowned of the towns', () => {
    const c = over(), me = c.factions[0], t = cap(c);
    me.nobles = [
      { key: 'a', name: 'Edwin', female: false, town: t.id, rank: 'lord', leaning: 'pious', mood: 80 },
      { key: 'b', name: 'Morcar', female: false, town: t.id, rank: 'captain', leaning: 'martial', mood: 10 },
      { key: 'c', name: 'Aelfgifu', female: true, town: t.id, rank: 'lord', leaning: 'kindly', mood: 50 },
    ];
    c.intrigues = [{ id: 1, kind: 'plot', owner: 0, at: t.id, since: 30, people: [], culprit: 0, victims: [], taken: 0, robbed: [], clues: [], cleared: [], watched: 0, nobles: [{ key: 'b', name: 'Morcar', title: `Captain Morcar of ${t.name}`, female: false }], ended: { turn: 34, how: 'executed', text: '' } }];
    c.claims = [{ id: 1, owner: 0, mother: 'Hild', parent: 'noble', by: 'a lord', town: t.id, born: 0, name: 'Harald', female: false, grown: 40 }, { id: 2, owner: 0, mother: 'Hild', parent: 'band', by: 'a band', town: t.id, born: 50 }];
    t.folk = { men: 5, women: 5, elders: 0, children: 2, stores: { food: 0, wood: 0, gold: 0, stone: 0 } as never, notables: [
      { name: 'Wulf', family: 'Ash', gender: 'm', kind: 'veteran', deed: '', turn: 10, kills: 12 },
      { name: 'Ida Ash', family: 'Ash', gender: 'f', kind: 'mother', deed: 'raised 6 children', turn: 10, kids: 6 },
      { name: 'Cuth', family: 'Elm', gender: 'm', kind: 'veteran', deed: '', turn: 10, kills: 3, lost: { turn: 44, how: 'died of plague' } },
    ] };
    const lines = peopleFates(c);
    expect(lines).toContain(`Lord Edwin of ${t.name} was the crown's friend to the end.`);
    expect(lines).toContain(`Captain Morcar of ${t.name} plotted for the throne in year 8, and was put to death for it.`);
    expect(lines).toContain(`Lady Aelfgifu of ${t.name} kept faith with the crown.`);
    expect(lines).toContain('Harald, with a claim to your throne, was still waiting when the story ended.');
    expect(lines.filter((l) => l.includes('claim to your throne')).length).toBe(1); // the one not of age is not told
    const wulf = lines.findIndex((l) => l.startsWith('Wulf Ash, a veteran')), cuth = lines.findIndex((l) => l.startsWith('Cuth Elm'));
    expect(wulf).toBeGreaterThan(-1);
    expect(lines[wulf]).toBe(`Wulf Ash, a veteran of ${t.name} who felled 12 in war, lived out their days there.`);
    expect(lines[cuth]).toBe(`Cuth Elm, a veteran of ${t.name} who felled 3 in war, died of plague in year 12.`);
    expect(lines).toContain(`Ida Ash, at the head of a notable house of ${t.name}, lived out their days there.`);
    expect(lines.join(' ')).not.toMatch(CHILD); // a notable home is told by its house, never its children
  });

  it('tells the houses: your own, those it married into, and the great houses of the towns', () => {
    const c = over(), me = c.factions[0], t = cap(c);
    me.dynasty = 'Ashby';
    me.house = { heirs: [{ name: 'Aldric', female: false, born: 0 }], line: 2, births: 1, due: 99 };
    c.pacts = [{ kind: 'marriage', a: 0, b: 1, since: 20, until: 44, wed: ['Aldric', 'Berta'] }];
    c.intrigues = [{ id: 2, kind: 'suitor', owner: 0, at: t.id, since: 30, people: [], culprit: -1, victims: [], taken: 0, robbed: [], clues: [], cleared: [], watched: 0, rival: 1, cast: { daughter: 'Eadgyth', suitor: 'Ragnar' }, ended: { turn: 36, how: 'wed', text: '' } }];
    t.folk = { men: 5, women: 5, elders: 0, children: 0, stores: {} as never, notables: [{ name: 'Ida', family: 'Ash', gender: 'f', kind: 'mother', deed: '', turn: 1 }, { name: 'Bea', family: 'Elm', gender: 'f', kind: 'mother', deed: '', turn: 1 }] };
    const lines = houseFates(c);
    expect(lines[0]).toBe('The house of Ashby gave your people 2 rulers in this story, and had one heir of age at its end.');
    expect(lines[1]).toMatch(new RegExp(`^The house of .+ of the ${c.factions[1].name} was joined to yours in year 6, when Aldric wed Berta; the peace it made had run its course\\.$`));
    expect(lines[2]).toBe(`Eadgyth of your house was given in marriage to Ragnar of the ${c.factions[1].name} in year 10.`);
    expect(lines[3]).toBe(`The great houses of ${t.name} at the end: the houses of Ash and Elm.`);
    expect(lines.length).toBeLessThanOrEqual(EPILOGUE.houses);
  });

  it('in campaigns played to the end: every line filled in, no child, nothing suggestive, the same when saved', () => {
    for (const seed of [3, 8]) {
      const c = newCampaign(seed, 3);
      for (let i = 0; i < 120 && c.phase !== 'over'; i++) {
        sensibleAnswers(c, 0);
        for (let k = 0; k < 40 && c.phase === 'player'; k++) { playForPlayer(c); if (c.pending) resolvePending(c, 'auto'); else break; }
        endTurn(c);
        for (let k = 0; k < 200 && c.phase === 'ai'; k++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
        if (c.pending) resolvePending(c, 'auto');
      }
      c.phase = 'over';
      const lines = ending(c);
      expect(lines.length, `${seed}`).toBeGreaterThan(5);
      expect(threadFates(c).length, `${seed}`).toBeGreaterThan(0);
      for (const l of lines) { expect(l).not.toMatch(/[{}]|undefined|NaN/); expect(l).not.toMatch(CHILD); expect(l).not.toMatch(SUGGESTIVE); }
      expect(ending(JSON.parse(JSON.stringify(c)) as Campaign)).toEqual(lines);
    }
  }, 300_000);
});
