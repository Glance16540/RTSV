// What a story leaves behind (src/sim/aftermath.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, armySize, newCampaign } from '../src/sim/campaign';
import { AFTER, aftermathSeason, callOn, callable, marksAt, marksOf, marksOfNoble, marksWith } from '../src/sim/aftermath';
import { COURT, beginPlot, beginRival, beginSuitor } from '../src/sim/courtstory';
import { HEIR_AGE, houseOf } from '../src/sim/dynasty';
import { beginKiller, beginThief, choose, intrigueSeason, openIntrigues, suspected } from '../src/sim/intrigue';
import { kinOf } from '../src/sim/kin';
import { noblesOf } from '../src/sim/nobles';
import { faithAt } from '../src/sim/townfaith';
import { rollOf } from '../src/sim/roll';
import { folkOf } from '../src/sim/township';

const base = JSON.stringify(newCampaign(5, 2));
const world = (seed = 5): { c: Campaign; at: number; rival: number } => {
  const c: Campaign = JSON.parse(base);
  c.seed = seed * 7919; c.turn = 20; c.phase = 'player';
  const t = c.territories.find((x) => x.owner === 0)!;
  Object.assign(folkOf(c, t.id), { men: 12, women: 12, elders: 2, children: 6 });
  for (const x of c.territories) if (x.owner === 0) Object.assign(folkOf(c, x.id).stores, { food: 9000, wood: 9000, gold: 9000, stone: 9000 });
  kinOf(c, 0);
  houseOf(c, 0).heirs = [{ name: 'Elin', female: true, born: c.turn - HEIR_AGE - 8 }];
  c.factions[0].nobles = ['Aldric', 'Bram', 'Cyra', 'Dunn'].map((name, i) => ({ key: `lord:${90 + i}:0`, name, female: name === 'Cyra', town: t.id, rank: 'lord' as const, leaning: 'martial' as const, mood: 0 }));
  return { c, at: t.id, rival: c.factions.find((f) => f.id > 0 && f.alive)!.id };
};
// The stories and their aftermath are stepped alone: the nobles here stand as set, as nobles.ts would re-reckon them.
const season = (c: Campaign, n = 1): void => { for (let i = 0; i < n; i++) { c.turn++; intrigueSeason(c); } };
const mood = (c: Campaign): number => noblesOf(c, 0).reduce((s, n) => s + n.mood, 0) / noblesOf(c, 0).length;
const caught = (c: Campaign, at: number, hungry = false) => {
  const x = beginThief(c, at);
  choose(c, x.id, 'watch');
  if (hungry) folkOf(c, at).stores.food = 0;
  while (x.caught === undefined) season(c);
  return x;
};

describe('what a story leaves behind', () => {
  it('a pardoned thief warms the town for years; one hanged who stole to eat sours it', () => {
    let a = world(1), x = caught(a.c, a.at);
    for (let s = 2; x.why !== 'greed' || x.again; s++) { a = world(s); x = caught(a.c, a.at); if (x.why === 'greed') { choose(a.c, x.id, 'pardon'); if (x.again) continue; break; } }
    if (!x.ended) choose(a.c, x.id, 'pardon');
    expect(marksAt(a.c, a.at).map((m) => m.kind)).toEqual(['warmed']);
    expect(marksAt(a.c, a.at)[0].text).toContain('pardoned');
    const faith = faithAt(a.c, a.at);
    season(a.c, 6);
    expect(mood(a.c)).toBeGreaterThan(15);
    expect(faithAt(a.c, a.at)).toBeGreaterThan(faith);
    season(a.c, AFTER.warmed.seasons);
    expect(marksAt(a.c, a.at)).toHaveLength(0); // it passes
    expect(marksOf(a.c).filter((m) => m.at === a.at).map((m) => m.kind)).toEqual(['warmed']); // but stays on record

    const b = world(3), y = caught(b.c, b.at, true);
    expect(y.why).toBe('hunger');
    choose(b.c, y.id, 'hang');
    expect(marksAt(b.c, b.at).map((m) => m.kind)).toEqual(['soured']);
    season(b.c, 6);
    expect(mood(b.c)).toBeLessThan(-15);
    const d = world(3), z = caught(d.c, d.at);
    choose(d.c, z.id, 'work');
    expect(marksAt(d.c, d.at)).toHaveLength(0); // an ordinary judgement leaves nothing
  });
  it('an innocent hanged for a killing leaves the town resentful for years; a killer found eases it', () => {
    const a = world(7), k = beginKiller(a.c, a.at);
    choose(a.c, k.id, `accuse:${suspected(k).find((i) => i !== k.culprit)}`);
    expect(marksAt(a.c, a.at).map((m) => m.kind)).toEqual(['resentful']);
    choose(a.c, k.id, `accuse:${k.culprit}`);
    expect(marksAt(a.c, a.at).map((m) => m.kind)).toEqual(['resentful']); // finding the killer after does not mend it
    season(a.c, 8);
    expect(mood(a.c)).toBeLessThan(-25);
    expect(marksAt(a.c, a.at)).toHaveLength(1);
    season(a.c, AFTER.resentful.seasons);
    expect(marksAt(a.c, a.at)).toHaveLength(0);
    const b = world(7), j = beginKiller(b.c, b.at);
    choose(b.c, j.id, `accuse:${j.culprit}`);
    expect(marksAt(b.c, b.at).map((m) => m.kind)).toEqual(['eased']);
    season(b.c, 4);
    expect(mood(b.c)).toBeGreaterThan(5);
  });
  it('a town that changes hands forgets', () => {
    const a = world(7), k = beginKiller(a.c, a.at);
    choose(a.c, k.id, `accuse:${suspected(k).find((i) => i !== k.culprit)}`);
    a.c.territories[a.at].owner = a.rival;
    season(a.c);
    expect(marksAt(a.c, a.at)).toHaveLength(0);
  });
  it('a defied king is a feud: no goodwill, and his people come for the player first', () => {
    const { c, rival } = world(), x = beginRival(c, rival)!;
    season(c, COURT.rival.demand);
    choose(c, x.id, 'defy');
    while (!x.ended) season(c);
    c.factions[0].heroAlive = true;
    expect(marksWith(c, rival).map((m) => m.kind)).toEqual(['feud']);
    c.factions[rival].favor = 3; c.factions[rival].angry = false;
    season(c);
    expect(c.factions[rival].favor).toBe(AFTER.feud.favor);
    expect(c.factions[rival].angry).toBe(true);
    season(c, AFTER.feud.seasons);
    c.factions[rival].favor = 2; c.factions[rival].angry = false;
    season(c);
    expect(c.factions[rival].favor).toBe(2); // it is over
    expect(c.factions[rival].angry).toBe(false);
  });
  it('a king bought off comes back when the price is spent', () => {
    let seed = 1, w = world(seed), x = beginRival(w.c, w.rival)!;
    for (;;) { season(w.c, COURT.rival.demand); choose(w.c, x.id, 'buy'); if (x.ended?.how === 'bought') break; w = world(++seed); x = beginRival(w.c, w.rival)!; }
    expect(marksWith(w.c, w.rival).map((m) => m.kind)).toEqual(['bought']);
    expect(openIntrigues(w.c).filter((i) => i.kind === 'rival')).toHaveLength(0);
    season(w.c, AFTER.bought.back + AFTER.bought.within + 1);
    const again = (w.c.intrigues ?? []).filter((i) => i.kind === 'rival');
    expect(again).toHaveLength(2);
    expect(again[1].since).toBeGreaterThanOrEqual(x.ended!.turn + AFTER.bought.back);
  });
  it('a daughter wed is an alliance that can be called on once: they send men, or refuse', () => {
    const got: Record<string, number> = {};
    for (let seed = 1; seed <= 30; seed++) {
      const { c, at, rival } = world(seed), x = beginSuitor(c, rival)!;
      c.armies = c.armies.filter((a) => a.owner !== 0);
      choose(c, x.id, 'give');
      const [m] = callable(c);
      expect(m.kind).toBe('alliance');
      const did = callOn(c, m.id)!;
      got[did] = (got[did] ?? 0) + 1;
      const army = c.armies.find((a) => a.owner === 0);
      if (did === 'sent') { expect(armySize(army!)).toBe(AFTER.alliance.companies); expect(armyAt(c, at) ?? army).toBeTruthy(); } else expect(army).toBeUndefined();
      expect(callable(c)).toHaveLength(0);
      expect(callOn(c, m.id)).toBeNull(); // once
      expect(c.intrigueNews!.at(-1)!.text).toContain('called on');
    }
    expect(got.sent).toBeGreaterThan(got.refused); // they are well disposed after a wedding
    expect(got.refused).toBeGreaterThan(0);
  });
  it('a pardoned plotter turns out the staunchest of the nobles, or plots again', () => {
    const fates: Record<string, number> = {};
    for (let seed = 1; seed <= 30; seed++) {
      const { c } = world(seed);
      noblesOf(c, 0)[2].mood = -80;
      const x = beginPlot(c)!;
      choose(c, x.id, `accuse:${x.culprit}`); choose(c, x.id, 'pardon');
      const key = x.nobles![x.culprit].key;
      expect(marksOfNoble(c, key)).toHaveLength(0); // nobody knows yet what they will become
      season(c, AFTER.pardoned.after + AFTER.pardoned.within + 1);
      const plots = (c.intrigues ?? []).filter((i) => i.kind === 'plot');
      const n = noblesOf(c, 0).find((k) => k.key === key)!;
      if (plots.length === 2) { fates.again = (fates.again ?? 0) + 1; expect(plots[1].nobles![plots[1].culprit].key).toBe(key); }
      else { fates.loyal = (fates.loyal ?? 0) + 1; expect(n.mood).toBeGreaterThanOrEqual(AFTER.pardoned.mood); expect(marksOfNoble(c, key)[0].text).toContain('staunchest'); }
    }
    expect(fates.loyal).toBeGreaterThan(5);
    expect(fates.again).toBeGreaterThan(5);
  });
  it('shows on the roll, under the town, the noble or the leader it is about', () => {
    const { c, at, rival } = world(7), k = beginKiller(c, at);
    choose(c, k.id, `accuse:${suspected(k).find((i) => i !== k.culprit)}`);
    const s = beginSuitor(c, rival)!; choose(c, s.id, 'give');
    const close = kinOf(c, 0).circle[0];
    (c.marks ??= []).push({ id: 99, kind: 'pardoned', from: 'plot', story: 0, owner: 0, since: c.turn, until: c.turn + 9, noble: `close:${close.post}:${close.name}`, name: close.name, text: `${close.name} plotted and was pardoned.`, shown: true, fate: 'loyal' });
    const roll = rollOf(c);
    expect(roll.towns.find((t) => t.id === at)!.marks.join(' ')).toContain('did not do');
    expect(roll.marks.join(' ')).toContain('married into the house');
    expect(roll.circle.find((x) => x.name === close.name)!.marks).toEqual([`${close.name} plotted and was pardoned.`]);
    expect(roll.towns.filter((t) => t.id !== at).every((t) => t.marks.length === 0)).toBe(true);
  });
  it('is plain data, and a campaign with none of it runs as before', () => {
    const { c, at } = world(7), k = beginKiller(c, at);
    choose(c, k.id, `accuse:${suspected(k).find((i) => i !== k.culprit)}`);
    const back: Campaign = JSON.parse(JSON.stringify(c));
    expect(back.marks).toEqual(c.marks);
    const bare = world();
    expect(() => aftermathSeason(bare.c)).not.toThrow();
    expect(bare.c.marks ?? []).toHaveLength(0);
  });
});
