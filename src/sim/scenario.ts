// Scripted missions: a fixed set-up, a list of objectives and a win or lose condition.
// Pure rules, so they can be run headless.

import type { Game, PlayerSetup } from './game';

export interface Objective { text: string; done: boolean }
export interface MissionStatus { objectives: Objective[]; result: 'win' | 'lose' | null }

export interface Mission {
  id: string;
  name: string;
  brief: string;
  seed: number;
  size: number;
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

export const MISSIONS: Mission[] = [
  {
    id: 'hearth', name: 'First Hearth', seed: 5, size: 72, aiLevel: null,
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
    id: 'line', name: 'Hold the Line', seed: 12, size: 72, aiLevel: null,
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
    id: 'wonder', name: 'Race for the Wonder', seed: 31, size: 96, aiLevel: 2,
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
