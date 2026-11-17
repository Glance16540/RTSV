// What a campaign battle says of itself before and after (src/sim/battlecard.ts; docs/PLAYTEST.md 2 and 3).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { UNITS } from '../src/sim/data';
import { Tally, briefingOf, forceText, verdictOf } from '../src/sim/battlecard';
import { setups } from './helpers';

const text = (b: { lead: string; sections: { title: string; text: string }[] }): string => [b.lead, ...b.sections.map((s) => `${s.title}: ${s.text}`)].join('\n');

describe('the briefing of a campaign battle', () => {
  it('a field battle says what it is, whom you lead and what winning means, and nothing of the skirmish', () => {
    const b = briefingOf({ kind: 'field', mine: { clubman: 6, warlord: 1 }, foes: { clubman: 4 }, foe: 'The locals', leader: 'Clovis' });
    const t = text(b);
    expect(t).toContain('6 Clubmen');
    expect(t).toContain('led by Clovis');
    expect(t).toContain('The locals: 4 Clubmen');
    expect(t).toContain('no enemy soldier is left');
    expect(t).toContain('No one is trained here');
    for (const no of ['Train them at the Town Center', 'five ages', 'build a House', 'rivals\' Town Centers']) expect(t).not.toContain(no);
    expect(b.sections.map((s) => s.title)).toEqual(['Who you lead', 'Against you', 'What winning means', 'People', 'Afterwards']);
  });

  it('a siege says the town is the prize and that no villager is bought', () => {
    const a = text(briefingOf({ kind: 'attack', mine: { clubman: 4 }, foes: { slinger: 2 }, foe: 'The Kushites' }));
    expect(a).toContain('with no leader on the field');
    expect(a).toContain('the town is then yours on the map');
    expect(a).toContain('No villager is bought');
    expect(a).toContain('advanced on the map');
    const d = text(briefingOf({ kind: 'defend', mine: { clubman: 2 }, foes: { clubman: 6 }, foe: 'The Kushites' }));
    expect(d).toContain('at the gates of your town');
    expect(d).toContain('the town is then theirs on the map');
  });

  it('a visit says nothing is won or lost, and has nobody against it', () => {
    const b = briefingOf({ kind: 'visit', mine: { villager: 9 }, minutes: 5 });
    const t = text(b);
    expect(t).toContain('No enemy is here');
    expect(t).toContain('Nothing is won or lost here');
    expect(t).toContain('9 Villagers');
    expect(b.sections.some((s) => s.title === 'Against you')).toBe(false);
    expect(t).not.toContain('five ages');
  });

  it('a force reads in words', () => {
    expect(forceText({})).toBe('nobody');
    expect(forceText({ clubman: 1 })).toBe('1 Clubman');
    expect(forceText({ clubman: 2, slinger: 3, rider: 1 })).toBe(`3 Slingers, 2 Clubmen and 1 ${UNITS.rider.name}`);
  });
});

describe('the tally of a battle', () => {
  it('counts who each side began with, who fell by kind, and the fallen who had a name', () => {
    const g = new Game(7, setups);
    const mine = [g.spawnUnit('clubman', 0, 20, 20), g.spawnUnit('clubman', 0, 21, 20), g.spawnUnit('slinger', 0, 22, 20)];
    const foes = [g.spawnUnit('clubman', 1, 60, 60), g.spawnUnit('clubman', 1, 61, 60)];
    mine[0].name = 'Perrin'; mine[0].family = 'Stoneham';
    const t = new Tally(g);
    expect(t.of([0])).toMatchObject({ began: 3, fell: 0, left: 3 });
    expect(t.of([1]).began).toBe(2);
    for (const u of [mine[0], foes[0], foes[1]]) { u.dead = true; t.removed(u.id); } // as the game takes them off the field
    t.removed(999999); // nobody it knows
    expect(t.of([0])).toEqual({ began: 3, fell: 1, left: 2, kinds: { clubman: [2, 1], slinger: [1, 0] } });
    expect(t.of([1])).toMatchObject({ began: 2, fell: 2, left: 0 });
    expect(t.named).toEqual([{ owner: 0, name: 'Perrin Stoneham', type: 'clubman' }]);
    // Whoever arrives later is counted from then; villagers are not of the army.
    const late = g.spawnUnit('rider', 0, 23, 20);
    g.spawnUnit('villager', 0, 24, 20, 'm');
    t.watch(g);
    expect(t.of([0]).began).toBe(4);
    late.dead = true; t.removed(late.id);
    expect(t.of([0, 1])).toMatchObject({ began: 6, fell: 4, left: 2 });
  });
});

describe('words the size of what happened', () => {
  it('four tribesmen are a skirmish, not a people in ruins', () => {
    const v = verdictOf(true, true, 4, 0, 'the locals');
    expect(v).toContain('A skirmish won without the loss of a man');
    expect(v).toContain('4 men of the locals are down');
    expect(v).not.toContain('ruins');
    expect(v).not.toContain('for ages');
  });
  it('and a great battle is told for ages', () => {
    expect(verdictOf(true, true, 40, 12)).toContain('A great battle won at the cost of 12 men');
    expect(verdictOf(true, true, 40, 12)).toContain('for ages');
    expect(verdictOf(true, false, 20, 1)).toContain('A battle won at the cost of 1 man: the town is taken or held');
    expect(verdictOf(false, true, 0, 6, 'the Kushites')).toBe('A skirmish lost: 6 men of yours are down, and the Kushites lost nobody. The field is theirs.');
    expect(verdictOf(false, false, 3, 20)).toContain('The town is theirs.');
  });
});
