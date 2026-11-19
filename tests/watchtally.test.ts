// The Watch House's and Town Watch's rules read like for like (src/sim/watchtally.ts): each time a rule is applied,
// what happened beside what the same draw would have come to without it.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { INTRIGUE, beginKiller, beginThief, intrigueSeason } from '../src/sim/intrigue';
import { strike } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';
import { TOWNWATCH } from '../src/sim/townwatch';
import { WATCH } from '../src/sim/watchhouse';
import { tallyWatch } from '../src/sim/watchtally';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign with one roomy town of the player's that can begin nothing of its own, and that town. */
const world = (seed = 5): { c: Campaign; at: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 10; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 12 * S, women: 12 * S, elders: 2 * S, children: 6 * S });
  Object.assign(folkOf(c, t.id).stores, { food: 9000, wood: 0, gold: 9000, stone: 0 }); // no wood or stone: no governor raises a Watch House meanwhile
  c.factions[0].age = 1;
  return { c, at: t.id };
};
const stand = (c: Campaign, at: number): void => { const t = c.territories[at]; t.town ??= { at: 2, b: [['towncenter', 40, 40]] }; t.town.b.push(['watchhouse', 46, 40]); };
/** One season of a fresh thief or killer in the town, `n` times over, each a new story with its own draws. Returns the tally. */
function seasons(kind: 'thief' | 'killer', house: boolean, n: number, army = false) {
  const { c, at } = world();
  if (!army) c.armies = c.armies.filter((a) => a.at !== at); // an army in the town finds clues too (intrigue.ts)
  if (house) stand(c, at);
  for (let i = 0; i < n; i++) {
    c.intrigues = [];
    folkOf(c, at).stores.gold = 9000;
    Object.assign(folkOf(c, at), { men: 12 * S, women: 12 * S }); delete folkOf(c, at).ages;
    if (kind === 'thief') beginThief(c, at); else beginKiller(c, at);
    c.turn++; intrigueSeason(c);
  }
  return c.watchTally ?? {};
}

describe('the watch rules, like for like', () => {
  it('counts what happened beside what would have', () => {
    const { c } = world();
    tallyWatch(c, 'thief', true, false); tallyWatch(c, 'thief', true, true); tallyWatch(c, 'thief', false, false);
    expect(c.watchTally).toEqual({ thief: { n: 3, did: 2, would: 1 } });
  });
  it('a Watch House takes 15 more thieves in every hundred seasons than the same seasons with none', () => {
    const t = seasons('thief', true, 1500).thief!;
    expect(t.n).toBe(1500);
    const gain = (t.did - t.would) / t.n;
    expect(gain).toBeGreaterThan(WATCH.thief - 0.03);
    expect(gain).toBeLessThan(WATCH.thief + 0.03);
    expect(t.would / t.n).toBeGreaterThan(INTRIGUE.thief.luck - 0.03); // with none, the common luck
    expect(t.would / t.n).toBeLessThan(INTRIGUE.thief.luck + 0.03);
    expect(seasons('thief', false, 50).thief).toBeUndefined(); // no Watch House, nothing to read
  });
  it('a Watch House turns up 20 more clues to a killer in every hundred seasons, and the killer kills three times in four', () => {
    const t = seasons('killer', true, 1500);
    const clue = t.clue!, kill = t.kill!;
    expect(clue.n).toBe(1500);
    const gain = (clue.did - clue.would) / clue.n;
    expect(gain).toBeGreaterThan(WATCH.clue - 0.035);
    expect(gain).toBeLessThan(WATCH.clue + 0.035);
    expect(kill.n).toBeGreaterThan(1000);
    expect(kill.did / kill.would).toBeGreaterThan(WATCH.strike - 0.07);
    expect(kill.did / kill.would).toBeLessThan(WATCH.strike + 0.07);
    expect(kill.did).toBeLessThanOrEqual(kill.would); // it only ever stays a killing
    expect(seasons('killer', false, 50).clue).toBeUndefined();
  });
  it('where a clue is all but sure already, the Watch House can add only what is left of the hundred', () => {
    // The court in the town and an army standing there: 45 + 30 + 15 in the hundred without it. With it a clue is certain, which is 10 more and not 20.
    const { c, at } = world();
    const K = INTRIGUE.killer, sure = K.clue + K.court + K.army;
    if (!c.armies.some((a) => a.owner === 0 && a.at === at)) return; // this world's first town has the court and an army; if it ever has not, the case is not set up
    const t = seasons('killer', true, 1500, true).clue!;
    expect(t.did).toBe(t.n);
    expect((t.did - t.would) / t.n).toBeGreaterThan(1 - sure - 0.03);
    expect((t.did - t.would) / t.n).toBeLessThan(1 - sure + 0.03);
  });
  it('among a people with Town Watch seven thieves and killers begin for every ten that would have', () => {
    const { c } = world();
    c.factions[0].studies = ['townwatch'];
    for (let i = 0; i < 12000; i++) { c.intrigues = []; c.turn++; intrigueSeason(c); }
    const t = c.watchTally!.begin!;
    expect(t.n).toBeGreaterThan(10000);
    expect(t.would).toBeGreaterThan(400);
    expect(t.did / t.would).toBeGreaterThan(TOWNWATCH.crime - 0.07);
    expect(t.did / t.would).toBeLessThan(TOWNWATCH.crime + 0.07);
    const plain = world().c;
    for (let i = 0; i < 200; i++) { plain.intrigues = []; plain.turn++; intrigueSeason(plain); }
    expect(plain.watchTally?.begin).toBeUndefined(); // no Town Watch, nothing to read
  });
  it('a strike on a town that keeps a town watch is fought again with its company left out, and is never held the less for the company', () => {
    let n = 0, did = 0, would = 0;
    for (let strength = 1; strength <= 10; strength++) for (let seed = 1; seed <= 12; seed++) {
      const { c, at } = world(seed);
      stand(c, at); c.factions[0].studies = ['townwatch'];
      Object.assign(folkOf(c, at), { men: 2 * S, women: 2 * S, elders: 0, children: 0 }); delete folkOf(c, at).ages;
      c.territories[at].capital = -1;
      c.armies = [];
      const b: Band = { id: 7, kind: 'raiders', name: 'the Grey Band', at, strength, since: 1, held: [] };
      c.bands = [b];
      strike(c, b, at, []);
      const t = c.watchTally?.held;
      expect(t?.n).toBe(1);
      n += t!.n; did += t!.did; would += t!.would;
      expect(t!.did).toBeGreaterThanOrEqual(t!.would);
    }
    expect(n).toBe(120);
    expect(did).toBeGreaterThan(would); // somewhere along the strengths the company is what held the town
    const { c, at } = world();
    stand(c, at); // the house without the study keeps no town watch
    const b: Band = { id: 7, kind: 'raiders', name: 'the Grey Band', at, strength: 4, since: 1, held: [] };
    c.bands = [b]; strike(c, b, at, []);
    expect(c.watchTally?.held).toBeUndefined();
  });
});
