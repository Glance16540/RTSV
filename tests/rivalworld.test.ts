// A rival takes the world into account: named places, plague, winter, the world's seasons, and creed when it bargains (src/sim/rivalworld.ts).
import { describe, expect, it } from 'vitest';
import { biomeOf, newCampaign } from '../src/sim/campaign';
import { WORLD, creedGap, creedLean, worldMargin, worldText, worldWorth } from '../src/sim/rivalworld';
import { aimWorth } from '../src/sim/rivalplan';
import { WEARY, wouldAgree } from '../src/sim/rivalweary';
import { placesOf } from '../src/sim/places';
import { nationVirtue } from '../src/sim/townfaith';
import { isWinter } from '../src/sim/winter';

const world = () => {
  const c = newCampaign(3, 2, 1);
  c.bands = [];
  const tribal = c.territories.find((t) => t.owner < 0 && !t.horde && t.capital < 0 && biomeOf(c, t.id) !== 'desert')!;
  return { c, tribal };
};
/** Set where a people stands by setting every town of its own. */
const stand = (c: ReturnType<typeof newCampaign>, f: number, v: number) => { for (const t of c.territories) if (t.owner === f) t.virtue = v; };
const toWinter = (c: ReturnType<typeof newCampaign>) => { for (let i = 0; i < 8 && !isWinter(c); i++) c.turn++; expect(isWinter(c)).toBe(true); };
const toSummer = (c: ReturnType<typeof newCampaign>) => { for (let i = 0; i < 8 && isWinter(c); i++) c.turn++; };

describe('what the world adds to a war aim', () => {
  it('a land with a named place is worth more', () => {
    const { c, tribal } = world();
    c.places = [];
    const bare = worldWorth(c, 1, tribal.id);
    c.places = [{ at: tribal.id, kind: Object.keys(placesOf(newCampaign(3, 2, 1)).reduce((m, p) => ({ ...m, [p.kind]: 1 }), {}))[0] as never, name: 'The Old Stones', legend: '' }];
    expect(worldWorth(c, 1, tribal.id)).toBe(bare + WORLD.place);
    expect(worldText(c, 1, tribal.id)).toContain('The Old Stones');
  });
  it('a land with plague in it is worth far less while it lasts', () => {
    const { c, tribal } = world();
    c.places = [];
    const well = aimWorth(c, 1, tribal.id, 1);
    c.events = [...(c.events ?? []), { kind: 'plague', at: tribal.id, until: c.turn + 3 } as never];
    expect(aimWorth(c, 1, tribal.id, 1)).toBe(well - WORLD.plague);
    c.turn += 4;
    expect(aimWorth(c, 1, tribal.id, 1)).toBe(well);
  });
  it('the towns of a people far from its own faith are the more readily warred on; a tribe\'s are not', () => {
    const { c, tribal } = world();
    c.places = [];
    stand(c, 1, 80); stand(c, 2, -20);
    expect(creedGap(c, 1, 2)).toBeCloseTo(100);
    const theirs = c.territories.find((t) => t.owner === 2)!;
    expect(worldWorth(c, 1, theirs.id)).toBeCloseTo(WORLD.creed);
    stand(c, 2, 80);
    expect(worldWorth(c, 1, theirs.id)).toBeCloseTo(0);
    expect(creedGap(c, 1, -1)).toBe(0);
    expect(worldWorth(c, 1, tribal.id)).toBe(0);
  });
});

describe('the odds it wants to march', () => {
  it('better odds into a land where winter sits, and none where it does not', () => {
    const { c, tribal } = world();
    c.world = null;
    toSummer(c);
    expect(worldMargin(c, tribal.id)).toBe(0);
    toWinter(c);
    expect(worldMargin(c, tribal.id)).toBe(WORLD.winter);
    const desert = c.territories.find((t) => biomeOf(c, t.id) === 'desert');
    if (desert) expect(worldMargin(c, desert.id)).toBe(0); // no winter in the desert
  });
  it('better still in the Long Winter, and worse will do in the Season of Iron', () => {
    const { c, tribal } = world();
    toSummer(c);
    c.world = { kind: 'winter', until: c.turn + 2 };
    expect(worldMargin(c, tribal.id)).toBe(WORLD.longWinter);
    c.world = { kind: 'iron', until: c.turn + 2 };
    expect(worldMargin(c, tribal.id)).toBe(-WORLD.iron);
    c.world = { kind: 'iron', until: c.turn - 1 };
    expect(worldMargin(c, tribal.id)).toBe(0);
  });
});

describe('its standing when it bargains', () => {
  it('two peoples of like standing are readier to treat, and two far apart less ready', () => {
    const { c } = world();
    stand(c, 1, 50); stand(c, 2, 50 - WORLD.near);
    expect(creedLean(c, 1, 2)).toBe(WORLD.kin);
    stand(c, 2, 50 - WORLD.apart);
    expect(creedLean(c, 1, 2)).toBe(-WORLD.stranger);
    stand(c, 2, 50 - (WORLD.near + WORLD.apart) / 2);
    expect(creedLean(c, 1, 2)).toBe(0);
    expect(nationVirtue(c, 1)).toBe(50);
  });
  it('a rival sued for peace agrees at odds it would refuse a people of another faith', () => {
    const { c } = world();
    c.turn = WEARY.from + 4;
    c.armies = [];
    const a1 = c.territories.find((t) => t.owner === 1)!, a2 = c.territories.find((t) => t.owner === 2)!;
    // The sued is 1.4 times as strong: over what it yields to a stranger (1.3 less 15%), under what it yields to kin (1.3 and 15% more).
    c.armies.push({ id: 1, owner: 1, at: a1.id, units: { infantry: 10 }, hero: false, vet: 0, moved: false }, { id: 2, owner: 2, at: a2.id, units: { infantry: 14 }, hero: false, vet: 0, moved: false });
    for (const t of c.territories) if (t.owner === 2) delete t.yoke;
    stand(c, 1, 50); stand(c, 2, 50);
    const kin = wouldAgree(c, 2, 1);
    stand(c, 2, -60);
    const strangers = wouldAgree(c, 2, 1);
    expect(kin).toBe(true);
    expect(strangers).toBe(false);
  });
});
