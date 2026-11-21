// The leader's call and the leader's road (src/sim/courtcall.ts, through court.ts): which armies come, the garrisons
// that stay, an ally's land crossed, and the risk of travelling alone by a road highwaymen sit on.
import { bareCampaign } from './helpers';
import { describe, expect, it } from 'vitest';
import { Campaign, armyAt, moveArmy } from '../src/sim/campaign';
import { armySize } from '../src/sim/campaignbase';
import { callArmies, called, courtOf, courtTurn, leaderAt, marchToward, moveLeader } from '../src/sim/court';
import { LEADER_ROAD, crossesAllied, keepsGarrison, roadBand, roadRisk } from '../src/sim/courtcall';
import type { Band } from '../src/sim/threats';

/** The player holds home - via - far in a line; a rival's land lies beside home and via; nothing else touches them. */
const realm = (seed = 3) => {
  const c = bareCampaign(seed);
  c.factions[0].hero = { name: 'Brunhild', female: true };
  const home = c.territories.find((t) => t.capital === 0)!;
  const [via, far, rival] = c.territories.filter((t) => t.capital < 0);
  const ours = [home.id, via.id, far.id, rival.id];
  for (const t of c.territories) t.adj = t.adj.filter((n) => !ours.includes(n));
  home.adj = [via.id, rival.id]; via.adj = [home.id, far.id, rival.id]; far.adj = [via.id]; rival.adj = [home.id, via.id];
  c.barriers = []; c.lanes = []; c.bands = [];
  for (const t of [via, far]) { t.owner = 0; t.militia = 0; }
  rival.owner = 1;
  for (const a of [...c.armies]) if (a.owner !== 0 && ours.includes(a.at)) c.armies.splice(c.armies.indexOf(a), 1);
  return { c, home, via, far, rival, army: armyAt(c, home.id)! };
};
const garrison = (c: Campaign, at: number, n = 2) => { c.armies.push({ id: 900 + c.armies.length, owner: 0, at, units: { infantry: n }, hero: false, vet: 0, moved: false }); return c.armies.at(-1)!; };
const raiders = (c: Campaign, at: number): Band => { const b = { id: 50 + (c.bands ?? []).length, kind: 'raiders', name: 'the Grey Band', at, strength: 3, since: 1, held: [] } as Band; (c.bands ??= []).push(b); return b; };
const highwaymen = (c: Campaign, at: number, to: number): Band => { const b = { id: 60 + (c.bands ?? []).length, kind: 'highwaymen', name: 'the Night Road', at, to, strength: 3, since: 1, held: [] } as Band; (c.bands ??= []).push(b); return b; };

describe('which armies the leader calls', () => {
  it('called by name, those armies come and no others; one that is not called is left whole where it stands, and passed through', () => {
    const { c, home, via, far } = realm();
    const mid = garrison(c, via.id, 3), back = garrison(c, far.id, 2);
    expect(callArmies(c, 0, [back.id])).toBe(1);
    // It went through the garrison's land to the leader's in the one march, and did not join it on the way.
    expect(armySize(mid)).toBe(3);
    expect(mid.at).toBe(via.id);
    expect(c.armies.some((a) => a.id === back.id)).toBe(false); // it has joined the leader's own army
    expect(leaderAt(c, 0, home.id)).toBe(true);
    expect(courtOf(c, 0)!.rally).toBeUndefined(); // all who were called have come
    expect(courtOf(c, 0)!.called).toBeUndefined();
  });
  it('the way of a called army stops only where it would not be swallowed: through a garrison\'s land to the one beyond', () => {
    const { c, home, via, far } = realm();
    garrison(c, via.id, 3);
    const back = garrison(c, far.id, 2);
    courtOf(c, 0)!.called = [back.id];
    expect(marchToward(c, 0, back, home.id)).toEqual({ to: home.id, via: via.id });
    delete courtOf(c, 0)!.called; // all are called: the two may join and march on together
    expect(marchToward(c, 0, back, home.id)).toEqual({ to: via.id });
    expect(marchToward(c, 0, back, far.id)).toBeNull();
  });
  it('with none named, an army holding a town a band has come upon stays, and the rest come; named, it comes all the same', () => {
    const { c, home, via, far } = realm();
    const mid = garrison(c, via.id, 3), back = garrison(c, far.id, 2);
    expect(keepsGarrison(c, mid)).toBe(false);
    raiders(c, via.id);
    expect(keepsGarrison(c, mid)).toBe(true);
    expect(keepsGarrison(c, back)).toBe(false);
    expect(called(c, 0).map((a) => a.id)).toEqual([back.id]);
    expect(callArmies(c, 0)).toBe(1);
    expect(mid.at).toBe(via.id);
    expect(armySize(mid)).toBe(3); // not stripped on the way
    expect(c.armies.some((a) => a.id === back.id)).toBe(false);
    // Called by name it leaves its town: that is the leader's to decide.
    for (const a of c.armies) a.moved = false;
    expect(callArmies(c, 0, [mid.id])).toBe(1);
    expect(armyAt(c, via.id)).toBeFalsy();
    expect(home.owner).toBe(0);
  });
  it('an army in a land that is not its people\'s holds no town, and a call that names nobody of theirs calls nobody', () => {
    const { c, rival, far } = realm();
    const back = garrison(c, far.id, 2);
    expect(keepsGarrison(c, { ...back, at: rival.id })).toBe(false);
    expect(callArmies(c, 0, [424242])).toBe(0);
    expect(courtOf(c, 0)!.rally).toBeUndefined();
    expect(back.at).toBe(far.id);
  });
});

describe('a called army crosses an ally\'s land', () => {
  it('it goes across the ally\'s land to its own beyond in one march, and stops nowhere in it', () => {
    const { c, home, via, far } = realm();
    const back = garrison(c, far.id, 2);
    via.owner = 1; c.ally = 1; // the land between is the sworn ally's
    expect(crossesAllied(c, 0, via.id)).toBe(true);
    expect(marchToward(c, 0, back, home.id)).toEqual({ to: home.id, via: via.id });
    expect(callArmies(c, 0)).toBe(1);
    expect(c.armies.some((a) => a.at === via.id)).toBe(false);
    expect(c.armies.some((a) => a.id === back.id)).toBe(false); // with the leader
    expect(c.pending).toBeFalsy(); // no battle: nobody was attacked
    expect(c.ally).toBe(1);
  });
  it('a truce is not an alliance: nobody crosses on it, and the army stays', () => {
    const { c, home, via, far } = realm();
    const back = garrison(c, far.id, 2);
    via.owner = 1; c.ally = -1; c.truces = [{ with: 1, until: c.turn + 9 }];
    expect(crossesAllied(c, 0, via.id)).toBe(false);
    expect(marchToward(c, 0, back, home.id)).toBeNull();
    expect(callArmies(c, 0)).toBe(0);
    expect(back.at).toBe(far.id);
  });
  it('the ally\'s armies may cross the player\'s land, and nobody a third people\'s or a wild land', () => {
    const { c, via, far } = realm();
    c.ally = 1;
    expect(crossesAllied(c, 1, via.id)).toBe(true); // the ally, through the player's
    expect(crossesAllied(c, 0, far.id)).toBe(false); // its own land is not "crossed"
    far.owner = 2;
    expect(crossesAllied(c, 0, far.id)).toBe(false);
    far.owner = -1;
    expect(crossesAllied(c, 0, far.id)).toBe(false);
  });
  it('the march itself refuses a crossing that is not by its own or an ally\'s land, or that does not end in its own', () => {
    const { c, home, via, far, rival } = realm();
    const back = garrison(c, far.id, 2);
    via.owner = 1; c.ally = -1;
    expect(moveArmy(c, back.id, home.id, { via: via.id })).toBe('invalid'); // not an ally's
    c.ally = 1;
    expect(moveArmy(c, back.id, rival.id, { via: via.id })).toBe('invalid'); // does not end in its own land
    expect(moveArmy(c, back.id, home.id, { via: rival.id })).toBe('invalid'); // not on the way: far does not touch it
    expect(moveArmy(c, back.id, home.id, { via: via.id })).toBe('moved');
  });
});

describe('a leader travelling alone by a road highwaymen sit on', () => {
  it('is set upon about four times in ten, turned back with the season\'s travel spent, sometimes wounded, never killed', () => {
    let met = 0, hurt = 0, n = 0;
    for (let seed = 1; seed <= 12; seed++) for (let turn = 1; turn <= 40; turn++) {
      const { c, home, via, army } = realm(3);
      c.seed = seed * 7919; c.turn = turn;
      c.armies.splice(c.armies.indexOf(army), 1); // alone: no army with them
      c.factions[0].heroRank = 2;
      highwaymen(c, via.id, home.id);
      expect(roadRisk(c, home.id, via.id)).toBe(LEADER_ROAD.met);
      expect(roadRisk(c, via.id, home.id)).toBe(LEADER_ROAD.met); // either way along it
      expect(moveLeader(c, 0, via.id)).toBe(true);
      n++;
      expect(c.factions[0].heroAlive).toBe(true);
      expect(courtOf(c, 0)!.moved).toBe(true);
      if (leaderAt(c, 0, via.id)) { expect(c.factions[0].heroRank).toBe(2); continue; }
      met++;
      expect(leaderAt(c, 0, home.id)).toBe(true);
      expect(c.log.at(-1)).toMatch(/^🗡️ The Night Road set upon Brunhild on the road from .* to .*, travelling with no army\. They got away (unhurt|wounded, and are a rank the less for it), and are back in /);
      if (c.factions[0].heroRank === 1) hurt++; else expect(c.factions[0].heroRank).toBe(2);
    }
    expect(met / n).toBeGreaterThan(LEADER_ROAD.met - 0.07);
    expect(met / n).toBeLessThan(LEADER_ROAD.met + 0.07);
    expect(hurt / met).toBeGreaterThan(LEADER_ROAD.hurt - 0.1);
    expect(hurt / met).toBeLessThan(LEADER_ROAD.hurt + 0.1);
  });
  it('travels untroubled where no highwaymen sit on that road, and a leader of no rank cannot be made less', () => {
    const { c, home, via, far, army } = realm();
    c.armies.splice(c.armies.indexOf(army), 1);
    highwaymen(c, via.id, far.id); // another road
    raiders(c, via.id); // a camp is not a road
    expect(roadBand(c, home.id, via.id)).toBeNull();
    expect(roadRisk(c, home.id, via.id)).toBe(0);
    expect(moveLeader(c, 0, via.id)).toBe(true);
    expect(leaderAt(c, 0, via.id)).toBe(true);
    // On the dangerous road next, with no rank to lose: whatever befalls, the rank is none and they live.
    c.factions[0].heroRank = 0;
    for (let turn = 1; turn <= 30; turn++) { c.turn = turn; delete courtOf(c, 0)!.moved; moveLeader(c, 0, leaderAt(c, 0, via.id) ? far.id : via.id); expect(c.factions[0].heroRank).toBe(0); expect(c.factions[0].heroAlive).toBe(true); }
  });
  it('riding with an army they are not set upon: the army marches and they go with it', () => {
    for (let turn = 1; turn <= 25; turn++) {
      const { c, home, via, army } = realm();
      c.turn = turn;
      highwaymen(c, via.id, home.id);
      expect(moveArmy(c, army.id, via.id)).toBe('moved');
      expect(leaderAt(c, 0, via.id)).toBe(true);
    }
  });
  it('the call marches on each season through the turn of the court, as it did', () => {
    const { c, home, far } = realm();
    const back = garrison(c, far.id, 2);
    callArmies(c, 0, [back.id]);
    for (const a of c.armies) a.moved = false;
    courtTurn(c);
    expect(c.armies.some((a) => a.id === back.id && a.at !== home.id)).toBe(false);
  });
});
