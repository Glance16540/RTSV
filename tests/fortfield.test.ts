// In a town's streets a Fortress shoots as a Watch Tower does, and its garrison of the town's own men stands to arms (src/sim/fortkeep.ts fieldArms, data.ts).
import { describe, expect, it } from 'vitest';
import { Game, SHOOT_HELP } from '../src/sim/game';
import { BUILDINGS } from '../src/sim/data';
import { Campaign, battleConfig, moveArmy, newCampaign } from '../src/sim/campaign';
import { fieldArms, keepMen } from '../src/sim/fortkeep';
import { TOWN_SCALE as S, folkOf } from '../src/sim/township';
import { run } from './helpers';

/** A campaign in which a rival's army has come against a town of the player's with no army in it: `fort`, whether it has a Fortress. */
const besieged = (fort: boolean, men = 20 * S): { c: Campaign; at: number } => {
  const c = newCampaign(3, 1);
  const home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.at !== home.id);
  home.buildings = home.buildings.filter((b) => b !== 'fortress');
  if (fort) home.buildings.push('fortress');
  Object.assign(folkOf(c, home.id), { men, women: 20 * S }); delete folkOf(c, home.id).ages;
  c.armies.push({ id: 99, owner: 1, at: home.adj[0], units: { infantry: 2 }, hero: false, vet: 0, moved: false });
  c.territories[home.adj[0]].owner = 1;
  c.phase = 'ai';
  expect(moveArmy(c, 99, home.id)).toBe('battle');
  c.pending!.mode = 'siege';
  return { c, at: home.id };
};

describe('the Fortress shoots', () => {
  it('as a Watch Tower does: the tower\'s own strength, reach and pace', () => {
    const f = BUILDINGS.fortress, t = BUILDINGS.tower;
    expect([f.atk, f.range, f.cooldown]).toEqual([t.atk, t.range, t.cooldown]);
    expect(f.shelter).toBe(12);
    expect(SHOOT_HELP).toBe(t.shelter); // and those it shelters speed its fire no more than a full tower's do
  });
  it('a foe who comes within its reach is shot', () => {
    const g = new Game(5, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'hearth' }]);
    for (const p of g.players) p.dilemmaT = 1e9;
    const tc = g.buildings.find((b) => b.owner === 0)!;
    let fort = null as ReturnType<Game['spawnBuilding']> | null;
    for (let d = 6; d < 16 && !fort; d++) for (const [dx, dy] of [[d, 0], [0, d], [-d, 0], [0, -d], [d, d], [-d, -d]] as [number, number][]) { const cx = Math.floor(tc.x) + dx, cy = Math.floor(tc.y) + dy; if (g.canPlace('fortress', cx, cy)) { fort = g.spawnBuilding('fortress', 0, cx, cy, true); break; } }
    expect(fort).toBeTruthy();
    const foe = g.spawnUnit('clubman', 1, fort!.x + 4, fort!.y, 'm');
    foe.stance = 'hold';
    const hp = foe.hp;
    run(g, 6);
    expect(foe.dead || foe.hp < hp).toBe(true);
  });
});

describe('the Fortress\'s garrison on the field', () => {
  it('fieldArms: the keep\'s men stand to arms beside those who turn out, where no army stands; never more than the town has', () => {
    const { c, at } = besieged(true);
    const keep = keepMen(c, at);
    expect(keep).toBeGreaterThan(0);
    expect(fieldArms(c, at, { army: false, arms: 3 })).toBe(3 + keep);
    expect(fieldArms(c, at, { army: true, arms: 3 })).toBe(3); // an army there is the garrison, as on the map
    const bare = besieged(false);
    expect(fieldArms(bare.c, bare.at, { army: false, arms: 3 })).toBe(3);
    const few = besieged(true, 2 * S + 1);
    expect(fieldArms(few.c, few.at, { army: false, arms: 2 * S + 1 })).toBe(2 * S + 1);
  });
  it('a town with a Fortress and no army comes to its siege with more of its own men in arms, by its garrison', () => {
    const fort = besieged(true), bare = besieged(false);
    const w = (x: { c: Campaign }): number => battleConfig(x.c)!.setups[0].bonus!.warriors ?? 0;
    expect(w(fort)).toBe(w(bare) + keepMen(fort.c, fort.at));
    expect(battleConfig(fort.c)!.setups[0].bonus!.buildings).toContain('fortress');
  });
  it('they are the town\'s own men: nobody is added to its people for it', () => {
    const fort = besieged(true), bare = besieged(false);
    const people = (x: { c: Campaign }) => battleConfig(x.c)!.setups[0].bonus!.people!;
    expect(people(fort).men).toBe(people(bare).men);
    expect(people(fort).women).toBe(people(bare).women);
  });
  it('with an army of its people standing there the garrison is that army', () => {
    const fort = besieged(true), bare = besieged(false);
    for (const x of [fort, bare]) x.c.armies.push({ id: 5, owner: 0, at: x.at, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    const w = (x: { c: Campaign }): number => battleConfig(x.c)!.setups[0].bonus!.warriors ?? 0;
    expect(w(fort)).toBe(w(bare));
  });
});
