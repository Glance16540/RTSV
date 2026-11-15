// Stories of the leader's own house: a rival king and a suitor (src/sim/courtstory.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, atTruce, newCampaign } from '../src/sim/campaign';
import { COURT, beginPlot, beginRival, beginSuitor, courtBegin, daughterOfAge } from '../src/sim/courtstory';
import { noblesOf } from '../src/sim/nobles';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { choicesFor, choose, intrigueSeason, intriguesAt, openIntrigues, standing } from '../src/sim/intrigue';
import { kinOf, spouseOf } from '../src/sim/kin';
import { nationStores } from '../src/sim/township';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
/** A campaign well on, the player rich, with a spouse, a grown daughter and a rival people. */
const world = (seed = 5): { c: Campaign; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 20; c.phase = 'player';
  for (const t of c.territories) if (t.owner === 0) Object.assign(folkOf(c, t.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
  kinOf(c, 0);
  const h = houseOf(c, 0);
  h.heirs = [{ name: 'Elin', female: true, born: c.turn - HEIR_AGE - 8 }, { name: 'Tam', female: false, born: c.turn - 20 }, { name: 'Wyn', female: true, born: c.turn - 30 }];
  return { c, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id };
};
const season = (c: Campaign): void => { c.turn++; intrigueSeason(c); };
const virtue = (c: Campaign): number => c.factions[0].virtue ?? 0;

describe('a rival king', () => {
  it('threatens, then demands the spouse, and waits for an answer', () => {
    const { c, rival } = world(), x = beginRival(c, rival)!;
    const spouse = spouseOf(c, 0)!.name;
    expect(x.cast!.spouse).toBe(spouse);
    expect(c.intrigueNews!.at(-1)!.text).toContain(spouse);
    expect(choicesFor(c, x).map((k) => k.id)).toEqual(['watch']);
    for (let i = 0; i < COURT.rival.demand; i++) season(c);
    expect(x.stage).toBe(1);
    expect(choicesFor(c, x).map((k) => k.id)).toEqual(['defy', 'buy', 'yield', 'watch']);
    expect(standing(c, x)).toContain('demands');
    expect(intriguesAt(c, x.at)).toContain(x);
  });
  it('given the spouse, gives peace, at a great cost; nothing is told of them after', () => {
    const { c, rival } = world(), x = beginRival(c, rival)!, spouse = spouseOf(c, 0)!.name;
    for (let i = 0; i < COURT.rival.demand; i++) season(c);
    const v = virtue(c), loyal = kinOf(c, 0).circle.map((k) => k.loyalty);
    expect(choose(c, x.id, 'yield')).toBe(true);
    expect(spouseOf(c, 0)).toBeUndefined();
    expect(kinOf(c, 0).spouse!.lost).toMatchObject({ how: 'taken' });
    expect(atTruce(c, 0, rival)).toBe(true);
    expect(virtue(c)).toBeLessThan(v);
    kinOf(c, 0).circle.forEach((k, i) => expect(k.loyalty).toBeLessThan(loyal[i]));
    expect(x.ended!.how).toBe('yielded');
    expect(c.chronicle!.at(-1)!.text).toContain(spouse);
    for (let i = 0; i < 6; i++) season(c);
    expect((c.intrigueNews ?? []).filter((n) => n.turn > x.ended!.turn && n.text.includes(spouse))).toHaveLength(0);
  });
  it('defied, sends a knife, which a guard makes likelier to be taken at the door', () => {
    const run = (guard: boolean): Record<string, number> => {
      const how: Record<string, number> = {};
      for (let seed = 1; seed <= 60; seed++) {
        const { c, rival } = world(seed), x = beginRival(c, rival)!;
        for (let i = 0; i < COURT.rival.demand; i++) season(c);
        expect(choose(c, x.id, 'defy')).toBe(true);
        if (guard) expect(choose(c, x.id, 'watch')).toBe(true);
        for (let i = 0; i < 8 && !x.ended; i++) season(c);
        expect(['foiled', 'slain', 'wounded']).toContain(x.ended!.how);
        if (x.ended!.how === 'slain') expect(c.factions[0].heroAlive).toBe(false); else expect(c.factions[0].heroAlive).toBe(true);
        expect(spouseOf(c, 0)).toBeTruthy(); // the spouse stays, whatever comes
        how[x.ended!.how] = (how[x.ended!.how] ?? 0) + 1;
      }
      return how;
    };
    const bare = run(false), kept = run(true);
    expect(kept.foiled).toBeGreaterThan(bare.foiled + 8);
    expect(bare.slain ?? 0).toBeGreaterThan(0);
    expect(bare.wounded ?? 0).toBeGreaterThan(0);
  });
  it('left without an answer takes silence for defiance; bought off, it holds or it does not', () => {
    const { c, rival } = world(), x = beginRival(c, rival)!;
    for (let i = 0; i < COURT.rival.demand + COURT.rival.answer; i++) season(c);
    expect(x.stage).toBe(2);
    const how = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const w = world(seed), y = beginRival(w.c, w.rival)!;
      for (let i = 0; i < COURT.rival.demand; i++) season(w.c);
      const had = nationStores(w.c, 0).gold + nationStores(w.c, 0).food + nationStores(w.c, 0).wood + nationStores(w.c, 0).stone;
      expect(choose(w.c, y.id, 'buy')).toBe(true);
      const has = nationStores(w.c, 0).gold + nationStores(w.c, 0).food + nationStores(w.c, 0).wood + nationStores(w.c, 0).stone;
      expect(has).toBeLessThan(had);
      how.add(y.ended ? y.ended.how : `stage${y.stage}`);
    }
    expect([...how].sort()).toEqual(['bought', 'stage2']);
  });
  it('ends when the rival people is gone, or the spouse is', () => {
    const a = world(), x = beginRival(a.c, a.rival)!;
    a.c.factions[a.rival].alive = false; season(a.c);
    expect(x.ended!.how).toBe('outlived');
    const b = world(), y = beginRival(b.c, b.rival)!;
    kinOf(b.c, 0).spouse!.lost = { turn: b.c.turn, how: 'died' }; season(b.c);
    expect(y.ended!.how).toBe('outlived');
    const d = world(); kinOf(d.c, 0).spouse!.lost = { turn: 1, how: 'died' };
    expect(beginRival(d.c, d.rival)).toBeNull(); // nobody to covet
  });
});

describe('a suitor', () => {
  it('asks only for a daughter who is grown', () => {
    const { c, rival } = world(), x = beginSuitor(c, rival)!;
    expect(x.cast!.daughter).toBe('Elin');
    expect(daughterOfAge(c)!.name).toBe('Elin');
    houseOf(c, 0).heirs = houseOf(c, 0).heirs.filter((h) => h.name !== 'Elin');
    expect(daughterOfAge(c)).toBeUndefined(); // Wyn is a child
    expect(beginSuitor(c, rival)).toBeNull();
    season(c);
    expect(x.ended!.how).toBe('outlived');
  });
  it('lets the leader ask her first, and what she says is what she feels', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { c, rival } = world(seed), x = beginSuitor(c, rival)!;
      expect(choicesFor(c, x).map((k) => k.id)).toEqual(['ask', 'give', 'decline', 'spurn']);
      expect(choose(c, x.id, 'ask')).toBe(true);
      expect(choicesFor(c, x).map((k) => k.id)).toEqual(['give', 'decline', 'spurn']);
      expect(c.intrigueNews!.at(-1)!.text).toContain(x.willing ? 'would have him' : 'would sooner');
    }
  });
  it('given her, brings peace and goodwill and takes her out of the house; against her will it costs', () => {
    const by = (willing: boolean) => {
      const { c, rival } = world(), x = beginSuitor(c, rival)!;
      x.willing = willing;
      const v = virtue(c), loyal = kinOf(c, 0).circle.map((k) => k.loyalty);
      expect(choose(c, x.id, 'give')).toBe(true);
      expect(houseOf(c, 0).heirs.map((h) => h.name)).toEqual(['Tam', 'Wyn']);
      expect(atTruce(c, 0, rival)).toBe(true);
      expect(c.factions[rival].favor).toBe(COURT.suitor.favor);
      expect(x.ended!.how).toBe('wed');
      expect(c.chronicle!.at(-1)!.text).toContain('Elin');
      return { v: virtue(c) - v, loyal: kinOf(c, 0).circle.reduce((n, k, i) => n + k.loyalty - loyal[i], 0) };
    };
    const glad = by(true), told = by(false);
    expect(glad.v).toBeGreaterThan(0);
    expect(told.v).toBeLessThan(0);
    expect(told.loyal).toBeLessThan(glad.loyal);
  });
  it('declined with gifts gives no offence; insulted, or left waiting, his house remembers', () => {
    const a = world(), x = beginSuitor(a.c, a.rival)!;
    a.c.factions[a.rival].favor = 2;
    expect(choose(a.c, x.id, 'decline')).toBe(true);
    expect(a.c.factions[a.rival].favor).toBe(2);
    expect(houseOf(a.c, 0).heirs.some((h) => h.name === 'Elin')).toBe(true);
    const b = world(), y = beginSuitor(b.c, b.rival)!;
    b.c.factions[b.rival].favor = 2;
    expect(choose(b.c, y.id, 'spurn')).toBe(true);
    expect(b.c.factions[b.rival].favor).toBe(0);
    const d = world(), z = beginSuitor(d.c, d.rival)!;
    d.c.factions[d.rival].favor = 2;
    for (let i = 0; i < COURT.suitor.answer; i++) season(d.c);
    expect(z.ended!.how).toBe('spurned');
    expect(d.c.factions[d.rival].favor).toBe(1);
  });
});

describe('a plot', () => {
  /** A court of six nobles, one of them sour enough to plot; no confidant either way. */
  const court = (seed = 5): { c: Campaign; key: string } => {
    const { c } = world(seed), seat = c.territories.find((t) => t.owner === 0)!.id;
    c.factions[0].nobles = ['Aldric', 'Bram', 'Cyra', 'Dunn', 'Edric', 'Faye'].map((name, i) => ({ key: `lord:${90 + i}:0`, name, female: name === 'Cyra' || name === 'Faye', town: seat, rank: 'lord' as const, leaning: 'martial' as const, mood: i === 2 ? -70 : i === 4 ? -30 : 0 }));
    kinOf(c, 0).circle = kinOf(c, 0).circle.filter((x) => x.post !== 'confidant');
    return { c, key: 'lord:92:0' };
  };
  // The nobles are reckoned afresh each season by nobles.ts; these tests step only the stories, so the court stands.
  it('begins with an angry noble, hidden among a few who are spoken of', () => {
    const { c, key } = court(), x = beginPlot(c)!;
    expect(x.nobles).toHaveLength(COURT.plot.spoken);
    expect(x.nobles![x.culprit].key).toBe(key);
    expect(x.nobles!.some((n) => n.key === 'lord:94:0')).toBe(true); // the next sourest is a likely name too
    expect(x.found).toBeUndefined();
    expect(choicesFor(c, x).map((k) => k.id.split(':')[0])).toEqual(['accuse', 'accuse', 'accuse', 'accuse', 'gifts', 'watch']);
    expect(standing(c, x)).not.toContain('Cyra');
    const calm = court(); for (const n of noblesOf(calm.c, 0)) n.mood = 0;
    expect(beginPlot(calm.c)).toBeNull(); // nobody is angry
  });
  it('is laid bare by naming the right one, and then judged: pardon or death', () => {
    const judged = (choice: string) => {
      const { c } = court(), x = beginPlot(c)!, v = virtue(c);
      expect(choose(c, x.id, `accuse:${x.culprit}`)).toBe(true);
      expect(x.found).toBe(true);
      expect(choicesFor(c, x).map((k) => k.id)).toEqual(['pardon', 'death']);
      for (let i = 0; i < 10; i++) season(c);
      expect(x.ended).toBeUndefined(); // held: there is no rising
      const others = new Map(noblesOf(c, 0).filter((n) => n.name !== 'Cyra').map((n) => [n.key, n.mood]));
      expect(choose(c, x.id, choice)).toBe(true);
      // Put to death, a lord is followed by a new one of another name (nobles.ts, newLord); the others are as they were.
      return { x, v: virtue(c) - v, others: noblesOf(c, 0).filter((n) => others.has(n.key)).reduce((s, n) => s + n.mood - others.get(n.key)!, 0), mood: noblesOf(c, 0).find((n) => n.name === 'Cyra')?.mood, lords: noblesOf(c, 0).filter((n) => n.rank === 'lord').length, c };
    };
    const pardon = judged('pardon'), death = judged('death');
    expect(pardon.x.ended!.how).toBe('pardoned');
    expect(death.x.ended!.how).toBe('executed');
    expect(pardon.v).toBeGreaterThan(0);
    expect(death.v).toBeLessThan(0);
    expect(pardon.others).toBeGreaterThan(0);
    expect(death.others).toBeLessThan(0);
    expect(pardon.mood).toBeGreaterThan(COURT.plot.cooled);
    expect(death.c.chronicle!.at(-1)!.text).toContain('Lady Cyra');
    expect(death.mood).toBeUndefined(); // she is gone, and a new lord holds her place
    expect(death.lords).toBe(pardon.lords);
  });
  it('named wrongly makes an enemy; with one left it is known', () => {
    const { c } = court(), x = beginPlot(c)!;
    const wrong = x.nobles!.map((_, i) => i).filter((i) => i !== x.culprit);
    const was = noblesOf(c, 0).find((n) => n.key === x.nobles![wrong[0]].key)!.mood;
    expect(choose(c, x.id, `accuse:${wrong[0]}`)).toBe(true);
    expect(noblesOf(c, 0).find((n) => n.key === x.nobles![wrong[0]].key)!.mood).toBe(was + COURT.plot.wronged);
    expect(x.found).toBeUndefined();
    choose(c, x.id, `accuse:${wrong[1]}`); choose(c, x.id, `accuse:${wrong[2]}`);
    expect(x.found).toBe(true);
  });
  it('is sweetened away by gifts, if they are enough', () => {
    const { c } = court(), x = beginPlot(c)!;
    for (let i = 0; i < 4; i++) expect(choose(c, x.id, 'gifts')).toBe(true);
    season(c);
    expect(x.ended!.how).toBe('nothing');
    expect(c.factions[0].heroAlive).toBe(true);
  });
  it('comes out sooner with informers or a loyal confidant, later with a disloyal one', () => {
    const outBy = (set: (c: Campaign, id: number) => void): number => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { c } = court(seed), x = beginPlot(c)!;
        set(c, x.id);
        for (let i = 0; i < COURT.plot.ripe - 1; i++) season(c);
        n += x.cleared.length;
      }
      return n;
    };
    const confidant = (loyalty: number) => (c: Campaign): void => { kinOf(c, 0).circle.push({ post: 'confidant', name: 'Isa', female: true, town: 0, loyalty, feeling: 'content', since: 0 }); };
    const bare = outBy(() => undefined);
    expect(outBy((c, id) => { choose(c, id, 'watch'); })).toBeGreaterThan(bare + 10);
    expect(outBy(confidant(100))).toBeGreaterThan(bare + 10);
    expect(outBy(confidant(0))).toBeLessThan(bare);
  });
  it('left to ripen ends in a rising: put down, or the leader is killed in it; never after it is found', () => {
    const how: Record<string, number> = {};
    for (let seed = 1; seed <= 60; seed++) {
      const { c } = court(seed), x = beginPlot(c)!;
      for (let i = 0; i < COURT.plot.ripe + 2 && !x.ended && !x.found; i++) season(c);
      const k = x.ended ? x.ended.how : 'found';
      how[k] = (how[k] ?? 0) + 1;
      if (k === 'usurped') expect(c.factions[0].heroAlive).toBe(false);
      if (k === 'foiled') expect(c.factions[0].heroAlive).toBe(true);
    }
    expect(how.usurped).toBeGreaterThan(3);
    expect(how.foiled).toBeGreaterThan(how.usurped);
    expect(how.found).toBeGreaterThan(0);
  });
});

describe('stories of the house', () => {
  it('come by chance, one at a time, never before their season, and never touch a child', () => {
    let rivals = 0, suitors = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { c } = world(seed);
      c.turn = 0;
      for (let i = 0; i < COURT.from - 1; i++) { c.turn++; expect(courtBegin(c)).toHaveLength(0); }
      for (let i = 0; i < 80; i++) {
        season(c);
        c.factions[0].heroAlive = true;
        const open = openIntrigues(c).filter((x) => x.kind === 'rival' || x.kind === 'suitor' || x.kind === 'plot');
        expect(open.length).toBeLessThanOrEqual(1);
      }
      for (const x of c.intrigues ?? []) { if (x.kind === 'rival') rivals++; if (x.kind === 'suitor') { suitors++; expect(x.cast!.daughter).not.toBe('Wyn'); } }
      expect(houseOf(c, 0).heirs.some((h) => h.name === 'Wyn')).toBe(true);
    }
    expect(rivals).toBeGreaterThan(5);
    expect(suitors).toBeGreaterThan(5);
  });
});
