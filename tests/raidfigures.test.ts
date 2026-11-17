// The figures a player reads about a raid agree with each other (docs/PLAYTEST.md 4.7).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { reportText, strike } from '../src/sim/threats';
import type { Band } from '../src/sim/threats';
import { strengthOf, whole } from '../src/sim/strengthwords';
import { folkOf } from '../src/sim/township';

describe('a raid\'s report and what was said beforehand', () => {
  it('the report gives the band the strength the player was told, and says what it was worth on the day where that differs', () => {
    let differed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const c = newCampaign(seed, 2);
      const home = c.territories.find((t) => t.capital === 0)!;
      folkOf(c, home.id);
      const b: Band = { id: 900 + seed, kind: 'raiders', name: 'the test band', at: home.adj[0], strength: 3 + (seed % 4), since: 0, held: [] };
      (c.bands ??= []).push(b);
      const told = b.strength;
      const r = strike(c, b, home.id, []);
      expect(r.strength).toBe(told);
      const first = reportText(c, r)[0];
      expect(first).toContain(strengthOf(told));
      if (whole(r.force) !== whole(told)) { differed++; expect(first).toContain(`worth ${whole(r.force)} on the day`); }
      else expect(first).not.toContain('on the day');
    }
    expect(differed).toBeGreaterThan(0);
  });
});
