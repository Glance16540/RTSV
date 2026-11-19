// The visit's own guide (src/sim/visitguide.ts).
import { describe, expect, it } from 'vitest';
import { visitSteps } from '../src/sim/visitguide';
import { Game } from '../src/sim/game';
import { setups } from './helpers';

describe('a guide for a visit', () => {
  it('tells what a visit is for, that the season waits, what goes home, and how to leave, one after another', () => {
    const g = new Game(4, setups, 72);
    for (const u of g.units) if (u.owner === 0 && u.type === 'villager') u.setTo = 'food'; // turned out to work as the visit began (atwork.ts)
    let s = visitSteps(g, 0, 15);
    expect(s.map((x) => x.title)).toEqual(['A visit to your own town', 'The season waits for you', 'What goes home', 'Leaving the town']);
    expect(s[1].how).toContain('15 minutes');
    expect(s.findIndex((x) => !x.done)).toBe(0);
    g.time = 50; // the first step is put by after a while, or once the player gives orders of their own
    s = visitSteps(g, 0, 15);
    expect(s.findIndex((x) => !x.done)).toBe(1);
    g.time = 200;
    s = visitSteps(g, 0, 15);
    expect(s.findIndex((x) => !x.done)).toBe(3); // the way out stays up to the end
    expect(s.every((x) => !/child/i.test(x.how + x.title))).toBe(true);
  });
});
