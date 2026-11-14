// Scripted missions: a fixed set-up, a list of objectives and a win or lose condition.
// Pure rules, so they can be run headless.

import type { Building, Game, PlayerSetup } from './game';
import type { Climate } from './map';
import { rescueForce, rescuers } from './rescue';
import { creedOf } from './creed';

export interface Objective { text: string; done: boolean }
export interface MissionStatus { objectives: Objective[]; result: 'win' | 'lose' | null }

export interface Mission {
  id: string;
  name: string;
  brief: string;
  seed: number;
  size: number;
  /** Fought round a great lake, with docks and ships. */
  sea?: boolean;
  /** The country it is fought in: green if not said. */
  climate?: Climate;
  /** What the mission teaches or shows off, in a few words, for the list of missions. */
  about?: string;
  /** Difficulty of the computer opponent, or null if the enemy is scripted and has no AI. */
  aiLevel: number | null;
  setups: PlayerSetup[];
  /** Arrange the opening position. Called once on a fresh game. */
  init(g: Game): void;
  /** Called once a second: advance any script and report progress. */
  tick(g: Game): MissionStatus;
}

const ME = 0, FOE = 1;
const mine = (g: Game, type?: string) => g.buildings.filter((b) => b.owner === ME && b.complete && (!type || b.type === type));
const soldiers = (g: Game) => g.units.filter((u) => u.owner === ME && g.isMilitary(u));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const base = (name: string, color: number, isAI: boolean, civ: string, bonus?: PlayerSetup['bonus']): PlayerSetup => ({ name, color, isAI, civ, bonus });

/** The cells of a way by land from a point to a building, or null if there is none. */
export function landWay(g: Game, ax: number, ay: number, b: Building): number[] | null {
  const n = g.size, from = Math.floor(ay) * n + Math.floor(ax);
  const prev = new Int32Array(n * n).fill(-1);
  prev[from] = from;
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % n, y = (i - x) / n;
    if (x >= b.cx - 1 && x <= b.cx + b.size && y >= b.cy - 1 && y <= b.cy + b.size) {
      const way: number[] = [];
      for (let k = i; k !== from; k = prev[k]) way.push(k);
      return way.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, j = ny * n + nx;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || prev[j] >= 0 || g.blocked[j]) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  return null;
}

/**
 * Wall off every way by land from a point to a building: wherever the way is narrowest, three courses of stone
 * are laid across it from water to water (or rock to rock), and again until no way is left. Returns the walls laid.
 * Nothing is laid within `clear` tiles of either end, and a way wider than `widest` tiles is left open.
 */
export function barLand(g: Game, ax: number, ay: number, b: Building, owner: number, clear = 14, widest = 26): number {
  const n = g.size, free = (x: number, y: number) => x > 0 && y > 0 && x < n - 1 && y < n - 1 && !g.blocked[y * n + x];
  let laid = 0;
  for (let round = 0; round < 6; round++) {
    const way = landWay(g, ax, ay, b);
    if (!way) break;
    let best: { x: number; y: number; across: boolean; len: number } | null = null;
    for (const i of way) {
      const x = i % n, y = (i - x) / n;
      if (Math.hypot(x - ax, y - ay) < clear || Math.hypot(x - b.x, y - b.y) < clear) continue;
      for (const across of [true, false]) {
        let len = 1;
        for (const d of [1, -1]) for (let k = 1; k <= widest && free(across ? x + d * k : x, across ? y : y + d * k); k++) len++;
        if (len <= widest && (!best || len < best.len)) best = { x, y, across, len };
      }
    }
    if (!best) break;
    for (let course = -1; course <= 1; course++) {
      const x0 = best.across ? best.x : best.x + course, y0 = best.across ? best.y + course : best.y;
      if (!free(x0, y0)) continue;
      const cells: [number, number][] = [[x0, y0]];
      for (const d of [1, -1]) for (let k = 1; k <= widest + 2 && free(best.across ? x0 + d * k : x0, best.across ? y0 : y0 + d * k); k++) cells.push(best.across ? [x0 + d * k, y0] : [x0, y0 + d * k]);
      for (const [cx, cy] of cells) if (!g.occupied[cy * n + cx]) { g.spawnBuilding('stonewall', owner, cx, cy, true); laid++; }
    }
  }
  return laid;
}

/** A wall round a point with one gate, for a scripted stronghold. */
function ring(g: Game, owner: number, x0: number, y0: number, r: number, wall: string): void {
  for (let i = -r; i <= r; i++) {
    for (const [cx, cy] of [[x0 + i, y0 - r], [x0 + i, y0 + r], [x0 - r, y0 + i], [x0 + r, y0 + i]]) {
      const type = i === 0 && cy === y0 + r ? 'gate' : wall;
      if (g.canPlace(type, cx, cy)) g.spawnBuilding(type, owner, cx, cy, true);
    }
  }
}
/** Put a building down at the nearest spot to a point that will take it. */
function raise(g: Game, type: string, owner: number, x: number, y: number): Building | null {
  for (let r = 0; r < 14; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && g.canPlace(type, Math.floor(x) + dx, Math.floor(y) + dy)) return g.spawnBuilding(type, owner, Math.floor(x) + dx, Math.floor(y) + dy, true);
  return null;
}
const HELD = [['Neferu', 'f'], ['Khay', 'm'], ['Merit', 'f'], ['Sennu', 'm'], ['Tiye', 'f'], ['Ipy', 'm']] as const;

export const MISSIONS: Mission[] = [
  {
    id: 'hearth', name: 'First Hearth', seed: 5, size: 72, aiLevel: null, about: 'A first town: work, family, soldiers',
    brief: 'Your people have found a valley. Put them to work, found a family, and drive off the wolves that prowl its edge. A gentle start: nobody will attack you.',
    setups: [base('You', 0x2f7bff, false, 'hearth'), base('Distant Tribe', 0xe0452f, true, 'steppe')],
    init(g) {
      g.aging = false;
      const st = g.spec.starts[ME];
      // A wolf den just beyond the clearing.
      const den = [st.x + 13, st.y + 9];
      const ids: number[] = [];
      for (let i = 0; i < 3; i++) {
        const spot = g.pf.nearestFree(den[0] + i * 1.3, den[1] + (i % 2));
        ids.push(g.spawnUnit('wolf', g.wild, spot.x, spot.y).id);
      }
      g.scenario = { id: 'hearth', n: 0, ids };
    },
    tick(g) {
      const units = g.units.filter((u) => u.owner === ME);
      const wolves = g.scenario!.ids.filter((id) => g.entities.has(id)).length;
      const objectives = [
        { text: 'Set three villagers to gathering', done: units.filter((u) => u.order?.t === 'gather').length >= 3 || g.players[ME].stats.gathered > 60 },
        { text: 'Build a House', done: mine(g, 'house').length > 0 },
        { text: 'Move a man and a woman into it', done: mine(g, 'house').some((b) => b.residents.m && b.residents.f) || g.players[ME].stats.born > 0 },
        { text: 'Grow to 10 people', done: g.players[ME].pop >= 10 },
        { text: 'Build a Barracks and train 4 soldiers', done: mine(g, 'barracks').length > 0 && soldiers(g).length >= 4 },
        { text: `Hunt down the wolf pack to the south-east (${wolves} left)`, done: wolves === 0 },
      ];
      return { objectives, result: objectives.every((o) => o.done) ? 'win' : mine(g).length === 0 ? 'lose' : null };
    },
  },
  {
    id: 'line', name: 'Hold the Line', seed: 12, size: 72, aiLevel: null, about: 'Defend a walled town',
    brief: 'Raiders are coming in waves, each larger than the last. You have a palisade, two towers and a handful of soldiers. Keep your Town Center standing for ten minutes.',
    setups: [
      base('You', 0x2f7bff, false, 'stonekin', { age: 1, res: 300, units: { spearman: 4, bowman: 4 }, buildings: ['tower', 'tower'] }),
      base('Raiders', 0xe0452f, true, 'steppe'),
    ],
    init(g) {
      g.aging = false;
      const st = g.spec.starts[ME];
      // A palisade ring with a gate on each side.
      const R = 9, x0 = Math.floor(st.x), y0 = Math.floor(st.y);
      for (let i = -R; i <= R; i++) {
        for (const [cx, cy] of [[x0 + i, y0 - R], [x0 + i, y0 + R], [x0 - R, y0 + i], [x0 + R, y0 + i]]) {
          const type = i === 0 ? 'gate' : 'palisade';
          if (g.canPlace(type, cx, cy)) g.spawnBuilding(type, ME, cx, cy, true);
        }
      }
      g.spawnBuilding('barracks', ME, x0 + 3, y0 + 3, true);
      g.scenario = { id: 'line', n: 0, ids: [] };
    },
    tick(g) {
      const s = g.scenario!;
      const total = 600, every = 75;
      const tc = mine(g, 'towncenter')[0];
      // Send the next wave when its time comes.
      if (tc && g.time >= 45 + s.n * every && g.time < total) {
        s.n++;
        const from = g.spec.starts[FOE];
        const dx = tc.x - from.x, dy = tc.y - from.y, d = Math.hypot(dx, dy);
        const wave: [string, number][] = [['clubman', 2 + s.n], ['slinger', 1 + Math.floor(s.n / 2)], ['rider', Math.floor(s.n / 3)], ['ram', s.n >= 5 ? 1 : 0]];
        const ids: number[] = [];
        for (const [type, n] of wave) {
          for (let i = 0; i < n; i++) {
            // Raiders gather two-thirds of the way across the map, out of sight.
            const p = g.pf.nearestFree(tc.x - (dx / d) * 22 + (i % 4) - 1.5, tc.y - (dy / d) * 22 + Math.floor(i / 4));
            ids.push(g.spawnUnit(type, FOE, p.x, p.y).id);
          }
        }
        g.cmdMove(FOE, ids, tc.x, tc.y, true);
        g.events.push({ t: 'msg', player: ME, text: `Wave ${s.n}: raiders are on the march!` });
      }
      const raiders = g.units.filter((u) => u.owner === FOE && u.type !== 'villager').length;
      const left = Math.max(0, total - g.time);
      const objectives = [
        { text: `Hold out (${clock(left)} to go, wave ${s.n} of 8)`, done: left === 0 },
        { text: 'Keep your Town Center standing', done: !!tc },
        { text: `Raiders on the field: ${raiders}`, done: left === 0 && raiders === 0 },
      ];
      return { objectives, result: !tc ? 'lose' : left === 0 ? 'win' : null };
    },
  },
  {
    id: 'wonder', name: 'Race for the Wonder', seed: 31, size: 96, aiLevel: 2, about: 'A full match against a hard rival',
    brief: 'Two rich kingdoms, one legacy. Build a Wonder and keep it standing for five minutes, or tear down theirs before the clock runs out. Your rival wants the same thing.',
    setups: [
      base('You', 0x2f7bff, false, 'forge', { age: 2, res: 900, units: { swordsman: 4, bowman: 4 } }),
      base('Sun Kingdom', 0xe0b020, true, 'stonekin', { age: 2, res: 900, units: { swordsman: 4, bowman: 4 } }),
    ],
    init(g) {
      g.scenario = { id: 'wonder', n: 0, ids: [] };
    },
    tick(g) {
      const myW = g.wonderLeft(ME), theirW = g.wonderLeft(FOE);
      const objectives = [
        { text: 'Reach the Middle Ages', done: g.players[ME].age >= 3 },
        { text: 'Build a Wonder', done: myW >= 0 },
        { text: myW >= 0 ? `Defend it (${clock(myW)} to go)` : 'Defend it for five minutes', done: myW === 0 },
        { text: theirW >= 0 ? `Their Wonder stands: destroy it within ${clock(theirW)}!` : 'Do not let their Wonder stand', done: theirW < 0 },
      ];
      return { objectives, result: null }; // the ordinary Wonder and conquest rules decide this one
    },
  },
  {
    id: 'doors', name: 'Two Doors', seed: 8, size: 72, aiLevel: null, about: 'Church, tavern and the creed of a town',
    brief: 'Your town has a Church at one end of the street and wants a Tavern at the other. Fill them both, hear what is asked of you, and decide what kind of people yours will be. Nobody will attack you.',
    setups: [base('You', 0x2f7bff, false, 'dawn', { age: 1, res: 400 }), base('Distant Tribe', 0xe0452f, true, 'hearth')],
    init(g) {
      g.aging = false;
      const st = g.spec.starts[ME];
      // More hands than a new town has, so that some can be spared for the church and the tavern.
      for (let i = 0; i < 6; i++) { const at = g.pf.nearestFree(st.x - 3 + i, st.y + 5); g.spawnUnit('villager', ME, at.x, at.y, i % 2 ? 'f' : 'm'); }
      g.players[ME].dilemmaT = 75; // the first question comes early
      g.scenario = { id: 'doors', n: 0, ids: [] };
    },
    tick(g) {
      const p = g.players[ME], s = g.scenario!;
      const inside = (type: string) => mine(g, type).reduce((n, b) => n + (b.staff?.length ?? 0), 0);
      // Remembered once seen: people are sent in and called out again as the player tries things.
      if (inside('temple') >= 2) s.n |= 1;
      if (inside('tavern') >= 2) s.n |= 2;
      if (p.dilemmas > 0 && !p.dilemma) s.n |= 4;
      const creed = creedOf(p.virtue);
      const objectives = [
        { text: 'Build a Church', done: mine(g, 'temple').length > 0 },
        { text: 'Send two villagers into it: right-click the Church with them', done: !!(s.n & 1) },
        { text: 'Build a Tavern', done: mine(g, 'tavern').length > 0 },
        { text: 'Send two villagers into the Tavern', done: !!(s.n & 2) },
        { text: 'Answer the question your people bring you', done: !!(s.n & 4) },
        { text: `Become Devout or Worldly: hover over the creed in the top bar (now ${creed.name}, ${p.virtue > 0 ? 'piety ' + Math.round(p.virtue) : p.virtue < 0 ? 'decadence ' + Math.round(-p.virtue) : 'in the middle'})`, done: creed.id !== 'temperate' },
      ];
      return { objectives, result: objectives.every((o) => o.done) ? 'win' : mine(g, 'towncenter').length === 0 ? 'lose' : null };
    },
  },
  {
    id: 'shore', name: 'The Far Shore', seed: 14, size: 96, aiLevel: null, sea: true, about: 'Docks, fishing, warships and a landing',
    brief: 'Pirates have a stronghold across the lake and their galleys take what they like from it. They have walled the causeway, so the way to them is over the water. Build a Dock, feed your town from the water, sink their ships, then carry your soldiers over and burn them out.',
    setups: [
      base('You', 0x2f7bff, false, 'greece', { age: 1, res: 500, units: { spearman: 4, slinger: 4 } }),
      base('Pirates', 0x5a4a6a, true, 'arabs', { age: 1, units: { spearman: 3, slinger: 2 }, buildings: ['tower'] }),
    ],
    init(g) {
      g.aging = false;
      // The pirates are a stronghold and its guard, not a people: nobody there works or raids.
      for (const u of g.units.filter((x) => x.owner === FOE)) g.cmdStance(FOE, [u.id], 'defensive');
      // They have walled the causeway: the only quick way to them is over the water.
      const hold = g.buildings.find((b) => b.owner === FOE && b.type === 'towncenter');
      if (hold) barLand(g, g.spec.starts[ME].x, g.spec.starts[ME].y + 4, hold, FOE);
      g.scenario = { id: 'shore', n: 0, ids: [] };
    },
    tick(g) {
      const s = g.scenario!;
      const docks = mine(g, 'dock');
      const boats = (type: string) => g.units.filter((u) => u.owner === ME && u.type === type).length;
      // The pirate galleys put out once the player has a boat on the water to lose.
      if (!(s.n & 1) && docks.length && boats('fishboat') > 0) {
        s.n |= 1;
        const mid = g.size / 2;
        for (let i = 0; i < 3; i++) { const at = g.seaPf.nearestFree(mid - 3 + i * 3, mid + (i % 2) * 2); s.ids.push(g.spawnUnit('galley', FOE, at.x, at.y).id); }
        g.cmdMove(FOE, s.ids, docks[0].x, docks[0].y, true); // they come for the boats
        g.events.push({ t: 'msg', player: ME, text: 'Pirate galleys are out on the lake!' });
      }
      const pirates = s.ids.filter((id) => g.entities.has(id)).length;
      if (g.units.some((u) => u.owner === ME && u.type === 'transport' && (u.cargo?.length ?? 0) >= 4)) s.n |= 2;
      const hold = g.buildings.filter((b) => b.owner === FOE && b.type === 'towncenter').length;
      const objectives = [
        { text: 'Build a Dock at the water\'s edge', done: docks.length > 0 },
        { text: 'Launch two Fishing Boats and send them to a shoal', done: boats('fishboat') >= 2 || !!(s.n & 4) },
        { text: s.n & 1 ? `Build War Galleys and sink the pirate ships (${pirates} left)` : 'Build War Galleys: the pirates will not leave your boats alone', done: !!(s.n & 1) && pirates === 0 },
        { text: 'Build a Transport Ship and put four soldiers aboard: right-click it with them', done: !!(s.n & 2) },
        { text: 'Land them on the far shore and destroy the pirates\' Town Center', done: hold === 0 },
      ];
      if (boats('fishboat') >= 2) s.n |= 4;
      return { objectives, result: hold === 0 ? 'win' : mine(g, 'towncenter').length === 0 ? 'lose' : null };
    },
  },
  {
    id: 'wolves', name: 'Wolves of the North', seed: 21, size: 72, aiLevel: 0, about: 'Play the Norse: a war band with no town',
    brief: 'You are a Norse war band with no hall and no fields. The Franks in the next valley have both. Carry off their villagers to swell the tribe, raise a hall when you choose, and grow strong enough that they cannot be rid of you.',
    setups: [base('You', 0x8a5ad0, false, 'wild'), base('Franks', 0x3aa648, true, 'hearth')],
    init(g) {
      g.scenario = { id: 'wolves', n: 0, ids: [] };
    },
    tick(g) {
      const s = g.scenario!;
      const people = g.units.filter((u) => u.owner === ME);
      // Everyone taken into the tribe is counted once, whatever becomes of them afterwards.
      const taken = people.filter((u) => u.story?.some((d) => d.s.startsWith('Taken into'))).length;
      s.n = Math.max(s.n, taken);
      const hall = mine(g, 'towncenter').length > 0;
      const objectives = [
        { text: `Carry off three of the Franks\' villagers: right-click one with a fighter (${Math.min(3, s.n)} of 3)`, done: s.n >= 3 },
        { text: 'Raise a Town Center wherever you choose to settle', done: hall },
        { text: 'Build a House and move a couple in', done: mine(g, 'house').some((b) => b.residents.m && b.residents.f) },
        { text: `Grow the tribe to 18 (now ${people.length})`, done: people.length >= 18 },
      ];
      return { objectives, result: objectives.every((o) => o.done) ? 'win' : people.length === 0 ? 'lose' : null };
    },
  },
  {
    id: 'stockade', name: 'The Stockade', seed: 9, size: 72, aiLevel: null, climate: 'desert', about: 'Egyptians in the desert: get your people out of a Work Camp',
    brief: 'Slavers out of Babylon have carried off six of your people and hold them in a Work Camp beyond the dunes. You need not burn it: stand enough soldiers at its gate and your people are let out one by one. Every guard posted there holds off two of your men.',
    setups: [
      base('You', 0xd8b46a, false, 'egypt', { age: 1, res: 350, units: { spearman: 4 }, buildings: ['barracks'] }),
      { ...base('Babylon', 0x3a8fa8, true, 'babylon', { age: 1, units: { spearman: 3, slinger: 2 }, buildings: ['tavern'] }), virtue: -85 },
    ],
    init(g) {
      g.aging = false;
      const them = g.spec.starts[FOE], us = g.spec.starts[ME];
      for (const u of g.units.filter((x) => x.owner === FOE && g.isMilitary(x))) g.cmdStance(FOE, [u.id], 'defensive');
      // The camp stands on the side of their town that faces ours, with two Slavers on guard.
      const d = Math.hypot(us.x - them.x, us.y - them.y);
      const camp = raise(g, 'workcamp', FOE, them.x + ((us.x - them.x) / d) * 10, them.y + ((us.y - them.y) / d) * 10)!;
      camp.captives = HELD.map(([name, gender]) => ({ from: ME, name, family: '', gender, trait: '', trait2: '', age: 0, lifespan: 9999, story: [{ t: 0, s: 'Seized by slavers' }] }));
      const guards = [0, 1].map((i) => g.spawnUnit('slaver', FOE, camp.x - 1 + i * 2, camp.y + camp.size / 2 + 1).id);
      g.cmdTarget(FOE, guards, camp.id);
      g.players[ME].dilemmaT = 1e9; g.players[FOE].dilemmaT = 1e9;
      g.scenario = { id: 'stockade', n: 0, ids: [camp.id] };
    },
    tick(g) {
      const s = g.scenario!;
      const camp = g.entities.get(s.ids[0]) as Building | undefined;
      const standing = !!camp && !camp.dead;
      const held = standing ? camp.captives?.filter((c) => c.from === ME).length ?? 0 : 0;
      const need = standing ? rescueForce(camp) : 0, there = standing ? rescuers(g, camp, ME).length : 0;
      if (standing && there >= need) s.n |= 1;
      // Once, a Slaver comes for one more: cut him down on the road and whoever he has taken goes free.
      if (!(s.n & 2) && g.time >= 150 && standing) {
        s.n |= 2;
        const prey = g.units.find((u) => u.owner === ME && u.type === 'villager' && !u.inside && u.growT <= 0);
        if (prey) {
          const at = g.pf.nearestFree(camp.x, camp.y + camp.size / 2 + 2);
          const raider = g.spawnUnit('slaver', FOE, at.x, at.y);
          g.cmdTarget(FOE, [raider.id], prey.id);
          g.events.push({ t: 'msg', player: ME, text: 'A Slaver is on the road to your town. Kill him and whoever he has taken goes free.' });
        }
      }
      const home = g.units.filter((u) => u.owner === ME && HELD.some(([name]) => name === u.name)).length;
      const objectives = [
        { text: `Raise your soldiers to eight (now ${soldiers(g).length})`, done: soldiers(g).length >= 8 || held === 0 },
        { text: standing ? `Stand ${need} soldiers at the Work Camp's gate: its guards hold off ${need - 1} (${there} there now)` : 'The Work Camp is burnt: everyone in it ran free', done: !!(s.n & 1) || !standing },
        { text: `Bring your people out (${held} still held, ${home} home)`, done: held === 0 },
        { text: 'Leave the camp standing: you came for your people, not for a burning', done: standing && held === 0 },
      ];
      return { objectives, result: held === 0 ? 'win' : mine(g, 'towncenter').length === 0 ? 'lose' : null };
    },
  },
  {
    id: 'mountain', name: 'The Mountain King', seed: 17, size: 72, aiLevel: null, climate: 'snow', about: 'English in the snow: Prophets against a walled keep',
    brief: 'A lord of the Japanese sits behind old stone in the high snow, and your soldiers are too few to storm it. You have two Prophets. Shake his wall down, sicken his garrison, blight his fields or set his roofs alight, and then go in.',
    setups: [
      base('You', 0xc83a3a, false, 'england', { age: 2, res: 500, units: { swordsman: 5, bowman: 4, prophet: 2 }, buildings: ['temple', 'barracks'] }),
      base('The Mountain King', 0xd8d8e8, true, 'japan', { age: 2, units: { spearman: 6, bowman: 5 }, buildings: ['farm', 'farm', 'farm'] }),
    ],
    init(g) {
      g.aging = false;
      const st = g.spec.starts[FOE];
      ring(g, FOE, Math.floor(st.x), Math.floor(st.y), 8, 'stonewall');
      // Old stone, cracked by a hundred winters: one Earthquake brings down whatever stretch it falls on.
      for (const b of g.buildings) if (b.owner === FOE && b.type === 'stonewall') b.hp = b.maxHp = 290;
      // The garrison keeps inside the wall and comes out for nobody.
      for (const u of g.units.filter((x) => x.owner === FOE && g.isMilitary(x))) {
        const at = g.pf.nearestFree(st.x + ((u.id * 7) % 9) - 4, st.y + 4 + ((u.id * 3) % 3));
        u.x = at.x; u.y = at.y;
        g.cmdStance(FOE, [u.id], 'hold');
      }
      for (const u of g.units.filter((x) => x.owner === ME && x.def.mana)) u.mana = u.def.mana!;
      g.players[ME].dilemmaT = 1e9; g.players[FOE].dilemmaT = 1e9;
      g.scenario = { id: 'mountain', n: 0, ids: [] };
    },
    tick(g) {
      const s = g.scenario!;
      // Each calamity is remembered once it has been seen to fall on them.
      if (g.quakes.some((q) => q.owner === ME)) s.n |= 1;
      if (g.units.some((u) => u.owner === FOE && u.plagueT > 0)) s.n |= 2;
      if (g.buildings.some((b) => b.owner === FOE && (b.burnT > 0 || (b.blightT ?? 0) > 0))) s.n |= 4;
      const keep = g.buildings.filter((b) => b.owner === FOE && b.type === 'towncenter').length;
      const prophets = g.units.filter((u) => u.owner === ME && u.def.mana);
      const faith = prophets.length ? Math.floor(Math.max(...prophets.map((u) => u.mana))) : 0;
      const objectives = [
        { text: 'Call an Earthquake down on his wall: select a Prophet and choose it', done: !!(s.n & 1) },
        { text: 'Send a Plague among his garrison', done: !!(s.n & 2) },
        { text: 'Blight his farms or set his buildings alight', done: !!(s.n & 4) },
        { text: `Break in and destroy his Town Center (${prophets.length ? `faith ${faith}: it comes back with time` : 'your Prophets are dead: the Church can call more'})`, done: keep === 0 },
      ];
      return { objectives, result: keep === 0 ? 'win' : mine(g, 'towncenter').length === 0 ? 'lose' : null };
    },
  },
];

export const missionById = (id: string): Mission | undefined => MISSIONS.find((m) => m.id === id);

/** Advance a mission by one second and end the game if it has been won or lost. */
export function runMission(g: Game, m: Mission): MissionStatus {
  const status = m.tick(g);
  if (status.result && g.winner < 0) {
    g.winner = status.result === 'win' ? ME : FOE;
    g.events.push({ t: 'gameover', winner: g.winner });
  }
  return status;
}
