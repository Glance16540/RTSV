// Those carried off in a battle fought in person are held on the map by the people who took them, by name, and can
// be got back as those carried off from a town taken on the map can (src/sim/carriedout.ts, battlecarried.ts,
// carriedhome.ts; carriedoff.ts has the rules they share).
import { describe, expect, it } from 'vitest';
import { battleCarried, cleanCarried, retake } from '../src/sim/battlecarried';
import { Campaign, Pending, battleConfig, finishBattle, moveArmy, newCampaign } from '../src/sim/campaign';
import { CARRY, carriedSeason, townFell } from '../src/sim/carriedoff';
import { carriedOut } from '../src/sim/carriedout';
import { Captive, Game } from '../src/sim/game';
import { folkOf, grown } from '../src/sim/township';
import { setups } from './helpers';

const captive = (from: number, name: string, family: string, gender: 'm' | 'f' = 'f', young = 0): Captive =>
  ({ from, name, family, gender, trait: '', trait2: '', age: 100, lifespan: 1000, ...(young ? { young: Array.from({ length: young }, () => ({} as never)) } : {}) });

const base = JSON.stringify(newCampaign(5, 2));
/** A rival that has just fought in person for a town of the player's, from a land of its own next to it. */
function world(): { c: Campaign; p: Pending; town: number; hold: number; rival: number } {
  const c: Campaign = JSON.parse(base);
  c.turn = 10;
  const rival = c.factions.find((f) => f.id > 0 && f.alive)!.id;
  const t = c.territories.find((x) => x.owner === 0)!, h = c.territories.find((x) => x.owner === rival)!;
  Object.assign(folkOf(c, t.id), { men: 10, women: 12, elders: 2, children: 5 }); delete folkOf(c, t.id).ages;
  Object.assign(folkOf(c, h.id), { men: 6, women: 6, elders: 0, children: 2 }); delete folkOf(c, h.id).ages;
  const p = { armyId: 1, from: h.id, to: t.id, attacker: rival, defender: 0, aStr: 1, dStr: 1 } as Pending;
  return { c, p, town: t.id, hold: h.id, rival };
}
const raw = [{ name: 'Ada', family: 'Harrow', gender: 'f', seasons: 100 }, { name: 'Bryn', family: 'Cole', gender: 'f', seasons: 90, young: 1 }, { name: 'Odo', family: 'Cole', gender: 'm', seasons: 120 }];

describe('those carried off in a battle', () => {
  it('the field hands back the side\'s people held by others as it ends, by name, the wild\'s marked', () => {
    const g = new Game(5, setups);
    const raider = g.spawnUnit('clubman', 1, 20, 20);
    raider.captive = captive(0, 'Ada', 'Harrow');
    const camp = g.spawnBuilding('house', 1, 30, 30, true);
    camp.captives = [captive(0, 'Bryn', 'Cole', 'f', 2), captive(1, 'Their', 'Own')];
    const lair = g.spawnBuilding('house', g.wild, 40, 40, true);
    lair.captives = [captive(0, 'Cara', 'Holt')];
    const out = g.census(0).carried!;
    expect(out.map((x) => x.name).sort()).toEqual(['Ada', 'Bryn', 'Cara']);
    expect(out.find((x) => x.name === 'Bryn')).toMatchObject({ family: 'Cole', gender: 'f', young: 2 });
    expect(out.find((x) => x.name === 'Cara')!.wild).toBe(true);
    expect(g.census(0).taken).toBe(3);
    expect(carriedOut(new Game(6, setups), 0)).toEqual({});
  });

  it('they are held in the land the army came from, by name and house, and the player is told', () => {
    const { c, p, town, hold, rival } = world();
    const x = battleCarried(c, p, raw)!;
    expect(x).toMatchObject({ by: rival, at: hold });
    expect(x.held).toMatchObject({ from: town, owner: 0, since: c.turn, women: [100, 90], men: [120], names: ['Ada', 'Bryn', 'Odo'] });
    expect(x.held.who!.map((w) => w.family)).toEqual(['Harrow', 'Cole', 'Cole']);
    expect(folkOf(c, hold).children).toBe(3); // the child borne in the camp is the taker's own
    expect(c.log.at(-1)).toContain('Ada of the Harrow house');
    expect(c.log.at(-1)).toContain(c.territories[hold].name);
    expect(c.chronicle!.at(-1)!.text).toContain('Ada');
    expect(JSON.parse(JSON.stringify(c.carried))).toEqual(c.carried);
  });

  it('a known person among them is carried off, not killed, and known again when she comes home', () => {
    const { c, p, town, hold, rival } = world();
    folkOf(c, town).notables.push({ name: 'Ada', gender: 'f', kind: 'mother', kids: 4, deed: 'raised four', turn: 1, lost: { turn: c.turn, how: 'killed or carried off' } });
    battleCarried(c, p, raw);
    const ada = folkOf(c, town).notables.find((n) => n.name === 'Ada')!;
    expect(ada.lost!.how).toMatch(/^carried off/);
    townFell(c, hold, rival, 0, town); // the player takes the land they are held in
    expect(ada.lost).toBeUndefined();
  });

  it('got back in time they come home, under their own roofs where there is room', () => {
    const { c, p, town, hold, rival } = world(), f = folkOf(c, town);
    f.households = { turn: c.turn, list: [{ at: [3, 3], family: 'Harrow', m: { name: 'Ulf', seasons: 110 } }, { at: [5, 5], family: 'Cole', m: { name: 'Wat', seasons: 100 }, f: { name: 'Meg', seasons: 90 } }] };
    battleCarried(c, p, raw);
    const before = grown(f);
    c.turn++; carriedSeason(c);
    townFell(c, hold, rival, 0, town);
    expect(c.carried ?? []).toHaveLength(0);
    expect(grown(f)).toBe(before + 3);
    expect(f.households.list[0].f).toEqual({ name: 'Ada', seasons: 100 }); // her husband's roof, at her age as of the record's turn (roofsFor adds the season since)
    expect(f.households.list[1].f!.name).toBe('Meg'); // a roof with a woman in it already takes nobody
  });

  it('not got back in time they are the taker\'s people', () => {
    const { c, p, hold } = world(), h = folkOf(c, hold), before = grown(h);
    battleCarried(c, p, raw);
    for (let i = 0; i < CARRY.seasons; i++) { c.turn++; carriedSeason(c); }
    expect(c.carried ?? []).toHaveLength(0);
    expect(grown(h)).toBe(before + 3);
  });

  it('those of the wild, of a tribe\'s town, or with nowhere of the taker\'s to hold them, are gone as before', () => {
    const a = world();
    expect(battleCarried(a.c, a.p, raw.map((x) => ({ ...x, wild: true })))).toBeNull();
    const b = world();
    expect(battleCarried(b.c, { ...b.p, defender: -1 }, raw)).toBeNull();
    const d = world();
    for (const t of d.c.territories) if (t.owner === d.rival) t.owner = 0;
    expect(battleCarried(d.c, d.p, raw)).toBeNull();
    expect(cleanCarried([{ name: '<b>', seasons: 'x' }, null, { name: 'Ada', seasons: 1e9, gender: 'q' }])).toEqual([{ name: 'Ada', gender: 'f', seasons: 400 }]);
  });

  it('those a nation led away as the town fell are struck off the count the battle wrote back', () => {
    const { c, town, hold, rival } = world(), f = folkOf(c, town);
    c.factions[rival].virtue = -90; c.factions[rival].isAI = true;
    const led = townFell(c, town, 0, rival, hold)!;
    const n = led.held.men.length + led.held.women.length;
    expect(n).toBeGreaterThan(0);
    Object.assign(f, { men: 10, women: 12, elders: 2 }); delete f.ages; // the battle writes back everyone it saw
    expect(retake(c, town, rival)).toBe(n);
    expect(f.men + f.women).toBe(22 - n);
    expect(c.carried).toHaveLength(1);
  });

  it('a siege fought in person sends its carried off to the map', () => {
    const c = newCampaign(4, 1, 1, 'hearth');
    const home = c.territories.find((t) => t.capital === 0)!, next = c.territories[home.adj[0]];
    next.owner = 1;
    c.armies.push({ id: 99, owner: 1, at: next.id, units: { infantry: 4 }, hero: false, vet: 0, moved: false });
    c.phase = 'ai';
    expect(moveArmy(c, 99, home.id)).toBe('battle');
    const cfg = battleConfig(c)!;
    const g = new Game(cfg.seed, cfg.setups, cfg.size, cfg.field, cfg.sea, true, cfg.climate ?? '');
    g.fixedAge = true; g.bornOnly = true;
    const woman = g.units.find((u) => u.owner === 0 && u.type === 'villager' && u.gender === 'f' && u.growT <= 0)!;
    const raider = g.units.find((u) => u.owner === 1 && g.isMilitary(u))!;
    raider.captive = captive(0, woman.name, woman.family ?? 'Harrow');
    g.perish(woman); // she is no longer in the town: she is led away
    finishBattle(c, true, undefined, { folk: g.census(0) });
    const held = (c.carried ?? []).find((x) => x.held.from === home.id)!;
    expect(held).toBeDefined();
    expect(held.by).toBe(1);
    expect(held.at).toBe(next.id);
    expect(held.held.names).toEqual([woman.name]);
  });
});
