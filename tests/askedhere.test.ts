// The dilemmas a town has been asked, kept on its record from visit to visit (src/sim/askedhere.ts).
import { describe, expect, it } from 'vitest';
import { askedFor, askedOut, keepAsked } from '../src/sim/askedhere';
import { DILEMMAS } from '../src/sim/creed';
import { nextDilemma } from '../src/sim/dilemmas';
import { newCampaign } from '../src/sim/campaign';
import { beginVisit, finishVisit, visitConfig } from '../src/sim/visit';
import { Game } from '../src/sim/game';

const enter = (c: ReturnType<typeof newCampaign>, tid: number): Game => {
  expect(beginVisit(c, tid)).toBe(true);
  const cfg = visitConfig(c)!;
  return new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
};

describe('the dilemmas a town was asked', () => {
  it('go home with a visit and come back into the next, so the round goes on', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), tid = c.territories.find((t) => t.capital === 0)!.id;
    let g = enter(c, tid);
    expect(g.players[0].asked).toBeUndefined();
    const first = [nextDilemma(g, 0, DILEMMAS), nextDilemma(g, 0, DILEMMAS), nextDilemma(g, 0, DILEMMAS)];
    finishVisit(c, { asked: askedOut(g, 0) });
    expect(askedFor(c, tid)).toEqual(first);
    c.turn++;
    g = enter(c, tid);
    expect(g.players[0].asked).toEqual(first);
    expect(first).not.toContain(nextDilemma(g, 0, DILEMMAS)); // not asked again until the round is through
  });

  it('keeps only names of dilemmas there are, only for a town of the player\'s, and at most a round', () => {
    const c = newCampaign(7, 1, 1, 'hearth'), mine = c.territories.find((t) => t.owner === 0)!, theirs = c.territories.find((t) => t.owner === 1)!;
    keepAsked(c, mine.id, ['harvest', 'nonsense', 3, 'harvest', 'toll']);
    expect(mine.asked).toEqual(['harvest', 'toll']);
    keepAsked(c, theirs.id, ['harvest']);
    expect(theirs.asked).toBeUndefined();
    keepAsked(c, mine.id, [...DILEMMAS.map((d) => d.id), ...DILEMMAS.map((d) => d.id)]);
    expect(mine.asked!.length).toBeLessThanOrEqual(DILEMMAS.length);
    keepAsked(c, mine.id, []);
    expect(mine.asked).toBeUndefined();
  });
});
