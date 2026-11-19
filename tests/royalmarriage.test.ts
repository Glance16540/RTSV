// Royal marriages between houses (src/sim/royalmarriage.ts, src/sim/pacts.ts): grown children only, offered and
// answered by rulers, binding the two peoples in peace, a child of both houses with a claim in time.
import { describe, expect, it } from 'vitest';
import { Campaign, atTruce, moveArmy, newCampaign } from '../src/sim/campaign';
import { CHILD_SEASONS } from '../src/sim/ageing';
import { houseOf } from '../src/sim/dynasty';
import { pactOf, wedPeace } from '../src/sim/pacts';
import { MARRY, answerMarriage, claimsOn, marryBar, matchOf, offerMarriage, royalSeason } from '../src/sim/royalmarriage';

const grown = (c: Campaign, name: string, female: boolean) => ({ name, female, born: c.turn - CHILD_SEASONS - 10 });
function world(): { c: Campaign; r1: number; r2: number } {
  const c = newCampaign(11, 3, 1, 'hearth');
  c.turn = 100;
  const [r1, r2] = c.factions.filter((f) => f.id > 0 && f.alive).map((f) => f.id);
  houseOf(c, 0).heirs = [grown(c, 'Edda', true)];
  houseOf(c, r1).heirs = [grown(c, 'Brand', false)];
  houseOf(c, r2).heirs = [grown(c, 'Wyn', true)];
  return { c, r1, r2 };
}

describe('royal marriages', () => {
  it('a match is between grown, unwed children of the other sex: never a child', () => {
    const { c, r1, r2 } = world();
    expect(matchOf(c, 0, r1)!.map((h) => h.name)).toEqual(['Edda', 'Brand']);
    expect(matchOf(c, 0, r2)).toBeNull(); // two daughters
    houseOf(c, r1).heirs = [{ name: 'Tam', female: false, born: c.turn - 10 }]; // a boy
    expect(matchOf(c, 0, r1)).toBeNull();
    expect(marryBar(c, 0, r1)).toContain('nobody grown');
  });

  it('accepted, the two are wed and the peoples are at peace; for the player it is a truce too', () => {
    const { c, r1 } = world();
    let done = 'not yet';
    for (let t = 0; t < 40 && done !== ''; t++) { c.turn++; delete c.factions[r1].refused; done = offerMarriage(c, r1); } // a refusal now and then, by their temper
    expect(done).toBe('');
    expect(houseOf(c, 0).heirs[0].wedTo?.key).toBe(`house:${r1}`);
    expect(houseOf(c, r1).heirs[0].wedTo?.key).toBe('house:0');
    expect(wedPeace(c, 0, r1)).toBe(true);
    expect(atTruce(c, 0, r1)).toBe(true);
    expect(c.truces.some((t) => t.with === r1 && t.until === pactOf(c, 'marriage', 0, r1)!.until)).toBe(true);
    expect(marryBar(c, 0, r1)).toContain('bound already');
  });

  it('two rivals\' houses wed are at peace with each other, and neither marches on the other', () => {
    const { c, r1, r2 } = world();
    houseOf(c, r2).heirs = [grown(c, 'Wyn', true)];
    c.pacts = [{ kind: 'marriage', a: r1, b: r2, since: c.turn, until: c.turn + MARRY.seasons, wed: ['Brand', 'Wyn'] }];
    expect(atTruce(c, r1, r2)).toBe(true);
    const from = c.territories.find((t) => t.owner === r1 && t.adj.some((n) => c.territories[n].owner === r2));
    if (from) {
      const to = from.adj.find((n) => c.territories[n].owner === r2)!;
      c.armies.push({ id: 900, owner: r1, at: from.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
      expect(moveArmy(c, 900, to)).toBe('invalid');
    }
  });

  it('the player marching on a house it is wed to breaks the peace; the marriage stands', () => {
    const { c, r1 } = world();
    c.pacts = [{ kind: 'marriage', a: 0, b: r1, since: c.turn, until: c.turn + MARRY.seasons, wed: ['Edda', 'Brand'] }];
    const theirs = c.territories.find((t) => t.owner === r1 && t.adj.length)!;
    const mine = c.territories.find((t) => t.owner === 0)!;
    theirs.adj.push(mine.id); mine.adj.push(theirs.id);
    c.armies = c.armies.filter((a) => a.at !== mine.id);
    c.armies.push({ id: 901, owner: 0, at: mine.id, units: { infantry: 3 }, hero: false, vet: 0, moved: false });
    c.phase = 'player';
    moveArmy(c, 901, theirs.id);
    expect(wedPeace(c, 0, r1)).toBe(false);
    expect(c.pacts!.length).toBe(1); // on record still
  });

  it('a rival offers the player a match; it waits two seasons for an answer, and accepted they are wed', () => {
    const { c, r1 } = world();
    c.pactOffer = { kind: 'marriage', from: r1, turn: c.turn, wed: ['Brand', 'Edda'] };
    expect(answerMarriage(c, true)).toBe(true);
    expect(wedPeace(c, 0, r1)).toBe(true);
    const d = world();
    d.c.pactOffer = { kind: 'marriage', from: d.r1, turn: d.c.turn, wed: ['Brand', 'Edda'] };
    d.c.turn += MARRY.waits;
    royalSeason(d.c);
    expect(d.c.pactOffer?.turn === d.c.turn - MARRY.waits).toBe(false); // that one lapsed
  });

  it('in time a child of both houses is born, a record only, and once grown has a claim on both thrones', () => {
    const { c, r1 } = world();
    c.pacts = [{ kind: 'marriage', a: 0, b: r1, since: c.turn, until: c.turn + MARRY.seasons, wed: ['Edda', 'Brand'] }];
    for (let t = 0; t < 60 && !c.pacts[0].child; t++) { c.turn++; royalSeason(c); }
    const child = c.pacts![0].child!;
    expect(child).toBeDefined();
    expect(claimsOn(c, 0)).toEqual([]); // a child claims nothing
    c.turn = child.born + CHILD_SEASONS;
    royalSeason(c);
    expect(claimsOn(c, 0)).toEqual([{ name: child.name, female: child.female, other: r1 }]);
    expect(claimsOn(c, r1)[0].other).toBe(0);
    expect(c.chronicle!.at(-1)!.text).toContain('claim on both thrones');
  });

  it('rulers of the computer match their houses now and then by the same rules', () => {
    const { c, r1, r2 } = world();
    let wed = 0;
    for (let t = 0; t < 400; t++) {
      c.turn++;
      houseOf(c, r1).heirs = [grown(c, `B${t}`, false)];
      houseOf(c, r2).heirs = [grown(c, `W${t}`, true)];
      delete c.pactOffer;
      c.pacts = [];
      royalSeason(c);
      if (wedPeace(c, r1, r2)) wed++;
    }
    expect(wed).toBeGreaterThan(0);
  });
});
