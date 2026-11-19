// A besieger thrown back from the walls falls back with what it has left (src/sim/siegeretreat.ts).
import { describe, expect, it } from 'vitest';
import { finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { companiesLeft } from '../src/sim/siegeretreat';

describe('companies a battle in person left alive', () => {
  it('counts men to companies by kind, the better weapons of a later age with them, and never more than there were', () => {
    expect(companiesLeft({ infantry: 3, archers: 2 }, { clubman: 3, slinger: 1 })).toEqual({ infantry: 2, archers: 1 });
    expect(companiesLeft({ infantry: 1 }, { clubman: 9 })).toEqual({ infantry: 1 });
    expect(companiesLeft({ infantry: 2 }, { villager: 9 })).toEqual({});
    const later = Object.keys({ swordsman: 1, axeman: 1 }).find((k) => companiesLeft({ infantry: 2 }, { [k]: 2 }).infantry === 1);
    expect(later).toBeTruthy(); // a clubman's company that fought as better-armed men is counted all the same
  });
});

/** A campaign with a battle pending: `attacker`'s army marches from one of its lands on a land of `defender`'s next door. */
function siege(attacker: number, defender: number): { c: Campaign; armyId: number; from: number; to: number } {
  const c = newCampaign(9, 2);
  const from = c.territories.find((t) => t.owner === attacker && t.adj.length)!;
  const to = c.territories[from.adj[0]];
  to.owner = defender;
  if (to.capital >= 0) to.capital = -1;
  c.armies = c.armies.filter((a) => a.at !== from.id && a.at !== to.id);
  const army = { id: 900 + attacker, owner: attacker, at: from.id, units: { infantry: 3, archers: 2 }, hero: false, vet: 0, moved: false };
  c.armies.push(army);
  c.phase = attacker === 0 ? 'player' : 'ai';
  expect(moveArmy(c, army.id, to.id)).toBe('battle');
  return { c, armyId: army.id, from: from.id, to: to.id };
}

describe('a besieger thrown back', () => {
  it('the player\'s army, beaten at the walls, falls back to the land it marched from with what lived', () => {
    const { c, armyId, from } = siege(0, 1);
    finishBattle(c, false, { clubman: 3, slinger: 1 });
    const a = c.armies.find((x) => x.id === armyId);
    expect(a).toBeTruthy();
    expect(a!.at).toBe(from);
    expect(a!.units).toEqual({ infantry: 2, archers: 1 });
  });

  it('a rival beaten off by the player\'s town goes home with what lived, and loses a leader who fell', () => {
    const { c, armyId, from } = siege(1, 0);
    c.armies.find((x) => x.id === armyId)!.hero = true;
    c.factions[1].heroAlive = true;
    finishBattle(c, true, {}, { foes: { clubman: 2 }, foesLed: false });
    const a = c.armies.find((x) => x.id === armyId);
    expect(a?.at).toBe(from);
    expect(a?.units).toEqual({ infantry: 1 });
    expect(a?.hero).toBe(false);
    expect(c.factions[1].heroAlive).toBe(false);
  });

  it('is gone if nothing of it lived, or if the battle handed back nothing', () => {
    const one = siege(0, 1);
    finishBattle(one.c, false, { villager: 3 });
    expect(one.c.armies.some((x) => x.id === one.armyId)).toBe(false);
    const two = siege(1, 0);
    finishBattle(two.c, true, {});
    expect(two.c.armies.some((x) => x.id === two.armyId)).toBe(false);
  });
});
