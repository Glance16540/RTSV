// Children taken in (docs/DESIGN.md, "Children are never shown"). A child whose town is left with no grown
// people, however that came about (hunger, plague, raids, a battle, the men gone to war), is taken in by the
// nearest town of its own people, with its record. Nobody harms a child, and nobody sees one move.
//
// What goes with them. On the map a child's record is its age on the town's roll (ageing.ts): that goes with it,
// so it comes of age when it would have. The names of houses are kept only inside a battle (nursery.ts); between
// battles a town's children are counted, not named, so there is no more to carry.
//
// The nearest town is the nearest as the crow flies (they are carried, not marched: no sea or closed border stops
// them), the lower-numbered on a tie. A town takes in no more children than a town may hold (MAX_KIND): the rest go to
// the next nearest.
//
// A people with no other town: the nearest other people takes its children in (the owner's word, docs/DESIGN.md),
// a living nation or the local tribes, whoever holds the nearest town that is not the marauders', and they grow up
// as that town's own: they join its children on its record and come of age as its people.
import type { Campaign } from './campaign';
import { agesOf, countFrom } from './ageing';
import { MAX_KIND, folkOf, grown } from './township';

/** Children moved from one town to another. `stranger`: taken in by another people, as theirs. */
export interface TakenIn { from: number; to: number; children: number; stranger?: boolean }

/** The towns of a people, nearest first, as the crow flies from a land: children are carried, over sea and closed borders too. */
export function nearestTowns(c: Campaign, f: number, from: number): number[] {
  const o = c.territories[from], d = (id: number) => Math.hypot(c.territories[id].x - o.x, c.territories[id].y - o.y);
  return c.territories.filter((t) => t.owner === f && !t.horde && t.id !== from).map((t) => t.id).sort((a, b) => d(a) - d(b) || a - b);
}

/** Towns of any people but this one, nearest first as the crow flies: a living nation's or the local tribes', never the marauders'. */
export function strangersTowns(c: Campaign, f: number, from: number): number[] {
  const o = c.territories[from], d = (id: number) => Math.hypot(c.territories[id].x - o.x, c.territories[id].y - o.y);
  return c.territories.filter((t) => t.owner !== f && !t.horde && t.id !== from && (t.owner < 0 || !!c.factions[t.owner]?.alive)).map((t) => t.id).sort((a, b) => d(a) - d(b) || a - b);
}

/** The children of one town with no grown people go to the nearest towns of their people. Returns where they went. */
export function takeIn(c: Campaign, tid: number): TakenIn[] {
  const t = c.territories[tid], f = folkOf(c, tid);
  if (t.owner < 0 || grown(f) > 0 || f.children <= 0) return [];
  const out: TakenIn[] = [];
  const from = agesOf(c, tid, f), kids = [...from.k].sort((a, b) => b - a);
  const own = nearestTowns(c, t.owner, tid);
  // Their own people first; a people with no other town, the nearest other people.
  for (const to of own.length ? own : strangersTowns(c, t.owner, tid)) {
    if (!kids.length) break;
    const g = folkOf(c, to), room = Math.max(0, MAX_KIND - g.children);
    if (!room) continue;
    const going = kids.splice(0, room), ages = agesOf(c, to, g);
    ages.k.push(...going);
    countFrom(g, ages);
    out.push({ from: tid, to, children: going.length, ...(own.length ? {} : { stranger: true }) });
  }
  countFrom(f, { ...from, k: kids });
  return out;
}

/** Every held town left with no grown people sends its children to be taken in. Called once a season. */
export function orphansSeason(c: Campaign): TakenIn[] {
  const out: TakenIn[] = [];
  for (const t of c.territories) {
    if (t.owner < 0 || t.horde || !c.factions[t.owner]?.alive) continue;
    for (const x of takeIn(c, t.id)) {
      out.push(x);
      const to = c.territories[x.to], n = x.children === 1 ? 'The child' : `The ${x.children} children`, one = x.children === 1;
      const people = (o: number) => (o === 0 ? 'your people' : o < 0 ? 'the local tribes' : `the ${c.factions[o].name}`);
      if (!x.stranger) {
        if (t.owner === 0) c.log.push(`${n} of ${t.name}, left with nobody grown, ${one ? 'has' : 'have'} been taken in at ${to.name}.`);
        (c.chronicle ??= []).push({ turn: c.turn, text: `${n} of ${t.name}, left with nobody grown to keep ${one ? 'it' : 'them'}, ${one ? 'was' : 'were'} taken in at ${to.name}.` });
      } else {
        // Another people's: told to the player whether the children were theirs or are theirs now.
        if (t.owner === 0) c.log.push(`${n} of ${t.name}, the last of your people, ${one ? 'has' : 'have'} been taken in by ${people(to.owner)} at ${to.name}, and will grow up as theirs.`);
        else if (to.owner === 0) c.log.push(`${n} of ${t.name}, the last of ${people(t.owner)}, ${one ? 'has' : 'have'} been taken in at ${to.name}, and will grow up as yours.`);
        (c.chronicle ??= []).push({ turn: c.turn, text: `${n} of ${t.name}, the last of ${people(t.owner).replace('your people', 'the player\'s people')}, ${one ? 'was' : 'were'} taken in by ${people(to.owner).replace('your people', 'the player\'s people')} at ${to.name}, to grow up as ${one ? 'one' : 'some'} of theirs.` });
      }
    }
  }
  return out;
}
