// A people's own soldiers are companies on the map (docs/DESIGN.md, "The world map is the game": a battle is the close
// view of what the map holds, so what a people fields in a town it can raise on the map).
//
// Every people has soldiers of its own (data.ts, a unit with `civ`): the Japanese samurai, the English longbowman.
// They could be trained in a battle and were never seen on the map, where an army was only infantry, archers and
// cavalry. Here each of a people's own soldiers that a Barracks, an Archery Range or a Stable trains (foot, bow or
// horse: not a siege engine, a healer or a beast) is a kind of company of its own:
//   - of the family of the plain kind it fights as (`base`: a samurai's company is infantry, a lancer's cavalry), so
//     it beats what that kind beats and is beaten by what beats it (campaignbase.ts `familyOf`);
//   - raised where its building stands, by that people only, once the people is of the age the unit needs (`age`);
//   - as strong, and as dear, as the unit is worth against the plain soldier its kind fields at that age (what a plain
//     company becomes in battle, the upgrades it is armed with: clubman to swordsman, slinger to bowman, rider to
//     knight), at least the plain company's and at most UNIQUE.most times it;
//   - fielded in a battle as two of those soldiers, as a plain company is two of its own.
// Plain data: the table is built once from data.ts and handed to campaignbase.ts, which keeps COMPANIES.
import { BUILDINGS, UNITS, type UnitDef } from './data';

/** What campaignbase.ts's CompanyDef holds, as far as this module makes one. */
export interface UniqueDef { name: string; icon: string; cost: number; str: number; needs: string; units: Record<string, number>; civ: string; age: number; base: string }

export const UNIQUE = {
  /** The most a people's own company is worth against the plain one of its family, in strength and in price. */
  most: 1.5,
};

/** The plain soldier each family fields at each age: what a plain company is armed as in battle (data.ts TECHS upgrades). */
const PEERS: Record<string, [number, string][]> = {
  infantry: [[0, 'clubman'], [2, 'swordsman']],
  archers: [[0, 'slinger'], [1, 'bowman'], [3, 'crossbowman'], [4, 'musketeer']],
  cavalry: [[0, 'rider'], [3, 'knight']],
};
/** The family a unit is of, by the building that trains it, and its class. */
const FAMILY: Record<string, [string, string]> = { barracks: ['infantry', 'infantry'], range: ['archers', 'ranged'], stable: ['cavalry', 'cavalry'] };

const worth = (d: UnitDef): number => Object.values(d.cost ?? {}).reduce((n, v) => n + (v ?? 0), 0);
const peerAt = (family: string, age: number): UnitDef => UNITS[[...PEERS[family]].reverse().find(([a]) => a <= age)![1]];
const round = (v: number): number => Math.round(v * 10) / 10;

/** The companies of every people's own soldiers, keyed by the unit's id, made from the plain companies given. */
export function uniqueCompanies(plain: Record<string, { cost: number; str: number }>): Record<string, UniqueDef> {
  const out: Record<string, UniqueDef> = {};
  for (const d of Object.values(UNITS)) {
    if (!d.civ) continue;
    const yard = Object.keys(FAMILY).find((b) => BUILDINGS[b]?.trains.includes(d.id));
    if (!yard || FAMILY[yard][1] !== d.cls || !plain[FAMILY[yard][0]]) continue;
    const base = FAMILY[yard][0], p = plain[base];
    const k = Math.max(1, Math.min(UNIQUE.most, worth(d) / Math.max(1, worth(peerAt(base, d.age)))));
    out[d.id] = { name: d.name, icon: d.icon, cost: Math.max(p.cost, Math.round(p.cost * k)), str: round(p.str * k), needs: yard, units: { [d.id]: 2 }, civ: d.civ, age: d.age, base };
  }
  return out;
}

/** May a people of this civ, at this age, raise a company of this kind? A plain kind, always; a people's own, only theirs and in its age. */
export const mayRaiseKind = (def: { civ?: string; age?: number } | undefined, civ: string, age: number): boolean => !!def && (!def.civ || (def.civ === civ && age >= (def.age ?? 0)));
