// The computer opponent (src/sim/ai.ts), one decision at a time: what it builds and in what order, when it marches
// and when it calls an attack home, how a raiding people takes villagers, its ships and landings, and its market.
// Each test sets a town up as the decision needs it and asks the AI once (or for a short while), so that a port of
// the AI has a bar to meet decision by decision, not only whole games between two computer players.
//
// The AI reads the clock from `g.time`; where a decision waits on the clock (the first attack, the dock, the landing)
// the test moves the clock on rather than playing out minutes of a game that would only blur what is asked.
import { describe, expect, it, vi } from 'vitest';
import { AIController } from '../src/sim/ai';
import { Game, Unit } from '../src/sim/game';
import { run, setups, spot, villagers } from './helpers';

type Res = Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>;

/** What the AI keeps of itself in a saved game: the public view of its state. */
const st = (ai: AIController) => ai.save() as { state: string; readyT: number; launched: number; raid: { phase: string; men: number[] } | null; raidT: number };

/** Records the buildings player 1 lays down, by type, in the order they are placed (the command still runs). */
const watchPlacing = (g: Game): string[] => {
  const placed: string[] = [];
  const real = g.cmdPlace.bind(g);
  vi.spyOn(g, 'cmdPlace').mockImplementation((o, type, cx, cy, ids, q) => { const b = real(o, type, cx, cy, ids, q); if (b && o === 1) placed.push(type); return b; });
  return placed;
};

/**
 * Player 1 (a computer player, a settled people) with `hands` villagers, the given buildings finished near its hall,
 * of the given age and rich unless told otherwise. Normal level. Player 0 is a human player's untouched town.
 */
const town = (o: { civ?: string; hands?: number; age?: number; have?: string[]; res?: Res; allied?: boolean } = {}) => {
  const me = { ...setups[1], civ: o.civ ?? 'hearth' };
  const g = new Game(5, o.allied
    ? [{ ...setups[0], team: 1 }, { ...me, team: 1 }, { name: 'C', color: 0x33ff33, isAI: true, civ: 'forge', team: 2 }]
    : [setups[0], me], 96);
  const p = g.players[1];
  const tc = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
  for (let i = villagers(g, 1).length; i < (o.hands ?? 4); i++) g.spawnUnit('villager', 1, tc.x - 3 + (i % 6), tc.y + 3 + Math.floor(i / 6), i % 2 ? 'f' : 'm');
  for (const t of o.have ?? []) { const at = spot(g, t, 1); g.spawnBuilding(t, 1, at.cx, at.cy, true); }
  if (o.age !== undefined) p.age = o.age;
  Object.assign(p.res, { food: 1000, wood: 1000, gold: 1000, stone: 1000 }, o.res ?? {});
  const ai = new AIController(g, 1);
  ai.setLevel(1);
  const placed = watchPlacing(g);
  run(g, 1);
  const foeTc = g.buildings.find((b) => b.owner === 0 && b.type === 'towncenter')!;
  return { g, p, tc, foeTc, ai, placed };
};

/** `n` soldiers of a type for `owner`, standing in a block at a point. */
const army = (g: Game, owner: number, type: string, n: number, at: { x: number; y: number }): Unit[] =>
  Array.from({ length: n }, (_, i) => g.spawnUnit(type, owner, at.x + (i % 4) * 0.8, at.y + Math.floor(i / 4) * 0.8));

/** The works of war placed, leaving out houses, farms, palisade gates and the storehouses put beside far resources. */
const works = (placed: string[]) => placed.filter((t) => !['house', 'farm', 'gate', 'storehouse'].includes(t));

describe('the computer player builds its town', () => {
  it('trains villagers at its Town Center until the age\'s number is reached', () => {
    const short = town({ hands: 6 });
    short.ai.update();
    expect(short.tc.queue.map((q) => q.id)).toContain('villager');
    const full = town({ hands: 16 }); // the Stone Age's sixteen
    full.ai.update();
    expect(full.tc.queue.some((q) => q.id === 'villager')).toBe(false);
  });

  it('raises a barracks first, once it has eight villagers, and a storehouse next at ten', () => {
    const seven = town({ hands: 7 });
    seven.ai.update();
    expect(seven.placed).not.toContain('barracks');
    const eight = town({ hands: 8 });
    eight.ai.update();
    expect(works(eight.placed)).toEqual(['barracks']);
    const ten = town({ hands: 10, have: ['barracks'] });
    ten.ai.update();
    expect(ten.placed.filter((t) => t !== 'house')[0]).toBe('storehouse'); // the order is asked before the hands are sent out
  });

  it('in the Bronze Age raises its works in order: range, stable, blacksmith, market, temple, two towers', () => {
    const order = ['barracks', 'storehouse', 'range', 'stable', 'blacksmith', 'market', 'temple', 'tower', 'tower'];
    for (let k = 2; k < order.length; k++) {
      const { ai, placed } = town({ hands: 11, age: 1, have: order.slice(0, k) });
      ai.update();
      expect(works(placed), `with ${order.slice(0, k).join(', ')}`).toEqual([order[k]]);
    }
    // Everything of the age stands: nothing more of war (the workshop is the Iron Age's).
    const done = town({ hands: 11, age: 1, have: order });
    done.ai.update();
    expect(works(done.placed).filter((t) => order.includes(t) || t === 'workshop')).toEqual([]);
  });

  it('raises one work of the order at a time', () => {
    const { g, ai, placed } = town({ hands: 11, age: 1, have: ['barracks', 'storehouse'] });
    const at = spot(g, 'range', 1);
    g.spawnBuilding('range', 1, at.cx, at.cy, false); // a range begun and not finished
    ai.update();
    expect(works(placed)).toEqual([]);
  });

  it('builds a Wonder only when rich, and not on the Easy level; a rich Normal town raises more barracks', () => {
    const all = ['barracks', 'storehouse', 'range', 'stable', 'blacksmith', 'market', 'temple', 'tower', 'tower', 'workshop', 'barracks'];
    const wonder = (level: number, wood: number) => {
      const t = town({ hands: 14, age: 3, have: all, res: { food: 700, wood, gold: 800, stone: 800 } });
      t.ai.setLevel(level);
      t.ai.update();
      return t.placed.includes('wonder');
    };
    expect(wonder(1, 1750)).toBe(true);
    expect(wonder(0, 1750)).toBe(false);
    expect(wonder(1, 1500)).toBe(false); // wood under 1,600
    const rich = (level: number) => {
      const t = town({ hands: 14, age: 2, have: all, res: { food: 5000, wood: 5000, gold: 5000, stone: 5000 } });
      t.ai.setLevel(level);
      t.ai.update();
      return t.placed.includes('barracks');
    };
    expect(rich(1)).toBe(true);
    expect(rich(0)).toBe(false);
  });

  it('saving for the next age, it advances and raises no work but a barracks', () => {
    const { p, ai, placed } = town({ hands: 12, have: ['barracks'] }); // twelve villagers: the Stone Age's number to go up
    ai.update();
    expect(p.agingUp).toBe(true);
    expect(works(placed)).toEqual([]);
    expect(placed).not.toContain('storehouse');
  });

  it('builds a house when within five of its population cap, and not before', () => {
    const roomy = town({ civ: 'forge', hands: 4 }); // 4 of 10
    roomy.ai.update();
    expect(roomy.placed).not.toContain('house');
    const tight = town({ civ: 'forge', hands: 6 }); // 6 of 10
    tight.ai.update();
    expect(tight.placed).toContain('house');
  });

  it('lays out fields when there is nothing near the town to gather food from', () => {
    const fed = town({ hands: 4, res: { food: 300 } });
    fed.ai.update();
    expect(fed.placed).not.toContain('farm');
    const bare = town({ hands: 4, res: { food: 300 } });
    for (const r of bare.g.resources) if (r.resType === 'food') (r as { shun?: number }).shun = 1e9; // berries and the like, out of reach
    for (const u of bare.g.units) if (u.type === 'deer') { u.x = 2; u.y = 2; } // and the deer far off
    bare.ai.update();
    expect(bare.placed.filter((t) => t === 'farm').length).toBeGreaterThanOrEqual(1);
  });
});

describe('when the computer player attacks', () => {
  it('waits for its first-attack time, which the level sets, then marches on the rival with an army big enough', () => {
    for (const [level, first, scale] of [[0, 660, 0.5], [1, 420, 1], [2, 270, 1.3]]) {
      const { g, tc, foeTc, ai } = town({ hands: 6 });
      ai.setLevel(level);
      expect(ai.firstAttack).toBe(first);
      expect(ai.armyScale).toBe(scale);
      const men = army(g, 1, 'swordsman', 5, { x: tc.x + 4, y: tc.y + 4 }); // 475 of strength against a hall's 300
      g.time = first - 1;
      ai.update();
      expect(st(ai).state, `level ${level} before`).toBe('build');
      g.time = first + 1;
      ai.update();
      expect(st(ai).state, `level ${level} after`).toBe('attack');
      expect(st(ai).launched).toBe(5);
      // Once they stand idle (the first went to the gathering ground in front of the town) they are sent: at the
      // rival's hall, the only building it has.
      for (let s = 0; s < 20 && !men.every((u) => u.order?.t === 'attackMove'); s++) { run(g, 1); ai.update(); }
      for (const u of men) {
        expect(u.order?.t).toBe('attackMove');
        const o = u.order as { x: number; y: number };
        expect(Math.hypot(o.x - foeTc.x, o.y - foeTc.y)).toBeLessThan(5);
      }
    }
  });

  it('does not go with too small an army: four men in the Stone Age, eight in the Bronze Age at Normal', () => {
    const go = (age: number, n: number) => {
      const { g, tc, ai } = town({ hands: 6, age });
      army(g, 1, 'knight', n, { x: tc.x + 4, y: tc.y + 4 }); // heavy enough that only their number is in question
      g.time = 500;
      ai.update();
      return st(ai);
    };
    expect(go(0, 3).state).toBe('build');
    expect(go(0, 3).readyT).toBe(-1); // not even counted as ready
    expect(go(0, 4).state).toBe('attack');
    expect(go(1, 7).state).toBe('build');
    expect(go(1, 8).state).toBe('attack');
  });

  it('at Normal, weaker than the defenders it waits, but not for longer than six minutes; at Easy it goes at once', () => {
    const { g, tc, ai } = town({ hands: 6 });
    army(g, 1, 'clubman', 5, { x: tc.x + 4, y: tc.y + 4 }); // 250 of strength: under the hall's 300 and the margin of 1.4
    g.time = 700;
    ai.update();
    expect(st(ai)).toMatchObject({ state: 'build', readyT: 700 });
    g.time = 1000;
    ai.update();
    expect(st(ai)).toMatchObject({ state: 'build', readyT: 700 }); // still waiting, from when it was first ready
    g.time = 1061;
    ai.update();
    expect(st(ai).state).toBe('attack');

    const easy = town({ hands: 6 });
    easy.ai.setLevel(0);
    army(easy.g, 1, 'clubman', 5, { x: easy.tc.x + 4, y: easy.tc.y + 4 });
    easy.g.time = 700;
    easy.ai.update();
    expect(st(easy.ai).state).toBe('attack');
  });
});

describe('when its own town is struck', () => {
  it('does not march out, and sends its idle soldiers to where the town was hit', () => {
    const { g, p, tc, ai } = town({ hands: 6 });
    const men = army(g, 1, 'swordsman', 5, { x: tc.x + 6, y: tc.y + 6 });
    g.time = 500; // past the first-attack time, with an army that would otherwise go
    const hit = { x: tc.x - 8, y: tc.y };
    p.lastAttacked = { ...hit, t: g.time };
    ai.update();
    expect(st(ai).state).toBe('build');
    for (const u of men) {
      expect(u.order?.t).toBe('attackMove');
      const o = u.order as { x: number; y: number };
      expect(Math.hypot(o.x - hit.x, o.y - hit.y)).toBeLessThan(3);
    }
  });

  it('rings the town bell when three raiders are in the village, and stops it ten seconds after the last blow', () => {
    const { g, p, tc, ai } = town({ hands: 6 });
    p.lastAttacked = { x: tc.x - 8, y: tc.y, t: g.time };
    ai.update();
    expect(p.bell).toBe(false); // struck, but nobody in the streets
    army(g, 0, 'clubman', 3, { x: tc.x + 4, y: tc.y });
    p.lastAttacked = { x: tc.x + 4, y: tc.y, t: g.time };
    ai.update();
    expect(p.bell).toBe(true);
    g.time += 11;
    ai.update();
    expect(p.bell).toBe(false);
  });

  it('an attack that has lost most of its men is called home; one still strong fights on', () => {
    const march = (alive: number, launched: number) => {
      const { g, tc, foeTc, ai } = town({ hands: 6 });
      army(g, 0, 'clubman', 1, { x: foeTc.x + 3, y: foeTc.y + 3 }); // the rival still has a soldier
      const men = army(g, 1, 'swordsman', alive, { x: (tc.x + foeTc.x) / 2, y: (tc.y + foeTc.y) / 2 });
      ai.load({ state: 'attack', launched } as Parameters<AIController['load']>[0]);
      ai.update();
      return { ai, men, tc, foeTc };
    };
    // Four left of twenty: fewer than 35% of those who set out. They come home.
    const beaten = march(4, 20);
    expect(st(beaten.ai).state).toBe('build');
    for (const u of beaten.men) {
      expect(u.order?.t).toBe('move');
      const o = u.order as { x: number; y: number };
      expect(Math.hypot(o.x - beaten.tc.x, o.y - beaten.tc.y)).toBeLessThan(12);
    }
    // Four of four: on they go, at the rival.
    const whole = march(4, 4);
    expect(st(whole.ai).state).toBe('attack');
    for (const u of whole.men) expect(u.order?.t).toBe('attackMove');
    // Under three left: the attack is over, whoever launched it.
    expect(st(march(2, 4).ai).state).toBe('build');
  });

  it('does not call back an army already marching when its own town is struck', () => {
    // (ai.ts sends idle soldiers to the town only while it is building up; an attack under way carries on.)
    const { g, p, tc, foeTc, ai } = town({ hands: 6 });
    const men = army(g, 1, 'swordsman', 5, { x: foeTc.x + 6, y: foeTc.y + 6 });
    ai.load({ state: 'attack', launched: 5 } as Parameters<AIController['load']>[0]);
    p.lastAttacked = { x: tc.x - 8, y: tc.y, t: g.time };
    ai.update();
    expect(st(ai).state).toBe('attack');
    for (const u of men) {
      const o = u.order as { t: string; x: number; y: number };
      expect(o.t).toBe('attackMove');
      expect(Math.hypot(o.x - foeTc.x, o.y - foeTc.y)).toBeLessThan(5);
    }
  });
});

describe('a raiding people', () => {
  /** A raiding band (the steppe) that has settled, its seven clubmen at home, and four of the rival's women out half way. */
  const band = (level: number, o: { guarded?: boolean; tower?: boolean } = {}) => {
    const g = new Game(5, [setups[0], { ...setups[1], civ: 'steppe' }], 96);
    const at = g.spec.starts[1];
    const hall = g.spawnBuilding('towncenter', 1, Math.floor(at.x) - 2, Math.floor(at.y) - 2, true);
    const foeTc = g.buildings.find((b) => b.owner === 0)!;
    if (o.guarded) army(g, 0, 'swordsman', 6, { x: foeTc.x + 3, y: foeTc.y + 3 }); // the rival is not defenceless
    const mx = (hall.x + foeTc.x) / 2, my = (hall.y + foeTc.y) / 2;
    const prey = [0, 1, 2, 3].map((i) => g.spawnUnit('villager', 0, mx + i * 1.5, my, 'f'));
    if (o.tower) g.spawnBuilding('tower', 0, Math.floor(mx) + 1, Math.floor(my) + 3, true);
    const ai = new AIController(g, 1);
    ai.setLevel(level);
    while (g.time < 1 || Math.floor(g.time) % 4 !== 0) g.step(); // it looks for prey every fourth second
    return { g, ai, hall, prey, raiders: () => g.units.filter((u) => u.owner === 1 && u.order?.t === 'capture') };
  };

  it('sends one, two or three men after rival villagers by level, and the whole band but one at a rival with no army', () => {
    expect(band(0).g.raider(1)).toBe(true);
    const sent = (level: number, guarded: boolean) => { const b = band(level, { guarded }); b.ai.update(); return b.raiders().length; };
    expect(sent(0, true)).toBe(1);
    expect(sent(1, true)).toBe(2);
    expect(sent(2, true)).toBe(3);
    expect(sent(0, false)).toBe(1); // the Easy band never sees its chance
    expect(sent(1, false)).toBe(6); // seven clubmen, one kept back
    // No two go after the same woman.
    const b = band(2, { guarded: true });
    b.ai.update();
    const marks = b.raiders().map((u) => (u.order as { id: number }).id);
    expect(new Set(marks).size).toBe(marks.length);
    for (const id of marks) expect(b.prey.map((v) => v.id)).toContain(id);
  });

  it('keeps clear of villagers under a rival\'s tower', () => {
    const b = band(2, { guarded: true, tower: true });
    b.ai.update();
    expect(b.raiders().length).toBe(0);
  });

  it('a raider badly hurt gives up the chase and comes home', () => {
    const b = band(2, { guarded: true });
    b.ai.update();
    const [hurt] = b.raiders();
    hurt.hp = hurt.maxHp * 0.3;
    while (Math.floor(b.g.time) % 4 !== 0 || b.g.time < 5) b.g.step();
    b.ai.update();
    expect(hurt.order?.t).toBe('move');
    const o = hurt.order as { x: number; y: number };
    expect(Math.hypot(o.x - b.hall.x, o.y - b.hall.y)).toBeLessThan(8);
  });

  it('a settled people does not raid', () => {
    const { g, tc, foeTc, ai } = town({ hands: 6 });
    army(g, 1, 'clubman', 6, { x: tc.x + 4, y: tc.y + 4 });
    g.spawnUnit('villager', 0, (tc.x + foeTc.x) / 2, (tc.y + foeTc.y) / 2, 'f');
    expect(g.raider(1)).toBe(false);
    for (let s = 0; s < 8; s++) { run(g, 1); ai.update(); }
    expect(g.units.some((u) => u.owner === 1 && u.order?.t === 'capture')).toBe(false);
  });
});

describe('the computer player at sea', () => {
  /** A lake map (seed 23), the computer's town of `hands` villagers, rich, at Normal. */
  const harbour = (hands: number, age = 0, level = 1) => {
    const g = new Game(23, [setups[0], { ...setups[1] }], 96, false, true);
    const p = g.players[1];
    const tc = g.buildings.find((b) => b.owner === 1 && b.type === 'towncenter')!;
    for (let i = villagers(g, 1).length; i < hands; i++) g.spawnUnit('villager', 1, tc.x - 3 + (i % 6), tc.y + 3 + Math.floor(i / 6), i % 2 ? 'f' : 'm');
    p.age = age;
    Object.assign(p.res, { food: 1000, wood: 1000, gold: 1000, stone: 1000 });
    const ai = new AIController(g, 1);
    ai.setLevel(level);
    return { g, p, tc, ai };
  };
  /** The dock where this town's computer player puts it, finished, and `boats` fishing boats on the water by it. */
  const withDock = (g: Game, boats: number) => {
    const dock = g.spawnBuilding('dock', 1, 63, 55, true);
    const w = g.seaPf.nearestFree(dock.x, dock.y);
    for (let k = 0; k < boats; k++) g.spawnUnit('fishboat', 1, w.x, w.y);
    return { dock, w };
  };
  /** A house of the rival's on a far shore of the lake, nearer the dock than its town: somewhere to land. */
  const farShore = (g: Game, dock: { x: number; y: number }) => {
    const from = g.seaPf.nearestFree(dock.x, dock.y), load = g.shoreSpot(dock.x, dock.y, 9, 1, from.x, from.y)!;
    const mid = g.size / 2;
    for (let r = 6; r < 30; r += 2) for (let a = 0; a < 32; a++) {
      const s = g.shoreSpot(mid + Math.cos((a / 32) * Math.PI * 2) * r, mid + Math.sin((a / 32) * Math.PI * 2) * r, 6, 0, from.x, from.y);
      if (!s || Math.hypot(s.lx - load.lx, s.ly - load.ly) < 28 || Math.hypot(s.lx - dock.x, s.ly - dock.y) > 45) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-2, -2], [2, -2], [-2, 2]]) {
        const cx = Math.floor(s.lx) + dx * 2, cy = Math.floor(s.ly) + dy * 2;
        if (g.canPlace('house', cx, cy)) return g.spawnBuilding('house', 0, cx, cy, true);
      }
    }
    throw new Error('no far shore');
  };

  it('lays a dock by fish once it is past two and a half minutes and has 200 wood; never in a game without water', () => {
    const { g, p, ai } = harbour(6);
    const placed = watchPlacing(g);
    run(g, 1);
    ai.update();
    expect(placed).not.toContain('dock'); // too early
    g.time = 151;
    p.res.wood = 150;
    ai.update();
    expect(placed).not.toContain('dock'); // too poor
    p.res.wood = 1000;
    ai.update();
    expect(placed).toContain('dock');
    const dock = g.buildings.find((b) => b.owner === 1 && b.type === 'dock')!;
    expect(g.findResourceNear(dock.x, dock.y, 'food', 1, 26, 0, true)).not.toBeNull();

    const inland = town({ hands: 6 });
    inland.g.time = 300;
    inland.ai.update();
    expect(inland.placed).not.toContain('dock');
  });

  it('keeps fishing boats by level and sets idle ones to fish; only with hands to spare', () => {
    const few = harbour(4);
    const a = withDock(few.g, 0);
    few.g.time = 200;
    few.ai.update();
    expect(a.dock.queue.length).toBe(0); // four villagers: none to spare for a boat
    const some = harbour(6);
    const b = withDock(some.g, 0);
    some.g.time = 200;
    some.ai.update();
    expect(b.dock.queue.map((q) => q.id)).toEqual(['fishboat']);
    const full = harbour(6); // three boats is what Normal keeps
    const c = withDock(full.g, 3);
    full.g.time = 200;
    full.ai.update();
    expect(c.dock.queue.length).toBe(0);
    const boats = full.g.units.filter((u) => u.owner === 1 && u.type === 'fishboat');
    expect(boats.every((u) => u.order?.t === 'gather')).toBe(true);
  });

  it('from the Bronze Age at Normal it adds a warship, and a transport when there is a rival shore to land on; Easy keeps neither', () => {
    // No shore of the rival's within reach of this dock: a warship, no transport.
    const plain = harbour(14, 1);
    const a = withDock(plain.g, 3);
    plain.g.time = 200;
    plain.ai.update();
    expect(a.dock.queue.map((q) => q.id)).toEqual([plain.g.trainedAs(1, 'galley')]);
    // A rival's house across the water: a transport first.
    const shore = harbour(14, 1);
    const b = withDock(shore.g, 3);
    farShore(shore.g, b.dock);
    shore.g.time = 200;
    shore.ai.update();
    expect(b.dock.queue.map((q) => q.id)).toEqual(['transport', shore.g.trainedAs(1, 'galley')]);
    // The Easy computer fishes and nothing more.
    const easy = harbour(14, 1, 0);
    const c = withDock(easy.g, 2);
    farShore(easy.g, c.dock);
    easy.g.time = 200;
    easy.ai.update();
    expect(c.dock.queue.length).toBe(0);
  });

  it('sends idle warships after an enemy ship near its dock', () => {
    const { g, ai } = harbour(14, 1);
    const { dock, w } = withDock(g, 1);
    const ship = g.spawnUnit(g.trainedAs(1, 'galley'), 1, w.x, w.y);
    const foe = g.spawnUnit('galley', 0, w.x, w.y);
    let at: { x: number; y: number } | null = null;
    for (let r = 4; r < 20 && !at; r++) for (let a = 0; a < 16 && !at; a++) { // somewhere on the water a little off
      const x = w.x + Math.cos(a) * r, y = w.y + Math.sin(a) * r;
      if (g.terrain[Math.floor(y) * g.size + Math.floor(x)] === 1 && !g.seaPf.find(w.x, w.y, x, y, x, y, 1).partial) at = { x, y };
    }
    foe.x = at!.x; foe.y = at!.y;
    expect(Math.hypot(foe.x - dock.x, foe.y - dock.y)).toBeLessThan(30);
    g.time = 200;
    ai.update();
    expect(ship.order?.t).toBe('attackMove');
  });

  it('lands six men on a rival shore: gathers them, loads them, sails, puts them ashore and sends the ship home', () => {
    const { g, tc, ai } = harbour(14, 1);
    ai.firstAttack = 1e9; // the landing, not an attack over land
    const { dock, w } = withDock(g, 3);
    const house = farShore(g, dock);
    const ship = g.spawnUnit('transport', 1, w.x, w.y);
    army(g, 1, 'spearman', 8, { x: tc.x + 5, y: tc.y - 5 });
    g.time = 419;
    ai.update();
    expect(st(ai).raid).toBeNull(); // the first landing waits for the seventh minute
    g.time = 421;
    ai.update();
    const raid = st(ai).raid!;
    expect(raid.phase).toBe('load');
    expect(raid.men.length).toBe(6);
    expect(ship.order?.t).toBe('move');
    const men = raid.men.map((id) => g.entities.get(id) as Unit);
    let sailed = 0, landed = -1;
    for (let s = 0; s < 120 && landed < 0; s++) {
      run(g, 1);
      ai.update();
      if (st(ai).raid?.phase === 'sail') sailed = Math.max(sailed, ship.cargo?.length ?? 0);
      if (sailed && !st(ai).raid) landed = g.time;
    }
    expect(sailed).toBe(6);
    expect(landed).toBeGreaterThan(0);
    expect(st(ai).raidT).toBeCloseTo(landed + 300, 0); // and the next landing waits five minutes
    for (const u of men) {
      expect(u.inside).toBe(0);
      expect(Math.hypot(u.x - house.x, u.y - house.y)).toBeLessThan(12); // ashore on the far side, going for the house
    }
    expect(ship.order?.t).toBe('move'); // home again
  }, 30_000);
});

describe('the computer player\'s market', () => {
  const trades = (res: Res, o: { market?: boolean; allied?: boolean } = {}) => {
    const { g, ai } = town({ hands: 6, age: 1, have: o.market === false ? [] : ['market'], res, allied: o.allied });
    if (o.allied) g.players[0].res.stone = 20;
    const calls: string[] = [], gifts: string[] = [];
    const trade = g.cmdTrade.bind(g), tribute = g.cmdTribute.bind(g);
    vi.spyOn(g, 'cmdTrade').mockImplementation((who, b, r, d) => { if (who === 1) calls.push(`${d} ${r}`); return trade(who, b, r, d); });
    vi.spyOn(g, 'cmdTribute').mockImplementation((who, to, r) => { if (who === 1) gifts.push(`${r} to ${to}`); return tribute(who, to, r); });
    ai.update();
    return { calls, gifts };
  };

  it('sells what is piling up when short of gold, three lots at a time from a great heap', () => {
    expect(trades({ gold: 100, wood: 300, food: 1000, stone: 100 }).calls).toEqual(['sell food']);
    expect(trades({ gold: 100, wood: 300, food: 500, stone: 1000 }).calls).toEqual(['sell stone']);
    expect(trades({ gold: 100, wood: 2500, food: 500, stone: 100 }).calls).toEqual(['sell wood', 'sell wood', 'sell wood']);
    expect(trades({ gold: 500, wood: 300, food: 500, stone: 1000 }).calls).toEqual([]); // gold enough: it keeps its stone
  });

  it('buys what has run out, more at once the more gold lies idle', () => {
    expect(trades({ gold: 400, wood: 500, food: 0, stone: 100 }).calls).toEqual(['buy food']);
    expect(trades({ gold: 650, wood: 500, food: 0, stone: 100 }).calls).toEqual(['buy food', 'buy food']);
    expect(trades({ gold: 1000, wood: 50, food: 500, stone: 100 }).calls).toEqual(['buy wood']); // one lot and it has enough
  });

  it('with a bare larder and little gold, sells wood to buy bread with', () => {
    expect(trades({ gold: 250, wood: 1500, food: 50, stone: 100 }).calls).toEqual(['sell wood']);
  });

  it('sends a great surplus to an ally that has run dry', () => {
    const { gifts } = trades({ gold: 500, wood: 500, food: 500, stone: 2000 }, { allied: true });
    expect(gifts).toEqual(['stone to 0']);
  });

  it('trades nothing without a finished market', () => {
    expect(trades({ gold: 100, wood: 2500, food: 1000, stone: 100 }, { market: false }).calls).toEqual([]);
  });
});
