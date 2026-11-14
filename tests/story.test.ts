import { describe, expect, it } from 'vitest';
import { Campaign, answerDemand, answerTale, armyAt, armySize, canAnswer, continueAI, endTurn, moveArmy, newCampaign, placeAt, placesOf, resolvePending, taleNow, taleText } from '../src/sim/campaign';
import { LEGENDS, PLACES, PlaceKind, TALES, TALE_EVERY, TALE_FROM, epilogue } from '../src/sim/story';

const still = new WeakSet<Campaign>();
/** End the turn, paying any demand and settling any battle without fighting it. */
const turn = (c: Campaign) => {
  if (still.has(c)) { c.armies = c.armies.filter((a) => a.owner === 0); for (const f of c.factions) if (f.id > 0) f.supplies = 0; for (const t of c.territories) t.horde = false; } // the rival sits at home
  endTurn(c);
  for (let i = 0; i < 40 && c.phase === 'ai'; i++) {
    if (c.demand) answerDemand(c, true);
    else if (c.pending) resolvePending(c, 'auto');
    continueAI(c);
  }
};
/** On to the next turn on which a tale is told. */
const toTale = (c: Campaign) => { do turn(c); while (c.phase !== 'over' && (c.turn < TALE_FROM || (c.turn - TALE_FROM) % TALE_EVERY)); };
/** A quiet campaign: the rival raises no armies and keeps a truce, and no marauders take root, so the story can be followed for many turns. */
const quiet = (seed = 7) => {
  const c = newCampaign(seed, 1, 0, 'steppe');
  c.truces = [{ with: 1, until: 999 }];
  still.add(c);
  return c;
};

describe('legends that suit their places', () => {
  it('every name has legends of its own, and a place is only ever given one of them', () => {
    for (const def of Object.values(PLACES)) for (const name of def.names) expect(LEGENDS[name]?.length, name).toBeGreaterThanOrEqual(2);
    const all = Object.values(LEGENDS).flat();
    expect(new Set(all).size).toBe(all.length); // none is told of two places
    for (let seed = 1; seed <= 20; seed++) for (const p of placesOf(newCampaign(seed, 2))) expect(LEGENDS[p.name], `${seed} ${p.name}`).toContain(p.legend);
  });

  it('a campaign saved with a legend that belonged to another place is put right on loading', () => {
    const c = newCampaign(7, 2);
    const first = placesOf(c)[0];
    const old: Campaign = JSON.parse(JSON.stringify(c));
    old.places![0].legend = 'Its blades are known wherever blades are used.';
    expect(placesOf(old)[0].legend).toBe(first.legend);
  });
});

describe('tales that turn on named places', () => {
  it('there is one for every kind of place, told only to whoever holds one, and about that place', () => {
    for (const kind of Object.keys(PLACES) as PlaceKind[]) expect(TALES.filter((t) => t.place === kind).length, kind).toBe(1);
    // Holding none, none is told.
    const none = quiet();
    for (let i = 0; i < 8 && none.phase !== 'over'; i++) {
      toTale(none);
      for (const p of placesOf(none)) if (none.territories[p.at].owner === 0) { none.territories[p.at].owner = -1; }
      if (none.tale) expect(taleNow(none)!.place).toBeUndefined();
      none.tale = null;
    }
    // Holding every kind, each is told in its turn, of the land the place stands in, by its name.
    const c = quiet();
    const lands = c.territories.filter((t) => t.capital < 0).slice(0, 5);
    c.places = (Object.keys(PLACES) as PlaceKind[]).map((kind, i) => ({ at: lands[i].id, kind, name: PLACES[kind].names[0], legend: LEGENDS[PLACES[kind].names[0]][0] }));
    for (const t of lands) t.owner = 0;
    const told = new Set<string>();
    for (let i = 0; i < 30 && c.phase !== 'over'; i++) {
      toTale(c);
      for (const t of lands) t.owner = 0;
      const tale = taleNow(c);
      if (tale?.place) {
        told.add(tale.place);
        const place = placeAt(c, c.tale!.land)!;
        expect(place.kind).toBe(tale.place);
        expect(taleText(c, tale.text)).toContain(place.name);
        expect(taleText(c, tale.text + tale.a.result + tale.b.result + tale.a.label + tale.b.label)).not.toMatch(/[{}]/);
      }
      c.tale = null; // left to settle itself: no thread follows
    }
    expect(told.size).toBe(5);
  });
});

describe('tales that turn on what went before', () => {
  const put = (id: string) => {
    const c = quiet();
    const cap = c.territories.find((t) => t.capital === 0)!;
    const tribe = cap.adj.map((n) => c.territories[n]).find((t) => t.owner < 0)!;
    tribe.militia = 3; tribe.horde = false;
    c.factions[0].supplies = 30;
    c.tale = { id, land: cap.id, rival: 1, tribe: tribe.id };
    return { c, cap, tribe };
  };

  it('every thread hangs from a real answer, and each answer is set down', () => {
    for (const t of TALES.filter((x) => x.after)) {
      const from = TALES.find((x) => x.id === t.after!.id);
      expect(from, t.id).toBeTruthy();
      expect(from!.after, t.id).toBeUndefined(); // threads are one step long, so far
      if (t.needs) expect(from!.needs, t.id).toBe(t.needs); // it speaks of the same rival or tribe
    }
    const { c } = put('exile');
    expect(answerTale(c, 'a')).toBe(true);
    expect(c.answers).toEqual([{ id: 'exile', choice: 'a', turn: c.turn, land: c.territories.find((t) => t.capital === 0)!.id, rival: 1, tribe: c.answers![0].tribe }]);
  });

  it('the next telling follows the answer given, about the same people, and is told once', () => {
    for (const [first, choice, next] of [['exile', 'a', 'exile_home'], ['exile', 'b', 'exile_debt'], ['hunger', 'b', 'tribe_grudge'], ['sellswords', 'b', 'wages'], ['relics', 'a', 'cure']] as const) {
      const { c, cap, tribe } = put(first);
      answerTale(c, choice);
      toTale(c);
      expect(c.tale?.id, `${first} ${choice}`).toBe(next);
      expect(c.tale!.rival).toBe(1);
      expect(c.tale!.tribe).toBe(tribe.id);
      expect(c.tale!.land).toBe(cap.id);
      expect(taleText(c, taleNow(c)!.text + taleNow(c)!.a.result + taleNow(c)!.b.result)).not.toMatch(/[{}]/);
      c.factions[0].supplies = 30;
      expect(answerTale(c, 'a')).toBe(true);
      // Never again, and the other road is never taken.
      const other = TALES.find((x) => x.after?.id === first && x.after.choice !== choice)?.id;
      for (let i = 0; i < 6 && c.phase !== 'over'; i++) {
        toTale(c);
        expect(c.tale?.id).not.toBe(next);
        if (other) expect(c.tale?.id).not.toBe(other);
        c.tale = null;
      }
    }
    // An answer that leads nowhere leads nowhere, and so does a tale left to settle itself.
    const plain = put('exile');
    plain.c.tale = null;
    toTale(plain.c);
    expect(taleNow(plain.c)?.after).toBeUndefined();
  });

  it('a tribe that was fed comes under the player\'s rule without a blow', () => {
    const { c, tribe } = put('hunger');
    answerTale(c, 'a');
    expect(tribe.militia).toBe(2);
    toTale(c);
    expect(c.tale?.id).toBe('tribe_comes');
    const lands = c.territories.filter((t) => t.owner === 0).length;
    expect(answerTale(c, 'a')).toBe(true);
    expect(tribe.owner).toBe(0);
    expect(c.territories.filter((t) => t.owner === 0).length).toBe(lands + 1);
    expect(c.chronicle!.some((l) => l.text.includes(`${tribe.name} came under your rule of its own will`))).toBe(true);
  });

  it('a thread is dropped when the people it concerned are gone', () => {
    const { c, tribe } = put('hunger');
    answerTale(c, 'a');
    tribe.owner = 1; // someone else took the land first
    toTale(c);
    expect(c.tale?.id).not.toBe('tribe_comes');
    c.tale = null;
    tribe.owner = -1;
    toTale(c);
    expect(taleNow(c)?.id).not.toBe('tribe_comes'); // and it does not come back
  });

  it('no tale comes round a second time while there are others still untold', () => {
    const c = quiet(11);
    const seen: string[] = [];
    for (let i = 0; i < 6 && c.phase !== 'over'; i++) { toTale(c); if (c.tale) seen.push(c.tale.id); c.tale = null; }
    expect(seen.length).toBeGreaterThanOrEqual(5);
    expect(new Set(seen).size).toBe(seen.length);
    for (const t of TALES) { expect(t.a.virtue, t.id).toBeGreaterThan(0); expect(t.b.virtue, t.id).toBeLessThan(0); expect(canAnswer).toBeTruthy(); }
  });
});

describe('the chronicle of battles and the last page', () => {
  it('the player\'s battles with rival peoples are written down, won or lost', () => {
    const fight = (attackerWins: boolean, playerAttacks: boolean) => {
      const c = newCampaign(7, 1);
      c.places = [];
      const cap = c.territories.find((t) => t.capital === (playerAttacks ? 1 : 0))!;
      const from = c.territories[cap.adj[0]], target = c.territories[cap.adj[1] ?? cap.adj[0]];
      const [att, def] = playerAttacks ? [0, 1] : [1, 0];
      // An ordinary land of the defender's beside one of the attacker's.
      const land = c.territories.find((t) => t.capital < 0 && t.adj.some((n) => c.territories[n].capital < 0))!;
      const beside = c.territories[land.adj.find((n) => c.territories[n].capital < 0)!];
      land.owner = def; beside.owner = att;
      c.armies = c.armies.filter((a) => a.at !== land.id && a.at !== beside.id);
      c.armies.push({ id: 90, owner: att, at: beside.id, units: { cavalry: 6 }, hero: false, vet: 0, moved: false });
      void from; void target;
      expect(moveArmy(c, 90, land.id)).toBe('battle');
      const before = c.chronicle!.length;
      resolvePending(c, attackerWins ? 'attacker' : 'defender');
      return { text: c.chronicle!.slice(before).map((l) => l.text).join(' | '), land: land.name, foe: c.factions[1].name };
    };
    let r = fight(true, true);
    expect(r.text).toContain(`You beat the ${r.foe} at ${r.land} and took it.`);
    r = fight(false, true);
    expect(r.text).toContain(`You were thrown back from ${r.land} by the ${r.foe}.`);
    r = fight(true, false);
    expect(r.text).toContain(`The ${r.foe} beat you at ${r.land} and took it.`);
    r = fight(false, false);
    expect(r.text).toContain(`The ${r.foe} came against ${r.land} and you threw them back.`);
  });

  it('skirmishes with the local tribes are not', () => {
    const c = newCampaign(7, 1);
    c.places = [];
    const cap = c.territories.find((t) => t.capital === 0)!;
    const tribe = c.territories[cap.adj.find((n) => c.territories[n].owner < 0)!];
    const before = c.chronicle!.length;
    moveArmy(c, armyAt(c, cap.id)!.id, tribe.id);
    resolvePending(c, 'attacker');
    expect(c.chronicle!.length).toBe(before);
    expect(armySize(armyAt(c, tribe.id)!)).toBeGreaterThan(0);
  });

  it('the last page says how it ended, what the people had become, what they held and how they judged', () => {
    const c = newCampaign(7, 1, 1, 'steppe');
    expect(epilogue(c)).toEqual([]); // nothing until it is over
    const lands = c.territories.filter((t) => t.capital < 0).slice(0, 2);
    c.places = [{ at: lands[0].id, kind: 'shrine', name: 'the White Chapel', legend: LEGENDS['the White Chapel'][0] }, { at: lands[1].id, kind: 'keep', name: 'the Broken Keep', legend: LEGENDS['the Broken Keep'][0] }];
    lands[0].owner = 0;
    c.factions[0].virtue = 45;
    c.answers = [{ id: 'pilgrims', choice: 'a', turn: 3, land: 0, rival: 1, tribe: -1 }, { id: 'debts', choice: 'b', turn: 7, land: 0, rival: 1, tribe: -1 }, { id: 'spy', choice: 'a', turn: 11, land: 0, rival: 1, tribe: -1 }];
    c.turn = 23; c.phase = 'over'; c.winner = 0;
    c.factions[1].alive = false;
    const won = epilogue(c);
    expect(won[0]).toBe('After 23 turns your people were the only ones left in the land.');
    expect(won[1]).toMatch(/^They ended it Devout: a /);
    expect(won[2]).toBe('They held the White Chapel.');
    expect(won[3]).toBe('3 matters were brought before you. You gave the pious answer 2 times and the worldly one 1.');
    lands[1].owner = 0;
    expect(epilogue(c)[2]).toBe('Every place of note was theirs: the White Chapel and the Broken Keep.');
    c.winner = 1; c.factions[1].alive = true; lands[0].owner = 1; lands[1].owner = 1; c.answers = [];
    const lost = epilogue(c);
    expect(lost[0]).toBe(`After 23 turns the ${c.factions[1].name} ruled, and your people did not.`);
    expect(lost[2]).toBe('They held none of the places of note.');
    expect(lost.length).toBe(3);
  });
});
