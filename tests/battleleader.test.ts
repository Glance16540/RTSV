// The leader in a battle (src/sim/battleleader.ts), its functions called directly rather than through Game's methods.
import { describe, expect, it } from 'vitest';
import {
  calledAt, callHaste, callWard, canAcclaim, canCall, champion, cmdAcclaim, cmdCall, cmdLearn, deed, fitLeader, heroOf,
  leaderBonus, leaderDefOf, leaderTypeOf, powerDue,
} from '../src/sim/battleleader';
import { CHAMPION_KILLS, rankForKills } from '../src/sim/champion';
import { UNITS } from '../src/sim/data';
import { Game } from '../src/sim/game';
import { HeroSpec, RANK_XP, cleanHero, heroBonus } from '../src/sim/hero';
import { CALLS, CALL_LASTS, CALL_RANK, CALL_REST, leaderDef, powersHeld } from '../src/sim/powers';

const made = (over: Partial<HeroSpec>): HeroSpec => cleanHero({ name: 'Edric', might: 2, guard: 2, vigour: 2, ...over }, 'hearth');
/** Two sides, the first led by a leader of the making given, standing in the open at rank `rank`. */
const field = (over: Partial<HeroSpec> = {}, rank = 0, ai = false) => {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: ai, civ: 'hearth', hero: made(over) }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
  g.players[0].dilemmaT = g.players[1].dilemmaT = 1e9;
  g.players[0].heroRank = rank;
  const l = g.spawnUnit(leaderTypeOf(g, 0), 0, 46.5, 46.5);
  g.leaders[0] = l; // as the battle's step sets it
  return { g, l };
};
const msgs = (g: Game) => g.events.filter((e) => e.t === 'msg').map((e) => (e as { text: string }).text);

describe('heroOf and leaderTypeOf', () => {
  it('the leader as the player made them; one with none is made as written, once, and kept', () => {
    const { g } = field({ name: 'Edric', calling: 'strategist' });
    expect(heroOf(g, 0)).toBe(g.players[0].hero);
    expect(heroOf(g, 0)).toMatchObject({ name: 'Edric', calling: 'strategist' });
    expect(leaderTypeOf(g, 0)).toBe('strategist');
    delete g.players[1].hero;
    const h = heroOf(g, 1);
    expect(h.name).toBeTruthy();
    expect(heroOf(g, 1)).toBe(h);
    expect(g.players[1].hero).toBe(h);
  });

  it('a leader raised from the ranks takes the field as what they fought as', () => {
    const { g } = field();
    g.players[0].hero = { ...heroOf(g, 0), fights: 'swordsman' };
    expect(leaderTypeOf(g, 0)).toBe('swordsman');
    g.players[0].hero = { ...heroOf(g, 0), fights: 'villager' }; // no soldier: a leader of their calling
    expect(leaderTypeOf(g, 0)).toBe(heroOf(g, 0).calling);
  });
});

describe('leaderBonus and fitLeader', () => {
  it('the bonus is the hero\'s making at the leader\'s rank', () => {
    const { g, l } = field({ bent: 'strength' }, 3);
    expect(l.hero!.rank).toBe(3);
    expect(leaderBonus(g, l)).toEqual(heroBonus(heroOf(g, 0), 3));
  });

  it('fitting keeps the leader as hurt as they were, on the health their making gives them', () => {
    const { g, l } = field({ vigour: 4 }, 2);
    l.hp = l.maxHp / 4;
    fitLeader(g, l);
    expect(l.maxHp).toBe(Math.round(l.def.hp * leaderBonus(g, l).hp));
    expect(l.hp / l.maxHp).toBeCloseTo(0.25, 6);
    expect(l.def).toEqual(leaderDef(UNITS[l.type], heroOf(g, 0), 2));
    expect(leaderDefOf(g, l)).toEqual(l.def);
  });
});

describe('deed', () => {
  it('an enemy that falls within the leader\'s reach is a deed; one beyond it, one of their own, or a building is not the same', () => {
    const { g, l } = field();
    const near = g.spawnUnit('villager', 1, l.x + 1, l.y);
    deed(g, 0, near);
    expect(l.hero!.xp).toBe(Math.max(1, UNITS.villager.pop));
    const far = g.spawnUnit('villager', 1, l.x + (l.def.auraRange ?? 0) + 5, l.y);
    deed(g, 0, far);
    expect(l.hero!.xp).toBe(Math.max(1, UNITS.villager.pop)); // too far to see it
    const own = g.spawnUnit('villager', 0, l.x + 1, l.y);
    deed(g, 0, own);
    expect(l.hero!.xp).toBe(Math.max(1, UNITS.villager.pop));
    const house = g.buildings.find((b) => b.owner === 1)!;
    l.x = house.x; l.y = house.y;
    deed(g, 0, house);
    expect(l.hero!.xp).toBe(Math.max(1, UNITS.villager.pop) + 2);
  });

  it('with no leader on the field, nothing is set down', () => {
    const { g, l } = field();
    g.leaders[0] = null;
    deed(g, 0, g.spawnUnit('villager', 1, l.x + 1, l.y));
    expect(l.hero!.xp).toBe(0);
  });

  it('enough deeds raise a rank: the player is told, and chooses the power it brings', () => {
    const { g, l } = field();
    l.hero!.xp = RANK_XP[1] - 1;
    deed(g, 0, g.spawnUnit('villager', 1, l.x + 1, l.y));
    expect(l.hero!.rank).toBe(1);
    expect(g.players[0].heroRank).toBe(1);
    expect(msgs(g).at(-1)).toBe(`${l.name} is now Blooded: choose what they learn.`);
    expect(powerDue(g, 0)).toBe(0);
  });

  it('a rival\'s leader chooses for themself, at once', () => {
    const { g, l } = field({}, 0, true);
    l.hero!.xp = RANK_XP[1] - 1;
    deed(g, 0, g.spawnUnit('villager', 1, l.x + 1, l.y));
    expect(l.hero!.rank).toBe(1);
    expect(powerDue(g, 0)).toBe(-1);
    expect(heroOf(g, 0).powers![0]).toBe(0);
    expect(msgs(g).at(-1)).toBe(`${l.name} is now Blooded and has learnt ${powersHeld(heroOf(g, 0), 1).at(-1)!.name}.`); // named once it has chosen
  });
});

describe('powerDue and cmdLearn', () => {
  it('nothing is due an untried leader, nor to a side with no leader', () => {
    const { g } = field();
    expect(powerDue(g, 0)).toBe(-1);
    expect(cmdLearn(g, 0, 0)).toBe(false);
    expect(powerDue(g, 1)).toBe(-1);
  });

  it('each power owed is chosen in turn; a choice that is neither of the two is refused', () => {
    const { g, l } = field({}, 3);
    expect(powerDue(g, 0)).toBe(0);
    expect(cmdLearn(g, 0, 2)).toBe(false);
    expect(cmdLearn(g, 0, -1)).toBe(false);
    expect(cmdLearn(g, 0, 1)).toBe(true);
    expect(heroOf(g, 0).powers).toEqual([1, -1, -1]);
    expect(powerDue(g, 0)).toBe(1);
    expect(cmdLearn(g, 0, 0)).toBe(true);
    expect(heroOf(g, 0).powers).toEqual([1, 0, -1]);
    expect(powerDue(g, 0)).toBe(-1);
    expect(l.def).toEqual(leaderDef(UNITS[l.type], heroOf(g, 0), 3)); // refitted to what they learnt
  });

  it('a fallen leader is owed nothing', () => {
    const { g, l } = field({}, 3);
    g.perish(l);
    expect(powerDue(g, 0)).toBe(-1);
  });
});

describe('canCall, cmdCall and calledAt', () => {
  it('a leader below Seasoned cannot raise the call', () => {
    const { g } = field({}, CALL_RANK - 1);
    expect(canCall(g, 0)).toBe(false);
    expect(cmdCall(g, 0)).toBe(false);
  });

  it('a Seasoned leader raises it: it sounds for a while, and then they must rest', () => {
    const { g, l } = field({ calling: 'warlord' }, CALL_RANK);
    expect(canCall(g, 0)).toBe(true);
    expect(cmdCall(g, 0)).toBe(true);
    expect(l.hero!.call).toBe(CALL_LASTS);
    expect(l.hero!.rest).toBe(CALL_REST);
    expect(msgs(g).at(-1)).toBe(`${l.name}: ${CALLS.warlord.name}!`);
    expect(canCall(g, 0)).toBe(false);
    expect(cmdCall(g, 0)).toBe(false);
    l.hero!.rest = 0;
    expect(canCall(g, 0)).toBe(true);
  });

  it('a leader under a roof cannot raise it', () => {
    const { g, l } = field({}, CALL_RANK);
    l.inside = g.buildings.find((b) => b.owner === 0)!.id;
    expect(canCall(g, 0)).toBe(false);
  });

  it('the call is heard within the leader\'s reach while it sounds, and nowhere else', () => {
    const { g, l } = field({ calling: 'warlord' }, CALL_RANK);
    expect(calledAt(g, 0, l.x, l.y)).toBeNull(); // not yet raised
    cmdCall(g, 0);
    expect(calledAt(g, 0, l.x + 1, l.y)).toBe('warlord');
    expect(calledAt(g, 0, l.x + (l.def.auraRange ?? 0) + 1, l.y)).toBeNull();
    expect(calledAt(g, 1, l.x, l.y)).toBeNull(); // not the other side's
    l.hero!.call = 0;
    expect(calledAt(g, 0, l.x, l.y)).toBeNull();
  });

  it('a Warlord\'s call quickens their own; a Strategist\'s wards them; neither touches the enemy', () => {
    const w = field({ calling: 'warlord' }, CALL_RANK);
    const mine = w.g.spawnUnit('swordsman', 0, w.l.x + 1, w.l.y), foe = w.g.spawnUnit('swordsman', 1, w.l.x + 1, w.l.y + 0.5);
    expect(callHaste(w.g, mine)).toBe(1);
    cmdCall(w.g, 0);
    expect(callHaste(w.g, mine)).toBe(CALLS.warlord.haste);
    expect(callHaste(w.g, foe)).toBe(1);
    expect(callWard(w.g, mine)).toBe(1); // a warlord does not ward
    const s = field({ calling: 'strategist' }, CALL_RANK);
    const ours = s.g.spawnUnit('swordsman', 0, s.l.x + 1, s.l.y);
    cmdCall(s.g, 0);
    expect(callWard(s.g, ours)).toBe(CALLS.strategist.ward);
    expect(callHaste(s.g, ours)).toBe(1);
    expect(callWard(s.g, s.g.buildings.find((b) => b.owner === 0)!)).toBe(1); // only people are warded
  });
});

describe('champion, canAcclaim and cmdAcclaim', () => {
  const blooded = (g: Game, kills: number, x = 30.5) => { const s = g.spawnUnit('swordsman', 0, x, 30.5); s.kills = kills; return s; };

  it('the champion is the soldier with the most kills, once they have made a name', () => {
    const { g } = field();
    expect(champion(g, 0)).toBeNull();
    blooded(g, CHAMPION_KILLS - 1);
    expect(champion(g, 0)).toBeNull();
    const a = blooded(g, CHAMPION_KILLS, 31.5), b = blooded(g, CHAMPION_KILLS + 2, 32.5);
    expect(champion(g, 0)).toMatchObject({ kills: CHAMPION_KILLS + 2, unit: UNITS.swordsman.name, type: 'swordsman' });
    expect(champion(g, 0)!.name).toBeTruthy();
    if (b.name) expect(champion(g, 0)!.name).toBe(b.name);
    expect(champion(g, 1)).toBeNull();
    a.merc = true; b.merc = true;
    expect(champion(g, 0)).toBeNull(); // sellswords are not counted
  });

  it('nobody can be raised while the leader lives', () => {
    const { g } = field();
    const s = blooded(g, 6);
    expect(canAcclaim(g, 0, s)).toBe(false);
    expect(cmdAcclaim(g, 0, s.id)).toBe(false);
  });

  it('when the leader falls, a soldier who has made a name is raised, with a rank for every three felled', () => {
    const { g, l } = field();
    const s = blooded(g, 7), green = blooded(g, 1, 33.5);
    g.perish(l);
    expect(canAcclaim(g, 0, green)).toBe(false);
    expect(canAcclaim(g, 1, s)).toBe(false); // not the other side's to raise
    expect(canAcclaim(g, 0, s)).toBe(true);
    expect(cmdAcclaim(g, 0, 99999)).toBe(false); // no such soldier
    expect(cmdAcclaim(g, 0, s.id)).toBe(true);
    const rank = rankForKills(7);
    expect(s.hero).toEqual({ xp: RANK_XP[rank], rank });
    expect(g.players[0]).toMatchObject({ heroRank: rank, acclaimed: true });
    expect(heroOf(g, 0).name).toBe(s.name);
    expect(heroOf(g, 0).fights).toBe('swordsman');
    expect(g.leaders[0]).toBe(s);
    expect(msgs(g).at(-1)).toMatch(/is raised on the shields to lead in /);
    // Once one is raised, nobody else can be.
    const other = blooded(g, 9, 34.5);
    expect(canAcclaim(g, 0, other)).toBe(false);
  });
});
