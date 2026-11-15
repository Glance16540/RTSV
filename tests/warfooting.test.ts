// War and peace as a nation's armies know it (src/sim/rivalrule.ts, src/sim/armytown.ts): tuned toward
// docs/TUNING.md's "men under arms: 10 to 25% in war, under 10% in peace".
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign, raise } from '../src/sim/campaign';
import { RIVAL, lastMenHome, massArmies, mayMuster, maySpare, standDown, underArms, warFooting } from '../src/sim/rivalrule';
import { MEN_A_COMPANY, awayFrom, musterOf, sendCompaniesHome } from '../src/sim/armytown';
import { folkOf } from '../src/sim/township';

const LONG = 60_000;
/** A rival with one town of forty men and a Barracks, and no army anywhere. */
const nation = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth'), cap = c.territories.find((t) => t.capital === 1)!;
  for (const t of c.territories) if (t.owner === 1 && t !== cap) t.owner = -1;
  c.armies = c.armies.filter((a) => a.owner !== 1);
  cap.buildings = ['barracks'];
  const f = folkOf(c, cap.id);
  f.men = 40; delete f.ages;
  c.factions[1].supplies = 500;
  c.wars = {};
  return { c, cap, f };
};
const pass = (c: Campaign, seasons: number) => { c.turn += seasons; };

describe('war and peace', () => {
  it('a nation is at war for a while after land changes hands, then at peace, then musters for a campaign, then stands down', () => {
    const { c } = nation();
    expect(warFooting(c, 1)).toBe('war'); // the campaign has only begun
    pass(c, RIVAL.lull);
    expect(warFooting(c, 1)).toBe('war');
    pass(c, 1);
    expect(warFooting(c, 1)).toBe('peace');
    pass(c, RIVAL.restless);
    expect(warFooting(c, 1)).toBe('muster');
    pass(c, RIVAL.campaign);
    expect(warFooting(c, 1)).toBe('muster');
    pass(c, 1);
    expect(warFooting(c, 1)).toBe('peace'); // nothing came of it
    pass(c, RIVAL.restless - 1);
    expect(warFooting(c, 1)).toBe('peace'); // and the wait begins again
    // Land won or lost is war at once.
    c.territories.find((t) => t.owner < 0)!.owner = 1;
    expect(warFooting(c, 1)).toBe('war');
  }, LONG);

  it('at peace a nation raises no more than its standing force, and at war what it can', () => {
    const { c, cap, f } = nation();
    expect(underArms(c, 1)).toEqual({ away: 0, home: 40, share: 0 });
    expect(mayMuster(c, 1)).toBe(true);
    for (let i = 0; i < 6; i++) expect(raise(c, 1, cap.id, 'infantry')).toBe(true);
    expect(underArms(c, 1)).toEqual({ away: 12, home: 28, share: 0.3 });
    expect(f.men).toBe(28);
    pass(c, RIVAL.lull + 1);
    expect(warFooting(c, 1)).toBe('peace');
    expect(mayMuster(c, 1)).toBe(false);
    expect(maySpare(c, cap.id)).toBe(false);
  }, LONG);

  it('at peace what is over the standing force goes home: whole armies, and companies of the leader\'s', () => {
    const { c, cap, f } = nation();
    for (let i = 0; i < 6; i++) raise(c, 1, cap.id, 'infantry');
    const a = c.armies.find((x) => x.at === cap.id)!;
    expect(standDown(c, 1)).toBe(0); // not while it is at war
    pass(c, RIVAL.lull + 1);
    a.hero = true; // the leader's army cannot be sent home whole
    expect(standDown(c, 1)).toBe(1);
    expect(c.armies.includes(a)).toBe(true);
    const u = underArms(c, 1);
    expect(u.share).toBeLessThanOrEqual(RIVAL.standing + MEN_A_COMPANY / 40);
    expect(u.away + u.home).toBe(40); // nobody was lost by going home
    expect(f.men).toBe(40 - u.away);
    expect(musterOf(c, a.id)!.size).toBe(Object.values(a.units).reduce((n, v) => n + v, 0));
    // Without the leader the army goes home whole, even a nation's last.
    a.hero = false;
    for (let i = 0; i < 4; i++) { c.wars = {}; raise(c, 1, cap.id, 'infantry'); }
    c.wars = {}; warFooting(c, 1); pass(c, RIVAL.lull + 1);
    standDown(c, 1);
    expect(c.armies.filter((x) => x.owner === 1).length).toBe(0);
    expect(f.men).toBe(40);
    expect(awayFrom(c, cap.id)).toBe(0);
    expect(mayMuster(c, 1)).toBe(true); // and one company is within its standing force again
  }, LONG);

  it('companies sent home take their men with them and leave the army standing', () => {
    const { c, cap, f } = nation();
    for (let i = 0; i < 5; i++) raise(c, 1, cap.id, 'infantry');
    const a = c.armies.find((x) => x.at === cap.id)!;
    expect(sendCompaniesHome(c, a.id, 2)).toBe(4);
    expect(a.units.infantry).toBe(3);
    expect(f.men).toBe(34);
    expect(awayFrom(c, cap.id)).toBe(6);
    expect(sendCompaniesHome(c, a.id, 99)).toBe(4); // never its last company
    expect(a.units.infantry).toBe(1);
    expect(sendCompaniesHome(c, a.id, 1)).toBe(0);
    a.at = c.territories.find((t) => t.owner !== 1)!.id;
    expect(sendCompaniesHome(c, a.id, 1)).toBe(-1); // not from another people's land
  }, LONG);
});

describe('a nation does not sit for ever', () => {
  it('a people whose towns have no men left calls its men home from its armies', () => {
    const { c, cap, f } = nation();
    for (let i = 0; i < 4; i++) raise(c, 1, cap.id, 'infantry');
    const a = c.armies.find((x) => x.at === cap.id)!;
    expect(lastMenHome(c, 1)).toBe(0); // while there are men at home, nothing
    const away = awayFrom(c, cap.id);
    f.men = 0; delete f.ages; // plague, hunger, raiders: the town has no man left
    expect(lastMenHome(c, 1)).toBe(1);
    expect(c.armies.includes(a)).toBe(false);
    expect(f.men).toBe(away);
    expect(awayFrom(c, cap.id)).toBe(0);
  }, LONG);

  it('armies too weak to take anything alone come together', () => {
    const { c, cap } = nation();
    const mid = c.territories[cap.adj[0]];
    Object.assign(mid, { owner: 1, capital: -1, horde: false, buildings: [] });
    for (const t of c.territories) if (t.owner !== 1) Object.assign(t, { owner: -1, capital: -1, horde: false, militia: 40 }); // nothing they could take
    c.armies = [];
    const one = { id: 801, owner: 1, at: cap.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false };
    const two = { id: 802, owner: 1, at: mid.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false };
    c.armies.push(one, two);
    expect(massArmies(c, 1)).toBe(1); // the weaker marches to the stronger
    expect(c.armies.length).toBe(1);
    expect(c.armies[0].id).toBe(801);
    expect(c.armies[0].units.infantry).toBe(4);
    // At peace nobody marches; and an army that can win where it stands is left to.
    c.armies.push({ id: 803, owner: 1, at: mid.id, units: { infantry: 1 }, hero: false, vet: 0, moved: false });
    pass(c, RIVAL.lull + 1);
    expect(warFooting(c, 1)).toBe('peace');
    expect(massArmies(c, 1)).toBe(0);
  }, LONG);
});
