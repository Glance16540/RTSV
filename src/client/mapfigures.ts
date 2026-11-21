// The figures and names in the map's prompts and panels, as a player reads them (docs/PLAYTEST.md, finding 12).
//
// A strength, a defence or the odds of a fight is told as a whole number everywhere on the map, by the one rule
// (strengthwords.ts `whole`: under a half is "a little"); the rules keep their fractions. And a people, a tribe or a
// band is named as English has it in a sentence: "the Greeks' defence", "the Local Tribe marches", "the Japanese
// march". Plain text, no DOM: the panels put these into their own markup.
import type { Campaign } from '../sim/campaign';
import { LOCALS } from '../sim/campaign';
import { peopleName, possessive } from '../sim/naming';
import { whole } from '../sim/strengthwords';

/** A strength or a defence as the map tells it: a whole number. */
export const fig = (x: number): string => whole(Number.isFinite(x) ? Math.max(0, x) : 0);

/** How often in a hundred, from a chance of 0 to 1: a whole number, never below 0 or above 100. */
export const inHundred = (chance: number): number => Math.round(Math.max(0, Math.min(1, Number.isFinite(chance) ? chance : 0)) * 100);

/** Is this other side one body ("the Local Tribe marches") and not a people ("the Greeks march")? */
const single = (foe: number): boolean => foe < 0;
/** The other side in a sentence: "the Local Tribe", "the Greeks". `start`: at the head of one. */
export function theFoe(c: Campaign, foe: number, start = false): string {
  const name = foe < 0 ? LOCALS.name : peopleName(c, foe);
  return `${start ? 'The' : 'the'} ${name}`;
}
/** Whose, of the other side: "the Local Tribe's", "the Greeks'", "the Japanese". */
export const foesOwn = (c: Campaign, foe: number): string => possessive(foe < 0 ? LOCALS.name : peopleName(c, foe));

/** The two sides of a battle about to be fought with a nation or a tribe, in a sentence. `attacking`: the player is the attacker. */
export function sidesLine(c: Campaign, p: { aStr: number; dStr: number }, foe: number, attacking: boolean): string {
  return attacking
    ? `Your strength of ${fig(p.aStr)} against ${foesOwn(c, foe)} defence of ${fig(p.dStr)}.`
    : `${theFoe(c, foe, true)} ${single(foe) ? 'marches' : 'march'} with a strength of ${fig(p.aStr)} against your defence of ${fig(p.dStr)}.`;
}
/** "Auto-resolving, you would win about 62 times in 100." */
export const oddsLine = (chance: number): string => `Auto-resolving, you would win about ${inHundred(chance)} times in 100.`;
/** An army's heading in a land's panel. */
export const armyHeading = (strength: number): string => `Army, strength ${fig(strength)}`;
