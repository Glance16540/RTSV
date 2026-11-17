// Rival rulers have the stories of their towns too, answered by their own lights (src/sim/rivalstories.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { INTRIGUE, beginKiller, beginThief } from '../src/sim/intrigue';
import { heard, judge, rivalBegin, rivalStoriesSeason } from '../src/sim/rivalstories';
import { folkOf } from '../src/sim/township';

/** A rival's town, grown and rich enough for a story; and whether it lies beside the player's lands. */
function world(): { c: Campaign; at: number } {
  const c = newCampaign(7, 1, 1, 'hearth');
  c.fronts = []; c.turn = INTRIGUE.from + 2;
  const t = c.territories.find((x) => x.capital === 1)!;
  const f = folkOf(c, t.id); f.men = 40; f.women = 40; f.children = 12; delete f.ages; f.stores.gold = 2000;
  return { c, at: t.id };
}

describe('the rivals\' stories', () => {
  it('begin in a rival\'s towns by the same chances as the player\'s', () => {
    const { c, at } = world();
    const was = INTRIGUE.thief.chance, wasK = INTRIGUE.killer.chance;
    try {
      INTRIGUE.thief.chance = 1; INTRIGUE.killer.chance = 0;
      const began = rivalBegin(c);
      expect(began.length).toBeGreaterThan(0);
      expect(began.every((x) => x.owner > 0)).toBe(true);
      expect(began.some((x) => x.at === at || c.territories[x.at].owner === 1)).toBe(true);
    } finally { INTRIGUE.thief.chance = was; INTRIGUE.killer.chance = wasK; }
  });

  it('a rival ruler judges a thief by his town\'s creed: a holy town sets him to work, a decadent one hangs him', () => {
    const { c, at } = world();
    const it = beginThief(c, at);
    it.caught = c.turn; it.thief = { name: 'Ash', family: 'Moor', gender: 'm', trade: 'carter' }; it.why = 'greed';
    c.territories[at].virtue = 60;
    expect(judge(c, it)).toBe('work');
    it.why = 'hunger';
    expect(judge(c, it)).toBe('pardon');
    c.territories[at].virtue = -80;
    expect(judge(c, it)).toBe('hang');
    const kids = folkOf(c, at).children;
    rivalStoriesSeason(c);
    expect(it.ended?.how).toBe('hanged');
    expect(folkOf(c, at).children).toBe(kids); // no child is ever harmed
  });

  it('a ruler names the last one left spoken of', () => {
    const { c, at } = world();
    const it = beginKiller(c, at);
    it.cleared = it.people.map((_, i) => i).filter((i) => i !== it.culprit);
    expect(judge(c, it)).toBe(`accuse:${it.culprit}`);
  });

  it('the player hears only of what ends beside his own lands, or his ally\'s', () => {
    const { c, at } = world();
    const it = beginThief(c, at);
    it.caught = c.turn; it.thief = { name: 'Ash', family: 'Moor', gender: 'm', trade: 'carter' }; it.why = 'greed';
    c.territories[at].virtue = 60;
    const near = heard(c, it), logs = c.log.length, told = (c.chronicle ?? []).length;
    rivalStoriesSeason(c);
    expect(it.ended).toBeTruthy();
    if (near) { expect(c.log.at(-1)).toMatch(/^Word comes from /); expect((c.chronicle ?? []).length).toBe(told + 1); }
    else { expect(c.log.slice(logs).some((l) => l.includes('Ash Moor'))).toBe(false); expect((c.chronicle ?? []).length).toBe(told); }
    // As the ally's, it is heard wherever it lies.
    c.ally = 1;
    expect(heard(c, it)).toBe(true);
  });
});

describe('a rival ruler\'s own house', () => {
  it('has the threat, the suitor and the plot, with only other rival peoples in them, answered by his lights', async () => {
    const { COURT, beginRival, beginSuitor, courtBeginFor } = await import('../src/sim/courtstory');
    const { kinOf } = await import('../src/sim/kin');
    const { houseOf } = await import('../src/sim/dynasty');
    const c = newCampaign(7, 2, 1, 'hearth');
    c.fronts = []; c.turn = COURT.from + 4;
    kinOf(c, 1);
    // A threat: from the other rival, at the rival's own seat.
    const threat = beginRival(c, 2, { owner: 1 })!;
    expect(threat).toBeTruthy();
    expect(threat.owner).toBe(1);
    expect(threat.rival).toBe(2);
    expect(c.territories[threat.at].owner).toBe(1);
    expect(c.log.some((l) => l.includes(threat.cast!.king!))).toBe(false); // the player is not told of another's house
    threat.stage = 1;
    c.territories[threat.at].virtue = 60;
    expect(judge(c, threat)).toBe('defy');
    c.territories[threat.at].virtue = -80;
    expect(judge(c, threat)).toBe('yield');
    // A suitor, for a grown daughter of the rival's house: asked first, given if she is willing.
    const h = houseOf(c, 1);
    h.heirs.push({ name: 'Wenna', female: true, born: c.turn - 100 });
    const suitor = beginSuitor(c, 2, { owner: 1 })!;
    expect(suitor.owner).toBe(1);
    expect(judge(c, suitor)).toBe('ask');
    suitor.asked = true; suitor.willing = true;
    expect(judge(c, suitor)).toBe('give');
    // Rival peoples never cast the player in their stories.
    for (let i = 0; i < 40; i++) { c.turn++; for (const it of courtBeginFor(c, 1)) { expect(it.owner).toBe(1); expect(it.rival).not.toBe(0); } }
  });
});
