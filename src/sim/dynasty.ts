// Who leads a people when their leader falls. Every leader keeps a house: children are born to it as the turns go
// by, and when the leader dies one of them who is of age may take up the rule. Failing that, or if the player would
// rather, a captain who has made a name in one of the armies can be raised in their place and founds a house anew.
// Rules only: campaign.ts calls in here at the turn of the year and when a leader is lost.

import type { Army, Campaign } from './campaign';
import { NAMES_F, NAMES_M } from './data';
import { HeroSpec, MAX_RANK, RANK_NAMES, cleanHero } from './hero';

export interface Heir { name: string; female: boolean; born: number }
export interface House {
  heirs: Heir[];
  /** How many have led this people in the campaign, the first leader included. */
  line: number;
  /** How many children have been born to the leader now ruling: names are drawn by it. */
  births: number;
  /** The turn the next child is due. */
  due: number;
  /** The leader has fallen and the player has been asked who follows (so they are not asked twice). */
  asked?: boolean;
}

export const HEIR_AGE = 6; // turns from birth until an heir can lead
export const HEIR_EVERY = 5; // turns between children
export const MAX_HEIRS = 3;
/** A captain needs this many battles won behind their army before anyone would follow them. */
export const CAPTAIN_VET = 1;

/** One who could take up the rule. */
export interface Claim {
  kind: 'heir' | 'captain';
  /** Which heir of the house, or which army the captain serves in. */
  i: number;
  name: string; female: boolean;
  /** The veterancy they would begin with. */
  rank: number;
  /** A line for the player: who they are. */
  what: string;
}

// Names and the like are drawn from the campaign's seed and the thing named, never from its run of chance, so that
// asking who might rule changes nothing about what happens next.
const pick = (c: Campaign, salt: number, n: number): number => {
  let h = (c.seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) % n;
};
const leaderOfFaction = (c: Campaign, f: number): HeroSpec => cleanHero(c.factions[f].hero, c.factions[f].civ);
const say = (c: Campaign, f: number, text: string): void => {
  (c.chronicle ??= []).push({ turn: c.turn, text });
  if (f === 0) c.log.push(text);
};
const child = (c: Campaign, f: number, house: House, born: number): Heir => {
  const salt = f * 977 + house.line * 131 + house.births * 17;
  const female = pick(c, salt, 2) === 1;
  const names = female ? NAMES_F : NAMES_M;
  let name = names[pick(c, salt + 5, names.length)];
  // No two of one house share a name.
  for (let k = 1; house.heirs.some((h) => h.name === name) && k < names.length; k++) name = names[(pick(c, salt + 5, names.length) + k) % names.length];
  house.births++;
  return { name, female, born };
};

/** A people's ruling house. A leader comes to the campaign with one child already half grown. */
export function houseOf(c: Campaign, f: number): House {
  const fac = c.factions[f];
  if (!fac.house) {
    fac.house = { heirs: [], line: 1, births: 0, due: c.turn + HEIR_EVERY - 2 };
    fac.house.heirs.push(child(c, f, fac.house, c.turn - Math.floor(HEIR_AGE / 2)));
  }
  return fac.house;
}
export const ofAge = (c: Campaign, h: Heir): boolean => c.turn - h.born >= HEIR_AGE;
/** Turns until an heir can lead (0 if they can now). */
export const comesOfAge = (c: Campaign, h: Heir): number => Math.max(0, HEIR_AGE - (c.turn - h.born));

/** The turn of the year: while the leader lives, children are born to the house. */
export function tickHouses(c: Campaign): void {
  for (const fac of c.factions) {
    if (!fac.alive) continue;
    const house = houseOf(c, fac.id);
    if (!fac.heroAlive || house.heirs.length >= MAX_HEIRS || c.turn < house.due) continue;
    const heir = child(c, fac.id, house, c.turn);
    house.heirs.push(heir);
    house.due = c.turn + HEIR_EVERY;
    if (fac.id === 0) say(c, 0, `A ${heir.female ? 'daughter' : 'son'}, ${heir.name}, is born to ${leaderOfFaction(c, 0).name}.`);
  }
}

const captainOf = (c: Campaign, a: Army): { name: string; female: boolean } => {
  const female = pick(c, a.id * 53 + 7, 5) === 0;
  const names = female ? NAMES_F : NAMES_M;
  return { name: `Captain ${names[pick(c, a.id * 53 + 11, names.length)]}`, female };
};

/** Everyone who could take up the rule now: heirs of age first, eldest first, then captains of the most seasoned armies. */
export function claimants(c: Campaign, f: number): Claim[] {
  const fac = c.factions[f];
  if (fac.heroAlive || !fac.alive) return [];
  const house = houseOf(c, f), fallen = leaderOfFaction(c, f);
  const out: Claim[] = [];
  house.heirs.forEach((h, i) => {
    if (!ofAge(c, h)) return;
    // Raised at their parent's side, an heir has half the name their parent made.
    out.push({ kind: 'heir', i, name: `${h.name}, ${h.female ? 'daughter' : 'son'} of ${fallen.name}`.slice(0, 60), female: h.female, rank: Math.floor((fac.heroRank ?? 0) / 2), what: `${h.female ? 'Daughter' : 'Son'} of ${fallen.name}, ${c.turn - h.born} turns old. Keeps their parent's gifts and the house.` });
  });
  out.sort((a, b) => house.heirs[a.i].born - house.heirs[b.i].born);
  const armies = c.armies.filter((a) => a.owner === f && a.vet >= CAPTAIN_VET).sort((a, b) => b.vet - a.vet || a.id - b.id).slice(0, 2);
  for (const a of armies) {
    const who = captainOf(c, a);
    out.push({ kind: 'captain', i: a.id, ...who, rank: Math.min(MAX_RANK, a.vet), what: `Leads the veterans at ${c.territories[a.at].name}. ${RANK_NAMES[Math.min(MAX_RANK, a.vet)]} already, and takes command where ${who.female ? 'she' : 'he'} stands, but the old house ends.` });
  }
  return out;
}

/** The army a new leader joins: the one in the capital if there is one, else the strongest in the field. */
const hostFor = (c: Campaign, f: number): Army | undefined => {
  const mine = c.armies.filter((a) => a.owner === f);
  const size = (a: Army): number => Object.values(a.units).reduce((n, v) => n + v, 0);
  return mine.find((a) => c.territories[a.at].capital === f) ?? mine.sort((a, b) => size(b) - size(a) || a.id - b.id)[0];
};

/** Could this claim be taken up now? An heir needs an army to ride to; a captain needs their army still standing. */
export function canSucceed(c: Campaign, f: number, claim: Claim): boolean {
  if (c.factions[f].heroAlive) return false;
  return claim.kind === 'heir' ? !!houseOf(c, f).heirs[claim.i] && !!hostFor(c, f) : c.armies.some((a) => a.id === claim.i && a.owner === f);
}

/** Put a claimant at the head of their people. */
export function succeed(c: Campaign, f: number, claim: Claim): boolean {
  if (!canSucceed(c, f, claim)) return false;
  const fac = c.factions[f], house = houseOf(c, f), old = leaderOfFaction(c, f);
  if (claim.kind === 'heir') {
    // The child has the parent's making and bearing, and their own face.
    fac.hero = { ...old, name: claim.name, female: claim.female, look: { ...old.look, beard: claim.female ? false : old.look?.beard } };
    house.heirs.splice(claim.i, 1);
    hostFor(c, f)!.hero = true;
    say(c, f, `${claim.name} takes up the rule of the ${fac.id === 0 ? 'people' : fac.name}.`);
  } else {
    // A soldier's soldier: strong in the arm, and no house behind them yet.
    fac.hero = { name: claim.name, female: claim.female, calling: 'warlord', bent: 'strength', might: 3, guard: 2, vigour: 1, look: {} };
    house.heirs = [];
    c.armies.find((a) => a.id === claim.i)!.hero = true;
    say(c, f, `${old.name}'s house is set aside: ${claim.name} is raised on the shields at ${c.territories[c.armies.find((a) => a.id === claim.i)!.at].name}.`);
  }
  fac.heroRank = claim.rank;
  fac.heroAlive = true;
  house.line++;
  house.births = 0;
  house.due = c.turn + HEIR_EVERY;
  house.asked = false;
  return true;
}

/** A rival people settles its own succession: the eldest heir of age, else its best captain. */
export function autoSucceed(c: Campaign, f: number): boolean {
  const claim = claimants(c, f).find((x) => canSucceed(c, f, x));
  return !!claim && succeed(c, f, claim);
}

/** A stranger is hired to lead (the old "summon"): whoever they are, they are not the one who fell. */
export function strangerLeads(c: Campaign, f: number): void {
  const fac = c.factions[f], house = houseOf(c, f), old = leaderOfFaction(c, f);
  const female = pick(c, f * 31 + house.line * 7 + 3, 4) === 0;
  const names = female ? NAMES_F : NAMES_M;
  fac.hero = { ...old, name: `${names[pick(c, f * 31 + house.line * 7 + 9, names.length)]} the Hired`, female, look: {} };
  fac.heroRank = 0;
  house.heirs = [];
  house.line++;
  house.births = 0;
  house.due = c.turn + HEIR_EVERY;
  house.asked = false;
  say(c, f, `${fac.hero.name} is paid to lead the ${fac.id === 0 ? 'people' : fac.name}. ${old.name}'s house is ended.`);
}
