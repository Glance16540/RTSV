// Scripted missions: a fixed set-up, a list of objectives and a win or lose condition.
// Pure rules, so they can be run headless.

import type { Game, PlayerSetup } from './game';
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
    brief: 'Pirates have a stronghold across the lake and their galleys take what they like from it. Build a Dock, feed your town from the water, sink their ships, then carry your soldiers over and burn them out.',
    setups: [
      base('You', 0x2f7bff, false, 'greece', { age: 1, res: 500, units: { spearman: 4, slinger: 4 } }),
      base('Pirates', 0x5a4a6a, true, 'arabs', { age: 1, units: { spearman: 3, slinger: 2 }, buildings: ['tower'] }),
    ],
    init(g) {
      g.aging = false;
      // The pirates are a stronghold and its guard, not a people: nobody there works or raids.
      for (const u of g.units.filter((x) => x.owner === FOE)) g.cmdStance(FOE, [u.id], 'defensive');
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
