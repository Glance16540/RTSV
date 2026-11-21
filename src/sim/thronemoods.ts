// How a nation's lords take a succession (docs/CLOSING.md, "Claimants to the throne": the player's own succession
// is asked of the player, and what each choice costs is said; succession.ts). Two things move their moods
// (nobles.ts), once, as the new ruler takes up the rule:
//   - A claimant who stood in arms is crowned (claimantrising.ts crown): the lord who held the claimant and proclaimed
//     them is pleased (THRONE_MOODS.raised); every other noble of the nation takes the one who rose against the throne
//     ill (THRONE_MOODS.usurper).
//   - A captain is raised, or a stranger hired, while one of the blood could have ruled (an heir of the house of age,
//     a child of both houses, a claimant in arms): every noble takes the blood set aside ill (THRONE_MOODS.setAside).
// An heir of the house, or a child of both houses, taken up moves nobody: that is the order of things.
import type { Campaign } from './campaign';
import { isAngry, noblesOf, titleOf } from './nobles';

export const THRONE_MOODS = {
  /** The lord who held a claimant crowned: his mood rises by this much. */
  raised: 30,
  /** Every other noble, at a claimant in arms crowned. */
  usurper: 15,
  /** Every noble, at the blood set aside for a captain or a stranger. */
  setAside: 20,
};

const shift = (c: Campaign, f: number, by: (key: string) => number, why: string): void => {
  for (const n of noblesOf(c, f)) {
    const d = by(n.key);
    if (!d) continue;
    const was = isAngry(n);
    n.mood = Math.max(-100, Math.min(100, n.mood + d));
    if (f === 0 && !was && isAngry(n)) c.log.push(`${titleOf(c, n)} is angered: ${why}.`);
  }
};

/** A claimant who stood in arms takes the throne of people `f`: `key`, the noble who held them, if a noble did. */
export function crownedMoods(c: Campaign, f: number, key?: string): void {
  shift(c, f, (k) => (k === key ? THRONE_MOODS.raised : -THRONE_MOODS.usurper), 'one who rose against the throne sits on it');
}

/** A captain or a stranger takes up the rule of people `f` while one of the blood could have. */
export function setAsideMoods(c: Campaign, f: number): void {
  shift(c, f, () => -THRONE_MOODS.setAside, 'the blood of the house is set aside');
}
