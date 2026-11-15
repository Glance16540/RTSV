// Bands move (docs/DESIGN.md: threats of men never stop, and live on the map).
//
//   They flee strong armies. A band with an army at least its match standing at its place moves off before the
//     season's fighting, to the best place it can reach that has no such army; with nowhere to go it stays.
//   They roam toward softer marks. Every few seasons a band looks about, and if a place next to its own would
//     put a clearly softer town in its reach it goes there. Those it holds go with it.
//   They break up. A band that has grown old and stayed weak, holding nobody, drifts apart. So does one with
//     nothing left in its reach to rob.
//   They settle. Raiders or slavers that have grown strong in a land of the local tribes take it for their own
//     and become marauders: they hold the land from then on (bandhorde.ts).
//
// The marauders do not roam: they hold their land and spread from it.
import type { Campaign, Territory } from './campaign';
import { armyStrength } from './campaign';
import { Band, mark, note, reachOf, softest } from './threats';
import { campsBorne } from './bandhorde';

export const ROAM = {
  /** A band flees an army at its place that is at least this many times its strength. */
  flee: 1,
  /** Seasons a band stays put before it looks for somewhere softer, and how much softer the mark must be to move for. */
  restless: 4, softer: 1.5,
  /** A band this many seasons old and no stronger than `weak` breaks up, if it holds nobody. */
  old: 16, weak: 2,
  /** Raiders or slavers this strong and this many seasons old, camped in a tribe's land, take it for their own. */
  settle: 9, settled: 10,
};

const cap = (name: string): string => name[0].toUpperCase() + name.slice(1);
const held = (c: Campaign, t: Territory): boolean => t.owner >= 0 && !!c.factions[t.owner]?.alive;
/** The strongest army standing at a band's place, whoever's it is. */
export function armyOver(c: Campaign, b: Band): number {
  return Math.max(0, ...c.armies.filter((a) => a.at === b.at || a.at === b.to).map((a) => armyStrength(a, c)));
}

/** The places a band could move to from where it is: [at, to?]. */
export function placesFrom(c: Campaign, b: Band): [number, number?][] {
  const taken = new Set((c.bands ?? []).filter((x) => x !== b).map((x) => x.at));
  const free = (t: Territory): boolean => !taken.has(t.id) && !c.armies.some((a) => a.at === t.id);
  if (b.kind === 'pirates') return c.territories.filter((t) => t.trait === 'coast' && t.id !== b.at && free(t)).map((t): [number] => [t.id]);
  if (b.kind === 'highwaymen') {
    // Another road that meets this one.
    const roads: [number, number][] = [];
    for (const end of [b.at, b.to!]) for (const n of c.territories[end].adj) {
      const x = c.territories[end], y = c.territories[n];
      if (!held(c, x) || y.owner !== x.owner || (n === b.at || n === b.to)) continue;
      if (free(x) && free(y)) roads.push([Math.min(end, n), Math.max(end, n)]);
    }
    return roads;
  }
  // A camp: a tribe's land that marauders do not hold, or the hills of a held land that is not a capital.
  return c.territories[b.at].adj.map((n) => c.territories[n]).filter((t) => free(t) && !t.horde && (t.owner < 0 || (held(c, t) && t.capital < 0))).map((t): [number] => [t.id]);
}

/** How soft the softest mark would be from a place: 0 if there is nothing there to rob. */
function lureFrom(c: Campaign, b: Band, place: [number, number?]): number {
  const at = b.at, to = b.to;
  b.at = place[0]; b.to = place[1];
  const m = softest(c, b);
  b.at = at; b.to = to;
  if (b.to === undefined) delete b.to;
  return m ? m.lure : 0;
}
function best(c: Campaign, b: Band): { place: [number, number?]; lure: number } | null {
  const all = placesFrom(c, b).map((place) => ({ place, lure: lureFrom(c, b, place) })).filter((x) => x.lure > 0).sort((x, y) => y.lure - x.lure || x.place[0] - y.place[0]);
  return all[0] ?? null;
}
function move(c: Campaign, b: Band, place: [number, number?]): void {
  b.at = place[0];
  if (place[1] === undefined) delete b.to; else b.to = place[1];
  b.moved = c.turn;
  mark(c, 'band', b.at);
}

/** One season of bands moving, settling and breaking up. Returns how many moved. */
export function roamSeason(c: Campaign, out: string[]): number {
  let moved = 0;
  for (const b of [...(c.bands ?? [])]) {
    if (b.kind === 'marauders') continue;
    const age = c.turn - b.since, here = c.territories[b.at], owners = reachOf(c, b).map((id) => c.territories[id].owner);
    const gone = (text: string): void => { note(c, out, 'gone', b, b.at, text, owners); c.bands = (c.bands ?? []).filter((x) => x !== b); };
    // Old and still weak, holding nobody: they drift apart.
    if (age >= ROAM.old && b.strength <= ROAM.weak && !b.held.length) { gone(`${cap(b.name)} have come to nothing and drifted apart.`); continue; }
    // Grown strong in a tribe's land: they take it for their own.
    if ((b.kind === 'raiders' || b.kind === 'slavers') && b.strength >= ROAM.settle && age >= ROAM.settled && here.owner < 0 && !here.horde && here.capital < 0 && (c.bands ?? []).filter((k) => k.kind === 'marauders').length < campsBorne(c)) {
      b.kind = 'marauders';
      here.horde = true; here.militia = Math.max(here.militia, b.strength);
      c.events = [...(c.events ?? []), { kind: 'horde', at: here.id, turn: c.turn, until: c.turn + 1 }];
      note(c, out, 'settled', b, here.id, `${cap(b.name)} have grown strong enough to take ${here.name} for their own. They hold it now, and will spread.`, owners);
      continue;
    }
    const over = armyOver(c, b);
    if (over >= b.strength * ROAM.flee) {
      const to = best(c, b);
      if (to) { const from = here.name; move(c, b, to.place); moved++; note(c, out, 'fled', b, b.at, `${cap(b.name)} have fled ${from} before the army there, and made their place ${b.kind === 'highwaymen' ? 'on the road' : 'at'} ${c.territories[b.at].name}.`, [...owners, ...reachOf(c, b).map((id) => c.territories[id].owner)]); }
      continue; // cornered, they stay and are fought
    }
    const now = softest(c, b);
    if (!now) {
      const to = best(c, b);
      if (to) { move(c, b, to.place); moved++; note(c, out, 'moved', b, b.at, `${cap(b.name)} have moved to ${c.territories[b.at].name}: there was nothing left to rob where they were.`, reachOf(c, b).map((id) => c.territories[id].owner)); }
      else if (!b.held.length) gone(`${cap(b.name)} have gone from ${here.name}: there is nothing left there to rob.`);
      continue;
    }
    if (c.turn - (b.moved ?? b.since) < ROAM.restless) continue;
    const to = best(c, b);
    if (to && to.lure >= now.lure * ROAM.softer) { move(c, b, to.place); moved++; note(c, out, 'moved', b, b.at, `${cap(b.name)} have moved their place to ${c.territories[b.at].name}, after softer marks.`, reachOf(c, b).map((id) => c.territories[id].owner)); }
    else b.moved = c.turn; // they have looked, and stay
  }
  return moved;
}
