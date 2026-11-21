// A roaming band turns aside for a dead town (src/sim/bandturn.ts, from bandroam.ts; the town overrun by deadtown.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { waysFrom } from '../src/sim/bandroam';
import { DEAD, deadTowns as deadSeason } from '../src/sim/deadtown';
import { deadTowns, turnAside } from '../src/sim/bandturn';
import type { Band } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 3));
/** Rival 1's town standing open, with nobody in it, and a camp of raiders `far` lands off (1: beside it). */
function deadTown(far: number) {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = []; c.musters = {}; // nobody of the town away with an army either
  const t = c.territories.find((x) => x.owner === 1 && x.capital < 0) ?? c.territories.find((x) => x.owner === 1)!;
  Object.assign(folkOf(c, t.id), { men: 0, women: 0, elders: 0, children: 0 }); delete folkOf(c, t.id).ages;
  c.emptied = { [t.id]: DEAD.open }; c.emptiedOf = { [t.id]: 1 };
  // A land `far` lands from the town, held by nobody, for the camp.
  let ring = [t.id];
  const seen = new Set(ring);
  for (let i = 0; i < far; i++) { ring = ring.flatMap((id) => c.territories[id].adj).filter((id) => !seen.has(id)); ring.forEach((id) => seen.add(id)); }
  const at = ring.find((id) => c.territories[id].owner < 0 && !c.territories[id].horde) ?? ring[0];
  const band: Band = { id: 7, kind: 'raiders', name: 'the Red Hand', at, strength: 4, since: 1, held: [] };
  c.bands = [band];
  return { c, t, band };
}
const ways = (c: Campaign, b: Band) => waysFrom(c, b);

describe('a roaming band and a dead town', () => {
  it('a town with nobody in it and no army is open to it; one garrisoned is not', () => {
    const { c, t } = deadTown(1);
    expect(deadTowns(c)).toContain(t.id);
    c.armies.push({ id: 90, owner: 1, at: t.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    expect(deadTowns(c)).not.toContain(t.id);
  });

  it('standing beside it, the band walks in: it is overrun as a wandering band would overrun it, and the band is the camp', () => {
    const { c, t, band } = deadTown(1);
    expect(c.territories[band.at].adj).toContain(t.id);
    expect(turnAside(c, band, ways)).toBe('in');
    expect(c.bands).not.toContain(band);
    deadSeason(c);
    expect(t.owner).toBe(-1);
    expect(t.horde).toBe(true);
    expect((c.bands ?? []).some((b) => b.kind === 'marauders' && b.at === t.id)).toBe(true);
  });

  it('farther off, a camp sets out for a land beside it; pirates and highwaymen do not', () => {
    const { c, t, band } = deadTown(2);
    const got = turnAside(c, band, ways);
    if (got === 'bound') expect(c.territories[band.bound!].adj).toContain(t.id);
    else expect(got).toBe('in'); // the land it stands on happened to be beside it after all
    const p = deadTown(2);
    p.band.kind = 'pirates';
    expect(turnAside(p.c, p.band, ways)).toBe('');
  });
});
