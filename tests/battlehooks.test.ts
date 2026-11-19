// The phases of a battle on the map, and who is registered for them (src/sim/battlehooks.ts).
import { describe, expect, it } from 'vitest';
import { BATTLE_PHASES, BattleAnswers, BattleHooks } from '../src/sim/battlehooks';
import { BATTLE_ANSWERS, BATTLE_HOOKS, newCampaign } from '../src/sim/campaign';
import { leaderAt } from '../src/sim/court';
import { warriorsOf } from '../src/sim/tribes';
import type { Campaign, Pending } from '../src/sim/campaign';

describe('battle hooks', () => {
  it('hooks of a phase run in the order they were registered, and only for their phase', () => {
    const hooks = new BattleHooks(), ran: string[] = [];
    hooks.on('settling', 'faith', () => ran.push('faith')).on('taken', 'yoke', () => ran.push('yoke')).on('settling', 'stores', () => ran.push('stores'));
    hooks.run('settling', {} as Campaign, {} as Pending);
    expect(ran).toEqual(['faith', 'stores']);
    hooks.run('taken', {} as Campaign, {} as Pending);
    expect(ran).toEqual(['faith', 'stores', 'yoke']);
    hooks.run('repulsed', {} as Campaign, {} as Pending);
    expect(ran.length).toBe(3);
    expect(hooks.order('settling')).toEqual(['faith', 'stores']);
    expect(hooks.order()).toEqual(['settling: faith', 'taken: yoke', 'settling: stores']);
  });

  it('a hook is handed the campaign, the pending battle and the note, and what one writes on the note the next reads', () => {
    const hooks = new BattleHooks();
    const c = { turn: 7 } as Campaign, p = { to: 3 } as Pending;
    let seen = 0;
    hooks.on('counted', 'one', (cc, pp, b) => { expect(cc).toBe(c); expect(pp).toBe(p); b.toll = (b.toll ?? 0) + 2; });
    hooks.on('counted', 'two', (_c, _p, b) => { seen = b.toll ?? 0; });
    hooks.run('counted', c, p, { toll: 1 });
    expect(seen).toBe(3);
  });

  it('the phases are named once', () => {
    expect(new Set(BATTLE_PHASES).size).toBe(BATTLE_PHASES.length);
    expect(BATTLE_PHASES).toContain('settling');
  });

  it('the campaign\'s table: who acts at each moment of a battle, in this order and no other', () => {
    // The order is the game's behaviour: stores and faith are written down before a town changes hands, a town is
    // resented before those held in it go free, the dead are reckoned between the stores and the faith. Change
    // this list only with the health report to show that nothing moved, or that what moved was meant.
    expect(BATTLE_HOOKS.order()).toEqual([
      'settling: townfaith', 'settling: stores', 'settling: mapbattle',
      'counted: companyroll', 'counted: warhouse',
      'taken: conquered', 'taken: carriedoff',
      'repulsed: tribes', 'repulsed: freetown',
      'settled: stores', 'settled: armytown', 'settled: townfaith', 'settled: mapbattle', 'settled: veteranhome', 'settled: battlescars', 'settled: chroniclethreads', 'settled: warrecord',
      'setup: stores',
      'written: studies', 'written: hallcases', 'written: fieldcaravan', 'written: warrecord', 'written: tribes',
      'housed: battlecarried', 'housed: driftintown', 'housed: governor', 'housed: queuedmen', 'housed: roofs', 'housed: stores',
    ]);
    for (const phase of BATTLE_PHASES) expect(BATTLE_HOOKS.order(phase).length).toBeGreaterThan(0); // no phase is run for nobody
  });

  it('a question has one system that answers it, and asking gives that system\'s answer', () => {
    const asks = new BattleAnswers<{ twice: (n: number) => number; name: () => string }>();
    asks.provide('twice', 'sums', (n) => n * 2);
    expect(asks.ask('twice', 21)).toBe(42);
    expect(() => asks.provide('twice', 'others', (n) => n)).toThrow('already answered by sums');
    expect(() => asks.ask('name')).toThrow('nobody to answer');
    expect(asks.who()).toEqual(['twice: sums']);
  });

  it('the campaign\'s questions: who answers what, and that the answers are the systems\' own', () => {
    expect(BATTLE_ANSWERS.who()).toEqual(['warriors: tribes', 'turnOut: tribes', 'leaderAt: court', 'court: court']);
    const c = newCampaign(7, 2, 1);
    const wild = c.territories.find((t) => t.owner < 0 && !t.horde)!;
    expect(BATTLE_ANSWERS.ask('warriors', c, wild.id)).toBe(warriorsOf(c, wild.id));
    const cap = c.territories.find((t) => t.capital === 0)!;
    expect(BATTLE_ANSWERS.ask('leaderAt', c, 0, cap.id)).toBe(leaderAt(c, 0, cap.id));
  });
});
