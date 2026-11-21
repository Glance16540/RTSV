// The decree that forbids carrying people off (src/sim/nocarry.ts): while it stands the nation's armies take nobody.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { carriedSeason, carriesOff, townFell } from '../src/sim/carriedoff';
import { NOCARRY, forbidCarrying, forbidsCarrying, noCarryLine, noCarrySeason, wouldCarry } from '../src/sim/nocarry';
import type { Noble } from '../src/sim/nobles';
import { folkOf, headcount } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
const world = (virtue: number): { c: Campaign; town: number; home: number; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.turn = 10;
  const rival = c.factions.find((f) => f.id > 0 && f.alive)!.id;
  c.factions[0].virtue = virtue;
  const home = c.territories.find((x) => x.owner === 0)!, t = c.territories.find((x) => x.owner === rival)!;
  Object.assign(folkOf(c, t.id), { men: 10, women: 12, elders: 2, children: 5 }); delete folkOf(c, t.id).ages;
  return { c, town: t.id, home: home.id, rival };
};
const lord = (key: string, leaning: Noble['leaning'], town: number): Noble => ({ key, name: key, female: false, town, rank: 'lord', leaning, mood: 10 } as Noble);

describe('the law that forbids carrying people off', () => {
  it('while it stands, a people of low standing that takes a town leads nobody away; lifted, they do again', () => {
    const { c, town, home, rival } = world(-90);
    expect(carriesOff(c, 0)).toBe(true);
    expect(forbidCarrying(c, 0, true)).toBe(true);
    expect(forbidsCarrying(c, 0)).toBe(true);
    expect(carriesOff(c, 0)).toBe(false);
    expect(wouldCarry(c, 0)).toBe(true); // their standing has not changed: only the law
    const before = headcount(folkOf(c, town));
    expect(townFell(c, town, rival, 0, home)).toBeNull();
    expect(headcount(folkOf(c, town))).toBe(before);
    expect((c.carried ?? []).length).toBe(0);
    expect(forbidCarrying(c, 0, false)).toBe(true);
    expect(carriesOff(c, 0)).toBe(true);
    expect(townFell(c, town, rival, 0, home)).not.toBeNull();
  });
  it('it forbids the taking and frees nobody already held: they are held as they were, and are the nation\'s when their seasons are up', () => {
    const { c, town, home, rival } = world(-90);
    const x = townFell(c, town, rival, 0, home)!;
    forbidCarrying(c, 0, true);
    expect((c.carried ?? []).map((y) => y.id)).toEqual([x.id]);
    for (let i = 0; i < 4; i++) { c.turn++; carriedSeason(c); }
    expect((c.carried ?? []).length).toBe(0); // become its people, as ever
  });
  it('is given once and lifted once, says so plainly, and costs nothing to give', () => {
    const { c } = world(-90), had = c.factions[0].supplies;
    forbidCarrying(c, 0, true);
    expect(c.log.at(-1)).toBe('📜 You have forbidden it: your armies lead nobody away from a town they take. Some of your lords will not thank you.');
    expect(forbidCarrying(c, 0, true)).toBe(false); // it stands already
    expect(c.factions[0].supplies).toBe(had);
    forbidCarrying(c, 0, false);
    expect(c.log.at(-1)).toMatch(/^📜 The law against carrying people off is lifted\. Your armies will lead people away/);
    expect(forbidCarrying(c, 0, false)).toBe(false);
    const plain = world(0);
    forbidCarrying(plain.c, 0, true);
    expect(plain.c.log.at(-1)).toBe('📜 You have forbidden it: your armies lead nobody away from a town they take.'); // nobody to resent it
  });
  it('the panel\'s line says how the law stands and what that means at the people\'s standing', () => {
    const low = world(-90), plain = world(0);
    expect(noCarryLine(low.c, 0)).toMatch(/of a standing that carries people off.*You may forbid it\.$/);
    expect(noCarryLine(plain.c, 0)).toMatch(/^Your people carry nobody off/);
    forbidCarrying(low.c, 0, true); forbidCarrying(plain.c, 0, true);
    expect(noCarryLine(low.c, 0)).toMatch(/^Carrying people off is forbidden by your law.*resent it a little more each season\.$/);
    expect(noCarryLine(plain.c, 0)).toBe('Carrying people off is forbidden by your law: your armies take nobody from a town they take.');
    for (const c of [low.c, plain.c]) expect(noCarryLine(c, 0)).not.toMatch(/child/i);
  });
  it('over a people who would have carried off, the worldly and martial lords resent it a little each season and the pious and kindly warm to it; over others nobody minds', () => {
    const { c, home } = world(-90);
    c.factions[0].nobles = [lord('w', 'worldly', home), lord('m', 'martial', home), lord('p', 'pious', home), lord('k', 'kindly', home)];
    expect(noCarrySeason(c)).toBe(0); // no law, no matter
    forbidCarrying(c, 0, true);
    for (let i = 0; i < 3; i++) noCarrySeason(c);
    const mood = (k: string) => c.factions[0].nobles!.find((n) => n.key === k)!.mood;
    expect(mood('w')).toBe(10 + 3 * NOCARRY.resent);
    expect(mood('m')).toBe(10 + 3 * NOCARRY.resent);
    expect(mood('p')).toBe(10 + 3 * NOCARRY.warm);
    expect(mood('k')).toBe(10 + 3 * NOCARRY.warm);
    expect(Math.abs(NOCARRY.resent)).toBeLessThanOrEqual(3); // small: years of it tell, a season does not
    const plain = world(0);
    plain.c.factions[0].nobles = [lord('w', 'worldly', plain.home)];
    forbidCarrying(plain.c, 0, true);
    noCarrySeason(plain.c);
    expect(plain.c.factions[0].nobles![0].mood).toBe(10);
  });
  it('a rival is not touched by the player\'s law, and a mood never passes its bounds', () => {
    const { c, town, home, rival } = world(-90);
    c.factions[rival].virtue = -90;
    forbidCarrying(c, 0, true);
    expect(carriesOff(c, rival)).toBe(true);
    expect(townFell(c, home, 0, rival, town)).not.toBeNull();
    c.factions[0].nobles = [{ ...lord('w', 'worldly', home), mood: -99 }];
    noCarrySeason(c);
    expect(c.factions[0].nobles[0].mood).toBe(-100);
  });
});
