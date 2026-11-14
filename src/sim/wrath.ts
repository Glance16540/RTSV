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
// readily fire spreads to them and how long what has caught burns (calamity.ts, game.ts); how fast a famine takes
// people and how soon sickness follows it (famine.ts). It does not soften what an enemy does with his own hands:
// a Prophet's fire burns the building it is called down on for as long as ever.
import type { Game } from './game';

/** The measure for this people: 1 for an ordinary town, and for anything that is nobody's (the wild, the neutral). */
export function wrath(g: Game, owner: number): number {
  const p = g.players[owner];
  return !p || p.neutral || owner === g.wild ? 1 : g.creed(owner).plague;
}
