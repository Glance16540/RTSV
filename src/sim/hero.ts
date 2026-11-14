// A nation's leader on the field: who they are, how they were made, and what the battles they live through do for them.
//
// The leader is a hero unit (a Warlord or a Strategist, whichever their calling is) with a name, points spent in the
// creator, and veterancy earned in battle. Their town's piety gives them a power of its own. They are still men and
// women: a blow always tells on them, and they fall.

import { LEADERS, leaderOf } from './leaders';

export type Calling = 'warlord' | 'strategist';
/** What each new rank of veterancy adds: strength of arm, armour, or the two by turns. */
export type Bent = 'strength' | 'armour' | 'both';

/** How a leader looks, as chosen in the creator. Everything left out follows their calling's usual dress. */
export interface HeroLook { hair?: number; beard?: boolean; helmet?: string; cloak?: number; build?: number }

export interface HeroSpec {
  name: string;
  female: boolean;
  calling: Calling;
  bent: Bent;
  /** Points spent in the creator, HERO_POINTS in all. */
  might: number; guard: number; vigour: number;
  /** Veterancy they come to the field with (0 to MAX_RANK). */
  rank?: number;
  /** Which of the two powers they come into at each of three ranks (0 or 1), or -1 while it is still to be chosen: see powers.ts. */
  powers?: number[];
  /** A soldier raised to lead goes on fighting as what they were (a unit type), not as a hero of their calling. */
  fights?: string;
  look?: HeroLook;
}

export const HERO_POINTS = 6;
export const MAX_RANK = 5;
/** Deeds needed to reach each rank. A deed is an enemy felled, by the leader or by anyone fighting beside them. */
export const RANK_XP = [0, 6, 15, 28, 46, 70];
export const RANK_NAMES = ['Untried', 'Blooded', 'Seasoned', 'Veteran', 'Renowned', 'Legend'];
export const MIGHT_ATK = 1.5; // attack per point of might
export const GUARD_ARMOR = 0.4; // armour per point of guard
export const VIGOUR_HP = 0.07; // share of health per point of vigour
export const RANK_ATK = 2; // attack for each rank given to strength
export const RANK_ARMOR = 0.6; // armour for each rank given to armour
export const RANK_HP = 0.05; // share of health per rank, whatever the bent
/** However armoured, a leader takes at least this share of a blow. */
export const HERO_MIN_HURT = 0.3;
/** Armour a holy leader lends to everyone of theirs nearby: in a Devout town, and in a Righteous one. */
export const HOLY_GUARD = [1, 2];
/** A decadent leader binds a villager in this share of the time a Slaver takes, and their camps breed this many times as fast. */
export const TYRANT_BIND = 0.5;
export const TYRANT_BIRTH = 2.5;

const int = (v: unknown, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const text = (s: unknown, max: number): string => (typeof s === 'string' ? s : '').replace(/[<>&"`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A nation's leader as written, before anyone has changed them: a Warlord, with their points spread evenly. */
export function defaultHero(civ: string): HeroSpec {
  const l = leaderOf(civ) ?? LEADERS[civ];
  return { name: l?.name ?? 'The Warlord', female: !!l?.female, calling: 'warlord', bent: 'both', might: 2, guard: 2, vigour: 2 };
}

/** Make a spec safe to use whatever was saved or handed in: a name, a calling, and no more points than there are to spend. */
export function cleanHero(h: Partial<HeroSpec> | null | undefined, civ: string): HeroSpec {
  const d = defaultHero(civ);
  if (!h || typeof h !== 'object') return d;
  const might = int(h.might, 0, HERO_POINTS), guard = int(h.guard, 0, HERO_POINTS - might), vigour = int(h.vigour, 0, HERO_POINTS - might - guard);
  const look: HeroLook = {};
  if (h.look && typeof h.look === 'object') {
    if (h.look.hair != null) look.hair = int(h.look.hair, 0, 0xffffff);
    if (h.look.cloak != null) look.cloak = int(h.look.cloak, 0, 0xffffff);
    if (h.look.beard != null) look.beard = !!h.look.beard;
    if (h.look.build != null) look.build = int(h.look.build, 0, 2);
    if (h.look.helmet) look.helmet = text(h.look.helmet, 12);
  }
  return {
    name: text(h.name, 60) || d.name, female: h.female == null ? d.female : !!h.female,
    calling: h.calling === 'strategist' ? 'strategist' : 'warlord', bent: h.bent === 'strength' || h.bent === 'armour' ? h.bent : 'both',
    might, guard, vigour, rank: int(h.rank, 0, MAX_RANK), powers: [0, 1, 2].map((t) => (Array.isArray(h.powers) && h.powers[t] === 1 ? 1 : Array.isArray(h.powers) && h.powers[t] === 0 ? 0 : -1)), look,
    ...(text(h.fights, 24) ? { fights: text(h.fights, 24) } : {}),
  };
}

/** What a leader's points and veterancy add to the plain hero they are built on. */
export function heroBonus(h: HeroSpec, rank: number): { atk: number; armor: number; hp: number } {
  // By turns: the first rank goes to the arm, the second to armour, and so on.
  const toAtk = h.bent === 'strength' ? rank : h.bent === 'armour' ? 0 : Math.ceil(rank / 2);
  return {
    atk: h.might * MIGHT_ATK + toAtk * RANK_ATK,
    armor: h.guard * GUARD_ARMOR + (rank - toAtk) * RANK_ARMOR,
    hp: 1 + h.vigour * VIGOUR_HP + rank * RANK_HP,
  };
}

const NUMERALS = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** The name of the heir who takes a fallen leader's place in the middle of a battle: their parent's, and the next number. */
export function heirName(name: string): string {
  const m = / (II|III|IV|V|VI|VII|VIII|IX)$/.exec(name);
  return m ? name.slice(0, m.index) + ' ' + NUMERALS[NUMERALS.indexOf(m[1]) + 1] : `${name} II`;
}

/** The rank a number of deeds has earned. */
export const rankOf = (xp: number): number => { let r = 0; while (r < MAX_RANK && xp >= RANK_XP[r + 1]) r++; return r; };
