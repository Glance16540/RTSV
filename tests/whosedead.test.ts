// A town that changed hands in a battle: its dead are told as its old holder's people, and those left as its new holder's (township.ts settleFolk).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { Census, folkOf, headcount, settleFolk } from '../src/sim/township';

const fewer = (c: ReturnType<typeof newCampaign>, tid: number, n: number): Census => {
  const f = folkOf(c, tid);
  delete f.fieldHome;
  return { men: Math.max(0, f.men - n), women: f.women, elders: f.elders, children: f.children, stores: { ...f.stores }, taken: 0, named: [] };
};

describe('whose dead', () => {
  it('a tribe\'s town taken: the dead were the locals\', and those left are yours now', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const t = c.territories.find((x) => x.owner < 0 && !x.horde && headcount(folkOf(c, x.id)) > 4)!;
    const census = fewer(c, t.id, 2);
    t.owner = 0; // taken
    settleFolk(c, t.id, census, { taken: true, was: -1 });
    const left = headcount(folkOf(c, t.id));
    expect(c.log.at(-1)).toBe(`Of the locals at ${t.name}, 2 died: ${left} are now yours.`);
  });

  it('your town taken by a rival: the dead were yours, and those left are theirs now', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const t = c.territories.find((x) => x.owner === 0)!;
    const census = fewer(c, t.id, 3);
    t.owner = 1;
    settleFolk(c, t.id, census, { taken: true, was: 0 });
    expect(c.log.at(-1)).toMatch(new RegExp(`^Of your people at ${t.name}, 3 died: \\d+ are now the ${c.factions[1].name}'\\.$`));
  });

  it('a town held is told as before', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const t = c.territories.find((x) => x.owner === 0)!;
    settleFolk(c, t.id, fewer(c, t.id, 1), { was: 0 });
    expect(c.log.at(-1)).toMatch(new RegExp(`^Of your people at ${t.name}, 1 died: \\d+ remain\\.$`));
  });
});
