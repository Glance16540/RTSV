// Goods sent for: a thing bought waits for what its town lacks to come in by road (docs/DESIGN.md, "Stores": a people's
// towns send food and goods to one another by road, a season on the way, and a convoy can be robbed).
//
// A building, a leader, a new age or a work across a border is paid for out of the town where it is done (prices.ts).
// What that town lacks of a kind its other towns send, and until now it came at once. Now it goes as it would go by
// hand: each sending town's share leaves as a convoy (convoys.ts), a season on the road and met by bands as any convoy is
// (though a band that robs one grows no stronger for it), CARRY.cost of it spent on the way as before; and the thing waits. While it waits it cannot be ordered again
// (prices.ts payBar says why). When every convoy for it has come in, or been lost on the way, the thing is done after all,
// if the town now has what it costs: the convoys' goods, and its own share, set aside when the goods were sent for so that
// its governor or anything else could not spend it meanwhile. If a band took part of the goods on the road, it is not
// done (its own share goes back into its stores), and the player is told.
//
// The same for every people: the player's orders, a rival's buying, and anything else that builds at a town. A company
// is raised at once, as before, what its town lacks taken from the nation's towns that moment (the owner's word, DESIGN
// ae5db6f: an army that waits a season for its pay is no army; at 384 campaigns with companies waiting too, the computer's
// armies thinned to half and a fifth of the campaigns went undecided). A dealing (a truce, a gift, a tale's price) is not
// a thing done at a town and is paid at once, as before.
//
// This module keeps what is waiting and sends the convoys. Who does the thing when the goods are in is the caller's to say
// (campaign.ts gives the season's pass a hand that knows how to build and the rest), so nothing here imports them.
import type { Campaign } from './campaign';
import { sendConvoy } from './convoys';
import type { Stores } from './township';
import { STORE_KINDS, folkOf } from './township';

/** What to do when the goods are in: build a site, call a leader, enter an age, open a border. */
export interface Act { kind: 'build' | 'hero' | 'age' | 'work'; arg?: string | number }
/** A thing waiting for its goods: whose, where, what it is and costs, what to do, since when, and the convoys bringing them. */
export interface SentFor { id: number; f: number; at: number; what: string; n: number; act: Act; since: number; convoys: number[]; /** The town's own share of the price, set aside while it waits so that nothing else spends it. */ held?: Stores }

declare module './campaign' {
  interface Campaign {
    /** Things bought that wait for their goods to come in by road (sentfor.ts). */
    sentFor?: SentFor[];
    sentForSeq?: number;
  }
}

/** The thing waiting at this town for this people, of this kind, if any. */
export const waitingFor = (c: Campaign, f: number, at: number, what: string): SentFor | undefined => (c.sentFor ?? []).find((s) => s.f === f && s.at === at && s.what === what);

/** One sending town's share: so much of each kind leaves it, and so much (CARRY.cost less) comes in. */
export interface Sending { from: number; take: Stores; arrive: Stores }

const named = (c: Campaign, act: Act, what: string): string =>
  act.kind === 'build' ? `the ${String(act.arg ?? what)}` : act.kind === 'hero' ? 'a new leader' : act.kind === 'age' ? 'the new age' : act.kind === 'work' ? `the ${what}` : what;

/**
 * Send for what the town `at` lacks: each town's share leaves as a convoy to it, with what it loses on the way taken from
 * it as it sets out, and the thing is put down as waiting. Returns the waiting, or null if no convoy could set out
 * (and then nothing is taken).
 */
export function sendFor(c: Campaign, f: number, at: number, what: string, n: number, act: Act, sending: Sending[], own?: Stores): SentFor | null {
  const id = (c.sentForSeq = (c.sentForSeq ?? 0) + 1), convoys: number[] = [];
  for (const s of sending) {
    const cargo: Partial<Stores> = {};
    for (const k of STORE_KINDS) if (s.arrive[k] > 0) cargo[k] = s.arrive[k];
    if (!Object.keys(cargo).length) continue;
    const x = sendConvoy(c, f, s.from, at, cargo, { pays: id });
    if (!x) continue;
    const from = folkOf(c, s.from);
    for (const k of STORE_KINDS) from.stores[k] -= Math.max(0, s.take[k] - s.arrive[k]); // the road's cost, spent as it sets out
    convoys.push(x.id);
  }
  if (!convoys.length) { if (c.sentForSeq === id) c.sentForSeq = id - 1; return null; }
  const w: SentFor = { id, f, at, what, n, act, since: c.turn, convoys };
  if (own && STORE_KINDS.some((k) => own[k] > 0)) {
    const s = folkOf(c, at).stores;
    for (const k of STORE_KINDS) { const part = Math.min(Math.max(0, s[k]), Math.max(0, own[k])); s[k] -= part; own[k] = part; }
    w.held = own;
  }
  (c.sentFor ??= []).push(w);
  if (f === 0) {
    const from = [...new Set(sending.map((s) => c.territories[s.from].name))];
    c.log.push(`${c.territories[at].name} lacks the goods for ${named(c, act, what)}: they are sent for by road from ${from.join(' and ')}, and it waits for them, a season.`);
  }
  return w;
}

/**
 * The season's pass, after the convoys have come in: every waiting whose convoys are all in (or lost) is done by `done`,
 * which does the thing if the town can now pay for it and says whether it did. A waiting not done is let go, and the
 * player told. Returns those done.
 */
export function sentForSeason(c: Campaign, done: (s: SentFor) => boolean): SentFor[] {
  const out: SentFor[] = [], road = new Set((c.convoys ?? []).map((x) => x.id));
  const due = (c.sentFor ?? []).filter((s) => !s.convoys.some((id) => road.has(id)));
  if (!due.length) return out;
  c.sentFor = (c.sentFor ?? []).filter((s) => !due.includes(s));
  if (!c.sentFor.length) delete c.sentFor;
  for (const s of due) {
    const t = c.territories[s.at];
    if (t && s.held) for (const k of STORE_KINDS) folkOf(c, s.at).stores[k] += s.held[k]; // the town's own share, set aside, back for the paying
    if (!t || t.owner !== s.f) continue; // the town is lost: the goods went to whoever has it, or nowhere
    if (done(s)) { out.push(s); if (s.f === 0) c.log.push(`The goods have come in to ${t.name}, and ${named(c, s.act, s.what)} is done there.`); }
    else if (s.f === 0) c.log.push(`The goods sent to ${t.name} for ${named(c, s.act, s.what)} did not all come in, robbed on the road: it is not done, and the town keeps what did.`);
  }
  return out;
}
