// The convoy part of a town's panel (src/client/convoypanel.ts): each convoy on its way is shown, by road or by sea.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { sendConvoy } from '../src/sim/convoys';
import { folkOf } from '../src/sim/township';
import { convoyHtml } from '../src/client/convoypanel';

describe('convoys on their way, in the panel', () => {
  it('a convoy over a sea lane is shown going by sea, with what it carries, at both ends', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const c = newCampaign(seed, 1, 1, 'hearth');
      const lane = (c.lanes ?? []).find((l) => !c.territories[l.a].adj.includes(l.b) && c.territories[l.a].capital < 0 && c.territories[l.b].capital < 0);
      if (!lane) continue;
      for (const id of [lane.a, lane.b]) c.territories[id].owner = 0;
      c.territories[lane.a].buildings.push('harbour');
      folkOf(c, lane.a).stores.food += 500;
      expect(sendConvoy(c, 0, lane.a, lane.b, { food: 120 })).toBeTruthy();
      const here = convoyHtml(c, lane.a), there = convoyHtml(c, lane.b);
      expect(here).toContain(`⛵ To ${c.territories[lane.b].name} by sea: 120 food`);
      expect(there).toContain(`⛵ From ${c.territories[lane.a].name} by sea: 120 food`);
      return;
    }
    throw new Error('no world with a sea lane');
  });
});
