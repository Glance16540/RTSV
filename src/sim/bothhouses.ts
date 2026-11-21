// A claimant of both houses comes to the throne (docs/DESIGN.md, "Relationships"; docs/systems-board, "Diplomacy": a
// royal marriage's child of both houses had a claim on record and in the chronicle, but no succession asked for it).
//
// A royal marriage (royalmarriage.ts) may bring a child of both houses, a record only until grown. When a people's
// line fails (its leader is gone and no heir of their house is of age), that grown child (eighteen, as every heir:
// dynasty.ts GROWN) is the next claimant, before any captain or a stranger. A child never rules in person; the
// risings proclaimed in a child's name (claimants.ts, claimantrising.ts) are another matter and stand as they were.
//
// What follows, when the claimant is of a rival's house as well:
//   - Taken up: the houses are joined in the one who rules. Not the two peoples: their lands stay their own. The peace
//     of the marriage is renewed (SUCCESSION.peace, pacts.ts) and, where the player is one of the two, a truce with it.
//   - Passed over (a captain raised, a stranger hired, one raised on the field instead): the peace is broken, and
//     where it is the player's throne the other house presses the claim, a war of succession: for SUCCESSION.war seasons
//     it marches on the player at worse odds, as a people refused does (campaign.ts `angry`).
// Rivals settle their own succession by the same order (succession.ts chooseSuccessor), so a rival never passes over a
// claimant who could rule. A rival whose throne a child of the player's house takes is at peace with the player for it.
import type { Campaign } from './campaign';
import type { Pact } from './pacts';
import { breakPacts } from './pacts';
import { CHILD_SEASONS } from './ageing';
import { leaderAsMade } from './powers';

/** Who rules a people, by name (dynasty.ts rulerName, passed in: this module is called from there). */
type Ruler = (f: number) => string;
/** Seasons from birth until a child of both houses is grown: as for every heir (dynasty.ts GROWN). */
const GROWN = CHILD_SEASONS;

declare module './pacts' {
  interface Pact { /** A marriage's child of both houses who came to rule a people, and which (bothhouses.ts). */ ruled?: number; /** Passed over for that throne. */ passed?: number }
}
declare module './campaign' {
  interface Campaign { /** Wars of succession: a house pressing a claim on the player's throne by arms (bothhouses.ts). */ successionWars?: { by: number; against: number; until: number; claimant: string }[] }
}

export const SUCCESSION = {
  /** Seasons a house presses a claim it was refused. */
  war: 8,
  /** Lost goodwill with the house whose claimant is passed over. */
  favor: 2,
  /** Seasons of peace renewed when the houses are joined: as a marriage's own (royalmarriage.ts SUCCESSION.peace). */
  peace: 24,
};

/** A grown child of both houses with a claim on this people's throne, eldest first; one who rules already, or was passed over for it, has none. */
export function bloodClaim(c: Campaign, f: number): { pact: Pact; name: string; female: boolean; other: number } | undefined {
  const all = (c.pacts ?? []).filter((p) => p.kind === 'marriage' && (p.a === f || p.b === f) && p.child && c.turn - p.child.born >= GROWN && p.ruled === undefined && p.passed !== f && c.factions[p.a === f ? p.b : p.a]?.alive);
  const p = all.sort((x, y) => x.child!.born - y.child!.born)[0];
  return p ? { pact: p, name: p.child!.name, female: p.child!.female, other: p.a === f ? p.b : p.a } : undefined;
}

/** Has this people's line failed: no heir of their house of age? */
export const lineFails = (c: Campaign, f: number): boolean => !(c.factions[f]?.house?.heirs ?? []).some((h) => c.turn - h.born >= GROWN);

/** Words for the succession: who the claimant is and what taking them up, or passing them over, means. */
export function bloodWhat(c: Campaign, f: number, rulerName: Ruler): string {
  const b = bloodClaim(c, f);
  if (!b) return '';
  const them = c.factions[b.other], years = Math.floor((c.turn - b.pact.child!.born) / 4);
  return `Child of ${f === 0 ? 'your house' : `the house of ${rulerName(f)}`} and the house of ${rulerName(b.other)} of the ${them.name}, ${years} years old. Rules as one of both houses: the two peoples are at peace for ${SUCCESSION.peace} seasons.` +
    (f === 0 ? ` Pass ${b.female ? 'her' : 'him'} over, and the ${them.name} will press the claim by war.` : '');
}

/** The claimant of both houses takes up the rule of people `f`, whose line has failed. Returns false if there is none. */
export function bloodSucceeds(c: Campaign, f: number, rulerName: Ruler): boolean {
  const b = bloodClaim(c, f), fac = c.factions[f];
  if (!b || !fac) return false;
  const old = leaderAsMade(fac.hero, fac.civ, fac.isAI);
  fac.hero = { ...old, name: b.name, female: b.female, look: { ...old.look, beard: b.female ? false : old.look?.beard } };
  fac.heroRank = Math.floor((fac.heroRank ?? 0) / 2);
  fac.heroAlive = true;
  b.pact.ruled = f;
  // The houses are joined in the one who rules: the marriage's peace is renewed, and a truce where the player is one of them.
  b.pact.until = Math.max(b.pact.until, c.turn + SUCCESSION.peace);
  const rival = f === 0 ? b.other : b.other === 0 ? f : -1;
  if (rival > 0) c.truces = c.truces.filter((t) => t.with !== rival).concat({ with: rival, until: b.pact.until });
  c.successionWars = (c.successionWars ?? []).filter((w) => !(w.against === f && w.by === b.other));
  const text = f === 0
    ? `${b.name}, of your house and the house of ${rulerName(b.other)}, takes up the rule of your people. The ${c.factions[b.other].name} are at peace with you for it.`
    : `${b.name}, of the houses of ${rulerName(b.other)} and of the ${fac.name}, rules the ${fac.name} now. The two peoples are at peace.`;
  (c.chronicle ??= []).push({ turn: c.turn, text });
  c.log.push(text);
  return true;
}

/**
 * Someone else takes up the rule of people `f` (a captain, a stranger, one raised on the field) while a claimant of both
 * houses could have (the line having failed): the peace between the houses is broken, and a claim on the player's throne is pressed by war.
 * Called by every other way to the throne; does nothing where there was no such claimant.
 */
export function passedOver(c: Campaign, f: number, rulerName: Ruler): void {
  const b = lineFails(c, f) ? bloodClaim(c, f) : undefined; // with an heir of age set aside instead, it was never their throne to lose
  if (!b) return;
  b.pact.passed = f;
  breakPacts(c, f, b.other);
  const them = c.factions[b.other];
  if (f === 0) {
    c.truces = c.truces.filter((t) => t.with !== b.other);
    them.favor = Math.max(-3, (them.favor ?? 0) - SUCCESSION.favor);
    (c.successionWars ??= []).push({ by: b.other, against: 0, until: c.turn + SUCCESSION.war, claimant: b.name });
  }
  const text = f === 0
    ? `${b.name}, of your house and the house of ${rulerName(b.other)}, is passed over. The ${them.name} take up the claim, and will press it by war.`
    : `The ${c.factions[f].name} pass over ${b.name}, of the houses of ${rulerName(f)} and ${rulerName(b.other)}. The peace between the ${c.factions[f].name} and ${b.other === 0 ? 'your people' : `the ${them.name}`} is ended.`;
  (c.chronicle ??= []).push({ turn: c.turn, text });
  c.log.push(text);
}

/** At the start of a season: a house pressing a claim on the player's throne marches on it at worse odds. */
export function pressClaims(c: Campaign): void {
  c.successionWars = (c.successionWars ?? []).filter((w) => w.until >= c.turn && c.factions[w.by]?.alive);
  for (const w of c.successionWars) if (w.against === 0) c.factions[w.by].angry = true;
}
