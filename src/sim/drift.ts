// Drift (docs/DESIGN.md, "Drift", step 5). Villagers do as they are set to while they are fed and safe. As more of a
// town struggles, more of them turn to what is worse for them; a well-kept town drifts toward the holy way instead.
// It is cause and effect, read from what the rest of the game already keeps:
//
//   strain  hunger (famine.ts), raids (the town attacked, or carried off from on the map), grief (grief.ts; on
//           the map, the loss of known people weighed by their fame, notableweight.ts),
//           sickness (plague), and unrest on the map. 0 to 1.
//   care    fed, safe and unbereaved, with a church, and on the map the leader there. 0 to 1, only with no strain.
//
// In a campaign town (a battle or a visit) once a second: with a chance that grows with the strain, one of the
// town's people leaves the work they were set to: a woman goes to the tavern to work there, a man to the gold
// mine. With a chance that grows with the care, one goes to the church instead, or one who drifted to the tavern
// comes out of it. The player sees it said, and can set them back to work.
//
// On the map once a season: each town's own standing (townfaith.ts) falls with the strain, and decrees (decrees.ts)
// bend it. A well-kept town is drawn up on the map by its church, which townfaith.ts already counts, and by a decree
// calling it to church; drift adds no rise of its own there, so as not to count the church twice. A strained town's men go to the mines and its women to its tavern, if it has one: gold
// comes in, and a town with a tavern falls the faster. The nation's standing is its towns' (townfaith.ts), so it
// follows them.
import type { Building, Game, Player, Unit } from './game';
import type { Campaign } from './campaign';
import { faithAt, swayTown } from './townfaith';
import { isDecadent } from './creed';
import { want } from './famine';
import { griefSeason, griefShare } from './grief';
import { GRIEF_MAX, townGrief } from './notableweight';
import { townMood } from './portrait';
import { folkOf, grown } from './township';
import { decreeEffect, decreesSeason, sensibleDecrees } from './decrees';
import { leaderAt } from './court';

declare module './township' {
  interface Folk {
    /** How the town stood at the last season's turn, and the part of a step of standing not yet taken. */
    drift?: { strain: number; care: number; moved: number; hungry: boolean; raided: boolean; carry?: number };
  }
}
declare module './game' {
  interface Player { /** Who has drifted in this battle, and where to. */ drifted?: { tavern: number; mine: number; church: number; back: number } }
}

/** Weights of what strains a town (they add to at most 1). */
export const STRAIN = { hunger: 0.35, raided: 0.25, grief: 0.2, sick: 0.2, rebel: 0.2 };
/** In a town: the chance a second, at full strain, that someone drifts to worse; at full care, to better. */
export const DRIFT_RATE = 1 / 40;
export const HOLY_RATE = 1 / 90;
/** On the map: how far a town's standing falls in a season at full strain, and rises for a call to church at full strength. */
export const FALL = 10;
export const RISE = 4;
/** Food a head a town needs on hand not to be hungry on the map, and to count as well fed. */
export const LEAN_FOOD = 10;
export const FED_FOOD = 30;
/** Gold a season from each man gone to the mines, and each woman gone to the tavern, at full strain. */
export const MINE_GOLD = 8;
export const TAVERN_GOLD = 12;

const clamp = (v: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, v));

/** How a people in a town stands: how strained and how cared for. */
export function townStrain(g: Game, p: Player): { strain: number; care: number } {
  const w = want(p), hunger = w === 'famine' ? 1 : w === 'hungry' ? 0.6 : p.res.food < 50 ? 0.3 : 0;
  const raided = p.lastAttacked && g.time - p.lastAttacked.t < 60 ? 1 : 0;
  let people = 0, sick = 0;
  for (const u of g.units) if (u.owner === p.id && u.type === 'villager') { people++; if (u.plagueT > 0) sick++; }
  const sickShare = people ? clamp((3 * sick) / people) : 0, grief = griefShare(g, p.id);
  const strain = clamp(STRAIN.hunger * hunger + STRAIN.raided * raided + STRAIN.grief * grief + STRAIN.sick * sickShare);
  const safe = !p.lastAttacked || g.time - p.lastAttacked.t > 180;
  const church = g.buildings.some((b) => b.owner === p.id && b.type === 'temple' && b.complete && !b.dead);
  const care = strain > 0 ? 0 : clamp((p.res.food > 300 ? 0.3 : 0) + (safe ? 0.3 : 0) + (grief === 0 ? 0.2 : 0) + (church ? 0.2 : 0));
  return { strain, care };
}

const roomIn = (b: Building | undefined): boolean => !!b && b.complete && !b.dead && (b.staff?.length ?? 0) < (b.def.staff ?? 0);
/** Someone at work or idle, out in the open, free to wander off: not called to arms, not freed, not a child. */
const loose = (g: Game, u: Unit, owner: number): boolean => u.owner === owner && u.type === 'villager' && !u.dead && !u.inside && u.growT <= 0 && !u.freed && !u.enlisted && u.order?.t !== 'enlist';

/** A second passes in a campaign town: someone may drift from their work, to worse or to better. */
export function driftSecond(g: Game): void {
  if (!g.bornOnly) return;
  for (const p of g.players) {
    if (p.neutral || p.defeated) continue;
    const { strain, care } = townStrain(g, p);
    const d = (p.drifted ??= { tavern: 0, mine: 0, church: 0, back: 0 });
    const mine = (type: string) => g.buildings.find((b) => b.owner === p.id && b.type === type && roomIn(b));
    if (strain > 0 && g.rng() < strain * DRIFT_RATE) {
      const tavern = mine('tavern');
      const woman = tavern ? g.units.find((u) => loose(g, u, p.id) && u.gender === 'f' && !(u.order?.t === 'gather' && u.order.id === tavern.id)) : undefined;
      if (tavern && woman) { g.cmdTarget(p.id, [woman.id], tavern.id); d.tavern++; say(g, p, `${woman.name} has left her work for the tavern.`); continue; }
      const man = g.units.find((u) => loose(g, u, p.id) && u.gender === 'm' && !(u.order?.t === 'gather' && g.entities.get(u.order.id)?.type === 'gold'));
      const gold = man ? g.findResourceNear(man.x, man.y, 'gold', p.id, 30) : null;
      if (man && gold) { g.cmdTarget(p.id, [man.id], gold.id); d.mine++; say(g, p, `${man.name} has left his work for the gold mine.`); }
    } else if (care > 0 && g.rng() < care * HOLY_RATE) {
      const tavern = g.buildings.find((b) => b.owner === p.id && b.type === 'tavern' && (b.staff?.length ?? 0) > 0);
      if (tavern && g.cmdUnstaff(p.id, tavern.id) > 0) { d.back++; say(g, p, 'One of the tavern\'s women has come back to honest work.'); continue; }
      const church = mine('temple'), who = church ? g.units.find((u) => loose(g, u, p.id) && !u.order) : undefined;
      if (church && who) { g.cmdTarget(p.id, [who.id], church.id); d.church++; say(g, p, `${who.name} has gone to serve at the church.`); }
    }
  }
}
const say = (g: Game, p: Player, text: string): void => { g.events.push({ t: 'msg', player: p.id, text }); };

/** A town's own standing (townfaith.ts). */
export const townStanding = (c: Campaign, tid: number): number => faithAt(c, tid);

/** A season passes for one town on the map: its grief, its strain and care, and how far its standing moves. Returns the move. */
export function driftTown(c: Campaign, tid: number): number {
  const t = c.territories[tid], f = folkOf(c, tid), mood = townMood(c, tid);
  griefSeason(f, !!mood.bereaved);
  const people = Math.max(1, grown(f) + f.children), food = f.stores.food / people;
  // Hunger is the town's own larder, or a famine on its land (acts.ts); a hard season on the map costs supplies, not food.
  const famine = (c.events ?? []).some((x) => x.at === tid && x.kind === 'famine' && x.until >= c.turn - 1);
  const hunger = famine ? 1 : food < LEAN_FOOD ? 0.6 : 0;
  const e = decreeEffect(c, tid, isDecadent(townStanding(c, tid)));
  const strain = clamp((STRAIN.hunger * hunger + STRAIN.raided * Number(mood.raided) + STRAIN.sick * Number(mood.sick) + STRAIN.rebel * Number(mood.rebel) + STRAIN.grief * Math.max(Number((f.grief ?? 0) > 0) * 0.5, townGrief(f.notables, c.turn) / GRIEF_MAX)) * e.strainScale + e.strainAdd);
  const church = t.buildings.includes('church'), tavern = t.buildings.includes('tavern') && !e.tavernShut;
  const care = strain > 0 || e.holyBarred ? 0 : clamp((food >= FED_FOOD ? 0.3 : 0) + 0.3 + (church ? 0.2 : 0) + (leaderHere(c, tid) ? 0.2 : 0) + e.care);
  // Only the call to church raises a town here; the rest of its care is shown, and its church is counted by townfaith.ts.
  const rise = strain > 0 || e.holyBarred ? 0 : RISE * Math.min(1, e.care);
  // The men to the mines and the women to the tavern: gold, and a town with a tavern falls the faster for it.
  f.stores.gold += Math.round(MINE_GOLD * strain * f.men + (tavern ? TAVERN_GOLD * strain * f.women : 0)) + e.gold;
  const moved = rise - FALL * strain * (tavern ? 1.2 : 1) + e.sway;
  // The town's standing moves in whole steps; what is left over is carried to the next season.
  let carry = (f.drift?.carry ?? 0) + moved;
  const step = Math.trunc(carry);
  if (step) { swayTown(c, tid, step); carry -= step; }
  f.drift = { strain, care, moved, hungry: hunger > 0, raided: !!(mood.raided || mood.rebel), carry };
  return moved;
}
const leaderHere = (c: Campaign, tid: number): boolean => leaderAt(c, c.territories[tid].owner, tid);

/** A season passes on the map: spent decrees are struck off and every town drifts. */
export function driftSeason(c: Campaign): void {
  decreesSeason(c);
  for (const t of c.territories) if (!t.horde) driftTown(c, t.id);
}

/** How a town stood at the last turn, for whoever decides on decrees. */
export function driftOf(c: Campaign, tid: number): { hungry: boolean; raided: boolean; moved: number; standing: number } {
  const f = folkOf(c, tid);
  return { hungry: !!f.drift?.hungry, raided: !!f.drift?.raided, moved: f.drift?.moved ?? 0, standing: townStanding(c, tid) };
}

/** The map's season for drift: the computer's peoples give their decrees, then every town drifts. */
export function seasonDrift(c: Campaign): void {
  for (const f of c.factions) if (f.alive && f.isAI) sensibleDecrees(c, f.id, (tid) => driftOf(c, tid));
  driftSeason(c);
}
