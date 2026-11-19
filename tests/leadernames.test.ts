// A leader is named by their own name in every line written of them, never by a placeholder ("wife of leader1").
import { describe, expect, it } from 'vitest';
import { answerDemand, continueAI, endTurn, newCampaign, playForPlayer, resolvePending } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { heroFor } from '../src/sim/campaignbase';
import { kinOf, kinSeason } from '../src/sim/kin';

const PLACEHOLDER = /\bleader\s?\d/i;

/** Every line a campaign has written: the log, the chronicle, the households' news, the stories' news. */
const linesOf = (c: Campaign): string[] => [
  ...c.log,
  ...(c.chronicle ?? []).map((l) => l.text),
  ...c.factions.flatMap((f) => (f.kin?.news ?? []).map((n) => n.text)),
  ...(c.intrigueNews ?? []).map((n) => n.text),
];

function play(seed: number, turns: number): Campaign {
  const c = newCampaign(seed, 3);
  for (let i = 0; i < turns && c.phase !== 'over'; i++) {
    for (let k = 0; k < 40 && c.phase === 'player'; k++) { playForPlayer(c); if (c.pending) resolvePending(c, 'auto'); else break; }
    endTurn(c);
    for (let k = 0; k < 200 && c.phase === 'ai'; k++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
    if (c.pending) resolvePending(c, 'auto');
  }
  return c;
}

describe('leaders by their names', () => {
  it('no line of a long campaign names a leader by a placeholder', () => {
    for (const seed of [6, 13]) {
      const c = play(seed, 70);
      const bad = linesOf(c).filter((l) => PLACEHOLDER.test(l));
      expect(bad, `seed ${seed}`).toEqual([]);
      // Every household is kept under its leader's own name.
      for (const f of c.factions) if (f.kin) expect(f.kin.leader).not.toMatch(PLACEHOLDER);
    }
  }, 120_000);

  it('a household saved under a placeholder takes its leader\'s name, and nobody is widowed for it', () => {
    const c = newCampaign(3, 2);
    const k = kinOf(c, 1);
    k.leader = 'leader1';
    if (k.spouse) { k.spouse.of = 'leader1'; delete k.spouse.lost; }
    const before = (c.chronicle ?? []).length;
    kinSeason(c, 1);
    expect(k.leader).toBe(heroFor(c, 1).name);
    if (k.spouse) { expect(k.spouse.of).toBe(heroFor(c, 1).name); expect(k.spouse.lost).toBeUndefined(); }
    expect((c.chronicle ?? []).slice(before).some((l) => /widowed/.test(l.text))).toBe(false);
  });
});
