// Threads the world begins: a land lost, a leader's fall, a plague, a marriage, a hungry winter, a claimant's rising
// (src/sim/threadstarts.ts, src/sim/worldtales.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, answerDemand, answerTale, continueAI, endTurn, newCampaign, resolvePending, taleNow, taleText } from '../src/sim/campaign';
import { TALES } from '../src/sim/story';
import type { ThreadStart } from '../src/sim/story';
import { STARTS, noteStarts, openerOf, startThread } from '../src/sim/threadstarts';
import { WORLD_TALES } from '../src/sim/worldtales';

const still = new WeakSet<Campaign>();
const turn = (c: Campaign) => {
  if (still.has(c)) { c.armies = c.armies.filter((a) => a.owner === 0); for (const f of c.factions) if (f.id > 0) f.supplies = 0; for (const t of c.territories) t.horde = false; }
  endTurn(c);
  for (let i = 0; i < 40 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); }
};
const toTale = (c: Campaign) => { do turn(c); while (c.phase !== 'over' && !c.tale); };
const quiet = (seed = 7) => { const c = newCampaign(seed, 1, 0, 'steppe'); c.truces = [{ with: 1, until: 999 }]; still.add(c); c.factions[0].supplies = 60; return c; };
const capOf = (c: Campaign) => c.territories.find((t) => t.capital === 0)!;
const KINDS: ThreadStart[] = ['landlost', 'leaderfall', 'plague', 'marriage', 'famine', 'rising'];

/** Make each kind of thing befall the player's people, after a season noticed as it was. */
const befall: Record<ThreadStart, (c: Campaign) => void> = {
  landlost: (c) => { const t = c.territories.find((x) => x.owner !== 0 && x.capital < 0 && x.owner !== 1) ?? c.territories.find((x) => x.owner !== 0 && x.capital < 0)!; t.owner = 0; noteStarts(c); t.owner = 1; },
  leaderfall: (c) => { c.factions[0].house = { ...(c.factions[0].house ?? { heirs: [], births: 0 }), line: (c.factions[0].house?.line ?? 1) + 1 } as NonNullable<Campaign['factions'][0]['house']>; },
  plague: (c) => { (c.events ??= []).push({ kind: 'plague', at: capOf(c).id, turn: c.turn, until: c.turn + 2 }); },
  marriage: (c) => { (c.pacts ??= []).push({ kind: 'marriage', a: 1, b: 0, since: c.turn, until: c.turn + 24, wed: ['Aldo', 'Bera'] }); },
  famine: (c) => { c.world = { kind: 'winter', until: c.turn + 3 }; (c.events ??= []).push({ kind: 'famine', at: capOf(c).id, turn: c.turn, until: c.turn + 1 }); },
  rising: (c) => { (c.claims ??= []).push({ id: 99, owner: 0, mother: 'Ada', parent: 'noble', by: 'a lord', town: capOf(c).id, born: 0, raised: c.turn, towns: [capOf(c).id] }); },
};

describe('threads the world begins', () => {
  it('each kind has one first tale, never told at random, and every road from it runs three tellings', () => {
    for (const k of KINDS) expect(TALES.filter((x) => x.opens === k).length, k).toBe(1);
    for (const t of WORLD_TALES) expect(TALES).toContain(t);
    const c = quiet(11);
    // A first tale is told only of something that befell the player's people (here, now and then, a hungry winter).
    const noticed: Partial<Record<ThreadStart, RegExp>> = { famine: /^(famine|hungry):/, plague: /^plague:/, marriage: /^wed:/, rising: /^rising:/ };
    let told = 0;
    for (let i = 0; i < 14 && c.phase !== 'over'; i++) {
      toTale(c);
      const k = taleNow(c)?.opens;
      if (k) { told++; expect(noticed[k], k).toBeTruthy(); expect(c.threadWatch!.seen.some((x) => noticed[k]!.test(x)), k).toBe(true); }
      c.tale = null;
    }
    expect(told).toBeLessThanOrEqual(KINDS.length);
    const depth = (id: string): number[] => (['a', 'b'] as const).flatMap((k) => { const on = TALES.filter((x) => x.after?.id === id && x.after.choice === k); return on.length ? on.flatMap((t) => depth(t.id).map((n) => n + 1)) : [1]; });
    for (const k of KINDS) expect(new Set(depth(openerOf(k)!.id)), k).toEqual(new Set([3]));
  });

  for (const kind of KINDS) {
    it(`${kind}: noticed when it befalls the player, and told at the next telling about that land`, () => {
      const c = quiet();
      noteStarts(c); // the season before
      befall[kind](c);
      const begun = noteStarts(c);
      expect(begun.map((s) => s.kind)).toEqual([kind]);
      toTale(c);
      expect(c.tale?.id).toBe(openerOf(kind)!.id);
      const tale = taleNow(c)!;
      expect(taleText(c, tale.text + tale.a.result + tale.b.result + tale.a.label + tale.b.label)).not.toMatch(/[{}]/);
      if (kind === 'landlost') expect(c.territories[c.tale!.land].owner).toBe(1);
      else expect(c.tale!.land).toBe(capOf(c).id);
      if (kind === 'landlost' || kind === 'marriage') expect(c.tale!.rival).toBe(1);
      // Never twice in a campaign.
      c.tale = null;
      befall[kind](c);
      expect(noteStarts(c)).toEqual([]);
    }, 60_000);
  }

  it('a thread waits its turn behind one already under way, and is let go if it waits too long', () => {
    const c = quiet();
    noteStarts(c);
    befall.plague(c);
    noteStarts(c);
    c.tale = null;
    c.answers = [{ id: 'exile', choice: 'a', turn: c.turn, land: capOf(c).id, rival: 1, tribe: -1 }];
    toTale(c);
    expect(taleNow(c)?.id).toBe('exile_home');
    c.tale = null;
    toTale(c);
    expect(taleNow(c)?.id).toBe('plague_year');
    // One that waits longer than STARTS.wait is let go.
    const d = quiet();
    noteStarts(d);
    befall.leaderfall(d);
    noteStarts(d);
    d.turn += STARTS.wait + 1;
    noteStarts(d);
    expect(d.threadSeeds).toEqual([]);
    expect(startThread(d)).toBe(false);
  }, 60_000);

  it('a thread the world began is played to its end and told whole', () => {
    const c = quiet();
    noteStarts(c);
    befall.plague(c);
    noteStarts(c);
    toTale(c);
    for (const id of ['plague_year', 'plague_church', 'plague_thanks']) {
      expect(c.tale?.id).toBe(id);
      c.factions[0].supplies = 60;
      expect(answerTale(c, 'a')).toBe(true);
      if (id !== 'plague_thanks') toTale(c);
    }
    const line = c.chronicle!.at(-1)!.text;
    expect(line).toContain(`So ended the matter of the plague in ${capOf(c).name}`);
    expect(line).toContain('you had the sick brought to the church, sent help from your own household and kept a day of thanksgiving.');
    expect(line).toContain(`${capOf(c).name} kept a day of thanksgiving for the end of the plague`);
  }, 60_000);

  it('is noticed in a whole campaign as it is played, and the watch is kept with a save', () => {
    const c = newCampaign(3, 3);
    for (let i = 0; i < 60 && c.phase !== 'over'; i++) { turn(c); c.tale = null; }
    expect(c.threadWatch?.held).toEqual(c.territories.filter((t) => t.owner === 0).map((t) => t.id));
    const back = JSON.parse(JSON.stringify(c)) as Campaign;
    expect(back.threadWatch).toEqual(c.threadWatch);
  }, 120_000);
});
