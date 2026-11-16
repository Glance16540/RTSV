// The phases of a battle on the map, and who is registered for them (src/sim/battlehooks.ts).
import { describe, expect, it } from 'vitest';
import { BATTLE_PHASES, BattleHooks } from '../src/sim/battlehooks';
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
});
