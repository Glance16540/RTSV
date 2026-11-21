// Bands move (docs/DESIGN.md: threats of men never stop, and live on the map).
//
//   They flee strong armies. A band with an army at least its match standing at its place moves off before the
//     season's fighting, to the best place it can reach that has no such army; with nowhere to go it stays.
//   They roam toward softer marks. Every few seasons a band looks about. A camp of raiders or slavers plans a way:
//     it looks ROAM.range lands off (farther on a map wider than today's: `roamRange`) over ground a camp could stand on,
//     a mark counting for less the farther it is, and if a clearly softer town could be got within reach it sets out, a land a season over wild country and
//     farther along a road (bandmarch.ts), until it is there. Armies it passes see it, and their peoples are told.
//     Pirates sail to any coast and highwaymen shift to a road that meets theirs. Those a band holds go with it.
//   They break up. A band that has grown old and stayed weak, holding nobody, drifts apart. So does one with
//     nothing left in its reach to rob.
//   They settle. Raiders or slavers that have grown strong in a land of the local tribes take it for their own
//     and become marauders: they hold the land from then on (bandhorde.ts).
//
// The marauders do not roam: they hold their land and spread from it.
import type { Campaign, Territory } from './campaign';
import { armyStrength } from './campaignbase';
import { Band, mark, note, reachOf, softest } from './threats';
import { campsBorne } from './bandhorde';
import { landsWithin, outOf } from './rim';
import { MARCH, marched, onRoad, richLure, townsThatSee, warnBound, watchers } from './bandmarch';
import { turnAside } from './bandturn';

export const ROAM = {
  /** A band flees an army at its place that is at least this many times its strength. */
  flee: 1,
  /** Seasons a band stays put before it looks for somewhere softer, and how much softer the mark must be to move for. */
  restless: 4, softer: 1.3,
  /** A band this many seasons old and no stronger than `weak` breaks up, if it holds nobody. */
  old: 16, weak: 2,
  /** Raiders or slavers this strong and this many seasons old, camped in a tribe's land, take it for their own. */
  settle: 9, settled: 10,
  /** A camp looks this many lands off for a softer mark, and a mark counts for less by `far` for each season's march to it beyond the first. */
  range: 4, far: 0.2,
  /**
   * The lands of a map up to which a camp looks and weighs as above. On a wider map it looks farther and minds the march
   * less, both by the root of how many times wider the map is (so by its breadth, not its area), and never farther than
   * `widest` lands. Every map made today has 25 to 29 lands inside the rim, so today this changes nothing: it is here so
   * that a wider map, when there is one, has bands that wander and do not only strike next door.
   */
  lands: 32, widest: 8,
};

/** How many times as broad as today's maps this one is, never under 1 (rim.ts counts the lands inside the rim of wilderness). */
export const roamScale = (c: Campaign): number => Math.max(1, Math.sqrt(landsWithin(c) / ROAM.lands));
/** How many lands off a camp looks for a softer mark on this map. */
export const roamRange = (c: Campaign): number => Math.min(ROAM.widest, Math.max(ROAM.range, Math.round(ROAM.range * roamScale(c))));
/** A mark's lure weighed against the seasons of the march to it: less for each season beyond the first, and less sharply on a wider map. */
export const weighed = (c: Campaign, lure: number, seasons: number): number => lure / (1 + (ROAM.far / roamScale(c)) * (seasons - 1));

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
  return outOf(c, b.at).map((n) => c.territories[n]).filter((t) => campable(c, b, t)).map((t): [number] => [t.id]);
}

/** Could this band's camp stand in this land: it is free of other bands and of armies, not the marauders', and a tribe's or a held land that is no capital? */
function campable(c: Campaign, b: Band, t: Territory): boolean {
  if ((c.bands ?? []).some((x) => x !== b && x.at === t.id) || c.armies.some((a) => a.at === t.id)) return false;
  return !t.horde && !t.rim && (t.owner < 0 || (held(c, t) && t.capital < 0)); // none camps in the rim of wilderness: bands are born there and leave it (rim.ts)
}

/**
 * A way for a camp across the map. From where it is, over lands a camp could stand in, out to ROAM.range lands:
 * every land it could reach, how many lands off, and the first step toward it. Short and cheap: a breadth-first
 * walk of a few dozen lands at most.
 */
export function waysFrom(c: Campaign, b: Band, range = roamRange(c)): { to: number; steps: number; next: number; seasons: number }[] {
  if (b.kind !== 'raiders' && b.kind !== 'slavers') return [];
  const out: { to: number; steps: number; next: number; seasons: number }[] = [], seen = new Set([b.at]);
  // `seasons`: how long the march there takes, a land a season and farther along a road (bandmarch.ts); `legs`: lands gone in the last of them.
  let edge: { at: number; next: number; seasons: number; legs: number }[] = [{ at: b.at, next: -1, seasons: 0, legs: MARCH.pace }];
  for (let steps = 1; steps <= range && edge.length; steps++) {
    const far: typeof edge = [];
    for (const e of edge) for (const n of [...outOf(c, e.at)].sort((x, y) => x - y)) {
      if (seen.has(n) || !campable(c, b, c.territories[n])) continue;
      seen.add(n);
      const next = e.next < 0 ? n : e.next, on = e.legs < MARCH.pace && onRoad(c, e.at, n);
      const seasons = on ? e.seasons : e.seasons + 1, legs = on ? e.legs + 1 : 1;
      out.push({ to: n, steps, next, seasons });
      far.push({ at: n, next, seasons, legs });
    }
    edge = far;
  }
  return out;
}

/** Every place a camp could march to and rob from, within so many lands: where, how far, the first step, the seasons of the march, and how soft and rich the softest mark there is (not weighed against the march). */
export function marksFrom(c: Campaign, b: Band, range = roamRange(c)): { bound: number; next: number; steps: number; seasons: number; lure: number }[] {
  return waysFrom(c, b, range).map((w) => ({ bound: w.to, next: w.next, steps: w.steps, seasons: w.seasons, lure: lureFrom(c, b, [w.to], true) })).filter((w) => w.lure > 0);
}

/** The softest mark a camp could get within reach of by a few lands' march: where it would go, how far, its first step, and how soft. */
export function wayTo(c: Campaign, b: Band, range = roamRange(c)): { bound: number; next: number; steps: number; seasons: number; lure: number } | null {
  const all = marksFrom(c, b, range)
    .sort((x, y) => weighed(c, y.lure, y.seasons) - weighed(c, x.lure, x.seasons) || x.steps - y.steps || x.bound - y.bound);
  return all[0] ?? null;
}

/** How soft the softest mark would be from a place: 0 if there is nothing there to rob. */
function lureFrom(c: Campaign, b: Band, place: [number, number?], riches = false): number {
  const at = b.at, to = b.to;
  b.at = place[0]; b.to = place[1];
  const m = softest(c, b);
  b.at = at; b.to = to;
  if (b.to === undefined) delete b.to;
  return m ? m.lure * (riches ? richLure(c, m.id) : 1) : 0; // a camp choosing where to go is drawn by full stores too (bandmarch.ts)
}
function best(c: Campaign, b: Band): { place: [number, number?]; lure: number } | null {
  const all = placesFrom(c, b).map((place) => ({ place, lure: lureFrom(c, b, place) })).filter((x) => x.lure > 0).sort((x, y) => y.lure - x.lure || x.place[0] - y.place[0]);
  return all[0] ?? null;
}
function move(c: Campaign, b: Band, place: [number, number?]): void {
  b.at = place[0];
  if (place[1] === undefined) delete b.to; else b.to = place[1];
  b.moved = c.turn;
  if (b.bound === b.at) delete b.bound;
  mark(c, 'band', b.at);
}

/**
 * A band on its way goes on along the road (bandmarch.ts): after the season's first land, further lands toward where
 * it is bound while a road runs to the next, up to MARCH.pace in all. Armies in or beside the lands it passes see
 * it, and their peoples are told; a people it is bound for warns the town.
 */
function marchOn(c: Campaign, b: Band, from: number, out: string[]): void {
  const path = [from, b.at];
  for (let legs = 1; legs < MARCH.pace && b.bound !== undefined; legs++) {
    const way = waysFrom(c, b, MARCH.long).find((w) => w.to === b.bound);
    if (!way || !onRoad(c, b.at, way.next)) break;
    move(c, b, [way.next]);
    path.push(b.at);
  }
  const mark = softest(c, b, reachOf(c, { ...b, at: b.bound ?? b.at }))?.id;
  const armies = watchers(c, path);
  const told = (owner: number, text: string): void => {
    const theirs = warnBound(c, owner, mark);
    note(c, out, 'seen', b, b.at, `${text} ${b.name} on the march: they are at ${c.territories[b.at].name}${b.bound !== undefined ? `, making for ${c.territories[b.bound].name}` : ''}${theirs && mark !== undefined ? `. Word is sent to ${c.territories[mark].name}` : ''}.`, [owner]);
    marched(c, b.id, 'seen');
  };
  for (const a of armies) told(a.owner, `${a.owner === 0 ? 'Your army' : 'An army'} at ${c.territories[a.at].name} has seen`);
  // A town in or beside a land it passes sees it too.
  for (const t of townsThatSee(c, path, armies.map((a) => a.owner))) told(t.owner, `${t.owner === 0 ? 'Your people' : 'The people'} at ${c.territories[t.at].name} have seen`);
  if (b.bound === undefined && b.afar) { delete b.afar; marched(c, b.id, 'arrived'); }
}

/** One season of bands moving, settling and breaking up. Returns how many moved. */
export function roamSeason(c: Campaign, out: string[]): number {
  let moved = 0;
  for (const b of [...(c.bands ?? [])]) {
    if (b.kind === 'marauders') continue;
    const age = c.turn - b.since, here = c.territories[b.at], owners = reachOf(c, b).map((id) => c.territories[id].owner);
    const gone = (text: string): void => { marched(c, b.id, 'gone'); note(c, out, 'gone', b, b.at, text, owners); c.bands = (c.bands ?? []).filter((x) => x !== b); };
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
      delete b.bound; // whatever they were making for
      if (b.afar) { delete b.afar; marched(c, b.id, 'arrived'); } // their march in ends where the army turned them
      continue; // cornered, they stay and are fought
    }
    // A dead town in reach: they turn aside for it, and standing beside it walk in (bandturn.ts).
    const aside = turnAside(c, b, (cc, bb) => waysFrom(cc, bb));
    if (aside === 'in') { note(c, out, 'moved', b, b.at, `${cap(b.name)} have found a town standing empty beside them, and made it their camp.`, owners); moved++; continue; }
    // On their way somewhere: one land nearer each season, while there is still a way.
    if (b.bound !== undefined) {
      if ((b.gathers ?? 0) > c.turn) continue; // still gathering in the rim of wilderness (bandwilds.ts)
      const way = waysFrom(c, b, MARCH.long).find((w) => w.to === b.bound);
      if (way) { const from = b.at; move(c, b, [way.next]); marchOn(c, b, from, out); moved++; continue; }
      delete b.bound;
      if (b.afar) { delete b.afar; marched(c, b.id, 'arrived'); } // the way is shut: they stop where they are
    }
    const now = softest(c, b);
    if (!now) {
      // Nothing to rob here or next door: a camp looks farther, and sets out along the roads for what it finds.
      const far = wayTo(c, b);
      if (far && far.steps > 1 && !best(c, b)) {
        const from = b.at;
        b.bound = far.bound;
        move(c, b, [far.next]); moved++;
        note(c, out, 'moved', b, b.at, `${cap(b.name)} have broken camp and set out for ${c.territories[far.bound].name}, ${far.steps} lands off: there was nothing left to rob where they were.`, [...owners, ...reachOf(c, b).map((id) => c.territories[id].owner)]);
        marchOn(c, b, from, out);
        continue;
      }
      const to = best(c, b);
      if (to) { move(c, b, to.place); moved++; note(c, out, 'moved', b, b.at, `${cap(b.name)} have moved to ${c.territories[b.at].name}: there was nothing left to rob where they were.`, reachOf(c, b).map((id) => c.territories[id].owner)); }
      else if (!b.held.length) gone(`${cap(b.name)} have gone from ${here.name}: there is nothing left there to rob.`);
      continue;
    }
    if (c.turn - (b.moved ?? b.since) < ROAM.restless) continue;
    // A camp plans a way of a few lands toward the softest mark about; pirates and highwaymen look one move off.
    const way = wayTo(c, b);
    if (way && weighed(c, way.lure, way.seasons) >= now.lure * ROAM.softer) {
      const where = c.territories[way.bound].name;
      if (way.steps > 1) b.bound = way.bound;
      const from = b.at;
      move(c, b, [way.next]); moved++;
      note(c, out, 'moved', b, b.at, way.steps > 1 ? `${cap(b.name)} have broken camp and set out for ${where}, ${way.steps} lands off, after softer marks.` : `${cap(b.name)} have moved their place to ${where}, after softer marks.`, [...owners, ...reachOf(c, b).map((id) => c.territories[id].owner)]);
      marchOn(c, b, from, out);
      continue;
    }
    const to = way ? null : best(c, b);
    if (to && to.lure >= now.lure * ROAM.softer) { move(c, b, to.place); moved++; note(c, out, 'moved', b, b.at, `${cap(b.name)} have moved their place to ${c.territories[b.at].name}, after softer marks.`, reachOf(c, b).map((id) => c.territories[id].owner)); }
    else b.moved = c.turn; // they have looked, and stay
  }
  return moved;
}
