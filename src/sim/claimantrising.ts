/**
 * A claimant to the throne, and the rising raised for them (docs/DESIGN.md, "Claimants to the throne").
 *
 * A child written down by claimants.ts is a record until it is of age, and stays one here. But a rising can be
 * raised in its name while it is a child (the owner's word): from `RISING.proclaim` seasons after the birth,
 * whoever holds the child may proclaim it heir (`RISING.chance` a season, once): the lord in whose house it was
 * born, while he is lord of that town (pardoned or bought off, he holds the heir still); or the band that holds its
 * mother, while the band lasts. The figure in the telling is the lord or the band; the child has no name and is
 * never seen. If nobody will follow that season, they wait for one when somebody will.
 *
 * Who follows, for a child's rising or a grown claimant's alike:
 *
 *   - the seat: the town the child is in, if that is still its mother's people's and no capital; among a band,
 *     the town of theirs nearest where the band stands. A seat held down (the leader there, or an army of theirs
 *     standing in it) does not rise.
 *   - with it, every town of that people beside the seat that is no capital, is not held down, and keeps another
 *     creed than the nation's (noblefaith.ts): never more than a third of the people's towns, the seat included.
 *
 * Those towns rise as free towns (freetown.ts `riseFree`), marked as the claim's, so every rule a free town has
 * is theirs: they can be taken back by force, treated with (at twice the price, `FREE.claimant`), or taken by
 * anybody else. A rising is over when its seat is the people's again, when the seat falls to another, or when it
 * has stood `RISING.lapse` seasons unbeaten (the towns stay free).
 *
 * At `HEIR_AGE` the child is of age: it has a name and is a claimant. If the rising raised in its name still
 * stands, the claimant leads it; if there is none, the claimant raises their own, and with no seat that will rise
 * the claim is told and ends. A grown claimant's rising that is over ends the claim; and if the leader is dead
 * with no heir of the house of age while it stands, the claimant takes the throne and the towns come back.
 *
 * `claimantsSeason` is the one call a season; it runs the wives held by bands too (claimants.ts).
 */
import type { Campaign, Territory } from './campaign';
import { Claim, bandChildren, claimChance, claimsOn, endClaim, named, ofAgeNow } from './claimants';
import { noblesOf, titleOf } from './nobles';
import { bringToJudgement } from './claimantjudged';
import { leaderCreed } from './noblefaith';
import { creedOf } from './creed';
import { faithAt } from './townfaith';
import { riseFree } from './freetown';
import { heroFor } from './campaignbase';
import { houseOf, ofAge } from './dynasty';
import { seat } from './court';

export const RISING = {
  /** Of a people's towns, the most that rise for a claimant: one in so many. */
  share: 3,
  /** Seasons a rising stands unbeaten before the claim is heard no more. */
  lapse: 40,
  /** A rising in a child's name: the child's age in seasons before whoever holds it may proclaim it heir, and the chance each season from then that they do. */
  proclaim: 2, chance: 0.5,
};

const tell = (c: Campaign, f: number, text: string): void => { if (f === 0) c.log.push(text); (c.chronicle ??= []).push({ turn: c.turn, text }); };
const child = (cl: Claim): string => (cl.female ? 'daughter' : 'son');
const whose = (c: Campaign, f: number): string => heroFor(c, f).name;
const townOf = (c: Campaign, f: number, t: Territory | undefined): boolean => !!t && t.owner === f && !t.horde && t.capital < 0;
/** Held down: the leader is there, or an army of the people stands in it. */
const heldDown = (c: Campaign, f: number, tid: number): boolean => c.factions[f].court?.at === tid || c.armies.some((a) => a.owner === f && a.at === tid);

/** The town a claimant would raise first: where they grew up, or the people's town nearest it. -1 if there is none. */
export function seatFor(c: Campaign, cl: Claim): number {
  const f = cl.owner;
  if (cl.parent === 'noble') return townOf(c, f, c.territories[cl.town]) ? cl.town : -1;
  const seen = new Set([cl.town]);
  let ring = [cl.town];
  while (ring.length) {
    const here = ring.filter((id) => townOf(c, f, c.territories[id])).sort((a, b) => a - b)[0];
    if (here !== undefined) return here;
    const next: number[] = [];
    for (const id of ring) for (const n of c.territories[id]?.adj ?? []) if (!seen.has(n)) { seen.add(n); next.push(n); }
    ring = next;
  }
  return -1;
}
/** The towns that would rise for this claimant now, the seat first: none if the seat will not rise. */
export function followers(c: Campaign, cl: Claim): number[] {
  const f = cl.owner, at = seatFor(c, cl);
  if (at < 0 || heldDown(c, f, at)) return [];
  const most = Math.max(1, Math.floor(c.territories.filter((t) => t.owner === f && !t.horde).length / RISING.share));
  const creed = leaderCreed(c, f);
  const beside = c.territories[at].adj.filter((n) => townOf(c, f, c.territories[n]) && !heldDown(c, f, n) && creedOf(faithAt(c, n)).id !== creed).sort((a, b) => a - b);
  return [at, ...beside].slice(0, most);
}
/** The claimants of this people's throne who stand in arms now. */
export const standing = (c: Campaign, f: number): Claim[] => claimsOn(c, f).filter((x) => !!x.towns);
/** The claimant a land has risen for, if it has. */
export const claimantAt = (c: Campaign, tid: number): Claim | undefined => { const id = c.territories[tid]?.free?.claimant; return id === undefined ? undefined : (c.claims ?? []).find((x) => x.id === id); };
/** What a land's panel says of a town risen for a claimant: '' for any other. */
export function claimantLine(c: Campaign, tid: number): string {
  const cl = claimantAt(c, tid);
  if (!cl || cl.ended) return '';
  if (!cl.name) return `It has risen in the name of the child of ${cl.mother}, proclaimed heir to the throne of ${whose(c, cl.owner)} by ${cl.regent ?? 'those who hold it'}.`;
  return `It has risen for ${cl.name}, ${child(cl)} of ${cl.mother}, who claims the throne of ${whose(c, cl.owner)}${cl.towns?.[0] === tid ? ' and sits here' : ''}.`;
}

const list = (names: string[]): string => (names.length === 1 ? `${names[0]} has` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} have`);
/** These towns rise as free towns, marked as this claim's. */
function rise(c: Campaign, cl: Claim, towns: number[]): void {
  for (const tid of towns) { riseFree(c, tid); c.territories[tid].free!.claimant = cl.id; (c.events ??= []).push({ kind: 'revolt', at: tid, turn: c.turn, until: c.turn }); }
  cl.towns = towns;
}
/** A record comes of age: the claimant is named, told of, and raises who will follow. Returns the towns that rose. */
export function comeOfAge(c: Campaign, cl: Claim): number[] {
  const f = cl.owner, fac = c.factions[f];
  if (!fac?.alive) { endClaim(c, cl, 'gone', `The people whose throne ${cl.mother}'s child might have claimed are no more.`); return []; }
  named(c, cl);
  cl.grown = c.turn;
  const where = c.territories[cl.town]?.name ?? 'a far country', raised = cl.parent === 'noble' ? `raised in the house of ${cl.by} at ${where}` : `born while ${cl.by} held her`;
  if (cl.towns) { // the rising raised in the child's name still stands: the claimant leads it now
    tell(c, f, `${cl.name}, ${child(cl)} of ${cl.mother}, in whose name ${c.territories[cl.towns[0]].name} rose, has come of age and leads the rising against ${whose(c, f)} ${cl.female ? 'herself' : 'himself'}.`);
    return cl.towns;
  }
  const towns = followers(c, cl);
  if (!towns.length) {
    endClaim(c, cl, 'nofollowing', `${cl.name}, ${child(cl)} of ${cl.mother}, ${raised}, has come of age and claims the throne of ${whose(c, f)}. Nobody has risen for ${cl.female ? 'her' : 'him'}.`);
    tell(c, f, cl.ended!.text);
    return [];
  }
  rise(c, cl, towns);
  tell(c, f, `${cl.name}, ${child(cl)} of ${cl.mother}, ${raised}, has come of age and claims the throne of ${whose(c, f)}. ${list(towns.map((tid) => c.territories[tid].name))} risen for ${cl.female ? 'her' : 'him'}.`);
  return towns;
}
/** The towns still out for this claimant. */
const out = (c: Campaign, cl: Claim): Territory[] => c.territories.filter((t) => t.free?.claimant === cl.id && t.owner < 0 && !t.horde);
const unmark = (c: Campaign, cl: Claim): void => { for (const t of c.territories) if (t.free?.claimant === cl.id) delete t.free.claimant; };

/** The leader is dead with no heir of the house of age, and a claimant stands: the claimant takes the throne. */
function crown(c: Campaign, cl: Claim): void {
  const f = cl.owner, fac = c.factions[f], old = heroFor(c, f), house = houseOf(c, f), at = cl.towns![0];
  for (const t of out(c, cl)) { t.owner = f; t.militia = 0; delete t.free; }
  fac.hero = { ...old, name: cl.name!, female: !!cl.female, look: { ...old.look, beard: cl.female ? false : old.look?.beard } };
  fac.heroAlive = true; fac.heroRank = 0;
  house.line++; house.births = 0; house.asked = false;
  seat(c, f, c.territories[at].owner === f ? at : (c.territories.find((t) => t.owner === f)?.id ?? at));
  endClaim(c, cl, 'crowned', `${old.name} is dead and no child of the house is of age. ${cl.name}, ${child(cl)} of ${cl.mother}, has taken the throne${f === 0 ? '' : ` of the ${fac.name}`}, and the towns that rose for ${cl.female ? 'her' : 'him'} have come back.`);
  tell(c, f, cl.ended!.text);
}

/** Who holds the child and could raise a rising in its name now, in words: '' if nobody can. */
export function regentFor(c: Campaign, cl: Claim): string {
  const f = cl.owner;
  if (cl.parent === 'band') return (c.bands ?? []).find((b) => b.id === cl.band)?.name ?? '';
  const lord = noblesOf(c, f).find((n) => n.key === cl.key && n.rank === 'lord' && n.town === cl.town);
  return lord && c.territories[cl.town]?.owner === f ? titleOf(c, lord) : ''; // pardoned or bought off, he holds the heir still
}
/**
 * A rising is raised in a child's name: whoever holds the child proclaims it heir, and those who will follow rise.
 * The child is still a record: no name, no figure. Returns the towns that rose (none: nobody would, this season).
 */
export function proclaim(c: Campaign, cl: Claim): number[] {
  const f = cl.owner, by = regentFor(c, cl);
  if (cl.ended || cl.grown !== undefined || cl.raised !== undefined || !by || !c.factions[f]?.alive) return [];
  if (cl.parent === 'band') cl.town = (c.bands ?? []).find((b) => b.id === cl.band)!.at; // where the band stands now
  const towns = followers(c, cl);
  if (!towns.length) return [];
  rise(c, cl, towns);
  cl.raised = c.turn; cl.regent = by;
  const names = towns.map((tid) => c.territories[tid].name);
  tell(c, f, `${by[0].toUpperCase() + by.slice(1)} ${cl.parent === 'band' ? 'have' : 'has'} proclaimed the child of ${cl.mother} heir to the throne of ${whose(c, f)}. ${list(names)} risen in the child's name.`);
  return towns;
}

/** One season of it all: the wives held by bands, risings raised in a child's name, those who come of age, and the risings that stand. */
export function claimantsSeason(c: Campaign): void {
  bandChildren(c);
  for (const cl of [...(c.claims ?? [])]) {
    if (cl.ended) continue;
    const f = cl.owner, fac = c.factions[f];
    if (!fac?.alive) { unmark(c, cl); endClaim(c, cl, 'gone', `The people whose throne ${cl.mother}'s child might have claimed are no more.`); continue; }
    if (ofAgeNow(c, cl)) { comeOfAge(c, cl); continue; }
    if (!cl.towns) {
      // No rising stands. A child old enough to be proclaimed may be, once: by a chance each season, while someone holds it who would.
      if (cl.grown === undefined && cl.raised === undefined && c.turn - cl.born >= RISING.proclaim && claimChance(c, cl.id * 53 + 5) < RISING.chance) proclaim(c, cl);
      continue;
    }
    const at = c.territories[cl.towns[0]], grown = cl.grown !== undefined;
    const who = grown ? `${cl.name}, who claimed the throne of ${whose(c, f)},` : `the child of ${cl.mother}`;
    /** The rising is over: a grown claimant's claim with it; a child's record stays, and grown it may claim for itself. */
    const over = (how: 'putdown' | 'swallowed' | 'lapsed', text: string): void => {
      unmark(c, cl); delete cl.towns;
      if (grown) endClaim(c, cl, how, text); else cl.over = c.turn;
      tell(c, f, text);
    };
    if (at.owner === f) { over('putdown', `${at.name} is ${f === 0 ? 'yours' : `the ${fac.name}'`} again. The rising for ${who} is over.`); bringToJudgement(c, cl, at.id); continue; } // whoever led it answers for it (claimantjudged.ts)
    if (at.owner >= 0 || at.horde) { over('swallowed', `${at.name} has fallen to others, and the rising for ${who} with it.`); continue; }
    if (grown && !fac.heroAlive && !houseOf(c, f).heirs.some((h) => ofAge(c, h))) { crown(c, cl); continue; }
    if (c.turn - (cl.grown ?? cl.raised!) >= RISING.lapse) over('lapsed', `${at.name} has stood free ${RISING.lapse / 4} years. The claim of ${grown ? cl.name : `the child of ${cl.mother}`} to the throne is heard no more.`);
  }
}
