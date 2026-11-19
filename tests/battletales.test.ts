import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { tellBattle } from '../src/sim/mapbattle';
import type { Outcome } from '../src/sim/mapbattle';
import { noteStood, readTale, talesAt, talesOf } from '../src/sim/battletales';

const side = (began: Record<string, number>, lost: Record<string, number>, extra = {}) => ({ began, lost, left: {}, share: 0.5, breakAt: 0.3, works: 0, ...extra });

describe('battle tales, read for a panel', () => {
  it('tells rounds, who broke, losses by kind, walls, leaders, the fallen and who stood', () => {
    const c = newCampaign(7);
    const to = c.territories.find((t) => t.owner === 1)!.id;
    const out = { attackerWon: true, broke: 'defender', rounds: 3, a: side({ infantry: 4, archers: 2 }, { infantry: 1 }), d: side({ infantry: 3 }, { infantry: 2 }, { works: 0.8, scattered: true }) } as unknown as Outcome;
    const tale = tellBattle(c, { attacker: 0, defender: 1, to } as never, out, { a: 'Edric' });
    expect(tale.beganA).toEqual({ infantry: 4, archers: 2 });
    expect(tale.scattered).toBe('defender');
    noteStood(c, { name: 'Wulf', town: c.territories.find((t) => t.owner === 0)!.id });
    const r = readTale(c, tale);
    expect(r.title).toContain(c.territories[to].name);
    expect(r.how).toMatch(/broke in the third round/);
    expect(r.sides[0].led).toBe('Edric');
    expect(r.sides[0].lost).toMatch(/1 /);
    expect(r.sides[1].scattered).toBe(true);
    expect(r.walls).toMatch(/beaten down/);
    expect(r.stood).toMatch(/^Wulf of /);
    expect(r.mine).toBe('won');
    expect(talesOf(c, 0)[0]).toBe(tale);
    expect(talesAt(c, to)[0]).toBe(tale);
    expect(talesAt(c, to + 1000)).toEqual([]);
  });

  it('names nobody as standing on a tale from an earlier season', () => {
    const c = newCampaign(3);
    const to = c.territories.find((t) => t.owner === 1)!.id;
    const out = { attackerWon: false, broke: 'attacker', rounds: 1, a: side({ infantry: 2 }, { infantry: 2 }), d: side({ infantry: 2 }, {}) } as unknown as Outcome;
    const tale = tellBattle(c, { attacker: 0, defender: 1, to } as never, out, {});
    c.turn++;
    noteStood(c, { name: 'Late', town: 0 });
    expect(tale.stood).toBeUndefined();
    expect(readTale(c, tale).mine).toBe('lost');
    expect(readTale(c, tale).how).toMatch(/broke in the first round/);
  });
});
