// A known person carried off by a nation is marked by name (src/sim/carriednamed.ts, read by carriedoff.ts townFell).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Carried } from '../src/sim/carriedoff';
import { carriedNamed } from '../src/sim/carriednamed';
import { bringHome } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';
import type { Notable } from '../src/sim/township';
import { townGrief } from '../src/sim/notableweight';

const mother = (name: string, turn: number): Notable => ({ name, family: name.split(' ')[1], gender: 'f', kind: 'mother', kids: 4, deed: 'raised four children', turn });
const world = () => {
  const c = newCampaign(7, 2, 1, 'hearth');
  c.turn = 30;
  const t = c.territories.find((x) => x.capital === 0)!, f = folkOf(c, t.id);
  f.notables = [mother('Agnes Reeve', 3), mother('Edith Moss', 12)];
  f.houses = [];
  return { c, t, f };
};
const led = (c: ReturnType<typeof newCampaign>, tid: number, women: number, men: number, id = 1): Carried =>
  ({ id, by: 1, at: 99, held: { from: tid, owner: 0, women: Array(women).fill(100), men: Array(men).fill(100), since: c.turn } });

describe('a known person carried off is marked by name', () => {
  it('when every woman left and led away is known, those led away are known, the one known most lately first', () => {
    const { c, t, f } = world();
    f.women = 0;
    const x = led(c, t.id, 1, 0);
    const out = carriedNamed(c, x, 'the Greeks');
    expect(out.map((n) => n.name)).toEqual(['Edith Moss']);
    expect(out[0].lost).toEqual({ turn: c.turn, how: 'carried off by the Greeks' });
    expect(x.held.names).toEqual(['Edith Moss']);
    expect(townGrief(f.notables, c.turn)).toBeGreaterThan(0);
    expect(c.log.join('\n')).toContain('Edith Moss');
  });

  it('only of the sex led away: men led away take no mother', () => {
    const { c, t, f } = world();
    f.men = 0;
    expect(carriedNamed(c, led(c, t.id, 0, 3), 'the Greeks')).toEqual([]);
  });

  it('as likely as the known are among the grown: of a large town, few', () => {
    let known = 0;
    for (let i = 1; i <= 300; i++) {
      const { c, t, f } = world();
      c.turn = i; f.women = 98;
      known += carriedNamed(c, led(c, t.id, 2, 0, i), 'the Greeks').length;
    }
    // Two known among a hundred women, two led away: about 4 in 100 seasons.
    expect(known / 300).toBeGreaterThan(0.01);
    expect(known / 300).toBeLessThan(0.1);
  });

  it('got back, she is known again: her loss is lifted', () => {
    const { c, t, f } = world();
    f.women = 0;
    const x = led(c, t.id, 1, 0);
    carriedNamed(c, x, 'the Greeks');
    bringHome(c, x.held);
    expect(f.notables.find((n) => n.name === 'Edith Moss')!.lost).toBeUndefined();
  });
});
