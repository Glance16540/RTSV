// A leader alone in an ungarrisoned town is counted when the battle for it is settled on the map (src/sim/seatedleader.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { seat } from '../src/sim/court';
import { breakOf } from '../src/sim/mapbattle';
import { seatLeader, seatedAlone } from '../src/sim/seatedleader';

const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  seat(c, 0, home.id);
  c.factions[0].heroRank = 3;
  return { c, home };
};

describe('a leader holding a town alone', () => {
  it('leads its defence on the map, at their rank', () => {
    const { c, home } = world();
    const p = { defender: 0, to: home.id };
    expect(seatedAlone(c, p)).toBe(true);
    const d: { led?: boolean; rank?: number } = { led: false, rank: 0 };
    expect(seatLeader(c, p, d)).toBe(true);
    expect(d).toEqual({ led: true, rank: 3 });
  });

  it('a side led breaks later, as an army with its leader does', () => {
    const f = { units: { infantry: 4 }, weight: 4 };
    expect(breakOf({ ...f, led: true, rank: 3 })).toBeGreaterThan(breakOf(f));
  });

  it('not where the leader is elsewhere, rides with an army there, or for the attacker', () => {
    const { c, home } = world();
    const other = c.territories[home.adj[0]];
    expect(seatedAlone(c, { defender: 0, to: other.id })).toBe(false);
    expect(seatedAlone(c, { defender: 1, to: home.id })).toBe(false);
    c.armies.push({ id: 60, owner: 0, at: home.id, units: { infantry: 1 }, hero: true, vet: 0, moved: false });
    expect(seatedAlone(c, { defender: 0, to: home.id })).toBe(false);
    const d = { led: true, rank: 1 };
    expect(seatLeader(c, { defender: 0, to: home.id }, d)).toBe(false);
    expect(d).toEqual({ led: true, rank: 1 });
  });
});
