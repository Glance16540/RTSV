// A couple waits for a child while the town's larder is thin (src/sim/seasonfolk.ts LEAN_BIRTH).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { LEAN_BIRTH, seasonTown } from '../src/sim/seasonfolk';
import { layTown } from '../src/sim/rivalrule';
import { folkOf, headcount } from '../src/sim/township';

function town(food: (heads: number) => number) {
  const c = newCampaign(4, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.capital === 0)!;
  const f = folkOf(c, t.id);
  f.men = 10; f.women = 10; f.elders = 0; f.children = 0; f.wed = 10; delete f.ages; delete f.hungry;
  delete t.town; layTown(c, t.id);
  t.town!.b.push(...Array.from({ length: 10 }, (_, i): [string, number, number] => ['house', 60 + i * 3, 70]));
  f.stores.food = food(headcount(f));
  return { c, tid: t.id, f };
}

describe('births wait on a thin larder', () => {
  it('a town with food enough bears; one under LEAN_BIRTH a head waits, the births still due', () => {
    let fed = 0, thin = 0;
    for (let s = 0; s < 8; s++) {
      const a = town((n) => (LEAN_BIRTH + 40) * n); a.c.turn += s; fed += seasonTown(a.c, a.tid).born;
      const b = town((n) => (LEAN_BIRTH - 1) * n); b.c.turn += s; thin += seasonTown(b.c, b.tid).born;
      expect(b.f.due).toBeGreaterThan(0); // the children are still due, and come when there is bread
    }
    expect(fed).toBeGreaterThan(0);
    expect(thin).toBe(0);
  });
});
