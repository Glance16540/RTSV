// Bands on the march, and the armies they meet (docs/DESIGN.md: threats of men never stop, and live on the map).
// Three small rules that the bands' moving (bandroam.ts) and their coming against armies (bandfight.ts) read.
//
//   Along a road a band goes farther. A camp that has set out for a mark a few lands off goes a land a season over
//     wild country, but where a road runs (between two lands next to each other that peoples hold) it goes
//     on: up to MARCH.pace lands in a season. (Pirates already sail to any coast in one move.)
//   They make for what is rich as well as what is weak. When a camp weighs where to go, a mark with full stores
//     draws it more, by up to MARCH.rich; which town it strikes once there is still the softest (threats.ts).
//   An army is not always what it looks. One resting after it has stormed a town counts for MARCH.tired of its
//     strength to a band that weighs falling on it, and fights at that; one alone in a land that is not its
//     people's, with none of their armies in it or beside it, counts for MARCH.alone.
//   Armies see them coming. An army standing in or beside a land a band on the march passes through sees it, and
//     its people are told where the band is and where it is bound. If that is a town of theirs, the town is
//     warned as heralds would warn it (heralds.ts), a season before the band can strike. A town within two
//     lands of one it passes sees it too.
//   Some come from far off (bandwilds.ts). What counts as the far wilds, and the record kept of each march in
//     from them, are here so that the bands' moving and fighting can write to it.
//
// Plain data in, plain data out; the telling is the callers'. Strengths are first guesses.
import type { Army, Campaign } from './campaign';
import { resting } from './armytown';
import { STORE_KINDS, folkOf } from './township';
import { warn } from './heralds';
import { emptyLand } from './founding';

export const MARCH = {
  /** The most lands a band on the march goes in a season, the legs after the first only along a road. */
  pace: 2,
  /** How much more a mark with full stores draws a camp choosing where to go, and the stores that count as full. */
  rich: 1, richAt: 2000,
  /** What an army counts for to a band: resting after a storming, and alone in a land not its people's. */
  tired: 0.6, alone: 0.8,
  /** How far a band keeps to a way it has set out on, in lands (a camp choosing afresh looks ROAM.range). */
  long: 8,
};

/** Bands from the far wilds (bandwilds.ts): numbers kept here so the bands' moving can read them with no ring of imports. */
export const WILDS = {
  /** Of new camps of raiders and slavers, the share born in the far wilds when there are any with a way in. */
  share: 0.75,
};

/** One band's march in from the far wilds, for the season's telling and the health report. */
export interface March { band: number; born: number; from: number; bound: number; lands: number; seen?: number; arrived?: number; struck?: number; met?: number; broken?: boolean; gone?: number }
declare module './campaign' {
  interface Campaign { /** Every march in from the far wilds, begun and ended (bandmarch.ts). */ marches?: March[] }
}
/** The record of a band's march in, if it came from the far wilds. */
export const marchOf = (c: Campaign, band: number): March | undefined => (c.marches ?? []).find((m) => m.band === band);
/** Something happened on a band's march in: it is written on its record the first time. */
export function marched(c: Campaign, band: number, what: 'seen' | 'arrived' | 'struck' | 'met' | 'gone', broken = false): void {
  const m = marchOf(c, band);
  if (!m) return;
  // Met means an army went against it before it had struck anyone.
  if (what === 'met') { if (m.struck === undefined && m.met === undefined) m.met = c.turn; if (broken && m.struck === undefined) m.broken = true; return; }
  if (m[what] === undefined) m[what] = c.turn;
}

/** How many lands each land is from the nearest held one (0 for a held land; a land no way joins to one is as far as the map is wide). */
export function landsFromHeld(c: Campaign): number[] {
  const far = c.territories.length, d = c.territories.map((t) => (t.owner >= 0 && c.factions[t.owner]?.alive ? 0 : far));
  let edge = c.territories.filter((t) => d[t.id] === 0).map((t) => t.id);
  while (edge.length) {
    const next: number[] = [];
    for (const id of edge) for (const n of c.territories[id].adj) if (d[n] > d[id] + 1) { d[n] = d[id] + 1; next.push(n); }
    edge = next;
  }
  return d;
}
/**
 * The far wilds: lands that began wild (wilds.ts: far or poor ground with no tribe and no town, beside nobody's
 * chief town) and are still empty (founding.ts), with no band or army in them, and joined by land to a held land.
 * A tribe's land is not the far wilds, however far off: somebody lives there.
 */
export function farWilds(c: Campaign): number[] {
  const d = landsFromHeld(c);
  return c.territories.filter((t) => !!t.wild && emptyLand(c, t.id) && d[t.id] < c.territories.length && !c.armies.some((a) => a.at === t.id)).map((t) => t.id);
}

/** Does a road run between these two lands: they are next to each other and each is held by some people (roads join towns)? */
export function onRoad(c: Campaign, from: number, to: number): boolean {
  const x = c.territories[from], y = c.territories[to];
  const held = (o: number): boolean => o >= 0 && !!c.factions[o]?.alive;
  return !!x && !!y && x.adj.includes(to) && held(x.owner) && held(y.owner);
}

/** How rich a town is to a band looking for where to go, 0 to 1: its stores of every kind against a full store. */
export function richness(c: Campaign, tid: number): number {
  const t = c.territories[tid];
  if (!t || t.owner < 0) return 0;
  const s = folkOf(c, tid).stores;
  return Math.min(1, STORE_KINDS.reduce((k, x) => k + Math.max(0, s[x]), 0) / MARCH.richAt);
}
/** What a mark's lure is multiplied by for its riches. */
export const richLure = (c: Campaign, tid: number): number => 1 + MARCH.rich * richness(c, tid);

/** Is this army alone: in a land that is not its people's, with no other army of theirs in it or beside it? */
export function alone(c: Campaign, a: Army): boolean {
  const t = c.territories[a.at];
  if (!t || t.owner === a.owner) return false;
  const near = new Set([a.at, ...t.adj]);
  return !c.armies.some((x) => x !== a && x.owner === a.owner && near.has(x.at));
}
/** What share of its strength an army counts for to a band: less when it is resting after a storming, or alone. */
export const exposure = (c: Campaign, a: Army): number => (resting(c, a) ? MARCH.tired : 1) * (alone(c, a) ? MARCH.alone : 1);
/** Why an army is worth falling on, for the telling: '' if it is neither tired nor alone. */
export const exposedHow = (c: Campaign, a: Army): string => (resting(c, a) ? 'still resting after the storming' : alone(c, a) ? 'alone in a strange land' : '');

/** The armies that see a band pass: those standing in or beside any of these lands, one for each people, the nearest to the front of the list first. */
export function watchers(c: Campaign, path: number[]): Army[] {
  const seen: Army[] = [];
  for (const id of path) {
    const near = new Set([id, ...(c.territories[id]?.adj ?? [])]);
    for (const a of [...c.armies].sort((x, y) => x.id - y.id)) if (near.has(a.at) && c.factions[a.owner]?.alive && !seen.some((s) => s.owner === a.owner)) seen.push(a);
  }
  return seen;
}
/** The peoples whose towns see a band pass: each that holds a land within two of one of these lands (from the hills, and by travellers' word), but for those in `but`. */
export function townsThatSee(c: Campaign, path: number[], but: number[] = []): { owner: number; at: number }[] {
  const seen: { owner: number; at: number }[] = [];
  const within = (id: number): number[] => { const one = [id, ...(c.territories[id]?.adj ?? [])]; return [...new Set([...one, ...one.flatMap((n) => c.territories[n].adj)])]; };
  for (const id of path) for (const n of within(id)) {
    const o = c.territories[n].owner;
    if (o >= 0 && c.factions[o]?.alive && !but.includes(o) && !seen.some((s) => s.owner === o)) seen.push({ owner: o, at: n });
  }
  return seen;
}
/** A people whose army has seen a band bound for one of its own towns warns the town. Returns whether it was theirs to warn. */
export function warnBound(c: Campaign, owner: number, mark: number | undefined): boolean {
  if (mark === undefined || c.territories[mark]?.owner !== owner) return false;
  warn(c, mark);
  return true;
}
