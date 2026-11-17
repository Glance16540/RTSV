// Dealing with a noble (docs/DESIGN.md, "Relationships": nobles; the owner's "nobles you can deal with").
//
// The leader deals with one noble of their nation at a time, from the land's panel. Each dealing has a cost, moves
// the noble's mood at once, and lasts: it leaves a bond on the noble (nobles.ts, `bonds`) that holds where their mood
// settles for as long as it holds. Some sting the others.
//   - Summon to court: the noble is heard at court. A supply for their keep; their mood up a little, and settling a
//     little higher for a year. Not again for a year.
//   - A gift: goods sent, paid as a dealing is (prices.ts: gold). Their mood up, and settling higher for two years.
//   - A post or title: a governorship for a lord, a captaincy for a captain, a seat at court for a matron. A stipend
//     paid once; their mood up much, and settling higher while they hold it. The others of their rank in the nation
//     are a little jealous.
//   - A marriage into the leader's house: a grown son or daughter of the house, never a child, weds the noble. It costs
//     nothing in goods but the match; their mood up most, and settling highest, for good. The other nobles are a
//     little jealous. The one wed stays a child of the house.
//   - Stripping a noble of their lands: they are noble no more (a lord's town has a new lord, nobles.ts `newLord`),
//     and what they held is the crown's (gold into the town). Every noble of the nation is afraid and angered, most in
//     their own town. One stripped is remembered by name (`Faction.stripped`, and `Faction.unlanded` with where).
// Nobody of the inner circle is dealt with here: they have their posts already (kin.ts).
// Each dealing is told by name in the season's report (as a story of the court is) and in the log.
// The computer's peoples deal with their own nobles too (nobleweigh.ts). Plain data in and out; nothing is drawn.
import type { Campaign } from './campaign';
import type { Bond, Noble } from './nobles';
import { isAngry, newLord, noblesOf, titleOf } from './nobles';
import { canPayFor, payFor } from './prices';
import { houseOf, ofAge } from './dynasty';
import type { Heir } from './dynasty';
import { folkOf } from './township';
import { heed } from './nobletemper';

export type DealKind = 'summon' | 'gift' | 'post' | 'wed' | 'strip';
export const DEAL_KINDS: DealKind[] = ['summon', 'gift', 'post', 'wed', 'strip'];

declare module './nobles' {
  interface Noble {
    /** The title the leader has given (nobledeal.ts). */
    title?: string;
    /** The child of the leader's house the noble has wed (nobledeal.ts). */
    wed?: string;
  }
}
declare module './dynasty' {
  interface Heir {
    /** The noble this child of the house has wed: their key and name (nobledeal.ts). */
    wedTo?: { key: string; name: string };
  }
}
declare module './campaign' {
  interface Faction {
    /** Those stripped of their lands: who, where, when (nobledeal.ts). */
    unlanded?: { key: string; name: string; female: boolean; town: number; turn: number }[];
  }
}

export const DEALS = {
  summon: { name: 'Summon to court', supplies: 1, mood: 15, rest: 5, seasons: 4, every: 4 },
  gift: { name: 'Send a gift', supplies: 2, mood: 20, rest: 8, seasons: 8 },
  post: { name: 'Give a post', supplies: 3, mood: 25, rest: 20, jealous: -5 },
  wed: { name: 'Wed into your house', supplies: 0, mood: 40, rest: 30, jealous: -5 },
  strip: { name: 'Strip of their lands', supplies: 0, seized: 150, others: -15, near: -25 },
};

/** The title a noble of this rank is given. */
export const TITLES: Record<string, string> = { lord: 'Governor', captain: 'Warden of the marches', matron: 'Lady of the court' }; // each new to the rank (a captain was once offered "Captain of the host")

const tell = (c: Campaign, f: number, tid: number, tone: 'good' | 'bad' | 'plain', text: string): void => {
  if (f !== 0) return;
  c.log.push(text);
  const news = (c.intrigueNews ??= []);
  news.push({ turn: c.turn, id: -1, kind: 'plot', at: tid, owner: f, tone, text }); // the season's report, among the court's doings
};
const clamp = (v: number): number => Math.max(-100, Math.min(100, Math.round(v)));
const bond = (c: Campaign, n: Noble, b: Omit<Bond, 'turn'>): void => { (n.bonds ??= []).push({ turn: c.turn, ...b }); };

/** A grown child of the leader's house, not yet wed, who may wed this noble: of the other sex. Never a child. */
export function heirFor(c: Campaign, f: number, n: Noble): Heir | undefined {
  return houseOf(c, f).heirs.find((h) => ofAge(c, h) && !h.wedTo && h.female !== n.female);
}
/** The noble with this key in the nation. */
export const nobleByKey = (c: Campaign, f: number, key: string): Noble | undefined => noblesOf(c, f).find((n) => n.key === key);

/** Why the leader cannot deal so with this noble now, or ''. */
export function dealBar(c: Campaign, f: number, key: string, kind: DealKind): string {
  const n = nobleByKey(c, f, key), d = DEALS[kind];
  if (!n) return 'There is no such noble.';
  if (n.rank === 'close') return 'One of the inner circle: they have their post already.';
  if (d.supplies && !canPayFor(c, f, 'dealing', d.supplies)) return `It costs ${d.supplies} supplies.`;
  if (kind === 'summon' && (n.bonds ?? []).some((b) => b.kind === 'summon' && b.turn > c.turn - DEALS.summon.every)) return 'Summoned to court within the year.';
  if (kind === 'post' && n.title) return `Already ${n.title}.`;
  if (kind === 'post' && !TITLES[n.rank]) return 'There is no post for them.';
  if (kind === 'wed' && n.wed) return `Already wed to ${n.wed} of your house.`;
  if (kind === 'wed' && !heirFor(c, f, n)) return 'Your house has no grown son or daughter to wed them.';
  return '';
}

/** Deal so with a noble. Returns '' when done, or why not. */
export function dealWith(c: Campaign, f: number, key: string, kind: DealKind): string {
  const bar = dealBar(c, f, key, kind);
  if (bar) return bar;
  const n = nobleByKey(c, f, key)!, d = DEALS[kind], who = titleOf(c, n), all = noblesOf(c, f);
  if (d.supplies && !payFor(c, f, 'dealing', d.supplies, { at: n.town })) return `It costs ${d.supplies} supplies.`;
  const angry = isAngry(n);
  heed(c, n); // dealt with: not neglected (nobletemper.ts)
  if (kind === 'summon') {
    n.mood = clamp(n.mood + DEALS.summon.mood);
    bond(c, n, { kind, rest: DEALS.summon.rest, until: c.turn + DEALS.summon.seasons });
    tell(c, f, n.town, 'plain', `${who} is summoned to court and heard${angry && !isAngry(n) ? ', and goes home the calmer' : ''}.`);
  } else if (kind === 'gift') {
    n.mood = clamp(n.mood + DEALS.gift.mood);
    bond(c, n, { kind, rest: DEALS.gift.rest, until: c.turn + DEALS.gift.seasons });
    tell(c, f, n.town, 'good', `Gifts are sent to ${who}: ${their(n)} mood rises by ${DEALS.gift.mood}${angry && !isAngry(n) ? ', and the anger is gone' : ''}, and ${they(n)} will think the better of you for two years.`);
  } else if (kind === 'post') {
    n.title = TITLES[n.rank];
    n.mood = clamp(n.mood + DEALS.post.mood);
    bond(c, n, { kind, rest: DEALS.post.rest, what: n.title });
    for (const x of all) if (x !== n && x.rank === n.rank) x.mood = clamp(x.mood + DEALS.post.jealous);
    tell(c, f, n.town, 'good', `${n.name} of ${c.territories[n.town]?.name ?? ''} is made ${n.title}.`);
  } else if (kind === 'wed') {
    const h = heirFor(c, f, n)!;
    h.wedTo = { key: n.key, name: n.name };
    n.wed = h.name;
    n.mood = clamp(n.mood + DEALS.wed.mood);
    bond(c, n, { kind, rest: DEALS.wed.rest, what: h.name });
    for (const x of all) if (x !== n && x.rank !== 'close') x.mood = clamp(x.mood + DEALS.wed.jealous);
    tell(c, f, n.town, 'good', `${h.name} of your house weds ${who}.`);
  } else {
    const fac = c.factions[f], tid = n.town;
    for (const x of all) if (x !== n) x.mood = clamp(x.mood + (x.town === tid ? DEALS.strip.near : DEALS.strip.others));
    (fac.unlanded ??= []).push({ key: n.key, name: n.name, female: n.female, town: tid, turn: c.turn });
    // A child of the house wed to them stays a child of the house, wed to one unlanded.
    if (n.rank === 'lord') newLord(c, f, tid, n);
    else { (fac.stripped ??= []).push(n.key); fac.nobles = all.filter((x) => x !== n); }
    folkOf(c, tid).stores.gold += DEALS.strip.seized;
    tell(c, f, tid, 'bad', `${who} is stripped of their lands, and what they held is yours. The nobles are afraid.`);
  }
  return '';
}

const their = (n: Noble): string => (n.female ? 'her' : 'his');
const they = (n: Noble): string => (n.female ? 'she' : 'he');

/** What a dealing does, in words, for the noble it would be done with. */
export function dealEffect(c: Campaign, f: number, n: Noble, kind: DealKind): string {
  const D = DEALS;
  if (kind === 'summon') return `${they(n)[0].toUpperCase() + they(n).slice(1)} is heard at court: ${their(n)} mood rises by ${D.summon.mood}, and settles ${D.summon.rest} higher for a year. Not again within the year.`;
  if (kind === 'gift') return `${their(n)[0].toUpperCase() + their(n).slice(1)} mood rises by ${D.gift.mood}, and settles ${D.gift.rest} higher for two years.`;
  if (kind === 'post') return `Made ${TITLES[n.rank] ?? 'an officer'}: ${their(n)} mood rises by ${D.post.mood}, and settles ${D.post.rest} higher while ${they(n)} holds it. The others of ${their(n)} rank are a little jealous (${D.post.jealous}).`;
  if (kind === 'wed') { const h = heirFor(c, f, n); return `${h ? `${h.name} of your house` : 'A grown son or daughter of your house'} weds ${them(n)}: ${their(n)} mood rises by ${D.wed.mood}, and settles ${D.wed.rest} higher for good. The other nobles are a little jealous (${D.wed.jealous}).`; }
  return `${they(n)[0].toUpperCase() + they(n).slice(1)} is noble no more, and what ${they(n)} held is yours (${D.strip.seized} gold). Every noble of the nation is afraid and angered (${D.strip.others}, ${D.strip.near} in ${their(n)} own town).`;
}
const them = (n: Noble): string => (n.female ? 'her' : 'him');

/** The leader's dealings open with a noble now, each with why not if it cannot be done, for the land's panel. */
export function dealsFor(c: Campaign, f: number, key: string): { kind: DealKind; name: string; bar: string }[] {
  const n = nobleByKey(c, f, key);
  if (!n || n.rank === 'close') return [];
  return DEAL_KINDS.map((kind) => ({ kind, name: kind === 'post' && TITLES[n.rank] ? `Make ${TITLES[n.rank]}` : DEALS[kind].name, bar: dealBar(c, f, key, kind) }));
}

/** What a dealing costs, in words. */
export function dealCost(kind: DealKind): string {
  const d = DEALS[kind];
  if (kind === 'wed') return 'A grown son or daughter of your house, for good.';
  if (kind === 'strip') return `The nobles' fear and anger; ${DEALS.strip.seized} gold seized.`;
  return `${d.supplies} suppl${d.supplies === 1 ? 'y' : 'ies'}.`;
}
