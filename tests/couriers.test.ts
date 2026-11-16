// Couriers (src/sim/couriers.ts): decrees by messenger are stronger.
import { describe, expect, it } from 'vitest';
import { COURIERS, messengerStrength } from '../src/sim/couriers';
import { MESSENGER, decreesAt, issueDecree } from '../src/sim/decrees';
import { ruleWorld, knowing } from './rulestudies.helpers';

describe('Couriers', () => {
  it('a decree by messenger is three-quarters as strong, not half', () => {
    const { c, tid } = ruleWorld();
    c.factions[0].supplies = 50;
    c.factions[0].heroAlive = false; // nobody leads: every decree goes by messenger
    expect(messengerStrength(c, 0, MESSENGER)).toBe(MESSENGER);
    issueDecree(c, 0, tid, 'guards');
    expect(decreesAt(c, tid)[0].strength).toBe(MESSENGER);
    c.territories[tid].decrees = [];
    knowing(c, 0, 'couriers');
    issueDecree(c, 0, tid, 'guards');
    expect(decreesAt(c, tid)[0].strength).toBe(COURIERS.strength);
  });
});
