// An empty land says whether a town of yours can reach it, and a founding is told once (docs/PLAYTEST.md 3.1, 3.2).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { settleReach, settle } from '../src/sim/migration';
import { convoysTurn } from '../src/sim/convoys';
import { reportLines, reportSince, snapshot } from '../src/sim/seasonreport';
import { folkOf } from '../src/sim/township';

function world() {
  for (let seed = 1; seed < 40; seed++) {
    const c = newCampaign(seed, 1, 1, 'hearth');
    c.fronts = [];
    const home = c.territories.find((t) => t.capital === 0)!;
    const near = c.territories.find((t) => t.nearHome === 0);
    if (!near) continue;
    const f = folkOf(c, home.id); f.men = 12; f.women = 12; f.elders = 2; f.children = 6; delete f.ages; delete f.hungry;
    f.stores = { food: 3000, wood: 900, gold: 900, stone: 900 };
    return { c, home: home.id, near: near.id };
  }
  throw new Error('no capital with an empty land beside it');
}

describe('an empty land says whether settlers can reach it', () => {
  it('in reach from the chief town, a season on the road; out of reach, it says why', () => {
    const { c, home, near } = world();
    expect(settleReach(c, 0, near)).toBe(`In reach: settlers from ${c.territories[home].name} would be a season on the road. Send them from the town's convoy part.`);
    // With somebody living on the land between, a land two out is out of reach, and it says why.
    const two = c.territories.find((t) => t.adj.includes(near) && t.owner < 0 && t.capital < 0 && !c.territories[home].adj.includes(t.id))!;
    two.militia = 0; two.buildings = []; delete two.town; two.horde = false; two.wild = false;
    two.folk = { men: 0, women: 0, elders: 0, children: 0, stores: { food: 0, wood: 0, gold: 0, stone: 0 }, notables: [] };
    c.bands = (c.bands ?? []).filter((b) => b.at !== two.id && b.to !== two.id);
    expect(settleReach(c, 0, two.id)).toContain('2 seasons on the road');
    folkOf(c, near).men = 3; // a people now lives on the land between
    expect(settleReach(c, 0, two.id)).toMatch(/^No town of yours can reach it/);
    // A land somebody lives on, or true wilderness, says nothing of settlers.
    expect(settleReach(c, 0, home)).toBe('');
  });
});

describe('a founding is told once on the season\'s card', () => {
  it('the settlers\' line, with the settlers\' sign, and not as a land won', () => {
    const { c, home, near } = world();
    const s = snapshot(c);
    expect(settle(c, 0, home, near)).toBe('');
    c.turn++;
    convoysTurn(c);
    expect(c.territories[near].owner).toBe(0);
    const lines = reportLines(reportSince(c, s));
    const name = c.territories[near].name;
    expect(lines.filter((l) => l.text.includes(name))).toEqual([
      expect.objectContaining({ kind: 'settle', text: expect.stringContaining(`have founded ${name}`) }),
    ]);
  });
});
