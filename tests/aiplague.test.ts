// The computer's armies keep out of plague on the map where they can (src/sim/aiplague.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { leavePlague, safeStep, sickAt, sickLast } from '../src/sim/aiplague';

const plague = (c: Campaign, at: number) => { (c.events ??= []).push({ kind: 'plague', at, until: c.turn + 2 } as never); };

describe('plague and the computer\'s armies', () => {
  it('knows a sick land, and puts sick lands last among those it would march on', () => {
    const c = newCampaign(3, 2);
    plague(c, 4);
    expect(sickAt(c, 4)).toBe(true);
    expect(sickAt(c, 5)).toBe(false);
    expect(sickLast(c, [4, 5, 6])).toEqual([5, 6, 4]);
    expect(safeStep(c, 4)).toBe(false);
    expect(safeStep(c, 5)).toBe(true);
  });

  it('takes an army out of a sick land to a healthy one of its own with no army in it, and stays where there is none', () => {
    const c = newCampaign(3, 2);
    const home = c.territories.find((t) => t.owner === 1)!;
    const next = c.territories[home.adj[0]];
    next.owner = 1;
    c.armies = c.armies.filter((a) => a.at !== home.id && a.at !== next.id);
    const army = { id: 77, owner: 1, at: home.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false };
    c.armies.push(army);
    expect(leavePlague(c, army)).toBe(-1); // nothing to leave
    plague(c, home.id);
    for (const n of home.adj) if (n !== next.id && c.territories[n].owner === 1) c.territories[n].owner = 2;
    expect(leavePlague(c, army)).toBe(next.id);
    plague(c, next.id);
    expect(leavePlague(c, army)).toBe(-1); // the only way out is sick too
  });
});
