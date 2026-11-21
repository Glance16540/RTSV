// A town left to itself keeps training what it was last ordered to (docs/DESIGN.md; src/sim/townmuster.ts).
import { smallTownRules } from './helpers';
import { describe, expect, it } from 'vitest';
import { Campaign, answerDemand, armyAt, armySize, continueAI, endTurn, newCampaign, resolvePending } from '../src/sim/campaign';
import { MEN, awayFrom, musterOf, sendHome } from '../src/sim/armytown';
import { GOVERN, keepOrders } from '../src/sim/governor';
import { DRILL, companyOf, drillOf, drillText, drillTown, drillTowns, goodsFor, menToSpare } from '../src/sim/townmuster';
import { STORE_KINDS, Stores, folkOf } from '../src/sim/township';

smallTownRules(); // these tests are about how men go to an army and come home, written with towns of ten men: the figures they were written with
const MEN_A_COMPANY = 2;

const units = (s: Stores) => STORE_KINDS.reduce((n, k) => n + s[k], 0);
/** A town of the player's with a barracks: ten men, six women, well stocked, left training clubmen. */
const town = (train: string[] = ['clubman']) => {
  const c = newCampaign(7, 1, 1, 'hearth');
  const t = c.territories.find((x) => x.owner < 0 && !x.horde && x.capital < 0)!;
  t.owner = 0; t.buildings = ['barracks']; c.places = []; delete t.town;
  c.armies = c.armies.filter((a) => a.at !== t.id);
  const f = folkOf(c, t.id);
  Object.assign(f, { men: 10, women: 6, elders: 0, children: 2 }); delete f.ages;
  f.stores = { food: 1000, wood: 1000, gold: 500, stone: 500 };
  if (train.length) keepOrders(c, t.id, { train });
  return { c, t, f };
};

/** The rivals take their turns, as the campaign screen would have them do. */
const rivalsMove = (c: Campaign): void => { if (c.demand) answerDemand(c, false); else if (c.pending) resolvePending(c, 'auto'); else continueAI(c); };

describe('a town left training goes on raising', () => {
  it('a soldier belongs to the company his building trains', () => {
    expect(companyOf('clubman')).toBe('infantry');
    expect(companyOf('swordsman')).toBe('infantry');
    expect(companyOf('bowman')).toBe('archers');
    expect(companyOf('rider')).toBe('cavalry');
    expect(companyOf('villager')).toBeUndefined();
    expect(companyOf('nosuchthing')).toBeUndefined();
  });

  it('it raises one company a season from its own men and its own stores', () => {
    const { c, t, f } = town();
    const had = units(f.stores), cost = goodsFor(c, t.id, 'infantry'), supplies = c.factions[0].supplies;
    const d = drillTown(c, t.id)!;
    expect(d).toMatchObject({ at: t.id, kind: 'infantry', men: MEN_A_COMPANY });
    expect(f.men).toBe(10 - MEN_A_COMPANY);
    expect(units(f.stores)).toBe(had - cost);
    expect(f.stores.food).toBe(1000); // its bread is spent last
    const a = armyAt(c, t.id)!;
    expect(a.owner).toBe(0);
    expect(a.units.infantry).toBe(1);
    expect(a.moved).toBe(true); // fresh troops march next turn
    // The company's men are this town's, on the army's roll (armytown.ts).
    expect(musterOf(c, a.id)!.men[t.id].length).toBe(MEN_A_COMPANY);
    expect(awayFrom(c, t.id)).toBe(MEN_A_COMPANY);
    expect(c.log.at(-1)).toContain(t.name);
    // Nothing came from anywhere else.
    expect(c.factions[0].supplies).toBe(supplies);
  });

  it('the men come home to the town that raised them', () => {
    const { c, t, f } = town();
    drillTown(c, t.id);
    const a = armyAt(c, t.id)!;
    a.moved = false;
    expect(sendHome(c, a.id)).toBe(MEN_A_COMPANY);
    expect(f.men).toBe(10);
    expect(awayFrom(c, t.id)).toBe(0);
  });

  it('it never goes below the men a town keeps', () => {
    const { c, t, f } = town();
    const keeps = Math.max(MEN.floor, Math.ceil(f.women * MEN.couples));
    for (let i = 0; i < 10; i++) drillTown(c, t.id);
    expect(f.men).toBeGreaterThanOrEqual(keeps);
    expect(menToSpare(c, t.id)).toBeLessThan(MEN_A_COMPANY);
    expect(drillOf(c, t.id).why).toBe('men');
    expect(armySize(armyAt(c, t.id)!)).toBe(Math.floor((10 - keeps) / MEN_A_COMPANY));
    expect(drillText(c, t.id)).toContain('no men to spare');
  });

  it('it never takes the stores below what the governor keeps', () => {
    const { c, t, f } = town();
    // Enough to eat (no shorter than the governor reckons short), not enough to spare: a smaller town, so that is little.
    f.women = 5; f.children = 0;
    f.stores = { food: GOVERN.short * (f.men + f.women + f.elders + f.children), wood: 0, gold: 0, stone: 0 };
    expect(GOVERN.floor + goodsFor(c, t.id, 'infantry')).toBeGreaterThan(f.stores.food);
    expect(drillOf(c, t.id).why).toBe('stores');
    expect(drillTown(c, t.id)).toBeNull();
    expect(f.men).toBe(10);
    expect(armyAt(c, t.id)).toBeUndefined();
  });

  it('it stops when the army there is big enough', () => {
    const { c, t, f } = town();
    Object.assign(f, { men: 40, women: 6 });
    f.stores = { food: 5000, wood: 5000, gold: 5000, stone: 5000 };
    for (let i = 0; i < 12; i++) drillTown(c, t.id);
    expect(armySize(armyAt(c, t.id)!)).toBe(DRILL.most);
    expect(drillOf(c, t.id).why).toBe('full');
    expect(f.men).toBe(40 - DRILL.most * MEN_A_COMPANY);
  });

  it('it raises nobody without the yard, without the order, when food is short, or under another army', () => {
    const none = town([]);
    expect(drillOf(none.c, none.t.id).why).toBe('none');
    expect(drillText(none.c, none.t.id)).toBe('');
    const horse = town(['rider']); // a barracks trains no riders
    expect(drillOf(horse.c, horse.t.id).why).toBe('yard');
    const hungry = town();
    hungry.f.stores.food = 10;
    expect(drillOf(hungry.c, hungry.t.id).why).toBe('food');
    const held = town();
    held.c.armies.push({ id: held.c.nextArmy++, owner: 1, at: held.t.id, units: { infantry: 1 }, hero: false, vet: 0, moved: true });
    expect(drillOf(held.c, held.t.id).why).toBe('army');
    for (const x of [none, horse, hungry, held]) { expect(drillTown(x.c, x.t.id)).toBeNull(); expect(x.f.men).toBe(10); }
  });

  it('a yard standing in the town itself will do, once it is finished', () => {
    const { c, t } = town();
    t.buildings = [];
    t.town = { at: c.turn, b: [['towncenter', 30, 30], ['barracks', 36, 30, 0.5, 0.4]] };
    expect(drillOf(c, t.id).why).toBe('yard'); // half built
    t.town!.b[1] = ['barracks', 36, 30];
    expect(drillOf(c, t.id).kind).toBe('infantry');
  });

  it('the player\'s season trains only the player\'s towns; a rival\'s town with an order trains by its own pass (rivaldrill.ts)', () => {
    const { c, t, f } = town();
    t.owner = 1;
    expect(drillOf(c, t.id).kind).toBe('infantry'); // a rival's town given an order to train may
    expect(drillTowns(c)).toEqual([]); // but not in the player's season
    expect(f.men).toBe(10);
  });

  it('the season turns and the town has raised a company', () => {
    const { c, t } = town();
    c.fronts = [];
    endTurn(c);
    let guard = 0;
    while (c.phase !== 'player' && c.phase !== 'over' && guard++ < 200) rivalsMove(c);
    const a = c.armies.find((x) => x.owner === 0 && musterOf(c, x.id)?.men[t.id]?.length);
    expect(a).toBeDefined();
  });
});
