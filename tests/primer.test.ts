// Teaching the campaign: the first orders follow what the player has done, and the page says what the rules say.
import { describe, expect, it } from 'vitest';
import { COMPANIES, DOMINION_TURNS, HERO_RANK_STRENGTH, SITES, advanceAge, armyAt, build, canBuild, canRaise, dominionNeed, endTurn, newCampaign, raise, reach, sendGift } from '../src/sim/campaign';
import { HALL_GRACE } from '../src/sim/beaten';
import { CHAMPION_KILLS } from '../src/sim/champion';
import { primerBase, primerPage, primerSteps } from '../src/sim/primer';

const world = () => newCampaign(7, 2, 1, 'stonekin');
const next = (c: ReturnType<typeof world>, base: ReturnType<typeof primerBase>, seen: string[] = []) => primerSteps(c, base, seen).find((s) => !s.done)?.id;

describe('the first orders of a campaign', () => {
  it('begin with raising a company, which a new capital can do and afford', () => {
    const c = world(), base = primerBase(c), cap = c.territories.find((t) => t.capital === 0)!;
    expect(next(c, base)).toBe('raise');
    const kind = Object.keys(COMPANIES).find((k) => canRaise(c, 0, cap.id, k));
    expect(kind, 'something can be raised on turn one').toBeTruthy();
    raise(c, 0, cap.id, kind!);
    expect(next(c, base)).toBe('build');
  });

  it('move on as each is done, in whatever order the player does them', () => {
    const c = world(), base = primerBase(c), cap = c.territories.find((t) => t.capital === 0)!;
    endTurn(c);
    while (c.phase !== 'player') endTurn(c);
    const steps = primerSteps(c, base);
    expect(steps.find((s) => s.id === 'turn')!.done).toBe(true);
    expect(steps.find((s) => s.id === 'raise')!.done).toBe(false);
    c.factions[0].supplies = 99;
    const site = Object.keys(SITES).find((k) => canBuild(c, 0, cap.id, k))!;
    build(c, 0, cap.id, site);
    expect(primerSteps(c, base).find((s) => s.id === 'build')!.done).toBe(true);
    expect(advanceAge(c, 0)).toBe(true);
    expect(primerSteps(c, base).find((s) => s.id === 'age')!.done).toBe(true);
  });

  it('count a land taken, and goodwill earned with a rival', () => {
    const c = world(), base = primerBase(c), cap = c.territories.find((t) => t.capital === 0)!;
    const near = c.territories[reach(c, cap.id)[0]];
    near.owner = 0;
    expect(primerSteps(c, base).find((s) => s.id === 'take')!.done).toBe(true);
    c.factions[0].supplies = 99;
    expect(primerSteps(c, base).find((s) => s.id === 'rival')!.done).toBe(false);
    sendGift(c, 1);
    expect(primerSteps(c, base).find((s) => s.id === 'rival')!.done).toBe(true);
  });

  it('keep a step done once it has been done or passed over', () => {
    const c = world(), base = primerBase(c);
    expect(next(c, base, ['raise', 'build'])).toBe('take');
    // An army lost after the company was raised does not ask for it again.
    const army = armyAt(c, c.territories.find((t) => t.capital === 0)!.id)!;
    army.units = {};
    expect(primerSteps(c, base, ['raise']).find((s) => s.id === 'raise')!.done).toBe(true);
  });

  it('end on how the world is won, with that world\'s own numbers', () => {
    const c = world(), win = primerSteps(c, primerBase(c)).at(-1)!;
    expect(win.id).toBe('win');
    expect(win.how).toContain(`${dominionNeed(c)} of the ${c.territories.length}`);
    expect(win.how).toContain(`${DOMINION_TURNS} turns`);
  });
});

describe('the page that explains the campaign', () => {
  it('names everything that can be built and every kind of company, with its cost', () => {
    const text = primerPage().flatMap((s) => s.lines).join(' ');
    for (const s of Object.values(SITES)) expect(text).toContain(`<b>${s.name}</b> (${s.cost})`);
    for (const d of Object.values(COMPANIES)) expect(text).toContain(`<b>${d.name}</b> (${d.cost}`);
  });

  it('says how a siege is won and what a leader is worth, in the rules\' own numbers', () => {
    const text = primerPage().flatMap((s) => s.lines).join(' ');
    expect(text).toContain(`${HALL_GRACE} seconds`);
    expect(text).toContain(`each rank adds ${HERO_RANK_STRENGTH} `);
    expect(text).toContain(`${CHAMPION_KILLS} kills`);
    expect(text).toContain('Blooded, Veteran and Legend');
  });

  it('gives the winning numbers of the world in hand, and a share of the map without one', () => {
    const c = world();
    expect(primerPage(c).at(-1)!.lines[0]).toContain(`${dominionNeed(c)} of this world's ${c.territories.length} lands`);
    expect(primerPage().at(-1)!.lines[0]).toContain('60%');
  });
});
