// A story of the leader's house, on the field of a visit to the town where the court is kept (docs/DESIGN.md, "Stories
// inside the story": the court stories had nothing inside a visit). The map side (courtvisit.ts) hands the visit the
// player's story of the house; here, in the town itself:
//   - a rival king: his envoy waits at the hall by name. Once the demand is made the leader may give the answer there
//     (defy him, buy him off, send the spouse over the border), as on the map;
//   - a suitor: he waits at the hall by name. The leader may ask the daughter what she wants and give the answer there;
//   - a plot: the great who are spoken of are in the town, each shown as one of its grown people by name and title. A
//     soldier set to keep watch on one long enough (FIELD_COURT.watch; half as long where informers are kept) may show
//     an innocent to be true. The plotter is never shown true, and nothing on the field says which it is.
// What came of it is read back as the player leaves (`courtOut`) and written to the story on the map (courtvisit.ts),
// which believes none of it unchecked. Nobody is struck, held or killed here: a judgement is the map's, and so is
// everything that follows an answer. Children are no units on the field (nursery.ts) and are never in this: the
// daughter asked for is a grown woman of the house, named; she comes to the hall as a figure once asked (hallguests.ts). It reads the game and writes only these marks:
// a villager shown as one of the great keeps their own name and house on the town's record.
import type { Game, Unit } from './game';

/** The answer's words in a sentence: its first letter lowered, the names in it as they are (PLAYTEST 5.5). */
const lowerFirst = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);

/** One of the great spoken of in a plot, as the map names them (courtstory.ts). */
export interface CourtNoble { name: string; title: string; female: boolean }
/** An answer the leader may give at the hall, as the map offers it (courtstory.ts `courtChoices`). */
export interface CourtAnswer { id: string; label: string; bar?: string }
/** A story of the house as it comes into the field. `culprit` and `willing` are not for showing. */
export interface FieldCourt {
  id: number; kind: 'rival' | 'suitor' | 'plot';
  /** Who waits at the hall, and from whom: "the envoy of Temur of the Mongols", "Batu of the house of Temur". */
  guest?: string;
  /** What the guest has come about, in a line. */
  errand?: string;
  /** The guest's people, for their dress at the hall (hallguests.ts). */
  civ?: string;
  /** The answers the leader may give now; none while a rival has only threatened. */
  answers: CourtAnswer[];
  /** A suitor: the daughter asked for, whether she is willing, and whether she has been asked. */
  daughter?: string; willing?: boolean; asked?: boolean;
  /** A plot: those spoken of, which of them it is, those shown true already, and whether informers are kept. */
  nobles?: CourtNoble[]; culprit?: number; cleared?: number[]; informers?: boolean;
  /** The season of the visit, so that what a watch shows is drawn afresh each visit. */
  turn?: number;
  /** The other stories of the house afoot at once (a suitor while a rival threatens, a plot beside either): each as this one is. */
  also?: FieldCourt[];
}
/** What came of it on the field, for the map. */
export interface FieldCourtOut { id: number; asked?: boolean; answer?: string; cleared: number[]; /** What came of the other stories afoot at once. */ also?: FieldCourtOut[] }

declare module './game' {
  interface Player {
    /** A story of the leader's house, as it stands on the field (courtfield.ts). */
    court?: CourtOnField;
  }
  interface Unit {
    /** Which of the great a plot speaks of this villager is shown as (courtfield.ts). Their own name is kept. */
    noble?: number;
    /** The plot that speaks of them, by the story's number (courtfield.ts). */
    plot?: number;
  }
}

/** A story of the house as the field keeps it: what the map handed in, and what has been done about it here. */
export type CourtOnField = FieldCourt & { laid?: boolean; answer?: string; watched?: Record<number, number>; tried?: number[]; out?: number[]; also?: CourtOnField[] };

/** Every story of the house afoot on this side's field: the first, and those that came with it. */
export function courtsOf(g: Game, owner: number): CourtOnField[] {
  const s = g.players[owner]?.court;
  return s ? [s, ...(s.also ?? [])] : [];
}
/** The story an answer belongs to: a rival's or a suitor's, by what may be answered to each (their answers have different names). */
function storyFor(g: Game, owner: number, id: string): CourtOnField | undefined {
  return courtsOf(g, owner).find((s) => (id === 'ask' ? s.kind === 'suitor' : FIELD_ANSWERS[s.kind].includes(id)));
}

export const FIELD_COURT = {
  /** Seconds a soldier must keep by one of the great to have watched them; tiles he may stand off. */
  watch: 45, near: 4,
  /** Where informers are kept they know what to look for: so much of the time. */
  informed: 0.5,
  /** The chance that watching one who is true shows it. */
  shown: 0.5,
};

/** Answers that may be given on the field. A guard or informers are set on the map, and a judgement is given there. */
export const FIELD_ANSWERS: Record<FieldCourt['kind'], string[]> = { rival: ['defy', 'buy', 'yield'], suitor: ['give', 'decline', 'spurn'], plot: [] };

const hash = (a: number, b: number, c: number): number => {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c + 0x165667b1, 0x27d4eb2f)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
const done = (s: CourtOnField, i: number): boolean => (s.cleared ?? []).includes(i) || (s.out ?? []).includes(i);

/** Lay a plot on the town the first time the field is looked at: each of the great still spoken of is one of its grown people. */
export function layCourt(g: Game, owner: number): void {
  for (const s of courtsOf(g, owner)) layOne(g, owner, s);
}
function layOne(g: Game, owner: number, s: CourtOnField): void {
  if (s.laid) return;
  s.laid = true;
  if (s.kind !== 'plot') return;
  const used = new Set<number>();
  (s.nobles ?? []).forEach((n, i) => {
    if ((s.cleared ?? []).includes(i)) return;
    const u = g.units.find((x) => x.owner === owner && !x.dead && x.type === 'villager' && x.gender === (n.female ? 'f' : 'm') && !used.has(x.id) && x.noble === undefined && x.suspect === undefined);
    if (!u) return;
    used.add(u.id);
    u.noble = i; u.plot = s.id;
  });
}

/** The name and title a villager is shown under, if they are one of the great spoken of; else undefined. */
export function guiseOf(g: Game, u: Unit): CourtNoble | undefined {
  return u.noble === undefined ? undefined : plotOf(g, u)?.nobles?.[u.noble];
}
/** The plot that speaks of this villager, if one does. */
export function plotOf(g: Game, u: Unit): CourtOnField | undefined {
  return u.noble === undefined ? undefined : courtsOf(g, u.owner).find((s) => s.kind === 'plot' && (u.plot === undefined || s.id === u.plot));
}

/** A second of the story on the field: a soldier keeping by one of the great watches them. Called once a second (game.ts step). */
export function courtTick(g: Game): void {
  for (let owner = 0; owner < g.players.length; owner++) {
    layCourt(g, owner);
    for (const s of courtsOf(g, owner)) if (s.kind === 'plot') watchOne(g, owner, s);
  }
}
/** One plot's watch for a second: a soldier keeping by one of its great. */
function watchOne(g: Game, owner: number, s: CourtOnField): void {
  const need = FIELD_COURT.watch * (s.informers ? FIELD_COURT.informed : 1);
  for (const u of g.units) {
    if (u.owner !== owner || u.dead || u.noble === undefined || plotOf(g, u) !== s) continue;
    const i = u.noble;
    if (done(s, i) || (s.tried ?? []).includes(i)) continue;
    const by = g.units.some((x) => x.owner === owner && !x.dead && x.type !== 'villager' && !x.def.naval && Math.hypot(x.x - u.x, x.y - u.y) <= FIELD_COURT.near);
    const w = (s.watched ??= {});
    w[i] = by ? (w[i] ?? 0) + 1 : 0;
    if (w[i] < need) continue;
    (s.tried ??= []).push(i);
    const n = s.nobles![i], shown = i !== s.culprit && hash(g.seed, s.id * 151 + i, 7 + 31 * (s.turn ?? 0)) < FIELD_COURT.shown; // drawn afresh each season's visit: one not shown true this time may be the next
    if (shown) (s.out ??= []).push(i);
    g.msg(owner, shown
      ? `${n.title} has been watched day and night, and is true. ${n.female ? 'She' : 'He'} is spoken of no longer.`
      : `${n.title} has been watched day and night. Nothing is settled by it.`);
  }
}

/** Why the leader cannot give this answer at the hall now, or '' if they can. */
export function answerBar(g: Game, owner: number, id: string): string {
  const s = storyFor(g, owner, id);
  if (!s || s.kind === 'plot') return courtsOf(g, owner).some((x) => x.kind !== 'plot') ? 'That is not for answering here.' : 'Nobody waits on an answer here.';
  if (s.answer) return 'Your answer is given, and goes with you when you leave.';
  if (id === 'ask') return s.kind !== 'suitor' ? 'There is nobody to ask.' : s.asked ? `${s.daughter} has said what she wants.` : '';
  const a = s.answers.find((x) => x.id === id);
  if (!a || !FIELD_ANSWERS[s.kind].includes(id)) return 'That is not for answering here.';
  return a.bar ?? '';
}

/** The leader asks the daughter what she wants, or gives the guest an answer. Returns whether it was done. */
export function cmdAnswer(g: Game, owner: number, id: string): boolean {
  const s = storyFor(g, owner, id);
  if (!s || answerBar(g, owner, id)) return false;
  if (id === 'ask') {
    s.asked = true;
    g.msg(owner, s.willing ? `${s.daughter} says she has seen him, and would have him.` : `${s.daughter} says she would sooner stay unwed than go to his people.`);
    return true;
  }
  s.answer = id;
  g.msg(owner, `Your answer is given at the hall: ${lowerFirst(s.answers.find((x) => x.id === id)!.label)}. It is done when you leave the town.`);
  return true;
}

/** What came of the story on the field, for the map: what was asked and answered, and who was shown true. */
export function courtOut(g: Game, owner: number): FieldCourtOut | undefined {
  const one = (s: CourtOnField): FieldCourtOut => ({ id: s.id, ...(s.asked ? { asked: true } : {}), ...(s.answer ? { answer: s.answer } : {}), cleared: [...(s.out ?? [])] });
  const [first, ...rest] = courtsOf(g, owner);
  if (!first) return undefined;
  return { ...one(first), ...(rest.length ? { also: rest.map(one) } : {}) };
}
