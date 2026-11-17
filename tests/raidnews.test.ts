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
