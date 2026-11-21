// A claimant to the throne and the lord behind them, as figures on the field (src/sim/claimantfigures.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { Game } from '../src/sim/game';
import { beginVisit, visitConfig } from '../src/sim/visit';
import { risingFigures, setClaimFigures, visitFigures } from '../src/sim/claimantfigures';
import { hallGuests } from '../src/sim/hallguests';
import type { Claim } from '../src/sim/claimants';

const world = () => {
  const c: Campaign = newCampaign(5, 2);
  c.turn = 120; c.phase = 'player';
  const home = c.territories.find((t) => t.capital === 0)!, other = c.territories.find((t) => t.owner === 0 && t.capital !== 0) ?? home;
  return { c, home, other };
};
const claim = (o: Partial<Claim>): Claim => ({ id: 3, owner: 0, mother: 'Hild', parent: 'noble', by: 'Lord Osric of Stagsford', town: 0, born: 10, ...o } as Claim);

describe('a claimant and the lord behind them', () => {
  it('in a visit to the town a grown claimant lives in, both stand at the hall by name; a child never', () => {
    const { c, home } = world();
    c.claims = [claim({ town: home.id })];
    expect(visitFigures(c, home.id)).toEqual([]); // not yet grown: no figure, no name
    c.claims[0].name = 'Edmund'; c.claims[0].grown = 100;
    expect(visitFigures(c, home.id)).toEqual([{ role: 'claimant', name: 'Edmund', female: false, id: 3 }, { role: 'lord', name: 'Lord Osric of Stagsford', female: false, id: 3 }]);
    c.claims[0].parent = 'band'; c.claims[0].by = 'the Red Hand';
    expect(visitFigures(c, home.id).map((f) => f.role)).toEqual(['claimant']); // no lord stands for a band
    c.claims[0].towns = [home.id];
    expect(visitFigures(c, home.id)).toEqual([]); // risen: the battle's, not the visit's
    c.claims[0].towns = undefined; c.claims[0].ended = { turn: 1, how: 'home', text: '' };
    expect(visitFigures(c, home.id)).toEqual([]);
  });

  it('a visit takes them to the field, where they stand at the hall as figures, not people of the town', () => {
    const { c, home } = world();
    c.claims = [claim({ town: home.id, name: 'Edith', female: true, grown: 100, by: 'Lady Aelfrun of Wessex' })];
    expect(beginVisit(c, home.id)).toBe(true);
    const cfg = visitConfig(c)!;
    expect(cfg.setups[0].bonus!.claims).toHaveLength(2);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const people = g.units.filter((u) => u.owner === 0).length;
    const guests = hallGuests(g, 0).filter((x) => x.role === 'claimant' || x.role === 'lord');
    expect(guests.map((x) => [x.role, x.name, x.female])).toEqual([['claimant', 'Edith', true], ['lord', 'Lady Aelfrun of Wessex', true]]);
    expect(g.units.filter((u) => u.owner === 0).length).toBe(people);
    expect(g.units.some((u) => u.name === 'Edith')).toBe(false);
  });

  it('in a battle for a town risen for a grown claimant, the lord stands beside the one who leads', () => {
    const { c, home } = world();
    c.claims = [claim({ town: home.id, name: 'Edmund', grown: 100, towns: [home.id] })];
    (home as { free?: unknown }).free = { claimant: 3 }; // risen for the claim (claimantrising.ts)
    expect(risingFigures(c, home.id)).toEqual([{ role: 'lord', name: 'Lord Osric of Stagsford', female: false, id: 3 }]);
    c.claims[0].name = undefined; c.claims[0].grown = undefined; // a child's rising: the lord leads it (claimantcaptain.ts), no second figure
    expect(risingFigures(c, home.id)).toEqual([]);
  });

  it('what comes onto the field is cleaned, two at most', () => {
    const g = new Game(3, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
    expect(setClaimFigures(g, 0, [{ role: 'claimant', name: '<b>X</b>', female: true, id: 1 }, { role: 'x', name: 'Y', id: 1 }, { role: 'lord', name: 'Z', id: 1 }])).toEqual([{ role: 'claimant', name: 'bX/b', female: true, id: 1 }, { role: 'lord', name: 'Y', female: false, id: 1 }]);
    expect(setClaimFigures(g, 0, 'nonsense')).toEqual([]);
  });
});
