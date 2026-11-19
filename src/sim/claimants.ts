/**
 * Claimants to the throne: the record (docs/DESIGN.md, "Claimants to the throne", the owner's word).
 *
 * A child born to the leader's wife away from the leader's house, in the house of a noble who took her
 * (wifetaken.ts) or among a band that carried her off (kin.ts, threats.ts), is written down here and nowhere
 * else. It is a record only: when it was born, to whom, where it grows up. It has no name, is never drawn, is in
 * no town's count, and nothing that befalls a town or a band can touch it. When it is of age (`HEIR_AGE`,
 * dynasty.ts: the age at which any child of a house is grown) it is given a name and is a claimant, and only then
 * is it ever a figure (claimantrising.ts).
 *
 *   - `recordChild`: a child is written down.
 *   - `bandChildren`: a season for the leaders' wives held by bands: one may bear a child there (by the chance and
 *     the wait of bandborn.ts), one at most while she is held; if she is got back the child comes home with her,
 *     is raised in the leader's house, and is no claimant.
 *   - `ofAgeNow`, `named`: a record comes of age and is given a name.
 */
import { givenNames } from './peoplenames';
import { toldIn } from './chroniclethreads';
import type { Campaign } from './campaign';
import { HEIR_AGE } from './dynasty';
import { BORN } from './bandborn';

export const CLAIM = {
  /** The chance a season, once the wait is over (bandborn.ts, `BORN.after`), that a child is born to the leader's wife where she is held. */
  born: 0.7,
};
export interface Claim {
  id: number;
  /** The people whose throne it is, and the leader's wife who bore the child. */
  owner: number; mother: string;
  /** Born in the house of a noble who took her, or among a band that held her; and who that was, in words. */
  parent: 'noble' | 'band'; by: string;
  /** The land the child grows up in (the noble's town, or where the band stood). */
  town: number;
  born: number;
  /** Given when the claimant is grown: a name, and the season they came of age. */
  name?: string; female?: boolean; grown?: number;
  /** Who holds the child and may raise a rising in its name: the lord, by his key (nobles.ts), or the band, by its id. */
  key?: string; band?: number;
  /** A rising raised in the child's name while it is still a child (claimantrising.ts): when, and by whom, in words; and that it is over. */
  raised?: number; regent?: string; over?: number;
  /** The towns out for the claim now, the first its seat (claimantrising.ts). */
  towns?: number[];
  ended?: { turn: number; how: 'home' | 'gone' | 'nofollowing' | 'putdown' | 'swallowed' | 'lapsed' | 'crowned'; text: string };
}
declare module './campaign' {
  interface Campaign {
    /** Children who may one day claim a throne, and those who have (claimants.ts). */
    claims?: Claim[]; claimSeq?: number;
  }
}

const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x2545f491, 0x85ebca6b) ^ Math.imul(b + 0x4f6cdd1d, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
/** A chance of this system's own, by the campaign, the season and a salt. */
export const claimChance = (c: Campaign, salt: number): number => hash(c.seed * 131 + salt, c.turn * 61 + 7);

/** A child is written down. */
export function recordChild(c: Campaign, o: Pick<Claim, 'owner' | 'mother' | 'parent' | 'by' | 'town'> & Pick<Partial<Claim>, 'key' | 'band'>): Claim {
  const cl: Claim = { id: (c.claimSeq = (c.claimSeq ?? 0) + 1), ...o, born: c.turn };
  (c.claims ??= []).push(cl);
  return cl;
}
/** The records of one people's throne that are still open: children growing up, and claimants standing. */
export const claimsOn = (c: Campaign, f: number): Claim[] => (c.claims ?? []).filter((x) => x.owner === f && !x.ended);
/** Is this record of age, and not yet come forward? */
export const ofAgeNow = (c: Campaign, cl: Claim): boolean => !cl.ended && cl.grown === undefined && c.turn - cl.born >= HEIR_AGE;
/** A grown claimant is given a name: by the record, so the same world names them the same. */
export function named(c: Campaign, cl: Claim): Claim {
  if (cl.name) return cl;
  cl.female = hash(c.seed * 17 + cl.id, 91) < 0.25;
  const names = givenNames(c.factions[cl.owner]?.civ, cl.female ? 'f' : 'm'); // the people's own names (peoplenames.ts)
  cl.name = names[Math.floor(hash(c.seed * 19 + cl.id, 93) * names.length)];
  return cl;
}
export const endClaim = (c: Campaign, cl: Claim, how: NonNullable<Claim['ended']>['how'], text: string): void => { cl.ended = { turn: c.turn, how, text }; };

/** Told in the log (the player's own) and the chronicle; a later line of a claimant's story says the year the child was born (chroniclethreads.ts). */
const tell = (c: Campaign, f: number, text: string, born?: number): void => { if (f === 0) c.log.push(text); (c.chronicle ??= []).push({ turn: c.turn, text: text + toldIn(c, born) }); };

/**
 * A season for the leaders' wives held by bands. Returns the children written down this season.
 * The child is one of those bandborn.ts counts in its own way; this is the one record that knows whose it is.
 */
export function bandChildren(c: Campaign): Claim[] {
  const out: Claim[] = [];
  for (const fac of c.factions) {
    const s = fac.kin?.spouse, f = fac.id;
    // Home again: a child born while she was held comes home with her, and is no claimant.
    for (const cl of claimsOn(c, f)) {
      if (cl.parent !== 'band' || cl.grown !== undefined || !s || s.name !== cl.mother || s.lost) continue;
      endClaim(c, cl, 'home', `The child born to ${cl.mother} while she was held has come home with her, and is raised in the leader's house.`);
      tell(c, f, cl.ended!.text, cl.born);
    }
    if (!fac.alive || !s || !s.female || s.lost?.how !== 'taken' || s.lost.band === undefined || s.lost.final) continue;
    const band = (c.bands ?? []).find((b) => b.id === s.lost!.band && b.held.some((h) => h.owner === f && (h.names ?? []).includes(s.name)));
    if (!band || c.turn - s.lost.turn < BORN.after) continue;
    if ((c.claims ?? []).some((x) => x.owner === f && x.mother === s.name && x.parent === 'band' && x.born >= s.lost!.turn)) continue; // one at most
    if (claimChance(c, f * 37 + band.id * 11 + 3) >= CLAIM.born) continue;
    const cl = recordChild(c, { owner: f, mother: s.name, parent: 'band', by: band.name, town: band.at, band: band.id });
    tell(c, f, `Word comes that a child is born to ${s.name}, wife of ${s.of}, where ${band.name} hold her.`);
    out.push(cl);
  }
  return out;
}
