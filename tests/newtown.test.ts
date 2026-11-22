// A town settlers have just founded is no band's mark for its first seasons (src/sim/newtown.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { NEWTOWN, graceLeft, tooNewToRaid } from '../src/sim/newtown';
import { softest } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';

/** Two towns of the player's side by side, and a band that reaches both; `young` is much the softer. */
const world = () => {
  const c = newCampaign(7, 2, 1);
  c.turn = 30; c.bands = [];
  const cap = c.territories.find((t) => t.capital === 0)!;
  const [a, b] = c.territories.filter((t) => t.capital < 0 && !t.rim && !t.horde && t.id !== cap.id);
  for (const t of [a, b]) Object.assign(t, { owner: 0, horde: false, militia: 0 });
  const band = { id: 5, kind: 'raiders', name: 'the Red Hand', at: cap.id, since: 1, strength: 6, held: [] } as unknown as Band;
  return { c, old: a, young: b, band };
};
const found = (c: Campaign, tid: number, seasonsAgo: number) => { c.territories[tid].foundedBy = { from: 0, turn: c.turn - seasonsAgo }; };

describe('a new town\'s grace', () => {
  it('runs two years from its founding, and no other town has one', () => {
    const { c, old, young } = world();
    expect(tooNewToRaid(c, young.id)).toBe(false);
    found(c, young.id, 0);
    expect(tooNewToRaid(c, young.id)).toBe(true);
    expect(graceLeft(c, young.id)).toBe(NEWTOWN.grace);
    expect(tooNewToRaid(c, old.id)).toBe(false);
    expect(graceLeft(c, old.id)).toBe(0);
    c.turn += NEWTOWN.grace - 1;
    expect(tooNewToRaid(c, young.id)).toBe(true);
    c.turn += 1;
    expect(tooNewToRaid(c, young.id)).toBe(false);
    expect(graceLeft(c, young.id)).toBe(0);
  });
  it('a band looks past it to another town in its reach, and comes back to it when the grace is over', () => {
    const { c, old, young, band } = world();
    const both = [old.id, young.id];
    const before = softest(c, band, both)!.id;
    found(c, before, 1); // whichever it would have struck is the new town
    const other = both.find((id) => id !== before)!;
    expect(softest(c, band, both)!.id).toBe(other);
    expect(softest(c, band, [before])).toBeNull();
    c.turn += NEWTOWN.grace;
    c.territories[before].foundedBy!.turn = c.turn - NEWTOWN.grace;
    expect(softest(c, band, [before])!.id).toBe(before); // a mark again, weighed with the rest
  });
  it('a band with nothing but a new town in reach has no mark', () => {
    const { c, young, band } = world();
    found(c, young.id, 2);
    expect(softest(c, band, [young.id])).toBeNull();
  });
});
