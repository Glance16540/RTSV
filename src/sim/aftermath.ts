// What a story leaves behind (docs/DESIGN.md, "Relationships": what the leader decides, for better or for worse,
// moves people's moods). When a story inside the story ends (intrigue.ts, courtstory.ts), how it was settled may
// leave a mark that carries on for years, small and real, through systems already running: the moods of a town's
// nobles (nobles.ts, and through them its work, its drift and its watch), a town's own faith (townfaith.ts), a
// rival's goodwill and its readiness to come for the player (campaign.ts `favor`, `angry`), the leader's house.
//
//   A thief pardoned: the town warms to its leader for some years. A thief hanged who stole to eat, or was a
//     soldier's widow: the town sours.
//   A killer found: the town is easier for a while. An innocent hanged for a killing: the town is resentful
//     for years.
//   A rival king defied: a feud. His people bear the player no goodwill and come for the player first, for years.
//     A rival bought off: he comes back for the spouse when the price is spent.
//   A daughter wed: an alliance that can be called on, once. Her husband's people may send companies to the
//     player's army, or refuse; likelier the more goodwill there is.
//   A plotter pardoned: some seasons on they turn out the staunchest of the nobles, or plot again.
//
// Each mark is kept on the campaign with the town, noble or people it is about, and words for it, so that a
// town's panel, the roll and the season's report can show it. One call a season (from intrigue.ts).
import type { Campaign } from './campaign';
import { shiftVirtue } from './campaign';
import { MAX_ARMY, MAX_FAVOR, armyAt, armySize } from './campaignbase';
import { courtOf } from './court';
import { beginPlot, beginRival } from './courtstory';
import { Intrigue, IntrigueKind, Person, chance, fullName } from './intrigue';
import { spouseOf } from './kin';
import { noblesOf } from './nobles';

export type MarkKind = 'warmed' | 'soured' | 'eased' | 'resentful' | 'feud' | 'bought' | 'alliance' | 'pardoned';
export interface Mark {
  id: number; kind: MarkKind; from: IntrigueKind; story: number; owner: number; since: number; until: number;
  /** The town it lies on, the rival people it is with, the noble it is about (their key in nobles.ts). */
  at?: number; rival?: number; noble?: string;
  /** Who it is about, by name. */
  name?: string;
  /** What is remembered, in words. */
  text: string;
  /** An alliance that has been called on. A pardoned plotter: what they will turn out, not for showing until they have. */
  used?: boolean; fate?: 'loyal' | 'again'; shown?: boolean;
}
declare module './campaign' {
  interface Campaign { /** What stories have left behind (aftermath.ts). */ marks?: Mark[]; markSeq?: number }
}

export const AFTER = {
  /** A town's marks: how long each lasts in seasons, what it adds to the mood of each noble of the town a season, and to the town's faith every other season. */
  warmed: { seasons: 12, mood: 4, faith: 1 },
  soured: { seasons: 12, mood: -5, faith: -1 },
  eased: { seasons: 6, mood: 3, faith: 0 },
  resentful: { seasons: 20, mood: -6, faith: -1 },
  /** A feud: its length, and the goodwill the rival is held at or below. */
  feud: { seasons: 16, favor: -1 },
  /** Bought off: seasons until he comes back (the least, and how many more it may be). */
  bought: { back: 8, within: 5 },
  /** An alliance: how long it can be called on; the chance they send men, more for each point of goodwill; and the companies they send. */
  alliance: { seasons: 40, send: 0.5, favor: 0.15, companies: 2 },
  /** A pardoned plotter: seasons until it is seen what they have become (the least, and how many more); the chance it is loyalty; the mood they are then held at or above, and for how long. */
  pardoned: { after: 5, within: 5, loyal: 0.55, mood: 50, seasons: 20 },
  /** Marks kept on record after they have run out. */
  kept: 40,
};

const land = (c: Campaign, at: number): string => c.territories[at]?.name ?? 'the town';
const people = (c: Campaign, f: number): string => c.factions[f]?.name ?? 'another people';
function add(c: Campaign, it: Intrigue, kind: MarkKind, seasons: number, text: string, more: Partial<Mark> = {}): Mark {
  const m: Mark = { id: (c.markSeq = (c.markSeq ?? 0) + 1), kind, from: it.kind, story: it.id, owner: it.owner, since: c.turn, until: c.turn + seasons, text, ...more };
  const all = (c.marks ??= []);
  all.push(m);
  const old = all.filter((x) => x.until < c.turn);
  if (old.length > AFTER.kept) all.splice(all.indexOf(old[0]), 1);
  return m;
}
function tell(c: Campaign, m: Mark, tone: 'good' | 'bad' | 'plain', text: string): void {
  (c.intrigueNews ??= []).push({ turn: c.turn, id: m.story, kind: m.from, at: m.at ?? courtOf(c, m.owner)?.at ?? 0, owner: m.owner, tone, text });
  if (m.owner === 0) c.log.push(text);
}

/** The marks still running: on a town, with a rival people, about a noble; and every mark of a people's, run out or not. */
export const live = (c: Campaign, m: Mark): boolean => m.until >= c.turn;
export const marksAt = (c: Campaign, at: number): Mark[] => (c.marks ?? []).filter((m) => m.at === at && live(c, m) && (m.kind !== 'pardoned' || m.shown));
export const marksWith = (c: Campaign, rival: number, f = 0): Mark[] => (c.marks ?? []).filter((m) => m.rival === rival && m.owner === f && live(c, m));
export const marksOfNoble = (c: Campaign, key: string): Mark[] => (c.marks ?? []).filter((m) => m.noble === key && live(c, m) && (m.kind !== 'pardoned' || m.shown));
export const marksOf = (c: Campaign, f = 0): Mark[] => (c.marks ?? []).filter((m) => m.owner === f);

/** A story has ended: what it leaves behind, if anything. Called by intrigue.ts as it closes one. */
export function remember(c: Campaign, it: Intrigue): Mark | undefined {
  const how = it.ended?.how, A = AFTER, where = land(c, it.at);
  if (it.kind === 'thief' && it.thief) {
    const n = fullName(it.thief);
    if (how === 'pardoned' && !it.again) return add(c, it, 'warmed', A.warmed.seasons, `${where} remembers that ${n} was pardoned.`, { at: it.at, name: n });
    if (how === 'hanged' && (it.why === 'hunger' || it.why === 'widow')) return add(c, it, 'soured', A.soured.seasons, `${where} remembers that ${n} was hanged, ${it.why === 'hunger' ? 'who stole to eat' : 'a soldier\'s widow'}.`, { at: it.at, name: n });
  }
  if (it.kind === 'killer' && how === 'hanged' && !(it.wronged?.length)) return add(c, it, 'eased', A.eased.seasons, `${where} sleeps easier since its killer was found.`, { at: it.at });
  if (it.kind === 'rival' && it.rival !== undefined) {
    const king = it.cast?.king ?? 'the rival';
    if (how === 'foiled' || how === 'wounded' || how === 'slain') return add(c, it, 'feud', A.feud.seasons, `${king} of the ${people(c, it.rival)} was defied, and has not forgiven it.`, { rival: it.rival, name: king });
    if (how === 'bought') return add(c, it, 'bought', A.bought.back + Math.floor(chance(c, it.id * 101 + 1) * A.bought.within), `${king} of the ${people(c, it.rival)} was paid to forget ${it.cast?.spouse}.`, { rival: it.rival, name: king });
  }
  if (it.kind === 'suitor' && how === 'wed' && it.rival !== undefined) return add(c, it, 'alliance', A.alliance.seasons, `${it.cast?.daughter} is married into the house of ${it.cast?.king} of the ${people(c, it.rival)}: they may be called on, once.`, { rival: it.rival, name: it.cast?.daughter });
  if (it.kind === 'plot' && how === 'pardoned' && it.nobles) {
    const p = it.nobles[it.culprit];
    return add(c, it, 'pardoned', A.pardoned.after + Math.floor(chance(c, it.id * 101 + 2) * A.pardoned.within) + A.pardoned.seasons, `${p.title} plotted and was pardoned.`,
      { noble: p.key, name: p.title, fate: chance(c, it.id * 101 + 3) < A.pardoned.loyal ? 'loyal' : 'again' });
  }
  return undefined;
}
/** An innocent was hanged for a killing: the town does not forget it. Called by intrigue.ts when it happens. */
export function rememberWronged(c: Campaign, it: Intrigue, p: Person): Mark {
  return add(c, it, 'resentful', AFTER.resentful.seasons, `${land(c, it.at)} remembers that ${fullName(p)} was hanged for killings ${p.gender === 'f' ? 'she' : 'he'} did not do.`, { at: it.at, name: fullName(p) });
}

/** An alliance by marriage that can be called on now: with whom, and the mark. */
export const callable = (c: Campaign, f = 0): Mark[] => (c.marks ?? []).filter((m) => m.kind === 'alliance' && m.owner === f && !m.used && live(c, m) && m.rival !== undefined && !!c.factions[m.rival]?.alive);
/**
 * Call on an alliance by marriage. It can be asked once: they send companies to the leader's army, or refuse.
 * Returns what they did, or null if there was nothing to call on.
 */
export function callOn(c: Campaign, markId: number): 'sent' | 'refused' | null {
  const m = callable(c, 0).find((x) => x.id === markId), A = AFTER.alliance;
  if (!m || m.rival === undefined) return null;
  const r = c.factions[m.rival];
  m.used = true;
  if (chance(c, m.id * 103 + 1) >= A.send + A.favor * (r.favor ?? 0)) {
    m.text = `${m.name}'s husband's people, the ${r.name}, were called on and did not come.`;
    tell(c, m, 'bad', `You called on the ${r.name}, your daughter ${m.name}'s people by marriage. They sent their regrets and no men.`);
    return 'refused';
  }
  const seat = courtOf(c, 0)?.at ?? c.territories.find((t) => t.owner === 0)?.id ?? -1;
  const home = c.territories[seat]?.owner === 0 ? seat : c.territories.find((t) => t.owner === 0)?.id ?? -1;
  if (home < 0) return null;
  const a = armyAt(c, home);
  if (a && a.owner === 0) a.units.infantry = (a.units.infantry ?? 0) + Math.max(0, Math.min(A.companies, MAX_ARMY - armySize(a)));
  else if (!a) c.armies.push({ id: c.nextArmy++, owner: 0, at: home, units: { infantry: A.companies }, hero: false, vet: 0, moved: true });
  m.text = `${m.name}'s husband's people, the ${r.name}, were called on and sent men.`;
  tell(c, m, 'good', `You called on the ${r.name}, your daughter ${m.name}'s people by marriage, and ${A.companies} companies of their men have come to ${land(c, home)}.`);
  return 'sent';
}

/** A season of what stories left behind. */
export function aftermathSeason(c: Campaign): void {
  const A = AFTER;
  for (const m of [...(c.marks ?? [])]) {
    if (m.kind === 'bought') {
      // He comes back when the price is spent, if there is still anyone to come back for.
      if (m.used || c.turn < m.until) continue;
      const busy = (c.intrigues ?? []).some((x) => !x.ended && (x.kind === 'rival' || x.kind === 'suitor' || x.kind === 'plot'));
      if (busy) { m.until = c.turn + 1; continue; }
      m.used = true;
      if (m.rival !== undefined && c.factions[m.rival]?.alive && c.factions[0]?.heroAlive && spouseOf(c, 0)) { tell(c, m, 'bad', `${m.name} has spent what you sent him, and has not forgotten after all.`); beginRival(c, m.rival); }
      continue;
    }
    if (!live(c, m)) continue;
    if (m.kind === 'feud' && m.rival !== undefined) {
      const r = c.factions[m.rival];
      if (r?.alive) { r.favor = Math.max(-MAX_FAVOR, Math.min(r.favor ?? 0, A.feud.favor)); r.angry = true; }
      continue;
    }
    if (m.kind === 'pardoned') {
      const n = noblesOf(c, m.owner).find((x) => x.key === m.noble);
      if (!n) continue;
      if (!m.shown && c.turn >= m.until - A.pardoned.seasons) {
        m.shown = true;
        if (m.fate === 'loyal') { m.text = `${m.name}, who plotted and was pardoned, has become the staunchest of the nobles.`; tell(c, m, 'good', m.text); }
        else {
          m.text = `${m.name}, who plotted and was pardoned, plotted again.`; m.until = c.turn;
          const busy = (c.intrigues ?? []).some((x) => !x.ended && (x.kind === 'rival' || x.kind === 'suitor' || x.kind === 'plot'));
          if (busy) { m.shown = false; m.until = c.turn + 1 + A.pardoned.seasons; continue; }
          n.mood = Math.min(n.mood, -60);
          beginPlot(c, n.key);
        }
      }
      if (m.shown && m.fate === 'loyal') n.mood = Math.max(n.mood, A.pardoned.mood);
      continue;
    }
    if (m.at === undefined || m.kind === 'alliance') continue;
    // A town's mark: its nobles' moods, and its own faith.
    const t = c.territories[m.at];
    if (!t || t.owner !== m.owner) { m.until = c.turn - 1; continue; } // it is another people's town now, with other things to remember
    const by = A[m.kind as 'warmed' | 'soured' | 'eased' | 'resentful'];
    for (const n of noblesOf(c, m.owner)) if (n.town === m.at) n.mood = Math.max(-100, Math.min(100, n.mood + by.mood));
    if (by.faith && (c.turn - m.since) % 2 === 0) shiftVirtue(c, m.owner, by.faith, { at: m.at });
  }
}
