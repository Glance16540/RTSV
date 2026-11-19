// The one who leads a claimant's rising, on the field (src/sim/claimantcaptain.ts).
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { captainOf, setCaptain } from '../src/sim/claimantcaptain';
import type { Claim } from '../src/sim/claimants';
import { riseFree } from '../src/sim/freetown';
import { Game } from '../src/sim/game';
import { hallGuests } from '../src/sim/hallguests';
import { setups } from './helpers';

/** A campaign in which a town of the player's beside the capital has risen for a claim of this kind. */
function risen(claim: Partial<Claim>) {
  const c = newCampaign(4, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const t = c.territories[home.adj.find((n) => c.territories[n].owner < 0 && !c.territories[n].horde)!];
  t.owner = 0; // a town of the player's people that rises
  riseFree(c, t.id);
  const cl: Claim = { id: 5, owner: 0, mother: 'Elin', parent: 'noble', by: 'Lord Osric', town: t.id, born: 0, towns: [t.id], ...claim } as Claim;
  (c.claims ??= []).push(cl);
  t.free!.claimant = cl.id;
  return { c, t, home, cl };
}

describe('claimantcaptain', () => {
  it('a grown claimant leads by name; a child\'s rising, whoever proclaimed it; the child never', () => {
    expect(captainOf(risen({ name: 'Edwin', grown: 1 }).c, risen({ name: 'Edwin', grown: 1 }).t.id)).toEqual({ name: 'Edwin', female: false });
    const q = risen({ name: 'Matilda', female: true, grown: 1 });
    expect(captainOf(q.c, q.t.id)).toEqual({ name: 'Matilda', female: true });
    const lord = risen({ regent: 'Lord Osric of Harrowdale', raised: 1 });
    expect(captainOf(lord.c, lord.t.id)).toEqual({ name: 'Lord Osric of Harrowdale', female: false });
    const lady = risen({ regent: 'Lady Aldith of Harrowdale', raised: 1 });
    expect(captainOf(lady.c, lady.t.id)?.female).toBe(true);
    const band = risen({ parent: 'band', regent: 'the Ash Raiders', raised: 1 });
    expect(captainOf(band.c, band.t.id)).toEqual({ name: 'The chief of the Ash Raiders', female: false });
    const child = risen({}); // no name, nobody proclaimed it: nobody leads by name
    expect(captainOf(child.c, child.t.id)).toBeUndefined();
    const over = risen({ name: 'Edwin', grown: 1, ended: { turn: 1, how: 'putdown', text: '' } });
    expect(captainOf(over.c, over.t.id)).toBeUndefined();
  });

  it('in a battle there, one of the town\'s turned-out soldiers is the captain by name, and no townsman is renamed', () => {
    const { c, t, home } = risen({ name: 'Matilda', female: true, grown: 1 });
    c.territories[t.id].militia = 3;
    const army = armyAt(c, home.id)!;
    expect(moveArmy(c, army.id, t.id)).toBe('battle');
    c.pending!.mode = 'siege';
    const cfg = battleConfig(c)!;
    const side = cfg.setups.findIndex((s) => s.bonus?.captain);
    expect(side).toBeGreaterThanOrEqual(0);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    const cap = g.units.filter((u) => u.captain);
    expect(cap.length).toBe(1);
    expect(cap[0]).toMatchObject({ name: 'Matilda', gender: 'f', owner: side });
    expect(cap[0].lifespan > 0).toBe(false); // not a townswoman: the town's count is untouched
    expect(g.isMilitary(cap[0])).toBe(true);
    expect(hallGuests(g, side).some((x) => x.role === 'captain')).toBe(false);
    // The town's count is the town's: the captain is in none of it.
    const census = g.census(side), folk = g.units.filter((u) => u.owner === side && !u.dead && (u.type === 'villager' || u.lifespan > 0)).length;
    expect(census.men + census.women + census.elders).toBe(folk);
  });

  it('a townsman in arms is never the one: the leader comes to the field before the hall instead', () => {
    const g = new Game(1, setups);
    for (const u of g.units.filter((x) => x.owner === 1 && g.isMilitary(x))) g.perish(u);
    const towns = g.spawnUnit('clubman', 1, 10, 10); towns.lifespan = 900; // a townsman in arms
    const u = setCaptain(g, 1, { name: 'Edwin', female: false })!;
    expect(towns.name).not.toBe('Edwin');
    expect(u).toMatchObject({ name: 'Edwin', captain: true, owner: 1 });
    expect(u.id).not.toBe(towns.id);
    expect(setCaptain(new Game(2, setups), 1, { name: '' })).toBeUndefined(); // nothing named: nothing set
  });

  it('with no hall and nobody to be them, they are kept on the side and stand at its hall should one be seen', () => {
    const g = new Game(1, setups);
    for (const u of g.units.filter((x) => x.owner === 1 && g.isMilitary(x))) g.perish(u);
    for (const b of g.buildings.filter((x) => x.owner === 1)) b.type = 'house' as never;
    expect(setCaptain(g, 1, { name: 'Edwin', female: false })).toBeUndefined();
    expect(hallGuests(g, 1).find((x) => x.role === 'captain')).toMatchObject({ name: 'Edwin' });
  });
});
