// At peace the men of an army's towns go home, whatever else the army is made of, and a threatened town keeps
// its garrison (src/sim/rivalrule.ts standDown, src/sim/armytown.ts sendMenHome).
import { bareCampaign, smallTownRules } from './helpers';
import { describe, expect, it } from 'vitest';
import { Campaign, raise } from '../src/sim/campaign';
import { RIVAL, standDown, underArms, wantsGarrison, warFooting } from '../src/sim/rivalrule';
import { awayFrom, musterOf, sendMenHome } from '../src/sim/armytown';
import { folkOf } from '../src/sim/township';

smallTownRules(); // these tests are about how men go to an army and come home, written with towns of ten men: the figures they were written with

const LONG = 60_000;
/** A rival with one town of `men` men and a Barracks, and no army anywhere. */
const nation = (men = 40, seed = 7) => {
  const c = bareCampaign(seed, 1, 1, 'hearth'), cap = c.territories.find((t) => t.capital === 1)!;
  for (const t of c.territories) if (t.owner === 1 && t !== cap) t.owner = -1;
  c.armies = c.armies.filter((a) => a.owner !== 1);
  cap.buildings = ['barracks'];
  const f = folkOf(c, cap.id);
  f.men = men; f.women = Math.min(f.women, 4); delete f.ages; // few women, so that the husbands it keeps do not come into these sums
  c.factions[1].supplies = 500;
  c.wars = {};
  return { c, cap, f };
};
const atPeace = (c: Campaign) => { c.wars = {}; warFooting(c, 1); c.turn += RIVAL.lull + 1; expect(warFooting(c, 1)).toBe('peace'); };
const size = (u: Record<string, number>): number => Object.values(u).reduce((n, v) => n + v, 0);

describe('men sent home from an army that stays', () => {
  it('the townsmen go, a company with every two of them, never the last company', () => {
    const { c, cap, f } = nation();
    for (let i = 0; i < 4; i++) raise(c, 1, cap.id, 'infantry');
    const a = c.armies.find((x) => x.at === cap.id)!;
    expect(sendMenHome(c, a.id, 3)).toBe(3);
    expect(size(a.units)).toBe(2); // two companies went with three men
    expect(f.men).toBe(35);
    expect(awayFrom(c, cap.id)).toBe(5);
    expect(musterOf(c, a.id)!.size).toBe(2);
    expect(sendMenHome(c, a.id, 99)).toBe(2); // one company's worth: the last company stays, and its men with it
    expect(size(a.units)).toBe(1);
    expect(sendMenHome(c, a.id, 1)).toBe(0);
    a.at = c.territories.find((t) => t.owner !== 1)!.id;
    expect(sendMenHome(c, a.id, 1)).toBe(-1); // not from another people's land
  }, LONG);

  it('an army mostly of men of no town still gives its townsmen back', () => {
    const { c, cap, f } = nation(10);
    raise(c, 1, cap.id, 'infantry');
    const a = c.armies.find((x) => x.at === cap.id)!;
    a.units.infantry = 10; musterOf(c, a.id)!.size = 10; // nine companies of men of no town
    a.hero = true;
    expect(underArms(c, 1)).toEqual({ away: 2, home: 8, share: 0.2 });
    atPeace(c);
    expect(standDown(c, 1)).toBe(1);
    expect(underArms(c, 1).away).toBe(0);
    expect(f.men).toBe(10);
    expect(size(a.units)).toBe(9); // one company went with them; the leader keeps the rest
    expect(c.armies.includes(a)).toBe(true);
  }, LONG);
});

describe('standing down at peace', () => {
  it('the garrison of a town that would rise without it stays', () => {
    const { c, cap } = nation();
    for (let i = 0; i < 6; i++) raise(c, 1, cap.id, 'infantry');
    const a = c.armies.find((x) => x.at === cap.id)!;
    // A town taken from the locals, as resentful as a town can be, and the army standing in it.
    const taken = c.territories.find((t) => cap.adj.includes(t.id) && !t.horde && t.capital < 0)!;
    taken.owner = 1; taken.yoke = { from: -1, since: c.turn, resent: 100 };
    a.at = taken.id;
    atPeace(c);
    expect(wantsGarrison(c, taken.id)).toBe(true);
    expect(underArms(c, 1).share).toBeGreaterThan(RIVAL.standing);
    standDown(c, 1);
    expect(c.armies.includes(a)).toBe(true); // it holds the town: it is not sent home whole
    expect(size(a.units)).toBeLessThan(6); // but it gives up men down to the standing force, and holds with what is left
    expect(size(a.units)).toBeGreaterThanOrEqual(1);
    delete taken.yoke;
    expect(wantsGarrison(c, taken.id)).toBe(false);
  }, LONG);

  it('and with no threat it goes home whole', () => {
    const { c, cap, f } = nation();
    for (let i = 0; i < 6; i++) raise(c, 1, cap.id, 'infantry');
    atPeace(c);
    expect(wantsGarrison(c, cap.id)).toBe(false);
    standDown(c, 1);
    expect(c.armies.filter((x) => x.owner === 1).length).toBe(0);
    expect(f.men).toBe(40);
  }, LONG);
});
