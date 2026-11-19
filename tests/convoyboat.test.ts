// A convoy over a sea lane goes by boat on that leg, and walks the rest (src/client/convoydraw.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { convoyWalker, seaLegs } from '../src/client/convoydraw';
import { walk } from '../src/client/caravandraw';
import type { Convoy } from '../src/sim/convoys';

describe('a convoy\'s boat', () => {
  it('takes the sea legs by boat and the land legs on foot', () => {
    const c = newCampaign(7);
    const a = c.territories[0], b = c.territories[a.adj[0]];
    const across = c.territories.find((t) => t.id !== a.id && !a.adj.includes(t.id) && t.id !== b.id)!;
    c.lanes = [{ a: b.id, b: across.id }] as never;
    const road = [a.id, b.id, across.id];
    expect(seaLegs(c, road)).toEqual([false, true]);
    const w = convoyWalker(c, { id: 1, owner: 0, from: a.id, to: across.id, road, cargo: {}, since: 0 } as unknown as Convoy);
    expect(w.boat && w.train).toBeTruthy();
    const flat = (): [number, number, number] => [0, 0, 0];
    // Half a lap in is a quarter through the second leg (both legs being alike long or not, it is past the first town).
    const lap = 40;
    let wet = false, dry = false;
    for (let t = 0; t < lap; t += 0.5) { walk(w, t, flat, lap); if (w.boat!.visible) { wet = true; expect(w.train!.visible).toBe(false); } else dry = true; }
    expect(wet && dry).toBe(true);
  });

  it('is only the train where the road is all by land', () => {
    const c = newCampaign(7);
    const a = c.territories[0], b = c.territories[a.adj[0]];
    const w = convoyWalker(c, { id: 2, owner: 0, from: a.id, to: b.id, road: [a.id, b.id], cargo: {}, since: 0 } as unknown as Convoy);
    expect(w.boat).toBeUndefined();
  });
});
