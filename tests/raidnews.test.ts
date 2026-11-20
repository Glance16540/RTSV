// The season's news of the bands, as plain data (src/sim/raidnews.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { seasonNews, tally } from '../src/sim/raidnews';
import { threatsOfMen } from '../src/sim/bandseason';
import type { Band } from '../src/sim/threats';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';

describe('the season\'s news', () => {
  it('gives every strike on a people\'s towns with its whole report and where to look, and nothing of another people\'s', () => {
    const c = newCampaign(11, 2);
    c.fronts = [];
    const t = c.territories.find((x) => x.owner === 0)!;
    for (const id of t.adj) c.territories[id].owner = -1;
    c.armies = c.armies.filter((a) => a.at !== t.id);
    t.buildings = []; delete t.town;
    Object.assign(folkOf(c, t.id), { men: 1 * S, women: 8 * S, elders: 0, children: 2 * S }); // as many as that was of a town (township.ts TOWN_SCALE)
    const b: Band = { id: 900, kind: 'raiders', name: 'the Test Men', at: t.id, strength: 9, since: c.turn, held: [] };
    c.bands = [b];
    let news = seasonNews(c);
    for (let i = 0; i < 60 && !news.some((n) => n.kind === 'raid'); i++) { c.turn++; b.since = c.turn; b.strength = 9; threatsOfMen(c); news = seasonNews(c); }
    const raid = news.find((n) => n.kind === 'raid')!;
    expect(raid).toMatchObject({ turn: c.turn, at: t.id, land: t.name, band: 900, tone: 'bad' });
    expect(raid.headline).toContain('sacked');
    expect(raid.lines.length).toBeGreaterThan(3);
    expect(raid.raid!.outcome).toBe('taken');
    expect(news[0].kind).toBe('raid'); // strikes first
    expect(seasonNews(c, c.turn, 1).some((n) => n.at === t.id && n.kind === 'raid')).toBe(false);
    expect(seasonNews(c, c.turn - 1).some((n) => n.kind === 'raid' && n.turn === c.turn)).toBe(false);
    // It is plain data: it survives being written down and read back.
    expect(JSON.parse(JSON.stringify(news))).toEqual(news);
    const sum = tally(c);
    expect(sum.raids).toBeGreaterThan(0);
    expect(sum.taken).toBeGreaterThan(0);
    expect(sum.held + sum.raided + sum.taken).toBe(sum.raids);
    expect(sum.carried).toBe(raid.raid!.taken.women + raid.raid!.taken.men + (c.raids ?? []).filter((r) => r !== raid.raid).reduce((n, r) => n + r.taken.men + r.taken.women, 0));
  });

  it('tells a people of what else the bands did that touches them: one that came, and captives that were lost', () => {
    const c = newCampaign(11, 2);
    c.fronts = [];
    let came = false;
    for (c.turn = 3; c.turn < 60 && !came; c.turn++) { threatsOfMen(c); came = [0, 1, 2].some((f) => seasonNews(c, c.turn, f).some((n) => n.kind === 'came')); }
    expect(came).toBe(true);
    const t = c.territories.find((x) => x.owner === 0)!;
    const b: Band = { id: 950, kind: 'slavers', name: 'the Test Men', at: t.id, strength: 3, since: c.turn, held: [{ from: t.id, owner: 0, men: [70], women: [80], since: c.turn - 9 }] };
    c.bands = [b];
    threatsOfMen(c);
    const lost = seasonNews(c).find((n) => n.kind === 'lost')!;
    expect(lost).toMatchObject({ at: t.id, tone: 'bad', band: 950 });
    expect(lost.headline).toContain('sold on');
    expect(seasonNews(c, c.turn, 1).some((n) => n.kind === 'lost')).toBe(false);
  });
});

// The rules of the news, case by case, on strikes and notes set down by hand.
import type { Campaign } from '../src/sim/campaign';
import { BANDS, reportLine, reportText, softest, reachOf } from '../src/sim/threats';
import type { BandNote, Raid } from '../src/sim/threats';
import { bandIcon, heraldSeason } from '../src/sim/raidnews';
import { warned } from '../src/sim/heralds';

const quiet = (): Campaign => { const c = newCampaign(11, 2); c.fronts = []; c.raids = []; c.bandNews = []; c.bands = []; c.turn = 8; return c; };
const strike = (c: Campaign, over: Partial<Raid> = {}): Raid => ({
  turn: c.turn, band: 1, kind: 'raiders', name: 'the Red Hand', at: c.territories.find((t) => t.owner === 0)!.id, owner: 0, outcome: 'raided', force: 5, strength: 5,
  defence: { men: 2, works: 0, walls: 0, army: 0, guard: 0, spirit: 1, total: 2 }, killed: 1, taken: { men: 1, women: 2 }, names: [], stores: { food: 10, wood: 0, gold: 0, stone: 0 }, sway: 0, ...over,
});
const told = (c: Campaign, kind: BandNote['kind'], owners: number[], over: Partial<BandNote> = {}): BandNote => {
  const n: BandNote = { turn: c.turn, kind, at: 0, band: 2, text: `a ${kind}`, owners, ...over };
  c.bandNews!.push(n);
  return n;
};

describe('the season\'s news, rule by rule', () => {
  it('is empty when nothing has happened, and with no record at all', () => {
    const c = quiet();
    expect(seasonNews(c)).toEqual([]);
    delete c.raids; delete c.bandNews;
    expect(seasonNews(c)).toEqual([]);
  });

  it('a strike held off is good news, one raided or taken bad; its headline and lines are the report\'s', () => {
    const c = quiet();
    const held = strike(c, { outcome: 'held', killed: 0, taken: { men: 0, women: 0 } }), raided = strike(c), taken = strike(c, { outcome: 'taken' });
    c.raids = [held, raided, taken];
    const news = seasonNews(c);
    expect(news.map((n) => n.tone)).toEqual(['good', 'bad', 'bad']);
    expect(news.every((n) => n.kind === 'raid')).toBe(true);
    news.forEach((n, i) => {
      expect(n.raid).toBe(c.raids![i]);
      expect(n.headline).toBe(reportLine(c, c.raids![i]));
      expect(n.lines).toEqual(reportText(c, c.raids![i]));
      expect(n.land).toBe(c.territories[n.at].name);
      expect(n.band).toBe(1);
    });
  });

  it('gives only the season asked for (this one by default) and only the people asked for', () => {
    const c = quiet();
    const other = c.territories.find((t) => t.owner === 1)!.id;
    c.raids = [strike(c, { turn: c.turn - 1 }), strike(c), strike(c, { owner: 1, at: other })];
    expect(seasonNews(c)).toHaveLength(1);
    expect(seasonNews(c)[0].turn).toBe(c.turn);
    expect(seasonNews(c, c.turn - 1)).toHaveLength(1);
    expect(seasonNews(c, c.turn - 1)[0].turn).toBe(c.turn - 1);
    expect(seasonNews(c, c.turn, 1).map((n) => n.at)).toEqual([other]);
    expect(seasonNews(c, c.turn, 2)).toEqual([]);
  });

  it('a band\'s doings reach every people it concerns, each with the tone it has for them', () => {
    const c = quiet();
    const want: Record<string, string> = { came: 'bad', moved: 'plain', fled: 'good', settled: 'bad', gone: 'good', broken: 'good', beaten: 'bad', freed: 'good', lost: 'bad', warned: 'bad', overran: 'bad', ambush: 'bad', robbed: 'bad', seen: 'plain' };
    for (const k of Object.keys(want)) told(c, k as BandNote['kind'], [0, 1]);
    const news = seasonNews(c);
    expect(news.map((n) => n.kind)).toEqual(Object.keys(want));
    for (const n of news) {
      expect(n.tone).toBe(want[n.kind]);
      expect(n.lines).toEqual([n.headline]);
      expect(n.raid).toBeUndefined();
    }
    expect(seasonNews(c, c.turn, 1)).toHaveLength(news.length);
    expect(seasonNews(c, c.turn, 2)).toEqual([]);
  });

  it('strikes come first, then the rest in the order it happened', () => {
    const c = quiet();
    told(c, 'came', [0], { text: 'first' });
    told(c, 'moved', [0], { text: 'second' });
    c.raids = [strike(c)];
    told(c, 'fled', [0], { text: 'third' });
    expect(seasonNews(c).map((n) => n.kind === 'raid' ? 'raid' : n.headline)).toEqual(['raid', 'first', 'second', 'third']);
  });

  it('tally counts the strikes by outcome, the people carried off and killed, and the bands on the map', () => {
    const c = quiet();
    expect(tally(c)).toEqual({ raids: 0, held: 0, raided: 0, taken: 0, carried: 0, killed: 0, bands: 0 });
    delete c.raids; delete c.bands;
    expect(tally(c)).toEqual({ raids: 0, held: 0, raided: 0, taken: 0, carried: 0, killed: 0, bands: 0 });
    c.raids = [strike(c, { outcome: 'held', killed: 2, taken: { men: 0, women: 0 } }), strike(c, { killed: 1, taken: { men: 3, women: 4 } }), strike(c, { outcome: 'taken', turn: 1, killed: 0, taken: { men: 0, women: 5 } })];
    c.bands = [{ id: 1, kind: 'raiders', name: 'x', at: 0, strength: 3, since: 0, held: [] }];
    expect(tally(c)).toEqual({ raids: 3, held: 1, raided: 1, taken: 1, carried: 12, killed: 3, bands: 1 });
  });

  it('bandIcon is each kind\'s own icon', () => {
    for (const k of Object.keys(BANDS) as (keyof typeof BANDS)[]) expect(bandIcon(k)).toBe(BANDS[k].icon);
  });
});

describe('the heralds\' season', () => {
  const marked = (study: boolean, kind: 'raiders' | 'marauders' = 'raiders') => {
    const c = quiet();
    const t = c.territories.find((x) => x.owner === 0)!;
    c.factions[0].studies = study ? ['heralds'] : [];
    c.bands = [{ id: 31, kind, name: 'the Crows', at: t.id, strength: 6, since: c.turn, held: [] }];
    return { c, t };
  };

  it('a people that keeps heralds is told of a band that has a town of theirs for its mark, and that town is warned', () => {
    const { c } = marked(true);
    const b = c.bands![0];
    const mark = softest(c, b, reachOf(c, b))!;
    expect(c.territories[mark.id].owner).toBe(0); // on this map the band's only reach is the player's own town
    const out: string[] = [];
    const got = heraldSeason(c, out);
    {
      expect(got).toEqual([mark.id]);
      expect(warned(c, mark.id)).toBe(true);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatch(/^Heralds bring word: the Crows, raiders of strength 6, have /);
      const w = seasonNews(c).find((n) => n.kind === 'warned')!;
      expect(w).toMatchObject({ at: mark.id, tone: 'bad', band: 31 });
      expect(seasonNews(c, c.turn, 1).some((n) => n.kind === 'warned')).toBe(false);
    }
  });

  it('no heralds, no word; marauders are never told of; a town is warned once however many bands mark it', () => {
    const none = marked(false);
    expect(heraldSeason(none.c)).toEqual([]);
    expect(none.c.bandNews).toEqual([]);
    const horde = marked(true, 'marauders');
    expect(heraldSeason(horde.c)).toEqual([]);
    const two = marked(true);
    const b = two.c.bands![0];
    two.c.bands!.push({ ...b, id: 32, name: 'the Wolves' });
    const first = heraldSeason(two.c);
    expect(first).toHaveLength(1);
    expect(two.c.bandNews!.filter((n) => n.kind === 'warned')).toHaveLength(first.length);
  });
});
