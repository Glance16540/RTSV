// Stories of the leader's own house (docs/DESIGN.md, "Relationships"): two of the stories inside the story, which
// turn on the leader's household as kin.ts and dynasty.ts keep it. They use the plumbing of intrigue.ts and are
// run, chosen and reported through it: nothing else needs to call this.
//
//   A rival king. A rival ruler wants the leader dead and their husband or wife for their own. It comes by chance
//     while the leader has a living spouse and a rival people is neither ally nor at truce, likelier the less
//     goodwill there is between them. First a threat; two seasons on, a demand, which the leader must answer:
//     defy it, buy the rival off (which may or may not hold), or send the spouse over the border for a truce, at
//     a great cost in piety and in the loyalty of those closest. Defied, the rival sends a knife: some seasons on
//     an assassin comes for the leader. A guard kept about the leader (paid each season), and a loyal marshal or
//     right hand, make it likelier the knife is taken at the door; if it is not, the leader is wounded or killed.
//     Nothing is told of the spouse once they are over the border.
//   A suitor. A son of a rival's ruling house asks for a grown daughter of the leader (never one under age). The
//     leader may first ask her what she wants; then give her (a truce and goodwill with that people, and she is
//     no longer of the house: she cannot follow the leader), decline with gifts, or send him off with an insult,
//     which costs all goodwill with his people. Given against her will, it costs piety and loyalty. Left without
//     an answer, he takes it as an insult.
//
// The third (a noble plotting for the throne) waits for the nobles.
import type { Campaign } from './campaign';
import { MAX_FAVOR, atTruce, heroFor, shiftVirtue } from './campaign';
import { NAMES_M } from './data';
import { courtOf } from './court';
import { houseOf, ofAge, rulerName } from './dynasty';
import { kinOf, spouseOf } from './kin';
import { canPayFor, payFor } from './prices';
import { Choice, Intrigue, begin, chance, end, note } from './intrigue';

export const COURT = {
  /** No story of the house before this season; one at a time; this long between them. */
  from: 12, rest: 16,
  rival: {
    /** The chance a season, for a people with no goodwill; each point of goodwill halves it. */
    chance: 0.02,
    /** Seasons from the threat to the demand, and seasons the leader has to answer before silence is taken as defiance. */
    demand: 2, answer: 2,
    /** Buying him off: the price in supplies, and the chance it holds. */
    price: 6, holds: 0.5,
    /** Sending the spouse: seasons of truce, and what it costs in piety and in the loyalty of each of the circle. */
    truce: 8, yieldVirtue: -15, yieldLoyalty: -12,
    /** Defying him: piety, and loyalty. */
    defyVirtue: 3, defyLoyalty: 4,
    /** The knife comes this many seasons after (the least, and how many more it may be). */
    knife: 1, within: 3,
    /** The chance it is foiled; what a guard adds, and its cost a season in supplies; what a loyal marshal or right hand adds. */
    foil: 0.35, guard: 0.35, guardCost: 1, loyal: 0.15, loyalAt: 60,
    /** Unfoiled, the chance the leader dies of it rather than is wounded. */
    slain: 0.2,
  },
  suitor: {
    chance: 0.04,
    /** Seasons the suitor waits for an answer. */
    answer: 3,
    /** The chance the daughter is willing. */
    willing: 0.55,
    /** Given: seasons of truce and goodwill gained; given against her will, piety and loyalty lost. */
    truce: 10, favor: 2, unwillingVirtue: -8, unwillingLoyalty: -6, willingVirtue: 2,
    /** Declined with gifts: their cost in supplies. Spurned: piety. */
    gifts: 3, spurnVirtue: -2,
  },
};

const their = (female: boolean): string => (female ? 'her' : 'his');
const they = (female: boolean): string => (female ? 'she' : 'he');
const mate = (female: boolean): string => (female ? 'wife' : 'husband');
const leader = (c: Campaign): string => heroFor(c, 0).name;
const seatOf = (c: Campaign): number => courtOf(c, 0)?.at ?? c.territories.find((t) => t.owner === 0)?.id ?? -1;
/** Is the rival ruler of a story a woman? The words follow. */
const queen = (c: Campaign, it: Intrigue): boolean => !!heroFor(c, it.rival ?? 0).female;
const people = (c: Campaign, f: number): string => c.factions[f]?.name ?? 'another people';
const loyalty = (c: Campaign, by: number): void => { for (const x of kinOf(c, 0).circle) x.loyalty = Math.max(0, Math.min(100, x.loyalty + by)); };
const truce = (c: Campaign, f: number, turns: number): void => { c.truces = c.truces.filter((t) => t.with !== f).concat({ with: f, until: c.turn + turns }); };
/** The rival peoples a story could come from: living, led by the computer, and not the player's ally. */
const rivals = (c: Campaign): number[] => c.factions.filter((f) => f.id > 0 && f.alive && f.isAI && c.ally !== f.id).map((f) => f.id);
const running = (c: Campaign): boolean => (c.intrigues ?? []).some((x) => (x.kind === 'rival' || x.kind === 'suitor') && x.owner === 0 && (!x.ended || c.turn - x.ended.turn < COURT.rest));
/** A grown daughter of the leader's house, if there is one. Never a child. */
export const daughterOfAge = (c: Campaign): { name: string } | undefined => houseOf(c, 0).heirs.find((h) => h.female && ofAge(c, h));

/** A rival king begins on the leader: the threat is made. For the season's chance, and for tests. */
export function beginRival(c: Campaign, rival: number): Intrigue | null {
  const s = spouseOf(c, 0), seat = seatOf(c);
  if (!s || seat < 0 || !c.factions[rival]?.alive) return null;
  const it = begin(c, 'rival', seat), king = rulerName(c, rival), kf = !!heroFor(c, rival).female;
  it.rival = rival; it.stage = 0; it.due = c.turn + COURT.rival.demand; it.cast = { spouse: s.name, king };
  c.factions[rival].favor = 0;
  note(c, it, 'bad', `${king} of the ${people(c, rival)} has sent word: ${they(kf)} will have ${leader(c)}'s head, and ${s.name}, your ${mate(s.female)}, for ${their(kf)} own.`);
  return it;
}
/** A suitor comes for a grown daughter of the leader. For the season's chance, and for tests. */
export function beginSuitor(c: Campaign, rival: number): Intrigue | null {
  const d = daughterOfAge(c), seat = seatOf(c);
  if (!d || seat < 0 || !c.factions[rival]?.alive) return null;
  const it = begin(c, 'suitor', seat), king = rulerName(c, rival);
  const suitor = NAMES_M[Math.floor(chance(c, it.id * 83 + 1) * NAMES_M.length)];
  it.rival = rival; it.stage = 0; it.due = c.turn + COURT.suitor.answer; it.cast = { daughter: d.name, suitor, king };
  it.willing = chance(c, it.id * 83 + 2) < COURT.suitor.willing;
  note(c, it, 'plain', `${suitor}, a son of the house of ${king} of the ${people(c, rival)}, has come to ask for your daughter ${d.name}. He waits on your answer.`);
  return it;
}

/** With a chance, a story of the house begins. Only the player's house has them yet. */
export function courtBegin(c: Campaign): Intrigue[] {
  const R = COURT.rival, S = COURT.suitor, out: Intrigue[] = [];
  if (c.turn < COURT.from || !c.factions[0]?.alive || !c.factions[0].heroAlive || running(c)) return out;
  const rs = rivals(c);
  if (!rs.length) return out;
  const cold = rs.filter((f) => !atTruce(c, 0, f));
  if (spouseOf(c, 0) && cold.length) {
    const f = cold[Math.floor(chance(c, 301) * cold.length)];
    if (chance(c, 302) < R.chance / 2 ** (c.factions[f].favor ?? 0)) { const it = beginRival(c, f); if (it) return [it]; }
  }
  if (daughterOfAge(c) && chance(c, 303) < S.chance) { const it = beginSuitor(c, rs[Math.floor(chance(c, 304) * rs.length)]); if (it) out.push(it); }
  return out;
}

function knife(c: Campaign, it: Intrigue): void {
  const R = COURT.rival, fac = c.factions[0], king = it.cast?.king ?? 'the rival king', k = kinOf(c, 0);
  const loyal = k.circle.find((x) => (x.post === 'marshal' || x.post === 'right') && x.loyalty >= R.loyalAt);
  const odds = R.foil + (it.watch ? R.guard : 0) + (loyal ? R.loyal : 0);
  const where = c.territories[seatOf(c)]?.name ?? 'the court', who = leader(c);
  if (chance(c, it.id * 89 + 1) < odds) {
    end(c, it, 'foiled', `A man with a knife was taken at ${who}'s door in ${where}${it.watch ? ' by the guard' : loyal ? ` by ${loyal.name}` : ''}. He was sent by ${king}. ${who} lives, ${it.cast?.spouse ?? 'the household'} is safe, and every court will hear whose man he was.`, 'good');
    return;
  }
  if (chance(c, it.id * 89 + 2) < R.slain) {
    fac.heroAlive = false; fac.heroRank = Math.max(0, (fac.heroRank ?? 0) - 1);
    end(c, it, 'slain', `${who} was killed in ${where} by a man sent by ${king} of the ${people(c, it.rival!)}. Nobody stopped him in time.`, 'bad');
    return;
  }
  fac.heroRank = Math.max(0, (fac.heroRank ?? 0) - 1);
  end(c, it, 'wounded', `A man sent by ${king} reached ${who} in ${where} with a knife. ${who} lives, and will carry the mark of it.`, 'bad');
}
function defy(c: Campaign, it: Intrigue, silent = false): void {
  const R = COURT.rival;
  it.stage = 2; it.due = c.turn + R.knife + Math.floor(chance(c, it.id * 89 + 3) * R.within);
  if (!silent) { shiftVirtue(c, 0, R.defyVirtue); loyalty(c, R.defyLoyalty); }
  note(c, it, 'bad', silent
    ? `${it.cast?.king} has had no answer, and takes that for one. It is said ${they(queen(c, it))} has sent a man.`
    : `${it.cast?.king} has ${leader(c)}'s answer: ${it.cast?.spouse} stays. It is said ${they(queen(c, it))} has sent a man.`);
}

/** A season for one story of the house. */
export function courtStep(c: Campaign, it: Intrigue): void {
  const fac = c.factions[0], r = c.factions[it.rival ?? -1], king = it.cast?.king ?? 'The rival';
  if (seatOf(c) >= 0) it.at = seatOf(c); // the story is wherever the court is
  if (it.watch) { if (canPayFor(c, 0, 'dealing', COURT.rival.guardCost)) { payFor(c, 0, 'dealing', COURT.rival.guardCost); it.watched++; } else { it.watch = false; note(c, it, 'plain', 'The guard about the leader cannot be paid, and is stood down.'); } }
  if (!r?.alive) { end(c, it, 'outlived', it.kind === 'rival' ? `${king}, who wanted ${leader(c)} dead, has no people left to rule. The threat died with them.` : `${it.cast?.suitor}, who asked for ${it.cast?.daughter}, has no house left to offer her.`, 'good'); return; }
  if (!fac.alive || !fac.heroAlive) { end(c, it, 'outlived', it.kind === 'rival' ? `${king} wanted the leader dead, and the leader is dead by other hands.` : `${it.cast?.suitor} went home: there was nobody left to give him an answer.`, 'plain'); return; }
  if (it.kind === 'rival') {
    const s = spouseOf(c, 0);
    if (!s || s.name !== it.cast?.spouse) { end(c, it, 'outlived', `${it.cast?.spouse}, whom ${king} wanted, is gone, and the quarrel has nothing left to feed on.`, 'plain'); return; }
    if (it.stage === 0 && c.turn >= (it.due ?? 0)) {
      it.stage = 1; it.due = c.turn + COURT.rival.answer;
      note(c, it, 'bad', `${king} demands it: send ${s.name} over the border and there will be peace. ${queen(c, it) ? 'She' : 'He'} waits ${COURT.rival.answer} seasons for your answer.`);
    } else if (it.stage === 1 && c.turn >= (it.due ?? 0)) defy(c, it, true);
    else if (it.stage === 2 && c.turn >= (it.due ?? 0)) knife(c, it);
    return;
  }
  const d = daughterOfAge(c);
  if (!d || !houseOf(c, 0).heirs.some((h) => h.name === it.cast?.daughter)) { end(c, it, 'outlived', `${it.cast?.suitor} went home: ${it.cast?.daughter} is no longer of the house to be asked for.`, 'plain'); return; }
  if (c.turn >= (it.due ?? 0)) {
    r.favor = Math.max(0, (r.favor ?? 0) - 1);
    end(c, it, 'spurned', `${it.cast?.suitor} waited ${COURT.suitor.answer} seasons for an answer about ${it.cast?.daughter} and had none. He has gone home, and his house calls it an insult.`, 'bad');
  }
}

/** What the leader may do about a story of the house now. */
export function courtChoices(c: Campaign, it: Intrigue): Choice[] {
  const R = COURT.rival, S = COURT.suitor;
  if (it.kind === 'rival') {
    const guard: Choice = it.watch ? { id: 'unwatch', label: 'Stand the guard down' } : { id: 'watch', label: `Keep a guard about the leader (${R.guardCost} supply a season)`, ...(canPayFor(c, 0, 'dealing', R.guardCost) ? {} : { bar: 'You have not the supplies.' }) };
    if (it.stage !== 1) return [guard];
    return [
      { id: 'defy', label: `Defy ${queen(c, it) ? 'her' : 'him'}: ${it.cast?.spouse} stays` },
      { id: 'buy', label: `Buy ${queen(c, it) ? 'her' : 'him'} off (${R.price} supplies)`, ...(canPayFor(c, 0, 'dealing', R.price) ? {} : { bar: 'You have not the supplies.' }) },
      { id: 'yield', label: `Send ${it.cast?.spouse} over the border` },
      guard,
    ];
  }
  return [
    ...(it.asked ? [] : [{ id: 'ask', label: `Ask ${it.cast?.daughter} what she wants` }]),
    { id: 'give', label: `Give ${it.cast?.daughter} to ${it.cast?.suitor}` },
    { id: 'decline', label: `Decline, with gifts (${S.gifts} supplies)`, ...(canPayFor(c, 0, 'dealing', S.gifts) ? {} : { bar: 'You have not the supplies.' }) },
    { id: 'spurn', label: 'Send him off with an insult' },
  ];
}
/** The leader settles something in a story of the house. */
export function courtChoose(c: Campaign, it: Intrigue, choice: string): boolean {
  const ok = courtChoices(c, it).find((x) => x.id === choice), R = COURT.rival, S = COURT.suitor;
  if (!ok || ok.bar) return false;
  const r = c.factions[it.rival ?? -1], king = it.cast?.king ?? 'the rival';
  if (choice === 'watch') { it.watch = true; note(c, it, 'plain', 'A guard is kept about the leader, day and night.'); return true; }
  if (choice === 'unwatch') { it.watch = false; note(c, it, 'plain', 'The guard about the leader is stood down.'); return true; }
  if (it.kind === 'rival') {
    if (choice === 'defy') { defy(c, it); return true; }
    if (choice === 'buy') {
      payFor(c, 0, 'dealing', R.price);
      if (chance(c, it.id * 89 + 4) < R.holds) end(c, it, 'bought', `${king} took ${R.price} supplies to forget ${it.cast?.spouse}, and has kept to it so far.`, 'plain');
      else { note(c, it, 'bad', `${king} took the ${R.price} supplies and sent back that it was not what was asked for.`); defy(c, it, true); }
      return true;
    }
    if (choice === 'yield') {
      const k = kinOf(c, 0), s = k.spouse;
      if (s && !s.lost) { s.lost = { turn: c.turn, how: 'taken' }; k.alone = c.turn; }
      shiftVirtue(c, 0, R.yieldVirtue); loyalty(c, R.yieldLoyalty); truce(c, it.rival!, R.truce);
      end(c, it, 'yielded', `${leader(c)} sent ${it.cast?.spouse} over the border to ${king} of the ${people(c, it.rival!)}, and had peace for it. Nobody at court speaks of it.`, 'bad');
      return true;
    }
    return false;
  }
  const d = it.cast?.daughter ?? 'her', suitor = it.cast?.suitor ?? 'the suitor';
  if (choice === 'ask') {
    it.asked = true;
    note(c, it, 'plain', it.willing ? `${d} says she has seen ${suitor}, and would have him.` : `${d} says she would sooner stay unwed than go to ${suitor}'s people.`);
    return true;
  }
  if (choice === 'give') {
    const h = houseOf(c, 0);
    h.heirs = h.heirs.filter((x) => x.name !== d);
    truce(c, it.rival!, S.truce);
    if (r) r.favor = Math.min(MAX_FAVOR, (r.favor ?? 0) + S.favor);
    if (it.willing) shiftVirtue(c, 0, S.willingVirtue); else { shiftVirtue(c, 0, S.unwillingVirtue); loyalty(c, S.unwillingLoyalty); }
    end(c, it, 'wed', `${d}, daughter of ${leader(c)}, was married to ${suitor} of the house of ${king}${it.willing ? ', and went gladly' : ', and went because she was told to'}. The two peoples are at peace for it.`, it.willing ? 'good' : 'plain');
    return true;
  }
  if (choice === 'decline') {
    payFor(c, 0, 'dealing', S.gifts);
    end(c, it, 'refused', `${suitor} was sent home with gifts and without ${d}. His house took no offence.`, 'plain');
    return true;
  }
  if (choice === 'spurn') {
    if (r) r.favor = 0;
    shiftVirtue(c, 0, S.spurnVirtue);
    end(c, it, 'spurned', `${suitor}, who asked for ${d}, was laughed out of the hall. The house of ${king} will remember it.`, 'bad');
    return true;
  }
  return false;
}

/** One line on where a story of the house stands. */
export function courtStanding(c: Campaign, it: Intrigue): string {
  const king = it.cast?.king ?? 'A rival';
  if (it.kind === 'rival') return it.stage === 0 ? `${king} of the ${people(c, it.rival!)} has sworn to have the leader's head and ${it.cast?.spouse} for ${their(queen(c, it))} own.`
    : it.stage === 1 ? `${king} demands ${it.cast?.spouse}, and waits for your answer until turn ${it.due}.`
    : `${king} has been defied, and is said to have sent a man with a knife.${it.watch ? ' A guard is kept.' : ''}`;
  return `${it.cast?.suitor} of the house of ${king} asks for your daughter ${it.cast?.daughter}, and waits until turn ${it.due}.${it.asked ? (it.willing ? ' She would have him.' : ' She would not have him.') : ''}`;
}
