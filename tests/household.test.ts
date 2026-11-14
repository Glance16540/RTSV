// A man at war is still of his house (docs/DESIGN.md; src/sim/household.ts).
import { describe, expect, it } from 'vitest';
import { Building, Game, Unit } from '../src/sim/game';
import { RENOWN_CHILDREN } from '../src/sim/data';
import { WAR_RENOWN, awayOf, coupleParted, creditKill, houseOfServing, serving, settleHomes, warRenown } from '../src/sim/household';
import { newCampaign } from '../src/sim/campaign';
import { MOTHER_KIDS, cleanCensus, folkOf, homeStanding, living, musterFolk, settleFolk } from '../src/sim/township';
import { awayHtml } from '../src/client/housepanel';
import { run, setups, spot, villagers } from './helpers';

const LONG = 60_000;
/** A quiet town with a barracks and one house, a couple living in it, and plenty in store. */
const town = (seed = 7) => {
  const g = new Game(seed, setups);
  Object.assign(g.players[0].res, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  const put = (type: string): Building => { const at = spot(g, type, 0); return g.spawnBuilding(type, 0, at.cx, at.cy, true); };
  const barracks = put('barracks'), house = put('house');
  const men = villagers(g, 0).filter((v) => v.gender === 'm'), women = villagers(g, 0).filter((v) => v.gender === 'f');
  const [husband, other] = men, wife = women[0];
  house.residents = { m: husband.id, f: wife.id };
  husband.homeId = wife.homeId = house.id;
  house.family = husband.family = wife.family = 'Holt';
  const soldier = g.trainedAs(0, 'clubman');
  /** Train one man to arms and hand back the soldier he becomes. */
  const enlist = (): Unit => {
    const before = new Set(g.units.map((u) => u.id));
    expect(g.cmdTrain(0, barracks.id, soldier)).toBe(true);
    run(g, 70);
    return g.units.find((u) => u.owner === 0 && !before.has(u.id) && serving(u))!;
  };
  return { g, barracks, house, husband, other, wife, put, enlist };
};

describe('a man at war is still of his house', () => {
  it('a husband taken to train keeps his place in his house, and nobody is moved into it', () => {
    const { g, house, husband, other, wife, enlist } = town();
    g.perish(other); // so that it is the husband who goes
    const name = husband.name;
    const him = enlist();
    expect(him.name).toBe(name);
    expect(husband.dead).toBe(true); // the villager he was is no longer on the map
    expect(house.residents.m).toBe(him.id); // but the house has not lost him
    expect(house.residents.f).toBe(wife.id);
    expect(him.homeId).toBe(house.id);
    expect(houseOfServing(g, him)).toEqual({ house, as: 'husband' });
    expect(awayOf(g, house).map((a) => [a.unit.name, a.as])).toEqual([[name, 'husband']]);
    // Another man of the town with no house is not put in his place.
    const idle = g.spawnUnit('villager', 0, house.x + 2, house.y + 2, 'm');
    expect(g.cmdAutoResidents(0, house.id)).toBe(0);
    run(g, 5);
    expect(house.residents.m).toBe(him.id);
    expect(idle.homeId).toBe(0);
  }, LONG);

  it('the house panel says who is away at war and what he has won', () => {
    const { g, house, husband, other, enlist } = town();
    expect(awayHtml(g, house)).toBe(''); // nobody is away, and nothing is won
    g.perish(other);
    const name = husband.name, him = enlist();
    for (let i = 0; i < WAR_RENOWN; i++) creditKill(g, him);
    him.kills = WAR_RENOWN;
    const html = awayHtml(g, house);
    expect(html).toContain(`<b>${name}</b>, its man, is away at war as a`);
    expect(html).toContain(`felled ${WAR_RENOWN}`);
    expect(html).toContain('renown +1');
    expect(html).toContain('no child is begun until both are home');
  }, LONG);

  it('his absence is felt: the house begins no child while he is away', () => {
    const { g, house, other, enlist } = town();
    g.perish(other);
    run(g, 5);
    const begun = house.birthProgress;
    expect(coupleParted(g, house)).toBe(false);
    enlist();
    expect(coupleParted(g, house)).toBe(true);
    const then = house.birthProgress;
    run(g, 30);
    expect(house.birthProgress).toBe(then);
    expect(begun).toBeGreaterThan(0); // as it did while he was at home
  }, LONG);

  it('what he wins in war counts to his house and raises its renown, and stays to its name when he falls', () => {
    const { g, house, other, enlist } = town();
    g.perish(other);
    const him = enlist(), plain = g.renown(house);
    // A foe within reach of his club: the kill is his, and his house's.
    const foe = g.spawnUnit('villager', 1, him.x + 0.8, him.y, 'm');
    foe.hp = 1;
    g.cmdTarget(0, [him.id], foe.id);
    run(g, 15);
    expect(foe.dead).toBe(true);
    expect(him.kills).toBe(1);
    expect(house.warKills).toBe(1);
    for (let i = 1; i < WAR_RENOWN; i++) creditKill(g, him);
    expect(house.warKills).toBe(WAR_RENOWN);
    expect(warRenown(house)).toBe(1);
    expect(g.renown(house)).toBe(plain + 1);
    house.children = RENOWN_CHILDREN; // and it stands beside the children the house has raised
    expect(g.renown(house)).toBe(plain + 2);
    // He is struck from the house only when he dies.
    g.perish(him);
    run(g, 1);
    expect(house.residents.m).toBe(0);
    expect(awayOf(g, house)).toEqual([]);
    expect(house.warKills).toBe(WAR_RENOWN);
    expect(coupleParted(g, house)).toBe(false);
  }, LONG);

  it('an unmarried son is of the house he was born in: his kills count to it, and it is not parted by his going', () => {
    const { g, house, husband, other, enlist } = town();
    other.bornAt = house.id; other.family = 'Holt';
    const name = other.name;
    const son = enlist(); // the unhoused man goes before the husband
    expect(son.name).toBe(name);
    expect(husband.dead).toBe(false);
    expect(house.residents.m).toBe(husband.id);
    expect(houseOfServing(g, son)).toEqual({ house, as: 'son' });
    expect(awayOf(g, house).map((a) => a.as)).toEqual(['son']);
    expect(coupleParted(g, house)).toBe(false); // his mother and father are both at home
    creditKill(g, son);
    expect(house.warKills).toBe(1);
  }, LONG);

  it('a man whose house falls while he is away keeps his name and belongs to no house until he is home', () => {
    const { g, house, other, enlist } = town();
    g.perish(other);
    const him = enlist();
    creditKill(g, him);
    (g as unknown as { kill(e: unknown): void }).kill(house);
    expect(houseOfServing(g, him)).toBeNull();
    expect(him.homeId).toBe(0);
    expect(him.family).toBe('Holt');
    creditKill(g, him); // counted to no house
    expect(house.warKills).toBe(1);
  }, LONG);

  it('an army brought to the battle and a man with no house are of no house', () => {
    const { g, house, husband, other, enlist } = town();
    const stranger = g.spawnUnit(g.trainedAs(0, 'clubman'), 0, house.x + 3, house.y + 3);
    expect(serving(stranger)).toBe(false);
    expect(houseOfServing(g, stranger)).toBeNull();
    const man = enlist(); // `other`: unhoused, and born under no roof of this town
    expect(man.name).toBe(other.name);
    expect(houseOfServing(g, man)).toBeNull();
    creditKill(g, man); creditKill(g, stranger);
    expect(house.warKills ?? 0).toBe(0);
    expect(house.residents.m).toBe(husband.id);
  }, LONG);
});

describe('the town keeps his house between seasons', () => {
  it("a count of the town names the woman's man and what her house has won, whether he is at home or at war", () => {
    const { g, house, husband, other, wife, enlist } = town();
    g.perish(other);
    wife.kids = 2;
    expect(g.census(0).named).toEqual([expect.objectContaining({ name: wife.name, kids: 2, husband: husband.name })]);
    const him = enlist();
    for (let i = 0; i < 4; i++) creditKill(g, him);
    expect(g.census(0).named).toEqual([expect.objectContaining({ name: wife.name, kids: 2, husband: him.name, war: 4 })]);
    wife.kids = 0; // a house known for war alone is still counted by name
    expect(g.census(0).named).toEqual([expect.objectContaining({ name: wife.name, war: 4 })]);
    g.perish(him);
    run(g, 1);
    expect(g.census(0).named![0].husband).toBeUndefined(); // he is struck from it when he dies
    expect(g.census(0).named![0].war).toBe(4);
    expect(house.warKills).toBe(4);
  }, LONG);

  it("a notable home's standing counts him, and the record keeps him until he is lost", () => {
    const c = newCampaign(5, 1, 1, 'hearth'), h = c.territories.find((t) => t.capital === 0)!;
    const count = (named: object[]) => cleanCensus({ ...folkOf(c, h.id), taken: 0, named } as never)!;
    expect(homeStanding(2, WAR_RENOWN - 1)).toBe(2);
    expect(homeStanding(2, WAR_RENOWN)).toBe(MOTHER_KIDS);
    settleFolk(c, h.id, count([{ name: 'Maren', family: 'Holt', gender: 'f', kids: 2, husband: 'Osric', war: WAR_RENOWN - 1 }]));
    expect(living(folkOf(c, h.id))).toEqual([]); // two children and a little won: not yet a name
    settleFolk(c, h.id, count([{ name: 'Maren', family: 'Holt', gender: 'f', kids: 2, husband: 'Osric', war: WAR_RENOWN }]));
    expect(living(folkOf(c, h.id))).toEqual([expect.objectContaining({ name: 'Maren', kids: 2, war: WAR_RENOWN, husband: 'Osric', deed: `raised 2 children, her house felling ${WAR_RENOWN} in war` })]);
    expect(musterFolk(c, h.id).people.named).toEqual([expect.objectContaining({ name: 'Maren', husband: 'Osric', war: WAR_RENOWN, kids: 2 })]);
    // He falls in a later battle: the house keeps what he won, and no longer has him.
    settleFolk(c, h.id, count([{ name: 'Maren', family: 'Holt', gender: 'f', kids: 2, war: WAR_RENOWN }]));
    expect(living(folkOf(c, h.id))[0].husband).toBeUndefined();
    expect(living(folkOf(c, h.id))[0].war).toBe(WAR_RENOWN);
    expect(musterFolk(c, h.id).people.named![0].husband).toBeUndefined();
  }, LONG);

  it('coming home: the next time the town turns out, he is under his own roof with her, and the house has its name', () => {
    const g = new Game(7, setups);
    const at = spot(g, 'house', 0), house = g.spawnBuilding('house', 0, at.cx, at.cy, true);
    const her = villagers(g, 0).find((v) => v.gender === 'f')!;
    her.name = 'Maren';
    expect(settleHomes(g, 0, [{ name: 'Maren', family: 'Holt', kids: RENOWN_CHILDREN, husband: 'Osric', war: WAR_RENOWN }, { name: 'Nobody', husband: 'Noone' }])).toBe(1);
    const him = g.entities.get(house.residents.m) as Unit;
    expect(house.residents.f).toBe(her.id);
    expect(him).toMatchObject({ name: 'Osric', family: 'Holt', gender: 'm', type: 'villager', homeId: house.id });
    expect(house).toMatchObject({ family: 'Holt', children: RENOWN_CHILDREN, warKills: WAR_RENOWN });
    expect(g.renown(house)).toBe(2); // a rank for the children raised and a rank for what he won
    expect(villagers(g, 0).filter((v) => v.name === 'Osric').length).toBe(1);
  }, LONG);
});
