// How hard acts of God fall on a people (docs/DESIGN.md, "Acts of God").
//
// Famine, plague and fire spare nobody, but they fall harder on the decadent than on the holy. One number says
// how hard: 1 for an ordinary town, a third for the Righteous, a half for the Devout, a quarter more for the
// Worldly and half again for the Decadent. It is the creed's `plague` figure (src/sim/creed.ts), which used to
// govern plague alone. Each rule applies it twice, to how often the thing comes and to how bad it is when it
// does, so that a Righteous town is struck a third as often and a third as hard, and very rarely hard at all.
//
// What it governs: how readily plague is caught and how long it lasts (contagion.ts, and a Prophet's plague in
// game.ts); how often lightning and accident find a people's buildings and how long those fires burn, and how
// readily fire spreads to them and how long what has caught burns (calamity.ts, game.ts); how often a
// harvest fails and on how many fields, how fast a famine takes people and how soon sickness follows it (famine.ts). It does not soften what an enemy does with his own hands:
// a Prophet's fire burns the building it is called down on for as long as ever.
import type { Game } from './game';

/** The measure for this people: 1 for an ordinary town, and for anything that is nobody's (the wild, the neutral). */
export function wrath(g: Game, owner: number): number {
  const p = g.players[owner];
  return !p || p.neutral || owner === g.wild ? 1 : g.creed(owner).plague;
}

/** A chance in [0, 1) from the tick, the match's seed and a number of its own, each one unrelated to the others. */
export const roll = (g: Game, salt: number): number => {
  let h = Math.imul(g.tick ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(g.seed + salt, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
