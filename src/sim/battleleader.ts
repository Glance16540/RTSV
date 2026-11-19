// The leader in a battle (docs/PORTING.md: out of the battle hub). Who a people's leader is, how what they have
// come into is fitted to the hero they are built on, the deeds that raise them through the ranks, the powers they
// learn as they rise, the call they raise over their people, and the soldier raised on the shields when they fall. The words and numbers are powers.ts and hero.ts;
// these are the rules that use them in a battle. Moved out of game.ts as they stood, with nothing changed.
//
// Game keeps a method of the same name for each (heroOf, leaderBonus, powerDue, cmdLearn, canCall, cmdCall,
// calledAt), so whoever asks a battle about its leader asks as before.
import { UNITS, UnitDef } from './data';
import type { Entity, Game, Unit } from './game';
import { CHAMPION_KILLS, Champion, canLead, championFemale, championName, championSpec, rankForKills } from './champion';
import { Calling, HeroSpec, RANK_NAMES, RANK_XP, heroBonus, rankOf } from './hero';
import { CALLS, CALL_LASTS, CALL_RANK, CALL_REST, POWERS, leaderAsMade, leaderDef, leaderType, powerDue as powerDueOf, powersHeld } from './powers';

/** The leader a player's nation follows: their own making of them, or the leader as written. */
export function heroOf(g: Game, owner: number): HeroSpec {
  const p = g.players[owner];
  return (p.hero ??= leaderAsMade(undefined, p.civ, p.isAI));
}
/** What a leader's making and veterancy add to their arm, armour and health. */
export function leaderBonus(g: Game, u: Unit): { atk: number; armor: number; hp: number } {
  return heroBonus(g.heroOf(u.owner), u.hero?.rank ?? 0);
}
export function fitLeader(g: Game, u: Unit): void {
  // The powers they have come into change the hero they are built on.
  u.def = leaderDef(UNITS[u.type], g.heroOf(u.owner), u.hero?.rank ?? 0);
  const max = Math.round(u.def.hp * g.leaderBonus(u).hp);
  u.hp = (u.hp / u.maxHp) * max;
  u.maxHp = max;
}

/** An enemy has fallen: if the leader was there to see it, it is set down among their deeds. */
export function deed(g: Game, owner: number, t: Entity): void {
  const l = g.leaders[owner];
  if (!l || l.dead || !l.hero || t.kind === 'resource' || !g.hostile(owner, t.owner) || (t.kind === 'unit' && t.def.cls === 'prey')) return;
  if (Math.hypot(l.x - t.x, l.y - t.y) > (l.def.auraRange ?? 0)) return;
  l.hero.xp += t.kind === 'unit' ? Math.max(1, t.def.pop) : 2;
  const rank = rankOf(l.hero.xp);
  if (rank > l.hero.rank) {
    l.hero.rank = g.players[owner].heroRank = rank;
    fitLeader(g, l);
    // A rival does not wait to be asked what it will learn; what was learnt is named after it has chosen.
    if (g.players[owner].isAI) while (g.powerDue(owner) >= 0) g.cmdLearn(owner, 0);
    const learnt = powersHeld(g.heroOf(owner), rank).length > powersHeld(g.heroOf(owner), rank - 1).length ? powersHeld(g.heroOf(owner), rank).at(-1) : null;
    g.msg(owner, `${l.name} is now ${RANK_NAMES[rank]}${learnt ? ` and has learnt ${learnt.name}` : g.powerDue(owner) >= 0 ? ': choose what they learn' : ''}.`);
  }
}
/** Which of their three powers a player's leader has earned and not yet chosen (-1: none). */
export function powerDue(g: Game, owner: number): number {
  const l = g.leaders[owner] ?? g.leaderOf(owner);
  return l && !l.dead && l.hero ? powerDueOf(g.heroOf(owner), l.hero.rank) : -1;
}
/** Choose which of the two powers the leader takes at the rank they have just earned. It is theirs from then on. */
export function cmdLearn(g: Game, owner: number, choice: number): boolean {
  const tier = g.powerDue(owner), l = g.leaders[owner] ?? g.leaderOf(owner);
  if (tier < 0 || !l || (choice !== 0 && choice !== 1)) return false;
  const h = g.heroOf(owner);
  h.powers = [0, 1, 2].map((t) => (t === tier ? choice : h.powers?.[t] ?? -1));
  fitLeader(g, l);
  if (!g.players[owner].isAI) g.msg(owner, `${l.name} has learnt ${POWERS[h.calling][tier][choice].name}.`);
  return true;
}

/** Can the leader raise their call now? They must be Seasoned, in the open, and rested since the last. */
export function canCall(g: Game, owner: number): boolean {
  const l = g.leaderOf(owner);
  return !!l && !l.inside && l.hero!.rank >= CALL_RANK && !(l.hero!.rest! > 0);
}
/** The leader raises their call: for a few seconds it tells on everyone of theirs within reach. */
export function cmdCall(g: Game, owner: number): boolean {
  if (!g.canCall(owner)) return false;
  const l = g.leaderOf(owner)!;
  l.hero!.call = CALL_LASTS;
  l.hero!.rest = CALL_REST;
  g.msg(owner, `${l.name}: ${CALLS[g.heroOf(owner).calling].name}!`);
  return true;
}
/** Whose call, if any, is sounding over g spot for g player's people: a Warlord's, a Strategist's or a Steward's. */
export function calledAt(g: Game, owner: number, x: number, y: number): Calling | null {
  const l = g.leaders[owner];
  if (!l || l.dead || !(l.hero!.call! > 0) || Math.hypot(l.x - x, l.y - y) > (l.def.auraRange ?? 0)) return null;
  return g.heroOf(owner).calling;
}

/** Could g soldier be raised to lead? Only when the leader has fallen and nobody has taken their place. */
export function canAcclaim(g: Game, owner: number, u: Unit): boolean {
  const p = g.players[owner];
  return !!p && !!p.heroFell && u.owner === owner && !u.dead && !u.hero && !u.merc && !u.inside && !u.captive && canLead(u.def.cls) &&
    (u.kills ?? 0) >= CHAMPION_KILLS && !g.units.some((o) => o.owner === owner && o.hero);
}
/** Raise a soldier on the shields: they are the leader now, fighting as they always have, with a rank for every three they have felled. */
export function cmdAcclaim(g: Game, owner: number, id: number): boolean {
  const u = g.entities.get(id);
  if (!u || u.kind !== 'unit' || !g.canAcclaim(owner, u)) return false;
  const p = g.players[owner], old = g.heroOf(owner).name;
  u.name ||= championName(u.id, u.people ?? g.players[u.owner]?.civ);
  p.hero = championSpec(u.name, !u.roll && championFemale(u.id), u.type); // a man of the army's roll is himself (soldiernames.ts)
  p.heroRank = rankForKills(u.kills ?? 0);
  p.acclaimed = true;
  u.hero = { xp: RANK_XP[p.heroRank], rank: p.heroRank };
  fitLeader(g, u);
  g.leaders[owner] = u;
  g.msg(owner, `${u.name} is raised on the shields to lead in ${old.replace(/ (II|III|IV|V|VI|VII|VIII|IX|X)$/, '')}'s place.`);
  return true;
}
/** The soldier of a player's with the most kills to their name, if any has made one. */
export function champion(g: Game, owner: number): Champion | null {
  let best: Unit | null = null;
  for (const u of g.units) if (u.owner === owner && !u.hero && !u.merc && canLead(u.def.cls) && (u.kills ?? 0) >= CHAMPION_KILLS && (!best || (u.kills ?? 0) > (best.kills ?? 0))) best = u;
  return best ? { name: best.name || championName(best.id, best.people ?? g.players[owner]?.civ), kills: best.kills ?? 0, unit: best.def.name, female: !best.roll && championFemale(best.id), type: best.type } : null;
}

/** The kind of unit a people's leader is, before their people's own way of training is applied. */
export const leaderTypeOf = (g: Game, owner: number): string => leaderType(g.heroOf(owner));
/** A leader's unit as their powers make it: for a battle read back from a save. */
export const leaderDefOf = (g: Game, u: Unit): UnitDef => leaderDef(UNITS[u.type], g.heroOf(u.owner), u.hero!.rank);
/** A Warlord's call quickens the arm of those of theirs within reach of it: what a soldier's pause between blows is multiplied by. */
export const callHaste = (g: Game, u: Unit): number => (g.calledAt(u.owner, u.x, u.y) === 'warlord' ? CALLS.warlord.haste! : 1);
/** A Strategist's call wards those of theirs within reach of it: what a blow that lands on one is multiplied by. */
export const callWard = (g: Game, t: Entity): number => (t.kind === 'unit' && g.calledAt(t.owner, t.x, t.y) === 'strategist' ? CALLS.strategist.ward! : 1);
