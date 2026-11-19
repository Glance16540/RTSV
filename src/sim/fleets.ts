// Each people's fleet (the board's "Navy": two warships, the same for every nation). The two hulls keep their roles: a
// warship of the first ages (the War Galley's, trained at the Dock) and a gunpowder warship (the Frigate's, that Ships of
// the Line turns them into). Each people builds its own kind of each, by the waters it comes from, with stats that differ
// modestly and a look of its own (src/client/models.ts):
//   - longships, for the North (the Norse, the English, the Franks): quick and light, and the Galleon after;
//   - galleys, for the Middle Sea and the rivers of the old East (Romans, Greeks, Persians, Egyptians, Babylonians,
//     Arameans): the Trireme, a heavier ram-ship of shorter reach, and the Galleass after; both ram a ship that comes close
//     (RAM: a blow that lands RAM.mult as hard, at once, in place of a shot);
//   - dhows, for the Indian Ocean and the Red Sea (Abbasids, Malians, Kushites): reaching farther, cheaper, lighter in
//     the blow, and the Ghurab after;
//   - junks, for the China Seas (Chinese, Japanese, Mongols): tough and armoured, slower, and the Tower Ship after.
// They come where upgrades already come (Game.trainedAs, as its last step, so nothing new is kept in a save): a people's
// Dock trains a War Galley and gets its own, and Ships of the Line turns War Galleys into Frigates and so into its own. Nothing else changes: the same building, the same
// study, the same roles for the computer. A people not listed keeps the War Galley and the Frigate.
import { UNITS } from './data';
import type { UnitDef } from './data';

declare module './data' {
  interface UnitDef {
    /** A people's own ship (fleets.ts): the hull it stands for, 'galley' or 'frigate'. */
    fleetOf?: string;
    /** A ram-ship (fleets.ts): it rams a ship close by instead of shooting. */
    ram?: boolean;
  }
}

/** A fleet: what a people builds in the War Galley's place and in the Frigate's. */
export interface Fleet { family: string; galley: string; frigate: string }

/** The kinds, as changes on the War Galley or the Frigate they stand for. Modest: health, attack, reach and speed move by a sixth at most, armour by one point. */
const KINDS: Record<string, { base: 'galley' | 'frigate'; name: string; icon: string; desc: string; over: Partial<UnitDef> }> = {
  longship: { base: 'galley', name: 'Longship', icon: '⛵', desc: 'A warship of the North: quick and light under oar and sail, it sinks boats and rakes the shore.', over: { speed: 3.0, hp: 125, cost: { wood: 85, gold: 35 } } },
  galleon: { base: 'frigate', name: 'Galleon', icon: '🚢', desc: 'A gunpowder warship of the North: tall and deep, its broadside breaks buildings.', over: { hp: 290, speed: 2.25 } },
  trireme: { base: 'galley', name: 'Trireme', icon: '⛵', desc: 'A warship of the Middle Sea: a heavier ram-ship that strikes hard close in.', over: { hp: 155, atk: 10, range: 5, ram: true } },
  galleass: { base: 'frigate', name: 'Galleass', icon: '🚢', desc: 'A gunpowder warship of oars and guns: heavy and close-fighting.', over: { hp: 280, atk: 26, range: 7, speed: 2.25, ram: true } },
  dhow: { base: 'galley', name: 'Dhow', icon: '⛵', desc: 'A warship of the southern seas: lateen-rigged and reaching far, lighter in the blow.', over: { atk: 8, range: 7, cost: { wood: 85, gold: 30 } } },
  ghurab: { base: 'frigate', name: 'Ghurab', icon: '🚢', desc: 'A gunpowder warship of the southern seas: quick, long-reaching, lighter built.', over: { hp: 240, atk: 22, range: 9, speed: 2.6 } },
  junk: { base: 'galley', name: 'War Junk', icon: '⛵', desc: 'A warship of the China Seas: tough and armoured, slower under sail.', over: { hp: 160, armor: 2, speed: 2.3 } },
  towership: { base: 'frigate', name: 'Tower Ship', icon: '🚢', desc: 'A gunpowder warship of the China Seas: a floating fortress, slow and hard to break.', over: { hp: 300, armor: 3, speed: 2.1 } },
};

/** Which fleet each people builds. */
export const FLEETS: Record<string, Fleet> = {};
const families: [string, string[], string, string][] = [
  ['longships', ['wild', 'england', 'hearth'], 'longship', 'galleon'],
  ['galleys', ['stonekin', 'greece', 'persia', 'egypt', 'babylon', 'dawn'], 'trireme', 'galleass'],
  ['dhows', ['arabs', 'mali', 'kush'], 'dhow', 'ghurab'],
  ['junks', ['forge', 'japan', 'steppe'], 'junk', 'towership'],
];
for (const [family, civs, galley, frigate] of families) for (const civ of civs) FLEETS[civ] = { family, galley, frigate };

// The kinds are units like any other: each the hull it stands for, changed modestly.
for (const [id, k] of Object.entries(KINDS)) if (!UNITS[id]) UNITS[id] = { ...UNITS[k.base], ...k.over, id, name: k.name, icon: k.icon, desc: k.desc, fleetOf: k.base };

/** The ram: a ram-ship (the Trireme, the Galleass) strikes a ship within `reach` tiles by ramming it, a blow `mult` times its own. */
export const RAM = { reach: 1.8, mult: 2.2 };

/** How much harder this blow lands for being a ram: RAM.mult where a ram-ship strikes a ship close by, else 1. */
export function ramBlow(u: { def: UnitDef; x: number; y: number }, t: { kind: string; x: number; y: number; def?: unknown }): number {
  const d = t.def as UnitDef | undefined;
  if (!u.def.ram || t.kind !== 'unit' || !d?.naval) return 1;
  return Math.hypot(u.x - t.x, u.y - t.y) <= RAM.reach + u.def.radius + (d.radius ?? 0) ? RAM.mult : 1;
}

/** The hull a people's own ship stands for ('galley' or 'frigate'), or the type itself. */
export const hullOf = (type: string): string => UNITS[type]?.fleetOf ?? type;

/** What a people builds in place of a hull: its own kind of War Galley or Frigate, or the type itself (Game.trainedAs's last step). */
export const fleetKind = (civ: string, type: string): string => (type === 'galley' ? FLEETS[civ]?.galley : type === 'frigate' ? FLEETS[civ]?.frigate : undefined) ?? type;
