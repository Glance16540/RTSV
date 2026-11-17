// Rivals live by the same rules (docs/DESIGN.md): an audit, by playing campaigns with the computer and looking at a
// rival's towns for every system a player's town goes through. What a rival is still spared is listed on the board.
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { EAT, eatTown } from '../src/sim/larder';
import { Campaign, answerDemand, continueAI, endTurn, raise, resolvePending } from '../src/sim/campaign';
import { MEN, awayFrom, musterOf } from '../src/sim/armytown';
import { faithAt, nationVirtue } from '../src/sim/townfaith';
import { governTown } from '../src/sim/governor';
import { nationWorth } from '../src/sim/stores';
import { folkOf, headcount } from '../src/sim/township';

const turn = (c: Campaign) => {
  endTurn(c);
  for (let i = 0; i < 60 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
};

describe('rivals live by the same rules', () => {
  it('over a campaign a rival\'s towns have people with ages, stores, their own faith, and its figures are its towns\'', () => {
    for (const seed of [11, 40]) {
      const c = bareCampaign(seed, 2, 1, 'hearth');
      const first = c.territories.filter((t) => t.owner > 0).map((t) => ({ id: t.id, ages: [...(folkOf(c, t.id).ages?.m ?? [])] }));
      for (let i = 0; i < 12 && c.phase !== 'over'; i++) turn(c);
      const theirs = c.territories.filter((t) => t.owner > 0);
      expect(theirs.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const t of theirs) {
        const f = t.folk!;
        expect(f, t.name).toBeDefined(); // a town with people on record
        expect(f.ages, t.name).toBeDefined(); // each at an age
        expect(f.ages!.m.length + f.ages!.f.length).toBe(f.men + f.women + f.elders);
        expect(f.ages!.k.length).toBe(f.children);
        expect(t.virtue, t.name).toBeDefined(); // its own standing
        expect(faithAt(c, t.id)).toBe(t.virtue);
        for (const k of ['food', 'wood', 'gold', 'stone'] as const) expect(f.stores[k]).toBeGreaterThanOrEqual(0);
      }
      for (const x of c.factions) if (x.id > 0 && x.alive && theirs.some((t) => t.owner === x.id)) {
        expect(x.virtue, x.name).toBe(nationVirtue(c, x.id));
        expect(x.supplies, x.name).toBe(nationWorth(c, x.id));
      }
      // Seasons have passed for them: children were born or came of age somewhere, and the grown are older.
      const kept = first.filter((s) => c.territories[s.id].owner > 0 && s.ages.length);
      if (kept.length) expect(kept.some((s) => Math.max(...(c.territories[s.id].folk!.ages!.m.length ? c.territories[s.id].folk!.ages!.m : [0])) > Math.max(...s.ages))).toBe(true);
      // A town a rival took by force resents it as one the player took would.
      const taken = theirs.filter((t) => t.yoke && !t.yoke.settled); // (a town that has settled is remembered as taken, and resents nothing)
      for (const t of taken) expect(t.yoke!.resent).toBeGreaterThan(0);
    }
  }, 180_000);

  it('a rival\'s company is men of its town, and its governor keeps the town as a player\'s is kept', () => {
    const c = bareCampaign(7, 1, 1, 'hearth');
    const cap = c.territories.find((t) => t.capital === 1)!;
    if (!cap.buildings.includes('barracks')) cap.buildings.push('barracks');
    c.factions[1].supplies = 50;
    c.armies = c.armies.filter((a) => a.at !== cap.id);
    const men = folkOf(c, cap.id).men, women = folkOf(c, cap.id).women;
    // It gives what it can spare: a town keeps its husbands, a rival's as the player's (armytown.ts MEN).
    const gave = Math.min(2, Math.max(0, men - Math.max(MEN.floor, Math.ceil(women * MEN.couples))));
    expect(raise(c, 1, cap.id, 'infantry')).toBe(true);
    const a = c.armies.find((x) => x.at === cap.id)!;
    expect(folkOf(c, cap.id).men).toBe(men - gave);
    expect(awayFrom(c, cap.id)).toBe(gave);
    expect(musterOf(c, a.id)!.size).toBe(1);
    // The men gone with the army are not fed at home: the town eats for those on its record (larder.ts).
    const f = folkOf(c, cap.id);
    delete f.drift;
    f.stores.food = 5000;
    expect(eatTown(c, cap.id).need).toBe((f.men + f.women) * EAT.grown + f.elders * EAT.old + f.children * EAT.child);
    expect(headcount(f)).toBe(f.men + f.women + f.elders + f.children);
  }, 60_000);
});
