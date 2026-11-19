// Nobles ask things of the leader (docs/DESIGN.md, "Relationships": nobles; the audit, "a noble never asks anything").
//
// Now and then a noble of a nation (a lord, a captain or a matron; not the inner circle, who have their posts) comes
// to the leader with a petition. One is open in a nation at a time; each season with none open, a noble may come
// (PETITION.chance), the one the leader has heard least lately first. What they may ask:
//   - a post: to be made Governor, Warden or Lady of the court, as the leader may give one (nobledeal.ts post);
//   - an estate: lands of the crown's beside their town, paid for in supplies;
//   - a match: that their grown son or daughter wed a grown son or daughter of the leader's house. Both are grown,
//     always: there must be an unwed child of the house of age (dynasty.ts), and the noble's child is of age too;
//   - help for their town: grain and goods sent there, when it is hungry or has lately been struck;
//   - a pardon: for a grown kinsman held for a brawl, a debt or poaching, for whom the noble speaks.
// The leader grants or refuses, from the land's panel of the noble's town (a matter in the town). A grant does what it
// asks and lifts the noble's mood, and leaves a bond on them (nobles.ts `bonds`) that holds where it settles for a time;
// a pardon sits ill with the pious nobles of the town. A refusal sours them, and leaves a bond that holds it lower for a
// year. A petition left unanswered for PETITION.wait seasons lapses, and sours them half as much.
// Every people's nobles petition by the same rules; a computer-led ruler answers as `sensiblePetition` does, which is
// also how the computer answers for the player in the health report's attended course (storypolicy.ts).
// Each is told in the season's report among the court's doings, by name. Nothing is drawn here.
import type { Campaign } from './campaign';
import type { Noble } from './nobles';
import { NOBLES, isAngry, noblesOf, titleOf } from './nobles';
import { DEALS, TITLES, dealBar, dealWith } from './nobledeal';
import { houseOf, ofAge } from './dynasty';
import type { Heir } from './dynasty';
import { canPayFor, payFor } from './prices';
import { needOf } from './larder';
import { stock, SUPPLY_UNITS } from './stores';
import { heed } from './nobletemper';
import { ACTS } from './nobleacts';
import { NAMES_F, NAMES_M } from './data';

export type PetitionKind = 'post' | 'estate' | 'match' | 'help' | 'pardon';
export interface Petition {
  id: number; key: string; name: string; town: number; kind: PetitionKind; since: number;
  /** Who it is for: the noble's grown son or daughter (a match), or their kinsman and what he is held for (a pardon). */
  who?: string; female?: boolean; why?: string;
  /** The child of the leader's house a match asks for. */
  heir?: string;
}
declare module './campaign' {
  interface Faction {
    /** A noble's petition waiting on the ruler (petitions.ts). */
    petition?: Petition; petitionSeq?: number;
  }
}

export const PETITION = {
  /** The chance each season, with none open, that a noble of the nation comes with a petition. */
  chance: 0.15,
  /** Seasons a petition waits before it lapses unanswered. */
  wait: 4,
  /** What each costs in supplies when granted. */
  estate: 3, help: 2,
  /** A grant: the noble's mood at once, and how much higher it settles, for how many seasons (0: for good). */
  grant: {
    estate: { mood: 20, rest: 10, seasons: 8 },
    match: { mood: 30, rest: 15, seasons: 0, jealous: -3 },
    help: { mood: 20, rest: 8, seasons: 4 },
    pardon: { mood: 15, rest: 5, seasons: 4, pious: -5 },
    /** A post is the leader's own dealing (nobledeal.ts), and the noble is glad to have been heard besides. */
    post: { mood: 5 },
  },
  /** A refusal: their mood at once, and how much lower it settles for a year; a lapse half of it. */
  refuse: { mood: -15, rest: -8, seasons: 4 },
};

const KIND_NAMES: Record<PetitionKind, string> = { post: 'a post', estate: 'an estate', match: 'a match for a grown child', help: 'help for their town', pardon: 'a pardon for a kinsman' };
const WHY = ['a brawl at the fair', 'a debt unpaid', 'poaching in the crown\'s woods', 'a quarrel over a boundary'];

function chance(c: Campaign, salt: number): number {
  let h = (Math.imul(c.seed ^ 0x7f4a7c15, 0x9e3779b1) ^ Math.imul(c.turn + 0x2545f491, 0x85ebca6b) ^ Math.imul(salt + 0x6a09e667, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
const clamp = (v: number): number => Math.max(-100, Math.min(100, Math.round(v)));
const their = (n: { female: boolean }): string => (n.female ? 'her' : 'his');
const bond = (c: Campaign, n: Noble, kind: string, rest: number, seasons: number, what?: string): void => {
  (n.bonds ??= []).push({ kind, turn: c.turn, rest, ...(seasons > 0 ? { until: c.turn + seasons } : {}), ...(what ? { what } : {}) });
};
const tell = (c: Campaign, f: number, tid: number, tone: 'good' | 'bad' | 'plain', text: string): void => {
  if (f !== 0) return;
  c.log.push(text);
  (c.intrigueNews ??= []).push({ turn: c.turn, id: -1, kind: 'plot', at: tid, owner: f, tone, text }); // the season's report, among the court's doings
};

/** An unwed grown child of the ruler's house, for a match: of age, never a child. */
const heirFree = (c: Campaign, f: number): Heir | undefined => houseOf(c, f).heirs.find((h) => ofAge(c, h) && !h.wedTo);
/** Is the noble's town in need: hungry, or struck in the last season by a band, plague or famine (as nobletemper.ts reads it)? */
const inNeed = (c: Campaign, n: Noble): boolean => needOf(c, n.town) > 0 || !!c.territories[n.town]?.folk?.hungry || (c.events ?? []).some((e) => e.at === n.town && ['raid', 'carried', 'plague', 'famine'].includes(e.kind) && e.turn >= c.turn - 1);

/** What a noble could ask now. */
function asks(c: Campaign, f: number, n: Noble): PetitionKind[] {
  const out: PetitionKind[] = ['estate'];
  if (!n.title && TITLES[n.rank]) out.push('post');
  if (heirFree(c, f) && !n.wed) out.push('match');
  if (inNeed(c, n)) out.push('help', 'help'); // a town in need asks for that first
  if (n.rank !== 'matron' || chance(c, n.town) < 0.5) out.push('pardon');
  return out;
}

/** A season for one nation's nobles: an open petition waits or lapses; with none open, one may come. */
export function petitionSeason(c: Campaign, f: number): Petition | null {
  const fac = c.factions[f];
  if (!fac?.alive) return null;
  const open = fac.petition;
  if (open) {
    const n = noblesOf(c, f).find((x) => x.key === open.key);
    if (!n) { delete fac.petition; return null; } // they are noble no more, or gone
    if (c.turn - open.since >= PETITION.wait) { refuse(c, f, true); return null; }
    if (fac.isAI) answerAsRuler(c, f);
    return fac.petition ?? null;
  }
  if (chance(c, f * 97 + 11) >= PETITION.chance) return null;
  const nobles = noblesOf(c, f).filter((n) => n.rank !== 'close' && c.territories[n.town]?.owner === f);
  if (!nobles.length) return null;
  const n = [...nobles].sort((a, b) => (a.heeded ?? -99) - (b.heeded ?? -99) || a.key.localeCompare(b.key))[Math.floor(chance(c, f * 31 + 5) * Math.min(3, nobles.length))];
  const kinds = asks(c, f, n), kind = kinds[Math.floor(chance(c, f * 53 + 7) * kinds.length)];
  const p: Petition = { id: (fac.petitionSeq = (fac.petitionSeq ?? 0) + 1), key: n.key, name: n.name, town: n.town, kind, since: c.turn };
  if (kind === 'match') {
    const h = heirFree(c, f)!, female = !h.female, names = female ? NAMES_F : NAMES_M;
    Object.assign(p, { who: names[Math.floor(chance(c, f * 7 + 3) * names.length)], female, heir: h.name });
  } else if (kind === 'pardon') {
    Object.assign(p, { who: NAMES_M[Math.floor(chance(c, f * 13 + 1) * NAMES_M.length)], female: false, why: WHY[Math.floor(chance(c, f * 17 + 2) * WHY.length)] });
  }
  fac.petition = p;
  tell(c, f, n.town, 'plain', `${titleOf(c, n)} comes to you with a petition: ${petitionText(c, f, p)}`);
  if (fac.isAI) answerAsRuler(c, f);
  return p;
}
/** A season for every nation's nobles. */
export function petitionSeasons(c: Campaign): void {
  for (const fac of c.factions) petitionSeason(c, fac.id);
}

/** What the petition asks, in words. */
export function petitionText(c: Campaign, f: number, p: Petition): string {
  const town = c.territories[p.town]?.name ?? 'their town';
  if (p.kind === 'post') return `to be made ${TITLES[noblesOf(c, f).find((n) => n.key === p.key)?.rank ?? 'lord'] ?? 'an officer'}.`;
  if (p.kind === 'estate') return `an estate of the crown's lands beside ${town} (${PETITION.estate} supplies).`;
  if (p.kind === 'match') return `that ${p.female ? 'a grown daughter' : 'a grown son'} of theirs, ${p.who}, wed ${p.heir} of your house.`;
  if (p.kind === 'help') return `grain and goods for ${town}, which is in want (${PETITION.help} supplies).`;
  return `a pardon for ${p.who}, a kinsman held for ${p.why}.`;
}

/** Why the ruler cannot grant the open petition now, or ''. */
export function grantBar(c: Campaign, f: number): string {
  const p = c.factions[f]?.petition;
  if (!p) return 'There is no petition.';
  const n = noblesOf(c, f).find((x) => x.key === p.key);
  if (!n) return 'They are no longer noble.';
  if (p.kind === 'post') return dealBar(c, f, p.key, 'post');
  if (p.kind === 'estate' && !canPayFor(c, f, 'dealing', PETITION.estate)) return `It costs ${PETITION.estate} supplies.`;
  if (p.kind === 'help' && !canPayFor(c, f, 'dealing', PETITION.help)) return `It costs ${PETITION.help} supplies.`;
  if (p.kind === 'match' && !houseOf(c, f).heirs.some((h) => h.name === p.heir && ofAge(c, h) && !h.wedTo)) return `${p.heir} of your house is not free to wed.`;
  return '';
}

/** Grant the open petition. Returns '' when done, or why not. */
export function grant(c: Campaign, f: number): string {
  const bar = grantBar(c, f);
  if (bar) return bar;
  const fac = c.factions[f], p = fac.petition!, n = noblesOf(c, f).find((x) => x.key === p.key)!, who = titleOf(c, n), G = PETITION.grant;
  heed(c, n);
  if (p.kind === 'post') {
    const done = dealWith(c, f, p.key, 'post');
    if (done) return done;
    n.mood = clamp(n.mood + G.post.mood);
  } else if (p.kind === 'estate') {
    if (!payFor(c, f, 'dealing', PETITION.estate, { at: n.town })) return `It costs ${PETITION.estate} supplies.`;
    n.mood = clamp(n.mood + G.estate.mood); bond(c, n, 'estate', G.estate.rest, G.estate.seasons);
    tell(c, f, n.town, 'good', `${who} is granted an estate beside ${c.territories[n.town]?.name ?? 'their town'}.`);
  } else if (p.kind === 'help') {
    if (!payFor(c, f, 'dealing', PETITION.help, { at: n.town })) return `It costs ${PETITION.help} supplies.`;
    stock(c, n.town, PETITION.help * SUPPLY_UNITS);
    n.mood = clamp(n.mood + G.help.mood); bond(c, n, 'help', G.help.rest, G.help.seasons);
    tell(c, f, n.town, 'good', `Grain and goods are sent to ${c.territories[n.town]?.name ?? 'the town'}, as ${who} asked.`);
  } else if (p.kind === 'match') {
    const h = houseOf(c, f).heirs.find((x) => x.name === p.heir && ofAge(c, x) && !x.wedTo)!;
    h.wedTo = { key: n.key, name: `${p.who}, ${p.female ? 'daughter' : 'son'} of ${n.name}` };
    n.mood = clamp(n.mood + G.match.mood); bond(c, n, 'match', G.match.rest, 0, h.name);
    for (const x of noblesOf(c, f)) if (x !== n && x.rank !== 'close') x.mood = clamp(x.mood + G.match.jealous);
    tell(c, f, n.town, 'good', `${h.name} of your house weds ${p.who}, ${p.female ? 'daughter' : 'son'} of ${who}.`);
  } else {
    n.mood = clamp(n.mood + G.pardon.mood); bond(c, n, 'pardon', G.pardon.rest, G.pardon.seasons, p.who);
    for (const x of noblesOf(c, f)) if (x !== n && x.town === n.town && x.leaning === 'pious') x.mood = clamp(x.mood + G.pardon.pious);
    tell(c, f, n.town, 'plain', `${p.who}, kinsman of ${who}, is pardoned for ${p.why}.`);
  }
  delete fac.petition;
  return '';
}

/** Refuse the open petition (or let it lapse, `lapsed`, which sours the noble half as much). */
export function refuse(c: Campaign, f: number, lapsed = false): boolean {
  const fac = c.factions[f], p = fac?.petition;
  if (!p) return false;
  delete fac.petition;
  const n = noblesOf(c, f).find((x) => x.key === p.key);
  if (!n) return false;
  const k = lapsed ? 0.5 : 1, R = PETITION.refuse;
  n.mood = clamp(n.mood + R.mood * k);
  bond(c, n, 'refused', Math.round(R.rest * k), R.seasons, p.kind);
  tell(c, f, n.town, 'bad', lapsed ? `${titleOf(c, n)} waited in vain for an answer to ${their(n)} petition, and has gone home sour.` : `You refuse ${titleOf(c, n)} ${KIND_NAMES[p.kind]}: ${their(n)} mood falls.`);
  return true;
}

/**
 * How a careful ruler answers a petition, with no more than the player would know: help for a town in want, always; a
 * post or an estate if the nation can bear it; a pardon for a noble who is not content; a match only to win back one
 * who is near anger. Otherwise refused. Returns 'grant', 'refuse' or '' (nothing open).
 */
export function sensiblePetition(c: Campaign, f: number): 'grant' | 'refuse' | '' {
  const p = c.factions[f]?.petition;
  if (!p) return '';
  const n = noblesOf(c, f).find((x) => x.key === p.key);
  const want = !!n && (p.kind === 'help' || p.kind === 'post' || p.kind === 'estate' || (p.kind === 'pardon' && n.mood < ACTS.content) || (p.kind === 'match' && (isAngry(n) || n.mood <= NOBLES.angry / 2)));
  if (want && grant(c, f) === '') return 'grant';
  refuse(c, f);
  return 'refuse';
}
/** A computer-led ruler answers its noble's petition the same season it is brought. */
const answerAsRuler = (c: Campaign, f: number): void => { if (c.factions[f]?.isAI) sensiblePetition(c, f); };

/** The open petition of a nation that waits in this town, for the land's panel. */
export const petitionAt = (c: Campaign, f: number, tid: number): Petition | undefined => (c.factions[f]?.petition?.town === tid ? c.factions[f].petition : undefined);
/** Seasons left before it lapses. */
export const petitionLeft = (c: Campaign, p: Petition): number => Math.max(0, PETITION.wait - (c.turn - p.since));
export { DEALS };
