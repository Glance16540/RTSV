// The leader's story played through with the game's own commands, not set up by hand: a leader trained and led into
// a fight, soldiers who make their names by fighting, the leader cut down, one of them raised, and on the campaign
// map a leader lost in a march and followed by an heir. Forces are placed; everything that happens to them is play.
import { describe, expect, it } from 'vitest';
import { armyAt, battleConfig, endTurn, continueAI, answerDemand, finishBattle, heroFor, moveArmy, newCampaign, raise, resolvePending } from '../src/sim/campaign';
import { CHAMPION_KILLS } from '../src/sim/champion';
import { HEIR_AGE, canSucceed, claimants, houseOf, succeed } from '../src/sim/dynasty';
import { Game, Unit } from '../src/sim/game';
import { AIController } from '../src/sim/ai';
import { RANK_XP } from '../src/sim/hero';
import { CALLS, CALL_LASTS, CALL_RANK, CALL_REST } from '../src/sim/powers';
import { run } from './helpers';

const LONG = 120_000;
const two = (hero = {}) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth', hero: { name: 'Edric', ...hero } }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
  g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
  return g;
};
const until = (g: Game, seconds: number, done: () => boolean): boolean => {
  for (let i = 0; i < seconds * 20; i++) { g.step(); if (done()) return true; }
  return done();
};

describe('the leader\'s call', () => {
  it('is theirs from Seasoned, lasts a few seconds, and must rest before it is raised again', () => {
    const g = two({ rank: CALL_RANK - 1 });
    const w = g.spawnUnit('warlord', 0, 46.5, 46.5);
    expect(g.canCall(0)).toBe(false);
    w.hero!.rank = CALL_RANK;
    expect(g.cmdCall(0)).toBe(true);
    expect(g.cmdCall(0)).toBe(false);
    run(g, 1);
    expect(g.calledAt(0, w.x + 2, w.y)).toBe('warlord');
    expect(g.calledAt(0, w.x + 30, w.y)).toBeNull();
    expect(g.calledAt(1, w.x + 2, w.y)).toBeNull();
    run(g, CALL_LASTS);
    expect(g.calledAt(0, w.x + 2, w.y)).toBeNull();
    expect(g.canCall(0)).toBe(false);
    run(g, CALL_REST - CALL_LASTS);
    expect(g.canCall(0)).toBe(true);
  });

  it('a Warlord\'s quickens the blows of those near, a Strategist\'s spares them harm', () => {
    const blows = (call: boolean) => {
      const g = two({ rank: CALL_RANK });
      const w = g.spawnUnit('warlord', 0, 46.5, 42.5);
      w.stance = 'hold'; (w.def as unknown) = { ...w.def, aura: 0 };
      const wall = g.spawnBuilding('stonewall', 1, 46, 48, true);
      const s = g.spawnUnit('swordsman', 0, 46.5, 47.2);
      g.cmdTarget(0, [s.id], wall.id);
      run(g, 1);
      if (call) g.cmdCall(0);
      run(g, CALL_LASTS - 2);
      return wall.maxHp - wall.hp;
    };
    expect(blows(true)).toBeGreaterThan(blows(false) * 1.2);
    const harm = (call: boolean) => {
      const g = two({ rank: CALL_RANK, calling: 'strategist' });
      const sage = g.spawnUnit('strategist', 0, 46.5, 42.5);
      sage.stance = 'hold'; (sage.def as unknown) = { ...sage.def, atk: 0, heal: 0, weaken: 1 };
      const victim = g.spawnUnit('knight', 0, 46.5, 46.5);
      victim.stance = 'hold'; (victim.def as unknown) = { ...victim.def, atk: 0 };
      const foe = g.spawnUnit('swordsman', 1, 47.3, 46.5);
      g.cmdTarget(1, [foe.id], victim.id);
      run(g, 1);
      if (call) expect(g.cmdCall(0)).toBe(true);
      run(g, CALL_LASTS - 2);
      return victim.maxHp - victim.hp;
    };
    expect(harm(true)).toBeLessThan(harm(false) * (CALLS.strategist.ward! + 0.12));
  });
});

describe('played through', () => {
  it('a leader is trained, falls in a fight, and a soldier who made his name in it is raised and leads on', () => {
    const g = two();
    const p = g.players[0], tc = g.buildings.find((b) => b.owner === 0)!;
    Object.assign(p.res, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
    // The town advances an age and raises its leader at the Town Center, as a player does.
    expect(g.cmdAgeUp(0, tc.id)).toBe(true);
    expect(until(g, 90, () => p.age === 1)).toBe(true);
    expect(g.cmdTrain(0, tc.id, 'warlord')).toBe(true);
    expect(until(g, 90, () => !!g.leaderOf(0))).toBe(true);
    const leader = g.leaderOf(0)!;
    expect(leader.name).toBe('Edric');
    // Soldiers are trained at a barracks and sent, with the leader, against a raiding party.
    const barracks = g.spawnBuilding('barracks', 0, Math.floor(tc.x) - 9, Math.floor(tc.y) + 3, true);
    for (let i = 0; i < 4; i++) g.spawnBuilding('house', 0, Math.floor(tc.x) - 9 + i * 3, Math.floor(tc.y) - 8, true);
    run(g, 2);
    for (let i = 0; i < 4; i++) expect(g.cmdTrain(0, barracks.id, g.trainedAs(0, 'spearman'))).toBe(true);
    expect(until(g, 200, () => g.units.filter((u) => u.owner === 0 && u.def.cls === 'infantry').length >= 4)).toBe(true);
    const men = g.units.filter((u) => u.owner === 0 && u.def.cls === 'infantry');
    const at = { x: tc.x + 12, y: tc.y + 12 };
    g.cmdMove(0, men.map((u) => u.id), at.x, at.y, true);
    g.cmdMove(0, [leader.id], at.x + 1, at.y);
    expect(until(g, 60, () => men.every((u) => Math.hypot(u.x - at.x, u.y - at.y) < 4))).toBe(true);
    g.cmdStance(0, [leader.id], 'hold');
    // A rival's work party is caught in the open with two slingers to guard it; the men are sent in.
    const party = [...Array(14).keys()].map((i) => g.spawnUnit(i < 2 ? 'slinger' : 'villager', 1, at.x + 4 + (i % 4) * 0.8, at.y + 3 + Math.floor(i / 4) * 0.8));
    const dead = () => party.filter((r) => r.dead).length;
    const made = () => men.some((u) => !u.dead && (u.kills ?? 0) >= CHAMPION_KILLS) && dead() >= 6;
    for (let k = 0; k < 12 && !made(); k++) {
      const left = party.filter((r) => !r.dead);
      g.cmdMove(0, men.filter((u) => !u.dead).map((u) => u.id), left[0].x, left[0].y, true);
      until(g, 30, made);
    }
    const felled = dead();
    expect(felled).toBeGreaterThanOrEqual(6); // the rest ran for it
    // The fight was the leader's too: its dead, felled within their reach, are among their deeds.
    expect(leader.dead).toBe(false);
    expect(g.units.filter((u) => u.owner === 0).reduce((n, u) => n + (u.kills ?? 0), 0)).toBeLessThanOrEqual(felled);
    expect(leader.hero!.xp).toBeGreaterThanOrEqual(RANK_XP[1]);
    expect(leader.hero!.rank).toBeGreaterThanOrEqual(1);
    const named = g.units.filter((u) => u.owner === 0 && !u.hero && !u.dead && (u.kills ?? 0) >= CHAMPION_KILLS);
    expect(named.length).toBeGreaterThan(0);
    expect(named.every((u) => !!u.name)).toBe(true);
    expect(g.canAcclaim(0, named[0])).toBe(false); // the leader lives
    // The leader rides off alone, and heavy horse catches them.
    g.cmdStance(0, [leader.id], 'aggressive');
    g.cmdMove(0, [leader.id], at.x - 14, at.y + 2);
    run(g, 8);
    const riders = [0, 1, 2, 3, 4, 5].map((i) => g.spawnUnit('knight', 1, leader.x + 6 + (i % 2), leader.y - 2 + i));
    g.cmdTarget(1, riders.map((r) => r.id), leader.id);
    expect(until(g, 240, () => leader.dead)).toBe(true);
    expect(p.heroFell).toBe(true);
    expect(g.leaderOf(0)).toBeUndefined();
    // Whoever has made a name by now (in the first fight, or against the knights) can be raised; a green man cannot.
    const best = g.champion(0);
    expect(best).not.toBeNull();
    if (!best) return;
    const chosen = g.units.find((u) => u.owner === 0 && u.name === best.name && (u.kills ?? 0) === best.kills)!;
    expect(g.canAcclaim(0, chosen)).toBe(true);
    expect(g.cmdAcclaim(0, chosen.id)).toBe(true);
    expect(g.leaderOf(0)).toBe(chosen);
    expect(chosen.type).toBe('spearman');
    expect(chosen.name).toBe(best.name);
    expect(g.heroOf(0).name).toBe(best.name);
    run(g, 1);
    expect(chosen.hero!.rank).toBe(1); // four felled: Blooded, and a power to choose
    expect(g.cmdLearn(0, 0)).toBe(true); // Battle cry
    expect(g.auraAt(0, chosen.x + 1, chosen.y)).toBe(1.35);
  }, LONG);

  it('a campaign battle fought out by both sides hands home who lived, what they earned and who made a name', () => {
    const c = newCampaign(3);
    c.factions[0].hero = { name: 'Brunhild', female: true };
    houseOf(c, 0);
    const home = c.territories.find((t) => t.capital === 0)!, army = armyAt(c, home.id)!;
    expect(moveArmy(c, army.id, home.adj[0])).toBe('battle');
    const cfg = battleConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.aging = false;
    const minds = g.players.map((p) => new AIController(g, p.id));
    for (const m of minds) m.setLevel(1);
    expect(g.leaderOf(0)?.name).toBe('Brunhild');
    for (let i = 0; i < 20 * 60 * 25 && g.winner < 0; i++) { g.step(); if (i % 10 === 0) for (const m of minds) m.update(); }
    const won = g.winner >= 0 && !g.hostile(g.winner, 0);
    const survivors: Record<string, number> = {};
    for (const u of g.units) if (u.owner === 0) survivors[u.type] = (survivors[u.type] ?? 0) + 1;
    const lead = g.leaderOf(0), fell = !!g.players[0].heroFell, best = g.champion(0);
    finishBattle(c, won, survivors, { heroRank: lead?.hero!.rank, fell, champion: best ?? undefined });
    if (!won) { expect(c.factions[0].heroAlive).toBe(false); return; }
    expect(c.factions[0].heroAlive).toBe(!fell && !!lead);
    if (!fell && lead) expect(heroFor(c, 0).rank).toBe(lead.hero!.rank);
    expect(army.champion?.name).toBe(best?.name);
    expect(g.units.filter((u) => u.owner === 0).reduce((n, u) => n + (u.kills ?? 0), 0)).toBeGreaterThan(0);
  }, LONG);

  it('on the campaign map a leader lost on the march is followed, in time, by their child', () => {
    const c = newCampaign(3);
    c.factions[0].hero = { name: 'Brunhild', female: true, bent: 'armour', might: 0, guard: 5, vigour: 1 };
    const turn = () => { endTurn(c); for (let i = 0; i < 60 && c.phase === 'ai'; i++) { if (c.demand) answerDemand(c, true); else if (c.pending) resolvePending(c, 'auto'); continueAI(c); } };
    const home = c.territories.find((t) => t.capital === 0)!;
    // The leader marches out against the strongest neighbour and the battle is left to settle itself, turn after turn, until it is lost.
    for (let i = 0; i < 12 && c.factions[0].heroAlive && c.factions[0].alive; i++) {
      const army = c.armies.find((a) => a.owner === 0 && a.hero);
      if (army && !army.moved) {
        const foes = c.territories[army.at].adj.map((id) => c.territories[id]).filter((t) => t.owner !== 0).sort((a, b) => b.militia - a.militia);
        if (foes[0] && moveArmy(c, army.id, foes[0].id) === 'battle') resolvePending(c, 'auto');
      }
      turn();
    }
    if (c.factions[0].heroAlive || !c.factions[0].alive) return; // this world let them live, or took everything: nothing to follow
    expect(c.log.some((l) => /fell|destroyed|lost/i.test(l)) || !c.armies.some((a) => a.owner === 0 && a.hero)).toBe(true);
    // The years pass; an army is kept at home for the heir to ride to.
    for (let i = 0; i < HEIR_AGE + 2 && c.factions[0].alive && !claimants(c, 0).some((x) => x.kind === 'heir'); i++) turn();
    if (!c.factions[0].alive) return;
    c.factions[0].supplies += 10;
    if (!armyAt(c, home.id) && home.owner === 0) raise(c, 0, home.id, 'infantry');
    const heir = claimants(c, 0).find((x) => x.kind === 'heir' && canSucceed(c, 0, x));
    if (!heir) return;
    expect(heir.name).toContain('of Brunhild');
    expect(succeed(c, 0, heir)).toBe(true);
    expect(heroFor(c, 0)).toMatchObject({ name: heir.name, bent: 'armour', guard: 5 });
    expect(c.armies.some((a) => a.owner === 0 && a.hero)).toBe(true);
    expect(c.chronicle!.some((l) => l.text.includes('takes up the rule'))).toBe(true);
  }, LONG);
});
