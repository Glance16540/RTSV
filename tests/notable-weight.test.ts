// The weight of notable people (docs/DESIGN.md, "Notable people"; src/sim/notableweight.ts): a home known for what
// it carries in, a veteran of their own town, and a loss that is felt for some seasons after the record of it.
import { describe, expect, it } from 'vitest';
import { Building, Game } from '../src/sim/game';
import { newCampaign } from '../src/sim/campaign';
import { cleanChampion } from '../src/sim/champion';
import { MOTHER_KIDS, Census, Notable, folkOf, living, musterFolk, cleanCensus, settleFolk } from '../src/sim/township';
import {
  FIELD_WEIGHT, GRIEF_MAX, GRIEF_SEASONS, GRIEF_LONGER, MADE_RENOWN, NATION_MAX, addMade, carriedIn, fame, homeDeed, homeMade, madeRenown, mourned, nationLoss,
  restoreMade, standingWith, townGrief, townVeterans, veteranTown,
} from '../src/sim/notableweight';
import { townMood, unitPortrait } from '../src/sim/portrait';
import { serving } from '../src/sim/household';
import { run, setups, spot, villagers } from './helpers';

const LONG = 60_000;
/** A quiet town with one house and a couple in it. */
const town = (seed = 7) => {
  const g = new Game(seed, setups);
  for (const p of g.players) p.dilemmaT = 1e9;
  Object.assign(g.players[0].res, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  const at = spot(g, 'house', 0), house: Building = g.spawnBuilding('house', 0, at.cx, at.cy, true);
  const husband = villagers(g, 0).find((v) => v.gender === 'm')!, wife = villagers(g, 0).find((v) => v.gender === 'f')!;
  house.residents = { m: husband.id, f: wife.id };
  husband.homeId = wife.homeId = house.id;
  return { g, house, husband, wife };
};
const count = (over: Partial<Census> = {}): Census => ({ men: 3, women: 3, elders: 1, children: 2, stores: { food: 120, wood: 80, gold: 40, stone: 10 }, taken: 0, named: [], ...over });
const lost = (kind: 'mother' | 'veteran', turn: number, over: Partial<Notable> = {}): Notable =>
  ({ name: 'N', gender: kind === 'mother' ? 'f' : 'm', kind, deed: '', turn: 0, lost: { turn, how: 'killed' }, ...over });

describe("a home's output", () => {
  it('counts what is carried in, food from a field half again, and a rank for every MADE_RENOWN', () => {
    const h: { made?: number } = {};
    addMade(h, 100);
    addMade(h, 100, true);
    expect(h.made).toBe(100 + 100 * FIELD_WEIGHT);
    expect(madeRenown(h)).toBe(0);
    addMade(h, MADE_RENOWN);
    expect(madeRenown(h)).toBe(1);
    addMade(h, -50);
    expect(h.made).toBe(250 + MADE_RENOWN);
  });
  it("standing adds output to children raised and foes felled; the deed says what she is known for", () => {
    expect(standingWith(2, 3, MADE_RENOWN)).toBe(4);
    expect(standingWith(0, 0, MADE_RENOWN * 3)).toBe(3);
    expect(homeDeed(3)).toBe('raised 3 children');
    expect(homeDeed(2, 4)).toBe('raised 2 children, her house felling 4 in war');
    expect(homeDeed(0, 6)).toBe('kept a house that felled 6 in war');
    expect(homeDeed(0, 0, MADE_RENOWN * 3)).toBe(`kept a house that carried in ${MADE_RENOWN * 3}`);
  });

  it('in a battle, a load carried in by the man or woman of a house is counted to it', () => {
    const { g, house, husband, wife } = town();
    carriedIn(g, wife, 10, false);
    carriedIn(g, husband, 10, true);
    expect(house.made).toBe(10 + 10 * FIELD_WEIGHT);
    // Someone who is not of the house adds nothing to it.
    const other = villagers(g, 0).find((v) => v.id !== wife.id && v.id !== husband.id)!;
    carriedIn(g, other, 50, false);
    expect(house.made).toBe(10 + 10 * FIELD_WEIGHT);
    expect(homeMade(g, wife)).toEqual({ made: 25 });
    expect(homeMade(g, husband)).toEqual({}); // the record is kept by her name
  });

  it('gathering for the town counts to the gatherer\'s house as the loads come home', () => {
    const { g, house, wife } = town();
    const food = g.resources.filter((r) => r.resType === 'food').sort((a, b) => Math.hypot(a.x - wife.x, a.y - wife.y) - Math.hypot(b.x - wife.x, b.y - wife.y))[0];
    g.cmdTarget(0, [wife.id], food.id);
    run(g, 90);
    expect(house.made ?? 0).toBeGreaterThan(0);
  }, LONG);

  it('a house that has carried in enough is renowned in the battle, and the census hands its output back', () => {
    const { g, house, wife } = town();
    const before = g.renown(house);
    house.made = MADE_RENOWN;
    expect(g.renown(house)).toBe(before + 1);
    wife.name = 'Maren';
    expect(g.census(0).named).toContainEqual(expect.objectContaining({ name: 'Maren', made: MADE_RENOWN }));
  });

  it('on the record between seasons: she is known for her output alone, it is kept at its most, and it goes back to her house', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), h = c.territories.find((t) => t.capital === 0)!;
    settleFolk(c, h.id, count({ named: [{ name: 'Ysolt', gender: 'f', kids: 0, made: MADE_RENOWN * MOTHER_KIDS }] }));
    const her = living(folkOf(c, h.id)).find((n) => n.name === 'Ysolt')!;
    expect(her).toMatchObject({ kind: 'mother', made: MADE_RENOWN * MOTHER_KIDS });
    expect(her.deed).toContain('carried in');
    // Not enough to be known, and she is not.
    settleFolk(c, h.id, count({ named: [{ name: 'Ysolt', gender: 'f', kids: 0, made: MADE_RENOWN * MOTHER_KIDS }, { name: 'Wenna', gender: 'f', kids: 0, made: MADE_RENOWN }] }));
    expect(living(folkOf(c, h.id)).some((n) => n.name === 'Wenna')).toBe(false);
    // A later season that reports less does not take away what was done.
    settleFolk(c, h.id, count({ named: [{ name: 'Ysolt', gender: 'f', kids: 1, made: 10 }] }));
    expect(her.made).toBe(MADE_RENOWN * MOTHER_KIDS);
    expect(her.kids).toBe(1);
    // It goes into the next battle with her, survives the clean-up of what a battle hands back, and is her house's again.
    const sent = musterFolk(c, h.id).people.named!.find((n) => n.name === 'Ysolt')!;
    expect(sent.made).toBe(MADE_RENOWN * MOTHER_KIDS);
    expect(cleanCensus(count({ named: [sent] }))!.named![0].made).toBe(MADE_RENOWN * MOTHER_KIDS);
    const { g, house, wife } = town();
    wife.name = 'Ysolt';
    restoreMade(g, 0, [sent]);
    expect(house.made).toBe(MADE_RENOWN * MOTHER_KIDS);
  });
});

describe('veterans of their own town', () => {
  const lands = [{ id: 0, owner: 0, capital: 0 }, { id: 1, owner: 0, capital: -1 }, { id: 2, owner: 1, capital: 1 }, { id: 3, owner: 0, capital: -1 }];
  it('belong to the town they came from while it is the nation\'s; else to its chief town; else to the land fought over', () => {
    expect(veteranTown(lands, 0, 3, 9)).toBe(3);
    expect(veteranTown(lands, 0, undefined, 9)).toBe(0);
    expect(veteranTown(lands, 0, 2, 9)).toBe(0); // their town has been taken
    expect(veteranTown([{ id: 1, owner: 0, capital: -1 }], 0, undefined, 9)).toBe(1);
    expect(veteranTown([], 0, undefined, 9)).toBe(9);
  });
  it('the town a soldier came from survives the clean-up of what a battle hands back', () => {
    expect(cleanChampion({ name: 'Bram', kills: 4, unit: 'Spearman', town: 3 })!.town).toBe(3);
    expect(cleanChampion({ name: 'Bram', kills: 4, unit: 'Spearman', town: -1 })!.town).toBeUndefined();
  });
  it("a town's veterans are those of its notable people who are soldiers and still living", () => {
    const list: Notable[] = [{ name: 'A', gender: 'm', kind: 'veteran', deed: '', turn: 0 }, lost('veteran', 1), { name: 'C', gender: 'f', kind: 'mother', deed: '', turn: 0 }];
    expect(townVeterans(list).map((n) => n.name)).toEqual(['A']);
  });
});

describe('the weight of a loss', () => {
  it('fame: a woman by her home\'s standing, a soldier by the foes they felled, 1 to 3', () => {
    expect(fame({ kind: 'mother', kids: MOTHER_KIDS })).toBe(1);
    expect(fame({ kind: 'mother', kids: 6 })).toBe(2);
    expect(fame({ kind: 'mother', kids: 2, made: MADE_RENOWN * 7 })).toBe(3);
    expect(fame({ kind: 'veteran', kills: 3 })).toBe(1);
    expect(fame({ kind: 'veteran', kills: 20 })).toBe(3);
  });
  it('a town grieves its known people for some seasons, more for the famous, never past GRIEF_MAX', () => {
    expect(townGrief([], 5)).toBe(0);
    const plain = townGrief([lost('mother', 5, { kids: MOTHER_KIDS })], 5), famous = townGrief([lost('veteran', 5, { kills: 12 })], 5);
    expect(plain).toBeGreaterThan(0);
    expect(famous).toBeGreaterThan(plain);
    // It fades, and is gone after GRIEF_SEASONS for one of little fame; the famous are mourned GRIEF_LONGER more a degree.
    expect(townGrief([lost('veteran', 5, { kills: 12 })], 6)).toBeLessThan(famous);
    expect(townGrief([lost('veteran', 5, { kills: 3 })], 5 + GRIEF_SEASONS)).toBe(0);
    expect(townGrief([lost('veteran', 5, { kills: 12 })], 5 + GRIEF_SEASONS)).toBeGreaterThan(0);
    expect(townGrief([lost('veteran', 5, { kills: 12 })], 5 + GRIEF_SEASONS + 2 * GRIEF_LONGER)).toBe(0);
    // The living are not grieved.
    expect(townGrief([{ ...lost('veteran', 5, { kills: 12 }), lost: undefined }], 5)).toBe(0);
    expect(townGrief(Array.from({ length: 20 }, () => lost('veteran', 5, { kills: 12 })), 5)).toBe(GRIEF_MAX);
    expect(mourned([lost('mother', 1), lost('mother', 4)], 5).map((n) => n.lost!.turn)).toEqual([4]);
  });
  it("the nation's standing dips across its towns, by the square of fame", () => {
    const one = nationLoss([[lost('veteran', 3, { kills: 3 })]], 3), three = nationLoss([[lost('veteran', 3, { kills: 9 })]], 3);
    expect(three).toBeCloseTo(one * 9);
    expect(nationLoss([[lost('veteran', 3, { kills: 3 })], [lost('mother', 3)]], 3)).toBeCloseTo(one * 2);
    expect(nationLoss([Array.from({ length: 30 }, () => lost('veteran', 3, { kills: 9 }))], 3)).toBe(NATION_MAX);
  });
  it('a campaign town that has lost a known person wears grief for seasons after', () => {
    const c = newCampaign(5, 1, 1, 'hearth'), h = c.territories.find((t) => t.capital === 0)!;
    folkOf(c, h.id).notables.push(lost('mother', c.turn, { kids: MOTHER_KIDS }));
    expect(townMood(c, h.id).bereaved).toBe(true);
    c.turn += GRIEF_SEASONS - 1;
    expect(townMood(c, h.id).bereaved).toBe(true);
    c.turn += 1;
    expect(townMood(c, h.id).bereaved).toBe(false);
  });
});

describe('gone to war', () => {
  it('one of the town\'s own under arms is marked gone to war; a soldier brought by an army is not', () => {
    const { g } = town();
    const tc = g.buildings.find((b) => b.owner === 0)!;
    const s = g.spawnUnit('clubman', 0, tc.x + 3, tc.y + 3, 'm');
    expect(serving(s)).toBe(false);
    expect(unitPortrait(g, s)!.marks).not.toContain('towar');
    s.lifespan = 1000; // a townsman trained to arms keeps the span of his life (muster.ts)
    expect(serving(s)).toBe(true);
    expect(unitPortrait(g, s)!.marks).toContain('towar');
  });
});
