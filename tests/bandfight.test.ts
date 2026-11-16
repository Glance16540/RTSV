// An army against a band (src/sim/bandfight.ts): a battle the player can enter, and an army's own means when nobody is there.
import { describe, expect, it } from 'vitest';
import { battleConfig, finishBattle, moveArmy, newCampaign, resolvePending } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { AMBUSH, FIGHT, ambushSeason, armiesFor, attackBand, bandBattle, canAttackBand, escorting, fightByMeans, huntBands, prey, settleBandFight } from '../src/sim/bandfight';
import type { Band, BandKind } from '../src/sim/threats';
import { folkOf } from '../src/sim/township';
import { Game } from '../src/sim/game';

function world(seed = 11) {
  const c = newCampaign(seed, 2);
  c.fronts = [];
  const t = c.territories.find((x) => x.owner === 0)!;
  c.armies = c.armies.filter((a) => a.owner !== 0);
  return { c, t };
}
const band = (c: Campaign, t: Territory, strength: number, kind: BandKind = 'raiders', to?: number): Band => {
  const b: Band = { id: 900 + (c.bands?.length ?? 0), kind, name: 'the Test Men', at: t.id, ...(to === undefined ? {} : { to }), strength, since: c.turn, held: [] };
  (c.bands ??= []).push(b);
  return b;
};
const army = (c: Campaign, at: number, n: number, owner = 0, id = 801) => { const a = { id, owner, at, units: { infantry: n } as Record<string, number>, hero: false, vet: 0, moved: false }; c.armies.push(a); return a; };

describe('ordering an army against a band', () => {
  it('it must be at the band\'s place or next to it, not yet marched, and never against the marauders, who hold a land', () => {
    const { c, t } = world();
    const b = band(c, t, 4);
    const here = army(c, t.id, 5);
    expect(canAttackBand(c, here.id, b.id)).toBe(true);
    expect(armiesFor(c, b.id)).toEqual([here]);
    here.moved = true;
    expect(canAttackBand(c, here.id, b.id)).toBe(false);
    here.moved = false; here.at = t.adj[0]; c.territories[t.adj[0]].owner = 0;
    expect(canAttackBand(c, here.id, b.id)).toBe(true); // from next door
    const far = c.territories.find((x) => x.id !== t.id && !t.adj.includes(x.id) && !x.adj.some((n) => n === t.id))!;
    here.at = far.id;
    expect(canAttackBand(c, here.id, b.id)).toBe(false);
    expect(attackBand(c, here.id, b.id)).toBe('invalid');
    here.at = t.id; b.kind = 'marauders';
    expect(canAttackBand(c, here.id, b.id)).toBe(false);
    // A road can be come at from either end.
    b.kind = 'highwaymen'; b.to = t.adj[0];
    here.at = t.adj[0];
    expect(canAttackBand(c, here.id, b.id)).toBe(true);
  });

  it('for the player it opens a battle against no nation that takes no land, which can be called off', () => {
    const { c, t } = world();
    const b = band(c, t, 4), a = army(c, t.id, 5), owner = t.owner;
    expect(attackBand(c, a.id, b.id)).toBe('battle');
    expect(c.pending).toMatchObject({ armyId: a.id, to: t.id, attacker: 0, defender: -1, band: b.id, mode: 'field', dStr: 4 });
    expect(attackBand(c, a.id, b.id)).toBe('invalid'); // one battle at a time
    expect(moveArmy(c, a.id, t.adj[0])).toBe('invalid');
    c.pending = null;
    expect(t.owner).toBe(owner);
    expect(c.bands).toContain(b);
    expect(a.moved).toBe(false);
  });
});

describe('the battle the player can enter', () => {
  it('is a field battle of the army\'s own companies against the band\'s men, and the game can be made from it', () => {
    const { c, t } = world();
    const b = band(c, t, 6), a = army(c, t.id, 4);
    a.units = { infantry: 3, archers: 1 };
    attackBand(c, a.id, b.id);
    const cfg = battleConfig(c)!;
    expect(cfg).toEqual(bandBattle(c));
    expect(cfg.field).toBe(true);
    expect(cfg.humanAttacks).toBe(true);
    expect(cfg.title).toContain('the Test Men');
    expect(cfg.setups).toHaveLength(2);
    expect(cfg.setups[0].bonus!.units).toEqual({ clubman: 6, slinger: 2 });
    const theirs = cfg.setups[1].bonus!.units!;
    expect(theirs.slinger).toBe(Math.floor(6 * FIGHT.bows) * 2);
    expect(theirs.clubman).toBe((6 - Math.floor(6 * FIGHT.bows)) * 2);
    expect(cfg.setups[1].civ).not.toBe(c.factions[0].civ);
    expect(cfg.setups[0].leaderAway).toBe(true); // the leader keeps to the camp
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate);
    expect(g.units.filter((u) => u.owner === 0 && u.type === 'clubman')).toHaveLength(6);
    expect(g.units.filter((u) => u.owner === 1).length).toBeGreaterThanOrEqual(12);
    for (let i = 0; i < 200; i++) g.step();
  });

  it('won, the band is broken, its captives go home, the army is whoever lived, and no land changes hands', () => {
    const { c, t } = world();
    const b = band(c, t, 6), a = army(c, t.id, 5);
    const f = folkOf(c, t.id), women = f.women;
    b.held.push({ from: t.id, owner: 0, men: [], women: [80, 90], since: c.turn });
    attackBand(c, a.id, b.id);
    finishBattle(c, true, { clubman: 5 }); // five men left: three companies of two, the last short
    expect(c.pending).toBeNull();
    expect(c.bands).not.toContain(b);
    expect(a.units).toEqual({ infantry: 3 });
    expect(a.moved).toBe(true);
    expect(a.vet).toBe(1);
    expect(t.owner).toBe(0);
    expect(f.women).toBe(women + 2);
    expect(c.log.some((l) => l.includes('Your army has broken the Test Men') && l.includes('at the cost of 2 companies'))).toBe(true);
    expect(c.log.some((l) => l.includes('free and going home'))).toBe(true);
  });

  it('lost, the army is routed, never to its last company, and the band is the weaker for it but still there', () => {
    const { c, t } = world();
    const b = band(c, t, 6), a = army(c, t.id, 5);
    attackBand(c, a.id, b.id);
    finishBattle(c, false, {});
    expect(c.bands).toContain(b);
    expect(b.strength).toBe(5);
    expect(a.units.infantry).toBe(5 - Math.round(5 * FIGHT.rout));
    expect(c.armies).toContain(a);
    const one = world();
    const b1 = band(one.c, one.t, 9), a1 = army(one.c, one.t.id, 1);
    attackBand(one.c, a1.id, b1.id);
    expect(settleBandFight(one.c, 'defender')).toBe(false);
    expect(a1.units.infantry).toBe(1);
  });
});

describe('an army by its own means', () => {
  it('a much stronger army breaks a band and a much weaker one is beaten off; near its match it goes either way on the day', () => {
    const fight = (men: number, strength: number, seed = 11) => { const { c, t } = world(seed); const b = band(c, t, strength), a = army(c, t.id, men); const out: string[] = []; return { won: fightByMeans(c, a, b, out), a, b, c, out }; };
    const strong = fight(12, 4);
    expect(strong.won).toBe(true);
    expect(strong.c.bands).not.toContain(strong.b);
    expect(strong.a.units.infantry).toBeLessThanOrEqual(12);
    expect(strong.a.units.infantry).toBeGreaterThanOrEqual(11); // it cost little
    expect(strong.out[0]).toContain('has broken the Test Men');
    const weak = fight(3, 9);
    expect(weak.won).toBe(false);
    expect(weak.c.bands).toContain(weak.b);
    expect(weak.a.units.infantry).toBe(3 - Math.max(1, Math.round(3 * FIGHT.rout)));
    expect(weak.b.strength).toBe(9 - Math.max(1, Math.round(3 * FIGHT.bled)));
    // Forty days in one world: the same army and band, matched, on different days.
    let wins = 0;
    const { c, t } = world();
    for (let day = 1; day <= 40; day++) { c.seed = day * 7919; c.bands = []; c.armies = []; if (fightByMeans(c, army(c, t.id, 6), band(c, t, 6), [])) wins++; }
    expect(wins).toBeGreaterThan(8);
    expect(wins).toBeLessThan(32);
  });

  it('leaving a battle to the army settles it the same way', () => {
    const { c, t } = world();
    const b = band(c, t, 3), a = army(c, t.id, 10);
    attackBand(c, a.id, b.id);
    expect(resolvePending(c, 'auto')).toBe(true);
    expect(c.pending).toBeNull();
    expect(c.bands).not.toContain(b);
    expect(a.moved).toBe(true);
  });
});

describe('the computer\'s peoples hunt the bands in their lands', () => {
  it('an army of theirs strong enough, standing in their own land at the band\'s place or beside it, goes after it; a weaker one does not; the player\'s never does by itself', () => {
    const { c } = world();
    const theirs = c.territories.find((x) => x.owner === 1)!;
    c.armies = [];
    const b = band(c, theirs, 5);
    const weak = army(c, theirs.id, 6, 1, 811);
    const out: string[] = [];
    // Too weak for it, however many seasons pass.
    for (c.turn = 10; c.turn < 60; c.turn++) expect(huntBands(c, out)).toBe(0);
    weak.units.infantry = 9;
    // A band newly come is let be for a while.
    b.since = c.turn;
    expect(huntBands(c, out)).toBe(0);
    b.since = 0;
    // Strong enough, it goes after it in some season before long, not at once every time.
    let waited = 0;
    while (waited < 60 && !huntBands(c, out)) { c.turn++; waited++; }
    expect(waited).toBeLessThan(60);
    expect(c.bands).not.toContain(b);
    expect(out.join(' ')).toContain(`The ${c.factions[1].name} army has broken the Test Men`) // the English army: their name is its own adjective (naming.ts);
    expect(weak.moved).toBe(false);

    const mine = world();
    const b2 = band(mine.c, mine.t, 2);
    army(mine.c, mine.t.id, 12);
    b2.since = -50;
    for (let i = 0; i < 40; i++) { mine.c.turn++; expect(huntBands(mine.c, [])).toBe(0); }
    expect(mine.c.bands).toContain(b2);
  });

  it('a computer people\'s army ordered against a band fights at once, with no battle left pending', () => {
    const { c } = world();
    const theirs = c.territories.find((x) => x.owner === 1)!;
    c.armies = [];
    const b = band(c, theirs, 3), a = army(c, theirs.id, 9, 1, 811);
    expect(attackBand(c, a.id, b.id)).toBe('fought');
    expect(c.pending).toBeNull();
    expect(c.bands).not.toContain(b);
  });
});

describe('a band comes against an army', () => {
  it('only one it clearly outweighs, at its place or beside it; an army seeing a convoy along the road it will take on at even strength', () => {
    const { c, t } = world();
    const b = band(c, t, 5);
    const a = army(c, t.id, 5);
    expect(prey(c, b)).toEqual([]); // its match: let be
    a.units.infantry = 4;
    expect(prey(c, b)).toEqual([a]); // 5 against 4 is the odds it wants
    expect(AMBUSH.odds).toBe(1.25);
    a.units.infantry = 5;
    (c as { convoys?: unknown[] }).convoys = [{ id: 1, owner: 0, from: t.id, to: t.adj[0], road: [t.id, t.adj[0]], cargo: { food: 100, wood: 0, gold: 0, stone: 0, men: [], women: [] }, since: c.turn }];
    expect(escorting(c, a)).toBe(true);
    expect(prey(c, b)).toEqual([a]); // the convoy is worth even odds
    (c as { convoys?: unknown[] }).convoys = [];
    a.units.infantry = 2;
    const far = c.territories.find((x) => x.id !== t.id && !t.adj.includes(x.id))!;
    a.at = far.id;
    expect(prey(c, b)).toEqual([]); // out of its reach
    b.kind = 'marauders'; a.at = t.id;
    expect(ambushSeason(c, [])).toBe(0); // the marauders keep to their land
  });

  it('the player\'s army: a battle put to the player, which cannot be called off but can be entered or left to the army', () => {
    const { c, t } = world();
    const b = band(c, t, 8), a = army(c, t.id, 3);
    const out: string[] = [];
    let fell = 0;
    for (c.turn = 10; c.turn < 80 && !fell; c.turn++) fell = ambushSeason(c, out);
    c.turn--;
    expect(fell).toBe(1);
    expect(c.pending).toMatchObject({ armyId: a.id, attacker: 0, defender: -1, band: b.id, ambush: true, mode: 'field', dStr: 8 });
    expect(out.join(' ')).toContain('have fallen on your army at');
    expect(c.bandNews!.some((n) => n.kind === 'ambush' && n.owners.includes(0))).toBe(true);
    expect(ambushSeason(c, [])).toBe(0); // one battle at a time
    const cfg = battleConfig(c)!;
    expect(cfg.field).toBe(true);
    expect(cfg.title).toContain('fall on your army');
    expect(resolvePending(c, 'auto')).toBe(false); // three companies against eight: routed
    expect(c.pending).toBeNull();
    expect(a.units.infantry).toBeLessThan(3);
    expect(c.bands).toContain(b);
    expect(c.log.some((l) => l.includes('fell on your army') && l.includes('routed it'))).toBe(true);
  });

  it('fought out and won, the band that came is broken', () => {
    const { c, t } = world();
    const b = band(c, t, 8), a = army(c, t.id, 3);
    for (c.turn = 10; c.turn < 80 && !c.pending; c.turn++) ambushSeason(c, []);
    expect(c.pending!.ambush).toBe(true);
    finishBattle(c, true, { clubman: 6 });
    expect(c.bands).not.toContain(b);
    expect(a.units.infantry).toBe(3);
    expect(c.log.some((l) => l.includes('fell on your army') && l.includes('were broken'))).toBe(true);
  });

  it('a computer people\'s army is fallen on and fights at once by its own means, with no battle left pending', () => {
    const { c } = world();
    const theirs = c.territories.find((x) => x.owner === 1)!;
    c.armies = [];
    const b = band(c, theirs, 9), a = army(c, theirs.id, 3, 1, 811);
    const out: string[] = [];
    let fell = 0;
    for (c.turn = 10; c.turn < 80 && !fell; c.turn++) fell = ambushSeason(c, out);
    expect(fell).toBe(1);
    expect(c.pending).toBeNull();
    expect(a.units.infantry).toBeLessThan(3);
    expect(a.moved).toBe(false);
    expect(out.join(' ')).toContain(`fell on the ${c.factions[1].name} army`);
    expect(c.bands).toContain(b);
  });
});
