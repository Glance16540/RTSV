/**
 * Unrest is a town's own matter (docs/DESIGN.md, "People persist"; the gathering session's word, 16 November 2026).
 * It used to be one draw for the whole world: three seasons in ten some ungarrisoned town, any town, went into
 * unrest, and rose two seasons later unless an army or the leader was there. So a world of weak peoples had as
 * many risings as a world of strong ones, and how a town was kept counted for nothing.
 *
 * Now each town has its own chance each season, weighed by its own state as a taken town's resentment is
 * (conquered.ts): hunger, a church or a tavern, how long its people have been held by whoever holds them, the
 * mood of its nobles, and an angry noble most of all. A well-kept town seldom stirs whoever rules it. What happens
 * once a town is in unrest is as it was (campaign.ts): an army there, the leader, the leader's right hand or a
 * steadfast people keep order, and otherwise it rises.
 *
 * A town taken by force is not weighed here until it has settled and five years have passed: until then its
 * resentment is its own account (the old draw left out every town ever taken, for good). Capitals do
 * not stir, nor a town with its people's army or leader in it, nor one already troubled by something else.
 */
import type { Campaign } from './campaign';
import { armyAt, faithOf } from './campaign';
import { leaderAt } from './court';
import { angryAt, noblesAt } from './nobles';
import { folkOf, headcount } from './township';

declare module './campaign' {
  interface Campaign { /** Who has held each land, and since when (unrest.ts). */ heldSince?: Record<string, { owner: number; since: number }> }
}

export const UNREST = {
  /** A town's chance of unrest in a season, before its own state is weighed. */
  base: 0.08,
  /** Hungry, it is this many times as likely. */
  hungry: 2.5,
  /** With a church, Farmland, a tavern; and under a pious people. */
  church: 0.6, farm: 0.85, tavern: 1.3, pious: 0.8,
  /** Newly held it is `fresh` times as likely, easing over `settle` seasons to `settled` times. */
  fresh: 1.6, settled: 0.6, settle: 40,
  /** With an angry noble; and what the mood of its nobles is worth at its best and worst (a content lord, a sour one). */
  angry: 2, mood: 0.3,
  /** Never more than this in a season, whatever is wrong. */
  most: 0.25,
  /** Seasons it has before it rises (campaign.ts's UNREST_TURNS). */
  turns: 2,
  /** Seasons after it was taken by force in which a town's troubles are its resentment's and not weighed here, settled or not: five years. */
  taken: 20,
  /** No unrest before this season. */
  from: 3,
};
const hash = (a: number, b: number): number => { let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

/** Write down who holds each land and since when: a land that has changed hands begins again. */
export function noteHolders(c: Campaign): void {
  const held = (c.heldSince ??= {});
  for (const t of c.territories) {
    const was = held[t.id];
    if (!was || was.owner !== t.owner) held[t.id] = { owner: t.owner, since: was ? c.turn : 0 }; // the first time it is looked at, it is taken as long held
  }
}
/** Seasons a land has been held by whoever holds it. */
export const heldFor = (c: Campaign, tid: number): number => { const h = c.heldSince?.[tid]; return h && h.owner === c.territories[tid]?.owner ? Math.max(0, c.turn - h.since) : UNREST.settle; };
/** Could unrest begin in this town at all? `busy`: lands already troubled this season. */
export function mayStir(c: Campaign, tid: number, busy?: ReadonlySet<number>): boolean {
  const t = c.territories[tid];
  if (!t || t.owner < 0 || t.horde || t.capital >= 0 || busy?.has(tid)) return false;
  if (t.yoke && (!t.yoke.settled || c.turn - t.yoke.since < UNREST.taken)) return false; // resentment's matter (conquered.ts), and for five years after it was taken
  const a = armyAt(c, tid);
  if ((a && a.owner === t.owner) || leaderAt(c, t.owner, tid)) return false;
  return headcount(folkOf(c, tid)) > 0; // nobody there, nobody to rise
}
/** What weighs on a town, each as the factor it puts on its chance: for the chance, and for whoever would show why. */
export function unrestWeights(c: Campaign, tid: number): { hungry: number; church: number; farm: number; tavern: number; pious: number; held: number; nobles: number } {
  const t = c.territories[tid], f = folkOf(c, tid);
  const fresh = Math.max(0, 1 - heldFor(c, tid) / UNREST.settle);
  const nobles = noblesAt(c, tid);
  const mood = nobles.length ? nobles.reduce((n, x) => n + x.mood, 0) / nobles.length : 0;
  return {
    hungry: (f.hungry ?? 0) > 0 ? UNREST.hungry : 1,
    church: t.buildings.includes('church') ? UNREST.church : 1,
    farm: t.buildings.includes('farm') ? UNREST.farm : 1,
    tavern: t.buildings.includes('tavern') ? UNREST.tavern : 1,
    pious: faithOf(c, t.owner).defence > 1 ? UNREST.pious : 1,
    held: UNREST.settled + (UNREST.fresh - UNREST.settled) * fresh,
    nobles: angryAt(c, tid) ? UNREST.angry : 1 - UNREST.mood * Math.max(-1, Math.min(1, mood / 100)),
  };
}
/** A town's chance of unrest this season, by its own state; nothing where unrest cannot begin. */
export function unrestChance(c: Campaign, tid: number, busy?: ReadonlySet<number>): number {
  if (!mayStir(c, tid, busy)) return 0;
  if (faithOf(c, c.territories[tid].owner).steadfast) return 0; // a steadfast people's towns keep faith
  const w = unrestWeights(c, tid);
  return Math.min(UNREST.most, UNREST.base * w.hungry * w.church * w.farm * w.tavern * w.pious * w.held * w.nobles);
}
/**
 * A season of it: every town is asked by its own chance. Returns the towns where unrest has begun, and marks it
 * on the map (an event that comes to a head in `UNREST.turns` seasons, campaign.ts). `busy` is added to.
 */
export function unrestSeason(c: Campaign, busy: Set<number> = new Set()): number[] {
  noteHolders(c);
  const out: number[] = [];
  if (c.turn < UNREST.from) return out;
  for (const t of c.territories) {
    const p = unrestChance(c, t.id, busy);
    if (p <= 0 || hash(c.seed * 59 + t.id * 211, c.turn * 83 + 5) >= p) continue;
    (c.events ??= []).push({ kind: 'unrest', at: t.id, turn: c.turn, until: c.turn + UNREST.turns - 1 });
    busy.add(t.id);
    out.push(t.id);
  }
  return out;
}
/** Why a town is restless or quiet, in words: the things that weigh most, for its panel. */
export function unrestText(c: Campaign, tid: number): string {
  const p = unrestChance(c, tid);
  if (p <= 0) return '';
  const w = unrestWeights(c, tid);
  const worse = [w.hungry > 1 ? 'it is hungry' : '', w.nobles >= UNREST.angry ? 'a noble there is angry' : w.nobles > 1.1 ? 'its nobles are sour' : '', w.held > 1.1 ? 'it is newly held' : '', w.tavern > 1 ? 'it has a tavern' : ''].filter(Boolean);
  const better = [w.church < 1 ? 'a church' : '', w.farm < 1 ? 'farmland' : '', w.nobles < 0.9 ? 'content nobles' : '', w.held < 0.75 ? 'long keeping' : ''].filter(Boolean);
  return `${Math.round(p * 100)}% chance of unrest this season with no army or leader in it${worse.length ? `: ${worse.join(', ')}` : ''}${better.length ? `${worse.length ? '; steadied by' : ': steadied by'} ${better.join(', ')}` : ''}.`;
}
