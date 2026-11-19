// Those carried off in a battle come home under their own roofs (src/sim/carriedhome.ts).
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { homeAgain } from '../src/sim/carriedhome';
import type { Roof } from '../src/sim/roofs';
import type { Held } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';

/** The player's capital with three households on its record, kept as of `kept`; and a Held of its people. */
const town = (turn = 10, kept = 10) => {
  const c = newCampaign(4, 1, 1, 'hearth');
  c.turn = turn;
  const t = c.territories.find((x) => x.capital === 0)!;
  const list: Roof[] = [
    { at: [10, 10], family: 'Ash', m: { name: 'Osric', seasons: 120 } }, // his wife is away
    { at: [12, 10], family: 'Birch', f: { name: 'Hild', seasons: 100 } }, // her man is away
    { at: [14, 10], family: 'Cole', m: { name: 'Wulf', seasons: 90 }, f: { name: 'Eda', seasons: 88 } }, // both at home
  ];
  folkOf(c, t.id).households = { turn: kept, list };
  const held = (who: Held['who'], since = turn - 4, from = t.id): Held => ({ from, owner: 0, men: [], women: [], since, who });
  return { c, t, list, held };
};

describe('homeAgain', () => {
  it('nobody named, nobody home', () => {
    const { c, held } = town();
    expect(homeAgain(c, held(undefined))).toBe(0);
    expect(homeAgain(c, held([]))).toBe(0);
  });

  it('a wife goes back under her husband\'s roof, a man under his own, older by the seasons they were held', () => {
    const { c, list, held } = town(10, 10);
    const n = homeAgain(c, held([
      { name: 'Aelfwyn', family: 'Ash', gender: 'f', seasons: 110 },
      { name: 'Godric', family: 'Birch', gender: 'm', seasons: 104 },
    ], 6));
    expect(n).toBe(2);
    expect(list[0].f).toEqual({ name: 'Aelfwyn', seasons: 114 });
    expect(list[1].m).toEqual({ name: 'Godric', seasons: 108 });
    expect(list[0].m!.name).toBe('Osric'); // the one at home is left as he was
  });

  it('the seasons the record has not yet counted are not counted twice', () => {
    // Taken at turn 4; the record was written at turn 8 and adds the seasons since itself: so 8 - 4 = 4, not 10 - 4.
    const { c, list, held } = town(10, 8);
    expect(homeAgain(c, held([{ name: 'Aelfwyn', family: 'Ash', gender: 'f', seasons: 110 }], 4))).toBe(1);
    expect(list[0].f!.seasons).toBe(114);
  });

  it('a roof that already has one of their kind under it, or bears their own name, takes nobody', () => {
    const { c, list, held } = town();
    const before = JSON.stringify(list);
    expect(homeAgain(c, held([
      { name: 'Ricola', family: 'Cole', gender: 'f', seasons: 80 }, // Eda is the woman of that house
      { name: 'Osric', family: 'Ash', gender: 'f', seasons: 80 }, // a name already under that roof
    ]))).toBe(0);
    expect(JSON.stringify(list)).toBe(before);
  });

  it('those with no family, or a family with no roof kept, are of the town as anyone is, and take no roof here', () => {
    const { c, list, held } = town();
    const before = JSON.stringify(list);
    expect(homeAgain(c, held([
      { name: 'Nobody', gender: 'm', seasons: 60 },
      { name: 'Stray', family: 'Thorn', gender: 'f', seasons: 60 },
    ]))).toBe(0);
    expect(JSON.stringify(list)).toBe(before);
  });

  it('only one of two of the same kind of the same house takes the empty place', () => {
    const { c, list, held } = town();
    expect(homeAgain(c, held([
      { name: 'Aelfwyn', family: 'Ash', gender: 'f', seasons: 100 },
      { name: 'Bettan', family: 'Ash', gender: 'f', seasons: 100 },
    ]))).toBe(1);
    expect(list[0].f!.name).toBe('Aelfwyn');
  });

  it('an age is kept within the record\'s bounds', () => {
    const { c, list, held } = town(500, 500);
    expect(homeAgain(c, held([{ name: 'Aelfwyn', family: 'Ash', gender: 'f', seasons: 390 }], 400))).toBe(1);
    expect(list[0].f!.seasons).toBe(400);
  });

  it('if the town they were taken from has been lost, they go home to another town of their people\'s', () => {
    const { c, t, held } = town();
    const lost = c.territories.find((x) => x.id !== t.id && x.owner !== 0)!;
    lost.owner = 1;
    const n = homeAgain(c, held([{ name: 'Aelfwyn', family: 'Ash', gender: 'f', seasons: 100 }], 6, lost.id));
    expect(n).toBe(1); // the capital is the first land of the player's people
    expect(folkOf(c, t.id).households!.list[0].f!.name).toBe('Aelfwyn');
  });

  it('a town with no households on its record takes nobody under a roof', () => {
    const { c, t, held } = town();
    delete folkOf(c, t.id).households;
    expect(homeAgain(c, held([{ name: 'Aelfwyn', family: 'Ash', gender: 'f', seasons: 100 }]))).toBe(0);
  });
});
