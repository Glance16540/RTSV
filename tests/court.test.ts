// The leader is one person in one place (docs/DESIGN.md): where they are on the map, how they travel, what their
// presence does for a land, the armies they call, and what becomes of them when a land or a battle is lost.
import { describe, expect, it } from 'vitest';
import { Campaign, UNREST_TURNS, armyAt, battleConfig, endTurn, eventsAt, finishBattle, heroFor, moveArmy, newCampaign, reach, resolvePending } from '../src/sim/campaign';
import { callArmies, called, courtOf, courtTurn, endCall, holdCourt, leaderAt, leaderReach, moveLeader, stepToward } from '../src/sim/court';
import { HEIR_AGE, claimants, houseOf, succeed } from '../src/sim/dynasty';
import { Game } from '../src/sim/game';

/** A campaign in which the player holds their capital and the lands about it, two deep. */
const realm = () => {
  const c = newCampaign(3);
  c.factions[0].hero = { name: 'Brunhild', female: true };
  const home = c.territories.find((t) => t.capital === 0)!;
  // The map is redrawn so the test does not hang on what a seed happens to make: home borders `via` and a rival's
  // land, `via` borders `far` and the rival's land too, and nothing else touches them.
  const [via, far, rival] = c.territories.filter((t) => t.capital < 0);
  const ours = [home.id, via.id, far.id, rival.id];
  for (const t of c.territories) t.adj = t.adj.filter((n) => !ours.includes(n));
  home.adj = [via.id, rival.id]; via.adj = [home.id, far.id, rival.id]; far.adj = [via.id]; rival.adj = [home.id, via.id];
  c.barriers = []; c.lanes = [];
  const near = [via];
  for (const t of [via, far]) { t.owner = 0; t.militia = 0; }
  rival.owner = 1;
  for (const a of [...c.armies]) if (a.owner !== 0 && ours.includes(a.at)) c.armies.splice(c.armies.indexOf(a), 1);
  return { c, home, near, via, far, army: armyAt(c, home.id)! };
};
const garrison = (c: Campaign, at: number, n = 2) => { c.armies.push({ id: 900 + c.armies.length, owner: 0, at, units: { infantry: n }, hero: false, vet: 0, moved: false }); return c.armies.at(-1)!; };

describe('where the leader is', () => {
  it('a leader begins with the army in the capital, rides with it, and is at the head of whatever army is where they are', () => {
    const { c, home, via, army } = realm();
    expect(courtOf(c, 0)).toEqual({ at: home.id });
    expect(leaderAt(c, 0, home.id)).toBe(true);
    expect(army.hero).toBe(true);
    expect(moveArmy(c, army.id, via.id)).toBe('moved');
    expect(leaderAt(c, 0, via.id)).toBe(true); // they went with it
    expect(leaderAt(c, 0, home.id)).toBe(false);
    expect(courtOf(c, 0)!.moved).toBe(true);
    expect(leaderReach(c, 0)).toEqual([]); // and have travelled for this turn
    // Every rival has a court of its own by the same rule.
    for (const f of c.factions.slice(1)) expect(c.armies.find((a) => a.owner === f.id && a.hero)!.at).toBe(courtOf(c, f.id)!.at);
  });

  it('they can travel alone to a neighbouring land of their people, once a turn, and never into another\'s', () => {
    const { c, home, via, far, army } = realm();
    const foreign = reach(c, home.id).find((n) => c.territories[n].owner !== 0);
    expect(leaderReach(c, 0).sort()).toEqual(reach(c, home.id).filter((n) => c.territories[n].owner === 0).sort());
    if (foreign != null) expect(moveLeader(c, 0, foreign)).toBe(false);
    expect(moveLeader(c, 0, far.id)).toBe(false); // two lands off
    expect(moveLeader(c, 0, via.id)).toBe(true);
    expect(leaderAt(c, 0, via.id)).toBe(true);
    expect(army.hero).toBe(false); // the army stays, and has no leader now
    expect(army.at).toBe(home.id);
    expect(army.moved).toBe(false);
    expect(moveLeader(c, 0, home.id)).toBe(false); // once a turn
    courtTurn(c);
    expect(moveLeader(c, 0, far.id)).toBe(true);
    const there = garrison(c, home.id);
    courtTurn(c);
    expect(moveLeader(c, 0, via.id)).toBe(true);
    courtTurn(c);
    expect(moveLeader(c, 0, home.id)).toBe(true);
    expect(army.hero || there.hero).toBe(true); // an army where they arrive has them at its head
  });

  it('keeping to the town, they let the army march without them', () => {
    const { c, home, via, army } = realm();
    expect(holdCourt(c, 0, true)).toBe(true);
    expect(army.hero).toBe(true); // while it stands with them it is theirs to lead
    expect(moveArmy(c, army.id, via.id)).toBe('moved');
    expect(army.hero).toBe(false);
    expect(leaderAt(c, 0, home.id)).toBe(true);
    expect(courtOf(c, 0)!.moved).toBeUndefined(); // they have not stirred
    holdCourt(c, 0, false);
    expect(courtOf(c, 0)!.holds).toBeUndefined();
  });
});

describe('a battle is the leader\'s only if it is fought where they are', () => {
  const foeLand = (c: Campaign, from: number) => c.territories[from].adj.map((n) => c.territories[n]).find((t) => t.owner !== 0)!;

  it('the army they ride with brings them to the attack; an army that left them behind does not', () => {
    const a = realm();
    expect(moveArmy(a.c, a.army.id, foeLand(a.c, a.home.id).id)).toBe('battle');
    const withThem = battleConfig(a.c)!;
    expect(withThem.setups[0].leaderAway).toBeUndefined();
    expect(withThem.setups[0].bonus!.units!.warlord).toBe(1);

    const b = realm();
    holdCourt(b.c, 0, true);
    expect(moveArmy(b.c, b.army.id, foeLand(b.c, b.home.id).id)).toBe('battle');
    expect(b.c.pending!.aStr).toBeLessThan(a.c.pending!.aStr); // their weight is not in the reckoning either
    const without = battleConfig(b.c)!;
    expect(without.setups[0].leaderAway).toBe(true);
    expect(without.setups[0].bonus!.units!.warlord).toBeUndefined();
    // In that battle nobody raised is the leader: no leader unit, so no powers and no call.
    const g = new Game(without.seed, without.setups, without.size, without.field);
    const w = g.spawnUnit('warlord', 0, 30.5, 30.5);
    expect(w.hero).toBeUndefined();
    expect(g.leaderOf(0)).toBeUndefined();
    expect(g.canCall(0)).toBe(false);
    // Won or lost, they are where they were and as they were.
    finishBattle(b.c, true, { clubman: 4 }, { heroRank: 0 });
    expect(b.c.factions[0].heroAlive).toBe(true);
    expect(leaderAt(b.c, 0, b.home.id)).toBe(true);
    expect(armyAt(b.c, b.c.armies.find((x) => x.id === b.army.id)!.at)!.hero).toBe(false);
  });

  it('a town attacked while they are in it has them among its defenders, army or none', () => {
    const { c, home, via, army } = realm();
    const foe = c.armies.find((x) => x.owner === 1)!;
    // The army goes one way and the leader keeps to a border town with no garrison.
    expect(moveLeader(c, 0, via.id)).toBe(true);
    foe.at = via.adj.map((n) => c.territories[n]).find((t) => t.owner !== 0)?.id ?? foe.at;
    c.territories[foe.at].owner = 1;
    foe.moved = false;
    c.phase = 'ai';
    expect(moveArmy(c, foe.id, via.id)).toBe('battle');
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].leaderAway).toBeUndefined();
    expect(cfg.setups[0].bonus!.units!.warlord).toBe(1);
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field);
    expect(g.units.filter((u) => u.owner === 0 && u.hero).map((u) => u.name)).toEqual(['Brunhild']);
    // They fall there: the people have no leader, wherever the army is.
    finishBattle(c, true, { clubman: 1 }, { fell: true, heroRank: 0 });
    expect(c.factions[0].heroAlive).toBe(false);
    expect(courtOf(c, 0)).toBeNull();
    expect(army.hero).toBe(false);
    expect(c.log.at(-1)).toContain('fell defending');
  });

  it('a town attacked while they are elsewhere defends itself without them', () => {
    const { c, via } = realm();
    const foe = c.armies.find((x) => x.owner === 1)!;
    garrison(c, via.id);
    foe.at = via.adj.map((n) => c.territories[n]).find((t) => t.owner !== 0)?.id ?? foe.at;
    c.territories[foe.at].owner = 1;
    c.phase = 'ai';
    expect(moveArmy(c, foe.id, via.id)).toBe('battle');
    const cfg = battleConfig(c)!;
    expect(cfg.setups[0].leaderAway).toBe(true);
    expect(cfg.setups[0].bonus!.units!.warlord).toBeUndefined();
  });

  it('a leader whose town is taken with no army about them gets away to a land of their people, or is killed where none adjoins', () => {
    const a = realm();
    expect(moveLeader(a.c, 0, a.via.id)).toBe(true);
    a.via.owner = 1; // taken
    expect(leaderAt(a.c, 0, a.via.id)).toBe(false);
    expect(a.c.factions[0].heroAlive).toBe(true);
    expect(a.c.territories[courtOf(a.c, 0)!.at].owner).toBe(0);
    expect(a.c.log.at(-1)).toContain('got away');

    const b = realm();
    moveLeader(b.c, 0, b.via.id);
    courtTurn(b.c);
    moveLeader(b.c, 0, b.far.id);
    for (const n of reach(b.c, b.far.id)) b.c.territories[n].owner = 1;
    b.far.owner = 1;
    expect(courtOf(b.c, 0)).toBeNull();
    expect(b.c.factions[0].heroAlive).toBe(false);
    expect(b.c.log.at(-1)).toContain('killed');
  });
});

describe('the leader steadies the land they are in', () => {
  it('unrest never comes to a head where the leader is, though no army stands there', () => {
    const { c, via, far } = realm();
    c.events = [{ kind: 'unrest', at: via.id, turn: c.turn, until: c.turn + 1 }, { kind: 'unrest', at: far.id, turn: c.turn, until: c.turn + 1 }];
    expect(UNREST_TURNS).toBeGreaterThan(0);
    expect(moveLeader(c, 0, via.id)).toBe(true);
    c.factions[0].virtue = 0;
    endTurn(c);
    while (c.pending) resolvePending(c, 'defender');
    endTurn(c);
    while (c.pending) resolvePending(c, 'defender');
    expect(via.owner).toBe(0); // quieted by their presence
    expect(c.log.some((l) => l.includes(`in ${via.name}: the unrest there passes`))).toBe(true);
    expect(far.owner).toBe(-1); // the land they were not in rose
    expect(eventsAt(c, via.id).some((e) => e.kind === 'revolt')).toBe(false);
  });
});

describe('calling the armies', () => {
  it('finds the way through their own country only', () => {
    const { c, home, via, far } = realm();
    expect(stepToward(c, 0, far.id, home.id)).toBe(via.id);
    expect(stepToward(c, 0, home.id, home.id)).toBe(-1);
    via.owner = 1;
    const other = stepToward(c, 0, far.id, home.id);
    if (other >= 0) expect(c.territories[other].owner).toBe(0);
  });

  it('every army marches a land nearer each turn until all are with the leader, and then they move as one', () => {
    const { c, home, via, far, army } = realm();
    const second = garrison(c, far.id, 2), size = Object.values(army.units).reduce((n, v) => n + v, 0);
    expect(called(c, 0)).toEqual([second]);
    expect(callArmies(c, 0)).toBe(1);
    expect(second.at).toBe(via.id);
    expect(second.moved).toBe(true);
    expect(courtOf(c, 0)!.rally).toBe(true);
    expect(callArmies(c, 0)).toBe(0); // they have marched for this turn
    for (const a of c.armies) a.moved = false;
    courtTurn(c);
    // Arrived: the two are one army with the leader at its head, and the call is over.
    expect(c.armies.filter((a) => a.owner === 0).length).toBe(1);
    expect(Object.values(armyAt(c, home.id)!.units).reduce((n, v) => n + v, 0)).toBe(size + 2);
    expect(armyAt(c, home.id)!.hero).toBe(true);
    expect(courtOf(c, 0)!.rally).toBeUndefined();
    expect(c.log.at(-1)).toContain('gathered');
    for (const a of c.armies) a.moved = false;
    expect(moveArmy(c, armyAt(c, home.id)!.id, via.id)).toBe('moved');
    expect(leaderAt(c, 0, via.id)).toBe(true);
    expect(armyAt(c, via.id)!.hero).toBe(true);
  });

  it('the call follows the leader if they move, can be ended, and an army with no way through stays put', () => {
    const { c, home, via, far } = realm();
    const second = garrison(c, far.id);
    callArmies(c, 0);
    endCall(c, 0);
    for (const a of c.armies) a.moved = false;
    courtTurn(c);
    expect(second.at).toBe(via.id); // stood down where it had got to
    via.owner = 1; second.at = far.id;
    for (const n of reach(c, far.id)) if (n !== far.id) c.territories[n].owner = 1;
    expect(callArmies(c, 0)).toBe(0);
    expect(second.at).toBe(far.id);
    expect(leaderAt(c, 0, home.id)).toBe(true);
  });
});

describe('succession, wherever the leader fell', () => {
  it('an heir takes up the rule in the capital with no army there; a captain where their army stands', () => {
    const a = realm();
    moveArmy(a.c, a.army.id, a.via.id);
    a.army.hero = false; a.c.factions[0].heroAlive = false; // fell on the march
    houseOf(a.c, 0);
    a.c.turn += HEIR_AGE;
    const heir = claimants(a.c, 0).find((x) => x.kind === 'heir')!;
    expect(succeed(a.c, 0, heir)).toBe(true);
    expect(leaderAt(a.c, 0, a.home.id)).toBe(true);
    expect(a.army.hero).toBe(false); // the army in the field has no leader until one of them goes to the other

    const b = realm();
    moveArmy(b.c, b.army.id, b.via.id);
    b.army.hero = false; b.c.factions[0].heroAlive = false;
    b.army.vet = 2;
    const captain = claimants(b.c, 0).find((x) => x.kind === 'captain')!;
    expect(succeed(b.c, 0, captain)).toBe(true);
    expect(leaderAt(b.c, 0, b.via.id)).toBe(true);
    expect(b.army.hero).toBe(true);
    expect(heroFor(b.c, 0).name).toBe(captain.name);
  });
});
