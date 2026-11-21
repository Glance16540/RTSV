// Where the leader is. A leader is one person in one place on the campaign map: a land of their people's, in its
// town or with the army that stands there. They are in a battle only if it is fought where they are. They steady the
// land they are in (no unrest rises there), can travel between their people's lands, and can call the armies to them.
// Rules only: campaign.ts asks here where the leader is, and dynasty.ts seats a new one.

import type { Army, Campaign } from './campaign';
import { HUB, reach } from './campaignbase';

export interface Court {
  /** The land the leader is in. */
  at: number;
  /** They have travelled this turn, alone or with an army. */
  moved?: boolean;
  /** They keep to the town: an army that marches out of their land goes without them. */
  holds?: boolean;
  /** The army that marched out without them this turn, while it still stands in their land (a battle not yet fought). */
  away?: number;
  /** The armies are called: each turn every army called and not with the leader marches a land nearer, through their people's own country. */
  rally?: boolean;
  /** Which armies are called, by id, where the leader chose them; without it, every army but one holding a town that needs it (courtcall.ts). */
  called?: number[];
}

/**
 * What the call asks of rules that stand above this module (courtcall.ts fills these in; it reads who threatens a town,
 * who is allied and where the bands are, none of which this module can import without a ring). Left as they are, every
 * army is called, no land but the people's own is crossed, and a leader travels untroubled, as it always was.
 */
export const CALLING: {
  /** Does this army hold a town that needs it, and so stay unless called by name? */
  keeps: (c: Campaign, a: Army) => boolean;
  /** May this people's armies cross this land, which is not theirs, without stopping in it? */
  pass: (c: Campaign, f: number, tid: number) => boolean;
  /** A leader travelling alone from one land to another: are they set upon on the road and turned back? (It says so in the log, and does what else befalls them.) */
  waylaid: (c: Campaign, f: number, from: number, to: number) => boolean;
} = { keeps: () => false, pass: () => false, waylaid: () => false };

const armiesOf = (c: Campaign, f: number): Army[] => c.armies.filter((a) => a.owner === f);
const flag = (c: Campaign, f: number, ct: Court): void => { for (const a of armiesOf(c, f)) a.hero = a.at === ct.at && a.id !== ct.away; };

/**
 * A people's court: where their leader is, or null while nobody leads them. Asking also sets the record straight:
 * an army the leader rides with carries them along, any army of theirs in the leader's land has them at its head,
 * and a leader whose land is lost under them gets away to a neighbouring land of their people's or does not get away.
 */
export function courtOf(c: Campaign, f: number): Court | null {
  const fac = c.factions[f];
  if (!fac || !fac.alive || !fac.heroAlive) return null;
  const mine = armiesOf(c, f), riding = mine.find((a) => a.hero);
  let ct = fac.court;
  if (!ct) {
    const seat = c.territories.find((t) => t.capital === f && t.owner === f) ?? c.territories.find((t) => t.owner === f);
    ct = fac.court = { at: riding?.at ?? seat?.id ?? mine[0]?.at ?? -1 };
  } else if (riding) ct.at = riding.at;
  if (ct.away != null && !mine.some((a) => a.id === ct!.away && a.at === ct!.at)) delete ct.away;
  flag(c, f, ct);
  const land = c.territories[ct.at];
  if ((!land || land.owner !== f) && !mine.some((a) => a.hero)) {
    const near = land ? reach(c, land.id).map((n) => c.territories[n]).filter((t) => t.owner === f) : c.territories.filter((t) => t.owner === f);
    const refuge = near.find((t) => t.capital === f) ?? near[0];
    const name = typeof fac.hero?.name === 'string' && fac.hero.name ? fac.hero.name : f === 0 ? 'Your leader' : `The leader of the ${fac.name}`;
    if (!refuge) {
      fac.heroAlive = false;
      fac.heroRank = Math.max(0, (fac.heroRank ?? 0) - 1);
      c.log.push(`${name} was taken with ${land?.name ?? 'the last of their land'} and killed.`);
      return null;
    }
    c.log.push(`${name} got away from ${land?.name ?? 'the fighting'} to ${refuge.name}.`);
    ct.at = refuge.id;
    ct.moved = true;
    flag(c, f, ct);
  }
  return ct;
}

/** Is this people's leader in this land? */
export const leaderAt = (c: Campaign, f: number, tid: number): boolean => f >= 0 && courtOf(c, f)?.at === tid;

/** Put a leader in a land: one who has just taken up the rule, or been hired. */
export function seat(c: Campaign, f: number, at: number): void {
  const fac = c.factions[f];
  for (const a of armiesOf(c, f)) a.hero = false;
  fac.court = { at, ...(fac.court?.holds ? { holds: true } : {}), ...(fac.court?.rally ? { rally: true } : {}), ...(fac.court?.called ? { called: fac.court.called } : {}) };
  flag(c, f, fac.court);
}

/** An army is about to march: does the leader ride with it? Called by moveArmy once the march is known to be allowed. */
export function marchesOut(c: Campaign, a: Army): void {
  if (!a.hero) return;
  const ct = courtOf(c, a.owner);
  if (!ct) return;
  if (ct.holds) { a.hero = false; ct.away = a.id; } else ct.moved = true;
}

/** The lands the leader could travel to now: a neighbouring land of their own people's, once a turn. */
export function leaderReach(c: Campaign, f: number): number[] {
  const ct = courtOf(c, f);
  if (!ct || ct.moved || c.pending || c.demand || !c.territories[ct.at]) return [];
  return reach(c, ct.at).filter((n) => c.territories[n].owner === f);
}

/** The leader travels to a neighbouring land of their people's, leaving any army behind. An army there has them at its head. */
export function moveLeader(c: Campaign, f: number, to: number): boolean {
  if (!leaderReach(c, f).includes(to)) return false;
  const ct = courtOf(c, f)!;
  if (CALLING.waylaid(c, f, ct.at, to)) { ct.moved = true; return true; } // set upon on the road and turned back: the season's travel is spent (courtcall.ts)
  for (const a of armiesOf(c, f)) a.hero = false;
  ct.at = to;
  ct.moved = true;
  delete ct.away;
  flag(c, f, ct);
  return true;
}

/** Keep to the town (an army marching out of the leader's land goes without them), or ride with the army again. */
export function holdCourt(c: Campaign, f: number, on: boolean): boolean {
  const ct = courtOf(c, f);
  if (!ct) return false;
  if (on) ct.holds = true; else delete ct.holds;
  return true;
}

/** The next land on the shortest way from one land to another through a people's own country (-1: no way). */
export function stepToward(c: Campaign, f: number, from: number, to: number): number {
  if (from === to) return -1;
  // Search back from where they are going, so the first land found beside the army is its next step.
  const dist = new Map<number, number>([[to, 0]]);
  for (const queue = [to]; queue.length;) {
    const at = queue.shift()!;
    for (const n of reach(c, at)) if (!dist.has(n) && c.territories[n].owner === f) { dist.set(n, dist.get(at)! + 1); queue.push(n); }
  }
  let best = -1;
  for (const n of reach(c, from)) if (dist.has(n) && c.territories[n].owner === f && (best < 0 || dist.get(n)! < dist.get(best)!)) best = n;
  return best >= 0 && dist.get(best)! < (dist.get(from) ?? Infinity) ? best : -1;
}

/** Armies still on their way to the leader: those called by name, or, where none were named, every army but one holding a town that needs it. */
export const called = (c: Campaign, f: number): Army[] => {
  const ct = courtOf(c, f);
  if (!ct) return [];
  const away = armiesOf(c, f).filter((a) => a.at !== ct.at);
  return ct.called ? away.filter((a) => ct.called!.includes(a.id)) : away.filter((a) => !CALLING.keeps(c, a));
};

/**
 * A called army's next march toward the leader: the land it goes to, and the land it crosses without stopping, if any.
 * It stops only in a land of its people's, and not in one where an army of theirs that is not called stands (it would
 * join it and go no farther): such a land, and a land its people may cross (`CALLING.pass`: an ally's), it goes through
 * to the land beyond in the one march. Null if there is no way.
 */
export function marchToward(c: Campaign, f: number, a: Army, to: number): { to: number; via?: number } | null {
  if (a.at === to) return null;
  const going = new Set(called(c, f).map((x) => x.id));
  const own = (id: number): boolean => c.territories[id]?.owner === f;
  const stops = (id: number): boolean => own(id) && (id === to || !c.armies.some((x) => x.owner === f && x.at === id && x.id !== a.id && !going.has(x.id)));
  const through = (id: number): boolean => (own(id) && !stops(id)) || (!own(id) && CALLING.pass(c, f, id));
  // The marches from a land: to a land beside it, or across one to the land beyond.
  const marches = (from: number): { to: number; via?: number }[] => {
    const out: { to: number; via?: number }[] = [];
    for (const n of reach(c, from)) {
      if (stops(n)) out.push({ to: n });
      else if (through(n)) for (const m of reach(c, n)) if (m !== from && stops(m) && !reach(c, from).includes(m)) out.push({ to: m, via: n });
    }
    return out;
  };
  const first = new Map<number, { to: number; via?: number }>(); // a land, and the first march of the way that reached it
  let edge = [a.at];
  const seen = new Set<number>([a.at]);
  while (edge.length) {
    const next: number[] = [];
    for (const at of edge) for (const m of marches(at)) {
      if (seen.has(m.to)) continue;
      seen.add(m.to);
      first.set(m.to, at === a.at ? m : first.get(at)!);
      if (m.to === to) return first.get(m.to)!;
      next.push(m.to);
    }
    edge = next;
  }
  return null;
}

function march(c: Campaign, f: number): number {
  const ct = courtOf(c, f);
  if (!ct || !ct.rally) return 0;
  let n = 0;
  // Nearest first, so that those behind can follow into the land they leave.
  for (const a of called(c, f)) {
    if (a.moved) continue;
    const step = marchToward(c, f, a, ct.at);
    if (step && HUB.moveArmy(c, a.id, step.to, step.via === undefined ? undefined : { via: step.via }) === 'moved') n++;
  }
  if (!called(c, f).length) {
    delete ct.rally; delete ct.called;
    if (f === 0) c.log.push(`Your armies are gathered at ${c.territories[ct.at].name}.`);
  }
  return n;
}

/**
 * Call the armies to the leader: those named (`ids`), or with none named every army but one holding a town that needs
 * it (courtcall.ts). Each that has not moved this turn marches one land nearer now, through their people's own country
 * (and across an ally's), and goes on doing so each turn until all have come or the call is ended. Returns how many set out.
 */
export function callArmies(c: Campaign, f: number, ids?: readonly number[]): number {
  const ct = courtOf(c, f);
  if (!ct || c.pending || c.demand) return 0;
  // Called by name: those armies and no others, a garrison among them if the leader says so. Otherwise all but the garrisons a town needs.
  if (ids) ct.called = armiesOf(c, f).filter((a) => ids.includes(a.id)).map((a) => a.id); else delete ct.called;
  if (!called(c, f).length) { delete ct.called; return 0; }
  ct.rally = true;
  return march(c, f);
}
/** End the call: the armies stay where they have got to. */
export function endCall(c: Campaign, f: number): void {
  const ct = courtOf(c, f);
  if (ct) { delete ct.rally; delete ct.called; }
}

/** The turn of the year for every court: the leader may travel again, and armies that were called march on. */
export function courtTurn(c: Campaign): void {
  for (const fac of c.factions) {
    const ct = courtOf(c, fac.id);
    if (!ct) continue;
    delete ct.moved;
    march(c, fac.id);
  }
}
