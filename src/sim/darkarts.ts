/**
 * The Shaman's dark calamities, and the mirror he makes with the Prophet (docs/DESIGN.md, "The Prophet and the
 * Shaman are a mirror pair", the owner's word).
 *
 * The Prophet is a town of good standing's caster: only a town on the top two steps of standing trains him
 * (`needs: 'holy'`), and his four calamities are as they were. The Shaman is a town of low standing's: only a
 * town on the bottom two steps trains him (`needs: 'low'`; the old rule, "pagan: a town that keeps the faith
 * will not have him", is gone in favour of this), and a town in the middle trains neither. He spends faith as
 * the Prophet does, on three calamities of his own:
 *
 *   - Curse: enemy soldiers in the place strike weaker for a time (`DARK.curse`, `DARK.cursed` seconds).
 *   - Blight: the Prophet's own, on enemy fields and berries (data.ts `CALAMITY.blight`); one rule, two casters.
 *   - Sickness: enemy units in the place sicken as with plague, for a shorter time (`DARK.sick` seconds), and it
 *     spreads between them as plague does (contagion.ts).
 *
 * Each falls by the standing of those it strikes, through the one measure every act of God uses (wrath.ts): a
 * third as long on the top step, half on the next, a quarter longer and half again as long on the two bottom
 * steps. Nothing here is drawn, and none of it touches a child: children are records, and a curse is on soldiers.
 *
 * He keeps his healing. A town of low standing has no Priest (who is the top steps'), so the Shaman is still its
 * healer and the one who cures its plague; the Prophet never healed, and the mirror is in who calls down what,
 * not in taking a low town's only healer from it. His faith comes back the faster the lower his town has sunk
 * (`darkFaith`), as the Prophet's does the higher his has risen.
 *
 * `castDark` is what game.ts calls when a cast lands; `darkChoice` is what the computer asks (ai.ts): where he is
 * worth most, sickness on a knot of soldiers, a curse on men already fighting, blight on a rival's fields.
 */
import type { Building, Game, Unit } from './game';
import { ABILITIES } from './data';
import { wrath } from './wrath';

export const DARK = {
  /** A cursed soldier's blows are worth this much of what they were, for `cursed` seconds on an ordinary town's men. */
  curse: 0.7, cursed: 25,
  /** Seconds of sickness on an ordinary town's people (the Prophet's plague is 20). */
  sick: 12,
  /** The faith a Shaman holds, and the tiles within which the computer's looks for something to strike. */
  faith: 80, looks: 11,
};
/** The Prophet's calamities, and the Shaman's. A unit with faith casts only its own. */
export const PROPHET_CASTS = ['plague', 'quake', 'fire', 'blight'];
export const SHAMAN_CASTS = ['curse', 'blight', 'sickness'];
export const castsOf = (type: string): string[] => (type === 'shaman' ? SHAMAN_CASTS : PROPHET_CASTS);
/** The lowest two steps of standing: Dissolute and Depraved (creed.ts ids worldly and decadent). */
export const isLow = (virtue: number): boolean => virtue <= -30;

declare module './game' {
  interface Unit { /** The game's time until which this soldier is cursed, and strikes weaker (darkarts.ts). */ cursedUntil?: number }
}

/** What a unit's blows are worth now: `DARK.curse` while cursed, else all of it. */
export const cursed = (g: Game, u: Unit): number => ((u.cursedUntil ?? 0) > g.time ? DARK.curse : 1);
/** How fast faith comes back to a caster by his town's standing: the Prophet's by the creed's own figure, the Shaman's by its mirror. */
export const darkFaith = (g: Game, u: Unit): number => { const f = g.creed(u.owner).faith; return u.type === 'shaman' ? Math.max(0.5, 2 - f) : f; };

/** One of the Shaman's own calamities lands. Returns false for anything that is not his alone (blight is the Prophet's rule, in game.ts). */
export function castDark(g: Game, u: Unit, ability: string, x: number, y: number): boolean {
  const a = ABILITIES[ability];
  if (!a || (ability !== 'curse' && ability !== 'sickness')) return false;
  for (const v of g.units) {
    if (v.dead || !g.hostile(v.owner, u.owner) || Math.hypot(v.x - x, v.y - y) > a.radius) continue;
    const k = wrath(g, v.owner); // by the standing of those it falls on
    if (ability === 'curse') { if (g.isMilitary(v)) v.cursedUntil = Math.max(v.cursedUntil ?? 0, g.time + DARK.cursed * k); }
    else if (k > 0) v.plagueT = Math.max(v.plagueT, DARK.sick * k);
  }
  g.events.push({ t: ability === 'curse' ? 'curse' : 'plague', x, y });
  return true;
}

/** What the computer's Shaman would cast now, and where: or null. */
export function darkChoice(g: Game, pid: number, u: Unit): { ability: string; x: number; y: number } | null {
  if (u.type !== 'shaman' || !u.def.mana) return null;
  const near = <T extends { x: number; y: number }>(xs: T[]): T[] => xs.filter((v) => Math.hypot(v.x - u.x, v.y - u.y) < DARK.looks);
  const foes = near(g.units.filter((v) => g.hostile(v.owner, pid) && v.owner !== g.wild && !v.dead));
  const soldiers = foes.filter((v) => g.isMilitary(v));
  if (u.mana >= ABILITIES.curse.cost) {
    const fresh = soldiers.filter((v) => (v.cursedUntil ?? 0) <= g.time);
    if (fresh.length >= 3) return { ability: 'curse', x: fresh[0].x, y: fresh[0].y };
  }
  if (u.mana >= ABILITIES.sickness.cost) {
    const well = foes.filter((v) => v.plagueT <= 0);
    if (well.length >= 3) return { ability: 'sickness', x: well[0].x, y: well[0].y };
  }
  if (u.mana >= ABILITIES.blight.cost) {
    const farms = near(g.buildings.filter((b: Building) => b.type === 'farm' && !b.blightT && g.hostile(b.owner, pid)));
    if (farms.length >= 2) return { ability: 'blight', x: farms[0].x, y: farms[0].y };
  }
  return null;
}
