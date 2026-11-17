// The answer at the hall keeps its names as they are (docs/PLAYTEST.md 5.5; src/sim/courtfield.ts cmdAnswer).
import { describe, expect, it } from 'vitest';
import { cmdAnswer } from '../src/sim/courtfield';
import { Game } from '../src/sim/game';
import { setups } from './helpers';

describe('the answer at the hall', () => {
  it('is told with its first letter lowered and its names capitalised', () => {
    const g = new Game(1, setups);
    const said: string[] = [];
    g.msg = (_p: number, t: string) => { said.push(t); };
    g.players[0].court = { id: 1, kind: 'suitor', guest: 'Alder of the house of Kallias', daughter: 'Maren', willing: true, answers: [{ id: 'give', label: 'Give Maren to Alder' }] } as never;
    expect(cmdAnswer(g, 0, 'give')).toBe(true);
    expect(said.at(-1)).toBe('Your answer is given at the hall: give Maren to Alder. It is done when you leave the town.');
  });
});
