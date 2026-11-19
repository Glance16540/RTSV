// The dead of plague on the map by name where they are known (src/sim/plaguenamed.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { sicken } from '../src/sim/acts';
import { folkOf } from '../src/sim/township';
import type { Notable } from '../src/sim/township';
import { townGrief } from '../src/sim/notableweight';
import { PLAGUE_HOW, knownAtHome, plagueTakes } from '../src/sim/plaguenamed';

const mother = (name: string, turn: number): Notable => ({ name, family: name.split(' ')[1], gender: 'f', kind: 'mother', kids: 5, deed: 'raised five children', turn });
const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.capital === 0)!, f = folkOf(c, t.id);
  c.turn = 20;
  f.notables = [mother('Edith Moss', 9), mother('Agnes Reeve', 3)];
  f.houses = [];
  return { c, t, f };
};

describe('plague on the map takes the known by name', () => {
  it('when every one of the grown is known, those it takes are known, the one known longest first, and the town mourns them', () => {
    const { c, t, f } = world();
    const lost = plagueTakes(c, t.id, 1, 2);
    expect(lost.map((n) => n.name)).toEqual(['Agnes Reeve']);
    expect(lost[0].lost).toEqual({ turn: c.turn, how: PLAGUE_HOW });
    expect(townGrief(f.notables, c.turn)).toBeGreaterThan(0);
    expect(c.chronicle?.some((x) => x.text.includes('Agnes Reeve') && x.text.includes(PLAGUE_HOW))).toBe(true);
    expect(knownAtHome(c, t.id).map((n) => n.name)).toEqual(['Edith Moss']);
  });

  it('nobody dead, nobody known lost; the lost are not taken twice', () => {
    const { c, t } = world();
    expect(plagueTakes(c, t.id, 0, 40)).toEqual([]);
    plagueTakes(c, t.id, 2, 2);
    expect(plagueTakes(c, t.id, 2, 2)).toEqual([]);
  });

  it('a veteran away with the army is not at home to sicken; one come home is', () => {
    const { c, t, f } = world();
    f.notables = [{ name: 'Ulf Harrow', family: 'Harrow', gender: 'm', kind: 'veteran', kills: 12, deed: 'felled 12', turn: 4 }];
    f.houses = [{ family: 'Harrow', away: [{ name: 'Ulf', as: 'son', since: 4 }] }];
    expect(knownAtHome(c, t.id)).toEqual([]);
    f.houses = [];
    expect(knownAtHome(c, t.id).map((n) => n.name)).toEqual(['Ulf Harrow']);
  });

  it('as likely as the known are among the grown: over many seasons of a few dead in a big town, some known and most not', () => {
    let known = 0, dead = 0;
    for (let turn = 1; turn <= 400; turn++) {
      const { c, t } = world();
      c.turn = turn;
      dead += 4;
      known += plagueTakes(c, t.id, 4, 100).length;
    }
    // Two known among a hundred: about 2 in 25 of four dead a season.
    expect(known / 400).toBeGreaterThan(0.04);
    expect(known / 400).toBeLessThan(0.13);
    expect(known).toBeLessThan(dead);
  });

  it('a season of plague in a town of the map kills by count as before, a known person among them by name', () => {
    const { c, t, f } = world();
    f.men = 1; f.women = 2; f.elders = 0; delete f.ages;
    let lost = 0;
    for (let i = 0; i < 10 && f.men + f.women > 0; i++) { c.turn++; const was = f.men + f.women; const d = sicken(c, t); expect(was - (f.men + f.women)).toBe(d); lost = f.notables.filter((n) => n.lost).length; }
    expect(lost).toBeGreaterThan(0);
    expect(f.notables.filter((n) => n.lost).every((n) => n.lost!.how === PLAGUE_HOW)).toBe(true);
  });
});
