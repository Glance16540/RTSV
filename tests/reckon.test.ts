// Who is a neighbour to reckon with (src/sim/reckon.ts): an empty or a wild land is no frontier.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign, playForPlayer } from '../src/sim/campaign';
import { folkOf } from '../src/sim/township';
import { nobodyThere } from '../src/sim/founding';
import { onFrontier, reckoned } from '../src/sim/reckon';
import { RIVAL, homeIdle } from '../src/sim/rivalrule';
import { worldsBeforeEmptyBeside } from './helpers';

worldsBeforeEmptyBeside(); // written before every people had an empty land beside its chief town: the worlds these tests were written with

/** A world, the player's capital, and one land beside it. */
const world = (): { c: Campaign; home: number; next: number } => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  return { c, home: home.id, next: home.adj[0] };
};
/** Empty a land of everybody, as a land waiting for settlers is. */
const emptied = (c: Campaign, tid: number): void => { const t = c.territories[tid]; t.owner = -1; (t as { militia?: number }).militia = 0; Object.assign(folkOf(c, tid), { men: 0, women: 0, elders: 0, children: 0 }); delete folkOf(c, tid).ages; };

describe('a neighbour to reckon with', () => {
  it('a tribe\'s land and a rival\'s are; one\'s own is not', () => {
    const { c, home, next } = world();
    expect(reckoned(c, 0, next)).toBe(true); // a tribe lives there
    c.territories[next].owner = 1;
    expect(reckoned(c, 0, next)).toBe(true);
    expect(reckoned(c, 1, next)).toBe(false);
    expect(reckoned(c, 0, home)).toBe(false);
    expect(reckoned(c, 0, 9999)).toBe(false);
  });

  it('a land with nobody on it is not, nor is wilderness', () => {
    const { c, next } = world();
    emptied(c, next);
    expect(nobodyThere(c, next)).toBe(true);
    expect(reckoned(c, 0, next)).toBe(false);
    const wild = c.territories.find((t) => t.wild);
    if (wild) expect(reckoned(c, 0, wild.id)).toBe(false);
  });

  it('a town is on a frontier only if somebody is beside it', () => {
    const { c, home } = world();
    expect(onFrontier(c, 0, home)).toBe(true);
    for (const n of c.territories[home].adj) emptied(c, n);
    expect(onFrontier(c, 0, home)).toBe(false);
  });
});

describe('what a rival makes of it', () => {
  it('an army beside nothing but empty land is deep in its own country: it counts its seasons idle, where beside a tribe it never did', () => {
    const { c } = world();
    const rival = c.territories.find((t) => t.capital === 1)!;
    const a = c.armies.find((x) => x.owner === 1 && x.at === rival.id)!;
    expect(a).toBeTruthy();
    homeIdle(c, 1); homeIdle(c, 1);
    expect(c.idle![a.id].n).toBe(0); // a tribe beside it: at the front
    for (const n of rival.adj) emptied(c, n);
    homeIdle(c, 1); homeIdle(c, 1); homeIdle(c, 1);
    expect(c.idle![a.id]).toEqual({ at: rival.id, n: 3 });
    expect(RIVAL.idle).toBeGreaterThan(3);
  });

  it('a people the computer plays, with only empty land about it, begins no battle there', () => {
    const { c, home } = world();
    for (const n of c.territories[home].adj) emptied(c, n);
    playForPlayer(c);
    expect(c.pending).toBeNull();
    expect(c.territories[home].owner).toBe(0);
  });
});
