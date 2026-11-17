// The answers on the hall's card say whose they are (src/client/courtfieldui.ts; docs/PLAYTEST.md 5.7).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { answerCommands } from '../src/client/courtfieldui';

describe('answers at the hall, with an envoy and a suitor both waiting', () => {
  it('every answer names the guest it is given to, in its name and in its tip, and no two commands read alike', () => {
    const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'england' }]);
    const hall = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
    g.players[0].court = {
      id: 1, kind: 'rival', guest: 'the envoy of Temur of the Mongols', answers: [{ id: 'defy', label: 'Defy him: Maren stays' }, { id: 'buy', label: 'Buy him off (6 supplies)' }, { id: 'yield', label: 'Send Maren over the border' }],
      also: [{ id: 2, kind: 'suitor', guest: 'Batu of the house of Kallias of the Romans', daughter: 'Elin', willing: true, answers: [{ id: 'give', label: 'Give Elin to Batu' }, { id: 'decline', label: 'Decline, with gifts (3 supplies)' }, { id: 'spurn', label: 'Send him off with an insult' }] }],
    };
    const cmds = answerCommands(g, 0, hall);
    expect(cmds.map((x) => x.id)).toEqual(['court:defy', 'court:buy', 'court:yield', 'court:ask', 'court:give', 'court:decline', 'court:spurn']);
    for (const x of cmds.slice(0, 3)) { expect(x.name).toMatch(/^To the envoy: /); expect(x.desc).toContain('the envoy of Temur of the Mongols'); }
    for (const x of cmds.slice(4)) { expect(x.name).toMatch(/^To Batu: /); expect(x.desc).toContain('Batu of the house of Kallias'); }
    expect(cmds[3].name).toBe('Ask Elin');
    expect(cmds[3].desc).toContain('Batu');
    expect(new Set(cmds.map((x) => x.name)).size).toBe(cmds.length);
    // The labels the map gave are kept whole after the guest's name.
    expect(cmds[5].name).toBe('To Batu: Decline, with gifts (3 supplies)');
    // Not on another building, and not for another side.
    expect(answerCommands(g, 1, hall)).toEqual([]);
  });
});
