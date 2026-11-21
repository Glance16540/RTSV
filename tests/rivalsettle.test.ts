// A rival sends people by road to a town of its own that has too few (src/sim/rivalsettle.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { convoysTurn } from '../src/sim/convoys';
import { MIGRATE } from '../src/sim/migration';
import { RIVAL_SETTLE, rivalSettles, townsInNeed } from '../src/sim/rivalsettle';
import { folkOf, grown } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** Rival 1 with a full town and a town beside it all but empty. */
function rival() {
  const c: Campaign = JSON.parse(base);
  c.armies = []; c.bands = []; c.convoys = [];
  const big = c.territories.find((t) => t.capital === 1)!;
  const small = c.territories.find((t) => big.adj.includes(t.id) && t.capital < 0 && !t.rim)!;
  for (const t of c.territories) if (t.owner === 1 && t !== big) t.owner = -1;
  small.owner = 1; small.horde = false;
  Object.assign(folkOf(c, big.id), { men: 16, women: 16, elders: 2, children: 6 }); delete folkOf(c, big.id).ages;
  Object.assign(folkOf(c, small.id), { men: 1, women: 1, elders: 0, children: 0 }); delete folkOf(c, small.id).ages;
  c.factions[1].isAI = true;
  return { c, big, small };
}
/** Seasons until it sends, at most `n`. */
const until = (c: Campaign, f: number, n = 40) => { for (let i = 0; i < n; i++) { const s = rivalSettles(c, f); if (s) return s; c.turn++; } return null; };

describe('a rival sends settlers to its town in need', () => {
  it('a town with too few grown people is in need; a full one is not', () => {
    const { c, big, small } = rival();
    expect(townsInNeed(c, 1)).toEqual([small.id]);
    expect(townsInNeed(c, 1)).not.toContain(big.id);
  });

  it('sends couples and their children by road from its fullest town, and they are of the town when they come in', () => {
    const { c, big, small } = rival();
    const before = grown(folkOf(c, small.id));
    const s = until(c, 1)!;
    expect(s).toEqual([big.id, small.id]);
    const x = (c.convoys ?? []).find((y) => y.to === small.id && y.movers)!;
    expect(x.cargo.men.length).toBe(MIGRATE.settlers);
    expect(townsInNeed(c, 1)).not.toContain(small.id); // on the way: not sent twice
    c.turn++;
    convoysTurn(c);
    expect(grown(folkOf(c, small.id))).toBe(before + 2 * MIGRATE.settlers);
  });

  it('only by chance a season, only for a rival the computer leads, and never the player\'s towns', () => {
    const { c } = rival();
    let sent = 0;
    for (let i = 0; i < 200; i++) { const x = rival(); x.c.turn = i; if (rivalSettles(x.c, 1)) sent++; }
    expect(sent / 200).toBeGreaterThan(RIVAL_SETTLE.chance - 0.15);
    expect(sent / 200).toBeLessThan(RIVAL_SETTLE.chance + 0.15);
    expect(rivalSettles(c, 0)).toBeNull();
  });
});
