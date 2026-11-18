/**
 * A noble's faith, and the plot of one who is not of the leader's (docs/DESIGN.md, "Claimants to the throne").
 *
 * Faith in this game is a town's (townfaith.ts) and, through its towns, a nation's. A noble keeps the faith of the
 * town he holds or lives in: its creed is his. He is "not of the leader's faith" when that creed is not the
 * nation's own. Such a noble, when he is angry, is the likelier to be the one who plots for the leader's place
 * (`OTHER.weight` times as likely as an angry noble of the leader's faith), and a plot of his is a plot over faith
 * (`Intrigue.faith`). This begins no plot that would not have begun: it says who, and why.
 */
import type { Campaign } from './campaign';
import type { Noble } from './nobles';
import { creedOf } from './creed';
import { faithAt, nationVirtue } from './townfaith';

export const OTHER = {
  /** How many times likelier an angry noble of another faith is to be the plotter than one of the leader's. */
  weight: 3,
};
declare module './intriguebase' {
  interface Intrigue {
    /** A plot (courtstory.ts) by a noble who is not of the leader's faith (noblefaith.ts). */
    faith?: boolean;
  }
}

/** The creed a noble keeps: his town's. */
export const nobleCreed = (c: Campaign, n: Noble): string => creedOf(faithAt(c, n.town)).id;
/** The creed of a people as a whole, which is its leader's. */
export const leaderCreed = (c: Campaign, f: number): string => creedOf(nationVirtue(c, f)).id;
/** Is this noble of another faith than the leader he serves? */
export const otherFaith = (c: Campaign, f: number, n: Noble): boolean => nobleCreed(c, n) !== leaderCreed(c, f);

/** Which of the angry nobles plots: by a roll of 0..1, one of another faith counting `OTHER.weight` times. */
export function plotterOf(c: Campaign, f: number, angry: Noble[], roll: number): Noble | undefined {
  if (!angry.length) return undefined;
  const w = angry.map((n) => (otherFaith(c, f, n) ? OTHER.weight : 1)), all = w.reduce((s, x) => s + x, 0);
  let at = Math.max(0, Math.min(0.999999, roll)) * all;
  for (let i = 0; i < angry.length; i++) { at -= w[i]; if (at < 0) return angry[i]; }
  return angry[angry.length - 1];
}
