// Going to marry: a town of one sex draws the unmarried of its people's other towns (src/sim/suitors.ts).
import { bareCampaign, smallTownRules } from './helpers';
import { describe, expect, it } from 'vitest';

import { convoysTurn } from '../src/sim/convoys';
import { sparedMen } from '../src/sim/armytown';
import { SUIT, couldSend, suitorsOf, suitorsSeason, unmarried, wantOf, wantText } from '../src/sim/suitors';
import { TOLL, folkOf, tollFolk } from '../src/sim/township';

smallTownRules(); // these tests are about how men go to an army and come home, written with towns of ten men: the figures they were written with
SUIT.go = 2; SUIT.spared = 1; // and those who set out to marry, as they were for towns of that size

/** The player's chief town and a town next to it, both theirs, with the people asked for. */
const pair = () => {
  const c = bareCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  const near = c.territories.find((t) => home.adj.includes(t.id) && !t.horde && t.capital < 0)!;
  near.owner = 0;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.convoys = [];
  const set = (tid: number, men: number, women: number) => { const f = folkOf(c, tid); Object.assign(f, { men, women, elders: 0, children: 0 }); delete f.ages; delete f.houses; return f; };
  return { c, home, near, set };
};

describe('going to marry', () => {
  it('a town with no men draws unmarried men from a town of its people that has them, by road, a season on the way', () => {
    const { c, home, near, set } = pair();
    const a = set(home.id, 8, 4), b = set(near.id, 0, 5);
    expect(wantOf(c, near.id)).toEqual({ sex: 'men', n: SUIT.go, none: true });
    expect(unmarried(c, home.id, 'men')).toBe(4);
    expect(suitorsOf(c, 0)).toEqual([{ from: home.id, to: near.id, sex: 'men', n: SUIT.go }]);
    expect(a.men).toBe(8 - SUIT.go);
    expect(b.men).toBe(0); // on the road
    expect(c.log.at(-1)).toContain('to marry');
    expect(c.log.at(-1)).toContain(near.name);
    expect(suitorsOf(c, 0)).toEqual([]); // nobody else sets out while they are on the way
    c.turn++;
    convoysTurn(c);
    expect(b.men).toBe(SUIT.go);
    expect(wantOf(c, near.id)).toBeNull();
  });

  it('a town with no women draws unmarried women the same way', () => {
    const { c, home, near, set } = pair();
    const a = set(home.id, 3, 7), b = set(near.id, 4, 0);
    expect(wantOf(c, near.id)).toEqual({ sex: 'women', n: SUIT.go, none: true });
    expect(suitorsOf(c, 0)).toEqual([{ from: home.id, to: near.id, sex: 'women', n: SUIT.go }]);
    expect(a.women).toBe(7 - SUIT.go);
    c.turn++;
    convoysTurn(c);
    expect(b.women).toBe(SUIT.go);
  });

  it('a town badly short of one sex draws one', () => {
    const { c, home, near, set } = pair();
    set(home.id, 8, 4); set(near.id, 2, 2 * SUIT.short);
    expect(wantOf(c, near.id)).toEqual({ sex: 'men', n: 1, none: false });
    expect(suitorsOf(c, 0)).toEqual([{ from: home.id, to: near.id, sex: 'men', n: 1 }]);
    expect(wantText(c, near.id)).toContain('few men');
  });

  it('the unmarried go first; to a town with no men at all, failing them, one man his town could spare to an army', () => {
    const { c, home, near, set } = pair();
    // Five men and five women: no unmarried man, but the town keeps two men and a man for every other woman, so two could go to war.
    const a = set(home.id, 5, 5); set(near.id, 0, 5);
    expect(unmarried(c, home.id, 'men')).toBe(0);
    expect(sparedMen(c, home.id)).toBe(2);
    expect(couldSend(c, home.id, 'men', true)).toBe(SUIT.spared);
    expect(suitorsOf(c, 0)).toEqual([{ from: home.id, to: near.id, sex: 'men', n: SUIT.spared }]);
    expect(a.men).toBe(5 - SUIT.spared);
    // Not to a town that is only short of men: that waits for the unmarried.
    expect(couldSend(c, home.id, 'men', false)).toBe(0);
    // A town at what it keeps sends nobody.
    const again = pair();
    const k = again.set(again.home.id, 3, 5); again.set(again.near.id, 0, 5);
    expect(sparedMen(again.c, again.home.id)).toBe(0);
    expect(suitorsOf(again.c, 0)).toEqual([]);
    expect(k.men).toBe(3);
    // A town of men only keeps one of them at home whatever it could send.
    again.set(again.home.id, 2, 0);
    expect(unmarried(again.c, again.home.id, 'men')).toBe(1);
    // A town that wants for one sex itself sends nobody of the other.
    again.set(again.home.id, 9, 1); again.set(again.near.id, 0, 5);
    expect(wantOf(again.c, again.home.id)!.sex).toBe('women');
    expect(suitorsOf(again.c, 0)).toEqual([]);
  });

  it('nobody goes without a road through their own lands, or to another people', () => {
    const { c, home, set } = pair();
    const far = c.territories.find((t) => !home.adj.includes(t.id) && t.owner < 0 && !t.horde && !t.adj.some((n) => c.territories[n].owner === 0))!;
    far.owner = 0;
    set(home.id, 8, 4);
    const k = folkOf(c, far.id); Object.assign(k, { men: 0, women: 5, elders: 0, children: 0 }); delete k.ages;
    expect(suitorsOf(c, 0).some((p) => p.to === far.id)).toBe(false);
    expect(suitorsOf(c, 1).every((p) => c.territories[p.from].owner === 1 && c.territories[p.to].owner === 1)).toBe(true);
  });

  it('a rival\'s towns do the same, and say nothing to the player', () => {
    const c = bareCampaign(7, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 1)!;
    const near = c.territories.find((t) => home.adj.includes(t.id) && !t.horde && t.capital < 0)!;
    near.owner = 1; c.convoys = [];
    for (const t of c.territories) if (t.owner === 1 && t !== home && t !== near) t.owner = -1;
    const a = folkOf(c, home.id), b = folkOf(c, near.id);
    Object.assign(a, { men: 8, women: 4 }); delete a.ages; Object.assign(b, { men: 0, women: 5 }); delete b.ages;
    const said = c.log.length;
    expect(suitorsSeason(c).filter((p) => p.to === near.id)).toEqual([{ from: home.id, to: near.id, sex: 'men', n: SUIT.go }]);
    expect(c.log.length).toBe(said);
  });
});

describe('a battle nobody watched leaves a town with women its last man', () => {
  it('the toll never takes the last man of a town with women in it', () => {
    const { c, near, set } = pair();
    const f = set(near.id, 1, 4);
    expect(tollFolk(c, near.id, true)).toBe(0);
    expect(f.men).toBe(TOLL.last);
    set(near.id, 3, 4);
    expect(tollFolk(c, near.id, true)).toBe(1);
    // A town of men only can still lose them all.
    const g = set(near.id, 1, 0);
    expect(tollFolk(c, near.id, true)).toBe(1);
    expect(g.men).toBe(0);
  });
});
