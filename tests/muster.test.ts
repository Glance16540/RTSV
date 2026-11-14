// A soldier costs a person, and nobody ages up inside a campaign battle (docs/DESIGN.md, step 1).
import { describe, expect, it } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Building, Game, Unit } from '../src/sim/game';
import { WOMAN_ATK, mustering, needsPerson } from '../src/sim/muster';
import { UNITS } from '../src/sim/data';
import { run, setups, spot, villagers } from './helpers';

/** A quiet town with a barracks, plenty in store, and no computer player moving anything. */
const town = (seed = 7) => {
  const g = new Game(seed, setups);
  const p = g.players[0], tc = g.buildings.find((b) => b.owner === 0)!;
  Object.assign(p.res, { food: 5000, wood: 5000, gold: 5000, stone: 5000 });
  p.popCap = 200;
  const at = spot(g, 'barracks', 0);
  const barracks = g.spawnBuilding('barracks', 0, at.cx, at.cy, true);
  const soldier = g.trainedAs(0, 'clubman');
  const army = () => g.units.filter((u) => u.owner === 0 && g.isMilitary(u));
  const said = (text: RegExp) => g.events.some((e) => e.t === 'msg' && e.player === 0 && text.test(e.text));
  return { g, p, tc, barracks, soldier, army, said };
};
const menOf = (g: Game) => villagers(g, 0).filter((v) => v.gender === 'm');
const nearest = (vs: Unit[], b: Building) => [...vs].sort((x, y) => Math.hypot(x.x - b.x, x.y - b.y) - Math.hypot(y.x - b.x, y.y - b.y))[0];

describe('a soldier costs a person', () => {
  it('the nearest idle man walks in, and only then does the training turn him into the soldier', () => {
    const { g, barracks, soldier, army } = town();
    const before = villagers(g, 0).length;
    const idle = menOf(g).filter((v) => !v.order);
    const who = nearest(idle, barracks), name = who.name;
    expect(g.cmdTrain(0, barracks.id, soldier)).toBe(true);
    expect(who.order?.t).toBe('enlist');
    expect(mustering(g, who)).toBe(true);
    // Until he is through the door, no time is counted.
    const q = barracks.queue[0];
    run(g, 1);
    if (!q.in) expect(q.t).toBe(0);
    run(g, 60);
    expect(army().length).toBe(1);
    expect(army()[0].name).toBe(name); // the same person, in arms
    expect(who.dead).toBe(true); // the villager he was is no more
    expect(villagers(g, 0).length).toBe(before - 1);
    expect(g.players[0].pop).toBe(g.units.filter((u) => u.owner === 0).reduce((n, u) => n + u.def.pop, 0));
  });

  it('a man with nothing to do is taken before a nearer man at work', () => {
    const { g, barracks, soldier } = town();
    const men = menOf(g);
    const near = nearest(men, barracks);
    const tree = g.resources.find((r) => r.type === 'tree')!;
    g.cmdTarget(0, [near.id], tree.id);
    expect(near.order?.t).toBe('gather');
    expect(g.cmdTrain(0, barracks.id, soldier)).toBe(true);
    expect(near.order?.t).toBe('gather');
    expect(men.some((m) => m !== near && m.order?.t === 'enlist')).toBe(true);
    // With every man at work, the nearest of them is called from it.
    for (const m of men) if (m.order?.t !== 'enlist') g.cmdTarget(0, [m.id], tree.id);
    const working = men.filter((m) => m.order?.t === 'gather');
    expect(g.cmdTrain(0, barracks.id, soldier)).toBe(true);
    expect(nearest(working, barracks).order?.t).toBe('enlist');
  });

  it('with no man free the order is refused, nothing is paid, and the player is told', () => {
    const { g, p, barracks, soldier, army, said } = town();
    for (const m of menOf(g)) g.perish(m);
    expect(villagers(g, 0).some((v) => v.gender === 'f')).toBe(true); // women there are: they are not sent to the ranks
    const food = p.res.food;
    expect(g.cmdTrain(0, barracks.id, soldier)).toBe(false);
    expect(barracks.queue.length).toBe(0);
    expect(p.res.food).toBe(food);
    expect(said(/No man is free/)).toBe(true);
    run(g, 40);
    expect(army().length).toBe(0);
  });

  it('cancelled while he is inside, he comes back out as he was and the cost is returned', () => {
    const { g, p, barracks, soldier, army } = town();
    const before = villagers(g, 0).length, food = p.res.food;
    g.cmdTrain(0, barracks.id, soldier);
    const who = g.entities.get(barracks.queue[0].who!) as Unit;
    for (let i = 0; i < 60 && !barracks.queue[0].in; i++) run(g, 1);
    expect(barracks.queue[0].in).toBe(true);
    expect(who.inside).toBe(barracks.id);
    g.cmdCancel(0, barracks.id, 0);
    expect(who.inside).toBe(0);
    expect(who.dead).toBe(false);
    expect(who.type).toBe('villager');
    expect(p.res.food).toBe(food);
    run(g, 40);
    expect(army().length).toBe(0);
    expect(villagers(g, 0).length).toBe(before);
    // Cancelled while he is still on the road, he simply stops.
    g.cmdTrain(0, barracks.id, soldier);
    const walker = g.entities.get(barracks.queue[0].who!) as Unit;
    g.cmdCancel(0, barracks.id, 0);
    expect(walker.order).toBeNull();
  });

  it('if the building falls while he is being trained, he comes out of the ruin', () => {
    const { g, barracks, soldier } = town();
    g.cmdTrain(0, barracks.id, soldier);
    const who = g.entities.get(barracks.queue[0].who!) as Unit;
    for (let i = 0; i < 60 && !barracks.queue[0].in; i++) run(g, 1);
    g.perish(barracks as unknown as Unit);
    expect(barracks.dead).toBe(true);
    expect(who.dead).toBe(false);
    expect(who.inside).toBe(0);
    expect(g.units.includes(who)).toBe(true);
  });

  it('if the man called dies on the way, another is called in his place', () => {
    const { g, barracks, soldier, army } = town();
    g.cmdTrain(0, barracks.id, soldier);
    const first = g.entities.get(barracks.queue[0].who!) as Unit;
    g.perish(first);
    run(g, 2);
    const second = g.entities.get(barracks.queue[0].who!) as Unit | undefined;
    expect(second && second !== first && !second.dead).toBe(true);
    run(g, 60);
    expect(army().length).toBe(1);
  });

  it('a man being trained is still there after the game is saved and loaded', () => {
    const { g, barracks, soldier } = town();
    g.cmdTrain(0, barracks.id, soldier);
    for (let i = 0; i < 60 && !barracks.queue[0].in; i++) run(g, 1);
    const h = Game.restore(g.serialize());
    const b = h.buildings.find((x) => x.id === barracks.id)!;
    expect(b.queue[0].in).toBe(true);
    run(h, 60);
    expect(h.units.filter((u) => u.owner === 0 && h.isMilitary(u)).length).toBe(1);
  });

  it('a healer may be a woman, and a woman is asked first', () => {
    const { g, p, tc } = town();
    p.age = 1;
    const at = spot(g, 'temple', 0);
    const temple = g.spawnBuilding('temple', 0, at.cx, at.cy, true);
    const type = g.creedBar(0, UNITS.shaman) ? 'priest' : 'shaman';
    expect(g.cmdTrain(0, temple.id, type)).toBe(true);
    const who = g.entities.get(temple.queue[0].who!) as Unit;
    expect(who.gender).toBe('f');
    run(g, 80);
    const healer = g.units.find((u) => u.owner === 0 && u.type === type)!;
    expect(healer).toBeTruthy();
    expect(healer.gender).toBe('f');
    expect(healer.name).toBe(who.name);
    expect(tc.dead).toBe(false);
  });

  it('a woman who fights strikes far less hard than a man; hunting is not fighting', () => {
    const blow = (gender: 'm' | 'f', prey: boolean) => {
      const g = new Game(7, setups);
      const tc = g.buildings.find((b) => b.owner === 0)!;
      const v = g.spawnUnit('villager', 0, tc.x + 12, tc.y + 12, gender);
      const t = prey ? g.spawnUnit('deer', g.wild, tc.x + 12.6, tc.y + 12) : g.spawnUnit('swordsman', 1, tc.x + 12.6, tc.y + 12);
      t.stance = 'hold'; (t.def as unknown) = { ...t.def, atk: 0, speed: 0, armor: 0 };
      t.hp = t.maxHp = 1000;
      g.cmdTarget(0, [v.id], t.id);
      run(g, 10);
      return 1000 - t.hp;
    };
    const man = blow('m', false), woman = blow('f', false);
    expect(man).toBeGreaterThan(0);
    expect(woman).toBeLessThan(man * (WOMAN_ATK + 0.2));
    expect(blow('f', true)).toBe(blow('m', true));
  });

  it('a villager, a beast and the nation\'s leader cost nobody', () => {
    expect(needsPerson(UNITS.villager)).toBe(false);
    expect(needsPerson(UNITS.hound)).toBe(false);
    expect(needsPerson(UNITS.warlord)).toBe(false);
    for (const id of ['clubman', 'bowman', 'rider', 'catapult', 'galley', 'fishboat', 'shaman', 'slaver']) expect(needsPerson(UNITS[id]), id).toBe(true);
    const { g, p, tc, barracks } = town();
    p.age = 1;
    for (const m of menOf(g)) g.perish(m);
    const before = villagers(g, 0).length;
    expect(g.cmdTrain(0, barracks.id, 'hound')).toBe(true);
    expect(g.cmdTrain(0, tc.id, 'warlord')).toBe(true);
    run(g, 90);
    expect(g.units.some((u) => u.owner === 0 && u.type === 'hound')).toBe(true);
    expect(g.leaderOf(0)).toBeTruthy();
    expect(villagers(g, 0).length).toBeGreaterThanOrEqual(before);
  });

  it('the computer raises an army out of its people and keeps enough of them at work', () => {
    const g = new Game(11, [{ ...setups[0], isAI: true, civ: 'forge' }, setups[1]]);
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    ais.forEach((a) => a.setLevel(1));
    let fewest = Infinity;
    const most = [0, 0];
    run(g, 60 * 14, () => {
      ais.forEach((a) => a.update());
      for (const pid of [0, 1]) most[pid] = Math.max(most[pid], g.units.filter((u) => u.owner === pid && g.isMilitary(u)).length);
      if (g.time > 300) for (const pid of [0, 1]) fewest = Math.min(fewest, g.units.filter((u) => u.owner === pid && u.type === 'villager').length);
    });
    for (const pid of [0, 1]) {
      expect(most[pid], `largest army of ${pid}`).toBeGreaterThanOrEqual(4);
    }
    expect(fewest).toBeGreaterThanOrEqual(8);
  }, 120000);
});

describe('a town is in its nation\'s age', () => {
  it('nobody ages up in a campaign battle; a skirmish still may', () => {
    const { g, p, tc, said } = town();
    g.fixedAge = true;
    const gold = p.res.gold, food = p.res.food;
    expect(g.cmdAgeUp(0, tc.id)).toBe(false);
    expect(p.agingUp).toBe(false);
    expect([p.res.food, p.res.gold]).toEqual([food, gold]);
    expect(said(/advanced on the map/)).toBe(true);
    expect(Game.restore(g.serialize()).fixedAge).toBe(true);
    const skirmish = town();
    expect(skirmish.g.fixedAge).toBe(false);
    expect(skirmish.g.cmdAgeUp(0, skirmish.tc.id)).toBe(true);
  });

  it('the computer does not save for an age it cannot reach: it still raises an army', () => {
    const g = new Game(11, [{ ...setups[0], isAI: true, civ: 'forge' }, setups[1]]);
    g.fixedAge = true;
    const ais = [new AIController(g, 0), new AIController(g, 1)];
    ais.forEach((a) => a.setLevel(1));
    const most = [0, 0];
    run(g, 60 * 14, () => { ais.forEach((a) => a.update()); for (const pid of [0, 1]) most[pid] = Math.max(most[pid], g.units.filter((u) => u.owner === pid && g.isMilitary(u)).length); });
    for (const pid of [0, 1]) {
      expect(g.players[pid].age).toBe(0);
      expect(most[pid], `largest army of ${pid}`).toBeGreaterThanOrEqual(4);
    }
  }, 120000);
});
