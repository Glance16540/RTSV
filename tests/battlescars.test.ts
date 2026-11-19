// What a battle settled on the map leaves on a town, and the governors finishing half-built works (src/sim/battlescars.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Pending } from '../src/sim/campaign';
import type { Outcome } from '../src/sim/mapbattle';
import type { Standing } from '../src/sim/game';
import { SCARS, finishWorks, nextStep, scarTown, scarsOf, unfinishedWords } from '../src/sim/battlescars';
import { folkOf } from '../src/sim/township';

const fight = (attackerWon: boolean, works: number, rounds = 3) => ({ attackerWon, rounds, broke: attackerWon ? 'defender' : 'attacker', a: { began: {}, lost: {}, left: {}, works: 0 }, d: { began: {}, lost: {}, left: {}, works } } as unknown as Outcome);
function townAt(c: Campaign, b: Standing[]): number {
  const t = c.territories.find((x) => x.owner === 0)!;
  t.town = { at: 0, b };
  return t.id;
}
const houses = (n: number): Standing[] => Array.from({ length: n }, (_, i) => ['house', 10 + i * 2, 10] as Standing);

describe('the marks of a battle nobody watched', () => {
  it('beats the works down by the share the fight took, and scorches a few houses of a town that held', () => {
    const c = newCampaign(5);
    const at = townAt(c, [['palisade', 4, 4], ['tower', 6, 4], ...houses(20)]);
    const marked = scarTown(c, { to: at, attacker: 1, defender: 0 } as Pending, fight(false, 0.5));
    const b = c.territories[at].town!.b;
    expect(b[0][3]).toBe(0.5);
    expect(b[1][3]).toBe(0.5);
    const scorched = b.filter((x) => x[0] === 'house' && x[3] !== undefined);
    expect(scorched.length).toBe(Math.round(20 * SCARS.held));
    for (const h of scorched) { expect(h[3]!).toBeGreaterThanOrEqual(SCARS.worst); expect(h[3]!).toBeLessThanOrEqual(SCARS.least); }
    expect(marked).toBe(2 + scorched.length);
    expect(scarsOf(c, at)).toMatchObject({ damaged: marked, works: 2, houses: scorched.length });
  });

  it('scorches more of a town taken, fewer after a short fight, and never mends a house by marking it', () => {
    const c = newCampaign(5);
    const at = townAt(c, houses(20));
    scarTown(c, { to: at, attacker: 1, defender: 0 } as Pending, fight(true, 0));
    expect(c.territories[at].town!.b.filter((x) => x[3] !== undefined).length).toBe(Math.round(20 * SCARS.taken));
    const c2 = newCampaign(5), at2 = townAt(c2, [['house', 2, 2, 0.15], ...houses(9)]);
    scarTown(c2, { to: at2, attacker: 1, defender: 0 } as Pending, fight(false, 0, 1));
    expect(c2.territories[at2].town!.b[0][3]).toBe(0.15); // already worse than any scorching: left as it was
    expect(c2.territories[at2].town!.b.filter((x) => x[3] !== undefined).length).toBeLessThanOrEqual(1 + Math.round(10 * SCARS.held / 3));
  });

  it('leaves alone a town kept for counting only', () => {
    const c = newCampaign(5);
    const at = townAt(c, houses(10));
    c.territories[at].town!.coarse = true;
    expect(scarTown(c, { to: at, attacker: 1, defender: 0 } as Pending, fight(true, 1))).toBe(0);
  });
});

describe('half-built works, finished by the governor', () => {
  it('goes on a quarter a season out of the town\'s own stores, and is done at the last quarter', () => {
    const c = newCampaign(5);
    const at = townAt(c, [['barracks', 8, 8, undefined, 0.5]]);
    const stores = folkOf(c, at).stores;
    Object.assign(stores, { food: 1000, wood: 1000, gold: 1000, stone: 1000 });
    const need = nextStep('barracks'), before = { ...stores };
    finishWorks(c);
    const b = c.territories[at].town!.b[0];
    expect(b[4]).toBe(0.75);
    for (const [k, n] of Object.entries(need)) expect(stores[k as 'wood']).toBe(before[k as 'wood'] - n!);
    expect(finishWorks(c)).toBe(1);
    expect(c.territories[at].town!.b[0]).toEqual(['barracks', 8, 8]);
    expect(unfinishedWords(c, at)).toBe('');
  });

  it('waits where the stores will not stretch, and the land panel says what for', () => {
    const c = newCampaign(5);
    const at = townAt(c, [['barracks', 8, 8, undefined, 0.25]]);
    Object.assign(folkOf(c, at).stores, { food: 0, wood: 0, gold: 0, stone: 0 });
    finishWorks(c);
    expect(c.territories[at].town!.b[0][4]).toBe(0.25);
    expect(unfinishedWords(c, at)).toMatch(/half-built \(25%\)\. Its governor goes on with it when the town has \d+ wood/);
  });
});
