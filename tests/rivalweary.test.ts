// A rival weighs what war costs its towns, and sues for peace when they bleed (src/sim/rivalweary.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, atTruce, moveArmy, newCampaign, offerTruce } from '../src/sim/campaign';
import { WEARY, foesOf, isWeary, suePeace, suedPeace, suesPlayer, weariness, wearyMargin, wearyOf, wearyText, wouldAgree } from '../src/sim/rivalweary';
import { tally } from '../src/sim/ledger';
import { folkOf, headcount } from '../src/sim/township';

/** Three peoples late enough for weariness to count; rival 1 and rival 2 share a border, and rival 1 borders the player. */
const world = () => {
  for (let seed = 1; seed <= 60; seed++) {
    const c = newCampaign(seed, 2, 1);
    const cap = c.territories.find((t) => t.capital === 1)!;
    const [x, y] = cap.adj.filter((n) => c.territories[n].capital < 0);
    if (y === undefined) continue;
    c.turn = WEARY.from + 4;
    Object.assign(c.territories[x], { owner: 2, horde: false });
    Object.assign(c.territories[y], { owner: 0, horde: false });
    c.bands = [];
    return { c, cap, theirs: c.territories[x], yours: c.territories[y] };
  }
  throw new Error('no world');
};
const people = (c: Campaign, f: number) => c.territories.filter((t) => t.owner === f).reduce((n, t) => n + headcount(folkOf(c, t.id)), 0);
/** Lose this share of a people to war, on the ledger. */
const bleed = (c: Campaign, f: number, share: number) => { const t = c.territories.find((x) => x.owner === f)!; const p = people(c, f); tally(c, t.id, 'fell', Math.ceil((share * p) / (1 - share))); };
const army = (c: Campaign, owner: number, at: number, n: number) => { const a = { id: 700 + c.armies.length, owner, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };

describe('how weary of war a people is', () => {
  it('a people at peace with whole towns is not weary', () => {
    const { c } = world();
    expect(wearyOf(c, 1).losses).toBe(0);
    expect(weariness(c, 1)).toBeLessThan(1);
    expect(wearyText(c, 1)).toBe('');
  });
  it('its dead in war and of hunger are weighed as a share of its people', () => {
    const { c } = world();
    const before = weariness(c, 1);
    bleed(c, 1, WEARY.losses);
    expect(wearyOf(c, 1).losses).toBeGreaterThanOrEqual(WEARY.losses);
    expect(weariness(c, 1)).toBeGreaterThanOrEqual(before + 1);
    expect(isWeary(c, 1)).toBe(true);
    expect(wearyText(c, 1)).toContain('their dead');
    expect(wearyOf(c, 2).losses).toBe(0); // another people's dead are not its own
  });
  it('a hungry town weighs on it, and all of them hungry make it weary alone', () => {
    const { c } = world();
    for (const t of c.territories.filter((x) => x.owner === 1)) folkOf(c, t.id).drift = { strain: 0, care: 0, moved: 0, hungry: true, raided: false };
    expect(wearyOf(c, 1).hungry).toBe(1);
    expect(weariness(c, 1)).toBeGreaterThanOrEqual(1 / WEARY.hungry);
  });
  it('nobody is weary in the first seasons', () => {
    const { c } = world();
    bleed(c, 1, 0.3);
    c.turn = WEARY.from - 1;
    expect(weariness(c, 1)).toBe(0);
  });
  it('the wearier, the better odds it wants, up to a limit', () => {
    const { c } = world();
    const calm = wearyMargin(c, 1);
    bleed(c, 1, WEARY.losses / 2);
    const some = wearyMargin(c, 1);
    expect(some).toBeGreaterThan(calm);
    bleed(c, 1, 0.5);
    expect(wearyMargin(c, 1)).toBe(WEARY.most);
  });
});

describe('a weary rival sues for peace', () => {
  it('it borders the peoples it might make peace with', () => {
    const { c } = world();
    expect(foesOf(c, 1)).toEqual(expect.arrayContaining([0, 2]));
    c.truces.push({ with: 1, until: c.turn + 9 });
    expect(foesOf(c, 1)).not.toContain(0);
  });
  it('one that is not weary sues nobody', () => {
    const { c } = world();
    expect(suePeace(c, 1)).toEqual({ peace: [], offered: false });
    expect(c.pacts ?? []).toHaveLength(0);
  });
  it('another rival agrees when it is weary itself, and neither marches on the other while it lasts', () => {
    const { c, cap, theirs } = world();
    bleed(c, 1, 0.2); bleed(c, 2, WEARY.losses);
    c.armies = c.armies.filter((a) => a.owner === 0);
    army(c, 1, cap.id, 4); const foe = army(c, 2, theirs.id, 9);
    expect(wouldAgree(c, 2, 1)).toBe(true);
    const out = suePeace(c, 1);
    expect(out.peace).toEqual([2]);
    expect(suedPeace(c, 1, 2)).toBe(true);
    expect(atTruce(c, 1, 2)).toBe(true);
    expect(moveArmy(c, foe.id, cap.id)).toBe('invalid'); // rivals keep their word
    expect(c.log.join('\n')).toContain('make peace');
    c.turn += WEARY.peace + 1;
    expect(atTruce(c, 1, 2)).toBe(false);
  });
  it('one that is whole refuses, however weak, and is not asked again for a while', () => {
    const { c, cap, theirs } = world();
    bleed(c, 1, 0.2);
    for (const t of c.territories) if (t.owner === 2) delete t.yoke;
    c.armies = c.armies.filter((a) => a.owner === 0);
    army(c, 1, cap.id, 9); army(c, 2, theirs.id, 1);
    expect(weariness(c, 2)).toBeLessThan(WEARY.agrees * 0.85);
    expect(wouldAgree(c, 2, 1)).toBe(false);
    expect(suePeace(c, 1).peace).toEqual([]);
    expect(atTruce(c, 1, 2)).toBe(false);
    bleed(c, 2, WEARY.losses); // it bleeds the season after
    c.turn += 1;
    expect(suePeace(c, 1).peace).toEqual([]);
    c.turn += WEARY.again;
    bleed(c, 1, 0.2); bleed(c, 2, WEARY.losses);
    expect(suePeace(c, 1).peace).toEqual([2]);
  });
  it('to the player it is an offer: a truce for the asking, at no price, while it stands', () => {
    const { c } = world();
    bleed(c, 1, 0.2);
    expect(suePeace(c, 1).offered).toBe(true);
    expect(suesPlayer(c, 1)).toBe(true);
    expect(atTruce(c, 0, 1)).toBe(false); // nothing is done for the player
    expect(c.log.join('\n')).toContain('sue for peace');
    c.phase = 'player';
    c.factions[0].supplies = 0;
    for (const t of c.territories.filter((x) => x.owner === 0)) { const f = folkOf(c, t.id); f.stores.gold = 0; }
    expect(offerTruce(c, 1)).toBe(true);
    expect(atTruce(c, 0, 1)).toBe(true);
  });
  it('the offer lapses', () => {
    const { c } = world();
    bleed(c, 1, 0.2);
    suePeace(c, 1);
    c.turn += WEARY.open + 1;
    expect(suesPlayer(c, 1)).toBe(false);
  });
  it('the player\'s own people never sues, whoever plays it', () => {
    const { c } = world();
    bleed(c, 0, 0.3);
    expect(suePeace(c, 0)).toEqual({ peace: [], offered: false });
  });
});
