// The first story of the house comes early (src/sim/courtstory.ts): from season COURT.from, and a rival's envoy three
// times as likely until the first has come, so a new player meets one face to face (the playtest of 17 November).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { COURT, courtBegin } from '../src/sim/courtstory';
import { kinOf } from '../src/sim/kin';
import { houseOf } from '../src/sim/dynasty';

const base = JSON.stringify(newCampaign(5, 2));
const world = (seed: number, turn: number): Campaign => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = turn; c.phase = 'player';
  kinOf(c, 0);
  houseOf(c, 0).heirs = []; // no grown daughter: only the envoy (or a plot) can come
  return c;
};

describe('the first story of the house', () => {
  it('may come from season COURT.from, not before', () => {
    let before = 0, at = 0;
    for (let seed = 1; seed <= 300; seed++) { before += courtBegin(world(seed, COURT.from - 1)).length; at += courtBegin(world(seed, COURT.from)).length; }
    expect(before).toBe(0);
    expect(at).toBeGreaterThan(0);
    expect(COURT.from).toBeLessThanOrEqual(6);
  });

  it('a rival\'s envoy is likelier until the first story has come', () => {
    let first = 0, later = 0;
    for (let seed = 1; seed <= 400; seed++) {
      first += courtBegin(world(seed, 30)).filter((it) => it.kind === 'rival').length;
      const c = world(seed, 30);
      (c.intrigues ??= []).push({ id: 999, kind: 'suitor', owner: 0, at: 0, since: 0, people: [], culprit: -1, victims: [], taken: 0, robbed: [], clues: [], cleared: [], watched: 0, ended: { turn: 0, how: 'wed', text: '' } });
      c.intrigueSeq = 999;
      later += courtBegin(c).filter((it) => it.kind === 'rival').length;
    }
    expect(first).toBeGreaterThan(2 * later);
  });
});
