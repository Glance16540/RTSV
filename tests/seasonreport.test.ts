// The season's report (src/sim/seasonreport.ts, src/sim/ledger.ts): what changed in the player's nation in a season,
// and for whom.
import { describe, expect, it } from 'vitest';
import { answerDemand, continueAI, endTurn, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { LEDGER_SEASONS, ledgerSince, tally } from '../src/sim/ledger';
import { anything, reportDue, reportLines, reportSince, seasonTurned, snapshot } from '../src/sim/seasonreport';
import { folkOf } from '../src/sim/township';
import { THREATS } from '../src/sim/threats';

const world = (): Campaign => newCampaign(5, 1, 1, 'hearth');
const home = (c: Campaign) => c.territories.find((t) => t.capital === 0)!;
const other = (c: Campaign) => c.territories.find((t) => t.owner < 0 && !t.horde)!;
/** End the player's turn and play everyone else's to the next. */
const turn = (c: Campaign) => {
  endTurn(c);
  for (let i = 0; i < 80 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
};

describe('the ledger', () => {
  it('notes what happened to a town\'s people, under its holder, and hands back what is new', () => {
    const c = world(), h = home(c);
    tally(c, h.id, 'born', 2);
    tally(c, h.id, 'aged', 0); // nothing to note
    const seq = c.ledgerSeq!;
    tally(c, h.id, 'starved', 1);
    expect(c.ledger!.map((e) => [e.kind, e.n, e.owner])).toEqual([['born', 2, 0], ['starved', 1, 0]]);
    expect(ledgerSince(c, seq).map((e) => e.kind)).toEqual(['starved']);
  });
  it('keeps only the last few seasons', () => {
    const c = world(), h = home(c);
    tally(c, h.id, 'born', 1);
    c.turn += LEDGER_SEASONS + 1;
    tally(c, h.id, 'born', 1);
    expect(c.ledger!.length).toBe(1);
  });
});

describe('a season\'s report', () => {
  it('counts the people, and names the known', () => {
    const c = world(), h = home(c), t = other(c), f = folkOf(c, h.id);
    f.notables.push({ name: 'Maren', gender: 'f', kind: 'mother', deed: 'raised 3 children', turn: 0, kids: 3 });
    const s = snapshot(c);
    tally(c, h.id, 'born', 3); tally(c, h.id, 'grew', 1); tally(c, h.id, 'aged', 2); tally(c, h.id, 'starved', 1); tally(c, h.id, 'fell', 4);
    tally(c, t.id, 'born', 9); // not the player's town: not theirs to hear of
    f.drifted = { tavern: 2, mines: 1 };
    f.notables.find((n) => n.name === 'Maren')!.lost = { turn: c.turn, how: 'killed' };
    f.notables.push({ name: 'Bram', gender: 'm', kind: 'veteran', deed: 'felled 4 in battle as a spearman', turn: c.turn + 1, kills: 4, unit: 'spearman' });
    t.owner = 0;
    const r = reportSince(c, s);
    expect(r).toMatchObject({ born: 3, grew: 1, aged: 2, starved: 1, fell: 4, drifted: { tavern: 2, mines: 1, home: 0 }, won: [t.name] });
    expect(r.made.map((n) => n.name)).toEqual(['Bram']);
    expect(r.gone.map((n) => [n.name, n.how])).toEqual([['Maren', 'killed']]);
  });
  it('says which towns rose, which were lost, and who drifted back to their work', () => {
    const c = world(), h = home(c), f = folkOf(c, h.id);
    const second = c.territories.find((t) => t.owner < 0 && !t.horde && t.id !== h.id)!;
    second.owner = 0;
    folkOf(c, h.id).drifted = { tavern: 3, mines: 0 };
    const s = snapshot(c);
    f.drifted = { tavern: 1, mines: 0 };
    second.owner = -1;
    (c.events ??= []).push({ kind: 'revolt', at: second.id, turn: c.turn + 1, until: c.turn + 1 });
    c.turn++;
    const r = reportSince(c, s);
    expect(r.drifted.home).toBe(2);
    expect(r.rose).toEqual([second.name]);
    expect(r.lost).toEqual([]);
  });
  it('the player\'s people held by bands: taken, got back in time, or held too long', () => {
    const c = world(), h = home(c);
    const band = (id: number, since: number, n: number) => ({ id, kind: 'raiders', name: 'the Crows', at: other(c).id, strength: 3, since: 0, held: [{ from: h.id, owner: 0, men: Array(n).fill(80), women: [], since }] });
    c.bands = [band(1, c.turn, 2), band(2, c.turn - THREATS.holdFor + 1, 3)] as unknown as Campaign['bands'];
    const s = snapshot(c);
    c.turn += 1;
    // The first band is broken in time; the second's captives are held too long; a third takes someone.
    c.bands = [band(3, c.turn, 1)] as unknown as Campaign['bands'];
    const r = reportSince(c, s);
    expect(r).toMatchObject({ taken: 1, back: 2, lostForGood: 3 });
  });
  it('raids on the player\'s towns are folded in, with their report line', () => {
    const c = world(), h = home(c), s = snapshot(c);
    (c.raids ??= []).push({ turn: c.turn + 1, band: 1, kind: 'raiders', name: 'the Crows', at: h.id, owner: 0, outcome: 'raided', force: 3, defence: { total: 2 }, killed: 1, taken: { men: 0, women: 1 }, names: [], stores: { food: 10, wood: 0, gold: 0, stone: 0 }, sway: 0 } as unknown as NonNullable<Campaign['raids']>[number]);
    c.turn++;
    const r = reportSince(c, s);
    expect(r.raids).toHaveLength(1);
    expect(r.raids[0]).toMatchObject({ at: h.id, outcome: 'raided' });
    expect(r.raids[0].line.length).toBeGreaterThan(0);
  });
  it('only lines with something in them', () => {
    const c = world(), s = snapshot(c);
    const quiet = reportSince(c, s);
    expect(anything(quiet)).toBe(false);
    expect(reportLines(quiet)).toEqual([]);
    tally(c, home(c).id, 'born', 1);
    const lines = reportLines(reportSince(c, s));
    expect(lines.map((l) => l.text)).toEqual(['1 child was born.']);
  });
});

describe('as the seasons turn', () => {
  it('a report of the season past waits for the player until seen, and a quiet season leaves none', () => {
    const c = world();
    turn(c);
    expect(c.seasonFrom?.turn).toBe(c.turn);
    for (let i = 0; i < 12 && !reportDue(c); i++) turn(c);
    const r = reportDue(c)!;
    expect(r).toBeTruthy();
    expect(r.turn).toBe(c.turn);
    expect(anything(r)).toBe(true);
    // What the ledger says of the player's towns this season is what the report counts.
    const born = ledgerSince(c, 0).filter((e) => e.owner === 0 && e.kind === 'born' && e.turn > r.from).reduce((n, e) => n + e.n, 0);
    expect(r.born).toBe(born);
    r.seen = true;
    expect(reportDue(c)).toBeNull();
    // A season in which nothing at all changed leaves nothing waiting.
    const s = snapshot(c);
    c.seasonFrom = s;
    seasonTurned(c);
    expect(reportDue(c)).toBeNull();
  });
});
