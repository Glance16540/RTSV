// The story's turn (src/sim/storyturn.ts): what befalls the whole world, the tales put before the player and how an
// answer is carried out, and how each rival people answers its own. Called here directly, a season at a time.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { MAX_FAVOR, armyAt, armySize, virtueOf } from '../src/sim/campaignbase';
import { answerTale, canAnswer, storyTurn, taleDueNow, taleNow, taleText } from '../src/sim/storyturn';
import { TALES, TALE_EVERY, TALE_FROM, TALE_SPREAD, WORLD_EVENTS, WORLD_REST } from '../src/sim/story';

/** A campaign with a tale put by hand: about the capital, rival 1 and a tribe next door. */
const put = (id: string, supplies = 30) => {
  const c = newCampaign(7, 1, 1, 'steppe');
  const cap = c.territories.find((t) => t.capital === 0)!;
  const tribe = cap.adj.map((n) => c.territories[n]).find((t) => t.owner < 0)!;
  tribe.militia = 3; tribe.horde = false;
  c.factions[0].supplies = supplies;
  c.tale = { id, land: cap.id, rival: 1, tribe: tribe.id };
  return { c, cap, tribe };
};
/** A campaign at a turn when a tale is due and no world event can begin. */
const due = (seed = 7): Campaign => {
  const c = newCampaign(seed, 1, 1, 'steppe');
  c.turn = TALE_FROM + 3;
  c.taleDue = c.turn;
  c.worldRest = 999;
  return c;
};

describe('taleText', () => {
  it('with no tale before the player, the words are as given', () => {
    const c = newCampaign(7, 1, 1, 'steppe');
    expect(taleText(c, '{land} and {rival}')).toBe('{land} and {rival}');
  });

  it('fills in the land, the rival, the tribe and the place, and capitalises "the" at the start of a sentence', () => {
    const { c, cap, tribe } = put('pilgrims');
    expect(taleText(c, 'In {land}, {tribe}.')).toBe(`In ${cap.name}, ${tribe.name}.`);
    expect(taleText(c, '{rival} came. {rival} went.')).toBe(`The ${c.factions[1].name} came. The ${c.factions[1].name} went.`);
    expect(taleText(c, 'We met {rival}.')).toBe(`We met the ${c.factions[1].name}.`);
    expect(taleText(c, 'At {place}.')).toBe('At the old place.'); // the capital has no named place
  });

  it('with no rival and no tribe, stands in words that read', () => {
    const { c } = put('pilgrims');
    c.tale = { ...c.tale!, rival: -1, tribe: -1 };
    expect(taleText(c, '{rival} and {tribe}')).toBe('a rival and the next valley'); // only "the" is capitalised
    expect(taleText(c, '{tribe} starves.')).toBe('The next valley starves.');
  });
});

describe('taleNow', () => {
  it('the tale before the player, or nothing', () => {
    const { c } = put('relics');
    expect(taleNow(c)).toBe(TALES.find((x) => x.id === 'relics'));
    c.tale = { ...c.tale!, id: 'no-such-tale' };
    expect(taleNow(c)).toBeUndefined();
    c.tale = null;
    expect(taleNow(c)).toBeUndefined();
  });
});

describe('canAnswer', () => {
  it('an answer that pays can always be given; one that costs only if it can be paid for; neither out of the player\'s phase', () => {
    const rich = put('relics', 30).c;
    expect(canAnswer(rich, 'a')).toBe(true);
    expect(canAnswer(rich, 'b')).toBe(true);
    const poor = put('relics', 1).c; // the shrine costs 3
    expect(canAnswer(poor, 'a')).toBe(false);
    expect(canAnswer(poor, 'b')).toBe(true);
    rich.phase = 'ai';
    expect(canAnswer(rich, 'a')).toBe(false);
    expect(canAnswer(rich, 'b')).toBe(false);
  });

  it('with no tale before the player there is nothing to answer', () => {
    const { c } = put('relics');
    c.tale = null;
    expect(canAnswer(c, 'a')).toBe(false);
    expect(answerTale(c, 'a')).toBe(false);
  });
});

describe('answerTale', () => {
  it('pays or is paid, moves the people\'s virtue, sets the answer down, clears the tale and tells it', () => {
    const { c, cap } = put('relics', 20);
    const tale = taleNow(c)!;
    const log = c.log.length, told = c.chronicle?.length ?? 0, v = virtueOf(c, 0);
    expect(answerTale(c, 'b')).toBe(true);
    expect(c.factions[0].supplies).toBe(20 + tale.b.supplies);
    expect(virtueOf(c, 0)).toBeLessThan(v);
    expect(c.tale).toBeNull();
    expect(c.answers).toEqual([{ id: 'relics', choice: 'b', turn: c.turn, land: cap.id, rival: 1, tribe: c.answers![0].tribe }]);
    expect(c.log.length).toBe(log + 1);
    expect(c.log.at(-1)).toBe(taleText(c, tale.b.result));
    expect(c.chronicle!.length).toBe(told + 1);
    expect(c.chronicle!.at(-1)!.text.startsWith(`${tale.title}: `)).toBe(true);
    expect(answerTale(c, 'a')).toBe(false); // settled
  });

  it('an answer it cannot afford is refused and changes nothing', () => {
    const { c } = put('relics', 1);
    const before = JSON.stringify({ tale: c.tale, supplies: c.factions[0].supplies, answers: c.answers });
    expect(answerTale(c, 'a')).toBe(false);
    expect(JSON.stringify({ tale: c.tale, supplies: c.factions[0].supplies, answers: c.answers })).toBe(before);
  });

  it('goodwill with the rival moves as the answer says, and never past its bounds', () => {
    const { c } = put('spy');
    c.factions[1].favor = MAX_FAVOR;
    expect(answerTale(c, 'a')).toBe(true); // +1
    expect(c.factions[1].favor).toBe(MAX_FAVOR);
    const e = put('exile').c;
    e.factions[1].favor = -MAX_FAVOR;
    expect(answerTale(e, 'a')).toBe(true); // -1
    expect(e.factions[1].favor).toBe(-MAX_FAVOR);
  });

  it('feeding a tribe stands its defenders down; a tribe that asks in comes under the player\'s rule', () => {
    const fed = put('hunger');
    expect(answerTale(fed.c, 'a')).toBe(true);
    expect(fed.tribe.militia).toBe(2);
    const joins = put('tribe_comes');
    expect(answerTale(joins.c, 'a')).toBe(true);
    expect(joins.tribe.owner).toBe(0);
    expect(joins.c.chronicle!.some((l) => l.text.includes(`${joins.tribe.name} came under your rule of its own will`))).toBe(true);
  });

  it('a tribe that has been taken by somebody else in the meantime does not join', () => {
    const { c, tribe } = put('tribe_comes');
    tribe.owner = 1;
    expect(answerTale(c, 'a')).toBe(true);
    expect(tribe.owner).toBe(1);
  });

  it('a company taken on joins the army in the chief town', () => {
    const { c, cap } = put('sellswords');
    const size = armySize(armyAt(c, cap.id)!);
    expect(answerTale(c, 'b')).toBe(true);
    expect(armySize(armyAt(c, cap.id)!)).toBe(size + 1);
  });
});

describe('taleDueNow', () => {
  it('is never due before TALE_FROM, and marks nothing then', () => {
    const c = newCampaign(7, 1, 1, 'steppe');
    for (c.turn = 0; c.turn < TALE_FROM; c.turn++) expect(taleDueNow(c)).toBe(false);
    expect(c.taleDue).toBeUndefined();
  });

  it('the first comes within TALE_SPREAD of TALE_FROM, and each after it within TALE_SPREAD of TALE_EVERY later', () => {
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      const c = newCampaign(seed, 1, 1, 'steppe');
      const when: number[] = [];
      for (c.turn = 0; c.turn < 60; c.turn++) if (taleDueNow(c)) when.push(c.turn);
      expect(when[0], `${seed}`).toBeGreaterThanOrEqual(TALE_FROM);
      expect(when[0], `${seed}`).toBeLessThanOrEqual(TALE_FROM + TALE_SPREAD);
      for (let i = 1; i < when.length; i++) {
        expect(when[i] - when[i - 1], `${seed}`).toBeGreaterThanOrEqual(TALE_EVERY - TALE_SPREAD);
        expect(when[i] - when[i - 1], `${seed}`).toBeLessThanOrEqual(TALE_EVERY + TALE_SPREAD);
      }
      expect(c.taleDue).toBeGreaterThanOrEqual(60);
    }
  });

  it('asked twice on the turn it fires, it fires once', () => {
    const c = due();
    expect(taleDueNow(c)).toBe(true);
    expect(taleDueNow(c)).toBe(false);
  });
});

describe('storyTurn', () => {
  it('when a tale is due, one is put before the player, about a land of theirs, and set down as asked', () => {
    const c = due();
    c.tale = null;
    storyTurn(c);
    const tale = taleNow(c)!;
    expect(tale).toBeTruthy();
    expect(tale.after).toBeUndefined(); // nothing was answered before: no thread to follow
    expect(c.territories[c.tale!.land].owner).toBe(0);
    expect(c.lastTale).toBe(tale.id);
    expect(c.asked).toEqual([tale.id]);
    expect(c.log.at(-1)).toBe(`${tale.title}: a matter is brought before you.`);
  });

  it('when no tale is due, none is put', () => {
    const c = due();
    c.taleDue = c.turn + 2;
    c.tale = null;
    storyTurn(c);
    expect(c.tale ?? null).toBeNull();
  });

  it('each rival people answers a tale of its own, moving along the scale', () => {
    const c = due();
    const was = virtueOf(c, 1);
    storyTurn(c);
    expect(virtueOf(c, 1)).not.toBe(was);
  });

  it('an earlier answer is followed by the tale it leads to, about the same land, rival and tribe', () => {
    const { c, cap, tribe } = put('exile');
    answerTale(c, 'a');
    c.turn = TALE_FROM + 3; c.taleDue = c.turn; c.worldRest = 999;
    storyTurn(c);
    expect(c.tale).toEqual({ id: 'exile_home', land: cap.id, rival: 1, tribe: tribe.id });
    expect(c.asked).toContain('exile_home');
  });

  it('a thread whose rival has fallen is dropped, and something else is told', () => {
    const { c } = put('exile');
    answerTale(c, 'a');
    c.factions[1].alive = false;
    c.turn = TALE_FROM + 3; c.taleDue = c.turn; c.worldRest = 999;
    storyTurn(c);
    expect(c.asked).toContain('exile_home'); // dropped, never to be told
    expect(c.tale?.id).not.toBe('exile_home');
    expect(taleNow(c)?.needs).not.toBe('rival'); // with no rival alive, no tale about one
  });

  it('a campaign that is over is told no tale', () => {
    const c = due();
    c.phase = 'over';
    c.tale = null;
    storyTurn(c);
    expect(c.tale ?? null).toBeNull();
  });

  it('what befalls the world ends after its last turn, and nothing new comes for WORLD_REST turns', () => {
    const c = newCampaign(7, 1, 1, 'steppe');
    c.turn = 10;
    c.taleDue = 999;
    c.world = { kind: 'winter', until: 9 };
    storyTurn(c);
    expect(c.world).toBeNull();
    expect(c.worldRest).toBe(10 + WORLD_REST);
    expect(c.log).toContain(`${WORLD_EVENTS.winter.name} is over.`);
    for (let t = 11; t < 10 + WORLD_REST; t++) { c.turn = t; storyTurn(c); expect(c.world ?? null).toBeNull(); }
  });

  it('over many seasons the world sees its events come, each lasting its turns, and tells of them', () => {
    const c = newCampaign(7, 1, 1, 'steppe');
    c.taleDue = 999;
    const seen = new Set<string>();
    for (c.turn = 0; c.turn < 120; c.turn++) {
      storyTurn(c);
      if (c.world) {
        expect(c.world.until).toBeGreaterThanOrEqual(c.turn);
        expect(c.world.until - c.turn).toBeLessThan(WORLD_EVENTS[c.world.kind].turns);
        seen.add(c.world.kind);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
    const told = Object.values(WORLD_EVENTS).filter((d) => c.chronicle?.some((l) => l.text === d.tell));
    expect(told.length).toBeGreaterThan(0);
  });
});
