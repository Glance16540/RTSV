// Men of no town who are sent home settle in the army's chief town (src/sim/hiredhome.ts, read by armytown.ts sendHome).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { MEN, menOf, sendHome } from '../src/sim/armytown';
import { HIRED_HOME, hiredHome, hiredTown } from '../src/sim/hiredhome';
import { folkOf } from '../src/sim/township';

const world = () => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const home = c.territories.find((t) => t.capital === 0)!;
  const other = c.territories[home.adj[0]];
  other.owner = 0;
  return { c, home, other };
};

describe('men of no town sent home', () => {
  it('an army with no roll at all: every man of it is of no town, and all settle where it stands', () => {
    const { c, other } = world();
    c.armies.push({ id: 77, owner: 0, at: other.id, units: { infantry: 2 }, hero: false, vet: 0, moved: false });
    const a = c.armies.at(-1)!;
    expect(menOf(c, a)).toEqual({ town: 0, none: 2 * MEN.company });
    const was = folkOf(c, other.id).men;
    expect(sendHome(c, 77)).toBe(2 * MEN.company);
    expect(folkOf(c, other.id).men).toBe(was + 2 * MEN.company);
    expect(c.armies.some((x) => x.id === 77)).toBe(false);
  });

  it('they go to the army\'s chief town while it is still their people\'s, else where it stands', () => {
    const { c, home, other } = world();
    const a = { id: 5, owner: 0, at: other.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false };
    expect(hiredTown(c, a, home.id)).toBe(home.id);
    expect(hiredTown(c, a, undefined)).toBe(other.id);
    home.owner = 1;
    expect(hiredTown(c, a, home.id)).toBe(other.id);
  });

  it('each settles as a grown man at the middle age of the army\'s townsmen, or at five-and-twenty', () => {
    const { c, home } = world();
    const a = { id: 5, owner: 0, at: home.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false };
    const f = folkOf(c, home.id), men = f.men;
    expect(hiredHome(c, a, 3, home.id, [100, 90, 110])).toBe(3);
    expect(f.men).toBe(men + 3);
    expect(f.ages!.m.filter((s) => s === 100).length).toBeGreaterThanOrEqual(3);
    const n = f.ages!.m.filter((s) => s === HIRED_HOME.age).length;
    expect(hiredHome(c, a, 2, home.id)).toBe(2);
    expect(f.ages!.m.filter((s) => s === HIRED_HOME.age).length).toBe(n + 2);
    expect(hiredHome(c, a, 0, home.id)).toBe(0);
  });
});
