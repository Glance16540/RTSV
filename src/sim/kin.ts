// The leader's household and inner circle (docs/DESIGN.md, "Relationships"). The leader is a person among people.
//
//   Spouse. Every leader has a husband or wife, named, with an age; children born to the house are theirs too
//     (dynasty.ts: an heir's `parent`). A spouse can die (old age, or the plague in the town they live in), be
//     carried off when the leader's seat is sacked, or be widowed when the leader falls. A leader who has lost a
//     spouse may marry again after REMARRY seasons, by chance; no children are born to the house meanwhile.
//     A new leader comes with a household of their own; the old leader's spouse is remembered in the chronicle.
//   Inner circle. Up to four people stand closest to the leader: a right hand, a steward, a marshal, and a priest
//     where the nation keeps a church (else a confidant). Each is drawn from the nation's notable people where it can
//     be (a veteran for the marshal and right hand, a woman of a great house for the steward), and otherwise is
//     someone of the capital, named. Each has a town, a loyalty (0 to 100) and a mood. Loyalty moves each season with
//     how the nation fares (land won or lost) and with what befalls their own town (raided, hungry, plague, taken).
//     Someone lost, or whose town is no longer the nation's, leaves the circle; the place is filled next season.
//
//   What each post does, a little, by loyalty (`sway` = (loyalty - 50) / 50, from -1 to 1): the steward eases the
//     seat's larder (when it runs short of a season's eating, stretches it by a share of that; when disloyal, skims
//     that share); the marshal steadies the army the leader rides with (a battle's seasoning gained, or lost); the priest moves the seat's standing toward the holy (or
//     away); the right hand stands in for the leader in their own town, so unrest there passes as if the leader were
//     there (deputyAt; when disloyal they lead it astray instead); the confidant warns of plots (plotWarning, for the
//     intrigue to read: above 0 a warning, below 0 one who keeps silent or whispers to the plotters).
//   A spouse carried off is held by the band that took them, among its captives, and comes home if the band is broken
//   while it still holds them; held too long, they are gone for good.
//   News. Each change in the household is kept as news (married, widowed, died, carried off, freed, lost for good,
//     someone leaving or joining the circle) for the season's report to tell.
//
// Plain data on the faction, kept in the save. Rivals have the same, kept coarsely by the same rules.
// No child is ever in the circle, and none is harmed by anything here.
import type { Campaign } from './campaign';
import { NAMES_F, NAMES_M } from './data';
import { folkOf, living } from './township';
import type { Notable } from './township';
import type { Feeling } from './portrait';
import { MAX_VETERAN } from './campaign';
import { THREATS } from './threats';
import { needOf } from './larder';
import { swayTown } from './townfaith';

export type Post = 'right' | 'steward' | 'marshal' | 'priest' | 'confidant';
export const POST_NAMES: Record<Post, string> = { right: 'Right hand', steward: 'Steward', marshal: 'Marshal', priest: 'Priest', confidant: 'Confidant' };
/** The leader's husband or wife. `born`: the turn of their birth, in seasons. `lost`: how and when, if they are gone. */
export interface Spouse { name: string; female: boolean; born: number; of: string; lost?: { turn: number; how: 'died' | 'taken' | 'widowed'; band?: number; final?: boolean } }
/** One of the inner circle. `notable`: they are one of the nation's people known by name (township.ts), at `town`. */
export interface Close { post: Post; name: string; female: boolean; family?: string; town: number; notable?: boolean; kind?: Notable['kind']; unit?: string; loyalty: number; feeling: Feeling; since: number }
/** A change in the household, for the season's report. */
export interface KinNews { turn: number; text: string; tone: 'good' | 'bad' | 'plain' }
export interface Kin { leader: string; spouse?: Spouse; alone?: number; circle: Close[]; seen: { lands: number }; news?: KinNews[] }
declare module './campaign' {
  interface Faction {
    /** The leader's household and inner circle (kin.ts). */
    kin?: Kin;
  }
}

export const KIN = {
  /** Seasons a leader who has lost a spouse waits before they may marry again, and the chance a season after. */
  remarry: 8, marry: 0.25,
  /** The chance a season a spouse is carried off when the leader's seat is sacked. */
  carried: 0.5,
  /** Loyalty: where it starts, and how it moves each season. */
  start: 65, won: 2, lost: -4, raided: -6, hungry: -4, sick: -2, quiet: 1, takenTown: -15,
  /** Under this a member is angry; under `uneasy` and anything amiss, afraid. */
  angry: 30, uneasy: 50,
  /** The most in the circle. */
  most: 4,
  /** What the posts do at full loyalty: the share of a season's eating the steward finds for a seat running short (or
   *  skims, when disloyal), the chance a season the
   *  marshal seasons the leader's army, the chance a season the priest moves the seat's standing a step, the right hand's sway on their town
   *  when disloyal. */
  steward: 0.1, marshal: 0.15, priest: 0.25, astray: -1,
  /** News kept for the report. */
  news: 12,
};
/** How a member of the circle leans: -1 (working against) to 1 (wholly for), from their loyalty. */
export const sway = (x: Close): number => Math.max(-1, Math.min(1, (x.loyalty - 50) / 50));

const hash = (c: Campaign, a: number, salt: number): number => {
  let h = Math.imul((c.seed | 0) ^ 0x7f4a7c15, 0x85ebca6b) ^ Math.imul(a * 613 + salt + 17, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
const rand = (c: Campaign, a: number, salt: number): number => hash(c, a * 7919 + c.turn, salt);
const named = (c: Campaign, f: number, female: boolean, salt: number, not: string[] = []): string => {
  const list = female ? NAMES_F : NAMES_M;
  let i = Math.floor(hash(c, f * 31 + salt, 3) * list.length);
  for (let k = 0; k < list.length && not.includes(list[i]); k++) i = (i + 1) % list.length;
  return list[i];
};
const seatOf = (c: Campaign, f: number): number => (c.territories.find((t) => t.capital === f && t.owner === f) ?? c.territories.find((t) => t.owner === f))?.id ?? -1;
const leaderName = (c: Campaign, f: number): string => c.factions[f]?.hero?.name ?? `leader${f}`;
const leaderFemale = (c: Campaign, f: number): boolean => !!c.factions[f]?.hero?.female;
const landsOf = (c: Campaign, f: number): number => c.territories.filter((t) => t.owner === f).length;

/** A new husband or wife for the leader, of the other sex, a little younger or older. */
function wed(c: Campaign, f: number, salt: number): Spouse {
  const female = !leaderFemale(c, f), lead = leaderName(c, f);
  return { name: named(c, f, female, salt, [lead.split(/[\s,]/)[0]]), female, born: c.turn - (120 + Math.floor(hash(c, f * 37 + salt, 5) * 60)), of: lead }; // thirty to forty-five years old
}

/** Fill the empty places in the circle: notable people of the nation first, then people of the seat, named. */
function fill(c: Campaign, f: number, k: Kin): void {
  const posts: Post[] = ['right', 'steward', 'marshal', c.territories.some((t) => t.owner === f && t.buildings.includes('church')) ? 'priest' : 'confidant'];
  const taken = new Set(k.circle.map((x) => x.name));
  const known = c.territories.filter((t) => t.owner === f).flatMap((t) => living(folkOf(c, t.id)).map((n) => ({ n, town: t.id })));
  for (const post of posts) {
    if (k.circle.length >= KIN.most || k.circle.some((x) => x.post === post)) continue;
    const want = post === 'marshal' || post === 'right' ? 'veteran' : post === 'steward' ? 'mother' : undefined;
    const seat = seatOf(c, f);
    // The right hand stands in for the leader in their own town, so one away from the seat is worth more.
    const from = post === 'right' ? [...known.filter((x) => x.town !== seat), ...known.filter((x) => x.town === seat)] : known;
    const pick = from.find((x) => !taken.has(x.n.name) && (!want || x.n.kind === want)) ?? (post === 'right' ? from.find((x) => !taken.has(x.n.name)) : undefined);
    if (seat < 0) return;
    const who: Close = pick
      ? { post, name: pick.n.name, female: pick.n.gender === 'f', town: pick.town, notable: true, kind: pick.n.kind, ...(pick.n.family ? { family: pick.n.family } : {}), ...(pick.n.unit ? { unit: pick.n.unit } : {}), loyalty: KIN.start, feeling: 'content', since: c.turn }
      : (() => { const female = post === 'steward' || post === 'priest' ? hash(c, f * 41 + posts.indexOf(post), 9) < 0.5 : hash(c, f * 43 + posts.indexOf(post), 11) < 0.25;
        return { post, name: named(c, f, female, 101 + posts.indexOf(post) + c.turn, [...taken]), female, town: seat, loyalty: KIN.start, feeling: 'content' as Feeling, since: c.turn }; })();
    taken.add(who.name);
    k.circle.push(who);
  }
}

/** A people's household and circle, made the first time it is asked after. */
export function kinOf(c: Campaign, f: number): Kin {
  const fac = c.factions[f];
  if (!fac.kin) {
    fac.kin = { leader: leaderName(c, f), circle: [], seen: { lands: landsOf(c, f) } };
    fac.kin.spouse = wed(c, f, 1);
    fill(c, f, fac.kin);
  }
  return fac.kin;
}
/** The leader's living spouse, if they have one. */
export const spouseOf = (c: Campaign, f: number): Spouse | undefined => { const s = c.factions[f]?.kin?.spouse; return s && !s.lost ? s : undefined; };
/** The other parent of a child born to the house now: the leader's living spouse. */
export const parentFor = (c: Campaign, f: number): string | undefined => { kinOf(c, f); return spouseOf(c, f)?.name; };
/** May a child be born to the house now: the leader has a living spouse. */
export const canBear = (c: Campaign, f: number): boolean => { kinOf(c, f); return !!spouseOf(c, f); };

const chronicle = (c: Campaign, text: string): void => { (c.chronicle ??= []).push({ turn: c.turn, text }); };
const tell = (c: Campaign, k: Kin, text: string, tone: KinNews['tone']): void => { (k.news ??= []).push({ turn: c.turn, text, tone }); if (k.news.length > KIN.news) k.news.splice(0, k.news.length - KIN.news); };
const sickAt = (c: Campaign, tid: number): boolean => (c.events ?? []).some((e) => e.kind === 'plague' && e.at === tid && e.until >= c.turn);
const struck = (c: Campaign, tid: number, kinds: string[]): boolean => (c.events ?? []).some((e) => e.at === tid && e.turn === c.turn && kinds.includes(e.kind));

/** One season for one people's household and circle. */
export function kinSeason(c: Campaign, f: number): void {
  const fac = c.factions[f];
  if (!fac?.alive) return;
  const k = kinOf(c, f), mine = f === 0, seat = seatOf(c, f);
  // A new leader comes with a household of their own; the old leader's spouse is remembered.
  if (fac.heroAlive && k.leader !== leaderName(c, f)) {
    if (k.spouse && !k.spouse.lost) { k.spouse.lost = { turn: c.turn, how: 'widowed' }; chronicle(c, `${k.spouse.name}, ${k.spouse.female ? 'wife' : 'husband'} of ${k.spouse.of}, is widowed.`); tell(c, k, chronicleLast(c), 'plain'); }
    k.leader = leaderName(c, f);
    k.spouse = wed(c, f, 7 + c.turn);
    delete k.alone;
    if (mine) chronicle(c, `${k.leader} rules with ${k.spouse.name} at their side.`);
    tell(c, k, `${k.leader} rules with ${k.spouse.name} at their side.`, 'plain');
  }
  const s = k.spouse;
  if (s && !s.lost) {
    const age = (c.turn - s.born) / 4;
    const dies = age >= 60 && rand(c, f, 21) < 0.01 + 0.005 * (age - 60);
    const sick = seat >= 0 && sickAt(c, seat) && rand(c, f, 23) < 0.1;
    const carried = seat >= 0 && struck(c, seat, ['carried']) && rand(c, f, 25) < KIN.carried;
    if (dies || sick || carried) {
      // Carried off: held among the band's captives (threats.ts), to be got back the same way.
      const band = carried ? (c.bands ?? []).find((b) => b.held.some((h) => h.from === seat && h.owner === f && h.since === c.turn)) : undefined;
      if (band) { const h = band.held.find((x) => x.from === seat && x.owner === f && x.since === c.turn)!; (h.names ??= []).push(s.name); }
      s.lost = { turn: c.turn, how: carried ? 'taken' : 'died', ...(band ? { band: band.id } : carried ? { final: true } : {}) };
      k.alone = c.turn;
      chronicle(c, carried ? `${s.name}, ${s.female ? 'wife' : 'husband'} of ${s.of}, was carried off when ${c.territories[seat].name} was sacked${band ? ` and is held by ${band.name}` : ''}.` : `${s.name}, ${s.female ? 'wife' : 'husband'} of ${s.of}, has died${sick ? ' of the plague' : ''}.`);
      tell(c, k, chronicleLast(c), 'bad');
      if (mine) c.log.push(chronicleLast(c));
    }
  } else if (s && s.lost?.how === 'taken' && !s.lost.final) {
    // Still held, got back, or held too long.
    const held = (c.bands ?? []).some((b) => b.held.some((h) => h.owner === f && (h.names ?? []).includes(s.name)));
    if (!held) {
      if (c.turn - s.lost.turn < THREATS.holdFor) {
        delete s.lost; delete k.alone;
        chronicle(c, `${s.name} is free and has come home to ${k.leader}.`);
        tell(c, k, chronicleLast(c), 'good');
      } else {
        s.lost.final = true;
        chronicle(c, `${s.name}, ${s.female ? 'wife' : 'husband'} of ${s.of}, was held too long and will not be seen again.`);
        tell(c, k, chronicleLast(c), 'bad');
      }
      if (mine) c.log.push(chronicleLast(c));
    }
  } else if (fac.heroAlive && c.turn - (k.alone ?? s?.lost?.turn ?? c.turn) >= KIN.remarry && rand(c, f, 27) < KIN.marry) {
    k.spouse = wed(c, f, 31 + c.turn);
    delete k.alone;
    chronicle(c, `${k.leader} has married again: ${k.spouse.name}.`);
    tell(c, k, chronicleLast(c), 'good');
    if (mine) c.log.push(chronicleLast(c));
  }
  // The circle: who has gone, how each feels, and the empty places filled.
  const lands = landsOf(c, f), fared = lands > k.seen.lands ? KIN.won : lands < k.seen.lands ? KIN.lost : KIN.quiet;
  k.seen.lands = lands;
  k.circle = k.circle.filter((x) => {
    const t = c.territories[x.town];
    if (!t || t.owner !== f) { fallFrom(c, f, k, x, `${c.territories[x.town]?.name ?? 'their town'} is no longer theirs`); return false; }
    if (x.notable && !living(folkOf(c, t.id)).some((n) => n.name === x.name)) { fallFrom(c, f, k, x, 'is lost'); return false; }
    return true;
  });
  for (const x of k.circle) {
    const f2 = folkOf(c, x.town), raided = struck(c, x.town, ['raid', 'carried']), hungry = !!f2.hungry, sick = sickAt(c, x.town);
    x.loyalty = Math.max(0, Math.min(100, Math.round(x.loyalty + fared + (raided ? KIN.raided : 0) + (hungry ? KIN.hungry : 0) + (sick ? KIN.sick : 0))));
    x.feeling = x.loyalty < KIN.angry ? 'angry' : raided || hungry || sick ? 'afraid' : x.loyalty < KIN.uneasy ? 'grief' : 'content';
  }
  posts(c, f, k, seat);
  const had = new Set(k.circle.map((x) => x.name));
  fill(c, f, k);
  for (const x of k.circle) if (!had.has(x.name) && c.turn > 1) tell(c, k, `${x.name} of ${c.territories[x.town]?.name ?? ''} is now ${k.leader}'s ${POST_NAMES[x.post].toLowerCase()}.`, 'plain');
}

/** What each post does this season, by its holder's sway. */
function posts(c: Campaign, f: number, k: Kin, seat: number): void {
  const at = (p: Post): Close | undefined => k.circle.find((x) => x.post === p);
  const steward = at('steward');
  if (steward && seat >= 0) {
    const folk = folkOf(c, seat), q = sway(steward);
    const need = needOf(c, seat);
    if (q < 0 || folk.stores.food < need) folk.stores.food = Math.max(0, folk.stores.food + Math.round(q * KIN.steward * need));
  }
  const marshal = at('marshal'), army = c.armies.find((a) => a.owner === f && a.hero);
  if (marshal && army && rand(c, f, 61) < Math.abs(sway(marshal)) * KIN.marshal) army.vet = Math.max(0, Math.min(MAX_VETERAN, army.vet + Math.sign(sway(marshal))));
  const priest = at('priest');
  if (priest && seat >= 0 && rand(c, f, 63) < Math.abs(sway(priest)) * KIN.priest) swayTown(c, seat, Math.sign(sway(priest)));
  const right = at('right');
  if (right && sway(right) < -0.4 && right.town !== seat) swayTown(c, right.town, KIN.astray);
}
/** The leader's right hand stands in for them in this town: unrest there passes as if the leader were there. */
export function deputyAt(c: Campaign, f: number, tid: number): Close | undefined {
  const r = c.factions[f]?.kin?.circle.find((x) => x.post === 'right');
  return r && r.town === tid && sway(r) > 0 ? r : undefined;
}
/** How well a people is warned of plots against it: its confidant's sway (-1 to 1), 0 with none. For the intrigue to read. */
export const plotWarning = (c: Campaign, f: number): number => { const x = c.factions[f]?.kin?.circle.find((y) => y.post === 'confidant'); return x ? sway(x) : 0; };
/** The household's news since a season (for the season's report). */
export const householdNews = (c: Campaign, f: number, since: number): KinNews[] => (c.factions[f]?.kin?.news ?? []).filter((n) => n.turn > since);
const chronicleLast = (c: Campaign): string => c.chronicle![c.chronicle!.length - 1].text;
function fallFrom(c: Campaign, f: number, k: Kin, x: Close, why: string): void {
  const line = `${x.name}, ${f === 0 ? 'your' : `${k.leader}'s`} ${POST_NAMES[x.post].toLowerCase()}, ${why.startsWith('is') ? why : `has left: ${why}`}.`;
  tell(c, k, line, 'bad');
  if (f === 0) c.log.push(line);
}

/** A season for every living people's household and circle. */
export function kinSeasons(c: Campaign): void {
  for (const x of c.factions) kinSeason(c, x.id);
}
