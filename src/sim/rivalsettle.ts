// A rival sends people by road (docs/CLOSING.md, Stores: "the computer sends food and goods by convoy, never people").
// Families move of their own accord in every nation (migration.ts), and a rival's crowded towns send settlers to empty
// land (migration.ts foundOf); what a rival could not do is what the player does by hand: send settlers from a town with
// people to spare to a town of its own that has too few (migration.ts `settle`, the player's own rule, bar and all).
//
// Each season, now and then (RIVAL_SETTLE.chance), a rival led by the computer looks for its town in most need of people:
// fewer than MIGRATE.keep grown, or no couple, and nobody already on the road to it; and sends MIGRATE.settlers couples
// and their children there, from its town with the most grown people that can spare them and has a road to it. At most
// one a season a people. The player's towns are the player's to settle.
import type { Campaign } from './campaign';
import { MIGRATE, settle, settleBar } from './migration';
import { folkOf, grown } from './township';

export const RIVAL_SETTLE = {
  /** The chance a season that a rival with a town in need sends settlers to it. */
  chance: 0.5,
};

const roll = (c: Campaign, f: number): number => {
  let h = Math.imul((c.seed | 0) ^ Math.imul(c.turn + 29, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(f * 977 + 113, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};
/** People already on the road to a town. */
const coming = (c: Campaign, tid: number): number => (c.convoys ?? []).filter((x) => x.to === tid).reduce((n, x) => n + x.cargo.men.length + x.cargo.women.length, 0);

/** A rival's town in need of people, the neediest first: too few grown, or no couple, and nobody on the way. */
export function townsInNeed(c: Campaign, f: number): number[] {
  return c.territories
    .filter((t) => t.owner === f && !t.horde && !t.rim)
    .filter((t) => { const k = folkOf(c, t.id); return (grown(k) < MIGRATE.keep || k.men < 1 || k.women < 1) && coming(c, t.id) === 0; })
    .sort((a, b) => grown(folkOf(c, a.id)) - grown(folkOf(c, b.id)) || a.id - b.id)
    .map((t) => t.id);
}

/** One rival's season: settlers sent to its town in most need, if one of its towns can spare them. Returns [from, to] or null. */
export function rivalSettles(c: Campaign, f: number): [number, number] | null {
  const fac = c.factions[f];
  if (!fac?.alive || !fac.isAI || f === 0 || roll(c, f) >= RIVAL_SETTLE.chance) return null;
  const givers = c.territories.filter((t) => t.owner === f && !t.horde).sort((a, b) => grown(folkOf(c, b.id)) - grown(folkOf(c, a.id)) || a.id - b.id);
  for (const to of townsInNeed(c, f)) {
    const from = givers.find((t) => t.id !== to && settleBar(c, f, t.id, to) === '');
    if (from && settle(c, f, from.id, to) === '') return [from.id, to];
  }
  return null;
}

/** A season of it, for every rival. Returns the settlements sent. */
export function rivalSettleSeason(c: Campaign): [number, number][] {
  const out: [number, number][] = [];
  for (const x of c.factions) { const s = rivalSettles(c, x.id); if (s) out.push(s); }
  return out;
}
