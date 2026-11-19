// The Steward: a third calling for a nation's leader (the board's "The leader on the field": two callings only). The
// Warlord leads the fight and the Strategist guards the line; the Steward keeps the town: a battle is the close view of
// a town (docs/DESIGN.md), and its leader is there among its people as well as its soldiers.
//   - Presence: villagers of theirs within reach gather and build STEWARD.work times as fast (and mend at that pace).
//     They fight in the line with a short blade, a little weaker than a Warlord and with no lift to those about them.
//   - Their call, "Man the walls": for CALL_LASTS seconds every building of theirs within reach takes STEWARD.ward of
//     the harm done it, as the Strategist's call wards soldiers.
//   - Powers at Blooded, Veteran and Legend, two to choose from at each, as for the other callings (powers.ts).
// Nobody else is changed: no rival is made a Steward (powers.ts keeps each people's leader as it was), so the battles
// play as before unless a player chooses one. The unit is raised at the Town Center, from the Bronze Age, as the others are.
import { UNITS } from './data';
import type { UnitDef } from './data';
import type { Entity, Game, Unit } from './game';

declare module './data' {
  interface UnitDef {
    /** A Steward's presence (steward.ts): villagers of theirs within reach gather and build this many times as fast. */
    workAura?: number;
  }
}

export const STEWARD = {
  /** How much faster villagers within the Steward's reach gather, build and mend. */
  work: 1.25,
  /** The share of harm a building within reach takes while their call is sounding. */
  ward: 0.6,
};

// The Steward is a unit like the other heroes: the Strategist's frame, with a blade in place of a sling and none of its
// warding of soldiers or mending of the wounded.
if (!UNITS.steward) {
  const { projectile: _p, weaken: _w, heal: _h, ...frame } = UNITS.strategist;
  UNITS.steward = {
    ...frame, id: 'steward', name: 'Steward', icon: '🏛️',
    desc: `Hero. Only one may live at a time. Villagers working near the Steward gather and build ${Math.round((STEWARD.work - 1) * 100)}% faster.`,
    cost: { food: 150, wood: 100, gold: 100 }, age: 1, hp: 380, atk: 11, armor: 3, range: 0.6, speed: 2.4, cooldown: 1.4, radius: 0.36,
    auraRange: 7, workAura: STEWARD.work,
  };
}

/** Their call, raised by hand from Seasoned: buildings within reach take STEWARD.ward of the harm done them. */
export const STEWARD_CALL = { name: 'Man the walls', desc: `For 12 seconds every building of yours within their reach takes ${Math.round((1 - STEWARD.ward) * 100)}% less harm.`, ward: STEWARD.ward };

/** Their powers, in the shape of powers.ts's: two at each of the three ranks. */
export const STEWARD_POWERS: [{ name: string; desc: string; mod: (d: UnitDef) => Partial<UnitDef> }, { name: string; desc: string; mod: (d: UnitDef) => Partial<UnitDef> }][] = [
  [{ name: 'Master of works', desc: 'Villagers near them work 40% faster, not 25%.', mod: () => ({ workAura: 1.4 }) },
    { name: 'The long road', desc: 'Their presence reaches three tiles farther.', mod: (d) => ({ auraRange: (d.auraRange ?? 0) + 3 }) }],
  [{ name: 'Shield high', desc: 'Arrows, bolts and shot do them 40% less harm.', mod: () => ({ rangedResist: 0.4 }) },
    { name: 'Hard as the walls', desc: 'Two more points of armour.', mod: (d) => ({ armor: d.armor + 2 }) }],
  [{ name: 'By example', desc: 'Those fighting near them strike 10% harder.', mod: () => ({ aura: 1.1 }) },
    { name: 'Their own people', desc: 'They mend the wounded near them, slowly.', mod: () => ({ heal: 2 }) }],
];

/** How much faster a villager works for the Steward being near: their presence, or 1. */
export function stewardPace(g: Game, u: Unit): number {
  const l = g.leaders[u.owner];
  if (!l || l.dead || l.inside || !l.def.workAura || u.def.cls !== 'villager') return 1;
  return Math.hypot(l.x - u.x, l.y - u.y) <= (l.def.auraRange ?? 0) ? l.def.workAura : 1;
}

/** What a blow on a building is multiplied by while a Steward's call sounds over it: STEWARD_CALL.ward, or 1. */
export const stewardWard = (g: Game, t: Entity): number => (t.kind === 'building' && g.calledAt(t.owner, t.x, t.y) === 'steward' ? STEWARD_CALL.ward : 1);
