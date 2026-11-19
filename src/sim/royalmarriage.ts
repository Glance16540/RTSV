// Royal marriages between houses (docs/DESIGN.md, "Relationships"; the audit, "diplomacy has no royal marriages").
//
// A ruler may offer a grown, unwed son or daughter of their house to another people's house, for a grown, unwed child
// of the other sex there. Both are of age, always (dynasty.ts ofAge): no child is ever offered or promised. The other
// ruler accepts or refuses. Accepted:
//   - the two are wed (each `Heir.wedTo` the other, by house), and stay on their own house's record;
//   - the two peoples are bound in peace for MARRY.seasons (pacts.ts): neither marches on the other, two rivals as much
//     as the player and a rival (campaignbase.ts atTruce reads it); for the player it is a truce as well, from which an
//     alliance may be offered; and the other people thinks the better of the player (goodwill);
//   - in time a child of both houses may be born to them, a record only (a name, the turn of birth), never shown as a
//     person; once grown it is told that the child has a claim on both thrones (`claimsOn`), and the chronicle keeps it.
// A people that marches on a house it is bound to breaks the pact (campaign.ts): the marriage stands, its peace is over.
// Rival rulers offer marriages to one another and to the player by the same rules, now and then (MARRY.chance a season
// for a ruler with a child of age to offer); an offer to the player waits two seasons for an answer (`c.pactOffer`).
// A ruler's readiness to accept is their temper's openness to peace (HUB.peaceOf), more toward a stronger people and with
// goodwill. Chances here are a run of their own. Nothing suggestive is told: who weds whom, and that is all.
import type { Campaign } from './campaign';
import { HUB } from './campaignbase';
import { houseOf, ofAge, rulerName } from './dynasty';
import type { Heir } from './dynasty';
import { NAMES_F, NAMES_M } from './data';
import { CHILD_SEASONS } from './ageing';
import { pactOf, pactsSeason, wedPeace } from './pacts';
import type { Pact } from './pacts';

export interface PactOffer { kind: 'marriage' | 'trade'; from: number; turn: number; /** A marriage: the heir of `from` offered, and the player's heir asked for. */ wed?: [string, string] }
declare module './campaign' {
  interface Campaign { /** A pact a rival ruler offers the player, waiting on an answer (royalmarriage.ts, tradedeal.ts). */ pactOffer?: PactOffer }
}

export const MARRY = {
  /** The chance each season that a computer-led ruler with a child of age offers a match. */
  chance: 0.04,
  /** Seasons the two peoples are bound in peace. */
  seasons: 24,
  /** How much readier to accept, beyond the ruler's openness to peace, toward a stronger people; and for each mark of goodwill. */
  stronger: 0.15, favor: 0.1,
  /** From this many seasons after the wedding, the chance each season of a child of both houses. */
  childAfter: 4, childChance: 0.25,
  /** Seasons an offer to the player waits. */
  waits: 2,
};

function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x3c6ef372, 0x9e3779b1) ^ Math.imul(c.turn + 0x5be0cd19, 0x85ebca6b) ^ Math.imul(salt + 0x1f83d9ab, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const strength = (c: Campaign, f: number): number => c.armies.filter((a) => a.owner === f).reduce((n, a) => n + Object.values(a.units).reduce((s, v) => s + v, 0), 0);
const name = (c: Campaign, f: number): string => (f === 0 ? 'your people' : `the ${c.factions[f]?.name ?? 'others'}`);

/** An unwed grown child of a people's house, of the given sex if asked. Never a child. */
export const freeHeir = (c: Campaign, f: number, female?: boolean): Heir | undefined => houseOf(c, f).heirs.find((h) => ofAge(c, h) && !h.wedTo && (female === undefined || h.female === female));
/** The pair a match between two houses would wed: a's child and b's, of the other sex, both grown and unwed. */
export function matchOf(c: Campaign, a: number, b: number): [Heir, Heir] | null {
  for (const h of houseOf(c, a).heirs) {
    if (!ofAge(c, h) || h.wedTo) continue;
    const g = freeHeir(c, b, !h.female);
    if (g) return [h, g];
  }
  return null;
}

/** Why `a` cannot offer `b` a match now, or ''. */
export function marryBar(c: Campaign, a: number, b: number): string {
  const fa = c.factions[a], fb = c.factions[b];
  if (!fa?.alive || !fb?.alive || a === b) return 'There is nobody to wed.';
  if (wedPeace(c, a, b)) return 'Your houses are bound already.';
  if (!freeHeir(c, a)) return 'Your house has no grown son or daughter unwed.';
  if (!matchOf(c, a, b)) return `${rulerName(c, b)}'s house has nobody grown and unwed to match.`;
  return '';
}

/** Would `b`'s ruler accept a match offered by `a`? By their temper, the strength of `a`, and goodwill toward the player. */
function accepts(c: Campaign, a: number, b: number): boolean {
  const fb = c.factions[b];
  const willing = HUB.peaceOf(c, b) + (strength(c, a) > strength(c, b) ? MARRY.stronger : 0) + (a === 0 ? MARRY.favor * (fb.favor ?? 0) : 0) - (a === 0 && c.honor < 0 ? 1 : 0);
  return chance(c, a * 71 + b * 13 + 1) < willing;
}

/** Two houses are joined: their children wed, and the peoples are bound in peace. */
function wed(c: Campaign, a: number, b: number, ha: Heir, hb: Heir): Pact {
  ha.wedTo = { key: `house:${b}`, name: `${hb.name} of the house of ${rulerName(c, b)}` };
  hb.wedTo = { key: `house:${a}`, name: `${ha.name} of the house of ${rulerName(c, a)}` };
  const p: Pact = { kind: 'marriage', a, b, since: c.turn, until: c.turn + MARRY.seasons, wed: [ha.name, hb.name] };
  (c.pacts ??= []).push(p);
  const other = a === 0 ? b : b === 0 ? a : -1;
  if (other > 0) {
    c.truces = c.truces.filter((t) => t.with !== other).concat({ with: other, until: p.until }); // a truce for the player, from which an alliance may be offered
    c.factions[other].favor = Math.min(3, (c.factions[other].favor ?? 0) + 1);
  }
  const text = `${ha.name} of ${name(c, a)} weds ${hb.name} of ${name(c, b)}. The two peoples are at peace for it.`;
  if (a === 0 || b === 0) { c.log.push(text); (c.chronicle ??= []).push({ turn: c.turn, text }); }
  return p;
}

/** The player offers a rival ruler a match. Returns '' when they accept, or why not. */
export function offerMarriage(c: Campaign, b: number): string {
  const bar = marryBar(c, 0, b);
  if (bar) return bar;
  const fb = c.factions[b];
  if (fb.refused === c.turn) return 'They have given their answer for this turn.';
  if (!accepts(c, 0, b)) { fb.refused = c.turn; c.log.push(`${rulerName(c, b)} will not match their house with yours.`); return 'They refuse.'; }
  const [ha, hb] = matchOf(c, 0, b)!;
  wed(c, 0, b, ha, hb);
  return '';
}

/** The player answers a rival's offer of a match. */
export function answerMarriage(c: Campaign, accept: boolean): boolean {
  const o = c.pactOffer;
  if (!o || o.kind !== 'marriage') return false;
  delete c.pactOffer;
  const ha = houseOf(c, o.from).heirs.find((h) => h.name === o.wed![0] && ofAge(c, h) && !h.wedTo), hb = houseOf(c, 0).heirs.find((h) => h.name === o.wed![1] && ofAge(c, h) && !h.wedTo);
  if (!accept || !ha || !hb || !c.factions[o.from]?.alive) { if (!accept) c.log.push(`You decline ${rulerName(c, o.from)}'s offer of a match.`); return false; }
  wed(c, o.from, 0, ha, hb);
  return true;
}

/** A season of royal matches: rulers with a child of age may offer one; children of both houses are born and grow. */
export function royalSeason(c: Campaign): void {
  pactsSeason(c);
  if (c.pactOffer && c.turn - c.pactOffer.turn >= MARRY.waits) delete c.pactOffer; // unanswered: the offer lapses
  for (const f of c.factions) {
    if (!f.alive || !f.isAI || !freeHeir(c, f.id) || chance(c, f.id * 31 + 7) >= MARRY.chance) continue;
    const others = c.factions.filter((g) => g.alive && g.id !== f.id && !wedPeace(c, f.id, g.id) && matchOf(c, f.id, g.id));
    if (!others.length) continue;
    const g = others[Math.floor(chance(c, f.id * 17 + 3) * others.length)];
    const [ha, hb] = matchOf(c, f.id, g.id)!;
    if (g.id === 0) { if (!c.pactOffer) { c.pactOffer = { kind: 'marriage', from: f.id, turn: c.turn, wed: [ha.name, hb.name] }; c.log.push(`${rulerName(c, f.id)} offers ${ha.name} of their house in marriage to ${hb.name} of yours. The two peoples would be at peace. Answer on one of their lands.`); } continue; }
    if (accepts(c, f.id, g.id)) wed(c, f.id, g.id, ha, hb);
  }
  // A child of both houses, a record only; told once grown, with the claim it has.
  for (const p of c.pacts ?? []) {
    if (p.kind !== 'marriage') continue;
    if (!p.child && c.turn - p.since >= MARRY.childAfter && chance(c, p.a * 101 + p.b * 7 + p.since) < MARRY.childChance) {
      const female = chance(c, p.since * 3 + p.a) < 0.5, names = female ? NAMES_F : NAMES_M;
      p.child = { name: names[Math.floor(chance(c, p.since * 5 + p.b) * names.length)], female, born: c.turn };
    }
    if (p.child && !p.child.told && c.turn - p.child.born >= CHILD_SEASONS) {
      p.child.told = true;
      if (p.a === 0 || p.b === 0) (c.chronicle ??= []).push({ turn: c.turn, text: `${p.child.name}, child of the houses of ${rulerName(c, p.a)} and ${rulerName(c, p.b)}, is grown, and has a claim on both thrones.` });
    }
  }
}

/** The grown children of royal matches who have a claim on this people's throne. */
export function claimsOn(c: Campaign, f: number): { name: string; female: boolean; other: number }[] {
  return (c.pacts ?? []).filter((p) => p.kind === 'marriage' && (p.a === f || p.b === f) && p.child && c.turn - p.child.born >= CHILD_SEASONS)
    .map((p) => ({ name: p.child!.name, female: p.child!.female, other: p.a === f ? p.b : p.a }));
}
export { pactOf };
