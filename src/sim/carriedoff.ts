// A rival nation that takes a town may carry people off (docs/DESIGN.md, "Captivity": a rival nation that
// assimilates gains population outright; children born in captivity to such a nation are its own).
//
// Only a nation led by the computer whose creed is Worldly or Decadent does it. When it takes a town of another
// nation on the map, a share of the town's grown people (never a child) are led away and held in the land the
// army came from, or failing that in a town of the taker's. They are a record there, the same held-people record
// the bands keep (threats.ts `Held`): who, of what ages, from where, since when.
//
// For a few seasons they can be got back: whoever takes the land they are held in sets them free, and they go
// home to their own people (to their town if it is theirs again, else to the nearest town of their people), the
// older for it as from a band. After that they are the taker's people: they are written onto the record of the
// town that holds them, and will not come home. A child born to a woman held this way is the taker's own from
// the day it is born: it is counted to the holding town and never comes home.
//
// What is done to a captive is not told: only where they are, how long is left, and what follows. Nothing here
// is drawn. One hook where a town changes hands (campaign.ts) and one call a season (bandseason.ts).
import type { Campaign } from './campaign';
import { agesOf, countFrom } from './ageing';
import { BORN } from './bandborn';
import { creedOf } from './creed';
import { Held, bringHome, mark } from './threats';
import { TOWN_SCALE, folkOf } from './township';
import { homeAgain } from './carriedhome';
import { carriedNamed } from './carriednamed';

/** People of one town carried off by a nation: who holds them, in which land, and the record of them. */
export interface Carried { id: number; by: number; at: number; held: Held }
declare module './campaign' {
  interface Campaign { /** People carried off by nations that take them in (carriedoff.ts). */ carried?: Carried[]; carriedSeq?: number }
}

export const CARRY = {
  /** The creeds that carry people off (creed.ts ids). */
  creeds: ['worldly', 'decadent'],
  /** The share of a taken town's women and men of working age led away, and the men and women it is always left. */
  women: 0.25, men: 0.1, leave: 2,
  /** Seasons they can be got back, before they are the taker's people. */
  seasons: 4,
};

function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x6a09e667, 0x9e3779b1) ^ Math.imul(c.turn + 0x3c6ef372, 0x85ebca6b) ^ Math.imul(salt + 0x510e527f, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const n = (k: number, one: string, many: string): string => `${k} ${k === 1 ? one : many}`;
const who = (h: Held): string => [h.women.length ? n(h.women.length, 'woman', 'women') : '', h.men.length ? n(h.men.length, 'man', 'men') : ''].filter(Boolean).join(' and ');
const name = (c: Campaign, f: number): string => (f === 0 ? 'your people' : `the ${c.factions[f]?.name ?? 'others'}`);
const say = (c: Campaign, owners: number[], text: string): void => { if (owners.includes(0)) c.log.push(text); };

/** Does this people carry off the people of towns it takes? */
export const carriesOff = (c: Campaign, f: number): boolean => { const fac = c.factions[f]; return !!fac && fac.alive && fac.isAI && CARRY.creeds.includes(creedOf(fac.virtue ?? 0).id); };
/** Those of a people now held by a nation, and those held in a land. */
export const carriedOf = (c: Campaign, owner: number): Carried[] => (c.carried ?? []).filter((x) => x.held.owner === owner);
export const carriedAt = (c: Campaign, at: number): Carried[] => (c.carried ?? []).filter((x) => x.at === at);
export const carriedLeft = (c: Campaign, x: Carried): number => Math.max(0, CARRY.seasons - (c.turn - x.held.since));

/** Those held in a land go free, and go home to their own people. Returns how many. */
function free(c: Campaign, at: number, why: string): number {
  let freed = 0;
  for (const x of carriedAt(c, at)) {
    const k = bringHome(c, x.held);
    homeAgain(c, x.held); // those a battle carried off, back under their own roofs (carriedhome.ts)
    freed += k;
    say(c, [x.held.owner, x.by], `${who(x.held)[0].toUpperCase() + who(x.held).slice(1)} of ${c.territories[x.held.from].name}, carried off by ${name(c, x.by)}, ${k === 1 ? 'is' : 'are'} free ${why} and going home, the older for it.`);
    if (x.held.owner === 0) mark(c, 'rescued', at);
  }
  if (freed) c.carried = (c.carried ?? []).filter((x) => x.at !== at);
  return freed;
}

/**
 * A town has been taken on the map (called by campaign.ts as it changes hands, before the new holder is written):
 * anyone held in it goes free; and if the taker is a people that carries off, some of the town's grown people are
 * led away to the land the army came from. `from`: the people who held it, `to`: who has taken it, `via`: where the
 * army came from. Returns those carried off, if any.
 */
export function townFell(c: Campaign, tid: number, from: number, to: number, via?: number): Carried | null {
  free(c, tid, `now that ${c.territories[tid].name} has fallen`);
  if (from < 0 || to < 0 || from === to || !carriesOff(c, to)) return null;
  const hold = via !== undefined && c.territories[via]?.owner === to ? via : c.territories.find((t) => t.owner === to && t.id !== tid)?.id;
  if (hold === undefined) return null;
  const f = folkOf(c, tid), ages = agesOf(c, tid, f);
  const take = (list: number[], share: number, kept: number, salt: number): number[] => {
    const grown = list.map((s, i) => ({ s, i })).filter((x) => x.s < 60 * 4).sort((a, b) => a.s - b.s); // those of working age, the youngest first
    const k = Math.max(0, Math.min(grown.length - kept, Math.floor(grown.length * share + chance(c, tid * 31 + salt))));
    const gone = grown.slice(0, k);
    for (const x of gone.sort((a, b) => b.i - a.i)) list.splice(x.i, 1);
    return gone.map((x) => x.s);
  };
  const kept = CARRY.leave * TOWN_SCALE; // as many as that was of a town, however large towns are (township.ts)
  const women = take(ages.f, CARRY.women, kept, 1), men = take(ages.m, CARRY.men, kept, 2);
  if (!women.length && !men.length) return null;
  countFrom(f, ages); // the children stay: none is ever taken
  const x: Carried = { id: (c.carriedSeq = (c.carriedSeq ?? 0) + 1), by: to, at: hold, held: { from: tid, owner: from, men, women, since: c.turn } };
  (c.carried ??= []).push(x);
  carriedNamed(c, x, name(c, to)); // a known person among them is marked carried off by name (carriednamed.ts)
  mark(c, 'carried', tid);
  const line = `${who(x.held)[0].toUpperCase() + who(x.held).slice(1)} of ${c.territories[tid].name} ${men.length + women.length === 1 ? 'was' : 'were'} led away by ${name(c, to)} to ${c.territories[hold].name}. In ${n(CARRY.seasons, 'season', 'seasons')} they will be ${to === 0 ? 'yours' : 'theirs'} for good: take ${c.territories[hold].name} before then and they come home.`;
  say(c, [from], line);
  if (from === 0) (c.chronicle ??= []).push({ turn: c.turn, text: `${who(x.held)[0].toUpperCase() + who(x.held).slice(1)} of ${c.territories[tid].name} ${men.length + women.length === 1 ? 'was' : 'were'} led away by ${name(c, to)} when the town fell.` });
  return x;
}

/** A season for those carried off: children are born to the taker, and those held long enough become its people. */
export function carriedSeason(c: Campaign): { born: number; taken: number } {
  let born = 0, taken = 0;
  for (const x of [...(c.carried ?? [])]) {
    const t = c.territories[x.at], h = x.held;
    // The land they are held in is no longer the taker's by some other road: they are free.
    if (!t || t.owner !== x.by || !c.factions[x.by]?.alive) { free(c, x.at, 'since their keepers lost the land'); continue; }
    const f = folkOf(c, x.at), ages = agesOf(c, x.at, f);
    if (c.turn - h.since >= BORN.after) {
      for (let w = h.bore ?? 0; w < h.women.length; w++) {
        if (chance(c, x.id * 131 + w) >= BORN.chance) continue;
        h.bore = (h.bore ?? 0) + 1; born++;
        ages.k.push(0); // the taker's own, on the holding town's record from the day it is born
      }
    }
    if (c.turn - h.since >= CARRY.seasons) {
      ages.m.push(...h.men); ages.f.push(...h.women);
      taken += h.men.length + h.women.length;
      c.carried = (c.carried ?? []).filter((y) => y !== x);
      say(c, [h.owner], `${who(h)[0].toUpperCase() + who(h).slice(1)} of ${c.territories[h.from].name}, led away by ${name(c, x.by)}, ${h.men.length + h.women.length === 1 ? 'is' : 'are'} ${x.by === 0 ? 'your' : 'their'} people now, at ${t.name}, and will not come home.`);
      if (h.owner === 0) (c.chronicle ??= []).push({ turn: c.turn, text: `${who(h)[0].toUpperCase() + who(h).slice(1)} of ${c.territories[h.from].name}, led away by ${name(c, x.by)}, were never got back.` });
    } else if (carriedLeft(c, x) === 1 && h.owner === 0) c.log.push(`One season is left to get back the ${who(h)} ${name(c, x.by)} took from ${c.territories[h.from].name}: take ${t.name}.`);
    countFrom(f, ages);
  }
  return { born, taken };
}
