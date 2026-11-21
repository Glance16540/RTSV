/**
 * Getting out of a Work Camp, as a scene (docs/DESIGN.md, "Captivity": what is shown of it). The rules are
 * captivity.ts's and are not changed here: by night a captive no guard watches may slip away, and a camp with
 * enough men unwatched may rise, fire the place and half of all it holds break out at once. Until now both were
 * told in a line and marked at the gate. Here the people who got out are marked for a short while with how they
 * came out, so that whoever draws the field can show it:
 *   - `slip`: one who slipped away keeps low and goes quietly for `OUT.slip` seconds;
 *   - `rise`: those who rose come out together with brands from the fire they set, for `OUT.rise` seconds.
 * Nothing else: no one moves faster or slower for it, nobody is hurt by it, and nothing is decided by it. Those
 * who come out are the grown men and women the camp held, clothed as any of their people are; a child born in
 * a camp is a record on its mother (captivity.ts) and is never on the field at all.
 */
import type { Game, Unit } from './game';

export type OutHow = 'slip' | 'rise';
export const OUT = {
  /** Seconds one who slipped away keeps low; seconds those who rose carry their brands. */
  slip: 14, rise: 10,
};
declare module './game' {
  interface Unit { /** How this person came out of a camp, and when (campout.ts): for the drawing only. */ out?: { how: OutHow; at: number } }
}
/** Mark someone who has just got out of a camp. */
export function cameOut(g: Game, u: Unit, how: OutHow): void { u.out = { how, at: g.time }; }
/** How this person is to be shown just now: '' once the scene is over, or for anyone who never came out of a camp. */
export function outScene(g: Game, u: Unit): OutHow | '' {
  const o = u.out;
  if (!o || u.dead) return '';
  return g.time - o.at <= OUT[o.how] ? o.how : '';
}
/** Everyone on the field in such a scene now, for whoever draws it or tells of it. */
export const outNow = (g: Game): { u: Unit; how: OutHow }[] => g.units.flatMap((u) => { const how = outScene(g, u); return how ? [{ u, how }] : []; });
