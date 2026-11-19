// Trade deals between peoples (docs/DESIGN.md, "Relationships"; the audit, "diplomacy has no trade deals").
//
// Two peoples at peace (a truce, an alliance or a royal marriage: campaignbase.ts atTruce) may open their markets to each
// other's caravans for a term. While the deal holds, a market town may take a town of the other people as its partner
// (caravans.ts partnerOf, pacts.ts marketsOpen), and its caravan brings home the more gold for trading abroad. Without one,
// a market town trades only with its own people's towns. On signing, each side's chief town has TRADE.gold of gold.
// A deal runs TRADE.seasons, or ends when the peace between them does (one marches on the other: pacts.ts breakPacts).
// Rival rulers offer deals to one another and to the player by the same rules, now and then (TRADE.chance a season, to a
// people at peace with them); the player offers from a rival's land and answers an offer in two seasons
// (`c.pactOffer`, royalmarriage.ts). A ruler accepts by their openness to peace (HUB.peaceOf), more where there is goodwill.
import type { Campaign } from './campaign';
import { HUB, atTruce } from './campaignbase';
import { rulerName } from './dynasty';
import { folkOf } from './township';
import { pactOf } from './pacts';
import type { Pact } from './pacts';
import { MARRY } from './royalmarriage';

export const TRADE = {
  /** The chance each season that a computer-led ruler offers a deal to a people at peace with it. */
  chance: 0.08,
  /** Seasons a deal runs, and the gold each side's chief town has on signing. */
  seasons: 16, gold: 60,
  /** Readiness to accept, beyond the ruler's openness to peace, and for each mark of goodwill. */
  base: 0.3, favor: 0.1,
};

function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x510e527f, 0x9e3779b1) ^ Math.imul(c.turn + 0x9b05688c, 0x85ebca6b) ^ Math.imul(salt + 0x5be0cd19, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const name = (c: Campaign, f: number): string => (f === 0 ? 'your people' : `the ${c.factions[f]?.name ?? 'others'}`);
/** A people's chief town: its capital, else its largest. */
const chiefOf = (c: Campaign, f: number): number | undefined => (c.territories.find((t) => t.capital === f && t.owner === f) ?? c.territories.filter((t) => t.owner === f && !t.horde).sort((a, b) => (b.folk?.men ?? 0) - (a.folk?.men ?? 0))[0])?.id;

/** Why `a` cannot offer `b` a trade deal now, or ''. */
export function tradeBar(c: Campaign, a: number, b: number): string {
  if (a === b || !c.factions[a]?.alive || !c.factions[b]?.alive) return 'There is nobody to trade with.';
  if (!atTruce(c, a, b)) return 'Only peoples at peace trade: a truce first.';
  if (pactOf(c, 'trade', a, b)) return 'Your markets are open to each other already.';
  return '';
}
const accepts = (c: Campaign, a: number, b: number): boolean => chance(c, a * 53 + b * 11 + 2) < TRADE.base + HUB.peaceOf(c, b) + (a === 0 ? TRADE.favor * (c.factions[b].favor ?? 0) : 0);

/** Two peoples open their markets to each other. */
function sign(c: Campaign, a: number, b: number): Pact {
  const p: Pact = { kind: 'trade', a, b, since: c.turn, until: c.turn + TRADE.seasons };
  (c.pacts ??= []).push(p);
  for (const f of [a, b]) { const tid = chiefOf(c, f); if (tid !== undefined) folkOf(c, tid).stores.gold += TRADE.gold; }
  if (a === 0 || b === 0) c.log.push(`A trade deal with ${name(c, a === 0 ? b : a)}: your markets are open to each other's caravans until turn ${p.until}, and ${TRADE.gold} gold comes to your chief town for it.`);
  return p;
}

/** The player offers a rival a trade deal. Returns '' when they accept, or why not. */
export function offerTrade(c: Campaign, b: number): string {
  const bar = tradeBar(c, 0, b);
  if (bar) return bar;
  if (c.factions[b].refused === c.turn) return 'They have given their answer for this turn.';
  if (!accepts(c, 0, b)) { c.factions[b].refused = c.turn; c.log.push(`${rulerName(c, b)} will not open their markets to you.`); return 'They refuse.'; }
  sign(c, 0, b);
  return '';
}

/** The player answers a rival's offer of a trade deal. */
export function answerTrade(c: Campaign, accept: boolean): boolean {
  const o = c.pactOffer;
  if (!o || o.kind !== 'trade') return false;
  delete c.pactOffer;
  if (!accept || tradeBar(c, o.from, 0)) { if (!accept) c.log.push(`You decline ${rulerName(c, o.from)}'s offer of trade.`); return false; }
  sign(c, o.from, 0);
  return true;
}

/** A season of trade: computer-led rulers may offer a deal to a people at peace with them. */
export function tradeSeason(c: Campaign): void {
  for (const f of c.factions) {
    if (!f.alive || !f.isAI || chance(c, f.id * 29 + 5) >= TRADE.chance) continue;
    const others = c.factions.filter((g) => g.alive && g.id !== f.id && !tradeBar(c, f.id, g.id));
    if (!others.length) continue;
    const g = others[Math.floor(chance(c, f.id * 19 + 9) * others.length)];
    if (g.id === 0) { if (!c.pactOffer) { c.pactOffer = { kind: 'trade', from: f.id, turn: c.turn }; c.log.push(`${rulerName(c, f.id)} offers a trade deal: your markets open to each other's caravans for ${TRADE.seasons} seasons, and gold to each. Answer on one of their lands.`); } continue; }
    if (accepts(c, f.id, g.id)) sign(c, f.id, g.id);
  }
}
export const OFFER_WAITS = MARRY.waits;
