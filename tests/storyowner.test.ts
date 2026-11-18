// A story whose people are gone ends, and the season goes on (src/sim/intrigue.ts intrigueSeason, courtstory.ts
// courtStep): a season used to crash reading `fac.alive` of a court story whose owner had no faction.
import { describe, expect, it } from 'vitest';
import { endTurn, newCampaign } from '../src/sim/campaign';
import { courtStep } from '../src/sim/courtstory';
import { intrigueSeason } from '../src/sim/intrigue';
import type { Intrigue } from '../src/sim/intriguebase';

/** A story of the given kind and owner, laid into the campaign as the map keeps it. */
function story(c: ReturnType<typeof newCampaign>, kind: string, owner: number, at: number, id: number): Intrigue {
  const it = { id, kind, owner, at, since: c.turn - 1, people: [], culprit: 0, victims: [], taken: 0, robbed: [], clues: [], cleared: [], watched: 0, rival: 1, stage: 0, due: c.turn + 9,
    cast: { king: 'Temur', spouse: 'Elin', suitor: 'Alder', daughter: 'Maren' }, nobles: [{ name: 'Osric', title: 'Lord Osric', female: false }] } as unknown as Intrigue;
  (c.intrigues ??= []).push(it);
  return it;
}

describe('a story whose people are gone', () => {
  it('ends, every kind, whether the owner fell, was never a people, or is no people at all; and nothing throws', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const tribe = c.territories.find((t) => t.owner < 0 && !t.horde)!, home = c.territories.find((t) => t.capital === 0)!;
    c.factions[1].alive = false;
    const all = [
      story(c, 'rival', 1, home.id, 901), // a nation fallen
      story(c, 'suitor', -1, home.id, 902), // nobody's
      story(c, 'plot', 99, home.id, 903), // no such people
      story(c, 'thief', -1, tribe.id, 904), // a town story of nobody's, in a tribe's town
    ];
    expect(() => intrigueSeason(c)).not.toThrow();
    for (const it of all) expect(it.ended?.how, `${it.kind} of ${it.owner}`).toBe('outlived');
  });

  it('courtStep, called on its own, ends it too', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const it = story(c, 'rival', -1, 0, 905);
    expect(() => courtStep(c, it)).not.toThrow();
    expect(it.ended).toBeDefined();
  });

  it('a whole season of the map goes on with one in it', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    story(c, 'suitor', -1, c.territories.find((t) => t.capital === 0)!.id, 906);
    expect(() => endTurn(c)).not.toThrow();
  });

  it('a story of a living people is not touched', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const it = story(c, 'rival', 0, c.territories.find((t) => t.capital === 0)!.id, 907);
    intrigueSeason(c);
    expect(it.ended?.text ?? '').not.toMatch(/went with the people it was told of|gone with its people/); // it goes on by its own rules
    expect(c.factions[0].alive).toBe(true);
  });
});
