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
import type { Campaign } from './campaign';
import { faithAt, swayNation, swayTown } from './townfaith';
import { isDecadent } from './creed';
import { griefSeason } from './grief';
import { GRIEF_MAX, nationLoss, townGrief } from './notableweight';
import { townMood } from './portrait';
import { folkOf, grown } from './township';
import { decreeEffect, decreesSeason, sensibleDecrees } from './decrees';
import { leaderAt } from './court';

declare module './township' {
  interface Folk {
    /** How the town stood at the last season's turn, and the part of a step of standing not yet taken. */
    drift?: { strain: number; care: number; moved: number; hungry: boolean; raided: boolean; carry?: number };
    /** Who of the town has drifted from their work: women at the tavern, men at the mines. */
    drifted?: Drifted;
  }
}
/** Who of a town has drifted from their work. */
export interface Drifted { tavern: number; mines: number }

/** Weights of what strains a town on the map (they add to at most 1). */
export const STRAIN = { hunger: 0.35, raided: 0.25, grief: 0.2, sick: 0.2, rebel: 0.2 };
/** On the map, a season: the most who drift at full strain, the most who come back at full care, and the most of a town's women or men who drift. */
export const GO_MOST = 3;
export const BACK_MOST = 2;
export const SHARE = 0.5;
/** Standing a season for every two women at the tavern. */
export const TAVERN_SWAY = 1;
/** How far a nation's standing dips a season for its known people lately lost (notableweight.ts's `nationLoss`, 0 to 0.3). */
export const NATION_DIP = 20;
/** On the map: how far a town's standing falls in a season at full strain, and rises for a call to church at full strength. */
export const FALL = 10;
export const RISE = 4;
/** Food a head a town needs on hand not to be hungry on the map, and to count as well fed. */
export const LEAN_FOOD = 10;
export const FED_FOOD = 30;
/** Gold a season from each man at the mines, and each woman at the tavern. */
export const MINE_GOLD = 4;
export const TAVERN_GOLD = 6;

const clamp = (v: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, v));

/** A town's own standing (townfaith.ts). */
export const townStanding = (c: Campaign, tid: number): number => faithAt(c, tid);

/** A season passes for one town on the map: its grief, its strain and care, and how far its standing moves. Returns the move. */
export function driftTown(c: Campaign, tid: number): number {
  const t = c.territories[tid], f = folkOf(c, tid), mood = townMood(c, tid);
  // A band's raid (threats.ts marks it 'raid', or 'carried' when it took people) is a raid, and people carried off are mourned.
  const struck = (kinds: string[]): boolean => (c.events ?? []).some((x) => x.at === tid && kinds.includes(x.kind) && x.until >= c.turn - 1);
  const raided = !!mood.raided || struck(['raid', 'carried']);
  griefSeason(f, !!mood.bereaved || struck(['carried']));
  const people = Math.max(1, grown(f) + f.children), food = f.stores.food / people;
  // Hunger is the town's own larder, or a famine on its land (acts.ts); a hard season on the map costs supplies, not food.
  const famine = (c.events ?? []).some((x) => x.at === tid && x.kind === 'famine' && x.until >= c.turn - 1);
  const hunger = famine ? 1 : food < LEAN_FOOD ? 0.6 : 0;
  const e = decreeEffect(c, tid, isDecadent(townStanding(c, tid)));
  const strain = clamp((STRAIN.hunger * hunger + STRAIN.raided * Number(raided) + STRAIN.sick * Number(mood.sick) + STRAIN.rebel * Number(mood.rebel) + STRAIN.grief * Math.max(Number((f.grief ?? 0) > 0) * 0.5, townGrief(f.notables, c.turn) / GRIEF_MAX)) * e.strainScale + e.strainAdd);
  const church = t.buildings.includes('church'), tavern = t.buildings.includes('tavern') && !e.tavernShut;
  const care = strain > 0 || e.holyBarred ? 0 : clamp((food >= FED_FOOD ? 0.3 : 0) + 0.3 + (church ? 0.2 : 0) + (leaderHere(c, tid) ? 0.2 : 0) + e.care);
  // Only the call to church raises a town here; the rest of its care is shown, and its church is counted by townfaith.ts.
  const rise = strain > 0 || e.holyBarred ? 0 : RISE * Math.min(1, e.care);
  // Who drifts: under strain a few a season, women to the tavern and men to the mines by turns, up to half of each;
  // with care and no strain, a few come back. A shut tavern sends its women home; the women ordered into it stay.
  const d: Drifted = { ...(f.drifted ?? { tavern: 0, mines: 0 }) };
  const capW = tavern ? Math.floor(f.women * SHARE) : 0, capM = Math.floor(f.men * SHARE);
  if (!tavern) d.tavern = 0;
  if (strain > 0) {
    let go = Math.ceil(strain * GO_MOST);
    for (let i = 0; go > 0 && i < 2 * GO_MOST; i++) {
      const woman = (c.turn + tid + i) % 2 === 0;
      if (woman && d.tavern < capW) { d.tavern++; go--; } else if (!woman && d.mines < capM) { d.mines++; go--; }
    }
  } else if (care > 0) {
    let back = care >= 0.5 ? BACK_MOST : 1;
    const kept = e.tavernWomen ? Math.floor(f.women * SHARE * e.tavernWomen) : 0;
    while (back > 0 && d.tavern > kept) { d.tavern--; back--; }
    while (back > 0 && d.mines > 0) { d.mines--; back--; }
  }
  if (e.tavernWomen && tavern) d.tavern = Math.max(d.tavern, Math.floor(f.women * SHARE * e.tavernWomen));
  d.tavern = Math.min(d.tavern, f.women); d.mines = Math.min(d.mines, f.men);
  if (d.tavern || d.mines) f.drifted = d; else delete f.drifted;
  // What they bring in: gold from the mines and the tavern. A town with women at the tavern falls the faster.
  f.stores.gold += d.mines * MINE_GOLD + d.tavern * TAVERN_GOLD + e.gold;
  const moved = rise - FALL * strain - TAVERN_SWAY * Math.floor(d.tavern / 2) + e.sway;
  // The town's standing moves in whole steps; what is left over is carried to the next season.
  let carry = (f.drift?.carry ?? 0) + moved;
  const step = Math.trunc(carry);
  if (step) { swayTown(c, tid, step); carry -= step; }
  f.drift = { strain, care, moved, hungry: hunger > 0, raided: raided || !!mood.rebel, carry };
  return moved;
}
const leaderHere = (c: Campaign, tid: number): boolean => leaderAt(c, c.territories[tid].owner, tid);

/** A season passes on the map: spent decrees are struck off, every town drifts, and a nation that has lately lost
 * known people (notableweight.ts) dips in standing, all its towns together. */
export function driftSeason(c: Campaign): void {
  decreesSeason(c);
  for (const t of c.territories) if (!t.horde) driftTown(c, t.id);
  for (const x of c.factions) {
    if (!x.alive) continue;
    const loss = nationLoss(c.territories.filter((t) => t.owner === x.id && t.folk).map((t) => t.folk!.notables), c.turn);
    if (loss > 0) swayNation(c, x.id, -Math.round(loss * NATION_DIP));
  }
}

/** Who of a town has drifted from their work (nobody, for a town never strained). */
export const driftedOf = (c: Campaign, tid: number): Drifted => folkOf(c, tid).drifted ?? { tavern: 0, mines: 0 };
/** The share of a town's men still at their posts: men at the mines leave the walls thin. */
export function watchOf(c: Campaign, tid: number): number {
  const men = folkOf(c, tid).men;
  return men > 0 ? 1 - Math.min(men, driftedOf(c, tid).mines) / men : 1;
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
