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
//   A plot. A noble who is angry (nobles.ts) means to take the leader's place. It begins as a whisper: a few nobles
//     are spoken of, and the leader does not know which. Each season something may come out that clears one of
//     them, likelier with a loyal confidant (kin.ts, plotWarning; a disloyal one hides it), with informers kept
//     (paid each season), or with the court in the plotter's town. The leader may accuse one (wrongly, and that
//     noble is made an enemy), or send gifts to all the nobles to sweeten them, which may end it. Once the plotter
//     is known the leader pardons them or has them put to death. If the plot ripens unfound there is a rising:
//     it is put down, or the leader is killed in it.
import type { Campaign } from './campaign';
import { shiftVirtue } from './townfaith';
import { MAX_FAVOR, atTruce, heroFor } from './campaignbase';
import { NAMES_M } from './data';
import { courtOf, leaderAt } from './court';
import { houseOf, ofAge, rulerName } from './dynasty';
import { kinOf, plotWarning, spouseOf } from './kin';
import { Noble, isAngry, newLord, noblesOf, titleOf } from './nobles';
import { folkOf, living } from './township';
import { canPayFor, payFor } from './prices';
import { Choice, Intrigue, begin, chance, end, note } from './intriguebase';

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
    /** What the confidant's warning adds at its fullest (kin.ts, plotWarning, -1 to 1): a disloyal one takes as much away. */
    warned: 0.15,
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
  plot: {
    /** The chance a season while a noble of the player's is angry; the most nobles spoken of. */
    chance: 0.06, spoken: 4,
    /** The chance a season that something comes out; what a loyal confidant adds at the fullest, informers, and the court in the plotter's town. */
    out: 0.2, warned: 0.25, informers: 0.25, informersCost: 1, court: 0.15,
    /** Accused wrongly: how far that noble's mood falls. Gifts: their cost in supplies and what they add to every noble's mood. */
    wronged: -40, gifts: 4, sweeten: 15,
    /** A plotter whose mood has come back above this gives it up. */
    cooled: -20,
    /** Seasons until it ripens into a rising; the chance the rising kills the leader, more for each other angry noble, less with a loyal marshal or right hand. */
    ripe: 6, rising: 0.35, each: 0.1, loyal: 0.2,
    /** Pardon and death: piety, and what the other nobles make of it. */
    pardonVirtue: 4, pardonMood: 5, deathVirtue: -4, deathMood: -8,
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
const running = (c: Campaign): boolean => (c.intrigues ?? []).some((x) => (x.kind === 'rival' || x.kind === 'suitor' || x.kind === 'plot') && x.owner === 0 && (!x.ended || c.turn - x.ended.turn < COURT.rest));
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
  if (chance(c, 305) < COURT.plot.chance) { const it = beginPlot(c); if (it) return [it]; }
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
  const odds = R.foil + (it.watch ? R.guard : 0) + (loyal ? R.loyal : 0) + R.warned * plotWarning(c, 0);
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
  if (it.kind === 'plot') { plotStep(c, it); return; }
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
  if (it.kind === 'plot') return plotChoices(c, it);
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
  if (it.kind === 'plot') return plotChoose(c, it, choice);
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
  if (it.kind === 'plot') return plotStanding(it);
  const king = it.cast?.king ?? 'A rival';
  if (it.kind === 'rival') return it.stage === 0 ? `${king} of the ${people(c, it.rival!)} has sworn to have the leader's head and ${it.cast?.spouse} for ${their(queen(c, it))} own.`
    : it.stage === 1 ? `${king} demands ${it.cast?.spouse}, and waits for your answer until turn ${it.due}.`
    : `${king} has been defied, and is said to have sent a man with a knife.${it.watch ? ' A guard is kept.' : ''}`;
  return `${it.cast?.suitor} of the house of ${king} asks for your daughter ${it.cast?.daughter}, and waits until turn ${it.due}.${it.asked ? (it.willing ? ' She would have him.' : ' She would not have him.') : ''}`;
}

// ---- A noble plotting for the throne ----

const spoken = (it: Intrigue): number[] => (it.nobles ?? []).map((_, i) => i).filter((i) => !it.cleared.includes(i));
const nobleOf = (c: Campaign, it: Intrigue, i: number): Noble | undefined => noblesOf(c, 0).find((n) => n.key === it.nobles?.[i]?.key);
const informers = (c: Campaign, it: Intrigue): Choice => (it.watch ? { id: 'unwatch', label: 'Call the informers off' } : { id: 'watch', label: `Keep informers among the nobles (${COURT.plot.informersCost} supply a season)`, ...(canPayFor(c, 0, 'dealing', COURT.plot.informersCost) ? {} : { bar: 'You have not the supplies.' }) });

/** A plot begins: an angry noble of the player's means to take the leader's place, and a few are spoken of. For the season's chance, and for tests. */
export function beginPlot(c: Campaign, key?: string): Intrigue | null {
  const P = COURT.plot, all = noblesOf(c, 0), angry = all.filter(isAngry), seat = seatOf(c);
  const who = key ? all.find((n) => n.key === key) : angry[Math.floor(chance(c, 311) * angry.length)];
  if (!who || seat < 0 || all.length < 3) return null;
  const it = begin(c, 'plot', seat);
  // The others spoken of are the sourest of the rest: an angry noble is always a likely name.
  const others = all.filter((n) => n.key !== who.key).sort((a, b) => a.mood - b.mood || a.key.localeCompare(b.key)).slice(0, P.spoken - 1);
  const list = [who, ...others].sort((a, b) => a.key.localeCompare(b.key));
  it.nobles = list.map((n) => ({ key: n.key, name: n.name, title: titleOf(c, n), female: n.female }));
  it.culprit = list.indexOf(who); it.due = c.turn + P.ripe;
  note(c, it, 'bad', `It is whispered at court that one of the great means to take ${leader(c)}'s place. ${it.nobles.length} are spoken of: ${it.nobles.map((n) => n.title).join('; ')}.`);
  return it;
}
function laidBare(c: Campaign, it: Intrigue, how: string): void {
  const p = it.nobles![it.culprit];
  it.found = true; it.cleared = it.nobles!.map((_, i) => i).filter((i) => i !== it.culprit);
  note(c, it, 'good', `${how} It is ${p.title} who plots for ${leader(c)}'s place. ${p.female ? 'She' : 'He'} is held, and waits on your judgement.`);
}
/** The plotter is gone from the nation's great: put to death, or dead in their own rising. */
function remove(c: Campaign, n: Noble | undefined, how: string): void {
  if (!n) return;
  if (n.rank === 'close') { const k = kinOf(c, 0); k.circle = k.circle.filter((x) => !(x.name === n.name && x.post === n.post)); }
  const rec = living(folkOf(c, n.town)).find((x) => x.name === n.name);
  if (rec && n.rank !== 'lord') rec.lost = { turn: c.turn, how };
  n.mood = 0; // whoever holds the place after them has learned from it
  if (n.rank === 'lord') newLord(c, 0, n.town, n); // the town has a new lord, of another name (nobles.ts)
}
function plotStep(c: Campaign, it: Intrigue): void {
  const P = COURT.plot, fac = c.factions[0], p = it.nobles![it.culprit], n = nobleOf(c, it, it.culprit);
  if (!fac.alive || !fac.heroAlive) { end(c, it, 'outlived', `${p.title} plotted against a leader who is dead by other hands.`, 'plain'); return; }
  if (!n) { end(c, it, 'nothing', `The whispers at court have stopped: ${p.title}, who was spoken of, is no longer among the great.`, 'plain'); return; }
  if (it.found) return; // waits on judgement
  if (n.mood > P.cooled) { end(c, it, 'nothing', `The whispers at court came to nothing. Whoever was sour has been sweetened.`, 'good'); return; }
  const odds = P.out + P.warned * plotWarning(c, 0) + (it.watch ? P.informers : 0) + (leaderAt(c, 0, n.town) ? P.court : 0);
  if (chance(c, it.id * 97 + 1) < odds) {
    const left = spoken(it).filter((i) => i !== it.culprit);
    if (left.length <= 1) { laidBare(c, it, it.watch ? 'Your informers have it.' : plotWarning(c, 0) > 0 ? 'Your confidant has it.' : 'A letter has been found.'); return; }
    const i = left[Math.floor(chance(c, it.id * 97 + 2) * left.length)];
    it.cleared.push(i);
    it.clues.push({ turn: c.turn, clears: [i], text: `${it.nobles![i].title} has been watched, and is true.` });
    note(c, it, 'good', `${it.nobles![i].title} has been watched, and is true. ${spoken(it).length} are still spoken of.`);
  }
  if (c.turn < (it.due ?? 0)) return;
  // The plot is ripe: the rising.
  const angry = noblesOf(c, 0).filter((x) => isAngry(x) && x.key !== n.key).length;
  const loyal = kinOf(c, 0).circle.some((x) => (x.post === 'marshal' || x.post === 'right') && x.loyalty >= COURT.rival.loyalAt && x.name !== n.name);
  const where = c.territories[n.town]?.name ?? 'the court';
  if (chance(c, it.id * 97 + 3) < P.rising + P.each * angry - (loyal ? P.loyal : 0)) {
    fac.heroAlive = false; fac.heroRank = Math.max(0, (fac.heroRank ?? 0) - 1);
    remove(c, n, 'died in a rising of their own making');
    end(c, it, 'usurped', `${p.title} rose against ${leader(c)} with the men of ${where}, and ${leader(c)} was killed in it. ${p.female ? 'She' : 'He'} did not live to take the seat.`, 'bad');
    return;
  }
  remove(c, n, 'died in a rising of their own making');
  end(c, it, 'foiled', `${p.title} rose against ${leader(c)} with the men of ${where}, and was put down. Nobody had named ${p.female ? 'her' : 'him'} in time.`, 'plain');
}
function plotChoices(c: Campaign, it: Intrigue): Choice[] {
  const P = COURT.plot;
  if (it.found) { const p = it.nobles![it.culprit]; return [{ id: 'pardon', label: `Pardon ${p.name}` }, { id: 'death', label: `Have ${p.name} put to death` }]; }
  return [
    ...spoken(it).map((i): Choice => ({ id: `accuse:${i}`, label: `Accuse ${it.nobles![i].title}` })),
    { id: 'gifts', label: `Send gifts to all the nobles (${P.gifts} supplies)`, ...(canPayFor(c, 0, 'dealing', P.gifts) ? {} : { bar: 'You have not the supplies.' }) },
    informers(c, it),
  ];
}
function plotChoose(c: Campaign, it: Intrigue, choice: string): boolean {
  const P = COURT.plot, p = it.nobles![it.culprit], n = nobleOf(c, it, it.culprit);
  if (choice === 'watch') { it.watch = true; note(c, it, 'plain', 'Informers are set among the nobles.'); return true; }
  if (choice === 'unwatch') { it.watch = false; note(c, it, 'plain', 'The informers are called off.'); return true; }
  if (choice === 'gifts') {
    payFor(c, 0, 'dealing', P.gifts);
    it.sweetened = true;
    for (const x of noblesOf(c, 0)) x.mood = Math.min(100, x.mood + P.sweeten);
    note(c, it, 'plain', 'Gifts have gone out to every noble house. It may be enough.');
    return true;
  }
  if (choice.startsWith('accuse:')) {
    const i = Number(choice.split(':')[1]);
    if (i === it.culprit) { laidBare(c, it, 'You named the right one.'); return true; }
    const wrong = nobleOf(c, it, i);
    if (wrong) wrong.mood = Math.max(-100, wrong.mood + P.wronged);
    it.cleared.push(i);
    note(c, it, 'bad', `You accused ${it.nobles![i].title}, and nothing could be shown against ${it.nobles![i].female ? 'her' : 'him'}. ${it.nobles![i].female ? 'She' : 'He'} will not forget it.`);
    if (spoken(it).length === 1) laidBare(c, it, 'Only one is left.');
    return true;
  }
  if (choice === 'pardon') {
    if (n) n.mood = 10;
    for (const x of noblesOf(c, 0)) if (x !== n) x.mood = Math.min(100, x.mood + P.pardonMood);
    shiftVirtue(c, 0, P.pardonVirtue);
    end(c, it, 'pardoned', `${p.title} plotted for ${leader(c)}'s place, was found out, and was pardoned before the court.`, 'good');
    return true;
  }
  if (choice === 'death') {
    remove(c, n, 'was put to death for plotting against the leader');
    for (const x of noblesOf(c, 0)) if (x !== n) x.mood = Math.max(-100, x.mood + P.deathMood);
    shiftVirtue(c, 0, P.deathVirtue);
    end(c, it, 'executed', `${p.title} plotted for ${leader(c)}'s place, was found out, and was put to death. The other great houses took note.`, 'plain');
    return true;
  }
  return false;
}
function plotStanding(it: Intrigue): string {
  if (it.found) return `${it.nobles![it.culprit].title} plotted for the leader's place, and is held for your judgement.`;
  const left = spoken(it);
  return `One of the great plots for the leader's place. ${left.length} are spoken of.${it.watch ? ' Informers are kept.' : ''} It is thought to be ripe by turn ${it.due}.`;
}
