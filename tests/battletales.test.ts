import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import { tellBattle } from '../src/sim/mapbattle';
import type { Outcome } from '../src/sim/mapbattle';
import { noteStood, readTale, talesAt, talesOf } from '../src/sim/battletales';

const side = (began: Record<string, number>, lost: Record<string, number>, extra = {}) => ({ began, lost, left: {}, share: 0.5, breakAt: 0.3, works: 0, ...extra });

describe('battle tales, read for a panel', () => {
  it('tells rounds, who broke, losses by kind, walls, leaders, the fallen and who stood', () => {
    const c = newCampaign(7);
    const to = c.territories.find((t) => t.owner === 1)!.id;
    const out = { attackerWon: true, broke: 'defender', rounds: 3, a: side({ infantry: 4, archers: 2 }, { infantry: 1 }), d: side({ infantry: 3 }, { infantry: 2 }, { works: 0.8, scattered: true }) } as unknown as Outcome;
    const tale = tellBattle(c, { attacker: 0, defender: 1, to } as never, out, { a: 'Edric' });
    expect(tale.beganA).toEqual({ infantry: 4, archers: 2 });
    expect(tale.scattered).toBe('defender');
    noteStood(c, { name: 'Wulf', town: c.territories.find((t) => t.owner === 0)!.id });
    const r = readTale(c, tale);
    expect(r.title).toContain(c.territories[to].name);
    expect(r.how).toMatch(/broke in the third round/);
    expect(r.sides[0].led).toBe('Edric');
    expect(r.sides[0].lost).toMatch(/1 /);
    expect(r.sides[1].scattered).toBe(true);
    expect(r.walls).toMatch(/beaten down/);
    expect(r.stood).toMatch(/^Wulf of /);
    expect(r.mine).toBe('won');
    expect(talesOf(c, 0)[0]).toBe(tale);
    expect(talesAt(c, to)[0]).toBe(tale);
    expect(talesAt(c, to + 1000)).toEqual([]);
  });

  it('names nobody as standing on a tale from an earlier season', () => {
    const c = newCampaign(3);
    const to = c.territories.find((t) => t.owner === 1)!.id;
    const out = { attackerWon: false, broke: 'attacker', rounds: 1, a: side({ infantry: 2 }, { infantry: 2 }), d: side({ infantry: 2 }, {}) } as unknown as Outcome;
    const tale = tellBattle(c, { attacker: 0, defender: 1, to } as never, out, {});
    c.turn++;
    noteStood(c, { name: 'Late', town: 0 });
    expect(tale.stood).toBeUndefined();
    expect(readTale(c, tale).mine).toBe('lost');
    expect(readTale(c, tale).how).toMatch(/broke in the first round/);
  });
});

// The reading rules case by case, on tales set down by hand.
import type { Campaign } from '../src/sim/campaign';
import type { BattleTale } from '../src/sim/mapbattle';
import { peopleName } from '../src/sim/naming';

const tale = (c: Campaign, over: Partial<BattleTale> = {}): BattleTale => ({
  turn: c.turn, at: c.territories.find((t) => t.owner === 1)!.id, attacker: 0, defender: 1, attackerWon: true,
  lostA: {}, lostD: {}, broke: 'defender', rounds: 2, fell: [], text: '', ...over,
});

describe('battle tales: the rules of the reading', () => {
  it('tells how it ended: the defender broke and the town was taken, the attacker broke, or nobody broke and they drew off', () => {
    const c = newCampaign(7);
    const t = tale(c), place = c.territories[t.at].name, A = `Your ${peopleName(c, 0)}`, D = `The ${peopleName(c, 1)}`;
    expect(readTale(c, t).how).toBe(`${D} broke in the second round, and ${place} was taken.`);
    expect(readTale(c, tale(c, { broke: 'attacker', rounds: 4, attackerWon: false })).how).toBe(`${A} broke in the fourth round before ${place}.`);
    expect(readTale(c, tale(c, { broke: 'neither', rounds: 3, attackerWon: false })).how).toBe(`${A} could not break ${place} in 3 rounds, and drew off.`);
    expect(readTale(c, tale(c, { broke: 'neither', rounds: 1, attackerWon: false })).how).toBe(`${A} could not break ${place} in 1 round, and drew off.`);
    expect(readTale(c, tale(c, { rounds: 8 })).how).toMatch(/in the eighth round/);
    expect(readTale(c, tale(c, { rounds: 9 })).how).toMatch(/in the 9th round/);
    expect(readTale(c, tale(c, { rounds: 12, broke: 'attacker' })).how).toMatch(/in the 12th round/);
  });

  it('says when, by season and year from the turn, and where', () => {
    const c = newCampaign(7);
    const at = (turn: number) => readTale(c, tale(c, { turn })).when;
    expect(at(0)).toMatch(/^In the spring of year 1 \(turn 0\), your .+ came against the .+ at /);
    expect(at(1)).toMatch(/^In the summer of year 1 \(turn 1\)/);
    expect(at(2)).toMatch(/^In the autumn of year 1/);
    expect(at(3)).toMatch(/^In the winter of year 1/);
    expect(at(4)).toMatch(/^In the spring of year 2/);
    expect(at(39)).toMatch(/^In the winter of year 10 \(turn 39\)/);
    const t = tale(c);
    expect(readTale(c, t).title).toBe(`The battle of ${c.territories[t.at].name}`);
    expect(readTale(c, tale(c, { at: 99999 })).title).toBe('The battle of a land since lost to the map');
  });

  it('counts each side\'s companies by kind, one or many, and says when what one brought is not known', () => {
    const c = newCampaign(7);
    const r = readTale(c, tale(c, { beganA: { infantry: 3, archers: 1, cavalry: 2 }, lostA: { archers: 1, cavalry: 2 }, lostD: {} }));
    expect(r.sides[0].began).toBe('3 infantry, 1 archer, 2 cavalry');
    expect(r.sides[0].lost).toBe('1 archer, 2 cavalry');
    expect(r.sides[0].lostN).toBe(3);
    expect(r.sides[1].began).toBe('not known');
    expect(r.sides[1].lost).toBe('none');
    expect(r.sides[1].lostN).toBe(0);
    // Nothing below zero is counted, nor a kind it does not know.
    const odd = readTale(c, tale(c, { lostA: { infantry: -2, archers: 2 } })).sides[0];
    expect(odd.lost).toBe('2 archers');
    expect(odd.lostN).toBe(2);
  });

  it('a side is named for the people reading it: yours, theirs, or the locals; and a leader only where there was one', () => {
    const c = newCampaign(7);
    const t = tale(c, { attacker: -1, defender: 0, attackerWon: false, broke: 'attacker', ledD: 'Hild' });
    const r = readTale(c, t);
    expect(r.sides[0].who).toBe('The locals');
    expect(r.sides[1].who).toBe(`Your ${peopleName(c, 0)}`);
    expect(r.sides[1].led).toBe('Hild');
    expect('led' in r.sides[0]).toBe(false);
    expect(r.sides.map((s) => s.won)).toEqual([false, true]);
    expect(r.mine).toBe('won');
    // The same tale as the other rival reads it: neither side is theirs.
    const by2 = readTale(c, t, 2);
    expect(by2.sides[1].who).toBe(`The ${peopleName(c, 0)}`);
    expect(by2.mine).toBe('theirs');
  });

  it('mine: won or lost as attacker or defender', () => {
    const c = newCampaign(7);
    expect(readTale(c, tale(c, { attackerWon: true })).mine).toBe('won');
    expect(readTale(c, tale(c, { attackerWon: false })).mine).toBe('lost');
    expect(readTale(c, tale(c, { attacker: 1, defender: 0, attackerWon: true })).mine).toBe('lost');
    expect(readTale(c, tale(c, { attacker: 1, defender: 0, attackerWon: false })).mine).toBe('won');
    expect(readTale(c, tale(c, { attackerWon: true }), 1).mine).toBe('lost');
  });

  it('the walls: nothing said when untouched, struck but held below half, beaten down from half', () => {
    const c = newCampaign(7);
    expect(readTale(c, tale(c)).walls).toBeUndefined();
    expect('walls' in readTale(c, tale(c, { works: 0 }))).toBe(false);
    expect(readTale(c, tale(c, { works: 0.2 })).walls).toBe('Its walls were struck, but held.');
    expect(readTale(c, tale(c, { works: 0.49 })).walls).toBe('Its walls were struck, but held.');
    expect(readTale(c, tale(c, { works: 0.5 })).walls).toBe('Its walls and towers were beaten down.');
    expect(readTale(c, tale(c, { works: 1 })).walls).toBe('Its walls and towers were beaten down.');
  });

  it('who scattered, the fallen as kept, and the man who stood, of his town or of a town since gone', () => {
    const c = newCampaign(7);
    const r = readTale(c, tale(c, { scattered: 'attacker', fell: ['Ada of the Reed house'] }));
    expect(r.sides.map((s) => s.scattered)).toEqual([true, false]);
    expect(r.fell).toEqual(['Ada of the Reed house']);
    expect(r.stood).toBeUndefined();
    const home = c.territories.find((t) => t.owner === 0)!;
    expect(readTale(c, tale(c, { stood: { name: 'Wulf', town: home.id } })).stood).toBe(`Wulf of ${home.name} was named by the winners for standing fast.`);
    expect(readTale(c, tale(c, { stood: { name: 'Wulf', town: 99999 } })).stood).toBe('Wulf of a town of theirs was named by the winners for standing fast.');
  });

  it('noteStood names one man, on this season\'s latest tale only, and never twice', () => {
    const c = newCampaign(7);
    noteStood(c, { name: 'Nobody', town: 0 }); // no tales yet: nothing to write on
    expect(c.tales ?? []).toEqual([]);
    const t = tale(c);
    c.tales = [t];
    noteStood(c, undefined);
    expect(t.stood).toBeUndefined();
    noteStood(c, { name: 'Wulf', town: 3 });
    expect(t.stood).toEqual({ name: 'Wulf', town: 3 });
    noteStood(c, { name: 'Other', town: 4 });
    expect(t.stood).toEqual({ name: 'Wulf', town: 3 });
    // Only the newest tale is written on.
    const older = tale(c), newer = tale(c);
    c.tales = [older, newer];
    noteStood(c, { name: 'Bran', town: 1 });
    expect(older.stood).toBeUndefined();
    expect(newer.stood!.name).toBe('Bran');
  });

  it('talesOf and talesAt: a people\'s or a land\'s tales, newest first, and nothing from no record', () => {
    const c = newCampaign(7);
    expect(talesOf(c)).toEqual([]);
    expect(talesAt(c, 0)).toEqual([]);
    const a = tale(c, { at: 1, attacker: 0, defender: 1 }), b = tale(c, { at: 2, attacker: 1, defender: 2 }), d = tale(c, { at: 1, attacker: 2, defender: 0 });
    c.tales = [a, b, d];
    expect(talesOf(c)).toEqual([d, a]);
    expect(talesOf(c, 1)).toEqual([b, a]);
    expect(talesOf(c, 2)).toEqual([d, b]);
    expect(talesOf(c, 5)).toEqual([]);
    expect(talesAt(c, 1)).toEqual([d, a]);
    expect(talesAt(c, 2)).toEqual([b]);
    expect(c.tales).toEqual([a, b, d]); // the record itself is left in its order
  });
});
