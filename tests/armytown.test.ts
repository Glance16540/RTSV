// Armies belong to towns (docs/DESIGN.md; src/sim/armytown.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, finishBattle, moveArmy, newCampaign, raise } from '../src/sim/campaign';
import { ARMY_REST, MEN_A_COMPANY, resting, awayFrom, canSendHome, homeOf, menOf, musterOf, reckonArmies, seasonOfArmies, sendHome } from '../src/sim/armytown';
import { agesOf, GROWN_SEASON } from '../src/sim/ageing';
import { folkOf, living } from '../src/sim/township';

const LONG = 60_000;
/** A town of the player's with men to spare, a Barracks, supplies, and no army standing in it. */
const town = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth'), home = c.territories.find((t) => t.capital === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  c.factions[0].supplies = 500;
  if (!home.buildings.includes('barracks')) home.buildings.push('barracks');
  const f = folkOf(c, home.id);
  f.men = 8; delete f.ages;
  agesOf(c, home.id, f);
  return { c, home, f };
};
const army = (c: Campaign, tid: number) => armyAt(c, tid)!;

describe('armies belong to towns', () => {
  it('a company raised is men of the town: they leave its record and are on the army\'s roll, the youngest first', () => {
    const { c, home, f } = town();
    const ages = [...f.ages!.m].sort((a, b) => a - b);
    expect(raise(c, 0, home.id, 'infantry')).toBe(true);
    const a = army(c, home.id);
    expect(f.men).toBe(8 - MEN_A_COMPANY);
    expect(f.ages!.m.length + f.ages!.f.length).toBe(f.men + f.women + f.elders);
    expect(musterOf(c, a.id)).toEqual({ size: 1, men: { [home.id]: ages.slice(0, MEN_A_COMPANY) } });
    expect(awayFrom(c, home.id)).toBe(MEN_A_COMPANY);
    expect(menOf(c, a)).toEqual({ town: MEN_A_COMPANY, none: 0 });
    expect(homeOf(c, a)).toBe(home.id);
    raise(c, 0, home.id, 'infantry');
    expect(f.men).toBe(8 - 2 * MEN_A_COMPANY);
    expect(awayFrom(c, home.id)).toBe(2 * MEN_A_COMPANY);
    expect(musterOf(c, a.id)!.size).toBe(2);
  }, LONG);

  it('a town that cannot man a company in full sends who it has; the rest are men of no town', () => {
    const { c, home, f } = town();
    f.men = 1; delete f.ages;
    raise(c, 0, home.id, 'infantry');
    const a = army(c, home.id);
    expect(f.men).toBe(0);
    expect(menOf(c, a)).toEqual({ town: 1, none: 1 });
    raise(c, 0, home.id, 'infantry');
    expect(menOf(c, a)).toEqual({ town: 1, none: 3 });
    // An army that was there before any roll was kept is of no town at all.
    const old = newCampaign(7, 1, 1, 'hearth'), first = old.armies.find((x) => x.owner === 0)!;
    expect(musterOf(old, first.id)).toBeUndefined();
    expect(homeOf(old, first)).toBeUndefined();
    expect(reckonArmies(old)).toEqual([]);
  }, LONG);

  it('the army\'s dead are the town\'s dead: companies lost are men struck from the roll, and they do not come home', () => {
    const { c, home, f } = town();
    for (let i = 0; i < 4; i++) raise(c, 0, home.id, 'infantry');
    const a = army(c, home.id);
    expect(f.men).toBe(0);
    a.units.infantry = 3; // a company is lost
    expect(reckonArmies(c)).toEqual([{ town: home.id, army: a.id, dead: 2, lost: false }]);
    expect(awayFrom(c, home.id)).toBe(6);
    expect(c.log.join('\n')).toContain(`2 men of ${home.name} fell with the army`);
    expect(reckonArmies(c)).toEqual([]); // counted once
    expect(f.men).toBe(0);
    // The army is destroyed: every man with it is lost to the town.
    c.armies.splice(c.armies.indexOf(a), 1);
    expect(reckonArmies(c)).toEqual([{ town: home.id, army: a.id, dead: 6, lost: true }]);
    expect(awayFrom(c, home.id)).toBe(0);
    expect(c.musters![a.id]).toBeUndefined();
    expect(c.log.join('\n')).toContain('did not come back');
  }, LONG);

  it('a battle lost costs the town its men', () => {
    const { c, home } = town();
    for (let i = 0; i < 3; i++) raise(c, 0, home.id, 'infantry');
    const a = army(c, home.id), to = home.adj.map((n) => c.territories[n]).find((t) => t.owner !== 0)!;
    Object.assign(to, { owner: -1, horde: false, militia: 9, capital: -1 });
    a.moved = false;
    expect(moveArmy(c, a.id, to.id)).toBe('battle');
    finishBattle(c, false); // fought in person and lost: thrown back and destroyed
    expect(c.armies.includes(a)).toBe(false);
    expect(awayFrom(c, home.id)).toBe(0);
    expect(c.log.join('\n')).toContain(`6 men of ${home.name} did not come back`);
  }, LONG);

  it('armies that join share out their men as they share out their companies', () => {
    const { c, home } = town();
    const next = c.territories[home.adj[0]];
    Object.assign(next, { owner: 0, capital: -1, horde: false, buildings: ['barracks'] });
    c.armies = c.armies.filter((x) => x.at !== next.id);
    folkOf(c, next.id).men = 6;
    raise(c, 0, home.id, 'infantry'); raise(c, 0, home.id, 'infantry');
    raise(c, 0, next.id, 'infantry');
    const a = army(c, next.id), b = army(c, home.id);
    a.moved = false;
    expect(moveArmy(c, a.id, home.id)).toBe('moved');
    expect(c.armies.includes(a)).toBe(false);
    expect(musterOf(c, a.id)).toBeUndefined();
    expect(musterOf(c, b.id)!.size).toBe(3);
    expect(menOf(c, b)).toEqual({ town: 6, none: 0 });
    expect(awayFrom(c, home.id)).toBe(4);
    expect(awayFrom(c, next.id)).toBe(2);
    expect(homeOf(c, b)).toBe(home.id);
    expect(reckonArmies(c)).toEqual([]); // nobody died by joining
  }, LONG);

  it('sent home, the men are back on their town\'s record, a season older for every season away', () => {
    const { c, home, f } = town();
    raise(c, 0, home.id, 'infantry'); raise(c, 0, home.id, 'infantry');
    const a = army(c, home.id), went = [...musterOf(c, a.id)!.men[home.id]];
    seasonOfArmies(c); seasonOfArmies(c);
    expect(musterOf(c, a.id)!.men[home.id]).toEqual(went.map((s) => s + 2));
    expect(canSendHome(c, a.id)).toBe(true);
    expect(sendHome(c, a.id)).toBe(4);
    expect(c.armies.includes(a)).toBe(false);
    expect(f.men).toBe(8);
    expect(awayFrom(c, home.id)).toBe(0);
    for (const s of went) expect(f.ages!.m).toContain(s + 2);
    expect(f.ages!.m.every((s) => s >= GROWN_SEASON)).toBe(true);
    expect(c.log.join('\n')).toContain('4 men go back to their own towns');
  }, LONG);

  it('a soldier who made a name is a notable person of the town his army came from', () => {
    const { c, home } = town();
    const next = c.territories[home.adj[0]];
    Object.assign(next, { owner: 0, capital: -1, horde: false, buildings: ['barracks'] });
    c.armies = c.armies.filter((x) => x.at !== next.id);
    folkOf(c, next.id).men = 6;
    raise(c, 0, next.id, 'infantry'); raise(c, 0, next.id, 'infantry');
    const a = army(c, next.id);
    // He wins his name in a battle fought in person: he is remembered where he came from, not in the chief town.
    const to = next.adj.map((n) => c.territories[n]).find((t) => t.owner !== 0 && t.id !== home.id) ?? c.territories[next.adj[0]];
    Object.assign(to, { owner: -1, horde: false, militia: 1, capital: -1 });
    a.moved = false;
    expect(moveArmy(c, a.id, to.id)).toBe('battle');
    finishBattle(c, true, { clubman: 4 }, { champion: { name: 'Osric', kills: 6, unit: 'Clubman' } });
    expect(living(folkOf(c, next.id)).map((n) => n.name)).toEqual(['Osric']);
    expect(living(folkOf(c, home.id))).toEqual([]);
    // And sending the army home keeps him so.
    a.at = next.id;
    expect(sendHome(c, a.id)).toBe(4);
    expect(living(folkOf(c, next.id)).map((n) => n.name)).toEqual(['Osric']);
  }, LONG);

  it('an army that has stormed a town rests there before it marches again', () => {
    const { c, home } = town();
    for (let i = 0; i < 6; i++) raise(c, 0, home.id, 'infantry');
    const a = army(c, home.id), to = home.adj.map((n) => c.territories[n]).find((t) => t.owner !== 0)!;
    Object.assign(to, { owner: -1, horde: false, militia: 1, capital: -1 });
    a.moved = false;
    expect(moveArmy(c, a.id, to.id)).toBe('battle');
    finishBattle(c, true, { clubman: 12 });
    expect(a.at).toBe(to.id);
    expect(a.rest).toBe(c.turn + ARMY_REST);
    expect(resting(c, a)).toBe(true);
    c.turn += ARMY_REST;
    expect(resting(c, a)).toBe(true); // through the last season of its rest
    c.turn += 1;
    expect(resting(c, a)).toBe(false);
    // An army that has fought nothing is free to march.
    expect(resting(c, { ...a, rest: undefined })).toBe(false);
  }, LONG);

  it('an army is not sent home from another people\'s land, with the leader in it, or with a battle waiting', () => {
    const { c, home } = town();
    raise(c, 0, home.id, 'infantry');
    const a = army(c, home.id);
    a.hero = true;
    expect(canSendHome(c, a.id)).toBe(false);
    expect(sendHome(c, a.id)).toBe(-1);
    a.hero = false;
    a.at = c.territories.find((t) => t.owner !== 0)!.id;
    expect(canSendHome(c, a.id)).toBe(false);
    a.at = home.id;
    expect(canSendHome(c, a.id)).toBe(true);
    expect(canSendHome(c, 12345)).toBe(false);
  }, LONG);
});
