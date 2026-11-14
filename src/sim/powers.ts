// What a leader learns as they rise. At three ranks of veterancy (Blooded, Veteran, Legend) a leader comes into one
// of two powers, chosen for them when they are made. A power changes what the leader is on the field: how far their
// presence reaches, what it does to friend and foe, how they stand a blow. Also here: the leader a rival people has
// when nobody has made one for them, built to suit how that people lives.

import { CIV_STYLE, StyleId, UnitDef } from './data';
import { Calling, HeroSpec, cleanHero } from './hero';

/** The ranks at which a power is come into. */
export const POWER_RANKS = [1, 3, 5];

export interface Power { name: string; desc: string; mod: (d: UnitDef) => Partial<UnitDef> }

export const POWERS: Record<Calling, [Power, Power][]> = {
  warlord: [
    [{ name: 'Battle cry', desc: 'Those fighting near them strike 35% harder, not 25%.', mod: () => ({ aura: 1.35 }) },
      { name: 'The long banner', desc: 'Their presence reaches three tiles farther.', mod: (d) => ({ auraRange: (d.auraRange ?? 0) + 3 }) }],
    [{ name: 'Drinker of blood', desc: 'Every blow they land gives them back 6 health.', mod: () => ({ drain: 6 }) },
      { name: 'Shield high', desc: 'Arrows, bolts and shot do them 40% less harm.', mod: () => ({ rangedResist: 0.4 }) }],
    [{ name: 'Dread', desc: 'Enemies fighting near them strike 12% weaker.', mod: () => ({ weaken: 0.88 }) },
      { name: 'Fury', desc: 'The worse they are wounded the faster they strike, up to twice as fast.', mod: () => ({ frenzy: true }) }],
  ],
  strategist: [
    [{ name: 'Field surgeon', desc: 'They mend the wounded near them 60% faster.', mod: (d) => ({ heal: (d.heal ?? 0) * 1.6 }) },
      { name: 'Signal fires', desc: 'Their presence, and their sight, reach three tiles farther.', mod: (d) => ({ auraRange: (d.auraRange ?? 0) + 3, sight: d.sight + 3 }) }],
    [{ name: 'Cold counsel', desc: 'Enemies fighting near them strike 30% weaker, not 20%.', mod: () => ({ weaken: 0.7 }) },
      { name: 'Behind the mantlet', desc: 'Arrows, bolts and shot do them half the harm.', mod: () => ({ rangedResist: 0.5 }) }],
    [{ name: 'By example', desc: 'Those fighting near them strike 15% harder.', mod: () => ({ aura: 1.15 }) },
      { name: 'Master of the engines', desc: 'Their own shot flies two tiles farther and hits half again as hard.', mod: (d) => ({ range: d.range + 2, atk: Math.round(d.atk * 1.5) }) }],
  ],
};

/** The rank (Seasoned) from which a leader can raise their call, how long it lasts, and how long before it can be raised again. */
export const CALL_RANK = 2;
export const CALL_LASTS = 12;
export const CALL_REST = 90;
/**
 * The one thing a leader sets off by hand. `haste`: those of theirs within reach take this share of the usual time
 * between blows. `ward`: those within reach take this share of the harm done them.
 */
export const CALLS: Record<Calling, { name: string; desc: string; haste?: number; ward?: number }> = {
  warlord: { name: 'Sound the charge', desc: `For ${CALL_LASTS} seconds everyone of yours within their reach strikes a third faster.`, haste: 0.75 },
  strategist: { name: 'Hold fast', desc: `For ${CALL_LASTS} seconds everyone of yours within their reach takes 30% less harm.`, ward: 0.7 },
};

/** The powers a leader of this making holds at a rank, in the order they came into them. */
export function powersHeld(h: HeroSpec, rank: number): Power[] {
  return POWER_RANKS.flatMap((at, tier) => (rank >= at ? [POWERS[h.calling][tier][h.powers?.[tier] === 1 ? 1 : 0]] : []));
}

/** The plain hero a leader is built on, as their powers have changed it. */
export function leaderDef(def: UnitDef, h: HeroSpec, rank: number): UnitDef {
  let out = def;
  for (const p of powersHeld(h, rank)) out = { ...out, ...p.mod(out) };
  return out;
}

/** How each kind of people makes its leader when nobody has made one for them. */
const RIVAL: Record<StyleId, Pick<HeroSpec, 'calling' | 'bent' | 'might' | 'guard' | 'vigour' | 'powers'>> = {
  raider: { calling: 'warlord', bent: 'strength', might: 4, guard: 0, vigour: 2, powers: [0, 0, 1] },
  builder: { calling: 'warlord', bent: 'armour', might: 1, guard: 4, vigour: 1, powers: [1, 1, 0] },
  farmer: { calling: 'warlord', bent: 'both', might: 1, guard: 2, vigour: 3, powers: [1, 0, 0] },
  scholar: { calling: 'warlord', bent: 'both', might: 2, guard: 3, vigour: 1, powers: [1, 1, 0] },
  faithful: { calling: 'warlord', bent: 'armour', might: 1, guard: 2, vigour: 3, powers: [0, 1, 0] },
  trader: { calling: 'warlord', bent: 'both', might: 2, guard: 2, vigour: 2, powers: [1, 1, 1] },
  warrior: { calling: 'warlord', bent: 'strength', might: 5, guard: 1, vigour: 0, powers: [0, 0, 1] },
};
/** A rival people's leader as the game makes them: the leader as written, built to suit how their people live. */
export function rivalHero(civ: string): HeroSpec {
  return cleanHero({ ...cleanHero(undefined, civ), ...RIVAL[CIV_STYLE[civ] ?? 'farmer'] }, civ);
}
/** The leader a people follows: someone's own making of them, else the game's for a rival, else the leader as written. */
export const leaderAsMade = (made: Partial<HeroSpec> | null | undefined, civ: string, rival: boolean): HeroSpec =>
  (made ? cleanHero(made, civ) : rival ? rivalHero(civ) : cleanHero(undefined, civ));
