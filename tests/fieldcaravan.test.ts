// A Market's caravan on the field (src/sim/fieldcaravan.ts): it walks out to the field's edge on its partner's side,
// comes back with the gold the map's caravan brings, can be caught, and the season's caravan is settled by how it went.
import { describe, expect, it } from 'vitest';
import { newCampaign } from '../src/sim/campaign';
import type { Campaign, Territory } from '../src/sim/campaign';
import { AIController } from '../src/sim/ai';
import { sendCaravans } from '../src/sim/caravans';
import { FIELD_CARAVAN, caravanAtField, caravanFromField, caravanOut, caravanSet } from '../src/sim/fieldcaravan';
import { Game } from '../src/sim/game';
import { folkOf } from '../src/sim/township';
import { run } from './helpers';

/** Two market towns of the player's, a and z, a land apart, and their caravans sent. */
function road() {
  const c = newCampaign(5, 2);
  c.fronts = []; c.armies = []; c.bands = []; c.caravans = [];
  for (const t of c.territories) if (t.owner === 0) { t.owner = -1; t.capital = -1; }
  let a!: Territory, b!: Territory, z!: Territory;
  for (const x of c.territories) for (const y of x.adj.map((id) => c.territories[id])) for (const w of y.adj.map((id) => c.territories[id]))
    if (!a && w.id !== x.id && !x.adj.includes(w.id) && x.capital < 0 && y.capital < 0 && w.capital < 0 && !x.rim && !y.rim && !w.rim) { a = x; b = y; z = w; }
  for (const t of [a, b, z]) { t.owner = 0; t.horde = false; Object.assign(folkOf(c, t.id), { men: 6, women: 6, elders: 1, children: 3 }); t.town = { at: t.id, b: [] }; }
  a.capital = 0;
  for (const t of [a, z]) t.town!.b.push(['market', 20, 20]);
  sendCaravans(c);
  return { c, a, z };
}
/** A battle at the player's town with a Market, its caravan set to be on the field. */
function field(gold = 120) {
  const g = new Game(7, [{ name: 'A', color: 1, isAI: false, civ: 'hearth' }, { name: 'B', color: 2, isAI: false, civ: 'forge' }]);
  for (const p of g.players) p.dilemmaT = 1e9;
  const tc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
  const m = g.spawnBuilding('market', 0, Math.floor(tc.x) + 5, Math.floor(tc.y) - 6, true);
  caravanSet(g, 0, { id: 77, to: 'Zedford', angle: Math.atan2(-1, 0), gold });
  return { g, m };
}

describe('the season\'s caravan comes onto the field', () => {
  it('a town whose caravan is on the road this season brings it, with its gold and its partner\'s bearing', () => {
    const { c, a, z } = road();
    const fc = caravanAtField(c, a.id)!;
    expect(fc.gold).toBeGreaterThan(0);
    expect(fc.to).toBe(c.territories[(c.caravans ?? []).find((x) => x.to === a.id)!.from].name);
    expect(Math.abs(fc.angle - Math.atan2(c.territories[(c.caravans ?? []).find((x) => x.to === a.id)!.from].y - a.y, c.territories[(c.caravans ?? []).find((x) => x.to === a.id)!.from].x - a.x))).toBeLessThan(1e-9);
    void z;
    c.caravans = [];
    expect(caravanAtField(c, a.id)).toBeUndefined();
  });
});

describe('on the field', () => {
  it('a cart leaves the Market, goes off the field at its edge, and comes home with the gold', () => {
    const { g } = field(120);
    const s = g.players[0].caravan!;
    run(g, FIELD_CARAVAN.setOff + 1);
    expect(s.state).toBe('out');
    const cart = g.units.find((u) => u.type === 'tradecart' && u.owner === 0)!;
    expect(cart.def.cart).toBe(true);
    const seen: string[] = [];
    let before = 0;
    for (let i = 0; i < 900 && s.state !== 'home'; i++) { if (s.state === 'back') before ||= g.players[0].res.gold; run(g, 1); if (!seen.includes(s.state)) seen.push(s.state); }
    expect(seen).toEqual(expect.arrayContaining(['away', 'back', 'home']));
    expect(s.state).toBe('home');
    expect(g.players[0].res.gold).toBeGreaterThanOrEqual(before + 120 - 5);
    expect(g.units.some((u) => u.type === 'tradecart')).toBe(false);
    expect(caravanOut(g, 0)).toEqual({ id: 77, state: 'home', gold: 120 });
  });

  it('caught on its way home, its gold goes to the enemy who caught it', () => {
    const { g } = field(150);
    const s = g.players[0].caravan!;
    for (let i = 0; i < 900 && s.state !== 'back'; i++) run(g, 1);
    expect(s.state).toBe('back');
    const cart = g.units.find((u) => u.type === 'tradecart')!;
    cart.hp = 1; // weak enough that the first blow takes it: this is about who gets the gold, not the chase
    const foe = g.spawnUnit('swordsman', 1, cart.x + 0.8, cart.y);
    const gold = g.players[1].res.gold;
    g.cmdTarget(1, [foe.id], cart.id);
    for (let i = 0; i < 120 && s.state === 'back'; i++) run(g, 1);
    expect(s.state).toBe('caught');
    expect(g.players[1].res.gold).toBeGreaterThanOrEqual(gold + 150);
  });

  it('the computer leaves a cart to its road', () => {
    const { g } = field();
    g.players[0].isAI = true;
    run(g, FIELD_CARAVAN.setOff + 1);
    const cart = g.units.find((u) => u.type === 'tradecart')!;
    const order = JSON.stringify(cart.order);
    new AIController(g, 0).update();
    expect(JSON.stringify(cart.order)).toBe(order);
  });
});

describe('the season\'s caravan settled by the field', () => {
  it('home on the field, it is not counted again; caught, it brings nothing; else it comes home as before', () => {
    const { c, a } = road();
    const x = (c.caravans ?? []).find((y) => y.to === a.id)!;
    expect(caravanFromField(c, a.id, { id: x.id, state: 'out', gold: 1 })).toBe('');
    expect(x.cargo.gold).toBeGreaterThan(0);
    expect(caravanFromField(c, a.id, { id: x.id, state: 'caught', gold: 1 })).toBe('caught');
    expect(x.cargo.gold).toBe(0);
    expect(caravanFromField(c, a.id, { id: x.id, state: 'home', gold: 1 })).toBe('home');
    expect((c.caravans ?? []).some((y) => y.id === x.id)).toBe(false);
    expect(caravanFromField(c, a.id, undefined)).toBe('');
  });
});

void ({} as Campaign);
