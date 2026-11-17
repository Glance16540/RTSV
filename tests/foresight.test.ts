// A sensible ruler's foresight (src/sim/decrees.ts, FORESIGHT): guards where a band has its place at the town or
// beside it, before it strikes.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { bandNear, decreesAt, sensibleDecrees } from '../src/sim/decrees';

const quiet = () => ({ hungry: false, raided: false, moved: 0, standing: 0 });

describe('a sensible ruler\'s foresight', () => {
  it('posts guards where a band is camped beside the town, and not where none is near', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const tid = c.territories.find((t) => t.capital === 1)!.id;
    c.factions[1].supplies = 30;
    c.bands = [];
    expect(bandNear(c, tid)).toBe(false);
    sensibleDecrees(c, 1, quiet);
    expect(decreesAt(c, tid).map((d) => d.kind)).not.toContain('guards');
    const beside = c.territories[tid].adj[0];
    c.bands = [{ id: 1, kind: 'raiders', name: 'the Red Hands', at: beside, strength: 3, since: 0, held: [] }];
    expect(bandNear(c, tid)).toBe(true);
    sensibleDecrees(c, 1, quiet);
    expect(decreesAt(c, tid).map((d) => d.kind)).toContain('guards');
  });

  it('a road\'s band near either end counts', () => {
    const c = newCampaign(5, 1, 1, 'hearth');
    const tid = c.territories.find((t) => t.capital === 1)!.id, far = c.territories.find((t) => t.id !== tid && !c.territories[tid].adj.includes(t.id) && !t.adj.includes(tid))!;
    c.bands = [{ id: 1, kind: 'highwaymen', name: 'the Toll-takers', at: far.id, to: tid, strength: 3, since: 0, held: [] }];
    expect(bandNear(c, tid)).toBe(true);
  });
});
