// Who stands at the hall in a court visit (src/sim/hallguests.ts).
import { describe, expect, it } from 'vitest';
import { cmdAnswer } from '../src/sim/courtfield';
import { Game } from '../src/sim/game';
import { hallGuests } from '../src/sim/hallguests';
import { setups } from './helpers';

const game = (court: object) => { const g = new Game(1, setups); g.msg = () => {}; g.players[0].court = court as never; return g; };
const suitor = () => ({ id: 7, kind: 'suitor', guest: 'Alder of the house of Kallias of the Greeks', civ: 'greece', daughter: 'Maren', willing: true, answers: [{ id: 'give', label: 'Give Maren to Alder' }, { id: 'decline', label: 'Decline, with gifts' }] });

describe('hallguests', () => {
  it('nobody stands at the hall where there is no story, or only a plot', () => {
    expect(hallGuests(new Game(1, setups), 0)).toEqual([]);
    expect(hallGuests(game({ id: 1, kind: 'plot', answers: [], nobles: [] }), 0)).toEqual([]);
  });

  it('a rival\'s envoy stands there by name, of his own people, until the answer is given', () => {
    const g = game({ id: 3, kind: 'rival', guest: 'the envoy of Temur of the Mongols', civ: 'steppe', answers: [{ id: 'defy', label: 'Defy him: Elin stays' }] });
    expect(hallGuests(g, 0)).toEqual([{ key: '3:envoy', role: 'envoy', name: 'The envoy of Temur of the Mongols', female: false, civ: 'steppe' }]);
    expect(cmdAnswer(g, 0, 'defy')).toBe(true);
    expect(hallGuests(g, 0)).toEqual([]);
  });

  it('a suitor stands there; the daughter, a woman of the town, comes when she is asked; both go with the answer', () => {
    const g = game(suitor());
    expect(hallGuests(g, 0).map((x) => x.role)).toEqual(['suitor']);
    expect(cmdAnswer(g, 0, 'ask')).toBe(true);
    const now = hallGuests(g, 0);
    expect(now.map((x) => x.role)).toEqual(['suitor', 'daughter']);
    expect(now[1]).toMatchObject({ name: 'Maren', female: true, civ: g.players[0].civ });
    expect(now[0]).toMatchObject({ female: false, civ: 'greece' });
    expect(cmdAnswer(g, 0, 'decline')).toBe(true);
    expect(hallGuests(g, 0)).toEqual([]);
  });

  it('both stories at once: the envoy and the suitor each stand there', () => {
    const g = game({ id: 3, kind: 'rival', guest: 'the envoy of Temur', answers: [], also: [suitor()] });
    expect(hallGuests(g, 0).map((x) => x.key)).toEqual(['3:envoy', '7:suitor']);
  });
});
