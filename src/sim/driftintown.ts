// Drift inside a town (docs/DESIGN.md, "Drift", step 5): who works where shifts under pressure in real time, in a
// campaign battle or a visit. The map's side of it (strain by season, who has drifted, decrees) is drift.ts and
// decrees.ts; this is the same people seen up close.
//
//  - The town turns out as the map left it: those of its women who had drifted to the tavern are at its tavern,
//    and those of its men who had gone to the mines are at the gold, from the first second.
//  - While the player watches, strain (hunger, a raid, made worse by low morale, grieving houses, sickness) sends
//    more the same way, one at a time; care (fed, safe, unbereaved, a church) brings them back, a tavern woman to
//    honest work or a miner off the gold, or sends someone to serve at the church. Each is said.
//  - A drifted villager is marked (`Unit.drifted`): the computer does not set them back to its own work. Drifted
//    is drifted until care brings them back (or the player orders them elsewhere).
//  - The town's decrees are felt here too: guards slow the drift, a shut tavern keeps its women at work, women
//    ordered into the tavern stay there, a call to church draws people to it the sooner, the church's tending makes
//    the sick and the grieving weigh the less (and plague wear the sick down the slower: tendintown.ts). Grain bought
//    abroad is already in the town's stores, which the battle fights out of.
//  - When the battle or visit ends, those marked at the tavern and the mine are the town's drifted from then on.
//
// A skirmish or a mission has none of this.
import { keptFromTavern } from './churchtavern';
import { feastCare } from './studiesintown';
import { feastHolds, feastLift, feastPull } from './feastfield';
import type { Building, Game, Player, Unit } from './game';
import type { Campaign } from './campaign';
import type { PeopleIn } from './township';
import type { DecreeKind } from './decrees';
import { MORALE_MAX_HOUSES, MORALE_PER_HOUSE } from './data';
import { want } from './famine';
import { griefShare } from './grief';
import { Drifted, driftedOf } from './drift';
import { CHURCH_CARE, GUARDS_EASE, TEND_EASE, decreesAt } from './decrees';
import { folkOf } from './township';

declare module './township' {
  interface PeopleIn {
    /** Who of the town had drifted on the map when it turned out (drift.ts), and the decrees it is under (decrees.ts). */
    drifted?: Drifted;
    decrees?: { kind: DecreeKind; strength: number }[];
  }
}
declare module './game' {
  interface Player {
    /** Who has drifted in this battle, and where to; and whether the town has turned out as the map left it. */
    drifted?: { tavern: number; mine: number; church: number; back: number };
    turnedOut?: boolean;
  }
  interface Unit { /** Gone from their work under strain: to the tavern or the gold. The computer leaves them be. */ drifted?: 'tavern' | 'mine' }
}

/** Weights of what strains a town (they add to at most 1). Low morale makes a raid weigh up to half as much again. */
export const STRAIN = { hunger: 0.35, raided: 0.25, grief: 0.2, sick: 0.2, morale: 0.5 };
/** The chance a second, at full strain, that someone drifts to worse; at full care, to better. */
export const DRIFT_RATE = 1 / 40;
export const HOLY_RATE = 1 / 90;

const clamp = (v: number): number => Math.max(0, Math.min(1, v));

/** The decrees a battle's town is under, by kind, at their strength. */
export function decreesHere(g: Game, owner: number): Partial<Record<DecreeKind, number>> {
  const out: Partial<Record<DecreeKind, number>> = {};
  for (const d of g.setups[owner]?.bonus?.people?.decrees ?? []) out[d.kind] = Math.max(out[d.kind] ?? 0, Math.max(0, Math.min(1, Number(d.strength) || 0)));
  return out;
}

/** How steady the town is: its Town Center's morale, as a share of the most homes can give. */
export function moraleOf(g: Game, p: Player): number {
  const tc = g.buildings.find((b) => b.owner === p.id && b.type === 'towncenter' && b.complete && !b.dead);
  return tc ? clamp(g.moraleAt(p.id, tc.x, tc.y) / (MORALE_MAX_HOUSES * MORALE_PER_HOUSE)) : 0;
}

/** How a people in a town stands: how strained (0 to 1) and how cared for (0 to 1, only with no strain). */
export function townStrain(g: Game, p: Player): { strain: number; care: number } {
  const w = want(p), hunger = w === 'famine' ? 1 : w === 'hungry' ? 0.6 : p.res.food < 50 ? 0.3 : 0;
  const raided = p.lastAttacked && g.time - p.lastAttacked.t < 60 ? 1 : 0;
  let people = 0, sick = 0;
  for (const u of g.units) if (u.owner === p.id && u.type === 'villager') { people++; if (u.plagueT > 0) sick++; }
  const sickShare = people ? clamp((3 * sick) / people) : 0, grief = griefShare(g, p.id);
  // A raid weighs more on a town whose homes do not steady it.
  const shaken = 1 + STRAIN.morale * (1 - moraleOf(g, p));
  // The church's tending (a decree) makes the sick and the grieving weigh the less, as on the map (tendintown.ts).
  const tended = 1 - TEND_EASE * (decreesHere(g, p.id).tend ?? 0);
  const strain = clamp(STRAIN.hunger * hunger + STRAIN.raided * raided * shaken + (STRAIN.grief * grief + STRAIN.sick * sickShare) * tended);
  const safe = !p.lastAttacked || g.time - p.lastAttacked.t > 180;
  const church = g.buildings.some((b) => b.owner === p.id && b.type === 'temple' && b.complete && !b.dead);
  const care = strain > 0 ? 0 : clamp((p.res.food > 300 ? 0.3 : 0) + (safe ? 0.3 : 0) + (grief === 0 ? 0.2 : 0) + (church ? 0.2 : 0));
  return { strain, care };
}

const roomIn = (b: Building | undefined): boolean => !!b && b.complete && !b.dead && (b.staff?.length ?? 0) < (b.def.staff ?? 0);
/** Someone out in the open, free to wander off: not called to arms, not freed, not a child, not drifted already. */
const loose = (u: Unit, owner: number): boolean => u.owner === owner && u.type === 'villager' && !u.dead && !u.inside && u.growT <= 0 && !u.freed && !u.enlisted && !u.drifted && u.order?.t !== 'enlist';
const isGold = (g: Game, u: Unit): boolean => u.order?.t === 'gather' && g.entities.get(u.order.id)?.type === 'gold';
const say = (g: Game, p: Player, text: string): void => { g.events.push({ t: 'msg', player: p.id, text }); };

/** Send a woman to the tavern. Returns her, if anyone went. */
function sendWoman(g: Game, p: Player): Unit | null {
  const tavern = g.buildings.find((b) => b.owner === p.id && b.type === 'tavern' && roomIn(b));
  const woman = tavern ? g.units.find((u) => loose(u, p.id) && u.gender === 'f') : undefined;
  if (!tavern || !woman) return null;
  g.cmdTarget(p.id, [woman.id], tavern.id);
  woman.drifted = 'tavern';
  return woman;
}
/** Send a man to the gold mine. Returns him, if anyone went. */
function sendMan(g: Game, p: Player): Unit | null {
  const man = g.units.find((u) => loose(u, p.id) && u.gender === 'm' && !isGold(g, u));
  const gold = man ? g.findResourceNear(man.x, man.y, 'gold', p.id, 30) : null;
  if (!man || !gold) return null;
  g.cmdTarget(p.id, [man.id], gold.id);
  man.drifted = 'mine';
  return man;
}

/** The town turns out as the map left it: its drifted women at the tavern, its drifted men at the gold. */
function turnOut(g: Game, p: Player): void {
  p.turnedOut = true;
  const d = g.setups[p.id]?.bonus?.people?.drifted;
  if (!d) return;
  for (let i = 0; i < Math.max(0, Math.round(d.tavern)); i++) if (!sendWoman(g, p)) break;
  for (let i = 0; i < Math.max(0, Math.round(d.mines)); i++) if (!sendMan(g, p)) break;
}

/** A second passes in a campaign town: someone may drift from their work, to worse or to better. */
export function driftSecond(g: Game): void {
  if (!g.bornOnly) return;
  for (const p of g.players) {
    if (p.neutral || p.defeated) continue;
    if (!p.turnedOut) turnOut(g, p);
    // A villager drifted to the tavern who is out of it again (sent home, or the tavern gone) is drifted no longer.
    for (const u of g.units) if (u.owner === p.id && u.drifted === 'tavern' && !u.inside && u.order?.t !== 'staff') u.drifted = undefined;
    const law = decreesHere(g, p.id), { strain, care: cared } = townStrain(g, p);
    const held = feastHolds(g, p), care = feastLift(g, p, cared); // a town's feast day holds its drift back (feastfield.ts)
    const d = (p.drifted ??= { tavern: 0, mine: 0, church: 0, back: 0 });
    if (strain > 0 && !held && g.rng() < strain * DRIFT_RATE * (1 - GUARDS_EASE * (law.guards ?? 0))) {
      if (!law.closeTavern && keptFromTavern(g, p.id)) continue; // a Church near the Tavern keeps her at her work (churchtavern.ts)
      const woman = law.closeTavern ? null : sendWoman(g, p);
      if (woman) { d.tavern++; say(g, p, `${woman.name} has left her work for the tavern.`); continue; }
      const man = sendMan(g, p);
      if (man) { d.mine++; say(g, p, `${man.name} has left his work for the gold mine.`); }
    } else if (care > 0 && g.rng() < care * HOLY_RATE * (1 + 2 * CHURCH_CARE * (law.church ?? 0)) * feastCare(g, p.id) * feastPull(g, p)) { // the more readily with Feast Days (studiesintown.ts)
      // Care brings them back: a woman out of the tavern (unless the women were ordered there), a man off the gold.
      const tavern = law.tavernWomen ? undefined : g.buildings.find((b) => b.owner === p.id && b.type === 'tavern' && (b.staff ?? []).some((id) => (g.entities.get(id) as Unit | undefined)?.drifted === 'tavern'));
      if (tavern && g.cmdUnstaff(p.id, tavern.id) > 0) { d.back++; say(g, p, 'One of the tavern\'s women has come back to honest work.'); continue; }
      const miner = g.units.find((u) => u.owner === p.id && u.drifted === 'mine' && !u.dead);
      if (miner) { miner.drifted = undefined; g.cmdStop(p.id, [miner.id]); d.back++; say(g, p, `${miner.name} has left the gold mine and come back to honest work.`); continue; }
      const church = g.buildings.find((b) => b.owner === p.id && b.type === 'temple' && roomIn(b));
      const who = church ? g.units.find((u) => loose(u, p.id) && !u.order) : undefined;
      if (church && who) { g.cmdTarget(p.id, [who.id], church.id); d.church++; say(g, p, `${who.name} has gone to serve at the church.`); }
    }
  }
}

/** Who of a people is drifted as the battle or visit ends: those marked at the tavern and at the gold. */
export function driftedIn(g: Game, owner: number): Drifted {
  let tavern = 0, mines = 0;
  for (const u of g.units) {
    if (u.owner !== owner || u.dead || u.type !== 'villager') continue;
    if (u.drifted === 'tavern' && u.gender === 'f') tavern++;
    if (u.drifted === 'mine' && u.gender === 'm') mines++;
  }
  return { tavern, mines };
}

/** The town's people as they turn out, with who of them had drifted on the map and the decrees they are under. */
export function withDrift<T extends { people: PeopleIn }>(c: Campaign, tid: number, muster: T): T {
  const d = driftedOf(c, tid), laws = decreesAt(c, tid).map((x) => ({ kind: x.kind, strength: x.strength }));
  return { ...muster, people: { ...muster.people, ...(d.tavern || d.mines ? { drifted: { ...d } } : {}), ...(laws.length ? { decrees: laws } : {}) } };
}

/** A battle or visit has ended: those at the tavern and the mine are the town's drifted from now on (no more than it has). */
export function driftBack(c: Campaign, tid: number, x: { tavern?: number; mines?: number } | undefined): void {
  const t = c.territories[tid];
  if (!t || !x) return;
  const f = folkOf(c, tid), whole = (v: unknown): number => Math.max(0, Math.round(Number(v) || 0));
  const d: Drifted = { tavern: Math.min(whole(x.tavern), f.women), mines: Math.min(whole(x.mines), f.men) };
  if (d.tavern || d.mines) f.drifted = d; else delete f.drifted;
}
