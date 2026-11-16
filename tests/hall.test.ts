// The Hall of Judgement (src/sim/hall.ts): the leader's seat in a town.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign } from '../src/sim/campaign';
import { HALL, decreeStrength, hallAt, nobleEase, seatAt } from '../src/sim/hall';
import { hallSeason } from '../src/sim/rule';
import { MESSENGER, decreesAt, issueDecree } from '../src/sim/decrees';
import { raiseWork } from '../src/sim/townworks';
import { layTown } from '../src/sim/rivalrule';
import { folkOf } from '../src/sim/township';
import { seat } from '../src/sim/court';
import { NOBLES, noblesAt, noblesSeason, nobleWatch } from '../src/sim/nobles';

/** The player's capital and a second town of theirs, the leader in the second, both on record. */
const world = (): { c: Campaign; tid: number; other: number } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const tid = c.territories.find((t) => t.capital === 0)!.id, other = c.territories[tid].adj.find((n) => !c.territories[n].horde)!;
  c.territories[other].owner = 0;
  c.factions[0].heroAlive = true;
  seat(c, 0, other);
  c.factions[0].supplies = 50;
  for (const x of c.factions) x.age = 1; // a Hall is of the Bronze Age
  for (const id of [tid, other]) { layTown(c, id); const s = folkOf(c, id).stores; s.wood = 2000; s.stone = 2000; s.gold = 2000; s.food = 2000; }
  return { c, tid, other };
};
const stand = (c: Campaign, tid: number): void => { c.territories[tid].town!.b.push(['hall', 4, 4]); };

describe('the Hall of Judgement', () => {
  it('is raised from the map on the town\'s record, out of its own stores', () => {
    const { c, tid } = world();
    expect(raiseWork(c, 0, tid, 'hall')).toBe('');
    expect(hallAt(c, tid)).toBe(false); // begun, not yet finished
  });

  it('a decree given to its town has its full strength, the leader being elsewhere', () => {
    const { c, tid } = world();
    expect(decreeStrength(c, 0, tid, MESSENGER)).toBe(MESSENGER);
    issueDecree(c, 0, tid, 'guards');
    expect(decreesAt(c, tid)[0].strength).toBe(MESSENGER);
    c.territories[tid].decrees = [];
    stand(c, tid);
    expect(seatAt(c, 0, tid)).toBe(true);
    issueDecree(c, 0, tid, 'guards');
    expect(decreesAt(c, tid)[0].strength).toBe(1);
  });

  it('the nation\'s nobles cool the faster while it stands, and an angry lord of its town keeps his watch', () => {
    const { c, tid } = world();
    const f = folkOf(c, tid); f.men = 8; f.women = 8; f.elders = 0; delete f.ages; f.hungry = 0; delete f.hungry;
    delete c.factions[0].nobles; noblesSeason(c, 0);
    const lord = noblesAt(c, tid).find((n) => n.rank === 'lord')!;
    expect(nobleEase(c, 0)).toBe(1);
    lord.mood = -80;
    expect(nobleWatch(c, tid)).toBe(1 - NOBLES.watch);
    stand(c, tid);
    expect(nobleEase(c, 0)).toBe(HALL.ease);
    expect(nobleWatch(c, tid)).toBe(1);
    noblesSeason(c, 0);
    expect(noblesAt(c, tid).find((n) => n.rank === 'lord')!.mood).toBe(Math.round(-80 * (1 - NOBLES.ease * HALL.ease)));
  });

  it('a rival raises one in its chief town when it has none and the stores to spare, and only one', () => {
    const { c } = world();
    const chief = c.territories.find((t) => t.capital === 1)!;
    layTown(c, chief.id);
    const s = folkOf(c, chief.id).stores; s.wood = 100; s.stone = 100; s.gold = 100; s.food = 100;
    expect(hallSeason(c, 1)).toBe(false); // too poor
    s.wood = 3000; s.stone = 3000; s.gold = 3000; s.food = 3000;
    expect(hallSeason(c, 1)).toBe(true);
    expect(chief.town!.b.some((x) => x[0] === 'hall')).toBe(true);
    expect(hallSeason(c, 1)).toBe(false);
    expect(hallSeason(c, 0)).toBe(false); // the player's are the player's to raise
  });
});
