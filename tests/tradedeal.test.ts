// Trade deals between peoples at peace (src/sim/tradedeal.ts): their markets open to each other's caravans for a
// term, with gold to each; offered and answered by rulers, rivals by the same rules.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { marketsOpen, pactOf } from '../src/sim/pacts';
import { TRADE, answerTrade, offerTrade, tradeBar, tradeSeason } from '../src/sim/tradedeal';
import { folkOf } from '../src/sim/township';
import { MARRY } from '../src/sim/royalmarriage';

function world(): { c: Campaign; r1: number; r2: number } {
  const c = newCampaign(13, 3, 1, 'hearth');
  c.turn = 40;
  const [r1, r2] = c.factions.filter((f) => f.id > 0 && f.alive).map((f) => f.id);
  return { c, r1, r2 };
}
const chiefGold = (c: Campaign, f: number): number => folkOf(c, c.territories.find((t) => t.capital === f)!.id).stores.gold;

describe('trade deals', () => {
  it('only peoples at peace trade, and only once at a time', () => {
    const { c, r1 } = world();
    expect(tradeBar(c, 0, r1)).toContain('a truce first');
    c.truces = [{ with: r1, until: c.turn + 10 }];
    expect(tradeBar(c, 0, r1)).toBe('');
    c.pacts = [{ kind: 'trade', a: r1, b: 0, since: c.turn, until: c.turn + 5 }];
    expect(tradeBar(c, 0, r1)).toContain('already');
  });

  it('signed, each side\'s chief town has gold, and their markets are open to each other until the term runs out', () => {
    const { c, r1 } = world();
    c.truces = [{ with: r1, until: c.turn + 40 }];
    const mine = chiefGold(c, 0), theirs = chiefGold(c, r1);
    let done = 'not yet';
    for (let t = 0; t < 40 && done !== ''; t++) { c.turn++; delete c.factions[r1].refused; done = offerTrade(c, r1); }
    expect(done).toBe('');
    expect(chiefGold(c, 0)).toBe(mine + TRADE.gold);
    expect(chiefGold(c, r1)).toBe(theirs + TRADE.gold);
    expect(marketsOpen(c, 0, r1)).toBe(true);
    c.turn = pactOf(c, 'trade', 0, r1)!.until + 1;
    expect(marketsOpen(c, 0, r1)).toBe(false);
    expect(marketsOpen(c, 3, 3)).toBe(true); // a people's own markets always are
  });

  it('a rival offers the player a deal; accepted, it is signed', () => {
    const { c, r1 } = world();
    c.truces = [{ with: r1, until: c.turn + 10 }];
    c.pactOffer = { kind: 'trade', from: r1, turn: c.turn };
    expect(answerTrade(c, true)).toBe(true);
    expect(marketsOpen(c, 0, r1)).toBe(true);
    c.pactOffer = { kind: 'trade', from: r1, turn: c.turn };
    expect(answerTrade(c, false)).toBe(false);
    expect(c.pactOffer).toBeUndefined();
  });

  it('two rivals at peace by a royal marriage trade by the same rules; two at war never do', () => {
    const { c, r1, r2 } = world();
    for (let t = 0; t < 200; t++) { c.turn++; tradeSeason(c); }
    expect(marketsOpen(c, r1, r2)).toBe(false);
    let opened = 0;
    for (let t = 0; t < 200; t++) {
      c.turn++;
      c.pacts = [{ kind: 'marriage', a: r1, b: r2, since: c.turn, until: c.turn + MARRY.seasons }];
      tradeSeason(c);
      if (marketsOpen(c, r1, r2)) opened++;
    }
    expect(opened).toBeGreaterThan(0);
  });
});
