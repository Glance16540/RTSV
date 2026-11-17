// A dip does not undo dominion (src/sim/dominion.ts; docs/DESIGN.md, the owner's word).
import { describe, expect, it } from 'vitest';
import { DOMINION_TURNS, continueAI, dominionNeed, endTurn, landOf, newCampaign, resolvePending } from '../src/sim/campaign';
import { DOMINION_DIP, dominionNext } from '../src/sim/dominion';
import { primerPage } from '../src/sim/primer';

describe('the count toward rule beyond challenge', () => {
  it('rises a turn for every season the share is held', () => {
    expect(dominionNext({ f: -1, turns: 0 }, 2)).toEqual({ f: 2, turns: 1 });
    expect(dominionNext({ f: 2, turns: 1 }, 2)).toEqual({ f: 2, turns: 2 });
    expect(dominionNext(undefined, 0)).toEqual({ f: 0, turns: 1 });
  });

  it('a season under the share takes two turns off, not all of it', () => {
    expect(DOMINION_DIP).toBe(2);
    expect(dominionNext({ f: 0, turns: 9 }, -1)).toEqual({ f: 0, turns: 7 });
    expect(dominionNext({ f: 0, turns: 7 }, 0)).toEqual({ f: 0, turns: 8 }); // back over the share: it goes on from where it stood
    expect(dominionNext({ f: 0, turns: 3 }, -1)).toEqual({ f: 0, turns: 1 });
  });

  it('with nothing left it is gone, and nobody\'s count stays nobody\'s', () => {
    expect(dominionNext({ f: 0, turns: 2 }, -1)).toEqual({ f: -1, turns: 0 });
    expect(dominionNext({ f: 0, turns: 1 }, -1)).toEqual({ f: -1, turns: 0 });
    expect(dominionNext({ f: -1, turns: 0 }, -1)).toEqual({ f: -1, turns: 0 });
  });

  it('another people coming to the share begins its own count, and a people that is no more has none', () => {
    expect(dominionNext({ f: 0, turns: 9 }, 1)).toEqual({ f: 1, turns: 1 });
    expect(dominionNext({ f: 0, turns: 9 }, -1, false)).toEqual({ f: -1, turns: 0 });
  });

  it('nine turns, a dip, and three more is a won war: a single rising does not throw it away', () => {
    let d = { f: 0, turns: 9 };
    d = dominionNext(d, -1);
    for (let i = 0; i < 3; i++) d = dominionNext(d, 0);
    expect(d.turns).toBe(DOMINION_TURNS);
  });
});

describe('on the map', () => {
  /** A season, with anything waiting on the player settled from the map. */
  const season = (c: ReturnType<typeof newCampaign>): void => {
    endTurn(c);
    for (let i = 0; i < 200 && c.phase === 'ai'; i++) { if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
    if (c.pending) resolvePending(c, 'auto');
  };

  it('a people that falls under the share keeps its count, two turns the less, and the chronicle says so', () => {
    const c = newCampaign(7, 1, 1, 'hearth');
    expect(landOf(c, 0)).toBeLessThan(dominionNeed(c));
    c.dominion = { f: 0, turns: 9 };
    season(c);
    expect(c.dominion).toEqual({ f: 0, turns: 7 });
    expect(c.log.join('\n')).toContain(`You no longer hold most of the land: 7 of the ${DOMINION_TURNS} turns still stand to your count.`);
    expect(c.phase).not.toBe('over');
  });

  it('the first orders say it', () => {
    const c = newCampaign(7, 1, 1, 'hearth');
    expect(primerPage(c).at(-1)!.lines[0]).toContain(`a season under that takes ${DOMINION_DIP} turns off the count`);
  });
});
