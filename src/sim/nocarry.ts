// The decree that forbids carrying people off (docs/DESIGN.md, "The player chooses whether to carry people off", the
// owner's word, 21 November 2026: "a nation of low standing carries people off from a town it takes, the player's as a
// rival's; the player may forbid it by decree, and then none are taken. Grown only, never a child, nothing shown").
//
// The other decrees are given to one town for a few seasons (decrees.ts). This one is a law of the whole nation: it is
// given once, costs nothing to give, and stands until the leader lifts it.
//
//   While it stands. The nation's armies lead nobody away from a town they take, whatever the people's standing
//     (carriedoff.ts `carriesOff` reads `Faction.noCarry`). Those already held are held as they were: the law forbids
//     the taking and does not send anyone home (take back the land they are held in for that, as ever).
//   What it costs. Nothing, among a people of Common standing or better: they would have taken nobody. Among a
//     Dissolute or Depraved people it is resented by those who would have had the gain: each season it stands, each of
//     the nation's worldly and martial nobles likes the leader a little less (NOCARRY.resent), and each of the pious and
//     the kindly a little more (NOCARRY.warm). Small on purpose: it never by itself turns a contented lord angry in a
//     season, but years of it tell.
//   Whose. Any nation may keep it; only the player has a way to give it. A rival does as its standing has it.
//
// It writes the nation's law and its nobles' moods, and reads the people's standing.
import type { Campaign } from './campaign';
import { CARRY } from './carriedoff';
import { creedOf } from './creed';
import { noblesOf } from './nobles';

declare module './campaign' {
  interface Faction { /** The leader has forbidden carrying people off from towns the nation takes (nocarry.ts). */ noCarry?: boolean }
}

export const NOCARRY = {
  /** What the mood of each worldly or martial noble moves by each season the law stands over a people who would have carried off; and each pious or kindly one. */
  resent: -2, warm: 1,
};

/** Has this nation forbidden carrying people off? */
export const forbidsCarrying = (c: Campaign, f: number): boolean => !!c.factions[f]?.noCarry;
/** Would this people carry off, by their standing, if nothing forbade it? */
export const wouldCarry = (c: Campaign, f: number): boolean => { const fac = c.factions[f]; return !!fac && fac.alive && CARRY.creeds.includes(creedOf(fac.virtue ?? 0).id); };

/** Give the law, or lift it. Returns whether anything changed. The player is told in a plain line. */
export function forbidCarrying(c: Campaign, f: number, on: boolean): boolean {
  const fac = c.factions[f];
  if (!fac || !fac.alive || !!fac.noCarry === on) return false;
  if (on) fac.noCarry = true; else delete fac.noCarry;
  if (f === 0) c.log.push(on
    ? `📜 You have forbidden it: your armies lead nobody away from a town they take.${wouldCarry(c, f) ? ' Some of your lords will not thank you.' : ''}`
    : `📜 The law against carrying people off is lifted.${wouldCarry(c, f) ? ' Your armies will lead people away from the towns they take, as a people of your standing does.' : ''}`);
  return true;
}

/** The line for the decrees panel: how the law stands, and what that means now. */
export function noCarryLine(c: Campaign, f: number): string {
  const would = wouldCarry(c, f);
  if (forbidsCarrying(c, f)) return `Carrying people off is forbidden by your law: your armies take nobody from a town they take.${would ? ' Your worldly and martial lords resent it a little more each season.' : ''}`;
  return would
    ? 'Your people are of a standing that carries people off: when your armies take another nation\'s town, some of its grown people are led away. You may forbid it.'
    : 'Your people carry nobody off from a town they take; they would if their standing fell to Dissolute or lower, unless you forbid it.';
}

/** A season of the law: where it stands over a people who would have carried off, its lords take it as they are. Returns how many moods moved. */
export function noCarrySeason(c: Campaign): number {
  let moved = 0;
  for (const fac of c.factions) {
    if (!fac.alive || !fac.noCarry || !wouldCarry(c, fac.id)) continue;
    for (const n of noblesOf(c, fac.id)) {
      const by = n.leaning === 'worldly' || n.leaning === 'martial' ? NOCARRY.resent : NOCARRY.warm;
      n.mood = Math.max(-100, Math.min(100, n.mood + by));
      moved++;
    }
  }
  return moved;
}
