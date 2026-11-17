/**
 * A battle on the map that nobody watches, fought and not summed (docs/DESIGN.md: the world map is the game, and
 * a battle is the close view of one town in it).
 *
 * The map already weighs an attack and a defence (campaign.ts: `Pending.aStr`, `Pending.dStr`): the companies and
 * what they are good against, veterans, the leader, the Fortress, the country, the weather, the town's creed. It
 * used to settle the battle by setting one sum against the other, and the loser was gone to the last man. Here the
 * same weights are fought out, a round at a time, by what the two sides are:
 *
 *   - each kind of company strikes with its own strength, and harder against the kind it beats (`BEATS`), counted
 *     against the companies the other side still has standing that round;
 *   - what lands falls on the other side's companies by their weight, and more on a kind that is being beaten;
 *   - a town's own defence (its walls, towers and Fortress, its ground, its men on the walls) is its `works`: it
 *     strikes as weight does, takes its share of what lands, and so shelters the companies behind it;
 *   - a side breaks when it has lost so much of what it began with (`CLASH.breakAt`); veterans, a leader with the
 *     army, walls and a steadfast creed hold longer, a slack one gives sooner;
 *   - a side that breaks is ridden down as it goes (`CLASH.rout`), the more so by the victor's cavalry, and less
 *     by a defence that is only walls (`CLASH.shot`); left with too few to hold together, it scatters for home
 *     (`CLASH.scatter`);
 *   - if neither breaks in `CLASH.rounds`, the attack has failed and draws off in order.
 *
 * It comes out with what each side lost by kind and what it has left, who broke and in which round. A beaten
 * attacker keeps what is left where it marched from; a beaten garrison falls back on a land of its own next door,
 * if there is one, and is lost if there is not. The men of the companies lost are their towns' and their houses'
 * (armytown.ts counts the armies after every battle; warhouse.ts names them), and `accountOf` tells it in a few
 * lines: who led, what broke, who fell by name.
 *
 * `foresee` is the same fight on an even day, for whoever must judge a battle before it is fought: the computer's
 * peoples march by it (campaign.ts), so they misjudge only by the day's luck.
 *
 * Nothing here is drawn or timed: a fight is a few rounds of arithmetic, quick enough for a thousand campaigns.
 */
import type { Army, Campaign, Pending } from './campaign';
import { BEATS, COMPANIES, FAITH, MAX_ARMY, armyAt, armySize, rankWith, strengthVs, virtueOf } from './campaignbase';
import { creedOf } from './creed';
import { faithAt } from './townfaith';
import { wallsEdge } from './sieges';
import { armiesJoined, reckonArmies } from './armytown';
import { fallenSince } from './warhouse';
import { peopleName } from './naming';
import { rulerName } from './dynasty';

export const CLASH = {
  /** Rounds an attack is pressed before it draws off. */
  rounds: 8,
  /** Of a side's weight, the share that lands on the other in a round. */
  bite: 0.15,
  /** A kind strikes this much harder against the kind it beats, by that kind's share of the companies facing it. */
  counter: 0.3,
  /** And a kind being beaten takes this much more of what lands, by the share of the companies facing it that beat it. */
  exposed: 0.6,
  /** A side breaks when it has lost this share of the weight it began with. */
  breakAt: 0.5,
  /** Each battle an army has won, a leader with it, each rank of theirs, and walls to stand behind, hold it this much longer. */
  vet: 0.04, led: 0.05, rank: 0.01, walls: 0.1,
  /** Of how far a creed moves a town's defence (FAITH.defence), the share that is how long its people stand. */
  creed: 0.5,
  /** No side breaks before it has lost this share, or stands after losing that. */
  least: 0.25, most: 0.8,
  /** A side that breaks loses this share of what it has left as it goes, at the hands of an army as heavy as itself. */
  rout: 0.5,
  /** And this much more again for the share of the victor's companies that are cavalry. */
  ride: 0.5,
  /** A town's works count this much of their weight against men running from under them: walls ride nobody down, but they shoot. */
  shot: 0.5,
  /** A broken side left with less than this share of the companies it began with does not hold together: its men scatter for home. */
  scatter: 0.2,
  /** How much better or worse than its weight a side may be on the day. */
  day: 0.25,
};

/** One side of a battle, as plain data. */
export interface Force {
  /** Its companies by kind. A town with nobody but its own people on the walls has none. */
  units: Record<string, number>;
  /** All it is worth in this battle, as the map weighs it. */
  weight: number;
  /** Of that weight, what its companies and those who lead them are worth; the rest is the place itself (its works). All of it, if not given. */
  own?: number;
  /** Battles the army has won; whether a leader is with it, and their rank. */
  vet?: number; led?: boolean; rank?: number;
  /** How long its people stand, by their creed: 1 for a temperate people. */
  heart?: number;
  /** It stands behind walls. */
  walled?: boolean;
}
export interface SideOut {
  /** Companies it began with, lost and has left, by kind. */
  began: Record<string, number>; lost: Record<string, number>; left: Record<string, number>;
  /** The share of its starting weight it had lost when the fighting stopped, and the share at which it would break. */
  share: number; breakAt: number;
  /** Of a town's own defence, the share that was beaten down. */
  works: number;
  /** Broken, and too few left to hold together: what was left of it scattered for home. */
  scattered?: boolean;
}
export interface Outcome {
  attackerWon: boolean;
  /** Who broke: neither, if the attack drew off. And in which round it ended. */
  broke: 'attacker' | 'defender' | 'neither';
  rounds: number;
  a: SideOut; d: SideOut;
}

const KINDS = Object.keys(COMPANIES);
const count = (u: Record<string, number>): number => KINDS.reduce((n, k) => n + Math.max(0, u[k] ?? 0), 0);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** How long a side stands: the share of its weight it can lose before it breaks. */
export function breakOf(f: Force): number {
  const add = (f.vet ?? 0) * CLASH.vet + (f.led ? CLASH.led + (f.rank ?? 0) * CLASH.rank : 0) + (f.walled ? CLASH.walls : 0);
  return clamp((CLASH.breakAt + add) * (f.heart ?? 1), CLASH.least, CLASH.most);
}

/** One side as it fights: what each kind has left, in companies and parts of a company, and what is left of its works. */
interface Line { hp: Record<string, number>; scale: number; works: number; works0: number; start: number; breakAt: number }
const plain = (l: Line): number => KINDS.reduce((n, k) => n + l.hp[k] * COMPANIES[k].str, 0);
const whole = (l: Line): number => plain(l) * l.scale + l.works;
function line(f: Force): Line {
  const hp: Record<string, number> = {};
  for (const k of KINDS) hp[k] = Math.max(0, f.units[k] ?? 0);
  const l: Line = { hp, scale: 1, works: 0, works0: 0, start: 0, breakAt: breakOf(f) };
  const body = plain(l), weight = Math.max(0, f.weight), own = body > 0 ? clamp(f.own ?? weight, 0, weight) : 0;
  l.scale = body > 0 ? own / body : 0; // leaders, veterans, the weather and the march are in every company's arm
  l.works = l.works0 = weight - own;
  l.start = weight;
  return l;
}
/** What a side strikes with this round: each kind harder against the kind it beats, by that kind's share of the companies facing it. */
function strike(me: Line, foe: Line): number {
  const facing = KINDS.reduce((n, k) => n + foe.hp[k], 0);
  let s = 0;
  for (const k of KINDS) s += me.hp[k] * COMPANIES[k].str * (1 + (facing > 0 ? (CLASH.counter * foe.hp[BEATS[k]]) / facing : 0));
  return s * me.scale + me.works;
}
/** What lands on a side: on its works and its companies by their weight, and more on a kind the other side beats. */
function suffer(me: Line, foe: Line, landed: number): void {
  const all = whole(me);
  if (all <= 0 || landed <= 0) return;
  const onWorks = Math.min(me.works, (landed * me.works) / all);
  me.works -= onWorks;
  const facing = KINDS.reduce((n, k) => n + foe.hp[k], 0);
  const beaters = (k: string): number => (facing > 0 ? KINDS.filter((x) => BEATS[x] === k).reduce((n, x) => n + foe.hp[x], 0) / facing : 0);
  const open: Record<string, number> = {};
  let sum = 0;
  for (const k of KINDS) { open[k] = me.hp[k] * COMPANIES[k].str * (1 + CLASH.exposed * beaters(k)); sum += open[k]; }
  if (sum <= 0 || me.scale <= 0) return;
  const onBody = (landed - onWorks) / me.scale; // in the plain strength of companies
  for (const k of KINDS) me.hp[k] = Math.max(0, me.hp[k] - (onBody * open[k]) / sum / COMPANIES[k].str);
}
const lostShare = (l: Line): number => (l.start > 0 ? 1 - whole(l) / l.start : 1);

/** What a line has left in whole companies. `keep`: a side that holds the field has one company at the least, if it began with any. */
function muster(f: Force, l: Line, keep: boolean): SideOut {
  const began: Record<string, number> = {}, lost: Record<string, number> = {}, left: Record<string, number> = {};
  for (const k of KINDS) {
    const n = Math.max(0, f.units[k] ?? 0);
    if (!n) continue;
    began[k] = n;
    const stay = Math.min(n, Math.round(l.hp[k]));
    if (stay) left[k] = stay;
    if (n - stay) lost[k] = n - stay;
  }
  if (keep && count(began) && !count(left)) {
    const k = KINDS.filter((x) => began[x]).sort((x, y) => l.hp[y] * COMPANIES[y].str - l.hp[x] * COMPANIES[x].str || KINDS.indexOf(x) - KINDS.indexOf(y))[0];
    left[k] = 1;
    if (--lost[k] <= 0) delete lost[k];
  }
  return { began, lost, left, share: Math.round(clamp(lostShare(l), 0, 1) * 1000) / 1000, breakAt: l.breakAt, works: l.works0 > 0 ? Math.round((1 - l.works / l.works0) * 1000) / 1000 : 0 };
}

/**
 * Fight it out. `luckA`, `luckD`: how each side is on the day, as a share of its weight (1: an even day).
 * The same forces and the same luck always come out the same.
 */
export function clash(a: Force, d: Force, luckA = 1, luckD = 1): Outcome {
  const A = line(a), D = line(d);
  let broke: Outcome['broke'] = 'neither', rounds = 0;
  if (A.start <= 0) broke = 'attacker';
  else if (D.start <= 0) broke = 'defender';
  while (broke === 'neither' && rounds < CLASH.rounds) {
    rounds++;
    const hitA = strike(A, D) * luckA * CLASH.bite, hitD = strike(D, A) * luckD * CLASH.bite; // both strike before either falls
    suffer(D, A, hitA);
    suffer(A, D, hitD);
    const overA = lostShare(A) - A.breakAt, overD = lostShare(D) - D.breakAt;
    if (overA >= 0 || overD >= 0) broke = overD >= 0 && overD > overA ? 'defender' : 'attacker'; // both at once: whoever is further gone; level, the attack fails
  }
  // Whoever breaks is ridden down as they go: by companies, and by horse above all. Walls ride nobody down, but they shoot.
  const chase = (victor: Line, beaten: Line): void => {
    const body = plain(victor) * victor.scale + victor.works * CLASH.shot, theirs = whole(beaten);
    if (body <= 0 || theirs <= 0) return;
    const horse = (victor.hp.cavalry ?? 0) / Math.max(1e-9, KINDS.reduce((n, k) => n + victor.hp[k], 0));
    const share = clamp(CLASH.rout * Math.min(1, body / theirs) * (1 + CLASH.ride * horse), 0, 0.9);
    for (const k of KINDS) beaten.hp[k] *= 1 - share;
  };
  if (broke === 'defender') chase(A, D);
  else if (broke === 'attacker') chase(D, A);
  const attackerWon = broke === 'defender';
  const out: Outcome = { attackerWon, broke, rounds, a: muster(a, A, attackerWon), d: muster(d, D, !attackerWon) };
  const beaten = broke === 'attacker' ? out.a : broke === 'defender' ? out.d : null;
  if (beaten && count(beaten.left) < count(beaten.began) * CLASH.scatter) { beaten.lost = { ...beaten.began }; beaten.left = {}; beaten.scattered = true; }
  return out;
}

/** The same fight on an even day: what whoever must judge it beforehand can know. */
export const foresee = (a: Force, d: Force): Outcome => clash(a, d, 1, 1);

/** The chance (0..1) that the attack carries, over what the day may bring to either side. */
export function chance(a: Force, d: Force, n = 9): number {
  let wins = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    if (clash(a, d, 1 - CLASH.day + (2 * CLASH.day * i) / (n - 1), 1 - CLASH.day + (2 * CLASH.day * j) / (n - 1)).attackerWon) wins++;
  return wins / (n * n);
}

// ---- The map's side of it ----

/** How long a people stand, by a standing between the holy and the worldly ends: half of what it does for a town's defence. */
export const heartOf = (virtue: number): number => 1 + (FAITH[creedOf(virtue).id].defence - 1) * CLASH.creed;

/**
 * The two sides of a battle on the map, read off the campaign. `aStr`, `dStr`: the attack and the defence as the
 * map weighs them (for a pending battle, the record's own); `home`: what the defender's own ground is worth.
 * The defender's companies are the army of the land's holder standing there; a tribe's warriors are its men.
 */
export function forcesOf(c: Campaign, army: Army, to: number, aStr: number, dStr: number, walls = 1): { a: Force; d: Force } {
  const t = c.territories[to], held = armyAt(c, to), def = held && held.owner === t.owner && t.owner >= 0 ? held : undefined;
  const a: Force = { units: army.units, weight: aStr, vet: army.vet, led: army.hero, rank: rankWith(c, army), heart: heartOf(virtueOf(c, army.owner)) };
  const weight = dStr * walls;
  const tribe = t.owner < 0;
  const d: Force = {
    units: def ? def.units : tribe ? { infantry: Math.max(1, Math.round(dStr)) } : {},
    weight,
    own: def ? Math.min(weight, strengthVs(def, army.units, rankWith(c, def))) : tribe ? weight : 0,
    vet: def?.vet, led: !!def?.hero, rank: def ? rankWith(c, def) : 0,
    heart: tribe ? 1 : heartOf(faithAt(c, to)),
    walled: walls > 1 || t.buildings.includes('fortress'),
  };
  return { a, d };
}

/** A pending battle fought out: the two luck draws are the day's (each 0..1, as the campaign's own dice give them). */
export function fightPending(c: Campaign, p: Pending, home: number, rollA: number, rollD: number): Outcome | null {
  const army = c.armies.find((x) => x.id === p.armyId);
  if (!army) return null;
  const { a, d } = forcesOf(c, army, p.to, p.aStr, p.dStr * home, wallsEdge(c, p));
  return clash(a, d, 1 - CLASH.day + 2 * CLASH.day * rollA, 1 - CLASH.day + 2 * CLASH.day * rollD);
}

/**
 * Would this army take that land on an even day? The same fight as `fightPending`, for whoever must choose where
 * to march: `aStr` and `dStr` as the chooser weighs them (its caution is in what it adds to the defence). One
 * thing it cannot know from outside: what walls with men on them are worth beyond their sum (sieges.ts,
 * `SIEGE.walls`). It sees the walls and counts them, and learns the rest at the foot of them.
 */
export function wouldTake(c: Campaign, army: Army, to: number, aStr: number, dStr: number): boolean {
  const { a, d } = forcesOf(c, army, to, aStr, dStr);
  return foresee(a, d).attackerWon;
}

/** Set an army to what a battle left of it. False if nothing is left: it is for the hub to strike it from the map. */
export function leftWith(a: Army, side: SideOut): boolean {
  for (const k of Object.keys(a.units)) delete a.units[k];
  for (const k of KINDS) if (side.left[k]) a.units[k] = side.left[k];
  return armySize(a) > 0;
}

/**
 * A garrison beaten out of its town falls back on a land of its own people next door: one with no army in it, or
 * with an army of theirs that has room. Its losses are counted first (armytown.ts), and then it joins that army,
 * company for company, its men going with their companies; what there is no room for stays behind and is lost.
 * False if it is gone from the map (nothing left, nowhere to go, or one army with the other now): it is for the
 * hub to strike it.
 */
export function fallBack(c: Campaign, a: Army, side: SideOut, from: number): boolean {
  if (!leftWith(a, side)) return false;
  const near = c.territories[from].adj.map((id) => c.territories[id]).filter((t) => t.owner === a.owner && !t.horde)
    .map((t) => ({ t, other: armyAt(c, t.id) })).filter((x) => !x.other || (x.other.owner === a.owner && armySize(x.other) < MAX_ARMY))
    .sort((x, y) => (x.other ? 1 : 0) - (y.other ? 1 : 0) || x.t.id - y.t.id)[0];
  if (!near) return false;
  a.moved = true;
  if (!near.other) { a.at = near.t.id; return true; }
  const other = near.other;
  reckonArmies(c); // those it lost in the town are counted before its men are shared out
  for (const k of KINDS) while ((a.units[k] ?? 0) > 0 && armySize(other) < MAX_ARMY) { a.units[k]--; other.units[k] = (other.units[k] ?? 0) + 1; }
  for (const k of Object.keys(a.units)) delete a.units[k];
  if (a.hero) { other.hero = true; a.hero = false; }
  other.vet = Math.max(other.vet, a.vet);
  armiesJoined(c, a, other);
  return false;
}

/** Men felled on each side, for whoever counts kills to the victor's houses: the companies lost, in men. */
export const felledOf = (out: Outcome, menACompany: number): { byAttacker: number; byDefender: number } =>
  ({ byAttacker: count(out.d.lost) * menACompany, byDefender: count(out.a.lost) * menACompany });

const words = (u: Record<string, number>): string => {
  const parts = KINDS.filter((k) => u[k]).map((k) => `${u[k]} of ${COMPANIES[k].name.toLowerCase()}`);
  return parts.length ? parts.join(', ') : 'none';
};
const nth = (n: number): string => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n - 1] ?? `${n}th`;
/** What a battle was, in a line or two: how long it was fought, who broke, and what each side lost by kind. */
export function accountOf(out: Outcome, attacker: string, defender: string, place: string): string {
  const lostA = count(out.a.lost), lostD = count(out.d.lost);
  const how = out.broke === 'defender' ? `${defender} broke in the ${nth(out.rounds)} round and ${place} was taken`
    : out.broke === 'attacker' ? `${attacker} broke in the ${nth(out.rounds)} round before ${place}`
    : `${attacker} could not break ${place} and drew off`;
  const gone = out.a.scattered ? ` What was left of ${attacker} scattered for home.` : out.d.scattered ? ` What was left of ${defender} scattered for home.` : '';
  const walls = out.d.works >= 0.5 ? ' Its defences were beaten down.' : '';
  return `${how}. ${attacker.charAt(0).toUpperCase() + attacker.slice(1)} lost ${lostA ? `companies: ${words(out.a.lost)}` : 'no company'}; ${defender} lost ${lostD ? `companies: ${words(out.d.lost)}` : 'no company'}.${gone}${walls}`;
}

/** A battle fought out on the map, as it is kept for whoever reads of it: the last few are on the campaign. */
export interface BattleTale {
  turn: number; at: number; attacker: number; defender: number; attackerWon: boolean;
  /** Who led each side, where a leader was with the army. */
  ledA?: string; ledD?: string;
  /** Companies lost by kind, and whether the beaten side scattered. */
  lostA: Record<string, number>; lostD: Record<string, number>; broke: Outcome['broke']; rounds: number;
  /** Those who fell, by name and house, of either side (warhouse.ts), a few at the most. */
  fell: string[];
  /** All of it in words. */
  text: string;
}
declare module './campaign' {
  interface Campaign {
    /** The last battles fought out on the map with nobody watching, newest last (mapbattle.ts). */
    tales?: BattleTale[];
  }
}
export const TALES = { kept: 12, named: 4 };
/** Who led each side: the leader riding with the army, or sitting in the town that was attacked (`seated`: court.ts knows). */
export function whoLed(c: Campaign, p: Pending, seated: boolean): { a?: string; d?: string } {
  const army = c.armies.find((x) => x.id === p.armyId), held = armyAt(c, p.to);
  const d = p.defender >= 0 && (seated || (held?.owner === p.defender && held.hero));
  return { ...(army?.hero && p.attacker >= 0 ? { a: rulerName(c, p.attacker) } : {}), ...(d ? { d: rulerName(c, p.defender) } : {}) };
}
const fallenKeys = (c: Campaign, f: number): string[] => (f < 0 ? [] : fallenSince(c, f, c.turn).map((x) => `${x.name} ${x.family}`));
/** Before a battle is settled: who of the two peoples has already fallen this season, so that this battle's dead can be told apart. */
export function fallenBefore(c: Campaign, p: Pending): string[][] { return [fallenKeys(c, p.attacker), fallenKeys(c, p.defender)]; }
/**
 * After a battle fought out on the map is settled and the armies are counted: tell it. Who led, what broke, what
 * each side lost by kind, and who fell by name. It goes in the log, and is kept on the campaign (`tales`).
 */
export function tellBattle(c: Campaign, p: Pending, out: Outcome, led: { a?: string; d?: string }, before: string[][] = [[], []]): BattleTale {
  const name = (f: number): string => (f < 0 ? 'the locals' : `the ${peopleName(c, f)}`);
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const fell: string[] = [];
  for (const [i, f] of [p.attacker, p.defender].entries()) {
    const was = [...(before[i] ?? [])];
    for (const k of fallenKeys(c, f)) { const j = was.indexOf(k); if (j >= 0) was.splice(j, 1); else fell.push(k); }
  }
  const place = c.territories[p.to].name;
  const leaders = [led.a ? `${led.a} led ${name(p.attacker)}` : '', led.d ? `${led.d} led ${name(p.defender)}` : ''].filter(Boolean).join(' and ');
  const named = fell.slice(0, TALES.named);
  const dead = named.length ? ` Among the fallen: ${named.join(', ')}${fell.length > named.length ? `, and ${fell.length - named.length} more` : ''}.` : '';
  const text = `${leaders ? `${cap(leaders)}. ` : ''}${cap(accountOf(out, name(p.attacker), name(p.defender), place))}${dead}`;
  const tale: BattleTale = { turn: c.turn, at: p.to, attacker: p.attacker, defender: p.defender, attackerWon: out.attackerWon, ...(led.a ? { ledA: led.a } : {}), ...(led.d ? { ledD: led.d } : {}), lostA: out.a.lost, lostD: out.d.lost, broke: out.broke, rounds: out.rounds, fell: named, text };
  (c.tales ??= []).push(tale);
  if (c.tales.length > TALES.kept) c.tales.splice(0, c.tales.length - TALES.kept);
  c.log.push(text);
  return tale;
}
