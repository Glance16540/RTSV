// A band out in the wilds, with no border to any town of the people: the rising's seat is their nearest town as the crow flies (src/sim/claimantrising.ts seatFor).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Claim } from '../src/sim/claimants';
import { seatFor } from '../src/sim/claimantrising';

const world = () => {
  const c = newCampaign(7, 2, 1);
  const cap = c.territories.find((t) => t.capital === 0)!;
  const mine = c.territories.filter((t) => t.id !== cap.id && t.capital < 0).slice(0, 2);
  for (const t of mine) Object.assign(t, { owner: 0, horde: false });
  // A land cut off from every other: where a band of the wilds stands.
  const wild = c.territories.find((t) => t.owner !== 0 && t.capital < 0 && !mine.includes(t))!;
  for (const t of c.territories) t.adj = t.adj.filter((n) => n !== wild.id);
  wild.adj = []; wild.owner = -1;
  const claim = (town: number, parent: 'band' | 'noble' = 'band') => ({ id: 1, owner: 0, mother: 'Aiko', parent, by: 'the Red Hand', town, born: c.turn } as unknown as Claim);
  return { c, cap, mine, wild, claim };
};
const far = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

describe('the seat of a rising raised by a band', () => {
  it('by the borders where there are any: the people\'s nearest town that is no capital', () => {
    const { c, cap, mine, claim } = world();
    const from = c.territories[mine[0].adj[0]];
    const at = seatFor(c, claim(from.id));
    expect(at).toBeGreaterThanOrEqual(0);
    expect(c.territories[at].owner).toBe(0);
    expect(at).not.toBe(cap.id);
  });
  it('with no border to any town of theirs, the nearest as the crow flies', () => {
    const { c, mine, wild, claim } = world();
    const at = seatFor(c, claim(wild.id));
    const nearest = [...mine].sort((a, b) => far(a, wild) - far(b, wild) || a.id - b.id)[0];
    expect(at).toBe(nearest.id);
  });
  it('never the capital, and none when the people hold nothing else', () => {
    const { c, mine, wild, claim } = world();
    for (const t of mine) t.owner = -1;
    for (const t of c.territories) if (t.owner === 0 && t.capital < 0) t.owner = -1;
    expect(seatFor(c, claim(wild.id))).toBe(-1);
  });
  it('a child of a lord\'s house has its own town or none: distance is no help to it', () => {
    const { c, wild, claim } = world();
    expect(seatFor(c, claim(wild.id, 'noble'))).toBe(-1);
  });
});
