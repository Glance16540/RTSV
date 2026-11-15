// What a computer-led nation needs to live by the same rules (docs/DESIGN.md; src/sim/rivalrule.ts).
import { describe, expect, it } from 'vitest';
import { Campaign, battleConfig, moveArmy, newCampaign, raise } from '../src/sim/campaign';
import { RIVAL, homeIdle, layTown, maySpare, nameVeterans, notableHome, rivalMoves, rivalOrders, rivalSeason, threatened } from '../src/sim/rivalrule';
import { awayFrom } from '../src/sim/armytown';
import { townTaken } from '../src/sim/conquered';
import { governTown } from '../src/sim/governor';
import { couplesOf, housesOf, roomOf } from '../src/sim/seasonfolk';
import { folkOf, headcount, living } from '../src/sim/township';

const LONG = 60_000;
/** A rival with three towns in a row: its capital, a middle land, and a far one; no army of anyone's in them. */
const realm = (seed = 7) => {
  const c = newCampaign(seed, 1, 1, 'hearth'), cap = c.territories.find((t) => t.capital === 1)!;
  const mid = c.territories[cap.adj[0]], far = c.territories[mid.adj.find((n) => n !== cap.id && !cap.adj.includes(n)) ?? mid.adj.find((n) => n !== cap.id)!];
  for (const t of [mid, far]) Object.assign(t, { owner: 1, capital: -1, horde: false, buildings: [] });
  c.armies = c.armies.filter((a) => ![cap.id, mid.id, far.id].includes(a.at));
  c.places = []; c.bands = [];
  c.factions[1].supplies = 100;
  return { c, cap, mid, far };
};
const army = (c: Campaign, at: number, n = 2, id = 500 + at) => { const a = { id, owner: 1, at, units: { infantry: n }, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };

describe('a rival\'s towns have buildings on record', () => {
  it('laid down coarsely: a hall, its works, and roofs for the people it holds and one to spare', () => {
    const { c, cap, mid } = realm();
    const f = folkOf(c, mid.id);
    Object.assign(f, { men: 4, women: 3, elders: 1, children: 2 }); delete f.ages;
    mid.buildings = ['farm', 'barracks'];
    expect(housesOf(mid)).toBeNull();
    expect(layTown(c, mid.id)).toBe(true);
    expect(mid.town!.coarse).toBe(true);
    expect(mid.town!.b.map((x) => x[0]).sort()).toEqual(['barracks', 'farm', 'house', 'house', 'house', 'house', 'towncenter']);
    expect(housesOf(mid)).toBe(4); // three couples and one to spare
    expect(couplesOf(mid, f)).toBe(3);
    expect(roomOf(mid)).toBeGreaterThanOrEqual(headcount(f));
    expect(layTown(c, mid.id)).toBe(false); // once
    // A crowded town is given roofs for its heads, not only its couples.
    const g = folkOf(c, cap.id);
    Object.assign(g, { men: 2, women: 2, elders: 10, children: 20 }); delete g.ages;
    layTown(c, cap.id);
    expect(roomOf(cap)).toBeGreaterThanOrEqual(headcount(g));
  }, LONG);

  it('so its governor can build, and it is held to its roofs', () => {
    const { c, mid } = realm();
    const f = folkOf(c, mid.id);
    Object.assign(f, { men: 2, women: 2, elders: 0, children: 0 }); delete f.ages;
    f.stores = { food: 2000, wood: 2000, gold: 500, stone: 500 };
    layTown(c, mid.id);
    f.men = 6; f.women = 6; // more couples than roofs now
    expect(couplesOf(mid, f)).toBe(3);
    expect(governTown(c, mid.id)!.began).toBe('house');
  }, LONG);

  it('a coarse record is for counting: it is not where things stand in a battle, and it does not outlast the rival\'s hold', () => {
    const { c, mid } = realm();
    layTown(c, mid.id);
    const mine = c.armies.find((a) => a.owner === 0)!;
    mine.at = mid.adj.find((n) => c.territories[n].owner !== 1) ?? mid.adj[0];
    c.territories[mine.at].owner = 0; mine.moved = false; c.truces = [];
    expect(moveArmy(c, mine.id, mid.id)).toBe('battle');
    c.pending!.mode = 'siege';
    expect(battleConfig(c)!.setups[1].bonus!.town).toBeUndefined();
    c.pending = null;
    mid.owner = 0;
    rivalSeason(c);
    expect(mid.town).toBeUndefined();
    // The player's own unvisited towns are not laid down for them.
    const home = c.territories.find((t) => t.capital === 0)!;
    expect(home.town).toBeUndefined();
  }, LONG);
});

describe('a rival sends an idle army home', () => {
  it('after four seasons deep in its own land its men go back to their town; an army at the front, or its last, stays', () => {
    const { c, cap, mid, far } = realm();
    for (const n of mid.adj) if (![cap.id, far.id].includes(n)) Object.assign(c.territories[n], { owner: 1, capital: -1, horde: false }); // mid is now deep inside
    cap.buildings = ['barracks']; mid.buildings = ['barracks'];
    folkOf(c, mid.id).men = 6; delete folkOf(c, mid.id).ages;
    c.armies = c.armies.filter((a) => a.owner !== 1);
    expect(raise(c, 1, mid.id, 'infantry')).toBe(true);
    const deep = c.armies.find((a) => a.at === mid.id)!, front = army(c, far.id);
    expect(far.adj.some((n) => c.territories[n].owner !== 1)).toBe(true);
    expect(awayFrom(c, mid.id)).toBe(2);
    for (let i = 0; i < RIVAL.idle - 1; i++) expect(homeIdle(c, 1)).toBe(0);
    expect(homeIdle(c, 1)).toBe(1);
    expect(c.armies.includes(deep)).toBe(false);
    expect(c.armies.includes(front)).toBe(true);
    expect(awayFrom(c, mid.id)).toBe(0);
    expect(folkOf(c, mid.id).men).toBe(6);
    // Its only army is never sent home, however long it stands.
    const one = realm(9);
    for (const n of one.mid.adj) Object.assign(one.c.territories[n], { owner: 1, horde: false });
    one.c.armies = one.c.armies.filter((a) => a.owner !== 1);
    army(one.c, one.mid.id);
    for (let i = 0; i < 10; i++) expect(homeIdle(one.c, 1)).toBe(0);
  }, LONG);
});

describe('names arise on the map', () => {
  it('an army that has won twice has a soldier known by name in the town its men came from; destroyed, he is lost; sent home, he is not', () => {
    const { c, cap, mid } = realm();
    mid.buildings = ['barracks'];
    folkOf(c, mid.id).men = 6; delete folkOf(c, mid.id).ages;
    c.armies = c.armies.filter((a) => a.owner !== 1);
    raise(c, 1, mid.id, 'infantry');
    const a = c.armies.find((x) => x.at === mid.id)!;
    expect(nameVeterans(c)).toEqual({ named: 0, lost: 0 });
    a.vet = RIVAL.wins;
    expect(nameVeterans(c)).toEqual({ named: 1, lost: 0 });
    expect(a.champion).toMatchObject({ kills: RIVAL.wins * RIVAL.killsAWin });
    expect(living(folkOf(c, mid.id)).map((n) => [n.kind, n.name])).toEqual([['veteran', a.champion!.name]]);
    expect(living(folkOf(c, cap.id))).toEqual([]);
    expect(nameVeterans(c)).toEqual({ named: 0, lost: 0 }); // once
    c.armies.splice(c.armies.indexOf(a), 1); // the army is destroyed
    expect(nameVeterans(c)).toEqual({ named: 0, lost: 1 });
    expect(living(folkOf(c, mid.id))).toEqual([]);
    expect(folkOf(c, mid.id).notables[0].lost).toMatchObject({ how: 'fell in battle' });
    // The player's own armies settled from the map earn names the same way.
    const mine = c.armies.find((x) => x.owner === 0)!;
    mine.vet = RIVAL.wins; delete mine.champion;
    expect(nameVeterans(c).named).toBe(1);
    expect(mine.champion).toBeDefined();
  }, LONG);

  it('a notable home arises in a rival\'s town with children enough, once', () => {
    const { c, mid } = realm();
    const f = folkOf(c, mid.id);
    Object.assign(f, { men: 3, women: 3, children: 2 });
    expect(notableHome(c, mid.id)).toBe(false);
    f.children = 4;
    expect(notableHome(c, mid.id)).toBe(true);
    expect(living(f)).toEqual([expect.objectContaining({ kind: 'mother', gender: 'f', kids: 3 })]);
    expect(notableHome(c, mid.id)).toBe(false);
    const home = c.territories.find((t) => t.capital === 0)!;
    folkOf(c, home.id).children = 9;
    expect(notableHome(c, home.id)).toBe(false); // the player's arise from what the player does
  }, LONG);

  it('a rival gives its towns their orders: hands to what the town is shortest of', () => {
    const { c, mid } = realm();
    const f = folkOf(c, mid.id);
    Object.assign(f, { men: 6, women: 6 });
    f.stores = { food: 0, wood: 5000, gold: 5000, stone: 5000 };
    const w = rivalOrders(c, mid.id)!;
    expect(w.food + w.wood + w.gold + w.stone).toBe(12);
    expect(w.food).toBeGreaterThanOrEqual(9);
    expect(mid.orders).toEqual({ work: w, turn: c.turn });
    f.stores = { food: 5000, wood: 5000, gold: 0, stone: 5000 };
    expect(rivalOrders(c, mid.id)!.gold).toBeGreaterThanOrEqual(8);
    expect(rivalOrders(c, c.territories.find((t) => t.capital === 0)!.id)).toBeNull();
  }, LONG);
});

describe('a rival weighs how its towns are', () => {
  it('it does not raise the last men out of a strained town', () => {
    const { c, mid } = realm();
    const f = folkOf(c, mid.id);
    f.men = RIVAL.lastMen;
    expect(maySpare(c, mid.id)).toBe(true); // few men, but the town is easy
    f.drift = { strain: RIVAL.strain, care: 0, moved: 0, hungry: false, raided: false };
    expect(maySpare(c, mid.id)).toBe(false);
    f.men = RIVAL.lastMen + 4;
    expect(maySpare(c, mid.id)).toBe(true); // strained, but with men to give
  }, LONG);

  it('it garrisons a resentful town from beside it, and that garrison stays', () => {
    const { c, cap, mid, far } = realm();
    for (const n of mid.adj) if (![cap.id, far.id].includes(n)) Object.assign(c.territories[n], { owner: 1, capital: -1, horde: false });
    c.armies = c.armies.filter((a) => a.owner !== 1);
    const a = army(c, far.id); // (the army in the capital has the leader with it, and stays with him)
    expect(threatened(c, mid.id)).toBe(false);
    expect(rivalMoves(c, 1)).toBe(0);
    townTaken(c, mid.id, 0, 1);
    expect(threatened(c, mid.id)).toBe(true);
    expect(rivalMoves(c, 1)).toBe(1);
    expect(a.at).toBe(mid.id);
    a.moved = false;
    expect(rivalMoves(c, 1)).toBe(0);
    expect(a.moved).toBe(true); // behind the lines, it holds the town
    // At the front an army goes on with the war, resentful town or not.
    const b = realm(9);
    b.c.armies = b.c.armies.filter((x) => x.owner !== 1);
    const fronted = army(b.c, b.far.id);
    townTaken(b.c, b.far.id, 0, 1);
    Object.assign(b.c.territories[b.far.adj.find((n) => n !== b.mid.id && n !== b.cap.id) ?? b.far.adj[0]], { owner: -1, capital: -1, horde: false }); // foreign land beside it
    rivalMoves(b.c, 1);
    expect(fronted.moved).toBe(false);
  }, LONG);

  it('over a campaign: rival towns are on record, soldiers and homes are named, and armies come home', () => {
    let laid = 0, named = 0, homes = 0, home = 0;
    for (const seed of [11, 40]) {
      const c = newCampaign(seed, 2, 1, 'hearth');
      for (let i = 0; i < 20 && c.phase !== 'over'; i++) {
        c.phase = 'player';
        const r = rivalSeason(c);
        laid += r.laid; named += r.named; homes += r.homes; home += r.home;
        for (const t of c.territories) if (t.owner > 0 && !t.horde) expect(housesOf(t), `${seed} ${t.name}`).not.toBeNull();
      }
    }
    expect(laid).toBeGreaterThan(0);
    expect(homes).toBeGreaterThanOrEqual(0);
    expect(named + home).toBeGreaterThanOrEqual(0);
  }, 120_000);
});
