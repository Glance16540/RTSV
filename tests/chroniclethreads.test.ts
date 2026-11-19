// The chronicle read as one story: rivals' great battles heard of, and a story's later lines saying when it began.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Pending } from '../src/sim/campaign';
import { GREAT, cameOf, heardOf, rivalBattleHeard, toldIn, whenOf, yearOf } from '../src/sim/chroniclethreads';
import type { BattleNote } from '../src/sim/battlehooks';

const fight = (a: number, d: number, lostA = 1, lostD = 2): BattleNote => ({ attackerWon: true, fought: { a: { began: { infantry: a }, lost: { infantry: lostA } }, d: { began: { infantry: d }, lost: { infantry: lostD } } } } as unknown as BattleNote);

describe('the chronicle\'s dates and threads', () => {
  it('dates a season by its year and the time of year', () => {
    expect(yearOf(0)).toBe(1);
    expect(yearOf(9)).toBe(3);
    expect(whenOf(9)).toBe('Year 3, summer');
  });

  it('names the year a story began on its later lines, and nothing on its first', () => {
    const c = newCampaign(4);
    c.turn = 14;
    expect(toldIn(c, 6)).toBe(' As was told in year 2.');
    expect(toldIn(c, 14)).toBe('');
    expect(toldIn(c, undefined)).toBe('');
  });

  it('says what earlier answer a tale came of', () => {
    const c = newCampaign(4);
    c.turn = 12;
    c.answers = [{ id: 'exile', choice: 'a', turn: 5, land: 0, rival: 1, tribe: -1 }];
    expect(cameOf(c, { id: 'exile', choice: 'a' }, () => 'An exile at the gate')).toBe(' It came of "An exile at the gate", as was told in year 2.');
    expect(cameOf(c, { id: 'exile', choice: 'b' }, () => 'x')).toBe('');
    expect(cameOf(c, undefined, () => 'x')).toBe('');
  });
});

describe('rivals\' great battles, heard of', () => {
  const setUp = () => {
    const c = newCampaign(11, 3);
    c.ally = -1;
    // A land of a rival's lying beside one of the player's, and one far from anything of his.
    const mine = c.territories.find((t) => t.owner === 0)!;
    const near = c.territories[mine.adj.find((n) => c.territories[n].owner !== 0)!];
    near.owner = 1;
    const far = c.territories.find((t) => t.owner !== 0 && t.id !== near.id && !t.adj.some((n) => c.territories[n].owner === 0))!;
    far.owner = 2;
    const other = 2; // the attacker beside the player's land is the people who hold the far one, and the reverse
    return { c, near, far, other };
  };

  it('writes a great battle beside the player\'s lands as news, with the companies lost', () => {
    const { c, near, other } = setUp();
    const p = { attacker: other, defender: near.owner, to: near.id } as Pending;
    expect(heardOf(c, p)).toBe(true);
    const line = rivalBattleHeard(c, p, fight(4, 3));
    expect(line).toMatch(new RegExp(`^Word came from ${near.name}: the ${c.factions[other].name} beat the ${c.factions[near.owner].name} there and took it\\.`));
    expect(line).toContain('lost 1 company there');
    expect(c.chronicle!.at(-1)!.text).toBe(line);
  });

  it('leaves out a small one, one too far to hear of, and one the player fought in', () => {
    const { c, near, far, other } = setUp();
    expect(rivalBattleHeard(c, { attacker: other, defender: near.owner, to: near.id } as Pending, fight(2, 2))).toBe(''); // under GREAT
    expect(4 + 3).toBeGreaterThanOrEqual(GREAT);
    expect(rivalBattleHeard(c, { attacker: 1, defender: far.owner, to: far.id } as Pending, fight(4, 3))).toBe('');
    expect(rivalBattleHeard(c, { attacker: 0, defender: near.owner, to: near.id } as Pending, fight(4, 3))).toBe('');
  });

  it('tells any battle of the ally\'s, great or small, and nothing twice for a land already told of', () => {
    const { c, far } = setUp();
    c.ally = far.owner;
    const p = { attacker: 1, defender: far.owner, to: far.id } as Pending;
    expect(rivalBattleHeard(c, p, fight(1, 1))).not.toBe('');
    const n = c.chronicle!.length;
    expect(rivalBattleHeard(c, p, fight(4, 3))).toBe('');
    expect(c.chronicle!.length).toBe(n);
  });
});
