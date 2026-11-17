// What a noble remembers (src/sim/nobletemper.ts): war, their town's fortunes, the leader's heed or neglect, taxes;
// it moves where their mood settles, and fades over years.
import { describe, expect, it } from 'vitest';
import { Campaign, newCampaign } from '../src/sim/campaign';
import { noblesAt, noblesOf, noblesSeason, restOf } from '../src/sim/nobles';
import type { Noble } from '../src/sim/nobles';
import { TEMPER, temperAt, temperOf, temperSeason, warTurn } from '../src/sim/nobletemper';
import { dealWith } from '../src/sim/nobledeal';
import { seat } from '../src/sim/court';
import { TOWN_SCALE, folkOf } from '../src/sim/township';

// A town of the player's that is not their seat, with a lord.
const world = (): { c: Campaign; tid: number; lord: () => Noble } => {
  const c = newCampaign(5, 1, 1, 'hearth');
  const cap = c.territories.find((t) => t.capital === 0)!.id;
  const t = c.territories[c.territories[cap].adj[0]];
  t.owner = 0; delete t.horde;
  const f = folkOf(c, t.id); f.men = 8 * TOWN_SCALE; f.women = 8 * TOWN_SCALE; f.elders = 0; delete f.ages; delete f.hungry; // big enough to have a lord (nobles.ts lordAt)
  seat(c, 0, cap);
  c.factions[0].supplies = 50;
  delete c.factions[0].nobles; noblesSeason(c, 0);
  const tid = t.id;
  return { c, tid, lord: () => noblesAt(c, tid).find((n) => n.rank === 'lord')! };
};
const season = (c: Campaign): void => { c.turn++; noblesSeason(c, 0); temperSeason(c, 0); };
const strike = (c: Campaign, at: number): void => { (c.events ??= []).push({ kind: 'raid', at, turn: c.turn, until: c.turn } as never); };

describe('what a noble remembers', () => {
  it('a quiet year warms a lord; a band on his town sours him', () => {
    const { c, tid, lord } = world();
    lord().heeded = c.turn + 100; // heeded, for this test
    for (let i = 0; i < 3; i++) season(c);
    expect(temperAt(lord())).toBe(Math.round(TEMPER.quiet * (1 + (1 - TEMPER.fade) + (1 - TEMPER.fade) ** 2) * 10) / 10);
    const warm = temperAt(lord());
    strike(c, tid);
    season(c);
    expect(temperAt(lord())).toBeLessThan(warm);
  });

  it('a town lost sours every noble, a martial one twice as much; a town won cheers them', () => {
    const { c, tid, lord } = world();
    const n = lord();
    warTurn(c, 0);
    n.leaning = 'martial';
    expect(temperOf(c, 0, n, -1) - temperOf(c, 0, n, 0)).toBe(2 * TEMPER.lost);
    n.leaning = 'pious';
    expect(temperOf(c, 0, n, 1) - temperOf(c, 0, n, 0)).toBe(TEMPER.won);
    c.territories[tid].owner = 1;
    expect(warTurn(c, 0)).toBe(-1);
    expect(warTurn(c, 0)).toBe(0); // remembered
  });

  it('a lord the leader neither visits nor deals with grows sour from neglect; the leader\'s presence or a dealing heeds him', () => {
    const { c, tid, lord } = world();
    lord().heeded = c.turn;
    c.turn += TEMPER.neglectAfter + 1;
    const n = lord(), neglected = temperOf(c, 0, n, 0);
    n.heeded = c.turn;
    expect(temperOf(c, 0, n, 0)).toBe(neglected + TEMPER.neglect);
    n.heeded = c.turn - TEMPER.neglectAfter - 1;
    expect(dealWith(c, 0, n.key, 'summon')).toBe('');
    expect(n.heeded).toBe(c.turn);
    seat(c, 0, tid);
    expect(temperOf(c, 0, n, 0)).toBe(neglected + TEMPER.neglect + TEMPER.present);
  });

  it('a lord whose town\'s gold is taken for the nation is sore about it', () => {
    const { c, tid, lord } = world();
    const n = lord();
    n.heeded = c.turn;
    folkOf(c, tid).stores.gold = 1000;
    temperOf(c, 0, n, 0);
    const calm = temperOf(c, 0, n, 0);
    folkOf(c, tid).stores.gold = 700;
    expect(temperOf(c, 0, n, 0)).toBe(calm - TEMPER.taxed * 3);
  });

  it('the temper sets where the mood settles, within its bounds, and fades', () => {
    const { c, lord } = world();
    const n = lord();
    n.bonds = [{ kind: 'temper', turn: c.turn, rest: -55 }];
    expect(restOf(c, n)).toBe(-55);
    for (let i = 0; i < 12; i++) { c.turn++; noblesSeason(c, 0); }
    expect(noblesOf(c, 0).find((x) => x.key === n.key)!.mood).toBeLessThanOrEqual(-50);
    const now = noblesOf(c, 0).find((x) => x.key === n.key)!; // a noble is reckoned anew each season
    now.bonds = [{ kind: 'temper', turn: c.turn, rest: 1000 }];
    now.heeded = c.turn + 100;
    temperSeason(c, 0);
    expect(temperAt(now)).toBe(TEMPER.cap);
  });
});
